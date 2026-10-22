"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { GameTableItems, Item } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RowActions from "@/components/table/RowActions";
import Pagination from "@/components/table/Pagination";
import ChipFilters, { countValues } from "@/components/table/ChipFilters";
import { categoryLabel } from "@/lib/categories";
import { formatKg } from "@/lib/units";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";
import { fitLabel } from "@/lib/fit";
import ItemIcon from "@/components/items/ItemIcon";
import { useCatalog } from "@/lib/useCatalog";
import { usePagination } from "@/lib/usePagination";

const KIND_BADGES: Record<string, { label: string; class: string }> = {
  weapon: { label: "tp.kind.weapon", class: "bg-red-400/10 text-red-400 border border-red-400/20" },
  shield: { label: "tp.kind.shield", class: "bg-orange-400/10 text-orange-400 border border-orange-400/20" },
  armor: { label: "tp.kind.armor", class: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  equipment: { label: "tp.kind.equipment", class: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
};

export default function TableItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang, t } = useTranslation();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [kindF, setKindF] = useState("");

  const filtering = Boolean(search || cat || kindF);
  const data = useCatalog<GameTableItems>(`/game-table-items/${id}`);

  const allItems = data?.items ?? [];

  const kindOptions = countValues(allItems.map((i: Item) => (KIND_BADGES[i.kind ?? ""] ? i.kind : null)));
  const catOptions = countValues(allItems.map((i: Item) => i.category));

  const items = allItems.filter((i: Item) => {
    if (kindF && (i.kind ?? "") !== kindF) return false;
    if (cat && (i.category ?? "") !== cat) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name ?? "").toLowerCase().includes(q)
      || (i.description ?? "").toLowerCase().includes(q)
      || (i.category ?? "").toLowerCase().includes(q)
      || ((i.kind ?? "") as string).toLowerCase().includes(q);
  });

  const kindLabel = (v: string) => (KIND_BADGES[v] ? t(KIND_BADGES[v].label) : v);
  const shownCount = items.length;
  const pager = usePagination(items, `${search}|${cat}|${kindF}`);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.items")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(shownCount !== 1 ? "tp.count.itemsMany" : "tp.count.itemsOne"), { n: shownCount })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/table/${id}/trades`}
            className="inline-flex items-center gap-1.5 border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            {t("tr.offers")}
          </Link>
          <Link
            href={`/item/new?table_id=${id}`}
            className="bg-green-800/70 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + {t("tp.add.item")}
          </Link>
        </div>
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
            placeholder={t("tp.items.searchPh")}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-700/60"
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
          { key: "kind", label: t("fr.type"), options: kindOptions, value: kindF, onChange: setKindF, labelOf: kindLabel },
          { key: "cat", label: t("fr.category"), options: catOptions, value: cat, onChange: setCat, labelOf: (v) => categoryLabel(t, v) },
        ]}
        onClearAll={() => {
          setCat("");
          setKindF("");
        }}
      />

      {items.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-zinc-500 text-sm">
            {filtering ? (search ? t("tp.items.emptySearch") : t("tp.filter.none")) : t("tp.items.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pager.slice.map((i: Item) => {
            const kindBadge = i.kind ? KIND_BADGES[i.kind] : null;
            return (
              <div
                key={i.id}
                className="group relative block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-rose-400/70 px-4 py-3 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemIcon item={i} className="w-4 h-4 shrink-0" imgClassName="w-4 h-4 object-cover rounded" />
                    <Link
                      href={`/item/${i.id}`}
                      className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate after:absolute after:inset-0 after:content-['']"
                    >
                      {i.name || t("it.unnamed")}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {kindBadge ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${kindBadge.class}`}>
                        {t(kindBadge.label)}
                      </span>
                    ) : null}
                    {i.weight_lb != null ? (
                      <span className="text-[10px] text-zinc-500">{formatKg(i.weight_lb)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-7">
                  {i.category ? (
                    <span className="text-[11px] text-zinc-500">{categoryLabel(t, i.category)}</span>
                  ) : null}
                  {i.description ? (
                    <span className="text-[11px] text-zinc-600 truncate">— {i.description}</span>
                  ) : null}
                </div>
                {(i.weapon || i.armor) ? (
                  <div className="flex items-center gap-2 mt-1.5 ml-7">
                    {i.weapon ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-6-6M5 21l-2-2M8 16l-4 4M9.5 17.5 20.414 6.586A2 2 0 0021 5.172V3h-2.172a2 2 0 00-1.414.586L6.5 14.5" />
                        </svg>
                        {i.weapon.attacks?.length
                          ? interpolate(t(i.weapon.attacks.length !== 1 ? "tp.count.attacksMany" : "tp.count.attacksOne"), { n: i.weapon.attacks.length })
                          : t("tp.items.weaponShort")}
                      </span>
                    ) : null}
                    {i.weapon?.fit && i.weapon.fit !== "normal" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-300/90 bg-red-400/5 px-1.5 py-0.5 rounded border border-red-400/20">
                        {interpolate(t("tp.items.fitLabel"), { fit: fitLabel(i.weapon.fit, lang) })}
                      </span>
                    ) : null}
                    {i.armor ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        DR {i.armor.dr ?? "—"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex justify-end mt-2">
                  <RowActions
                    editHref={`/item/${i.id}/edit?table_id=${id}`}
                    onDelete={() => submitJson(`/api/game-table-item/${i.id}`, "DELETE")}
                    copyHref={`/api/game-table-item/${i.id}/copy`}
                    tableId={id}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={pager.page} pageCount={pager.pageCount} from={pager.from} to={pager.to} total={pager.total} onPageChange={pager.setPage} accent="rose" />
    </div>
  );
}
