"use client";

/* ============================================================
   VisibilityPanel — narrator control for character visibility.

   The observer ("seen by") picks a character (type 1 — a player).
   For each target character, every visible entity gets one of:
     unknown    → hidden (or shown as the alias `value`)
     known      → fully shown
     specialist → fully shown (distinct tier)

   Changes persist instantly to POST/PUT /game-table-visibility.
   Same component powers the whole-table page and the per-character
   drawer (locked target via `targetId`).
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  Advantage,
  Disadvantage,
  GameTableScenes,
  Item,
  Location,
  SkillItem,
  TableCharacter,
  VisibilityRule,
} from "@/lib/types";
import DiscoveryContext, {
  type DiscoverySelection,
} from "./DiscoveryContext";

export type VisStatus = "unknown" | "known" | "specialist";

const STATUS_META: Record<
  VisStatus,
  { label: string; buttonCls: string; dot: string; textCls: string }
> = {
  unknown: {
    label: "Unknown",
    buttonCls:
      "text-zinc-300 border-zinc-700/70 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-700/40",
    dot: "bg-zinc-500",
    textCls: "text-zinc-400",
  },
  known: {
    label: "Known",
    buttonCls:
      "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/20",
    dot: "bg-emerald-400",
    textCls: "text-emerald-300",
  },
  specialist: {
    label: "Specialist",
    buttonCls:
      "text-violet-300 border-violet-500/40 bg-violet-500/10 hover:border-violet-400 hover:bg-violet-500/20",
    dot: "bg-violet-400",
    textCls: "text-violet-300",
  },
};

type RowType =
  | "attr"
  | "item"
  | "skill"
  | "advantage"
  | "disadvantage"
  | "location";

interface RowTarget {
  type: RowType;
  id: string;
}

interface PanelTarget {
  key: string;
  label: string;
  rows: PanelRow[];
}

interface PanelRow {
  target: RowTarget;
  label: string;
  aliasing: boolean;
}

const ruleKey = (type: RowType, id: string) => `${type}:${id}`;

// Locations and catalogs are observer-global knowledge (not bound to a
// single target sheet), so they carry no `other_character_id`.
const GLOBAL_TARGETED: RowType[] = ["location"];
const GLOBAL_UNTARGETED: RowType[] = ["item", "skill", "advantage", "disadvantage"];

const entityField = (t: RowTarget): Record<string, string> => {
  switch (t.type) {
    case "attr":
      return { attribute: t.id };
    case "item":
      return { item_id: t.id };
    case "skill":
      return { skill_id: t.id };
    case "advantage":
      return { advantage_id: t.id };
    case "disadvantage":
      return { disadvantage_id: t.id };
    case "location":
      return { location_id: t.id };
  }
};

const ATTRS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "bio", label: "Bio" },
  { key: "backstory", label: "Backstory" },
  { key: "st", label: "ST" },
  { key: "dx", label: "DX" },
  { key: "iq", label: "IQ" },
  { key: "ht", label: "HT" },
  { key: "hp", label: "HP" },
  { key: "fatigue", label: "FP" },
  { key: "points", label: "Points" },
  { key: "basic_speed", label: "Speed" },
  { key: "move", label: "Move" },
  { key: "encumbrance", label: "Encumbrance" },
  { key: "parry", label: "Parry" },
  { key: "block", label: "Block" },
  { key: "dodge", label: "Dodge" },
];

const charName = (c: TableCharacter) => c.sheet?.name || c.name || "Unnamed";

type TabKey = "characters" | "items" | "locations" | "skills" | "advantages" | "disadvantages";

const TABS: { key: TabKey; label: string }[] = [
  { key: "characters", label: "Characters" },
  { key: "items", label: "Items" },
  { key: "locations", label: "Locations" },
  { key: "skills", label: "Skills" },
  { key: "advantages", label: "Advantages" },
  { key: "disadvantages", label: "Disadvantages" },
];

interface VisibilityPanelProps {
  tableId?: string;
  characters: TableCharacter[];
  items: Item[];
  locations?: Location[];
  skills: SkillItem[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  scenes?: GameTableScenes | null;
  targetId?: string;
}

export default function VisibilityPanel({
  characters,
  items,
  locations,
  skills,
  advantages,
  disadvantages,
  scenes,
  targetId,
}: VisibilityPanelProps) {
  const observers = useMemo(
    () => characters.filter((c) => c.user?.id),
    [characters]
  );
  const [observerId, setObserverId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(targetId ?? null);
  const [tab, setTab] = useState<TabKey>("characters");
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkApplying, setBulkApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<DiscoverySelection>({});

  const curObserver = observerId ?? observers[0]?.id ?? null;
  const targetOptions = useMemo(
    () => characters.filter((c) => c.id !== curObserver),
    [characters, curObserver]
  );
  const isTargetValid =
    !!target && targetOptions.some((c) => c.id === target);
  const curTarget = (isTargetValid ? target : null) ?? targetOptions[0]?.id ?? null;

  useEffect(() => {
    if (!curObserver) return;
    let cancel = false;
    api<VisibilityRule[]>(`/game-table-visibility/${curObserver}`)
      .then((data) => {
        if (!cancel) setRules(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancel) setRules([]);
      });
    return () => {
      cancel = true;
    };
  }, [curObserver]);

  const scopeRules = useMemo(() => {
    return (rules ?? []).filter((r) => {
      // Locations are always observer-global knowledge (no target).
      if (r.location_id) return true;
      // Catalog rows (item/skill/advantage/disadvantage) can be global
      // (unidentified possession) or target-scoped. Without a selected
      // target, only the global knowledge rows apply.
      const isCatalog =
        r.item_id || r.skill_id || r.advantage_id || r.disadvantage_id;
      if (isCatalog) {
        if (!r.other_character_id) return true;
        return !!curTarget && r.other_character_id === curTarget;
      }
      // Attribute rows on a character sheet need a chosen target.
      return !!curTarget && (!r.other_character_id || r.other_character_id === curTarget);
    });
  }, [rules, curTarget]);

  const index = useMemo(() => {
    const m = new Map<string, VisibilityRule>();
    for (const r of scopeRules) {
      if (r.attribute) {
        const names = [
          String(r.attribute).toLowerCase(),
          ...String(r.additionals_attributes ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ];
        for (const n of names) m.set(ruleKey("attr", n), r);
      }
      if (r.item_id) m.set(ruleKey("item", String(r.item_id)), r);
      if (r.skill_id) m.set(ruleKey("skill", String(r.skill_id)), r);
      if (r.advantage_id) m.set(ruleKey("advantage", String(r.advantage_id)), r);
      if (r.disadvantage_id)
        m.set(ruleKey("disadvantage", String(r.disadvantage_id)), r);
      if (r.location_id) m.set(ruleKey("location", String(r.location_id)), r);
    }
    return m;
  }, [scopeRules]);

  const groups: PanelTarget[] = useMemo(() => {
    const attrRows: PanelRow[] = ATTRS.map((a) => ({
      target: { type: "attr", id: a.key },
      label: a.label,
      aliasing: true,
    }));
    const itemRows: PanelRow[] = (items ?? []).map((it) => ({
      target: { type: "item", id: it.id },
      label: it.name,
      aliasing: true,
    }));
    const skillRows: PanelRow[] = (skills ?? []).map((sk) => ({
      target: { type: "skill", id: sk.id },
      label: sk.name,
      aliasing: false,
    }));
    const advRows: PanelRow[] = (advantages ?? []).map((a) => ({
      target: { type: "advantage", id: a.id },
      label: a.name,
      aliasing: false,
    }));
    const disRows: PanelRow[] = (disadvantages ?? []).map((d) => ({
      target: { type: "disadvantage", id: d.id },
      label: d.name,
      aliasing: false,
    }));
    const locRows: PanelRow[] = (locations ?? []).map((l) => ({
      target: { type: "location", id: l.id },
      label: l.name,
      aliasing: true,
    }));
    return [
      { key: "identity", label: "Identity & Attributes", rows: attrRows },
      { key: "items", label: "Items", rows: itemRows },
      { key: "skills", label: "Skills", rows: skillRows },
      { key: "advantages", label: "Advantages", rows: advRows },
      { key: "disadvantages", label: "Disadvantages", rows: disRows },
      { key: "locations", label: "Locations", rows: locRows },
    ];
  }, [items, skills, advantages, disadvantages, locations]);

  const refetch = (observer: string) =>
    api<VisibilityRule[]>(`/game-table-visibility/${observer}`)
      .then((d) => setRules(Array.isArray(d) ? d : []))
      .catch(() => setRules([]));

  const saveRule = async (
    row: PanelRow,
    status: VisStatus,
    value: string | null
  ) => {
    const existing = index.get(ruleKey(row.target.type, row.target.id));
    const isGlobalTarget =
      GLOBAL_TARGETED.includes(row.target.type) ||
      GLOBAL_UNTARGETED.includes(row.target.type);
    if (!curObserver) return;
    const body: Omit<VisibilityRule, "id"> = {
      character_id: curObserver,
      // Locations and the bare knowledge that an item exists are not
      // tied to a single target sheet: they carry no other_character_id.
      other_character_id: isGlobalTarget ? null : curTarget ?? null,
      status,
      value: value ?? "",
      scene_id: discovery.sceneId ?? null,
      narration_id: discovery.narrationId ?? null,
      moment: discovery.moment ?? null,
      ...entityField(row.target),
    };
    if (existing) {
      await api("/game-table-visibility", {
        method: "PUT",
        body: JSON.stringify({ ...body, id: existing.id }),
      });
    } else {
      await api("/game-table-visibility", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
  };

  const persist = async (
    row: PanelRow,
    status: VisStatus,
    value: string | null
  ) => {
    if (!curObserver) return;
    const isGlobal =
      GLOBAL_TARGETED.includes(row.target.type) ||
      GLOBAL_UNTARGETED.includes(row.target.type);
    // Per-target rows (characters/attributes) still need a chosen target.
    if (!isGlobal && !curTarget) return;
    setSaving(true);
    setError(null);
    try {
      await saveRule(row, status, value);
      await refetch(curObserver);
    } catch {
      setError("Failed to save visibility rule.");
    } finally {
      setSaving(false);
    }
  };

  const applyToSection = async (group: PanelTarget, status: VisStatus) => {
    if (!curObserver || group.rows.length === 0) return;
    const isGlobal =
      GLOBAL_TARGETED.includes(group.rows[0].target.type) ||
      GLOBAL_UNTARGETED.includes(group.rows[0].target.type);
    if (!isGlobal && !curTarget) return;
    setBulkApplying(group.key);
    setError(null);
    try {
      await Promise.all(group.rows.map((r) => saveRule(r, status, valueOf(r))));
      await refetch(curObserver);
    } catch {
      setError(`Failed to liberate ${group.label} at once.`);
    } finally {
      setBulkApplying(null);
    }
  };

  const statusOf = (row: PanelRow): VisStatus =>
    (index.get(ruleKey(row.target.type, row.target.id))?.status as VisStatus) ??
    "unknown";

  const valueOf = (row: PanelRow): string =>
    index.get(ruleKey(row.target.type, row.target.id))?.value ?? "";

  const revealedOf = (row: PanelRow): boolean => {
    const s = statusOf(row);
    return s === "known" || s === "specialist";
  };

  const groupStateOf = (group: PanelTarget): "on" | "off" | "mixed" => {
    if (group.rows.length === 0) return "off";
    let seenOn = false;
    let seenOff = false;
    for (const row of group.rows) {
      if (revealedOf(row)) seenOn = true;
      else seenOff = true;
      if (seenOn && seenOff) return "mixed";
    }
    return seenOn ? "on" : "off";
  };

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500 font-mono">
          Seen by
          <select
            value={curObserver ?? ""}
            onChange={(e) => setObserverId(e.target.value || null)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 font-medium uppercase-none normal-case"
          >
            {observers.length === 0 ? (
              <option value="">No player characters</option>
            ) : null}
            {observers.map((c) => (
              <option key={c.id} value={c.id}>
                {charName(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500 font-mono">
            Target
            <select
              value={curTarget ?? ""}
              onChange={(e) => setTarget(e.target.value || null)}
              className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 font-medium uppercase-none normal-case"
            >
              {targetOptions.length === 0 ? (
                <option value="">No other characters</option>
              ) : null}
              {targetOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {charName(c)}
                </option>
              ))}
            </select>
          </label>

        {saving ? (
          <span className="text-xs text-zinc-500 font-mono animate-pulse">
            saving…
          </span>
        ) : null}
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        Three tiers per entity —{" "}
        <span className="text-zinc-300">Unknown</span> keeps it hidden
        (name reads “???”),{" "}
        <span className="text-emerald-300">Known</span> shows the{" "}
        <span className="font-mono text-zinc-400">masked value</span>{" "}
        you type (you know the person <em>by that name</em> — or the item
        is identified “unidentified”), and{" "}
        <span className="text-violet-300">Specialist</span> reveals the{" "}
        <em>real</em> value in full. Anything never touched defaults to
        Unknown. The switch in each group header liberates or hides the
        whole group at once; the switch on each row does the same for a
        single entity.
      </p>

      <DiscoveryContext
        scenes={scenes ?? null}
        value={discovery}
        onChange={setDiscovery}
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-zinc-800">
        {TABS.map((t) => {
          const groupKey = t.key === "characters" ? "identity" : t.key;
          const count =
            groups.find((g) => g.key === groupKey)?.rows.length ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-mono uppercase tracking-wide border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                tab === t.key
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[10px] text-zinc-600">{count}</span>
            </button>
          );
        })}
      </div>

      {(() => {
        const g = (() => {
          switch (tab) {
            case "characters": return groups.find((x) => x.key === "identity")!;
            case "items": return groups.find((x) => x.key === "items")!;
            case "locations": return groups.find((x) => x.key === "locations")!;
            case "skills": return groups.find((x) => x.key === "skills")!;
            case "advantages": return groups.find((x) => x.key === "advantages")!;
            case "disadvantages": return groups.find((x) => x.key === "disadvantages")!;
          }
        })();
        if (!g) return null;
        return (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-amber-400/80">
                {g.label}
                <span className="ml-2 text-zinc-600">{g.rows.length}</span>
              </h3>
              <div className="ml-auto flex items-center gap-2">
                {bulkApplying === g.key ? (
                  <span className="text-[10px] font-mono text-zinc-500 uppercase animate-pulse">
                    apply all…
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        applyToSection(
                          g,
                          groupStateOf(g) === "on" ? "unknown" : "known"
                        )
                      }
                      disabled={g.rows.length === 0}
                      title={
                        groupStateOf(g) === "on"
                          ? "Hide the whole group"
                          : "Liberate the whole group"
                      }
                      className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-40 disabled:cursor-not-allowed ${
                        groupStateOf(g) === "on"
                          ? "bg-emerald-500/60"
                          : groupStateOf(g) === "mixed"
                          ? "bg-amber-500/50"
                          : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-zinc-100 transition-transform ${
                          groupStateOf(g) === "on"
                            ? "translate-x-[18px] bg-emerald-200"
                            : "translate-x-0.5 bg-zinc-400"
                        }`}
                      />
                    </button>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 w-20 text-left">
                      {groupStateOf(g) === "on"
                        ? "all revealed"
                        : groupStateOf(g) === "mixed"
                        ? "mixed"
                        : "all hidden"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ul className="divide-y divide-zinc-800/70">
              {g.rows.map((row) => {
                const status = statusOf(row);
                const revealed = status === "known" || status === "specialist";
                return (
                  <li
                    key={row.target.type + ":" + row.target.id}
                    className="py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          persist(row, revealed ? "unknown" : "known", valueOf(row))
                        }
                        aria-pressed={revealed}
                        title={revealed ? "Hide this one" : "Liberate (reveal now)"}
                        className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                          revealed ? "bg-emerald-500/60" : "bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 rounded-full bg-zinc-100 transition-transform ${
                            revealed
                              ? "translate-x-[18px] bg-emerald-200"
                              : "translate-x-0.5 bg-zinc-400"
                          }`}
                        />
                      </button>
                      <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate">
                        {row.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {(
                          ["unknown", "known", "specialist"] as VisStatus[]
                        ).map((s) => (
                          <button
                            key={s}
                            onClick={() => persist(row, s, valueOf(row))}
                            className={`px-2 py-0.5 rounded border text-[11px] font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                              status === s
                                ? STATUS_META[s].buttonCls
                                : "text-zinc-600 border-zinc-800 hover:text-zinc-300 hover:border-zinc-600"
                            }`}
                            aria-pressed={status === s}
                          >
                            {STATUS_META[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {row.aliasing || status === "unknown" ? (
                      <div className="flex items-center gap-2 mt-1 pl-4">
                        <input
                          type="text"
                          defaultValue={valueOf(row)}
                          placeholder="Masked value (shown at Known/Unknown)"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== valueOf(row))
                              persist(row, statusOf(row), v);
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                        <span className="text-[10px] font-mono text-zinc-600 uppercase">
                          alias
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}
    </div>
  );
}