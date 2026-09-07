"use client";

/* ============================================================
   VisibilityPanel — narrator control for character visibility.

   Two perspectives:

   1. "Player → Player" (observer + target): what one PLAYER-
      owned character sees of ANOTHER player character's identity
      and attributes (name, bio, backstory, stats…). Requires the
      target select.

   2. "Player → Table" (observer only): what the observer knows
      of the WORLD — NPCs, items, locations, skills, advantages
      and disadvantages. Rows here are observer-global (no target:
      locations/catalogs carry no other_character_id; NPC rows use
      other_character_id = the NPC's id with attribute = 'name').

   Three tiers per entity:
     unknown    → hidden (or shown as the alias `value`)
     known      → shown masked (alias value: masked name, an
                  unidentified item, partial stats…)
     specialist → fully revealed (real values)

   Changes persist instantly to POST/PUT /game-table-visibility.
   Same component powers the whole-table page and the per-character
   drawer (locked to player→player via `perspective="players"`).
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
  | "npc"
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

// Locations and full catalogs are observer-global knowledge (not bound to
// a single target sheet), so they carry no `other_character_id`.
const GLOBAL_ROWS: RowType[] = [
  "item",
  "skill",
  "advantage",
  "disadvantage",
  "location",
];

const entityField = (t: RowTarget): Record<string, string> => {
  switch (t.type) {
    case "attr":
      return { attribute: t.id };
    case "npc":
      // NPC knowledge reuses the identity 'name' attribute, targeted at
      // the NPC's character id (same mechanism as player→player name).
      return { attribute: "name" };
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

type Perspective = "players" | "world";

type WorldTab = "npcs" | "items" | "locations" | "skills" | "advantages" | "disadvantages";

const WORLD_TABS: { key: WorldTab; label: string }[] = [
  { key: "npcs", label: "NPCs" },
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
  /** If set, the perspective selector is locked to this value. */
  perspective?: Perspective;
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
  perspective: lockedPerspective,
}: VisibilityPanelProps) {
  const observers = useMemo(
    () => characters.filter((c) => c.user?.id),
    [characters]
  );
  const npcIds = useMemo(
    () => new Set(characters.filter((c) => c.isNpc).map((c) => c.id)),
    [characters]
  );
  const [perspective, setPerspective] = useState<Perspective>(
    lockedPerspective ?? (targetId ? "players" : "world")
  );
  const [observerId, setObserverId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(targetId ?? null);
  const [worldTab, setWorldTab] = useState<WorldTab>("npcs");
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkApplying, setBulkApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<DiscoverySelection>({});

  const curObserver = observerId ?? observers[0]?.id ?? null;
  const targetOptions = useMemo(
    () => characters.filter((c) => !c.isNpc && c.id !== curObserver),
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
      // NPC identity knowledge — targeted at the NPC's character id.
      if (
        r.attribute === "name" &&
        r.other_character_id &&
        npcIds.has(String(r.other_character_id))
      ) {
        return true;
      }
      // Catalog rows (item/skill/advantage/disadvantage).
      const isCatalog =
        r.item_id || r.skill_id || r.advantage_id || r.disadvantage_id;
      if (isCatalog) {
        // Global knowledge rows apply everywhere; target-scoped rows
        // only apply within the player→player perspective.
        if (!r.other_character_id) return true;
        return (
          perspective === "players" && !!curTarget && r.other_character_id === curTarget
        );
      }
      // Attribute rows on a character sheet need the chosen target.
      return (
        perspective === "players" &&
        !!curTarget &&
        (!r.other_character_id || r.other_character_id === curTarget)
      );
    });
  }, [rules, curTarget, npcIds, perspective]);

  const index = useMemo(() => {
    const m = new Map<string, VisibilityRule>();
    for (const r of scopeRules) {
      const npcTargetId = r.other_character_id ?? "";
      const isNpcNameRule =
        r.attribute === "name" &&
        !!npcTargetId &&
        npcIds.has(npcTargetId);
      if (isNpcNameRule) {
        m.set(ruleKey("npc", npcTargetId), r);
        continue;
      }
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
  }, [scopeRules, npcIds]);

  const groups: PanelTarget[] = useMemo(() => {
    const attrRows: PanelRow[] = ATTRS.map((a) => ({
      target: { type: "attr", id: a.key },
      label: a.label,
      aliasing: true,
    }));
    const npcRows: PanelRow[] = (characters ?? [])
      .filter((c) => c.isNpc)
      .map((c) => ({
        target: { type: "npc", id: c.id },
        label: charName(c),
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

    if (perspective === "players") {
      return [{ key: "identity", label: "Identity & Attributes", rows: attrRows }];
    }
    return [
      { key: "npcs", label: "NPCs", rows: npcRows },
      { key: "items", label: "Items", rows: itemRows },
      { key: "locations", label: "Locations", rows: locRows },
      { key: "skills", label: "Skills", rows: skillRows },
      { key: "advantages", label: "Advantages", rows: advRows },
      { key: "disadvantages", label: "Disadvantages", rows: disRows },
    ];
  }, [characters, items, locations, skills, advantages, disadvantages, perspective]);

  const activeGroup: PanelTarget | null = useMemo(() => {
    if (perspective === "players") {
      return groups.find((g) => g.key === "identity") ?? null;
    }
    return groups.find((g) => g.key === worldTab) ?? null;
  }, [perspective, worldTab, groups]);

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
    const isGlobalTarget = GLOBAL_ROWS.includes(row.target.type);
    if (!curObserver) return;
    const body: Omit<VisibilityRule, "id"> = {
      character_id: curObserver,
      // NPC knowledge targets the NPC's own character row; global rows
      // (locations/catalogs) carry no target; per-sheet attrs need the
      // selected target.
      other_character_id:
        row.target.type === "npc"
          ? row.target.id
          : isGlobalTarget
          ? null
          : curTarget ?? null,
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

  const needsTarget = (row: PanelRow): boolean =>
    !GLOBAL_ROWS.includes(row.target.type) && row.target.type !== "npc";

  const persist = async (
    row: PanelRow,
    status: VisStatus,
    value: string | null
  ) => {
    if (!curObserver) return;
    // Per-sheet rows still need a chosen target.
    if (needsTarget(row) && !curTarget) return;
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
    if (group.rows.some(needsTarget) && !curTarget) return;
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
      {/* Perspective selector */}
      {!lockedPerspective ? (
        <div className="flex flex-wrap gap-1 mb-4">
          {(
            [
              { key: "players", label: "Player → Player" },
              { key: "world", label: "Player → Table" },
            ] as { key: Perspective; label: string }[]
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPerspective(p.key)}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
                perspective === p.key
                  ? "bg-green-800/30 text-green-400 border border-green-700/40"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

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

        {perspective === "players" ? (
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
        ) : null}

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
        is read “unidentified”), and{" "}
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

      {/* World tab bar */}
      {perspective === "world" ? (
        <div className="flex flex-wrap gap-1 mb-4 border-b border-zinc-800">
          {WORLD_TABS.map((t) => {
            const count =
              groups.find((g) => g.key === t.key)?.rows.length ?? 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setWorldTab(t.key)}
                className={`px-3 py-2 text-xs font-mono uppercase tracking-wide border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
                  worldTab === t.key
                    ? "border-green-700 text-green-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-zinc-600">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {(() => {
        const g = activeGroup;
        if (!g) return null;
        return (
          <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-green-500/80">
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
                      className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 disabled:opacity-40 disabled:cursor-not-allowed ${
                        groupStateOf(g) === "on"
                          ? "bg-emerald-500/60"
                          : groupStateOf(g) === "mixed"
                          ? "bg-green-700/50"
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
                        className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
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
                            className={`px-2 py-0.5 rounded border text-[11px] font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
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