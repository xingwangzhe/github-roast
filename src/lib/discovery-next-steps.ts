import type { ProjectListItem, RelatedProject } from "@/lib/db";

const href = (key: string) =>
  `/developers/repo/${key.split("/").map(encodeURIComponent).join("/")}`;

export function relatedProjectRows(projects: RelatedProject[]) {
  return projects.map(({ project, sharedContributorCount }) => ({
    key: project.repo.repo_key,
    title: project.repo.name_with_owner,
    description: project.repo.description,
    href: href(project.repo.repo_key),
    language: project.repo.language,
    avgScore: project.avgScore,
    sharedContributorCount,
    relation: sharedContributorCount > 0 ? ("shared" as const) : ("language" as const),
  }));
}

export function commonProjectRows(projects: ProjectListItem[]) {
  return projects.map((project) => ({
    key: project.repo.repo_key,
    title: project.repo.name_with_owner,
    href: href(project.repo.repo_key),
    language: project.repo.language,
    avgScore: project.avgScore,
  }));
}

export function discoveryNextStepCards() {
  return [
    { kind: "projects" as const, href: "/projects" },
    { kind: "organizations" as const, href: "/developers#organizations" },
  ];
}
