"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterItem, CharacterViewer } from "@/lib/types";
import { api } from "@/lib/api";
import { resolveAttack, DAMAGE_TYPES } from "@/lib/damage";
import { fitLabel } from "@/lib/fit";

const KIND_BADGES: Record<string, { label: string; class: string }> = {
  weapon: { label: "Weapon", class: "bg-red-400/10 text-red-400 border border-red-400/20" },
  shield: { label: "Shield", class: "bg-orange-400/10 text-orange-400 border border-orange-400/20" },
  armor: { label: "Armor", class: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  equipment: { label: "Equipment", class: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
};

const STATUS_LABELS: Record<string, string> = {
  in_inventory: "Inventory",
  equipped: "Equipped",
  wielded: "Wielded",
};

const STATUS_DOTS: Record<string, string> = {
  in_inventory: "bg-zinc-400",
  equipped: "bg-emerald-400",
  wielded: "bg-amber-400",
};

const BODY_PARTS = [
  {
    key: "head",
    label: "Head",
    cls: "text-sky-300 border-sky-400/40 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.3)]",
    icon: "M12 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5.5 19c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6v1h-13v-1z",
  },
  {
    key: "torso",
    label: "Torso",
    cls: "text-amber-300 border-amber-400/40 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
    icon: "M12 3l9 5-3 11-6 3-6-3-3-11 9-5zm0 0v5m-5.2 3.2l3.5 3.5 2.7-2",
  },
  {
    key: "arm",
    label: "Arms",
    cls: "text-rose-300 border-rose-400/40 bg-rose-400/10 shadow-[0_0_12px_rgba(251,113,133,0.3)]",
    icon: "M5 21l1.5-10.5C6.8 8.7 8.2 7.5 10.2 7.5h3.1c2 0 3.2 1.2 3.2 3.1V13c0 1.6-.8 2.4-2.1 2.4H10",
  },
  {
    key: "hand",
    label: "Hands",
    cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.3)]",
    icon: "M7.5 11V6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0v4m0-2.5a1.5 1.5 0 013 0V13c0 3.5-2.5 7-6 7-2.5 0-3.5-1-5-2.5L8 15",
  },
  {
    key: "leg",
    label: "Legs",
    cls: "text-violet-300 border-violet-400/40 bg-violet-400/10 shadow-[0_0_12px_rgba(167,139,250,0.3)]",
    icon: "M12 4v16m0-16c-3.5 0-5 2-5 2m8-2c3.5 0 5 2 5 2M12 20l-.8-7c-.2-2 1.3-3.5 3.3-3.5h1.5m-6.5 3h4",
  },
  {
    key: "foot",
    label: "Feet",
    cls: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.3)]",
    icon: "M4 16v-1c0-1.5 1-2.5 2.5-2.5H16c1.5 0 2.5 1 2.5 2.5v1c0 1-1 2-2 2H6c-1 0-2-1-2-2z",
  },
];

interface BodyPart {
  key: string;
  label: string;
  cls: string;
  icon: string;
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

interface IconDef {
  key: string;
  label: string;
  cls: string;
  match: RegExp;
  paths: string[];
}

const DEFAULT_WEAPON_ICON: IconDef = {
  key: "other",
  label: "Weapon",
  cls: "text-zinc-300",
  match: /$^/,
  paths: ["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "M12 9a3 3 0 100 6 3 3 0 000-6z"],
};

const WEAPON_ICONS: IconDef[] = [
  {
    key: "shield",
    label: "Shield",
    cls: "text-orange-300",
    match: /shield/,
    paths: [
      "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z",
    ],
  },
  {
    key: "gun",
    label: "Firearm",
    cls: "text-zinc-100",
    match: /(gun|rifle|pistol|shotgun|carbine|smg|revolver|musket|machine)/,
    paths: [
      "M3 11a1 1 0 011-1h6l6-3v4h3a2 2 0 012 2v2H3v-4z",
      "M12 16l-2.5 4",
      "M9 13.5l-.5 2",
    ],
  },
  {
    key: "bow",
    label: "Bow",
    cls: "text-lime-300",
    match: /(bow|crossbow|sling|arrow)/,
    paths: [
      "M6 4c-3 3.5-3 12 0 16",
      "M18 4c3 3.5 3 12 0 16",
      "M6 4l12 16",
      "M18 4l-12 16",
      "M12 6v12",
    ],
  },
  {
    key: "spear",
    label: "Spear",
    cls: "text-emerald-300",
    match: /(spear|polearm|lance|javelin|halberd|glaive|pike|trident)/,
    paths: ["M12 3 8 9h8z", "M8 9h8", "M12 10v11"],
  },
  {
    key: "dagger",
    label: "Dagger",
    cls: "text-sky-300",
    match: /(knife|dagger|blade|dirk|bayonet)/,
    paths: ["M12 2l3 5v3l-3 4-3-4V7z", "M9.5 14h5", "M12 14v7"],
  },
  {
    key: "axe",
    label: "Axe",
    cls: "text-red-300",
    match: /(axe|mace|flail|hammer|maul|poleaxe)/,
    paths: [
      "M14 12l-8.5 8.5a2.12 2.12 0 11-3-3L11 9",
      "M15 13 9 7l4-4 6 6h3a8 8 0 01-7 7z",
    ],
  },
  {
    key: "sword",
    label: "Sword",
    cls: "text-violet-300",
    match: /(sword|rapier|saber|sabre|katana|scimitar|falchion|broadsword|shortsword|longsword|greatsword)/,
    paths: ["M14.5 17.5 3 6V3h3l11.5 11.5", "M13 19l6-6", "M16 16l4 4"],
  },
  {
    key: "staff",
    label: "Staff",
    cls: "text-amber-300",
    match: /(staff|bo staff|quarterstaff)/,
    paths: ["M12 3l-2.5 4h5z", "M12 7v14", "M10 17h4"],
  },
  {
    key: "club",
    label: "Club",
    cls: "text-teal-300",
    match: /(club|baton|whip|truncheon)/,
    paths: [
      "M8.5 19.5a3.5 3.5 0 013.5-3.5 3.5 3.5 0 013.5 3.5",
      "M12 16V5a1 1 0 011-1h1",
    ],
  },
];

const ARMOR_ICONS: IconDef[] = [
  {
    key: "head",
    label: "Helmet",
    cls: "text-sky-300",
    match: /(head|skull|helmet|face|neck)/,
    paths: [
      "M12 2c4 0 6.5 2.5 6.5 6 0 4.5-2.2 6.2-2.2 10h-8.6c0-3.8-2.2-5.5-2.2-10C5.5 4.5 8 2 12 2z",
      "M9 8h6",
      "M12 11v5",
    ],
  },
  {
    key: "torso",
    label: "Cuirass",
    cls: "text-amber-300",
    match: /(torso|chest|body|abdomen|groin|vitals)/,
    paths: [
      "M12 3c3.5 0 6 2 6 5 0 3.8-2.5 5.5-2.5 8.5 0 2.4-1.5 4.5-3.5 4.5s-3.5-2.1-3.5-4.5C8.5 13.5 6 11.8 6 8c0-3 2.5-5 6-5z",
      "M12 3v18",
    ],
  },
  {
    key: "arm",
    label: "Bracer",
    cls: "text-rose-300",
    match: /(arm|elbow|shoulder)/,
    paths: ["M7 21V8l2-6 2 6v2", "M3 8c1 .5 1.5 1 1.7 2", "M11 15l6 2"],
  },
  {
    key: "hand",
    label: "Gauntlet",
    cls: "text-emerald-300",
    match: /(hand|wrist|finger)/,
    paths: [
      "M7.5 11V6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0v4m0-2.5a1.5 1.5 0 013 0V13c0 3.5-2.5 7-6 7-2.5 0-3.5-1-5-2.5L8 15",
      "M8 19l1 2 2-1.5",
    ],
  },
  {
    key: "leg",
    label: "Greaves",
    cls: "text-violet-300",
    match: /(leg|thigh|knee|hip)/,
    paths: ["M10 3c1.5 0 2.5 1 2.5 2.5V17c0 2-1 4-2.5 4V3z", "M7 7c.8.3 1.3 1 1.5 1.8", "M12.5 15l-3 1"],
  },
  {
    key: "foot",
    label: "Boots",
    cls: "text-cyan-300",
    match: /(foot|feet|ankle)/,
    paths: [
      "M4 21h11v-3c0-2.5-1.5-4-4-4H8c-2.2 0-3.8 1.4-4 3.5V21z",
      "M8 14c-.7-.8-1-1.8-.9-3",
      "M15 17.5h4V21h-2",
    ],
  },
];

function weaponIconFor(item: CharacterItem): IconDef {
  const kind = kindOf(item);
  const hay = `${kind} ${item.category ?? ""} ${item.name ?? ""} ${item.weapon?.skill ?? ""}`.toLowerCase();
  return WEAPON_ICONS.find((d) => d.match.test(hay)) ?? DEFAULT_WEAPON_ICON;
}

function armorIconFor(item: CharacterItem): IconDef {
  const locations = item.armor?.locations?.toLowerCase() ?? "";
  return ARMOR_ICONS.find((d) => d.match.test(locations)) ?? ARMOR_ICONS[1];
}

function Glyph({ cls, label, paths, className = "w-[18px] h-[18px]" }: { cls: string; label: string; paths: string[]; className?: string }) {
  return (
    <span title={label} className="shrink-0">
      <svg className={`${className} ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {paths.map((d, i) => (
          <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d={d} />
        ))}
      </svg>
    </span>
  );
}

interface GearPanelProps {
  data: CharacterViewer;
  historic?: boolean;
}

function kindOf(i: CharacterItem): string {
  return i.kind ?? "";
}

function nameOf(i: CharacterItem): string {
  return i.name || "Unnamed";
}

function keyOf(i: CharacterItem): string {
  return i.item_id ?? i.id ?? "";
}

export default function GearPanel({ data, historic }: GearPanelProps) {
  const router = useRouter();
  const ch = data.character;
  const characterId = ch.id;
  const st = ch.sheet?.st ?? 10;

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<Array<string | null>>([null, null]);

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
      setError(err instanceof Error ? err.message : "Failed to update equipment.");
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
  const compareHint = !compareA ? "Click a row to add an item" : !compareB ? "Click another item for slot 2" : "Click a row to change items";

  return (
    <div>
      {error ? (
        <div className="mb-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      {locked ? (
        <p className="text-xs text-zinc-500 mb-3">
          Viewing a historic moment — wielding/equipping/storing is disabled.
        </p>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-700/50 px-4 py-3">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Equipment</h2>
          <span className="ml-auto text-xs text-zinc-500">{owned.length} item{owned.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="divide-y divide-zinc-800/80">
          {owned.length === 0 ? (
            <p className="text-zinc-600 text-sm italic px-4 py-4">No items in inventory.</p>
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
            const wicon = isWeaponish ? weaponIconFor(i) : null;
            const aicon = isArmor ? armorIconFor(i) : null;
            return (
              <div
                key={i.equipment_id || i.id}
                onClick={() => toggleCompare(keyOf(i))}
                className={`flex items-center gap-3 px-4 py-2.5 flex-wrap cursor-pointer transition-colors ${
                  isCmp ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/40" : "hover:bg-zinc-800/40"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOTS[stt] ?? "bg-zinc-400"}`} />
                {wicon ? <Glyph cls={wicon.cls} label={wicon.label} paths={wicon.paths} /> : null}
                {aicon ? <Glyph cls={aicon.cls} label={aicon.label} paths={aicon.paths} /> : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200 truncate">{nameOf(i)}</span>
                    {badge ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.class}`}>{badge.label}</span>
                    ) : null}
                    {isCmp ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-600/50">
                        In compare
                      </span>
                    ) : null}
                    {i.quality && i.quality !== "new" ? (
                      <span className="text-[10px] uppercase text-amber-400/80">{i.quality}</span>
                    ) : null}
                    {fit ? (
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wide">{fitLabel(fit)}</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {STATUS_LABELS[stt] ?? stt}
                    {i.quantity != null && i.quantity > 1 ? <span> · x{i.quantity}</span> : null}
                  </div>
                </div>

                {part && stt !== "in_inventory" ? (
                  <div
                    className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-2 py-1.5 rounded-lg border ${part.cls}`}
                    title={i.equipment_location?.replace(/_/g, " ")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d={part.icon} />
                    </svg>
                    <span className="text-[8px] font-semibold uppercase tracking-widest">{part.label}</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {stt === "in_inventory" ? (
                    <>
                      {isWeaponish ? (
                        <button
                          type="button"
                          disabled={busy[keyOf(i)]}
                          onClick={() => mutate(keyOf(i), "wielded", "right_hand")}
                          className="text-[11px] px-2 py-1 rounded-md bg-amber-600/50 hover:bg-amber-600 text-amber-100 transition-colors disabled:opacity-50"
                        >
                          Wield
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy[keyOf(i)]}
                        onClick={() => mutate(keyOf(i), "equipped", "any")}
                        className="text-[11px] px-2 py-1 rounded-md bg-emerald-700/50 hover:bg-emerald-700 text-emerald-100 transition-colors disabled:opacity-50"
                      >
                        Equip
                      </button>
                    </>
                  ) : stt === "wielded" ? (
                    <button
                      type="button"
                      disabled={busy[keyOf(i)]}
                      onClick={() => mutate(keyOf(i), "in_inventory", "none")}
                      className="text-[11px] px-2 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      Unwield
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy[keyOf(i)]}
                      onClick={() => mutate(keyOf(i), "in_inventory", "none")}
                      className="text-[11px] px-2 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      Store
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-100">Compare</h2>
            <span className="ml-auto text-[11px] text-zinc-500">{compareHint}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-800/70">
            {[compareA, compareB].map((it, idx) => (
              <div key={idx} className="bg-zinc-900 p-4 min-h-[120px]">
                {!it ? (
                  <p className="text-zinc-600 text-sm italic">Select an item</p>
                ) : (
                  <GearCard item={it} st={st} status={it.equipment_status} />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GearCard({ item, st, status }: { item: CharacterItem; st: number; status?: string }) {
  const kind = kindOf(item);
  const badge = KIND_BADGES[kind];
  const w = item.weapon;
  const a = item.armor;
  const wicon = w || kind === "shield" ? weaponIconFor(item) : null;
  const aicon = kind === "armor" ? armorIconFor(item) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {wicon ? <Glyph cls={wicon.cls} label={wicon.label} paths={wicon.paths} /> : null}
        {aicon ? <Glyph cls={aicon.cls} label={aicon.label} paths={aicon.paths} /> : null}
        <span className="text-sm font-semibold text-amber-100">{nameOf(item)}</span>
        {badge ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.class}`}>{badge.label}</span>
        ) : null}
        {status ? (
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">{STATUS_LABELS[status] ?? status}</span>
        ) : null}
      </div>

      <dl className="space-y-1 text-xs">
        {item.weight_lb != null ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Weight</dt>
            <dd className="text-zinc-300">{item.weight_lb} lb</dd>
          </div>
        ) : null}
        {item.cost != null ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Cost</dt>
            <dd className="text-zinc-300">${item.cost}</dd>
          </div>
        ) : null}
        {item.quality ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Quality</dt>
            <dd className="text-amber-400/90 capitalize">{item.quality}</dd>
          </div>
        ) : null}
        {item.condition ? (
          <div className="flex justify-between">
            <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Condition</dt>
            <dd className="text-zinc-300 capitalize">{item.condition}</dd>
          </div>
        ) : null}
        {w ? (
          <>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Fit</dt>
              <dd className="text-zinc-300">{fitLabel(w.fit)}</dd>
            </div>
            {w.skill ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Skill</dt>
                <dd className="text-zinc-300">{w.skill}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Weapon</dt>
              <dd className="text-zinc-300 uppercase">
                {[w.handedness === 2 ? "2H" : w.handedness === 1 ? "1H" : null, w.reach ? `Reach ${w.reach}` : null, w.parry ? `Parry ${w.parry}` : null, w.block ? `Block ${w.block}` : null]
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
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Locations</dt>
              <dd className="text-zinc-300 capitalize">{a.locations || "torso"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Fit</dt>
              <dd className="text-zinc-300">{fitLabel(a.fit)}</dd>
            </div>
            {a.flex ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500 uppercase tracking-wide shrink-0 mr-3">Flexible</dt>
                <dd className="text-zinc-300">Yes</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {w && w.attacks?.length ? (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Attacks (ST {st})</p>
          {w.attacks.map((atk, ai) => (
            <div key={ai} className="flex items-center justify-between text-xs gap-2">
              <span className="text-zinc-300 truncate">
                {atk.name || "Attack"}
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