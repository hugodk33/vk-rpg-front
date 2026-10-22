"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterItem, CharacterViewer } from "@/lib/types";
import { api } from "@/lib/api";
import { resolveAttack, DAMAGE_TYPES } from "@/lib/damage";
import { fitLabel } from "@/lib/fit";
import { formatKg } from "@/lib/units";
import { useTranslation } from "@/lib/i18n";
import ItemIcon from "@/components/items/ItemIcon";
import ItemDetailModal from "@/components/item/ItemDetailModal";

type T = (key: string) => string;

const KIND_BADGES: Record<string, { key: string; class: string }> = {
  weapon: { key: "cs.weapon", class: "bg-red-400/10 text-red-400 border border-red-400/20" },
  shield: { key: "it.grp.shield", class: "bg-orange-400/10 text-orange-400 border border-orange-400/20" },
  armor: { key: "cs.armor", class: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  equipment: { key: "cs.equipment", class: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
};

const STATUS_KEYS: Record<string, string> = {
  in_inventory: "itm.inventory",
  equipped: "cs.equipped",
  wielded: "cs.wielded",
};

const BODY_PARTS = [
  {
    key: "head",
    labelKey: "cs.zone.head",
    cls: "text-sky-300 border-sky-400/40 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.3)]",
    icon: "M12 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5.5 19c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6v1h-13v-1z",
  },
  {
    key: "torso",
    labelKey: "cs.zone.torso",
    cls: "text-amber-300 border-amber-400/40 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
    icon: "M12 3l9 5-3 11-6 3-6-3-3-11 9-5zm0 0v5m-5.2 3.2l3.5 3.5 2.7-2",
  },
  {
    key: "arm",
    labelKey: "cs.body.arm",
    cls: "text-rose-300 border-rose-400/40 bg-rose-400/10 shadow-[0_0_12px_rgba(251,113,133,0.3)]",
    icon: "M5 21l1.5-10.5C6.8 8.7 8.2 7.5 10.2 7.5h3.1c2 0 3.2 1.2 3.2 3.1V13c0 1.6-.8 2.4-2.1 2.4H10",
  },
  {
    key: "hand",
    labelKey: "cs.body.hand",
    cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.3)]",
    icon: "M7.5 11V6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0v4m0-2.5a1.5 1.5 0 013 0V13c0 3.5-2.5 7-6 7-2.5 0-3.5-1-5-2.5L8 15",
  },
  {
    key: "leg",
    labelKey: "cs.body.leg",
    cls: "text-violet-300 border-violet-400/40 bg-violet-400/10 shadow-[0_0_12px_rgba(167,139,250,0.3)]",
    icon: "M12 4v16m0-16c-3.5 0-5 2-5 2m8-2c3.5 0 5 2 5 2M12 20l-.8-7c-.2-2 1.3-3.5 3.3-3.5h1.5m-6.5 3h4",
  },
  {
    key: "foot",
    labelKey: "cs.body.foot",
    cls: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.3)]",
    icon: "M4 16v-1c0-1.5 1-2.5 2.5-2.5H16c1.5 0 2.5 1 2.5 2.5v1c0 1-1 2-2 2H6c-1 0-2-1-2-2z",
  },
];

interface BodyPart {
  key: string;
  labelKey: string;
  cls: string;
  icon: string;
}

function statusLabel(status: string, t: T): string {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
}

function partFor(item: CharacterItem): BodyPart | null {
  const loc = item.equipment_location || "";
  const fallback = item.armor?.locations || "";
  const l = `${item.equipment_status ?? ""} ${loc} ${fallback}`.toLowerCase();
  if (/(^|\s)(none|any)(\s|$)/.test(l) && !/(^|\s)hand/.test(l)) return null;
  if (item.equipment_status === "wielded" && !/(^|\s)hand/.test(l)) return BODY_PARTS[3];
  if (/(head|skull|helmet|face|neck)/.test(l)) return BODY_PARTS[0];
  if (/(torso|chest|body|abdomen|groin|vitals)/.test(l)) return BODY_PARTS[1];
  if (/(arm|elbow|shoulder)/.test(l)) return BODY_PARTS[2];
  if (/(hand|wrist|finger)/.test(l)) return BODY_PARTS[3];
  if (/(leg|thigh|knee|hip)/.test(l)) return BODY_PARTS[4];
  if (/(foot|feet|ankle)/.test(l)) return BODY_PARTS[5];
  return null;
}

interface GearPanelProps {
  data: CharacterViewer;
  historic?: boolean;
  /** Abre a negociação com este item já na mão (null = oferta em branco). */
  onTrade?: (itemId: string | null) => void;
}

function kindOf(i: CharacterItem): string {
  return i.kind ?? "";
}

function nameOf(i: CharacterItem, t: T): string {
  return i.name || t("cs.unnamed");
}

function keyOf(i: CharacterItem): string {
  return i.item_id ?? i.id ?? "";
}

export default function GearPanel({ data, historic, onTrade }: GearPanelProps) {
  const router = useRouter();
  const { lang, t } = useTranslation();
  const ch = data.character;
  const characterId = ch.id;
  const st = ch.sheet?.st ?? 10;

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<Array<string | null>>([null, null]);
  const [viewItemId, setViewItemId] = useState<string | null>(null);

  const owned = useMemo(() => ch.items ?? [], [ch.items]);

  const locked = historic === true;
  const canAct = !locked && !!characterId;

  async function mutate(itemId: string, status: string, location?: string) {
    if (!canAct || !itemId) return;
    setBusy((prev) => ({ ...prev, [itemId]: true }));
    setError(null);
    try {
      await api<{ success?: boolean }>("/game-table-character-equipment", {
        method: "PUT",
        body: JSON.stringify({
          character_id: characterId,
          item_id: itemId,
          status,
          location: location ?? (status === "in_inventory" ? "none" : "any"),
        }),
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("cs.gear.errUpdate"));
    } finally {
      setBusy((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  function toggleCompare(id: string) {
    setCompare((prev) => {
      if (prev[0] === id) return [null, prev[1]];
      if (prev[1] === id) return [prev[0], null];
      if (!prev[0]) return [id, prev[1]];
      if (!prev[1]) return [prev[0], id];
      return [id, prev[1]];
    });
  }

  function itemRef(id: string | null): CharacterItem | null {
    if (!id) return null;
    return owned.find((i) => keyOf(i) === id) ?? null;
  }

  const compareA = itemRef(compare[0]);
  const compareB = itemRef(compare[1]);
  const compareHint = !compareA
    ? t("cs.gear.hintFirst")
    : !compareB
      ? t("cs.gear.hintSecond")
      : t("cs.gear.hintSwap");

  return (
    <div>
      {error ? (
        <div className="mb-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      {locked ? (
        <p className="text-xs text-zinc-500 mb-3">
          {t("cs.gear.historic")}
        </p>
      ) : null}

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">{t("cs.equipment")}</h2>
          <div className="flex items-center gap-3">
            {onTrade ? (
              <button
                type="button"
                onClick={() => onTrade(null)}
                title={t("tr.newOffer")}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7h8m-4 0v10m-4-6h8M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t("pl.inv.trade")}
              </button>
            ) : null}
            <span className="text-xs text-zinc-500">
              {owned.length === 1
                ? t("cs.gear.itemCount")
                : t("cs.gear.itemsCount").replace("{n}", String(owned.length))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {owned.length === 0 ? (
            <p className="text-zinc-600 text-sm italic col-span-full px-1 py-2">{t("cs.inv.empty")}</p>
          ) : null}
          {owned.map((i) => {
            const stt = i.equipment_status ?? "in_inventory";
            const badge = KIND_BADGES[kindOf(i)];
            const part = partFor(i);
            const isCmp = compare.includes(keyOf(i));
            const fit = i.weapon?.fit || i.armor?.fit;
            const kind = kindOf(i);
            const isWeaponish = kind === "weapon" || kind === "shield";
            const isArmor = kind === "armor";
            const w = i.weapon;
            const a = i.armor;
            const wicon = isWeaponish;
            const aicon = isArmor;
            const statLine = w
              ? [
                  w.skill,
                  w.handedness === 2 ? "2M" : w.handedness === 1 ? "1M" : null,
                  w.reach ? t("cs.reachValue").replace("{v}", String(w.reach)) : null,
                  w.parry ? t("cs.parryValue").replace("{v}", String(w.parry)) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : a
                ? [`DR ${a.dr ?? 0}`, a.locations ? a.locations.replace(/_/g, " ") : t("cs.zone.torso")]
                    .concat(a.fit ? [fitLabel(a.fit, lang)] : [])
                    .join(" · ")
                : i.weight_lb != null
                  ? `${formatKg(i.weight_lb)}`
                  : "";
            return (
              <div
                key={i.equipment_id || i.id}
                onClick={() => toggleCompare(keyOf(i))}
                className={`group relative flex flex-col rounded-xl border px-3 pb-3 pt-4 text-center cursor-pointer transition-all ${
                  isCmp
                    ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-inset ring-amber-500/40"
                    : "border-zinc-700/40 bg-zinc-900/40 hover:border-zinc-600/60 hover:bg-zinc-900/70"
                }`}
              >
                <div
                  className={`flex items-center justify-center ${
                    isCmp ? "opacity-90" : "group-hover:opacity-90"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-14 h-14 rounded-xl border bg-zinc-950/60 transition-colors ${
                      wicon ? "border-zinc-700/60" : aicon ? "border-cyan-700/50" : "border-zinc-700/40"
                    }`}
                  >
                    <ItemIcon
                      item={i}
                      className="w-8 h-8 transition-transform group-hover:scale-110"
                      imgClassName="w-10 h-10 object-cover rounded-lg"
                    />
                  </span>
                </div>

                <div className="mt-2.5 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate" title={nameOf(i, t)}>
                    {nameOf(i, t)}
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                    {badge ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.class}`}>{t(badge.key)}</span>
                    ) : null}
                    <span className={`text-[9px] uppercase tracking-widest ${
                      stt === "in_inventory" ? "text-zinc-500" : stt === "wielded" ? "text-amber-300/90" : "text-emerald-300/90"
                    }`}>
                      {statusLabel(stt, t)}
                    </span>
                    {isCmp ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-600/50">
                        {t("cs.gear.comparing")}
                      </span>
                    ) : null}
                  </div>
                  {fit ? (
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500 mt-0.5">{fitLabel(fit, lang)}</p>
                  ) : null}
                </div>

                {statLine ? (
                  <p className="mt-1.5 font-mono text-[10px] text-zinc-400 truncate" title={statLine}>
                    {statLine}
                  </p>
                ) : null}
                {w && w.attacks && w.attacks.length > 0 ? (
                  <p className="mt-1 font-mono text-sm font-bold text-red-400">
                    {resolveAttack(w.attacks[0], st, w.rated_st)}
                    <span className="text-zinc-500 font-semibold text-[10px] ml-1 uppercase">
                      {DAMAGE_TYPES[w.attacks[0].damage_type] || w.attacks[0].damage_type}
                    </span>
                  </p>
                ) : null}
                {i.quality && i.quality !== "new" ? (
                  <p className="text-[9px] uppercase tracking-widest text-amber-400/80 mt-0.5">{i.quality}</p>
                ) : null}
                {i.quantity != null && i.quantity > 1 ? (
                  <p className="text-[10px] text-zinc-500 mt-0.5">×{i.quantity}</p>
                ) : null}

                {part && stt !== "in_inventory" ? (
                  <div
                    className={`mt-2 inline-flex items-center justify-center gap-1 self-center rounded-md border px-1.5 py-0.5 ${part.cls}`}
                    title={i.equipment_location?.replace(/_/g, " ")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d={part.icon} />
                    </svg>
                    <span className="text-[8px] font-semibold uppercase tracking-widest">{t(part.labelKey)}</span>
                  </div>
                ) : null}

                <div
                  className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 border-t border-zinc-800/80 pt-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {keyOf(i) ? (
                    <button
                      type="button"
                      title={t("cs.gear.view")}
                      aria-label={t("cs.gear.view")}
                      onClick={() => setViewItemId(keyOf(i))}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 border border-zinc-700/50 hover:text-amber-300 hover:border-amber-600/50 hover:bg-zinc-700/40 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  ) : null}
                  {onTrade && keyOf(i) ? (
                    <button
                      type="button"
                      title={t("pl.inv.trade")}
                      aria-label={t("pl.inv.trade")}
                      onClick={() => onTrade(keyOf(i))}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 border border-zinc-700/50 hover:text-blue-300 hover:border-blue-600/50 hover:bg-zinc-700/40 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7h8m-4 0v10m-4-6h8M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  ) : null}
                  {stt === "in_inventory" ? (
                    <>
                      {isWeaponish ? (
                        <>
                          <button
                            type="button"
                            disabled={busy[keyOf(i)]}
                            onClick={() => mutate(keyOf(i), "wielded", "right_hand")}
                            className="text-[11px] px-2 py-1 rounded-md bg-amber-600/40 hover:bg-amber-600/70 text-amber-100 transition-colors disabled:opacity-50"
                          >
                            {t("cs.gear.wieldRight") || t("cs.gear.wield")}
                          </button>
                          <button
                            type="button"
                            disabled={busy[keyOf(i)]}
                            onClick={() => mutate(keyOf(i), "wielded", "left_hand")}
                            className="text-[11px] px-2 py-1 rounded-md bg-amber-600/40 hover:bg-amber-600/70 text-amber-100 transition-colors disabled:opacity-50"
                          >
                            {t("cs.gear.wieldLeft") || "Mão esquerda"}
                          </button>
                          <button
                            type="button"
                            disabled={busy[keyOf(i)]}
                            onClick={() => mutate(keyOf(i), "wielded", "both_hands")}
                            className="text-[11px] px-2 py-1 rounded-md bg-amber-700/50 hover:bg-amber-700 text-amber-50 transition-colors disabled:opacity-50"
                          >
                            {t("cs.gear.wieldBoth") || "Duas mãos"}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy[keyOf(i)]}
                        onClick={() => mutate(keyOf(i), "equipped", "any")}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-700/50 hover:bg-emerald-700 text-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {t("cs.gear.equip")}
                      </button>
                    </>
                  ) : stt === "wielded" ? (
                    <button
                      type="button"
                      disabled={busy[keyOf(i)]}
                      onClick={() => mutate(keyOf(i), "in_inventory", "none")}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      {t("cs.gear.dropWeapon")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy[keyOf(i)]}
                      onClick={() => mutate(keyOf(i), "in_inventory", "none")}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      {t("cs.gear.stow")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {compareA || compareB ? (
        <div className="bg-zinc-900/90 border border-amber-600/30 rounded-xl overflow-hidden mt-6">
          <div className="flex items-center gap-2 border-b border-amber-600/20 px-4 py-3">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V5l7 7-7 7v-4H3V9h6zM21 5v14" />
            </svg>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-100">{t("cs.gear.compare")}</h2>
            <span className="ml-auto text-[11px] text-zinc-500">{compareHint}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-800/70">
            {[compareA, compareB].map((it, idx) => (
              <div key={idx} className="bg-zinc-900 p-4 min-h-[120px]">
                {!it ? (
                  <p className="text-zinc-600 text-sm italic">{t("cs.gear.selectItem")}</p>
                ) : (
                  <GearCard item={it} st={st} status={it.equipment_status} />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {viewItemId ? (
        <ItemDetailModal key={viewItemId} itemId={viewItemId} onClose={() => setViewItemId(null)} />
      ) : null}
    </div>
  );
}

function GearCard({ item, st, status }: { item: CharacterItem; st: number; status?: string }) {
  const { lang, t } = useTranslation();
  const kind = kindOf(item);
  const badge = KIND_BADGES[kind];
  const w = item.weapon;
  const a = item.armor;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <ItemIcon item={item} className="w-[18px] h-[18px]" imgClassName="w-5 h-5 object-cover rounded" />
        <span className="text-sm font-semibold text-amber-100">{nameOf(item, t)}</span>
        {badge ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.class}`}>{t(badge.key)}</span>
        ) : null}
        {status ? (
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">{statusLabel(status, t)}</span>
        ) : null}
      </div>

      <dl className="space-y-1 text-xs">
        {item.weight_lb != null ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.weight")}</dt>
            <dd className="text-zinc-300">{formatKg(item.weight_lb)}</dd>
          </div>
        ) : null}
        {item.cost != null ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.cost")}</dt>
            <dd className="text-zinc-300">${item.cost}</dd>
          </div>
        ) : null}
        {item.quality ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("cs.quality")}</dt>
            <dd className="text-amber-400/90 capitalize">{item.quality}</dd>
          </div>
        ) : null}
        {item.condition ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("cs.condition")}</dt>
            <dd className="text-zinc-300 capitalize">{item.condition}</dd>
          </div>
        ) : null}
        {w ? (
          <>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.fit")}</dt>
              <dd className="text-zinc-300">{fitLabel(w.fit, lang)}</dd>
            </div>
            {w.skill ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("cs.skill")}</dt>
                <dd className="text-zinc-300">{w.skill}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("cs.weapon")}</dt>
              <dd className="text-zinc-300 uppercase">
                {[w.handedness === 2 ? "2M" : w.handedness === 1 ? "1M" : null, w.reach ? t("cs.reachValue").replace("{v}", String(w.reach)) : null, w.parry ? t("cs.parryValue").replace("{v}", String(w.parry)) : null, w.block ? t("cs.blockValue").replace("{v}", String(w.block)) : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
          </>
        ) : null}
        {a ? (
          <>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">DR</dt>
              <dd className="text-amber-400 font-bold">{a.dr ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.locations")}</dt>
              <dd className="text-zinc-300 capitalize">{a.locations || t("cs.zone.torso")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.fit")}</dt>
              <dd className="text-zinc-300">{fitLabel(a.fit, lang)}</dd>
            </div>
            {a.flex ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">{t("itm.flexible")}</dt>
                <dd className="text-zinc-300">{t("itm.yes")}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {w && w.attacks?.length ? (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{t("cs.gear.attacks").replace("{st}", String(st))}</p>
          {w.attacks.map((atk, ai) => (
            <div key={ai} className="flex items-center justify-between text-xs gap-2">
              <span className="text-zinc-300 truncate">
                {atk.name || t("cs.attack")}
                {atk.usage ? <span className="text-zinc-500"> ({atk.usage})</span> : null}
              </span>
              <span className="text-red-400 font-bold shrink-0">{resolveAttack(atk, st, w.rated_st)}</span>
              <span className="text-zinc-400 shrink-0">{DAMAGE_TYPES[atk.damage_type] || atk.damage_type}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}