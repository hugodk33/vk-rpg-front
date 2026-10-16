"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { Disadvantage, GameTableDisadvantages } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RowActions from "@/components/table/RowActions";
import Pagination from "@/components/table/Pagination";
import ChipFilters, { countValues } from "@/components/table/ChipFilters";
import { categoryLabel } from "@/lib/categories";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";
import { useCatalog } from "@/lib/useCatalog";
import { usePagination } from "@/lib/usePagination";

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
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");

  const filtering = Boolean(search || cat || sub);
  const data = useCatalog<GameTableDisadvantages>(`/game-table-disadvantages/${id}`);

  const allDisadvantages = data?.disadvantages ?? [];

  const catOptions = countValues(allDisadvantages.map((d: Disadvantage) => d.category));
  const subOptions = countValues(
    allDisadvantages
      .filter((d: Disadvantage) => !cat || (d.category ?? "") === cat)
      .map((d: Disadvantage) => d.subcategory)
  );

  /* Trocar de categoria larga uma subcategoria que não pertence a ela. */
  const pickCategory = (next: string) => {
    setCat(next);
    if (!next || !sub) return;
    const valid = new Set(
      allDisadvantages
        .filter((d: Disadvantage) => (d.category ?? "") === next)
        .map((d: Disadvantage) => (d.subcategory ?? "").trim())
        .filter(Boolean)
    );
    if (!valid.has(sub)) setSub("");
  };

  const disadvantages = allDisadvantages.filter((d: Disadvantage) => {
    if (cat && (d.category ?? "") !== cat) return false;
    if (sub && (d.subcategory ?? "") !== sub) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q)
      || (d.description ?? "").toLowerCase().includes(q)
      || (d.effect ?? "").toLowerCase().includes(q)
      || (d.category ?? "").toLowerCase().includes(q);
  });

  const shownCount = disadvantages.length;
  const pager = usePagination(disadvantages, `${search}|${cat}|${sub}`);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.disadvantages")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(shownCount !== 1 ? "tp.count.disadvantagesMany" : "tp.count.disadvantagesOne"), { n: shownCount })}</span>
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

      <ChipFilters
        groups={[
          { key: "cat", label: t("fr.category"), options: catOptions, value: cat, onChange: pickCategory, labelOf: (v) => categoryLabel(t, v) },
          { key: "sub", label: t("fr.subcategory"), options: subOptions, value: sub, onChange: setSub, labelOf: (v) => categoryLabel(t, v) },
        ]}
        onClearAll={() => {
          setCat("");
          setSub("");
        }}
      />

      {disadvantages.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-zinc-500 text-sm">
            {filtering ? (search ? t("tp.disadvantages.emptySearch") : t("tp.filter.none")) : t("tp.disadvantages.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pager.slice.map((d: Disadvantage) => {
            const colors = COLORS[d.category ?? ""] ?? FALLBACK;
            return (
              <div
                key={d.id}
                className="group relative block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] pr-3 transition-all"
                style={{ borderLeftColor: colors.border }}
              >
                <div className="flex items-stretch">
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-zinc-700/50 py-3">
                    <span className="text-lg font-bold leading-none text-red-400">
                      {d.cost_points != null ? d.cost_points : "—"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pl-4 pr-1 py-3">
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
                      {d.category ? (
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                          {categoryLabel(t, d.category)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-7">
                      {d.subcategory ? (
                        <span className="text-[11px] text-zinc-500">{categoryLabel(t, d.subcategory)}</span>
                      ) : null}
                      {d.effect ? (
                        <span className="text-[11px] text-zinc-600 truncate">— {d.effect}</span>
                      ) : null}
                    </div>
                    <div className="flex justify-end mt-2">
                      <RowActions
                        editHref={`/disadvantage/${d.id}/edit?table_id=${id}`}
                        onDelete={() => submitJson(`/api/game-table-disadvantage/${d.id}`, "DELETE")}
                        copyHref={`/api/game-table-disadvantage/${d.id}/copy`}
                        tableId={id}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={pager.page} pageCount={pager.pageCount} from={pager.from} to={pager.to} total={pager.total} onPageChange={pager.setPage} accent="green" />
    </div>
  );
}
