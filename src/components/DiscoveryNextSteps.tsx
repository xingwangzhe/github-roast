"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { discoveryNextStepCards } from "@/lib/discovery-next-steps";
import { trackEvent } from "@/lib/track";

export function DiscoveryNextSteps() {
  const t = useTranslations("discoveryNext");
  return (
    <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {discoveryNextStepCards().map((card) => (
        <Link
          key={card.kind}
          href={card.href}
          onClick={() =>
            trackEvent("discovery_recommendation_click", {
              surface: "leaderboard",
              kind: card.kind,
              subject: card.href,
            })
          }
          className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 hover:border-white/20 hover:bg-white/[0.06]"
        >
          <h2 className="font-black text-zinc-100">{t(`${card.kind}.title`)}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t(`${card.kind}.body`)}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-orange-300">
            {t(`${card.kind}.cta`)} →
          </span>
        </Link>
      ))}
    </section>
  );
}
