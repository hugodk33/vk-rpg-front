"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { api } from "@/lib/api";
import { formatKg } from "@/lib/units";
import { interpolate, useTranslation } from "@/lib/i18n";
import { inputCls, labelCls, submitCls } from "./formStyles";
import TableTabs from "@/components/TableTabs";
import { FormBreadcrumbs } from "./FormShell";
import SearchModal from "./SearchModal";
import InfoTooltip from "./InfoTooltip";
import SplitToggle from "./SplitToggle";
import type { Advantage, CharacterViewer, Disadvantage, GameTableAdvantages, GameTableDisadvantages, GameTableItems, GameTableModifiers, GameTableSkills, Item, Modifier, SkillItem, TableSettings } from "@/lib/types";

/* Rótulo e campo do formulário. Usa os mesmos tokens das demais telas de
   Narrador (formStyles.ts) — antes este arquivo mantinha um par próprio de
   tokens de tinta, que deixou criar/editar personagem fora da paleta da rota. */
const label = labelCls;
const field = inputCls;

export interface CharacterFormProps {
  tableId?: string;
  tableTitle?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: CharacterViewer;
  /** Regras da mesa — o orçamento de pontos vem daqui, não de um valor fixo. */
  settings?: TableSettings | null;
}

interface Selection {
  id: string;
  name: string;
  cost_points: number;
  level?: number;
}

interface UserOption {
  id: string;
  username?: string;
  email?: string;
  type?: number;
}

const ATTR_COSTS: Record<"st" | "dx" | "iq" | "ht", number> = { st: 10, dx: 20, iq: 20, ht: 10 };
const ATTR_NAMES: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string; color: string; svg: string }> = [
  { key: "st", label: "ST", color: "text-red-400", svg: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "dx", label: "DX", color: "text-zinc-400", svg: "M13 5l7 7-7 7M5 5l7 7-7 7" },
  {
    key: "iq",
    label: "IQ",
    color: "text-blue-400",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  { key: "ht", label: "HT", color: "text-purple-400", svg: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];
  const ENCUMBRANCE_LABELS = ["fr.enc.none", "fr.enc.light", "fr.enc.medium", "fr.enc.heavy", "fr.enc.veryHeavy"];
  const BODY_LOCATIONS = ["Head", "Torso", "Arms", "Legs", "Full Body"];

const OWNER_KEYS = ["advantage_id", "disadvantage_id", "skill_id", "item_id"] as const;
type OwnerKey = (typeof OWNER_KEYS)[number];

interface AttrTotals {
  hp: number;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  fp: number;
}

const EMPTY_TOTALS: AttrTotals = { hp: 0, st: 0, dx: 0, iq: 0, ht: 0, fp: 0 };

/* De que coluna de dono a regra está pendurada (modificador de traço/item). */
function ownerRef(m: Modifier): [OwnerKey, string] | null {
  for (const k of OWNER_KEYS) {
    const v = m[k];
    if (v && String(v).trim().length > 0) return [k, String(v)];
  }
  return null;
}

function sumModTotals(mods: Modifier[]): AttrTotals {
  return mods.reduce<AttrTotals>(
    (acc, m) => {
      acc.hp += m.mod_hp ?? 0;
      acc.st += m.mod_st ?? 0;
      acc.dx += m.mod_dx ?? 0;
      acc.iq += m.mod_iq ?? 0;
      acc.ht += m.mod_ht ?? 0;
      acc.fp += m.mod_fatigue ?? 0;
      return acc;
    },
    { ...EMPTY_TOTALS }
  );
}

const ATTR_MOD_CHIP = [
  { key: "hp", label: "HP", cls: "text-red-400" },
  { key: "st", label: "ST", cls: "text-red-400" },
  { key: "dx", label: "DX", cls: "text-emerald-400" },
  { key: "iq", label: "IQ", cls: "text-blue-400" },
  { key: "ht", label: "HT", cls: "text-purple-400" },
  { key: "fp", label: "FP", cls: "text-blue-400" },
] as const;

const signed = (n: number): string => `${n >= 0 ? "+" : ""}${n}`;

function modChips(t: AttrTotals): Array<{ key: string; label: string; value: string; cls: string }> {
  return ATTR_MOD_CHIP.filter(({ key }) => t[key] !== 0).map(({ key, label, cls }) => ({
    key,
    label,
    value: signed(t[key]),
    cls,
  }));
}

function ModChips({ totals, className }: { totals: AttrTotals; className?: string }) {
  const chips = modChips(totals);
  if (chips.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {chips.map((c) => (
        <span
          key={c.key}
          className={`font-mono text-[10px] leading-none ${c.cls} bg-zinc-900/70 rounded px-1 py-0.5`}
        >
          {c.label} {c.value}
        </span>
      ))}
    </div>
  );
}

const isArmorish = (item?: Item | null): boolean =>
  item?.kind === "armor" || item?.kind === "shield";

type SkillType = "Physical" | "Mental";
type SkillDifficulty = "Easy" | "Medium" | "Hard" | "Very Hard";

const SKILL_TYPE_META: Record<SkillType, { color: string; svg: string }> = {
  Physical: {
    color: "text-orange-400",
    svg: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11",
  },
  Mental: {
    color: "text-violet-400",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
};

const SKILL_COST: Record<SkillType, Partial<Record<SkillDifficulty, Record<number, number>>>> = {
  Physical: {
    Easy: { [-1]: 0.5, [0]: 1, [1]: 2, [2]: 4, [3]: 8, [4]: 16, [5]: 24 },
    Medium: { [-2]: 0.5, [-1]: 1, [0]: 2, [1]: 4, [2]: 8, [3]: 16, [4]: 24, [5]: 32 },
    Hard: { [-3]: 0.5, [-2]: 1, [-1]: 2, [0]: 4, [1]: 8, [2]: 16, [3]: 24, [4]: 32, [5]: 40 },
  },
  Mental: {
    Easy: { [-1]: 0.5, [0]: 1, [1]: 2, [2]: 4, [3]: 6, [4]: 8, [5]: 10 },
    Medium: { [-2]: 0.5, [-1]: 1, [0]: 2, [1]: 4, [2]: 6, [3]: 8, [4]: 10, [5]: 12 },
    Hard: { [-3]: 0.5, [-2]: 1, [-1]: 2, [0]: 4, [1]: 6, [2]: 8, [3]: 10, [4]: 12, [5]: 14 },
    "Very Hard": { [-4]: 0.5, [-3]: 1, [-2]: 2, [-1]: 4, [0]: 8, [1]: 12, [2]: 16, [3]: 20, [4]: 24, [5]: 28 },
  },
};

const MIN_LEVEL: Record<SkillDifficulty, number> = { Easy: -1, Medium: -2, Hard: -3, "Very Hard": -4 };
const MAX_LEVEL = 5;

function skillTypeOf(sk: { predefinition_type?: string }): SkillType {
  return sk.predefinition_type === "Physical" ? "Physical" : "Mental";
}

function skillDifficultyOf(sk: { predefinition_difficulty?: string }): SkillDifficulty {
  const d = sk.predefinition_difficulty;
  if (d === "Easy" || d === "Hard" || d === "Very Hard") return d;
  return "Medium";
}

function skillCostFor(sk: { predefinition_type?: string; predefinition_difficulty?: string }, level: number): number {
  return SKILL_COST[skillTypeOf(sk)][skillDifficultyOf(sk)]?.[level] ?? 0;
}

function skillLevelForCost(sk: { predefinition_type?: string; predefinition_difficulty?: string }, cost: number): number {
  const table = SKILL_COST[skillTypeOf(sk)][skillDifficultyOf(sk)] ?? {};
  for (const [level, c] of Object.entries(table)) {
    if (Math.abs(c - cost) < 0.001) return Number(level);
  }
  return 0;
}

function formatPoints(points: number): string {
  return points % 1 === 0 ? String(points) : points.toFixed(1);
}

interface SkillPredef {
  attr: string;
  mod: number;
}

function skillPredefs(sk: { predefinition?: SkillItem["predefinition"] }): SkillPredef[] {
  return (sk.predefinition ?? [])
    .map((p) => p.depends_on_skill_for_others_attributes)
    .filter((f): f is string => !!f)
    .map((formula) => {
      const m = formula.trim().toLowerCase().match(/^([a-z]+)\s*([+-])\s*(\d+)$/);
      if (!m) return null;
      return { attr: m[1].toUpperCase(), mod: (m[2] === "-" ? -1 : 1) * Number(m[3]) };
    })
    .filter((p): p is SkillPredef => !!p);
}

function skillPredefLabel(sk: { predefinition?: SkillItem["predefinition"] }): string {
  return skillPredefs(sk)
    .map((p) => `${p.attr}${p.mod > 0 ? `+${p.mod}` : p.mod}`)
    .join(" / ");
}

export default function CharacterForm({ tableId, tableTitle, tables, initial, settings }: CharacterFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? (initial ? initial.table?.id ?? "" : ""));
  const [charType, setCharType] = useState<"pc" | "npc">(
    initial ? (!initial.character.user?.id || initial.character.user?.type === 2 ? "npc" : "pc") : "pc"
  );
  const [name, setName] = useState(initial?.character?.name ?? "");
  const [bio, setBio] = useState(initial?.character?.sheet?.bio ?? "");
  const [backstory, setBackstory] = useState(initial?.character?.sheet?.backstory ?? "");
  const [userId, setUserId] = useState(initial?.character?.userId ?? "");
  // O orçamento vem das regras da mesa, mas o mestre pode ajustá-lo nesta
  // ficha. 0 (ou ausente) = sem sistema de pontos: sem barra e sem limite,
  // porque aí os itens vêm do mestre ou de moeda.
  const tableBudget = settings?.starting_points ?? 0;
  const [budget, setBudget] = useState<number>(initial?.character?.sheet?.points ?? tableBudget);
  const totalPoints = budget;
  const hasBudget = totalPoints > 0;
  const [attrs, setAttrs] = useState<Record<"st" | "dx" | "iq" | "ht", number>>({
    st: initial?.character?.sheet?.st ?? 10,
    dx: initial?.character?.sheet?.dx ?? 10,
    iq: initial?.character?.sheet?.iq ?? 10,
    ht: initial?.character?.sheet?.ht ?? 10,
  });
  const [quirks, setQuirks] = useState<Array<{ name: string }>>(
    (initial?.peculiarities ?? []).map((p) => ({ name: p.name || "" }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFor, setSearchFor] = useState<null | "advantages" | "disadvantages" | "skills" | "items">(null);
  const [splitAdv, setSplitAdv] = useState(false);
  const [splitDis, setSplitDis] = useState(false);
  const [splitSkills, setSplitSkills] = useState(false);
  const [splitItems, setSplitItems] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup" | "bio" | "sheet" | "items">(isEdit ? "bio" : "setup");
  const [equipped, setEquipped] = useState<Record<string, { status?: string; location?: string }>>({});

  const [users, setUsers] = useState<UserOption[]>([]);
  const [available, setAvailable] = useState<{
    advantages: Advantage[];
    disadvantages: Disadvantage[];
    skills: SkillItem[];
    items: Item[];
  }>({ advantages: [], disadvantages: [], skills: [], items: [] });
  const [tableMods, setTableMods] = useState<Modifier[]>([]);

  const [selAdv, setSelAdv] = useState<Selection[]>(
    (initial?.character?.advantages ?? []).map((a) => ({
      id: a.advantage_id || a.id,
      name: a.name,
      cost_points: a.cost_points ?? 0,
    }))
  );
  const [selDis, setSelDis] = useState<Selection[]>(
    (initial?.character?.disadvantages ?? []).map((d) => ({
      id: d.disadvantage_id || d.id,
      name: d.name,
      cost_points: d.cost_points ?? 0,
    }))
  );
  const [selSkills, setSelSkills] = useState<Selection[]>(
    (initial?.character?.skills ?? []).map((s) => {
      const cost = s.cost_points ?? 0;
      return {
        id: s.skill_id || s.id,
        name: s.skill_name || s.name || "",
        cost_points: cost,
        level: skillLevelForCost(s, cost),
      };
    })
  );
  const [selItems, setSelItems] = useState<Selection[]>(
    (initial?.character?.items ?? []).map((i) => ({ id: i.item_id || i.id, name: i.name, cost_points: 0 }))
  );

  useEffect(() => {
    if (!currentTableId) return;
    let active = true;
    (async () => {
      try {
        const [adv, dis, sk, items, mods, us] = await Promise.all([
          api<GameTableAdvantages>(`/game-table-advantages/${currentTableId}`),
          api<GameTableDisadvantages>(`/game-table-disadvantages/${currentTableId}`),
          api<GameTableSkills>(`/game-table-skills/${currentTableId}`),
          api<GameTableItems>(`/game-table-items/${currentTableId}`),
          api<GameTableModifiers>(`/game-table-modifiers/${currentTableId}`),
          api<UserOption[]>(`/users`),
        ]);
        if (!active) return;
        setAvailable({
          advantages: adv?.advantages ?? [],
          disadvantages: dis?.disadvantages ?? [],
          skills: sk?.skills ?? [],
          items: items?.items ?? [],
        });
        setTableMods(mods?.modifiers ?? []);
        setUsers(Array.isArray(us) ? us : []);
      } catch {
        /* forms degrade gracefully */
      }
    })();
    return () => {
      active = false;
    };
  }, [currentTableId]);

  const peculiarities = quirks
    .filter((q) => q.name.trim() !== "")
    .map((q) => ({ name: q.name.trim(), cost_points: -1, effect: "" }));

  const spent = useMemo(() => {
    const attrCost = ATTR_NAMES.reduce((sum, { key }) => sum + (attrs[key] - 10) * ATTR_COSTS[key], 0);
    const advCost = selAdv.reduce((s, a) => s + (a.cost_points || 0), 0);
    const disCost = selDis.reduce((s, d) => s + (d.cost_points || 0), 0);
    const skCost = selSkills.reduce((s, sk) => s + (sk.cost_points || 0), 0);
    const quirkCost = peculiarities.length;
    return attrCost + advCost - disCost + skCost - quirkCost;
  }, [attrs, selAdv, selDis, selSkills, peculiarities]);

  const modsByOwner = useMemo(() => {
    const map = new Map<string, Modifier[]>();
    for (const m of tableMods) {
      const ref = ownerRef(m);
      if (ref) {
        const list = map.get(ref[1]) ?? [];
        list.push(m);
        map.set(ref[1], list);
      }
    }
    return map;
  }, [tableMods]);

  /* Traços selecionados que carregam algum modificador de atributo. */
  const modSources = useMemo(() => {
    const sources: Array<{ name: string; totals: AttrTotals }> = [];
    const push = (name: string, mods: Modifier[]) => {
      const totals = sumModTotals(mods);
      if (modChips(totals).length > 0) sources.push({ name, totals });
    };
    for (const s of selAdv) push(s.name, modsByOwner.get(s.id) ?? []);
    for (const s of selDis) push(s.name, modsByOwner.get(s.id) ?? []);
    for (const s of selSkills) push(s.name, modsByOwner.get(s.id) ?? []);
    for (const s of selItems) push(s.name, modsByOwner.get(s.id) ?? []);
    return sources;
  }, [selAdv, selDis, selSkills, selItems, modsByOwner]);

  const modTotals = useMemo(
    () =>
      modSources.reduce<AttrTotals>(
        (acc, s) => {
          acc.hp += s.totals.hp;
          acc.st += s.totals.st;
          acc.dx += s.totals.dx;
          acc.iq += s.totals.iq;
          acc.ht += s.totals.ht;
          acc.fp += s.totals.fp;
          return acc;
        },
        { ...EMPTY_TOTALS }
      ),
    [modSources]
  );

  function adjAttr(key: "st" | "dx" | "iq" | "ht", delta: number) {
    if (hasBudget && delta > 0 && spent + ATTR_COSTS[key] > totalPoints) return;
    const next = attrs[key] + delta;
    if (next < 1 || next > 50) return;
    setAttrs((prev) => ({ ...prev, [key]: next }));
  }

  function toggleSelection(type: "advantages" | "disadvantages", item: { id: string; name: string; cost_points?: number }, checked: boolean) {
    const apply = (prev: Selection[]): Selection[] => {
      if (checked) {
        const exists = prev.some((s) => s.id === item.id);
        if (exists) return prev;
        return [...prev, { id: item.id, name: item.name, cost_points: item.cost_points ?? 0 }];
      }
      return prev.filter((s) => s.id !== item.id);
    };
    if (type === "advantages") setSelAdv(apply);
    else setSelDis(apply);
  }

  function toggleSkill(item: { id: string; name: string }, checked: boolean) {
    if (checked) {
      const sk = available.skills.find((s) => s.id === item.id);
      const predefs = skillPredefs(sk ?? {});
      const level = predefs.length > 0 ? predefs[0].mod : 0;
      setSelSkills((prev) =>
        prev.some((s) => s.id === item.id)
          ? prev
          : [...prev, { id: item.id, name: item.name, cost_points: predefs.length > 0 ? 0 : skillCostFor(sk ?? {}, level), level }]
      );
    } else {
      setSelSkills((prev) => prev.filter((s) => s.id !== item.id));
    }
  }

  function adjSkill(id: string, delta: number) {
    const sk = available.skills.find((s) => s.id === id);
    const diff = skillDifficultyOf(sk ?? {});
    const tableMin = MIN_LEVEL[diff];
    const predefs = skillPredefs(sk ?? {});
    const floor = predefs.length > 0 ? Math.min(predefs[0].mod, tableMin) : tableMin;
    setSelSkills((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const level = s.level ?? 0;
        const next = Math.min(MAX_LEVEL, Math.max(floor, level + delta));
        return { ...s, level: next, cost_points: skillCostFor(sk ?? {}, next) };
      })
    );
  }

  function toggleItem(item: { id: string; name: string }, checked: boolean) {
    if (checked) {
      setSelItems((prev) =>
        prev.some((s) => s.id === item.id) ? prev : [...prev, { id: item.id, name: item.name, cost_points: 0 }]
      );
    } else {
      setSelItems((prev) => prev.filter((s) => s.id !== item.id));
    }
  }

  const doSearch = useCallback(
    async (query: string, filters: Record<string, string>): Promise<import("./SearchModal").SearchModalItem[]> => {
      if (!currentTableId || !searchFor) return [];
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const qs = params.toString();
      const path = `/game-table-${searchFor}/${currentTableId}${qs ? `?${qs}` : ""}`;
      if (searchFor === "advantages") {
        const data = await api<GameTableAdvantages>(path);
        return (data?.advantages ?? []).map((a: Advantage) => ({
          id: a.id,
          name: a.name,
          meta: [a.category, a.subcategory].filter(Boolean).join(" · ") || undefined,
          description: a.description,
        }));
      }
      if (searchFor === "disadvantages") {
        const data = await api<GameTableDisadvantages>(path);
        return (data?.disadvantages ?? []).map((d: Disadvantage) => ({
          id: d.id,
          name: d.name,
          meta: [d.category, d.subcategory].filter(Boolean).join(" · ") || undefined,
          description: d.description,
        }));
      }
      if (searchFor === "skills") {
        const data = await api<GameTableSkills>(path);
        return (data?.skills ?? []).map((sk: SkillItem) => ({
          id: sk.id,
          name: sk.name,
          meta: `${sk.predefinition_type || ""}${sk.predefinition_difficulty ? ` · ${sk.predefinition_difficulty}` : ""}`,
          description: sk.description,
        }));
      }
      if (searchFor === "items") {
        const data = await api<GameTableItems>(path);
        return (data?.items ?? []).map((item: Item) => ({
          id: item.id,
          name: item.name,
          meta: [item.category, item.kind, item.weight_lb != null ? formatKg(item.weight_lb) : null].filter(Boolean).join(" · ") || undefined,
          description: item.description,
        }));
      }
      return [];
    },
    [currentTableId, searchFor]
  );

  const MAX_QUIRKS = 5;

  function addQuirk() {
    setQuirks((prev) => (prev.length >= MAX_QUIRKS ? prev : [...prev, { name: "" }]));
  }

  function updateQuirk(index: number, value: string) {
    setQuirks((prev) => prev.map((q, i) => (i === index ? { ...q, name: value } : q)));
  }

  function removeQuirk(index: number) {
    setQuirks((prev) => prev.filter((_, i) => i !== index));
  }

  const basicSpeed = (attrs.dx + attrs.ht) / 4;
  const itemsWeight = selItems.reduce((sum, s) => {
    const item = available.items.find((i) => i.id === s.id);
    return sum + (item?.weight_lb ?? 0);
  }, 0);
  const encumbranceValue =
    itemsWeight <= attrs.st * 2
      ? 0
      : itemsWeight <= attrs.st * 4
        ? 1
        : itemsWeight <= attrs.st * 6
          ? 2
          : itemsWeight <= attrs.st * 12
            ? 3
            : itemsWeight <= attrs.st * 20
              ? 4
              : 0;
  const move = basicSpeed - encumbranceValue;

  async function doSave() {
    if (!currentTableId) {
      setError(t("fr.error.selectTable"));
      return;
    }
    if (charType === "pc" && !userId) {
      setError(t("fr.error.pickPlayer"));
      return;
    }
    setSaving(true);
    setError(null);

    const sheet = {
      name,
      bio,
      backstory,
      points: hasBudget ? totalPoints : spent,
      hp: attrs.ht,
      st: attrs.st,
      dx: attrs.dx,
      iq: attrs.iq,
      ht: attrs.ht,
      fatigue: initial?.character?.sheet?.fatigue ?? 10,
      encumbrance: initial?.character?.sheet?.encumbrance ?? "None",
    };
    const advantages = selAdv.map((a) => ({ advantage_id: a.id, name: a.name, cost_points: a.cost_points, effect: "" }));
    const disadvantages = selDis.map((d) => ({ disadvantage_id: d.id, name: d.name, cost_points: d.cost_points, effect: "" }));
    const skills = selSkills.map((s) => ({ skill_id: s.id, cost_points: s.cost_points, effect: "" }));

    try {
      if (isEdit && initial) {
        await submitJson<{ success?: boolean }>("/api/game-table-character", "PUT", {
          id: initial.character.id,
          user_id: charType === "npc" ? null : userId,
          table_id: currentTableId,
        });
        router.push(`/character/${initial.character.id}`);
      } else if (charType === "npc") {
        const result = await submitJson<{ character_id: string }>("/api/game-table-npc", "POST", {
          table_id: currentTableId,
          user_id: null,
          status: "Alive",
          sheet,
          advantages,
          disadvantages,
          skills,
        });
        router.push(`/character/${result.character_id}`);
      } else {
        const result = await submitJson<{ character_id: string }>("/api/game-table-character", "POST", {
          table_id: currentTableId,
          user_id: userId,
          sheet,
          advantages,
          disadvantages,
          skills,
          equipment: selItems.map((i) => ({
            item_id: i.id,
            quantity: 1,
            status: equipped[i.id]?.status || "in_inventory",
            location: equipped[i.id]?.location || "none",
          })),
          peculiarities,
        });
        router.push(`/character/${result.character_id}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.character"));
      setSaving(false);
    }
  }

  const budgetPct = totalPoints > 0 ? Math.min(100, (spent / totalPoints) * 100) : 0;

  // A barra só aparece onde os pontos são gastos — ficha e itens — e só
  // depois de o mestre definir a quantidade.
  const showPoints = !isEdit && (activeTab === "sheet" || activeTab === "items") && hasBudget;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doSave();
  }

  const contextTableId = tableId ?? initial?.table?.id ?? "";
  const contextTableTitle =
    tableTitle ?? initial?.table?.title ?? tables?.find((entry) => entry.id === contextTableId)?.title;

  const tabs: Array<[typeof activeTab, string]> = !isEdit
    ? [
        ["setup", t("fr.ch.tabSetup")],
        ["bio", t("fr.ch.tabBio")],
        ["sheet", t("fr.ch.tabSheet")],
        ["items", t("fr.ch.tabItems")],
      ]
    : [
        ["bio", t("fr.ch.tabBio")],
        ["sheet", t("fr.ch.tabSheet")],
        ["items", t("fr.ch.tabItems")],
      ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {contextTableId ? <TableTabs tableId={contextTableId} /> : null}

      <FormBreadcrumbs
        crumbs={
          contextTableId
            ? [
                { label: t("nav.tables"), href: "/narrator" },
                { label: contextTableTitle || t("nav.table"), href: `/table/${contextTableId}` },
                { label: t("nav.characters"), href: `/table/${contextTableId}/characters` },
                { label: isEdit ? t("fr.ch.editTitle") : t("fr.ch.newTitle") },
              ]
            : [
                { label: t("nav.tables"), href: "/narrator" },
                { label: isEdit ? t("fr.ch.editTitle") : t("fr.ch.newTitle") },
              ]
        }
      />

      <header className="mt-8 border-l-2 border-green-600 pl-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono uppercase tracking-[0.14em] text-[11px] text-green-400">
              {t("fr.ch.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-100">
              {isEdit ? t("fr.ch.editTitle") : t("fr.ch.newTitle")}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isEdit ? t("fr.ch.subEdit") : t("fr.ch.subNew")}
            </p>
          </div>
          {isEdit ? (
            <button
              onClick={() => void doSave()}
              disabled={saving}
              className={`${submitCls} disabled:opacity-50`}
            >
              {saving ? t("fr.saving") : t("fr.saveChanges")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-6 flex items-center gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 font-mono uppercase tracking-[0.14em] text-[11px] transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-green-600 text-green-400"
                : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showPoints ? (
        <div className="sticky top-14 z-40 backdrop-blur-sm bg-zinc-900/90 -mx-6 px-6 py-3 mb-6">
          <div className="flex items-center justify-center gap-6 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] font-bold text-green-400 whitespace-nowrap tabular-nums">
              {spent} / {totalPoints}
            </div>
            <div className="flex-1 max-w-md">
              <div className="w-full rounded-full h-1.5 bg-zinc-800">
                <div className="bg-green-700 h-1.5 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === "setup" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-3">{t("fr.ch.character")}</h2>

              {!isEdit && !tableId ? (
                <div className="mb-3">
                  <label className={label}>{t("fr.table")}</label>
                  <select
                    value={currentTableId}
                    onChange={(e) => setCurrentTableId(e.target.value)}
                    required
                    className={field}
                  >
                    <option value="" disabled>
                      {t("fr.pickTable")}
                    </option>
                    {(tables ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {!isEdit ? (
                <>
                  <div className="mb-3">
                    <label className={`${label} mb-2`}>{t("fr.type")}</label>
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="charType"
                          value="pc"
                          checked={charType === "pc"}
                          onChange={() => setCharType("pc")}
                          className="w-4 h-4 border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                        />
                        <span className="text-zinc-100 text-sm">{t("fr.ch.pc")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="charType"
                          value="npc"
                          checked={charType === "npc"}
                          onChange={() => setCharType("npc")}
                          className="w-4 h-4 border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                        />
                        <span className="text-zinc-100 text-sm">{t("fr.ch.npc")}</span>
                      </label>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className={label}>{t("fr.ch.pointsBudget")}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={budget}
                      onChange={(e) => setBudget(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className={field}
                    />
                    <p className="mt-1 text-xs text-zinc-500">{t("fr.ch.pointsBudgetHint")}</p>
                  </div>
                  {charType === "pc" ? (
                    <div>
                      <label className={label}>{t("fr.ch.assignPlayer")}</label>
                      <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={field}>
                        <option value="">{t("fr.pickPlayerPh")}</option>
                        {users
                          .filter((u) => u.type !== 2)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username || u.email || u.id}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "bio" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-3">{t("fr.ch.identity")}</h2>
              <div className="space-y-3 mb-3">
                <div>
                  <label className={label}>{t("fr.name")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required className={field} />
                </div>
                <div>
                  <label className={label}>{t("fr.ch.bio")}</label>
                  <input value={bio} onChange={(e) => setBio(e.target.value)} className={field} />
                </div>
              </div>
              <div>
                <label className={label}>{t("fr.ch.backstory")}</label>
                <textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} rows={2} className={field} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "sheet" && (
        <>
          <div className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
            <h2 className="text-lg font-semibold text-zinc-100 mb-6">{t("fr.ch.attributes")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
              {ATTR_NAMES.map(({ key, label, color, svg }) => (
                <div key={key} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={svg} />
                    </svg>
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{label}</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjAttr(key, -1)}
                      className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-xl font-bold text-green-500">{attrs[key]}</span>
                    <button
                      type="button"
                      onClick={() => adjAttr(key, 1)}
                      className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      +
                    </button>
                  </div>
                  {modTotals[key] !== 0 ? (
                    <span className="font-mono text-[11px] text-zinc-400">
                      {t("fr.ch.effective")}{" "}
                      <span className="text-green-400 font-bold">{attrs[key] + modTotals[key]}</span>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-700/50">
              <div>
                <label className={label}>{t("fr.hp")}</label>
                <div className="rounded-lg bg-zinc-800 px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {attrs.ht + modTotals.hp}
                  {modTotals.hp !== 0 ? (
                    <span className="text-[11px] text-green-300/80 font-medium ml-1">{signed(modTotals.hp)}</span>
                  ) : null}
                </div>
              </div>
              <div>
                <label className={label}>{t("fr.ch.basicSpeed")}</label>
                <div className="rounded-lg bg-zinc-800 px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {basicSpeed.toFixed(2)}
                </div>
              </div>
              <div>
                <label className={label}>{t("fr.ch.move")}</label>
                <div className="rounded-lg bg-zinc-800 px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {move.toFixed(2)}
                </div>
              </div>
            </div>
            {modSources.length > 0 ? (
              <div className="mt-4 pt-3 border-t border-zinc-700/50">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">{t("fr.ch.modSources")}:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
                  {modSources.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-zinc-400 truncate">{s.name}</span>
                      <ModChips totals={s.totals} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">{t("fr.ch.defenseSpeed")}</h3>
            <div className="flex justify-center flex-wrap gap-6">
              {([
                { label: "fr.ch.dodge", value: String(Math.floor(basicSpeed + 3)), color: "text-zinc-400", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                { label: "fr.hp", value: String(attrs.ht + modTotals.hp), color: "text-red-400", d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
                { label: "fr.fp", value: String((initial?.character?.sheet?.fatigue ?? 10) + modTotals.fp), color: "text-green-500", d: "M13 10V3L4 14h7v7l9-11h-7z" },
                { label: "fr.ch.basicSpeed", value: basicSpeed.toFixed(2), suffix: "km/h", color: "text-zinc-400", d: "M13 5l7 7-7 7M5 5l7 7-7 7" },
                { label: "fr.ch.move", value: String(move), color: "text-blue-400", d: "M5 12h14M12 5l7 7-7 7" },
                { label: "fr.ch.encumbrance", value: t(ENCUMBRANCE_LABELS[encumbranceValue]), sub: formatKg(itemsWeight), color: "text-purple-400", d: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
              ] as Array<{ label: string; value: string; suffix?: string; color: string; d: string }>).map(({ label, value, suffix, color, d }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[80px]">
                  <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
                  </svg>
                  <span className={`${color} text-sm font-bold`}>{value}{suffix ? <span className="font-light text-xs ml-0.5">{suffix}</span> : null}</span>
                  <span className="text-zinc-500 text-xs font-semibold uppercase">{t(label)}</span>
                </div>
              ))}
            </div>
          </div>

        <div className="space-y-6">
          <section className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-semibold text-zinc-100">{t("fr.ch.advTitle")}</h2>
                <span className="text-sm text-zinc-500">{interpolate(t("fr.list.slashF"), { n: selAdv.length })}</span>
              </div>
              <div className="flex items-center gap-2">
                <SplitToggle active={splitAdv} onToggle={() => setSplitAdv((v) => !v)} />
                <button
                  type="button"
                  onClick={() => setSearchFor("advantages")}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                  </svg>
                  {t("fr.search")}
                </button>
              </div>
            </div>
              <div className="space-y-2 max-h-60 overflow-y-auto scroll-thin pr-2">
                {(() => {
                  const selIdSet = new Set(selAdv.map((s) => s.id));
                  const selRows = available.advantages.filter((a) => selIdSet.has(a.id));
                  const unselRows = available.advantages.filter((a) => !selIdSet.has(a.id));
                  const renderAdv = (a: Advantage) => {
                    const isSelected = selIdSet.has(a.id);
                    return (
                      <InfoTooltip
                        key={a.id}
                        rows={[
                          { label: t("fr.tip.cost"), value: a.cost_points != null ? (a.cost_points >= 0 ? "+" : "") + a.cost_points : undefined },
                          { label: t("fr.tip.category"), value: a.category },
                          { label: t("fr.tip.subcategory"), value: a.subcategory },
                          { label: t("fr.tip.description"), value: a.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/40 cursor-pointer ${
                            isSelected ? "border border-green-600/50 bg-green-800/20" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelection("advantages", { id: a.id, name: a.name, cost_points: a.cost_points }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-100 truncate">{a.name || t("fr.noName")}</div>
                            {a.description ? <div className="text-xs text-zinc-500 truncate">{a.description}</div> : null}
                            <ModChips totals={sumModTotals(modsByOwner.get(a.id) ?? [])} className="mt-1" />
                          </div>
                          <span className="text-xs font-mono text-green-500 font-bold shrink-0">
                            {a.cost_points != null ? (a.cost_points >= 0 ? "+" : "") + a.cost_points : "±0"}
                          </span>
                        </label>
                      </InfoTooltip>
                    );
                  };
                  if (available.advantages.length === 0) return <p className="text-zinc-500 text-sm">{t("fr.list.noAdv")}</p>;
                  if (splitAdv) {
                    return (
                      <>
                        {selRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{interpolate(t("fr.list.slashF"), { n: selRows.length })}</div>
                            {selRows.map(renderAdv)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{interpolate(t("fr.list.slashNF"), { n: unselRows.length })}</div>
                            {unselRows.map(renderAdv)}
                          </>
                        ) : null}
                      </>
                    );
                  }
                  return available.advantages.map(renderAdv);
                })()}
              </div>
            </section>

            <section className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <h2 className="text-lg font-semibold text-zinc-100">{t("fr.ch.disTitle")}</h2>
                  <span className="text-sm text-zinc-500">{interpolate(t("fr.list.slashF"), { n: selDis.length })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SplitToggle active={splitDis} onToggle={() => setSplitDis((v) => !v)} />
                  <button
                    type="button"
                    onClick={() => setSearchFor("disadvantages")}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                    </svg>
                    {t("fr.search")}
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto scroll-thin pr-2">
                {(() => {
                  const selIdSet = new Set(selDis.map((s) => s.id));
                  const selRows = available.disadvantages.filter((d) => selIdSet.has(d.id));
                  const unselRows = available.disadvantages.filter((d) => !selIdSet.has(d.id));
                  const renderDis = (d: Disadvantage) => {
                    const isSelected = selIdSet.has(d.id);
                    return (
                      <InfoTooltip
                        key={d.id}
                        rows={[
                          { label: t("fr.tip.cost"), value: d.cost_points != null ? `-${d.cost_points}` : undefined },
                          { label: t("fr.tip.category"), value: d.category },
                          { label: t("fr.tip.subcategory"), value: d.subcategory },
                          { label: t("fr.tip.effect"), value: d.effect },
                          { label: t("fr.tip.description"), value: d.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/40 cursor-pointer ${
                            isSelected ? "border border-green-600/50 bg-green-800/20" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelection("disadvantages", { id: d.id, name: d.name, cost_points: d.cost_points }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-100 truncate">{d.name || t("fr.noName")}</div>
                            {d.description ? <div className="text-xs text-zinc-500 truncate">{d.description}</div> : null}
                            <ModChips totals={sumModTotals(modsByOwner.get(d.id) ?? [])} className="mt-1" />
                          </div>
                          <span className="text-xs font-mono text-green-500 font-bold shrink-0">
                            {d.cost_points != null ? (d.cost_points > 0 ? `-${d.cost_points}` : String(d.cost_points)) : "±0"}
                          </span>
                        </label>
                      </InfoTooltip>
                    );
                  };
                  if (available.disadvantages.length === 0) return <p className="text-zinc-500 text-sm">{t("fr.list.noDis")}</p>;
                  if (splitDis) {
                    return (
                      <>
                        {selRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{interpolate(t("fr.list.slashF"), { n: selRows.length })}</div>
                            {selRows.map(renderDis)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{interpolate(t("fr.list.slashNF"), { n: unselRows.length })}</div>
                            {unselRows.map(renderDis)}
                          </>
                        ) : null}
                      </>
                    );
                  }
                  return available.disadvantages.map(renderDis);
                })()}
              </div>
            </section>
        </div>

        <div className="pt-6">
          <span className="text-sm text-zinc-500 mb-2 block">{interpolate(t("fr.list.slashF"), { n: selSkills.length })}</span>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-zinc-100">{t("fr.ch.skillsTitle")}</h2>
            <SplitToggle active={splitSkills} onToggle={() => setSplitSkills((v) => !v)} />
            <button
              type="button"
              onClick={() => setSearchFor("skills")}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              {t("fr.search")}
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-4">{t("fr.ch.skillsHint")}</p>
          <section className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-x-2 p-2 pb-2 pr-2 text-xs font-medium text-zinc-500 border-b border-zinc-700/50 mb-1">
              <div className="w-4 shrink-0" />
              <div className="flex-1 min-w-0" style={{maxWidth: "Calc(100% - 240px)"}}>{t("fr.ch.skillCol")}</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-6 shrink-0" />
                  <span className="w-20 text-center">{t("fr.ch.skillLevelCol")}</span>
                  <div className="w-6 shrink-0" />
                </div>
                <span className="w-10 text-center">{t("fr.ch.ptsCol")}</span>
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto scroll-thin pr-2">
              {(() => {
                const selIdSet = new Set(selSkills.map((s) => s.id));
                const selRows = available.skills.filter((sk) => selIdSet.has(sk.id));
                const unselRows = available.skills.filter((sk) => !selIdSet.has(sk.id));
                const renderSkill = (sk: SkillItem) => {
                  const sel = selSkills.find((s) => s.id === sk.id);
                  const base = skillTypeOf(sk) === "Physical" ? "DX" : "IQ";
                  const type = skillTypeOf(sk);
                  const level = sel?.level ?? 0;
                  const abs = (skillTypeOf(sk) === "Physical" ? attrs.dx : attrs.iq) + level;
                  const rel = level === 0 ? base : level > 0 ? `${base}+${level}` : `${base}${level}`;
                  return (
                    <InfoTooltip
                      key={sk.id}
                        rows={[
                          { label: t("fr.tip.type"), value: [sk.predefinition_type, sk.predefinition_difficulty].filter(Boolean).join(" · ") },
                          { label: t("fr.tip.default"), value: skillPredefLabel(sk) },
                          { label: t("fr.tip.category"), value: sk.category },
                          { label: t("fr.tip.subcategory"), value: sk.subcategory },
                          { label: t("fr.tip.effect"), value: sk.effect },
                          { label: t("fr.tip.description"), value: sk.description },
                          {
                            label: t("fr.tip.predef"),
                          value:
                            sk.predefinition
                              ?.map((p) => [p.skill, p.depends_on_skill_for_others_attributes ?? p.value].filter(Boolean).join(" "))
                              .filter(Boolean)
                              .join(", ") || undefined,
                        },
                        {
                          label: t("fr.tip.deps"),
                          value:
                            sk.dependencies
                              ?.map((d) => [d.skill, d.value].filter(Boolean).join(" "))
                              .filter(Boolean)
                              .join(", ") || undefined,
                        },
                      ]}
                    >
                      <div
                        className={`flex flex-wrap items-center gap-x-2 gap-y-1 p-2 rounded-lg hover:bg-zinc-700/40 ${
                          sel ? "border border-green-600/50 bg-green-800/20" : "border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel}
                          onChange={(e) => toggleSkill({ id: sk.id, name: sk.name }, e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-100 truncate">{sk.name || t("fr.noName")}</div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            {SKILL_TYPE_META[type] ? (
                              <svg className={`w-3.5 h-3.5 ${SKILL_TYPE_META[type].color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={SKILL_TYPE_META[type].svg} />
                              </svg>
                            ) : null}
                            <span>
                              {sk.predefinition_type === "Physical" ? t("fr.ch.typePhysicalPh") : sk.predefinition_type === "Mental" ? t("fr.ch.typeMentalPh") : sk.predefinition_type || t("fr.ch.skillCol")}
                              {sk.predefinition_difficulty
                                ? ` · ${
                                    sk.predefinition_difficulty === "Easy"
                                      ? t("fr.diff.easy")
                                      : sk.predefinition_difficulty === "Medium"
                                        ? t("fr.diff.medium")
                                        : sk.predefinition_difficulty === "Hard"
                                          ? t("fr.diff.hard")
                                          : sk.predefinition_difficulty === "Very Hard"
                                            ? t("fr.diff.veryHard")
                                            : sk.predefinition_difficulty
                                  }`
                                : ""}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {skillPredefLabel(sk)
                              ? interpolate(t("fr.tip.standardPrefix"), { v: skillPredefLabel(sk) })
                              : t("fr.tip.standardNone")}
                          </div>
                          {sk.description ? <div className="text-xs text-zinc-500 truncate">{sk.description}</div> : null}
                          <ModChips totals={sumModTotals(modsByOwner.get(sk.id) ?? [])} className="mt-1" />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjSkill(sk.id, -1)}
                              className="w-6 h-6 shrink-0 rounded bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 text-xs font-bold flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-xs font-mono text-green-500 font-bold text-center whitespace-nowrap w-20">
                              {sel ? `${rel} (${abs})` : "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjSkill(sk.id, 1)}
                              className="w-6 h-6 shrink-0 rounded bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 text-xs font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-md font-mono text-green-500 font-bold w-10 text-center whitespace-nowrap">
                            {sel ? formatPoints(sel.cost_points) : "0"}
                          </span>
                        </div>
                      </div>
                    </InfoTooltip>
                  );
                };
                if (available.skills.length === 0) return <p className="text-zinc-500 text-sm">{t("fr.list.noSkill")}</p>;
                if (splitSkills) {
                  return (
                    <>
                      {selRows.length > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{interpolate(t("fr.list.slashF"), { n: selRows.length })}</div>
                          {selRows.map(renderSkill)}
                        </>
                      ) : null}
                      {unselRows.length > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{interpolate(t("fr.list.slashNF"), { n: unselRows.length })}</div>
                          {unselRows.map(renderSkill)}
                        </>
                      ) : null}
                    </>
                  );
                }
                return available.skills.map(renderSkill);
              })()}
            </div>
          </section>
        </div>

        <section className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-zinc-100">{t("fr.ch.quirks")}</h2>
                  <span className="text-sm text-zinc-500">
                    {quirks.length} / {MAX_QUIRKS}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {quirks.map((q, index) => (
                  <div key={index} className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeQuirk(index)}
                        className="ml-auto text-zinc-500 hover:text-red-400 text-xs transition-colors"
                      >
                        {t("fr.ch.quirkRemove")}
                      </button>
                    </div>
                    <div>
                      <label className={label}>{t("fr.name")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={q.name}
                          onChange={(e) => updateQuirk(index, e.target.value)}
                          className={field}
                          placeholder={t("fr.ch.quirkPh")}
                        />
                        <span className="text-xs font-mono text-green-500 font-bold shrink-0">-1</span>
                      </div>
                    </div>
                  </div>
                ))}
                {quirks.length === 0 ? (
                  <p className="text-zinc-500 text-sm">{t("fr.ch.quirksEmpty")}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={addQuirk}
                disabled={quirks.length >= MAX_QUIRKS}
                className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-100 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {t("fr.ch.quirkAdd")}
              </button>
            </section>
        </>
        )}

        {activeTab === "items" && (
        <>
          <div className="space-y-6">
            {(() => {
              const armorItems = selItems.filter((s) => isArmorish(available.items.find((i) => i.id === s.id)));
              const armors = armorItems.map((s) => {
                const item = available.items.find((i) => i.id === s.id);
                const eq = equipped[s.id];
                return { id: s.id, name: s.name, fit: eq?.location, value: item?.armor?.dr != null ? `DR ${item.armor.dr}` : undefined };
              });
              return (
<div>
                      {(() => {
                    const drFor = (fits: string[]) => {
                      let total = 0;
                      for (const a of armors) {
                        if (fits.some((f) => a.fit?.toLowerCase()?.includes(f))) {
                          const m = /(\d+)/.exec(a.value ?? "");
                          if (m) total += parseInt(m[1], 10);
                        }
                      }
                      return total;
                    };
                    const head = drFor(["head", "helmet", "skull"]);
                    const torso = drFor(["torso", "chest", "body", "full body"]);
                    const armR = drFor(["arm", "arms"]);
                    const armL = armR;
                    const legR = drFor(["leg", "legs"]);
                    const legL = legR;
                    return (
                      <div className="relative flex justify-center py-12">
                        <div className="relative">
                          <svg fill="#52525b" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ width: 90 }}>
                            <circle cx="256" cy="56" r="56" />
                            <path d="M437,128H75a27,27,0,0,0,0,54H176.88c6.91,0,15,3.09,19.58,15,5.35,13.83,2.73,40.54-.57,61.23l-4.32,24.45a.42.42,0,0,1-.12.35l-34.6,196.81A27.43,27.43,0,0,0,179,511.58a27.06,27.06,0,0,0,31.42-22.29l23.91-136.8S242,320,256,320c14.23,0,21.74,32.49,21.74,32.49l23.91,136.92a27.24,27.24,0,1,0,53.62-9.6L320.66,283a.45.45,0,0,0-.11-.35l-4.33-24.45c-3.3-20.69-5.92-47.4-.57-61.23,4.56-11.88,12.91-15,19.28-15H437a27,27,0,0,0,0-54Z" />
                          </svg>
                          <div className="absolute inset-0 w-full">
                            {(() => {
                              const badge = (label: string, dr: number, style: React.CSSProperties) => (
                                <div
                                  className="absolute flex flex-col items-center justify-center p-1 rounded border border-zinc-600"
                                  style={{ ...style, width: 52, height: 44 }}
                                >
                                  <span className="text-zinc-400 uppercase" style={{ fontSize: 7, lineHeight: 1, letterSpacing: 0.3 }}>{label}</span>
                                  <span className="text-zinc-400 font-bold text-sm leading-none mt-0.5">{dr}</span>
                                </div>
                              );
                              return (
                                <>
                                  {badge(t("fr.ch.badge.head"), head, { top: -54, left: "50%", transform: "translateX(-50%)" })}
                                  {badge(t("fr.ch.badge.armR"), armR, { top: -32, right: -50 })}
                                  {badge(t("fr.ch.badge.armL"), armL, { top: -32, left: -50 })}
                                  {badge(t("fr.ch.badge.torso"), torso, { top: 23, width: 50, left: -45, height: 50 })}
                                  {badge(t("fr.ch.badge.legR"), legR, { top: 85, right: -50 })}
                                  {badge(t("fr.ch.badge.legL"), legL, { top: 85, left: -50 })}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-1 mt-4 border-t border-zinc-700/50 pt-4">
                    {armors.map((a) => (
                      <div key={a.id} className="flex justify-between text-xs">
                        <span className="text-zinc-100">{a.name}</span>
                        <span className="text-green-500/80">
                          {(a.value ?? "").replace("DR ", "")} {a.fit || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {selItems.some((s) => isArmorish(available.items.find((i) => i.id === s.id))) ? (
            <div className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3 mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{t("fr.ch.equip")}</h3>
              <div className="space-y-3">
                {selItems.filter((s) => isArmorish(available.items.find((i) => i.id === s.id))).map((s) => {
                  const item = available.items.find((i) => i.id === s.id);
                  const eq = equipped[s.id];
                  return (
                    <div key={s.id} className="bg-zinc-900/60 rounded-lg border border-zinc-700/60 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span className="text-sm font-medium text-zinc-100 flex-1 truncate">{s.name}</span>
                        {item?.weight_lb != null ? <span className="text-[10px] text-zinc-500">{formatKg(item.weight_lb)}</span> : null}
                        {item?.armor?.dr != null ? <span className="text-[10px] text-zinc-400">DR {item.armor.dr}</span> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.equipState")}</label>
                          <select
                            value={eq?.status ?? ""}
                            onChange={(e) => setEquipped((prev) => ({ ...prev, [s.id]: { ...prev[s.id], status: e.target.value || undefined } }))}
                            className="w-full rounded border-b border-zinc-600 bg-transparent px-2 py-1 text-xs text-zinc-100"
                          >
                            <option value="">—</option>
                            <option value="equipped">{t("fr.equipped")}</option>
                            <option value="wielded">{t("fr.wielded")}</option>
                            <option value="in_inventory">{t("fr.inInventory")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.loc.link")}</label>
                          <select
                            value={eq?.location ?? ""}
                            onChange={(e) => setEquipped((prev) => ({ ...prev, [s.id]: { ...prev[s.id], location: e.target.value || undefined } }))}
                            className="w-full rounded border-b border-zinc-600 bg-transparent px-2 py-1 text-xs text-zinc-100"
                          >
                            <option value="">{t("fr.none")}</option>
                            {BODY_LOCATIONS.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {eq?.status === "equipped" || eq?.status === "wielded" ? (
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-[10px] text-zinc-400">{eq.status === "wielded" ? t("fr.wielded") : t("fr.equipped")}{eq.location ? ` — ${eq.location}` : ""}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="pt-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">{t("fr.ch.itemsTitle")}</h2>
                <SplitToggle active={splitItems} onToggle={() => setSplitItems((v) => !v)} />
                <button
                  type="button"
                  onClick={() => setSearchFor("items")}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700/50 text-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                  </svg>
                  {t("fr.search")}
                </button>
              </div>
              <span className="text-sm text-zinc-500">{interpolate(t("fr.list.slashM"), { n: selItems.length })}</span>
            </div>
            <section className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto scroll-thin pr-2">
                {(() => {
                  const renderItem = (item: Item) => {
                    const isSelected = selItems.some((s) => s.id === item.id);
                    return (
                      <InfoTooltip
                        key={item.id}
                        rows={[
                          { label: t("fr.tip.category"), value: item.category },
                          { label: t("fr.tip.type"), value: item.kind },
                          { label: t("fr.tip.weight"), value: item.weight_lb != null ? formatKg(item.weight_lb) : undefined },
                          { label: t("fr.tip.quality"), value: item.quality },
                          { label: t("fr.tip.condition"), value: item.condition },
                          { label: t("fr.tip.description"), value: item.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/40 cursor-pointer ${
                            isSelected ? "border border-green-600/50 bg-green-800/20" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleItem({ id: item.id, name: item.name }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 accent-green-700 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-100 truncate">{item.name || t("fr.noName")}</div>
                            <div className="text-xs text-zinc-500 truncate">
                              {[item.category, item.quality, item.condition].filter(Boolean).join(" · ") || ""}
                              {item.weight_lb != null ? ` · ${formatKg(item.weight_lb)}` : ""}
                            </div>
                            {item.description ? <div className="text-xs text-zinc-500 truncate">{item.description}</div> : null}
                            <ModChips totals={sumModTotals(modsByOwner.get(item.id) ?? [])} className="mt-1" />
                          </div>
                        </label>
                      </InfoTooltip>
                    );
                  };
                  if (splitItems) {
                    const selIdSet = new Set(selItems.map((s) => s.id));
                    const selRows = available.items.filter((i) => selIdSet.has(i.id));
                    const unselRows = available.items.filter((i) => !selIdSet.has(i.id));
                    return (
                      <>
                        {selRows.length > 0 ? (
                          <>
                            <div className="col-span-full text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{interpolate(t("fr.list.slashM"), { n: selRows.length })}</div>
                            {selRows.map(renderItem)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="col-span-full text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{interpolate(t("fr.list.slashNM"), { n: unselRows.length })}</div>
                            {unselRows.map(renderItem)}
                          </>
                        ) : null}
                      </>
                    );
                  }
                  return available.items.map(renderItem);
                })()}
                {available.items.length === 0 ? (
                  <p className="col-span-full text-zinc-500 text-sm">{t("fr.list.noItem")}</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <label className={label}>
                {interpolate(t("fr.ch.encLoad"), { load: t(ENCUMBRANCE_LABELS[encumbranceValue]), w: formatKg(itemsWeight) })}
              </label>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {ENCUMBRANCE_LABELS.map((label, i) => {
                const threshold = attrs.st * [2, 4, 6, 12, 20][i];
                const active = i === encumbranceValue;
                return (
                  <div
                    key={label}
                    className={`text-center text-xs rounded-lg px-2 py-1.5 ${
                      active ? "bg-green-800/20 text-zinc-100" : "bg-zinc-800/30 text-zinc-500"
                    }`}
                  >
                    {t(label)}
                    <div className="text-[10px] text-zinc-500">{i === 0 ? "0" : `>${formatKg(threshold)}`}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Defesa e Velocidade */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">{t("fr.ch.defenseSpeed")}</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "fr.ch.dodge", value: String(Math.floor(basicSpeed + 3)), color: "text-zinc-400", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                  { label: "fr.hp", value: String(attrs.ht), color: "text-red-400", d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
                  { label: "fr.fp", value: String(initial?.character?.sheet?.fatigue ?? 10), color: "text-green-500", d: "M13 10V3L4 14h7v7l9-11h-7z" },
                  { label: "fr.ch.basicSpeed", value: basicSpeed.toFixed(2), suffix: "km/h", color: "text-zinc-400", d: "M13 5l7 7-7 7M5 5l7 7-7 7" },
                  { label: "fr.ch.move", value: String(move), color: "text-blue-400", d: "M5 12h14M12 5l7 7-7 7" },
                  { label: "fr.ch.encumbrance", value: t(ENCUMBRANCE_LABELS[encumbranceValue]), sub: formatKg(itemsWeight), color: "text-purple-400", d: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
                ] as Array<{ label: string; value: string; suffix?: string; color: string; d: string }>).map(({ label, value, suffix, color, d }) => (
                  <div key={label} className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                    <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
                    </svg>
                    <span className={`${color} text-sm font-bold`}>{value}{suffix ? <span className="font-light text-xs ml-0.5">{suffix}</span> : null}</span>
                    <span className="text-zinc-500 text-xs font-semibold uppercase">{t(label)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Corpo (DR) */}
            <div>
              {(() => {
                const armorItems = selItems.filter((s) => isArmorish(available.items.find((i) => i.id === s.id)));
                const armors = armorItems.map((s) => {
                  const item = available.items.find((i) => i.id === s.id);
                  const eq = equipped[s.id];
                  return { id: s.id, name: s.name, fit: eq?.location, value: item?.armor?.dr != null ? `DR ${item.armor.dr}` : undefined };
                });
                return (
                  <>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">{t("fr.ch.body")}</h3>
                    <div className="border border-zinc-700/60 bg-zinc-800/70 rounded-xl p-3">
                      {(() => {
                        const drFor = (fits: string[]) => {
                          let total = 0;
                          for (const a of armors) {
                            if (fits.some((f) => a.fit?.toLowerCase()?.includes(f))) {
                              const m = /(\d+)/.exec(a.value ?? "");
                              if (m) total += parseInt(m[1], 10);
                            }
                          }
                          return total;
                        };
                        const head = drFor(["head", "helmet", "skull"]);
                        const torso = drFor(["torso", "chest", "body", "full body"]);
                        const armR = drFor(["arm", "arms"]);
                        const armL = armR;
                        const legR = drFor(["leg", "legs"]);
                        const legL = legR;
                        return (
                          <div className="relative flex justify-center py-10">
                            <div className="relative">
                              <svg fill="#52525b" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ width: 80 }}>
                                <circle cx="256" cy="56" r="56" />
                                <path d="M437,128H75a27,27,0,0,0,0,54H176.88c6.91,0,15,3.09,19.58,15,5.35,13.83,2.73,40.54-.57,61.23l-4.32,24.45a.42.42,0,0,1-.12.35l-34.6,196.81A27.43,27.43,0,0,0,179,511.58a27.06,27.06,0,0,0,31.42-22.29l23.91-136.8S242,320,256,320c14.23,0,21.74,32.49,21.74,32.49l23.91,136.92a27.24,27.24,0,1,0,53.62-9.6L320.66,283a.45.45,0,0,0-.11-.35l-4.33-24.45c-3.3-20.69-5.92-47.4-.57-61.23,4.56-11.88,12.91-15,19.28-15H437a27,27,0,0,0,0-54Z" />
                              </svg>
                              <div className="absolute inset-0 w-full">
                                {(() => {
                                  const badge = (label: string, dr: number, style: React.CSSProperties) => (
                                    <div
                                      className="absolute flex flex-col items-center justify-center p-0.5 rounded border border-zinc-600"
                                      style={{ ...style, width: 46, height: 38 }}
                                    >
                                      <span className="text-zinc-400 uppercase" style={{ fontSize: 6, lineHeight: 1, letterSpacing: 0.3 }}>{label}</span>
                                      <span className="text-zinc-400 font-bold text-xs leading-none mt-0.5">{dr}</span>
                                    </div>
                                  );
                                  return (
                                    <>
                                      {badge(t("fr.ch.badge.head"), head, { top: -48, left: "50%", transform: "translateX(-50%)" })}
                                      {badge(t("fr.ch.badge.armR"), armR, { top: -28, right: -44 })}
                                      {badge(t("fr.ch.badge.armL"), armL, { top: -28, left: -44 })}
                                      {badge(t("fr.ch.badge.torso"), torso, { top: 20, width: 46, left: -42, height: 44 })}
                                      {badge(t("fr.ch.badge.legR"), legR, { top: 76, right: -44 })}
                                      {badge(t("fr.ch.badge.legL"), legL, { top: 76, left: -44 })}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {armors.length > 0 && (
                        <div className="space-y-1 mt-2 border-t border-zinc-700/50 pt-2">
                          {armors.map((a) => (
                            <div key={a.id} className="flex justify-between text-xs">
                              <span className="text-zinc-100 truncate">{a.name}</span>
                              <span className="text-green-500/80 shrink-0">{(a.value ?? "").replace("DR ", "")} {a.fit || ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!isEdit ? (
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : t("fr.ch.create")}
            </button>
            <Link
              href={currentTableId ? `/table/${currentTableId}/characters` : "/narrator"}
              className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors"
            >
              {t("fr.cancel")}
            </Link>
          </div>
        ) : null}
      </form>

      {searchFor ? (
        <SearchModal
          title={
            searchFor === "advantages"
              ? t("fr.search.advTitle")
              : searchFor === "disadvantages"
                ? t("fr.search.disTitle")
                : searchFor === "skills"
                  ? t("fr.search.skTitle")
                  : t("fr.search.itemTitle")
          }
          onSearch={doSearch}
          filters={
            searchFor === "skills"
              ? [
                  {
                    key: "type",
                    label: t("fr.type"),
                    options: [
                      { value: "Physical", label: t("fr.ch.typePhysicalPh") },
                      { value: "Mental", label: t("fr.ch.typeMentalPh") },
                    ],
                  },
                  {
                    key: "difficulty",
                    label: t("fr.ch.difficultyPh"),
                    options: [
                      ["Easy", t("fr.diff.easy")],
                      ["Medium", t("fr.diff.medium")],
                      ["Hard", t("fr.diff.hard")],
                      ["Very Hard", t("fr.diff.veryHard")],
                    ].map(([value, label]) => ({ value, label })),
                  },
                ]
              : searchFor === "items"
                ? [
                    {
                      key: "category",
                      label: t("fr.category"),
                      options: [
                        ...new Set(
                          available.items
                            .map((x) => x.category)
                            .filter((c): c is string => !!c)
                        ),
                      ].map((c) => ({ value: c, label: c })),
                    },
                    {
                      key: "kind",
                      label: t("fr.type"),
                      options: [
                        ...new Map(
                          available.items
                            .filter((x) => !!x.kind)
                            .map((x) => [x.kind!, x.kind!])
                        ).entries(),
                      ]
                        .map(([, n]) => ({ value: String(n), label: String(n) })),
                    },
                  ]
                : [
                    {
                      key: "category",
                      label: t("fr.category"),
                      options: [
                        ...new Set(
                          (searchFor === "advantages" ? available.advantages : available.disadvantages)
                            .map((x) => x.category)
                            .filter((c): c is string => !!c)
                        ),
                      ].map((c) => ({ value: c, label: c })),
                    },
                  ]
          }
          isSelected={(id) =>
            searchFor === "advantages"
              ? selAdv.some((s) => s.id === id)
              : searchFor === "disadvantages"
                ? selDis.some((s) => s.id === id)
                : searchFor === "skills"
                  ? selSkills.some((s) => s.id === id)
                  : selItems.some((s) => s.id === id)
          }
          onToggle={(id, checked) => {
            if (searchFor === "advantages") {
              const a = available.advantages.find((x) => x.id === id);
              if (a) toggleSelection("advantages", { id: a.id, name: a.name, cost_points: a.cost_points }, checked);
            } else if (searchFor === "disadvantages") {
              const d = available.disadvantages.find((x) => x.id === id);
              if (d) toggleSelection("disadvantages", { id: d.id, name: d.name, cost_points: d.cost_points }, checked);
            } else if (searchFor === "skills") {
              const sk = available.skills.find((x) => x.id === id);
              if (sk) toggleSkill({ id: sk.id, name: sk.name }, checked);
            } else {
              const item = available.items.find((x) => x.id === id);
              if (item) toggleItem({ id: item.id, name: item.name }, checked);
            }
          }}
          onClose={() => setSearchFor(null)}
        />
      ) : null}
    </div>
  );
}
