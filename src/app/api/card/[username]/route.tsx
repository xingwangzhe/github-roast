import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getAccountDetail, getPercentile } from "@/lib/db";
import { BADGE_COLOR, TIER_EN, TIER_LABEL_EN } from "@/lib/badge";
import { beatPercent } from "@/lib/percentile";
import { SPONSOR } from "@/lib/sponsor";
import type { Tier } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// Long edge cache: GitHub README views are served by the CDN (and camo) — the
// PNG is generated at most ~once per window per account. Keeps the bill flat.
const CDN_CACHE = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";

const W = 1200;
const H = 630;
const BG = "#0a0a0b";

// Module-cache the (tiny, ~30KB each) Latin fonts across warm invocations.
let fontCache: { name: string; data: Buffer; weight: 400 | 800; style: "normal" }[] | null = null;
async function fonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    readFile(new URL("./fonts/Inter-Regular.woff", import.meta.url)),
    readFile(new URL("./fonts/Inter-ExtraBold.woff", import.meta.url)),
  ]);
  fontCache = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 800, style: "normal" },
  ];
  return fontCache;
}

/** Pre-fetch the avatar to a data URL so a flaky fetch can't break rendering. */
async function avatarDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function png(element: React.ReactElement, fontList: Awaited<ReturnType<typeof fonts>>) {
  return new ImageResponse(element, {
    width: W,
    height: H,
    fonts: fontList,
    headers: { "Cache-Control": CDN_CACHE },
  });
}

function Shell({ glow, children }: { glow: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        backgroundColor: BG,
        backgroundImage: `radial-gradient(900px circle at 95% -10%, ${glow}, transparent 60%)`,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}>
      <div style={{ display: "flex", color: "#71717a" }}>
        GitHub Roast ·{" "}
        <span style={{ color: "#fb923c", fontWeight: 800, marginLeft: 6 }}>githubroast.icu</span>
      </div>
      <div style={{ display: "flex", color: "#71717a" }}>Powered by {SPONSOR.name}</div>
    </div>
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const fontList = await fonts();
  const { username } = await ctx.params;
  const name = decodeURIComponent(username ?? "").trim();

  const detail = USERNAME_RE.test(name) ? await getAccountDetail(name) : null;

  // Unrated placeholder — keeps READMEs from showing a broken image.
  if (!detail) {
    return png(
      <Shell glow="rgba(148,163,184,0.25)">
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
          @{name || "unknown"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#a1a1aa" }}>
            Not yet rated
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#71717a", marginTop: 8 }}>
            Get roasted at githubroast.icu
          </div>
        </div>
        <Brand />
      </Shell>,
      fontList,
    );
  }

  const tier = detail.tier as Tier;
  const color = BADGE_COLOR[tier];
  const counts = await getPercentile(detail.final_score);
  const beat = counts ? beatPercent(counts.below, counts.total) : null;
  const avatar = await avatarDataUrl(detail.avatar_url);
  const displayName =
    detail.display_name && /^[\x20-\x7e]+$/.test(detail.display_name) ? detail.display_name : null;
  const tags = (detail.tags.en ?? []).slice(0, 4);

  return png(
    <Shell glow={`${color}55`}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} width={96} height={96} style={{ borderRadius: 9999 }} alt="" />
        ) : (
          <div
            style={{
              display: "flex",
              width: 96,
              height: 96,
              borderRadius: 9999,
              backgroundColor: "#27272a",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            {detail.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>@{detail.username}</div>
          {displayName && (
            <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa" }}>{displayName}</div>
          )}
        </div>
      </div>

      {/* Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 132, fontWeight: 800, color, lineHeight: 1 }}>
              {detail.final_score.toFixed(2)}
            </span>
            <span style={{ fontSize: 44, color: "#52525b", marginLeft: 8, marginBottom: 12 }}>
              /100
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color, marginTop: 10 }}>
            {TIER_EN[tier]}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa", marginTop: 2 }}>
            {TIER_LABEL_EN[tier]}
          </div>
        </div>
        {beat !== null && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 72, fontWeight: 800, color }}>{beat}%</span>
            <span style={{ fontSize: 22, color: "#a1a1aa" }}>ahead of devs</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {tags.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                marginRight: 12,
                marginTop: 8,
                padding: "6px 18px",
                borderRadius: 9999,
                border: "1px solid rgba(251,146,60,0.3)",
                backgroundColor: "rgba(249,115,22,0.1)",
                color: "#fed7aa",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              #{t}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}

      <Brand />
    </Shell>,
    fontList,
  );
}
