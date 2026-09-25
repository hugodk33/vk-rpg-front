import type { Metadata } from "next";
import Link from "next/link";
import GmDiceRoller from "@/components/GmDiceRoller";
import { getLang, makeT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLang());
  return { title: `${t("pg.kit.title")} — VKRPG` };
}

const shortcuts = [
  { href: "/table/new", key: "pg.newTable" },
  { href: "/character/new", key: "pg.newCharacter" },
  { href: "/npc/new", key: "pg.newNpc" },
  { href: "/item/new", key: "pg.newItem" },
  { href: "/advantage/new", key: "pg.newAdvantage" },
  { href: "/disadvantage/new", key: "pg.newDisadvantage" },
];

export default async function NarratorKitPage() {
  const t = makeT(await getLang());

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-100">{t("pg.kit.title")}</h1>
        <p className="text-zinc-400 text-sm mt-1">{t("pg.kit.subtitle")}</p>
      </div>

      <GmDiceRoller />

      <section aria-label={t("pg.quickCreate")} className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          {t("pg.quickCreate")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex items-center justify-between gap-3 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 hover:border-green-900/50 rounded-lg px-4 py-3 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">
                {t(shortcut.key)}
              </span>
              <span aria-hidden className="text-zinc-500 transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          {t("pg.backHome")}
        </Link>
      </div>
    </div>
  );
}
