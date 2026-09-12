"use client";

/* ============================================================
   LocationShop — the commerce ledger of a shop location.
   Only mounts when the plate's location carries a shop name
   (`shop_name`). Shows the NPCs posted at this shop (staff) and
   the items whose `location_id` points here (stock), plus links to
   register new ones already bound to the shop.
   ============================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTableItems, GameTableNpcs, Item, TableNpc } from "@/lib/types";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  enemy: { label: "Enemy", cls: "text-red-300 border-red-500/40 bg-red-500/10" },
  ally: { label: "Ally", cls: "text-teal-300 border-teal-500/40 bg-teal-500/10" },
  neutral: { label: "Neutral", cls: "text-zinc-300 border-zinc-600/60 bg-zinc-600/10" },
  boss: { label: "Boss", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  active: { label: "Active", cls: "text-teal-300 border-teal-500/40 bg-teal-500/10" },
};

const KIND_LABELS: Record<string, string> = {
  weapon: "Weapon",
  armor: "Armor",
  shield: "Shield",
  equipment: "Equipment",
};

const money = (n?: number): string => (n == null ? "—" : `$${n}`);

export default function LocationShop({
  locationId,
  tableId,
  shopName,
  accent = "#38bdf8",
}: {
  locationId: string;
  tableId?: string;
  shopName?: string | null;
  accent?: string;
}) {
  const [npcs, setNpcs] = useState<TableNpc[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableId) return;
    let cancel = false;
    Promise.all([
      api<GameTableNpcs>(`/game-table-npcs/${tableId}?location=${locationId}`).catch(() => ({
        table: null,
        npcs: [] as TableNpc[],
      })),
      api<GameTableItems>(`/game-table-items/${tableId}?location=${locationId}`).catch(() => ({
        table: null,
        items: [] as Item[],
      })),
    ])
      .then(([n, i]) => {
        if (cancel) return;
        setNpcs(n.npcs ?? []);
        setItems(i.items ?? []);
        setError(null);
      })
      .catch(() => {
        if (cancel) return;
        setError("Failed to load the shop’s records.");
      });
    return () => {
      cancel = true;
    };
  }, [tableId, locationId]);

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-1 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>◉</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
          Shop
          {shopName ? <span className="text-zinc-500"> · </span> : null}
          {shopName ? <span className="text-zinc-400">{shopName}</span> : null}
        </span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
      </div>
      <p className="text-[11px] text-zinc-500 mb-4">
        Who works here and what sits on the shelves — bound to this place from the NPC and Item forms.
      </p>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* -------- STAFF -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Staff</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{npcs.length}</span>
          </div>
          {npcs.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">
              No one is posted at this shop yet. Add an NPC and bind it here.
            </p>
          ) : (
            <ul>
              {npcs.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2.5 last:border-b-0">
                  <span className="min-w-0 truncate text-sm text-zinc-200">{n.name || "Unnamed"}</span>
                  {n.status ? (
                    <span
                      className={`shrink-0 font-mono text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${
                        STATUS_META[n.status]?.cls ?? "text-zinc-500 border-zinc-700/60 bg-zinc-800/40"
                      }`}
                    >
                      {STATUS_META[n.status]?.label ?? n.status}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {tableId ? (
            <Link
              href={`/npc/new?table=${tableId}&location=${locationId}`}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
            >
              + Staff
            </Link>
          ) : null}
        </section>

        {/* -------- STOCK -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Stock</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{items.length}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">
              The shelves are bare. Link an item to this place to put it up for sale.
            </p>
          ) : (
            <ul>
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-zinc-200">{it.name || "Unnamed"}</span>
                    {it.kind ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                        {KIND_LABELS[it.kind] ?? it.kind}
                        {it.category ? ` · ${it.category}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-300">{money(it.cost)}</span>
                </li>
              ))}
            </ul>
          )}
          {tableId ? (
            <Link
              href={`/item/new?table=${tableId}&location=${locationId}`}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
            >
              + Item
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}