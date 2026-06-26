import { describe, expect, it } from "vitest";
import { isEcosystemImpactPr } from "../github";
import { logRatio, score } from "../score";
import type { RawMetrics, RecentPr } from "../types";
import fixtures from "./score-fixtures.json";

const pr = (over: Partial<RecentPr>): RecentPr => ({
  title: "x",
  repo: "owner/repo",
  repo_stars: 0,
  churn: 100,
  changed_files: 3,
  trivial: false,
  ...over,
});

/**
 * Parity test: the TS port of `score()` must reproduce, byte-for-byte, the output
 * of the canonical Python skill (`fetch_github_profile.py`). Fixtures are the
 * Python `score()` output captured for representative account shapes — see
 * scripts that regenerate them in the README. If these drift, the website and the
 * open-source skill would disagree on the number.
 */
describe("score() parity with Python skill", () => {
  for (const [name, { input, expected }] of Object.entries(fixtures)) {
    it(`matches Python output for "${name}"`, () => {
      const result = score(input as unknown as RawMetrics);
      expect(result).toEqual(expected);
    });
  }
});

describe("isEcosystemImpactPr (dimension 4 qualification)", () => {
  const me = "karpathy";

  it("counts a substantial PR into your OWN ≥1000★ repo (maintainer value)", () => {
    // karpathy → nanoGPT etc.: maintaining a hugely popular project you created.
    expect(isEcosystemImpactPr(pr({ repo: "karpathy/nanoGPT", repo_stars: 30000 }), me)).toBe(true);
  });

  it("does NOT count PRs into your own <1000★ repo (self-PR-farming pattern)", () => {
    // AsperforMias → own 0-star repos: self-review/self-merge inflation.
    expect(isEcosystemImpactPr(pr({ repo: "asper/junk", repo_stars: 0 }), "asper")).toBe(false);
    expect(isEcosystemImpactPr(pr({ repo: "karpathy/sidequest", repo_stars: 500 }), me)).toBe(false);
  });

  it("counts a substantial PR into an external ≥200★ repo", () => {
    expect(isEcosystemImpactPr(pr({ repo: "langgenius/dify", repo_stars: 5000 }), me)).toBe(true);
  });

  it("does NOT count an external repo below 200★", () => {
    expect(isEcosystemImpactPr(pr({ repo: "someone/tiny", repo_stars: 100 }), me)).toBe(false);
  });

  it("never counts trivial (≤5-line) PRs, even into huge repos", () => {
    expect(
      isEcosystemImpactPr(pr({ repo: "torvalds/linux", repo_stars: 200000, trivial: true }), me),
    ).toBe(false);
  });
});

describe("logRatio", () => {
  it("returns 0 for non-positive values", () => {
    expect(logRatio(0, 5000)).toBe(0);
    expect(logRatio(-5, 5000)).toBe(0);
  });
  it("caps at 1.0 when value >= full_at", () => {
    expect(logRatio(5000, 5000)).toBe(1);
    expect(logRatio(99999, 5000)).toBe(1);
  });
  it("is monotonic increasing", () => {
    expect(logRatio(10, 5000)).toBeLessThan(logRatio(100, 5000));
  });
});
