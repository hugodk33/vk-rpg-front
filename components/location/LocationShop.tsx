"use client";

/* ============================================================
   LocationShop — o commerce de uma loja (um local com `shop_name`).

   Uma loja tem TRÊS coisas:

     funcionários — os NPCs postados no local;
     prateleira — os itens do catálogo ligados ao local, cada um com o
                  preço que a loja pratica e a quantidade em estoque;
     entrada    — trazer uma peça nova para a prateleira (a peça do
                  catálogo passa a morar na loja) ou COPIAR uma peça
                  existente (o catálogo continua com o original e a loja
                  ganha a sua própria).

   O `t` do i18n é recriado a cada render, então o efeito de carga usa o
   `tr` (estável por idioma) como dependência — do contrário a busca
   viraria um laço de requisições.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { interpolate, translate, useTranslation } from "@/lib/i18n";
import type {
  GameTableItems,
  GameTableNpcs,
  Item,
  LocationShop,
  LocationShopLine,
  TableNpc,
} from "@/lib/types";
import ItemIcon from "@/components/items/ItemIcon";
import { findCurrencyPreset, formatPrice } from "@/lib/currency";
import { useTableLive } from "@/lib/useTableLive";
import {
  copyItemIntoLocationShop,
  editLocationShopItem,
  findLocationShop,
  removeLocationShopItem,
  stockLocationShopItem,
} from "@/lib/shop";

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

/** Rascunho dos campos de prateleira (preço, estoque e observações). */
interface ShelfDraft {
  price: string;
  stock: string;
  notes: string;
}

const emptyDraft: ShelfDraft = { price: "", stock: "", notes: "" };

/** Número do rascunho: null quando o campo está vazio (ou não é número). */
function draftNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "3" | "—" (sem preço). O preço da loja vale o custo do item quando null. */
function priceLabel(
  price: number | null | undefined,
  item: Item,
  currencyNames: Map<string, string>
): string {
  if (price == null) return "—";
  const fallback = item.currency_item_id ? currencyNames.get(item.currency_item_id) : undefined;
  return formatPrice(price, findCurrencyPreset(fallback), fallback);
}

export default function LocationShop({
  locationId,
  tableId,
  shopName,
  accent = "#38bdf8",
  mode = "narrator",
}: {
  locationId: string;
  tableId?: string;
  shopName?: string | null;
  accent?: string;
  mode?: "narrator" | "player";
}) {
  const { lang, t } = useTranslation();
  const tr = useCallback((key: string) => translate(lang, key), [lang]);
  /* O jogador vê a vitrine; quem administra a loja mexe no estoque. */
  const isNarrator = mode === "narrator";

  const [shop, setShop] = useState<LocationShop | null>(null);
  const [npcs, setNpcs] = useState<TableNpc[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [currencyNames, setCurrencyNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* --- entrada de item --- */
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShelfDraft>(emptyDraft);

  /* --- edição de uma prateleira --- */
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ShelfDraft>(emptyDraft);

  /** Busca os dados da loja (sem tocar no estado). */
  const fetchAll = useCallback(async () => {
    const [shopData, n, all] = await Promise.all([
      findLocationShop(locationId),
      tableId
        ? api<GameTableNpcs>(`/game-table-npcs/${tableId}?location=${locationId}`).catch(() => ({
            table: null,
            npcs: [] as TableNpc[],
          }))
        : Promise.resolve({ table: null, npcs: [] as TableNpc[] }),
      tableId
        ? api<GameTableItems>(`/game-table-items/${tableId}`).catch(() => ({
            table: null,
            items: [] as Item[],
          }))
        : Promise.resolve({ table: null, items: [] as Item[] }),
    ]);
    return { shopData, npcs: n.npcs ?? [], items: all.items ?? [] };
  }, [locationId, tableId]);

  /** Escreve o resultado da busca no estado. */
  const applyAll = useCallback(
    (data: { shopData: LocationShop; npcs: TableNpc[]; items: Item[] }) => {
      setShop(data.shopData);
      setNpcs(data.npcs);
      setCatalog(data.items);
      setCurrencyNames(new Map(data.items.map((it) => [it.id, it.name])));
      setError(null);
    },
    []
  );

  /** Recarrega tudo (ação do narrador ou aviso de mudança na mesa). */
  const reload = useCallback(async () => {
    try {
      applyAll(await fetchAll());
    } catch (err) {
      setError((err as Error)?.message ?? tr("lc.shop.error"));
    }
  }, [applyAll, fetchAll, tr]);

  useEffect(() => {
    let cancel = false;
    fetchAll()
      .then((data) => {
        if (cancel) return;
        applyAll(data);
      })
      .catch((err) => {
        if (cancel) return;
        setError((err as Error)?.message ?? tr("lc.shop.error"));
      });
    return () => {
      cancel = true;
    };
  }, [applyAll, fetchAll, tr]);

  /* O estoque muda do lado do narrador (ou de outra aba): recarrega. */
  useTableLive(tableId ?? null, () => {
    void reload();
  });

  /* A prateleira já sabe quem está nela: um item não aparece duas vezes. */
  const shelfIds = useMemo(
    () => new Set((shop?.lines ?? []).map((line) => line.item.id)),
    [shop?.lines]
  );

  /* O que o catálogo oferece e ainda NÃO está na prateleira. */
  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalog
      .filter((item) => !shelfIds.has(item.id))
      .filter(
        (item) =>
          !needle ||
          item.name?.toLowerCase().includes(needle) ||
          item.category?.toLowerCase().includes(needle) ||
          item.kind?.toLowerCase().includes(needle)
      )
      .slice(0, 40);
  }, [catalog, search, shelfIds]);

  const selectedItem = useMemo(
    () => catalog.find((item) => item.id === selected) ?? null,
    [catalog, selected]
  );

  /** Preenche o rascunho com os valores atuais de uma prateleira. */
  const draftOf = (line: LocationShopLine): ShelfDraft => ({
    price: line.price != null ? String(line.price) : line.item.cost != null ? String(line.item.cost) : "",
    stock: String(line.stock ?? -1),
    notes: line.notes ?? "",
  });

  const run = useCallback(
    async (fn: () => Promise<LocationShop>) => {
      setBusy(true);
      try {
        const next = await fn();
        setShop(next);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message ?? tr("lc.shop.error"));
      } finally {
        setBusy(false);
      }
    },
    [tr]
  );

  /** Entrada: a peça do catálogo passa a morar na prateleira. */
  const stockSelected = useCallback(() => {
    if (!selected) return;
    const body = {
      item_id: selected,
      price: draftNumber(draft.price),
      stock: draftNumber(draft.stock) ?? -1,
      notes: draft.notes.trim() || null,
    };
    void run(async () => {
      const next = await stockLocationShopItem(locationId, body);
      setSelected(null);
      setDraft(emptyDraft);
      return next;
    });
  }, [draft, locationId, run, selected]);

  /** Cópia: a loja ganha a SUA peça; o catálogo continua com o original. */
  const copySelected = useCallback(() => {
    if (!selected) return;
    const body = {
      item_id: selected,
      price: draftNumber(draft.price),
      stock: draftNumber(draft.stock) ?? -1,
      notes: draft.notes.trim() || null,
    };
    void run(async () => {
      const next = await copyItemIntoLocationShop(locationId, body);
      setSelected(null);
      setDraft(emptyDraft);
      return next;
    });
  }, [draft, locationId, run, selected]);

  const saveLine = useCallback(
    (line: LocationShopLine) => {
      const body = {
        price: draftNumber(editDraft.price),
        stock: draftNumber(editDraft.stock) ?? -1,
        notes: editDraft.notes.trim() || null,
      };
      void run(async () => {
        const next = await editLocationShopItem(locationId, line.item.id, body);
        setEditing(null);
        return next;
      });
    },
    [editDraft, locationId, run]
  );

  const dropLine = useCallback(
    (line: LocationShopLine) => {
      void run(() => removeLocationShopItem(locationId, line.item.id));
    },
    [locationId, run]
  );

  const lines = shop?.lines ?? [];

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-1 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>
          ◉
        </span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
          {t("lc.shop.title")}
          {shopName ? <span className="text-zinc-500"> · </span> : null}
          {shopName ? <span className="text-zinc-400">{shopName}</span> : null}
        </span>
        <span
          className="flex-1 h-px"
          style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }}
        />
      </div>
      <p className="text-[11px] text-zinc-500 mb-4">{t("lc.shop.desc")}</p>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      <div className="flex flex-col gap-8">
        {/* -------- FUNCIONÁRIOS -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {t("lc.shop.staff")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {npcs.length}
            </span>
          </div>
          {npcs.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">{t("lc.shop.staffEmpty")}</p>
          ) : (
            <ul>
              {npcs.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-200">
                    {n.name || t("lc.common.noName")}
                  </span>
                  {n.status ? (
                    <span
                      className={`shrink-0 font-mono text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${
                        STATUS_META[n.status]?.cls ??
                        "text-zinc-500 border-zinc-700/60 bg-zinc-800/40"
                      }`}
                    >
                      {STATUS_META[n.status] ? t(STATUS_META[n.status].key) : n.status}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {tableId && isNarrator ? (
            <Link
              href={`/npc/new?table=${tableId}&location=${locationId}`}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
            >
              {t("lc.shop.addStaff")}
            </Link>
          ) : null}
        </section>

        {/* -------- PRATELEIRA -------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {t("lc.shop.stock")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {lines.length}
            </span>
          </div>
          {lines.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">{t("lc.shop.stockEmpty")}</p>
          ) : (
            <ul>
              {lines.map((line) => {
                const isEditing = editing === line.item.id;
                const out = line.stock === 0;
                return (
                  <li
                    key={line.item.id}
                    className="border-b border-zinc-700/40 py-2.5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ItemIcon
                          item={line.item}
                          className="w-4 h-4 shrink-0"
                          imgClassName="w-4 h-4 object-cover rounded"
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-sm text-zinc-200">
                            {line.item.name || t("lc.common.noName")}
                          </span>
                          {line.item.kind ? (
                            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                              {KIND_META[line.item.kind] ? t(KIND_META[line.item.kind]) : line.item.kind}
                              {line.item.category ? ` · ${line.item.category}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-mono text-[11px] ${out ? "text-zinc-600 line-through" : "text-zinc-300"}`}
                        >
                          {priceLabel(line.price ?? line.item.cost, line.item, currencyNames)}
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-widest ${
                            out ? "text-red-400/80" : "text-zinc-600"
                          }`}
                        >
                          {line.stock < 0
                            ? t("lc.shop.stock.unlimited")
                            : out
                              ? t("lc.shop.stock.out")
                              : interpolate(t("lc.shop.stock.units"), { n: line.stock })}
                        </span>
                        {isNarrator ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(isEditing ? null : line.item.id);
                                setEditDraft(draftOf(line));
                              }}
                              className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
                            >
                              {isEditing ? t("lc.shop.cancel") : t("lc.shop.edit")}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => dropLine(line)}
                              className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 hover:text-red-300 transition-colors disabled:opacity-40"
                            >
                              {t("lc.shop.remove")}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-2.5 flex flex-wrap items-end gap-3 pl-6">
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                            {t("lc.shop.price")}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.price}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, price: e.target.value }))
                            }
                            className="w-28 bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                            {t("lc.shop.stockLabel")}
                          </span>
                          <input
                            type="number"
                            min={-1}
                            value={editDraft.stock}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, stock: e.target.value }))
                            }
                            className="w-28 bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                          />
                        </label>
                        <label className="flex flex-col gap-1 flex-1 min-w-48">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                            {t("lc.shop.notes")}
                          </span>
                          <input
                            type="text"
                            value={editDraft.notes}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, notes: e.target.value }))
                            }
                            className="w-full bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveLine(line)}
                          className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-teal-200 transition-colors disabled:opacity-40"
                        >
                          {t("lc.shop.save")}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {tableId && isNarrator ? (
            <Link
              href={`/item/new?table=${tableId}&location=${locationId}`}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
            >
              {t("lc.shop.addItem")}
            </Link>
          ) : null}
        </section>

        {/* -------- ENTRADA DE ITEM (só quem administra a loja) -------- */}
        {isNarrator ? (
          <section>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {t("lc.shop.intake")}
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 mb-2.5">{t("lc.shop.intakeDesc")}</p>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("lc.shop.searchPlaceholder")}
            className="w-full bg-zinc-900/70 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 mb-2"
          />

          {candidates.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">{t("lc.shop.catalogEmpty")}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {candidates.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-700/40 py-2 last:border-b-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemIcon
                      item={item}
                      className="w-4 h-4 shrink-0"
                      imgClassName="w-4 h-4 object-cover rounded"
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm text-zinc-300">
                        {item.name || t("lc.common.noName")}
                      </span>
                      {item.kind ? (
                        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                          {KIND_META[item.kind] ? t(KIND_META[item.kind]) : item.kind}
                          {item.category ? ` · ${item.category}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(selected === item.id ? null : item.id);
                      setDraft({
                        price: item.cost != null ? String(item.cost) : "",
                        stock: "-1",
                        notes: "",
                      });
                    }}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-amber-400/80 hover:text-amber-300 transition-colors"
                  >
                    {selected === item.id ? t("lc.shop.cancel") : t("lc.shop.pick")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && selectedItem ? (
            <div className="mt-3 border border-zinc-700/60 rounded p-3 bg-zinc-900/40">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2.5">
                {t("lc.shop.intakeOf")} · {selectedItem.name}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    {t("lc.shop.price")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-28 bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    {t("lc.shop.stockLabel")}
                  </span>
                  <input
                    type="number"
                    min={-1}
                    value={draft.stock}
                    onChange={(e) => setDraft((prev) => ({ ...prev, stock: e.target.value }))}
                    className="w-28 bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1 min-w-48">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    {t("lc.shop.notes")}
                  </span>
                  <input
                    type="text"
                    value={draft.notes}
                    onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-zinc-900/70 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={stockSelected}
                  className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-teal-200 transition-colors disabled:opacity-40"
                >
                  {t("lc.shop.stockIn")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={copySelected}
                  className="font-mono text-[10px] uppercase tracking-widest text-amber-300 hover:text-amber-200 transition-colors disabled:opacity-40"
                >
                  {t("lc.shop.copyIn")}
                </button>
              </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
