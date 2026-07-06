"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { tierStyle } from "@/lib/tier";
import type { Tier } from "@/lib/types";

interface FollowedAccount {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  final_score: number | null;
  tier: Tier | null;
  weekly_delta: number | null;
}

interface MeResponse {
  user: { login: string; image: string | null } | null;
}

/**
 * Logged-in homepage module: the accounts you follow and how their scores moved
 * this week. A client island — the homepage is force-static, so this probes
 * /api/me and only then pulls /api/follows; anonymous visitors render nothing
 * (zero layout shift: the section stays empty until data proves it should show).
 */
export function HomeFollowing() {
  const t = useTranslations("follow");
  const [accounts, setAccounts] = useState<FollowedAccount[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
        if (!alive || !me?.user) return;
        setSignedIn(true);
        const res = await fetch("/api/follows");
        if (!res.ok) return;
        const data = (await res.json()) as { accounts: FollowedAccount[] | null };
        if (alive && Array.isArray(data.accounts)) setAccounts(data.accounts);
      } catch {
        // analytics-grade module — fail silent, the homepage must never break
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!signedIn) return null;

  return (
    <section className="mx-auto mt-10 w-full max-w-2xl">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-zinc-100">👀 {t("homeTitle")}</h2>
          <span className="text-xs text-zinc-500">{t("homeSub")}</span>
        </div>
        {accounts === null ? (
          <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/5" />
        ) : accounts.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{t("homeEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {accounts.map((a) => {
              const style = a.tier ? tierStyle(a.tier) : null;
              const delta = a.weekly_delta;
              return (
                <li key={a.username}>
                  <Link
                    href={`/u/${a.username}`}
                    className="flex items-center gap-3 rounded-lg px-1 py-2 transition hover:bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.avatar_url ?? `https://github.com/${a.username}.png?size=64`}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="h-7 w-7 rounded-full bg-white/10"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
                      @{a.username}
                    </span>
                    {a.final_score !== null && style ? (
                      <>
                        <span className={`text-sm font-bold tabular-nums ${style.text}`}>
                          {style.emoji} {a.final_score.toFixed(2)}
                        </span>
                        {delta !== null ? (
                          <span
                            className={`w-14 text-right text-xs font-bold tabular-nums ${
                              delta > 0 ? "text-emerald-300" : "text-rose-300"
                            }`}
                          >
                            {delta > 0 ? "↑" : "↓"}
                            {Math.abs(delta).toFixed(1)}
                          </span>
                        ) : (
                          <span className="w-14 text-right text-xs text-zinc-600">—</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">{t("unrated")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
