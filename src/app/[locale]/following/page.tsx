import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FollowingBoard } from "@/components/FollowingBoard";
import { localeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "follow" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  return {
    title: `${t("pageTitle")} · ${tMeta("siteName")}`,
    description: t("pageSubtitle"),
    alternates: localeAlternates(locale, "/following"),
    robots: { index: false, follow: false },
  };
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("follow");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <header className="mb-8">
        <h1 className="flex items-baseline gap-2 text-2xl font-black tracking-tight text-zinc-100">
          👀 {t("pageTitle")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("pageSubtitle")}</p>
      </header>
      <FollowingBoard />
    </main>
  );
}
