import { describe, expect, it, vi } from "vitest";
import { searchDiscovery } from "../search";

const deps = {
  searchUsers: vi.fn(async () => [
    {
      username: "alice",
      display_name: "Alice",
      avatar_url: null,
      final_score: 91,
      tier: "顶级" as const,
    },
  ]),
  searchRepos: vi.fn(async () => [
    {
      repo_key: "acme/toolkit",
      name_with_owner: "Acme/Toolkit",
      owner_login: "acme",
      name: "Toolkit",
      description: "tools",
      stars: 1200,
      forks: 20,
      language: "TypeScript",
      topics: ["tooling"],
    },
  ]),
  getFacets: vi.fn(async (type: "language" | "org") =>
    type === "language"
      ? [
          { value: "TypeScript", count: 20 },
          { value: "Rust", count: 10 },
        ]
      : [{ value: "Acme", count: 5 }],
  ),
};

describe("searchDiscovery", () => {
  it("returns stable empty groups for an empty query", async () => {
    await expect(searchDiscovery(" ", deps)).resolves.toEqual({
      users: [],
      repos: [],
      facets: [],
    });
    expect(deps.searchUsers).not.toHaveBeenCalled();
  });

  it("keeps users compatible and adds canonical repo and facet routes", async () => {
    const result = await searchDiscovery("t", deps);

    expect(result.users[0]?.username).toBe("alice");
    expect(result.repos[0]).toMatchObject({
      repo_key: "acme/toolkit",
      href: "/developers/repo/acme/toolkit",
    });
    expect(result.facets).toEqual([
      {
        type: "language",
        value: "TypeScript",
        count: 20,
        href: "/developers/language/TypeScript",
      },
    ]);
  });

  it("fails soft per search source", async () => {
    const result = await searchDiscovery("a", {
      ...deps,
      searchRepos: async () => {
        throw new Error("db unavailable");
      },
    });
    expect(result.users).toHaveLength(1);
    expect(result.repos).toEqual([]);
    expect(result.facets[0]).toMatchObject({ type: "org", value: "Acme" });
  });
});
