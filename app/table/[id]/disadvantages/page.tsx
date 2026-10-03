"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Disadvantage, GameTableDisadvantages } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RowActions from "@/components/table/RowActions";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";

const COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#1e1b4b", border: "#4338ca", badge: "bg-purple-600/80 text-purple-200" },
  Physical: { bg: "#450a0a", border: "#dc2626", badge: "bg-red-600/80 text-red-200" },
  Social: { bg: "#172554", border: "#2563eb", badge: "bg-blue-600/80 text-blue-200" },
  Exotic: { bg: "#083344", border: "#0891b2", badge: "bg-cyan-600/80 text-cyan-200" },
  "Self-Control": { bg: "#2e1065", border: "#7c3aed", badge: "bg-indigo-600/80 text-indigo-200" },
};
const FALLBACK = { bg: "#27272a", border: "#52525b", badge: "bg-zinc-600/80 text-zinc-200" };

export default function TableDisadvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [data, setData] = useState<GameTableDisadvantages | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`).then(setData).catch(() => setData({ table: null, disadvantages: [] }));
  }, [id]);

  const disadvantages = (data?.disadvantages ?? []).filter((d: Disadvantage) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q)
      || (d.description ?? "").toLowerCase().includes(q)
      || (d.effect ?? "").toLowerCase().includes(q)
      || (d.category ?? "").toLowerCase().includes(q);
  });

  const categoryCounts = (data?.disadvantages ?? []).reduce<Record<string, number>>((acc, d) => {
    const c = d.category ?? "Other";
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.disadvantages")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(disadvantages.length !== 1 ? "tp.count.disadvantagesMany" : "tp.count.disadvantagesOne"), { n: disadvantages.length })}</span>
          {Object.entries(categoryCounts).map(([c, count]) => {
            const colors = COLORS[c] ?? FALLBACK;
            return (
              <span key={c} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.border }} />
                {count} {c}
              </span>
            );
          })}
        </div>
        <Link
          href={`/disadvantage/new?table_id=${id}`}
          className="bg-green-800/70 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + {t("tp.add.disadvantage")}
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("tp.disadvantages.searchPh")}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-green-900/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            {t("s2.clearAll")}
          </button>
        ) : null}
      </div>

      {disadvantages.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? t("tp.disadvantages.emptySearch") : t("tp.disadvantages.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {disadvantages.map((d: Disadvantage) => {
            const colors = COLORS[d.category ?? ""] ?? FALLBACK;
            return (
              <div
                key={d.id}
                className="group relative block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] px-4 py-3 transition-all"
                style={{ borderLeftColor: colors.border }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <Link
                      href={`/disadvantage/${d.id}`}
                      className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate after:absolute after:inset-0 after:content-['']"
                    >
                      {d.name || t("it.unnamed")}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.cost_points != null ? (
                      <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                        {d.cost_points}
                      </span>
                    ) : null}
                    {d.category ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                        {d.category}
                      </span>
                    ) : null}
                    <RowActions
                      editHref={`/disadvantage/${d.id}/edit?table_id=${id}`}
                      onDelete={() => submitJson(`/api/game-table-disadvantage/${d.id}`, "DELETE")}
                      copyHref={`/api/game-table-disadvantage/${d.id}/copy`}
                      tableId={id}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-7">
                  {d.subcategory ? (
                    <span className="text-[11px] text-zinc-500">{d.subcategory}</span>
                  ) : null}
                  {d.effect ? (
                    <span className="text-[11px] text-zinc-600 truncate">— {d.effect}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
