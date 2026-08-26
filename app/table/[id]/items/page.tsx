"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { GameTableItems, Item } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";
import { parseDamageEntries } from "@/lib/damage";

const TYPE_BADGES: Record<number, { label: string; class: string }> = {
  1: { label: "Weapon", class: "bg-red-400/10 text-red-400 border border-red-400/20" },
  2: { label: "Armor", class: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  3: { label: "Equipment", class: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
};

export default function TableItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableItems | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableItems>(`/game-table-items/${id}`).then(setData).catch(() => setData({ table: null, items: [] }));
  }, [id]);

  const items = (data?.items ?? []).filter((i: Item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name ?? "").toLowerCase().includes(q)
      || (i.description ?? "").toLowerCase().includes(q)
      || (i.category ?? "").toLowerCase().includes(q)
      || (i.damage_name ?? "").toLowerCase().includes(q)
      || (i.armor_name ?? "").toLowerCase().includes(q);
  });

  const typeCounts = (data?.items ?? []).reduce<Record<number, number>>((acc, i) => {
    if (i.type) acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">Items</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-zinc-500">
        <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
        {Object.entries(typeCounts).map(([t, c]) => {
          const badge = TYPE_BADGES[Number(t)];
          return badge ? (
            <span key={t} className={`px-1.5 py-0.5 rounded ${badge.class}`}>
              {c} {badge.label}{c !== 1 ? "s" : ""}
            </span>
          ) : null;
        })}
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
            placeholder="Filter items..."
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-700/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            Clear
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? "No items match your filter." : "No items registered for this table yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i: Item) => {
            const typeBadge = i.type ? TYPE_BADGES[i.type] : null;
            return (
              <Link
                key={i.id}
                href={`/item/${i.id}`}
                className="group block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-rose-400/70 px-4 py-3 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">
                      {i.name || "Unnamed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {typeBadge ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeBadge.class}`}>
                        {typeBadge.label}
                      </span>
                    ) : null}
                    {i.weight ? (
                      <span className="text-[10px] text-zinc-500">{i.weight} kg</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-7">
                  {i.category ? (
                    <span className="text-[11px] text-zinc-500">{i.category}</span>
                  ) : null}
                  {i.description ? (
                    <span className="text-[11px] text-zinc-600 truncate">— {i.description}</span>
                  ) : null}
                </div>
                {(i.damage_id || i.armor_id) ? (
                  <div className="flex items-center gap-2 mt-1.5 ml-7">
                    {i.damage_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243-4.243z" />
                        </svg>
                        {(() => {
                          const entries = parseDamageEntries(i.damage_value);
                          if (entries.length === 0) return i.damage_value || "\u2014";
                          const types = Array.from(new Set(entries.map((e) => e.type)));
                          return `${entries.length} entries (${types.join(", ")})`;
                        })()}
                        {i.damage_name ? ` ${i.damage_name}` : ""}
                      </span>
                    ) : null}
                    {i.armor_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        DR {i.armor_value || "—"} {i.armor_name || ""}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
