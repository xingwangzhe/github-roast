"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  LeaderboardClient,
  type LeaderboardClientEntry,
  type LeaderboardLabels,
  type LeaderboardView,
} from "./LeaderboardClient";
import { LEADERBOARD_WINDOW_OPTIONS, type LeaderboardWindow } from "@/lib/leaderboardWindow";
import { withDevLeaderboardPreview } from "./devLeaderboardPreview";

export interface HomeLeaderboardLabels {
  openBoard: string;
  trendView: string;
  scoreView: string;
  heatView: string;
  windowAria: string;
  window24h: string;
  window7d: string;
  window30d: string;
  windowAll: string;
  loading: string;
  loadError: string;
}

const WINDOW_LABEL_KEY: Record<LeaderboardWindow, keyof HomeLeaderboardLabels> = {
  "24h": "window24h",
  "7d": "window7d",
  "30d": "window30d",
  all: "windowAll",
};

const cacheKey = (view: LeaderboardView, window: LeaderboardWindow) => `${view}:${window}`;

function TabDivider() {
  return (
    <span className="hidden h-10 w-1 shrink-0 rotate-12 rounded-full bg-[rgb(255,105,0)] sm:block sm:h-12" />
  );
}

export function HomeLeaderboardClient({
  heatEntries,
  labels,
  leaderboardLabels,
  pageSize,
  scoreEntries,
  trendingEntries,
}: {
  heatEntries: LeaderboardClientEntry[];
  labels: HomeLeaderboardLabels;
  leaderboardLabels: LeaderboardLabels;
  pageSize: number;
  scoreEntries: LeaderboardClientEntry[];
  trendingEntries: LeaderboardClientEntry[];
}) {
  const [view, setView] = useState<LeaderboardView>("trending");
  const [timeWindow, setTimeWindow] = useState<LeaderboardWindow>("all");

  // (view, window) -> entries. Seeded with the SSR'd "all"-window boards so the
  // default render needs no fetch; other windows load on demand from the
  // CDN+Redis-cached /api/leaderboard, so each (view, window) hits the DB at
  // most once per 5-min TTL across all visitors.
  const [cache, setCache] = useState<Record<string, LeaderboardClientEntry[]>>(() => ({
    [cacheKey("trending", "all")]: trendingEntries,
    [cacheKey("score", "all")]: scoreEntries,
    [cacheKey("heat", "all")]: heatEntries,
  }));
  const [error, setError] = useState(false);

  const key = cacheKey(view, timeWindow);
  const entries = cache[key];
  const loading = entries === undefined && !error;

  useEffect(() => {
    if (entries !== undefined) return; // already cached
    let cancelled = false;
    fetch(`/api/leaderboard?view=${view}&window=${timeWindow}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data) => {
        if (cancelled) return;
        const fetched = withDevLeaderboardPreview(
          view,
          (data.entries ?? []) as LeaderboardClientEntry[],
        );
        setCache((prev) => ({ ...prev, [key]: fetched }));
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entries, key, view, timeWindow]);

  // Clear a stale error before navigating to another board so its load isn't
  // masked by the previous failure (the error flag is shared across keys).
  const selectView = (next: LeaderboardView) => {
    setError(false);
    setView(next);
  };
  const selectWindow = (next: LeaderboardWindow) => {
    setError(false);
    setTimeWindow(next);
  };

  const fullBoardHref = (() => {
    const params = new URLSearchParams();
    if (view !== "trending") params.set("view", view);
    if (timeWindow !== "all") params.set("window", timeWindow);
    const qs = params.toString();
    return qs ? `/leaderboard?${qs}` : "/leaderboard";
  })();

  const tabClass = (tab: LeaderboardView) =>
    `shrink-0 snap-start rounded-full border px-3 py-2 text-sm font-black leading-tight transition-colors sm:border-transparent sm:px-0 sm:py-0 sm:text-lg ${
      view === tab
        ? "border-orange-500/40 bg-orange-500/10 text-zinc-100 sm:bg-transparent"
        : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-200 sm:border-transparent"
    }`;
  const windowTabClass = (w: LeaderboardWindow) =>
    `shrink-0 snap-start whitespace-nowrap rounded-full px-3 py-1 text-center text-xs font-bold transition-colors ${
      timeWindow === w ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
    }`;

  const activeEntries = entries ?? [];

  return (
    <section className="mt-16 w-full max-w-4xl">
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="-mx-1 flex max-w-full snap-x items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:gap-x-5 sm:overflow-visible sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => selectView("trending")}
              className={tabClass("trending")}
              aria-pressed={view === "trending"}
            >
              {labels.trendView}
            </button>
            <TabDivider />
            <button
              type="button"
              onClick={() => selectView("score")}
              className={tabClass("score")}
              aria-pressed={view === "score"}
            >
              {labels.scoreView}
            </button>
            <TabDivider />
            <button
              type="button"
              onClick={() => selectView("heat")}
              className={tabClass("heat")}
              aria-pressed={view === "heat"}
            >
              {labels.heatView}
            </button>
          </div>
        </div>
        <Link
          href={fullBoardHref}
          className="shrink-0 self-end text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline sm:ml-4 sm:self-auto"
        >
          {labels.openBoard}
        </Link>
      </div>

      <div
        role="group"
        aria-label={labels.windowAria}
        className="mb-4 flex w-full max-w-full snap-x items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 sm:w-fit"
      >
        {LEADERBOARD_WINDOW_OPTIONS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => selectWindow(w)}
            aria-pressed={timeWindow === w}
            className={windowTabClass(w)}
          >
            {labels[WINDOW_LABEL_KEY[w]]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-zinc-500">{labels.loadError}</p>
      ) : loading ? (
        <p className="py-10 text-center text-sm text-zinc-500">{labels.loading}</p>
      ) : (
        <LeaderboardClient
          key={key}
          initialView={view}
          timeWindow={timeWindow}
          labels={leaderboardLabels}
          pageSize={pageSize}
          scoreEntries={view === "score" ? activeEntries : []}
          heatEntries={view === "heat" ? activeEntries : []}
          trendingEntries={view === "trending" ? activeEntries : []}
        />
      )}
    </section>
  );
}
