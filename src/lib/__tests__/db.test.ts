import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROAST_CACHE_VERSION } from "../cache-version";
import type { ScoreEntry } from "../db";

let db: typeof import("../db");
let tmpDir: string;

const entry: ScoreEntry = {
  username: "RockChinQ",
  display_name: "Rock",
  avatar_url: null,
  profile_url: "https://github.com/RockChinQ",
  final_score: 95.2,
  tier: "夯",
  tags: { zh: ["开源狠人"], en: ["oss beast"] },
  roast_line: { zh: "强到没法吐槽。", en: "Too good to roast." },
  bot_score: 0,
  sub_scores: {
    account_maturity: 10,
    original_project_quality: 18,
    contribution_quality: 27,
    ecosystem_impact: 20,
    community_influence: 8,
    activity_authenticity: 12.2,
  },
  scanned_at: 1_800_000_000_000,
};

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "ghroast-db-"));
  process.env.TURSO_DATABASE_URL = `file:${join(tmpDir, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  db = await import("../db");
});

afterAll(() => {
  delete process.env.TURSO_DATABASE_URL;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("getArchivedRoast", () => {
  it("replays archived reports by username and language", async () => {
    await db.recordScore(entry);
    await db.updateRoast("RockChinQ", "## 中文报告", "zh");
    await db.updateRoast("RockChinQ", "## English report", "en");

    await expect(db.getArchivedRoast("rockchinq", "zh")).resolves.toMatchObject({
      username: "rockchinq",
      final_score: 95.2,
      tier: "夯",
      tags: entry.tags,
      report: "## 中文报告",
    });
    await expect(db.getArchivedRoast("RockChinQ", "en")).resolves.toMatchObject({
      report: "## English report",
    });
  });

  it("does not replay archived reports from a stale roast version", async () => {
    await db.recordScore({ ...entry, username: "stale-roast" });
    await db.updateRoast("stale-roast", "## stale report", "zh");

    const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
    await client.execute({
      sql: `UPDATE scores SET roast_version = ? WHERE username = ?`,
      args: [`${ROAST_CACHE_VERSION}-old`, "stale-roast"],
    });

    await expect(db.getArchivedRoast("stale-roast", "zh")).resolves.toBeNull();
  });

  it("does not replay archived reports from rows without cache versions", async () => {
    await db.recordScore({ ...entry, username: "legacy-roast" });
    await db.updateRoast("legacy-roast", "## legacy report", "zh");

    const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
    await client.execute({
      sql: `UPDATE scores
            SET score_version = NULL, roast_version = NULL
            WHERE username = ?`,
      args: ["legacy-roast"],
    });

    await expect(db.getArchivedRoast("legacy-roast", "zh")).resolves.toBeNull();
  });
});

describe("score snapshots", () => {
  it("stores one generated-at stub when a completed roast is persisted", async () => {
    const username = "roast-snapshot";
    const before = Date.now();
    await db.recordScore({ ...entry, username, final_score: 90 });
    await db.updateRoast(username, "## first report", "zh");
    await db.recordScore({
      ...entry,
      username,
      final_score: 96.1,
      scanned_at: entry.scanned_at + 2 * 60 * 60 * 1000,
    });
    await db.updateRoast(username, "## second report", "en");
    const after = Date.now();

    const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
    const res = await client.execute({
      sql: `SELECT COUNT(*) AS n,
                   MIN(generated_at) AS first_generated_at,
                   MAX(generated_at) AS last_generated_at,
                   GROUP_CONCAT(roast_lang, ',') AS langs
            FROM score_snapshots
            WHERE username = ?`,
      args: [username],
    });

    expect(Number(res.rows[0]?.n)).toBe(2);
    expect(Number(res.rows[0]?.first_generated_at)).toBeGreaterThanOrEqual(before);
    expect(Number(res.rows[0]?.last_generated_at)).toBeLessThanOrEqual(after);
    expect(String(res.rows[0]?.langs).split(",").sort()).toEqual(["en", "zh"]);
  });
});

describe("profile comments", () => {
  it("stores anonymous and GitHub comments for a profile", async () => {
    const anonymous = await db.createProfileComment({
      targetUsername: "Torvalds",
      text: "硬核 🔥",
      author: { type: "anonymous" },
    });
    const github = await db.createProfileComment({
      targetUsername: "torvalds",
      text: "Legend status",
      author: {
        type: "github",
        username: "yyx990803",
        avatarUrl: "https://avatars.githubusercontent.com/u/499550",
      },
      authorGithubId: 499550,
    });

    expect(anonymous).toMatchObject({
      targetUsername: "torvalds",
      author: { type: "anonymous" },
      text: "硬核 🔥",
    });
    expect(github).toMatchObject({
      targetUsername: "torvalds",
      author: {
        type: "github",
        username: "yyx990803",
        avatarUrl: "https://avatars.githubusercontent.com/u/499550",
      },
      text: "Legend status",
    });

    await expect(db.getProfileComments("TORVALDS")).resolves.toMatchObject([
      { author: { type: "anonymous" }, text: "硬核 🔥" },
      { author: { type: "github", username: "yyx990803" }, text: "Legend status" },
    ]);
  });
});

describe("profile reactions", () => {
  it("stores one durable reaction per GitHub user and target profile", async () => {
    await db.setProfileReaction({
      targetUsername: "React-Target",
      voterGithubId: 101,
      voterLogin: "alice",
      reaction: "like",
    });
    await db.setProfileReaction({
      targetUsername: "react-target",
      voterGithubId: 202,
      voterLogin: "bob",
      reaction: "poop",
    });

    await expect(db.getProfileReactionState("REACT-TARGET", 101)).resolves.toEqual({
      counts: { like: 1, poop: 1, kick: 0, fire: 0, salute: 0, clown: 0 },
      viewerReaction: "like",
    });
  });

  it("atomically replaces an existing reaction instead of adding another vote", async () => {
    const state = await db.setProfileReaction({
      targetUsername: "react-target",
      voterGithubId: 101,
      voterLogin: "alice-renamed",
      reaction: "fire",
    });

    expect(state).toEqual({
      counts: { like: 0, poop: 1, kick: 0, fire: 1, salute: 0, clown: 0 },
      viewerReaction: "fire",
    });
  });

  it("removes only the authenticated user's reaction", async () => {
    const state = await db.removeProfileReaction({
      targetUsername: "REACT-TARGET",
      voterGithubId: 101,
    });

    expect(state).toEqual({
      counts: { like: 0, poop: 1, kick: 0, fire: 0, salute: 0, clown: 0 },
      viewerReaction: null,
    });
  });
});

describe("getTrendingLeaderboard", () => {
  it("counts unique lookups from the last seven days only", async () => {
    const now = Date.now();
    await db.recordScore({ ...entry, username: "fresh", final_score: 92, scanned_at: now });
    await db.recordScore({ ...entry, username: "stale", final_score: 100, scanned_at: now - 1 });

    await db.recordAccountLookup("fresh", "203.0.113.1");
    await db.recordAccountLookup("fresh", "203.0.113.2");
    await db.recordAccountLookup("fresh", "203.0.113.2"); // same visitor, same 24h window
    await db.recordAccountLookup("stale", "203.0.113.3");

    const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
    await client.execute({
      sql: `UPDATE account_lookup_limits
            SET last_counted_at = ?
            WHERE username = ?`,
      args: [now - 8 * 24 * 60 * 60 * 1000, "stale"],
    });
    await client.execute({
      sql: `UPDATE account_stats
            SET last_lookup_at = ?
            WHERE username = ?`,
      args: [now - 8 * 24 * 60 * 60 * 1000, "stale"],
    });

    const entries = await db.getTrendingLeaderboard(10);
    const fresh = entries.find((e) => e.username === "fresh");
    const stale = entries.find((e) => e.username === "stale");

    expect(fresh?.recent_lookup_count).toBe(2);
    expect(stale?.recent_lookup_count).toBe(0);
    expect(fresh?.trending_score).toBeGreaterThan(0);
    expect(entries[0]?.username).toBe("fresh");
  });
});

describe("getRank", () => {
  it("ranks by score desc over a shared population", async () => {
    await db.recordScore({ ...entry, username: "rank-low", final_score: 11 });
    await db.recordScore({ ...entry, username: "rank-mid", final_score: 22 });
    await db.recordScore({ ...entry, username: "rank-high", final_score: 33 });

    const low = await db.getRank(11);
    const mid = await db.getRank(22);
    const high = await db.getRank(33);
    expect(low && mid && high).toBeTruthy();
    // A higher score earns a smaller (better) rank number.
    expect(high!.rank).toBeLessThan(mid!.rank);
    expect(mid!.rank).toBeLessThan(low!.rank);
    // Every query measures the same population, and `below` tracks the score.
    expect(high!.total).toBe(low!.total);
    expect(high!.total).toBeGreaterThanOrEqual(3);
    expect(high!.below).toBeGreaterThan(mid!.below);
  });

  it("excludes hidden accounts from the ranking", async () => {
    const before = await db.getRank(22);
    await db.recordScore({ ...entry, username: "rank-hidden", final_score: 99 });
    await db.hideUser("rank-hidden");
    const after = await db.getRank(22);
    // A hidden high score neither inflates the total nor worsens the rank.
    expect(after!.total).toBe(before!.total);
    expect(after!.rank).toBe(before!.rank);
  });
});

describe("recordRepoGraph + updateInfluenceStats", () => {
  const raw = () => createClient({ url: process.env.TURSO_DATABASE_URL! });

  it("upserts repos and replaces a developer's edges", async () => {
    await db.recordRepoGraph("Alice", {
      repos: [
        {
          repo_key: "alice/cool",
          name_with_owner: "Alice/Cool",
          owner_login: "alice",
          name: "Cool",
          description: "a cool project",
          stars: 1200,
          forks: 30,
          language: "Rust",
          topics: ["cli"],
        },
      ],
      links: [{ repo_key: "alice/cool", relation: "owner", commits: null, prs: null, weight: 1200 }],
    });

    const client = raw();
    const repo = await client.execute({
      sql: `SELECT name_with_owner, owner_login, stars, language FROM repos WHERE repo_key = ?`,
      args: ["alice/cool"],
    });
    expect(repo.rows[0]).toMatchObject({
      name_with_owner: "Alice/Cool",
      owner_login: "alice",
      stars: 1200,
      language: "Rust",
    });
    const edge = await client.execute({
      sql: `SELECT relation, weight FROM repo_developers WHERE username = ? AND repo_key = ?`,
      args: ["alice", "alice/cool"],
    });
    expect(edge.rows[0]).toMatchObject({ relation: "owner", weight: 1200 });
  });

  it("takes the higher star count and never nulls owner metadata on a later thin scan", async () => {
    // Bob contributes to alice/cool later with sparser metadata but a higher star count.
    await db.recordRepoGraph("Bob", {
      repos: [
        {
          repo_key: "alice/cool",
          name_with_owner: "alice/cool",
          owner_login: "alice",
          name: "cool",
          description: null,
          stars: 1500,
          forks: null,
          language: null,
          topics: [],
        },
      ],
      links: [{ repo_key: "alice/cool", relation: "contributor", commits: 8, prs: 2, weight: 10 }],
    });

    const client = raw();
    const repo = await client.execute({
      sql: `SELECT stars, language, description FROM repos WHERE repo_key = ?`,
      args: ["alice/cool"],
    });
    // Star count moves up; the owner's rich language/description survive.
    expect(repo.rows[0]).toMatchObject({ stars: 1500, language: "Rust", description: "a cool project" });

    // Both developers now have an edge to the shared repo.
    const contributors = await client.execute({
      sql: `SELECT username, relation FROM repo_developers WHERE repo_key = ? ORDER BY username`,
      args: ["alice/cool"],
    });
    expect(contributors.rows.map((r) => r.username)).toEqual(["alice", "bob"]);
  });

  it("lifts followers/total_stars onto an existing scores row", async () => {
    await db.recordScore({ ...entry, username: "vip-user", final_score: 88 });
    await db.updateInfluenceStats("vip-user", 4200, 15000);

    const client = raw();
    const res = await client.execute({
      sql: `SELECT followers, total_stars FROM scores WHERE username = ?`,
      args: ["vip-user"],
    });
    expect(res.rows[0]).toMatchObject({ followers: 4200, total_stars: 15000 });
  });
});

describe("getRepoOverview + filterExistingRepoKeys", () => {
  const node = (over: Partial<import("../repo-graph").RepoNode> = {}) => ({
    repo_key: "acme/widget",
    name_with_owner: "acme/Widget",
    owner_login: "acme",
    name: "Widget",
    description: "a widget",
    stars: 3000,
    forks: 100,
    language: "Go",
    topics: ["cli"],
    ...over,
  });

  it("assembles the repo, its scored owner, and the contributor-quality summary", async () => {
    // Owner "acme" (夯) owns the repo; contributor "beta" (人上人) works on it.
    await db.recordScore({ ...entry, username: "acme", final_score: 96, tier: "夯" });
    await db.recordScore({ ...entry, username: "beta", final_score: 72, tier: "人上人" });
    await db.recordRepoGraph("acme", {
      repos: [node()],
      links: [{ repo_key: "acme/widget", relation: "owner", commits: null, prs: null, weight: 3000 }],
    });
    await db.recordRepoGraph("beta", {
      repos: [node({ language: null, description: null, topics: [] })],
      links: [
        { repo_key: "acme/widget", relation: "contributor", commits: 9, prs: 4, weight: 13 },
      ],
    });

    const overview = await db.getRepoOverview("acme/widget");
    expect(overview).not.toBeNull();
    expect(overview!.repo.name_with_owner).toBe("acme/Widget");
    // Owner resolves from the repo's owner_login → scores row.
    expect(overview!.owner).toMatchObject({ username: "acme", tier: "夯" });
    // Summary spans both edges (owner + contributor).
    expect(overview!.summary.count).toBe(2);
    expect(overview!.summary.avgScore).toBe(84); // (96 + 72) / 2
    expect(overview!.summary.tierCounts).toEqual([
      { tier: "夯", count: 1 },
      { tier: "人上人", count: 1 },
    ]);
  });

  it("returns null for a repo not in the graph", async () => {
    expect(await db.getRepoOverview("nobody/here")).toBeNull();
  });

  it("filters a key set down to repos that exist", async () => {
    const found = await db.filterExistingRepoKeys(["Acme/Widget", "ghost/missing"]);
    expect(found.has("acme/widget")).toBe(true);
    expect(found.has("ghost/missing")).toBe(false);
  });
});

