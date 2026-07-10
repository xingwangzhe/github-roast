"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { trackEvent } from "@/lib/track";

/**
 * A profile repo card that routes into the internal project page (used only when
 * the repo exists as a first-class `repos` row). Fires `repo_card_click` on
 * navigation so the profile → project edge of the discovery loop has a numerator
 * for its click-through rate. When the repo has no project page yet, the profile
 * renders a plain external GitHub anchor instead of this.
 */
export function RepoCardLink({
  href,
  repo,
  surface,
  className,
  children,
}: {
  /** Locale-relative project page path, e.g. "/developers/repo/owner/name". */
  href: string;
  /** Canonical "owner/name" — the click's subject, for grouping. */
  repo: string;
  /** Which profile section the card sits in: "featured" | "impact". */
  surface: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("repo_card_click", { repo, surface })}
    >
      {children}
    </Link>
  );
}
