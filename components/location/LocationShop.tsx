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
import { useTranslation } from "@/lib/i18n";
import type { GameTableItems, GameTableNpcs, Item, TableNpc } from "@/lib/types";
import ItemIcon from "@/components/items/ItemIcon";

const STATUS_META: Record<string, { key: string; cls: string }> = {
  enemy: { key: "lc.shop.status.enemy", cls: "text-red-300 border-red-500/40 bg-red-500/10" },
  ally: { key: "lc.shop.status.ally", cls: "text-teal-300 border-teal-500/40 bg-teal-500/10" },
  neutral: { key: "lc.shop.status.neutral", cls: "text-zinc-300 border-zinc-600/60 bg-zinc-600/10" },
  boss: { key: "lc.shop.status.boss", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  active: { key: "lc.shop.status.active", cls: "text-teal-300 border-teal-500/40 bg-teal-500/10" },
};

const KIND_META: Record<string, string> = {
  weapon: "lc.shop.kind.weapon",
  armor: "lc.shop.kind.armor",
  shield: "lc.shop.kind.shield",
  equipment: "lc.shop.kind.equipment",
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
  const { t } = useTranslation();

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
        setError(t("lc.shop.error"));
      });
    return () => {
      cancel = true;
    };
  }, [tableId, locationId, t]);

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-1 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>◉</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
          {t("lc.shop.title")}
          {shopName ? <span className="text-zinc-500"> · </span> : null}
          {shopName ? <span className="text-zinc-400">{shopName}</span> : null}
        </span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
      </div>
      <p className="text-[11px] text-zinc-500 mb-4">
        {t("lc.shop.desc")}
      </p>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* -------- STAFF -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("lc.shop.staff")}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{npcs.length}</span>
          </div>
          {npcs.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">
              {t("lc.shop.staffEmpty")}
            </p>
          ) : (
            <ul>
              {npcs.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2.5 last:border-b-0">
                  <span className="min-w-0 truncate text-sm text-zinc-200">{n.name || t("lc.common.noName")}</span>
                  {n.status ? (
                    <span
                      className={`shrink-0 font-mono text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${
                        STATUS_META[n.status]?.cls ?? "text-zinc-500 border-zinc-700/60 bg-zinc-800/40"
                      }`}
                    >
                      {STATUS_META[n.status] ? t(STATUS_META[n.status].key) : n.status}
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
              {t("lc.shop.addStaff")}
            </Link>
          ) : null}
        </section>

        {/* -------- STOCK -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("lc.shop.stock")}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{items.length}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">
              {t("lc.shop.stockEmpty")}
            </p>
          ) : (
            <ul>
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2.5 last:border-b-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemIcon item={it} className="w-4 h-4 shrink-0" imgClassName="w-4 h-4 object-cover rounded" />
                    <div className="min-w-0">
                      <span className="block truncate text-sm text-zinc-200">{it.name || t("lc.common.noName")}</span>
                      {it.kind ? (
                        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                          {KIND_META[it.kind] ? t(KIND_META[it.kind]) : it.kind}
                          {it.category ? ` · ${it.category}` : ""}
                        </span>
                      ) : null}
                    </div>
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
              {t("lc.shop.addItem")}
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}