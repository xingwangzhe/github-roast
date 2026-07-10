import {
  searchRepos,
  searchScoredUsers,
  type FacetCategory,
  type RepoDetail,
  type UserSuggestion,
} from "@/lib/db";
import { getFacetCategoriesCached } from "@/lib/developers";

export interface RepoSuggestion extends RepoDetail {
  href: string;
}

export interface FacetSuggestion extends FacetCategory {
  type: "language" | "org";
  href: string;
}

export interface DiscoverySearchResult {
  users: UserSuggestion[];
  repos: RepoSuggestion[];
  facets: FacetSuggestion[];
}

export interface DiscoverySearchDeps {
  searchUsers: (query: string, limit: number) => Promise<UserSuggestion[]>;
  searchRepos: (query: string, limit: number) => Promise<RepoDetail[]>;
  getFacets: (type: "language" | "org") => Promise<FacetCategory[]>;
}

const defaultDeps: DiscoverySearchDeps = {
  searchUsers: searchScoredUsers,
  searchRepos,
  getFacets: getFacetCategoriesCached,
};

async function safe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

function encodeSegments(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

export async function searchDiscovery(
  query: string,
  deps: DiscoverySearchDeps = defaultDeps,
): Promise<DiscoverySearchResult> {
  const q = query.trim().replace(/^@/, "");
  if (!q) return { users: [], repos: [], facets: [] };
  const [users, repos, languages, organizations] = await Promise.all([
    safe(() => deps.searchUsers(q, 6), []),
    safe(() => deps.searchRepos(q, 4), []),
    safe(() => deps.getFacets("language"), []),
    safe(() => deps.getFacets("org"), []),
  ]);
  const lower = q.toLowerCase();
  const facetMatches = (
    [
      ...languages.map((facet) => ({ type: "language" as const, ...facet })),
      ...organizations.map((facet) => ({ type: "org" as const, ...facet })),
    ]
      .filter((facet) => facet.value.toLowerCase().startsWith(lower))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, 6)
  );
  return {
    users,
    repos: repos.map((repo) => ({
      ...repo,
      href: `/developers/repo/${encodeSegments(repo.repo_key)}`,
    })),
    facets: facetMatches.map((facet) => ({
      ...facet,
      href: `/developers/${facet.type}/${encodeSegments(facet.value)}`,
    })),
  };
}
