import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import type { Disadvantage } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#1e1b4b", border: "#4338ca", badge: "bg-purple-600/80 text-purple-200" },
  Physical: { bg: "#450a0a", border: "#dc2626", badge: "bg-red-600/80 text-red-200" },
  Social: { bg: "#172554", border: "#2563eb", badge: "bg-blue-600/80 text-blue-200" },
  Exotic: { bg: "#083344", border: "#0891b2", badge: "bg-cyan-600/80 text-cyan-200" },
  "Self-Control": { bg: "#2e1065", border: "#7c3aed", badge: "bg-indigo-600/80 text-indigo-200" },
};
const FALLBACK = { bg: "#27272a", border: "#52525b", badge: "bg-zinc-600/80 text-zinc-200" };

export default async function DisadvantageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = makeT(await getLang());
  let disadvantage: Disadvantage | undefined;
  try {
    disadvantage = await api<Disadvantage>(`/game-table-disadvantage/${id}`);
  } catch {
    disadvantage = undefined;
  }
  if (!disadvantage) notFound();

  const colors = COLORS[disadvantage.category ?? ""] ?? FALLBACK;
  const tableId = disadvantage.table_id;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; {t("itm.back")}
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40" style={{ borderBottomColor: colors.border }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-100">{disadvantage.name || t("en.disadvantage.unnamed")}</h1>
              {disadvantage.category ? (
                <span className={`inline-block ${colors.badge} text-xs px-2 py-0.5 rounded-full mt-2`}>
                  {disadvantage.category}{disadvantage.subcategory ? ` / ${disadvantage.subcategory}` : ""}
                </span>
              ) : null}
            </div>
            <span className="text-red-400 font-bold text-lg">
              {disadvantage.cost_points != null ? `-${disadvantage.cost_points}` : "±0"}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {disadvantage.effect ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">{t("skx.effect")}</h3>
              <p className="text-zinc-300 text-sm">{disadvantage.effect}</p>
            </div>
          ) : null}

          {disadvantage.description ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">{t("en.disadvantage.description")}</h3>
              <p className="text-zinc-300 text-sm">{disadvantage.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
              <span className="text-zinc-500 text-xs uppercase block">{t("itm.cost")}</span>
              <span className="text-red-400 font-bold text-xl">
                {disadvantage.cost_points != null ? `-${disadvantage.cost_points}` : "±0"}
              </span>
            </div>
            {disadvantage.category ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">{t("en.disadvantage.category")}</span>
                <span className="text-zinc-200 font-medium text-sm">{disadvantage.category}</span>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/disadvantage/${disadvantage.id}/edit`} className="bg-green-900/60 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {t("ra.edit")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
