"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RowActions from "@/components/table/RowActions";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";

export default function TableAdvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [data, setData] = useState<GameTableAdvantages | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableAdvantages>(`/game-table-advantages/${id}`).then(setData).catch(() => setData({ table: null, advantages: [] }));
  }, [id]);

  const advantages = (data?.advantages ?? []).filter((a: Advantage) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name ?? "").toLowerCase().includes(q)
      || (a.description ?? "").toLowerCase().includes(q)
      || (a.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.advantages")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(advantages.length !== 1 ? "tp.count.advantagesMany" : "tp.count.advantagesOne"), { n: advantages.length })}</span>
        </div>
        <Link
          href={`/advantage/new?table_id=${id}`}
          className="bg-green-800/70 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + {t("tp.add.advantage")}
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
            placeholder={t("tp.advantages.searchPh")}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-700/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            {t("s2.clearAll")}
          </button>
        ) : null}
      </div>

      {advantages.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? t("tp.advantages.emptySearch") : t("tp.advantages.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {advantages.map((a: Advantage) => (
            <div
              key={a.id}
              className="group relative block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-emerald-400/70 pr-3 transition-all"
            >
                <div className="flex items-stretch">
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-zinc-700/50 py-3">
                    <span className="text-lg font-bold leading-none text-emerald-400">
                      {a.cost_points == null ? "—" : a.cost_points >= 0 ? `+${a.cost_points}` : a.cost_points}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pl-4 pr-1 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <Link
                          href={`/advantage/${a.id}`}
                          className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate after:absolute after:inset-0 after:content-['']"
                        >
                          {a.name || t("it.unnamed")}
                        </Link>
                      </div>
                      <RowActions
                        editHref={`/advantage/${a.id}/edit?table_id=${id}`}
                        onDelete={() => submitJson(`/api/game-table-advantage/${a.id}`, "DELETE")}
                        copyHref={`/api/game-table-advantage/${a.id}/copy`}
                        tableId={id}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-7">
                      {a.category ? (
                        <span className="text-[11px] text-zinc-500">
                          {a.category}{a.subcategory ? ` / ${a.subcategory}` : ""}
                        </span>
                      ) : null}
                      {a.description ? (
                        <span className="text-[11px] text-zinc-600 truncate">— {a.description}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
