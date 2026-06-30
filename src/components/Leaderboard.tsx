import { getTranslations } from "next-intl/server";
import {
  getHeatLeaderboard,
  getLeaderboard,
  getTrendingLeaderboard,
  type LeaderboardWindow,
} from "@/lib/db";
import {
  LeaderboardClient,
  type LeaderboardLabels,
  type LeaderboardView,
} from "./LeaderboardClient";
import { withDevLeaderboardPreview } from "./devLeaderboardPreview";

export async function Leaderboard({
  initialView = "trending",
  pageSize,
  timeWindow = "all",
}: {
  initialView?: LeaderboardView;
  pageSize?: number;
  timeWindow?: LeaderboardWindow;
}) {
  const t = await getTranslations("leaderboard");
  const labels: LeaderboardLabels = {
    empty: t("empty"),
    prev: t("prev"),
    next: t("next"),
    pageJumpLabel: t("pageJumpLabel"),
    collapse: t("collapse"),
    viewDetail: t("viewDetail", { username: "{username}" }),
    trendLabel: t("trendLabel"),
    trendTitle: t("trendTitle"),
    scoreLabel: t("scoreLabel"),
    scoreTitle: t("scoreTitle"),
    heatLabel: t("heatLabel"),
    heatTitle: t("heatTitle"),
  };

  const [trendingEntries, scoreEntries, heatEntries] = await Promise.all([
    initialView === "trending"
      ? getTrendingLeaderboard(500, undefined, timeWindow)
      : Promise.resolve([]),
    initialView === "score" ? getLeaderboard(500, undefined, timeWindow) : Promise.resolve([]),
    initialView === "heat" ? getHeatLeaderboard(500, undefined, timeWindow) : Promise.resolve([]),
  ]);

  return (
    <LeaderboardClient
      key={`${initialView}:${timeWindow}`}
      initialView={initialView}
      labels={labels}
      pageSize={pageSize}
      timeWindow={timeWindow}
      scoreEntries={withDevLeaderboardPreview("score", scoreEntries)}
      heatEntries={withDevLeaderboardPreview("heat", heatEntries)}
      trendingEntries={withDevLeaderboardPreview("trending", trendingEntries)}
    />
  );
}
