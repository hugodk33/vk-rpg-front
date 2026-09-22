"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CharacterItem, CharacterViewer, TableCharacter } from "@/lib/types";
import { api } from "@/lib/api";
import ItemIcon from "@/components/items/ItemIcon";

/* ============================================================
   Player Inventory — the player's own gear, managed from the
   console. Each owned item can be equipped / unequipped /
   stored (existing PUT), discarded or sold (DELETE) and given
   to another character at the table (transfer).
   ============================================================ */

interface PlayerInventoryProps {
  items: CharacterItem[];
  characterId: string;
  roster: TableCharacter[];
  targets?: TableCharacter[];
}

const STATUS_LABELS: Record<string, string> = {
  in_inventory: "Inventory",
  equipped: "Equipado",
  wielded: "Empunhado",
};

const KIND_BADGES: Record<string, { label: string; class: string }> = {
  weapon: { label: "Arma", class: "bg-red-400/10 text-red-400 border border-red-400/20" },
  shield: { label: "Escudo", class: "bg-orange-400/10 text-orange-400 border border-orange-400/20" },
  armor: { label: "Armadura", class: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  equipment: { label: "Equipamento", class: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
};

const icon = (path: string, cls = "w-3.5 h-3.5") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const keyOf = (i: CharacterItem): string => i.item_id ?? i.id ?? "";

export default function PlayerInventory({ items, characterId, roster, targets }: PlayerInventoryProps) {
  const router = useRouter();
  const targetPool = targets ?? roster;
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<string | null>(null);
  const [trading, setTrading] = useState<Record<string, string>>({});
  const [tradingFor, setTradingFor] = useState<string | null>(null);
  const [sellingFor, setSellingFor] = useState<string | null>(null);
  const [sellBuyer, setSellBuyer] = useState("");
  const [buyerItems, setBuyerItems] = useState<CharacterItem[]>([]);
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [priceItem, setPriceItem] = useState("");
  const [priceQty, setPriceQty] = useState("1");

  const setName = (id?: string | null): string => {
    if (!id) return "Alguém";
    const c = roster.find((x) => x.id === id);
    return c?.sheet?.name || c?.name || c?.user?.username || id;
  };

  function setItemBusy(itemKey: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [itemKey]: value }));
  }

  async function mutate(itemKey: string, status: string, location?: string) {
    if (!itemKey) return;
    setItemBusy(itemKey, true);
    setError(null);
    try {
      await api<{ success?: boolean }>("/game-table-character-equipment", {
        method: "PUT",
        body: JSON.stringify({
          character_id: characterId,
          item_id: itemKey,
          status,
          location: location ?? (status === "in_inventory" ? "none" : "any"),
        }),
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar o equipamento.");
    } finally {
      setItemBusy(itemKey, false);
    }
  }

  async function dropItem(itemKey: string) {
    if (!itemKey) return;
    setItemBusy(itemKey, true);
    setError(null);
    try {
      await api<{ success?: boolean }>("/game-table-character-equipment", {
        method: "DELETE",
        body: JSON.stringify({ character_id: characterId, item_id: itemKey }),
      });
      setPendingDrop(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao remover o item.");
    } finally {
      setItemBusy(itemKey, false);
    }
  }

  async function tradeItem(itemKey: string, targetCharacterId: string) {
    if (!itemKey || !targetCharacterId) return;
    setItemBusy(itemKey, true);
    setError(null);
    try {
      await api<{ success?: boolean }>("/game-table-character-equipment/transfer", {
        method: "POST",
        body: JSON.stringify({
          character_id: characterId,
          item_id: itemKey,
          target_character_id: targetCharacterId,
        }),
      });
      setTradingFor(null);
      setTrading((prev) => ({ ...prev, [itemKey]: "" }));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao transferir o item.");
    } finally {
      setItemBusy(itemKey, false);
    }
  }

  function openSell(itemKey: string) {
    setPendingDrop(null);
    setTradingFor(null);
    if (sellingFor === itemKey) {
      setSellingFor(null);
      return;
    }
    setSellingFor(itemKey);
    setSellBuyer("");
    setBuyerItems([]);
    setPriceItem("");
    setPriceQty("1");
  }

  async function loadBuyer(buyerId: string) {
    if (!buyerId) {
      setBuyerItems([]);
      setBuyerLoading(false);
      return;
    }
    setBuyerLoading(true);
    setError(null);
    try {
      const viewer = await api<CharacterViewer>(`/game-table-character/${buyerId}`);
      setBuyerItems(viewer?.character?.items ?? []);
    } catch (err: unknown) {
      setBuyerItems([]);
      setError(err instanceof Error ? err.message : "Não foi possível ler o inventário dele(a).");
    } finally {
      setBuyerLoading(false);
    }
  }

  const maxPriceQty = (() => {
    const bi = buyerItems.find((x) => keyOf(x) === priceItem);
    return bi ? Math.max(1, bi.equipment_quantity ?? bi.quantity ?? 1) : 1;
  })();

  async function sellItem(itemKey: string) {
    if (!itemKey || !sellBuyer || !priceItem) return;
    const qty = Math.max(1, Math.floor(Number(priceQty) || 1));
    setItemBusy(itemKey, true);
    setError(null);
    try {
      const result = await api<{ success?: boolean; error?: string }>("/game-table-character-equipment/sell", {
        method: "POST",
        body: JSON.stringify({
          character_id: characterId,
          buyer_character_id: sellBuyer,
          item_id: itemKey,
          price_item_id: priceItem,
          price_quantity: qty,
        }),
      });
      if (result && result.success === false) throw new Error(result.error || "Venda falhou.");
      setSellingFor(null);
      setSellBuyer("");
      setBuyerItems([]);
      setPriceItem("");
      setPriceQty("1");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao vender o item.");
    } finally {
      setItemBusy(itemKey, false);
    }
  }

  return (
    <div>
      {error ? (
        <div className="mb-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-700/50 px-4 py-3">
          {icon("M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", "w-4 h-4 text-amber-400")}
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Inventário</h2>
          <span className="ml-auto text-xs text-zinc-500">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="divide-y divide-zinc-800/80">
          {items.length === 0 ? (
            <p className="text-zinc-600 text-sm italic px-4 py-4">Nenhum item no seu inventário ainda.</p>
          ) : null}

          {items.map((i) => {
            const itemKey = keyOf(i);
            const stt = i.equipment_status ?? "in_inventory";
            const kind = i.kind ?? "";
            const badge = KIND_BADGES[kind] ?? null;
            const isWeaponish = kind === "weapon" || kind === "shield";
            const qty = i.equipment_quantity ?? i.quantity ?? 1;
            const targetChoice = trading[itemKey] ?? "";
            const pendingDropHere = pendingDrop === itemKey;

            return (
              <div key={i.equipment_id || i.id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <ItemIcon item={i} className="w-5 h-5 shrink-0" imgClassName="w-5 h-5 object-cover rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {i.name || "Sem nome"}
                        {qty > 1 ? <span className="text-zinc-500 ml-1">x{qty}</span> : null}
                      </span>
                      {badge ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.class}`}>{badge.label}</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-400">{STATUS_LABELS[stt] ?? stt}</span>
                      {i.equipment_location && stt !== "in_inventory" ? (
                        <span>· {i.equipment_location.replace(/_/g, " ")}</span>
                      ) : null}
                      {i.weight_lb != null ? <span>· {i.weight_lb} lb</span> : null}
                      {i.cost != null ? <span>· ${i.cost}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {busy[itemKey] ? (
                      <span className="text-[11px] text-zinc-500 italic">…</span>
                    ) : (
                      <>
                        {stt === "in_inventory" ? (
                          <button
                            type="button"
                            onClick={() => mutate(itemKey, isWeaponish ? "wielded" : "equipped", isWeaponish ? "right_hand" : "any")}
                            className="text-[11px] px-2 py-1 rounded-md bg-emerald-600/40 hover:bg-emerald-600/70 text-emerald-100 border border-emerald-600/40 transition-colors"
                          >
                            {isWeaponish ? "Empunhar" : "Equipar"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => mutate(itemKey, "in_inventory", "none")}
                            className="text-[11px] px-2 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-200 border border-zinc-600/40 transition-colors"
                          >
                            {stt === "wielded" ? "Guardar" : "Desequipar"}
                          </button>
                        )}

                        {pendingDropHere ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className="text-zinc-400">Descartar este item?</span>
                            <button
                              type="button"
                              onClick={() => void dropItem(itemKey)}
                              className="px-2 py-1 rounded-md bg-red-600/60 hover:bg-red-600 text-red-50 transition-colors"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDrop(null)}
                              className="px-2 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-200 transition-colors"
                            >
                              Não
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openSell(itemKey)}
                              className="text-[11px] px-2 py-1 rounded-md bg-amber-600/30 hover:bg-amber-600/60 text-amber-100 border border-amber-600/30 transition-colors"
                            >
                              Vender
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDrop(itemKey);
                                setTradingFor(null);
                                setSellingFor(null);
                              }}
                              className="text-[11px] px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/40 text-red-300 border border-red-500/25 transition-colors"
                            >
                              Descartar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (tradingFor === itemKey) {
                                  setTradingFor(null);
                                } else {
                                  setTradingFor(itemKey);
                                  setPendingDrop(null);
                                }
                              }}
                              className="text-[11px] px-2 py-1 rounded-md bg-blue-600/25 hover:bg-blue-600/50 text-blue-200 border border-blue-600/30 transition-colors"
                            >
                              Trocar
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {tradingFor === itemKey ? (
                  <div className="mt-2 flex items-center gap-2 flex-wrap pl-5">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Dar a</span>
                    <select
                      value={targetChoice}
                      onChange={(e) => setTrading((prev) => ({ ...prev, [itemKey]: e.target.value }))}
                      className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-600/70"
                    >
                      <option value="" className="bg-zinc-800">
                        Selecionar… (outra pessoa)
                      </option>
                      {targetPool
                        .filter((c) => c.id !== characterId)
                        .map((c) => (
                          <option key={c.id} value={c.id} className="bg-zinc-800">
                            {setName(c.id)}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!targetChoice}
                      onClick={() => void tradeItem(itemKey, targetChoice)}
                      className="text-[11px] px-2 py-1 rounded-md bg-blue-600/70 hover:bg-blue-600 text-blue-100 disabled:opacity-40 transition-colors"
                    >
                      Doar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradingFor(null)}
                      className="text-[11px] px-2 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}

                {sellingFor === itemKey ? (
                  <div className="mt-2 space-y-2 pl-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Vender para</span>
                      <select
                        value={sellBuyer}
                        onChange={(e) => {
                          setSellBuyer(e.target.value);
                          setPriceItem("");
                          setPriceQty("1");
                          void loadBuyer(e.target.value);
                        }}
                        className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-600/70"
                      >
                        <option value="" className="bg-zinc-800">
                          Selecionar… (um personagem)
                        </option>
                        {targetPool
                          .filter((c) => c.id !== characterId)
                          .map((c) => (
                            <option key={c.id} value={c.id} className="bg-zinc-800">
                              {setName(c.id)}
                            </option>
                          ))}
                      </select>
                    </div>

                    {sellBuyer ? (
                      buyerLoading ? (
                        <p className="text-[11px] text-zinc-500 italic">Lendo o inventário dele(a)…</p>
                      ) : buyerItems.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 italic">
                          Ele(a) não carrega nada que sirva como pagamento.
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Receber</span>
                            <select
                              value={priceItem}
                              onChange={(e) => {
                                setPriceItem(e.target.value);
                                setPriceQty("1");
                              }}
                              className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-600/70"
                            >
                              <option value="" className="bg-zinc-800">
                                Selecionar… (item de pagamento)
                              </option>
                              {buyerItems.map((bi) => {
                                const bQty = bi.equipment_quantity ?? bi.quantity ?? 1;
                                return (
                                  <option key={keyOf(bi)} value={keyOf(bi)} className="bg-zinc-800">
                                    {bi.name || "Sem nome"} × {bQty}
                                  </option>
                                );
                              })}
                            </select>
                            <input
                              type="number"
                              min={1}
                              max={maxPriceQty}
                              value={priceQty}
                              onChange={(e) => setPriceQty(e.target.value)}
                              className="w-20 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-600/70"
                            />
                            {maxPriceQty > 1 ? (
                              <span className="text-[10px] text-zinc-500">máx {maxPriceQty}</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={!priceItem || busy[itemKey]}
                              onClick={() => void sellItem(itemKey)}
                              className="text-[11px] px-2 py-1 rounded-md bg-amber-600/70 hover:bg-amber-600 text-amber-100 disabled:opacity-40 transition-colors"
                            >
                              Concluir venda
                            </button>
                            <button
                              type="button"
                              onClick={() => openSell(itemKey)}
                              className="text-[11px] px-2 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-200 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}