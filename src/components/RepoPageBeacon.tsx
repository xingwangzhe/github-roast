"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track";

/**
 * Fires one `repo_page_view` when a /developers/repo project page mounts — the
 * north-star for the project-discovery surface. Unlike the profile landing beacon,
 * this page is ISR (its HTML is shared across visitors), so the acquisition
 * `source` MUST be classified client-side from `document.referrer` — a
 * server-read referer would be baked into the cached response and misattribute
 * every later visitor. Renders nothing.
 */
export function RepoPageBeacon({ repo }: { repo: string }) {
  useEffect(() => {
    trackEvent("repo_page_view", { repo, source: classifySource() });
  }, [repo]);
  return null;
}

/** Coarse referer bucket, client-side: profile | directory | search | social |
 *  internal | external | direct. Mirrors the profile landing buckets so the two
 *  funnels line up. */
function classifySource(): string {
  if (typeof document === "undefined" || !document.referrer) return "direct";
  let url: URL;
  try {
    url = new URL(document.referrer);
  } catch {
    return "direct";
  }
  const host = url.hostname.toLowerCase();
  const sameSite = host === window.location.hostname || host === "localhost";
  if (sameSite) {
    if (/^\/(en\/)?u\//.test(url.pathname)) return "profile";
    if (/^\/(en\/)?developers/.test(url.pathname)) return "directory";
    return "internal";
  }
  if (/(^|\.)github\.com$/.test(host)) return "external";
  if (/(^|\.)(google|bing|duckduckgo|baidu|yandex|ecosia|sogou)\./.test(host)) return "search";
  if (
    /(^|\.)(t\.co|x\.com|twitter\.com|facebook\.com|linkedin\.com|weibo\.com|reddit\.com|t\.me|linux\.do|news\.ycombinator\.com)$/.test(
      host,
    )
  )
    return "social";
  return "external";
}
