"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { api } from "@/lib/api";
import { inputCls, labelCls, submitCls } from "./formStyles";
import SearchModal from "./SearchModal";
import InfoTooltip from "./InfoTooltip";
import SplitToggle from "./SplitToggle";
import type { Advantage, CharacterViewer, Disadvantage, GameTableAdvantages, GameTableDisadvantages, GameTableItems, GameTableSkills, Item, SkillItem } from "@/lib/types";

export interface CharacterFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: CharacterViewer;
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
  { key: "dx", label: "DX", color: "text-emerald-400", svg: "M13 5l7 7-7 7M5 5l7 7-7 7" },
  {
    key: "iq",
    label: "IQ",
    color: "text-blue-400",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  { key: "ht", label: "HT", color: "text-purple-400", svg: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];
  const ENCUMBRANCE_LABELS = ["Nenhuma", "Leve", "Média", "Pesada", "Muito pesada"];
  const BODY_LOCATIONS = ["Head", "Torso", "Arms", "Legs", "Full Body"];

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

export default function CharacterForm({ tableId, tables, initial }: CharacterFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? (initial ? initial.table?.id ?? "" : ""));
  const [charType, setCharType] = useState<"pc" | "npc">(
    initial ? (!initial.character.user?.id || initial.character.user?.type === 2 ? "npc" : "pc") : "pc"
  );
  const [name, setName] = useState(initial?.character?.name ?? "");
  const [bio, setBio] = useState(initial?.character?.sheet?.bio ?? "");
  const [backstory, setBackstory] = useState(initial?.character?.sheet?.backstory ?? "");
  const [userId, setUserId] = useState(initial?.character?.userId ?? "");
  const totalPoints = initial?.character?.sheet?.points ?? 150;
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
  const [activeTab, setActiveTab] = useState<"bio" | "sheet" | "items">("bio");
  const [equipped, setEquipped] = useState<Record<string, { status?: string; location?: string }>>({});

  const [users, setUsers] = useState<UserOption[]>([]);
  const [available, setAvailable] = useState<{
    advantages: Advantage[];
    disadvantages: Disadvantage[];
    skills: SkillItem[];
    items: Item[];
  }>({ advantages: [], disadvantages: [], skills: [], items: [] });

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
        const [adv, dis, sk, items, us] = await Promise.all([
          api<GameTableAdvantages>(`/game-table-advantages/${currentTableId}`),
          api<GameTableDisadvantages>(`/game-table-disadvantages/${currentTableId}`),
          api<GameTableSkills>(`/game-table-skills/${currentTableId}`),
          api<GameTableItems>(`/game-table-items/${currentTableId}`),
          api<UserOption[]>(`/users`),
        ]);
        if (!active) return;
        setAvailable({
          advantages: adv?.advantages ?? [],
          disadvantages: dis?.disadvantages ?? [],
          skills: sk?.skills ?? [],
          items: items?.items ?? [],
        });
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

  function adjAttr(key: "st" | "dx" | "iq" | "ht", delta: number) {
    if (delta > 0 && spent + ATTR_COSTS[key] > totalPoints) return;
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
          meta: [item.category, item.kind, item.weight_lb != null ? `${item.weight_lb} lb` : null].filter(Boolean).join(" · ") || undefined,
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
      setError("Selecione a mesa.");
      return;
    }
    if (charType === "pc" && !userId) {
      setError("Selecione um jogador.");
      return;
    }
    setSaving(true);
    setError(null);

    const sheet = {
      name,
      bio,
      backstory,
      points: totalPoints,
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
      setError(err instanceof Error ? err.message : "Falha ao salvar o personagem.");
      setSaving(false);
    }
  }

  const budgetPct = totalPoints > 0 ? Math.min(100, (spent / totalPoints) * 100) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doSave();
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!isEdit ? (
        <div className="sticky top-14 z-40 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-700/50 -mx-4 px-4 py-3 mb-6">
          <div className="flex items-center justify-center gap-6 max-w-3xl mx-auto">
            <div className="text-md font-bold text-green-500 whitespace-nowrap">
              {spent} / {totalPoints}
            </div>
            <div className="flex-1 max-w-md">
              <div className="w-full bg-zinc-800 rounded-full h-3">
                <div className="bg-green-700 h-3 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6 mt-6">
        <div className="flex items-center gap-3">
          {currentTableId ? (
            <a href={`/table/${currentTableId}`} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Voltar à mesa">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-green-100">
              {isEdit ? "Editar Personagem" : "Novo Personagem"}
            </h1>
            <p className="text-zinc-400 text-sm">{isEdit ? "Salvar alterações" : "Criar um personagem para esta mesa"}</p>
          </div>
        </div>
        {isEdit ? (
          <button
            onClick={() => void doSave()}
            disabled={saving}
            className={`${submitCls} disabled:opacity-50`}
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-700/50 mb-6">
        {([["bio", "Bio"], ["sheet", "Ficha"], ["items", "Itens"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-green-700 text-green-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === "bio" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-green-100 mb-3">Identidade</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Bio</label>
                <input value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>História</label>
              <textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>

          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-green-100 mb-3">Personagem</h2>

            {!isEdit && !tableId ? (
              <div className="mb-3">
                <label className={labelCls}>Mesa</label>
                <select
                  value={currentTableId}
                  onChange={(e) => setCurrentTableId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="" disabled>
                    Selecione uma mesa
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
                <div>
                  <label className={`${labelCls} mb-2`}>Tipo</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="charType"
                        value="pc"
                        checked={charType === "pc"}
                        onChange={() => setCharType("pc")}
                        className="w-4 h-4 border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                      />
                      <span className="text-zinc-200 text-sm">Personagem do Jogador</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="charType"
                        value="npc"
                        checked={charType === "npc"}
                        onChange={() => setCharType("npc")}
                        className="w-4 h-4 border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                      />
                      <span className="text-zinc-200 text-sm">NPC</span>
                    </label>
                  </div>
                </div>
                {charType === "pc" ? (
                  <div>
                    <label className={labelCls}>Atribuir ao Jogador</label>
                    <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={inputCls}>
                      <option value="">Selecione um jogador</option>
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

        {activeTab === "sheet" && (
        <>
          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-green-100 mb-6">Atributos</h2>
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
                      className="w-8 h-8 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-xl font-bold text-green-500">{attrs[key]}</span>
                    <button
                      type="button"
                      onClick={() => adjAttr(key, 1)}
                      className="w-8 h-8 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-700/40">
              <div>
                <label className={labelCls}>HP</label>
                <div className="bg-zinc-700/40 rounded-lg px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {attrs.ht}
                </div>
              </div>
              <div>
                <label className={labelCls}>Deslocamento Básico</label>
                <div className="bg-zinc-700/40 rounded-lg px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {basicSpeed.toFixed(2)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Deslocamento</label>
                <div className="bg-zinc-700/40 rounded-lg px-4 py-2.5 text-green-500 font-bold font-mono text-center">
                  {move.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">Defesa &amp; Velocidade</h3>
            <div className="flex justify-center flex-wrap gap-6">
              {([
                { label: "Esquiva", value: String(Math.floor(basicSpeed + 3)), color: "text-cyan-400", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                { label: "HP", value: String(attrs.ht), color: "text-red-400", d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
                { label: "FP", value: String(initial?.character?.sheet?.fatigue ?? 10), color: "text-green-500", d: "M13 10V3L4 14h7v7l9-11h-7z" },
                { label: "Deslocamento Básico", value: basicSpeed.toFixed(2), suffix: "km/h", color: "text-emerald-400", d: "M13 5l7 7-7 7M5 5l7 7-7 7" },
                { label: "Deslocamento", value: String(move), color: "text-blue-400", d: "M5 12h14M12 5l7 7-7 7" },
                { label: "Carga", value: ENCUMBRANCE_LABELS[encumbranceValue], sub: `${itemsWeight.toFixed(1)} lb`, color: "text-purple-400", d: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
              ] as Array<{ label: string; value: string; suffix?: string; color: string; d: string }>).map(({ label, value, suffix, color, d }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[80px]">
                  <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
                  </svg>
                  <span className={`${color} text-sm font-bold`}>{value}{suffix ? <span className="font-light text-xs ml-0.5">{suffix}</span> : null}</span>
                  <span className="text-zinc-500 text-xs font-semibold uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-semibold text-green-100">Vantagens</h2>
                <span className="text-sm text-zinc-500">{selAdv.length} selecionadas</span>
              </div>
              <div className="flex items-center gap-2">
                <SplitToggle active={splitAdv} onToggle={() => setSplitAdv((v) => !v)} />
                <button
                  type="button"
                  onClick={() => setSearchFor("advantages")}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                  </svg>
                  Buscar
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
                          { label: "Custo", value: a.cost_points != null ? (a.cost_points >= 0 ? "+" : "") + a.cost_points : undefined },
                          { label: "Categoria", value: a.category },
                          { label: "Subcategoria", value: a.subcategory },
                          { label: "Descrição", value: a.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                            isSelected ? "bg-zinc-700/40 border border-green-700/30" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelection("advantages", { id: a.id, name: a.name, cost_points: a.cost_points }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{a.name || "Sem nome"}</div>
                            {a.description ? <div className="text-xs text-zinc-500 truncate">{a.description}</div> : null}
                          </div>
                          <span className="text-xs font-mono text-green-500 font-bold shrink-0">
                            {a.cost_points != null ? (a.cost_points >= 0 ? "+" : "") + a.cost_points : "±0"}
                          </span>
                        </label>
                      </InfoTooltip>
                    );
                  };
                  if (available.advantages.length === 0) return <p className="text-zinc-600 text-sm">Nenhuma vantagem registrada para esta mesa.</p>;
                  if (splitAdv) {
                    return (
                      <>
                        {selRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{selRows.length} selecionadas</div>
                            {selRows.map(renderAdv)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{unselRows.length} não selecionadas</div>
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

            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <h2 className="text-lg font-semibold text-green-100">Desvantagens</h2>
                  <span className="text-sm text-zinc-500">{selDis.length} selecionadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <SplitToggle active={splitDis} onToggle={() => setSplitDis((v) => !v)} />
                  <button
                    type="button"
                    onClick={() => setSearchFor("disadvantages")}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                    </svg>
                    Buscar
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
                          { label: "Custo", value: d.cost_points != null ? `-${d.cost_points}` : undefined },
                          { label: "Categoria", value: d.category },
                          { label: "Subcategoria", value: d.subcategory },
                          { label: "Efeito", value: d.effect },
                          { label: "Descrição", value: d.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                            isSelected ? "bg-zinc-700/40 border border-green-700/30" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelection("disadvantages", { id: d.id, name: d.name, cost_points: d.cost_points }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{d.name || "Sem nome"}</div>
                            {d.description ? <div className="text-xs text-zinc-500 truncate">{d.description}</div> : null}
                          </div>
                          <span className="text-xs font-mono text-green-500 font-bold shrink-0">
                            {d.cost_points != null ? (d.cost_points > 0 ? `-${d.cost_points}` : String(d.cost_points)) : "±0"}
                          </span>
                        </label>
                      </InfoTooltip>
                    );
                  };
                  if (available.disadvantages.length === 0) return <p className="text-zinc-600 text-sm">Nenhuma desvantagem registrada para esta mesa.</p>;
                  if (splitDis) {
                    return (
                      <>
                        {selRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{selRows.length} selecionadas</div>
                            {selRows.map(renderDis)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{unselRows.length} não selecionadas</div>
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

        <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-green-100">Manias</h2>
                  <span className="text-sm text-zinc-500">
                    {quirks.length} / {MAX_QUIRKS}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {quirks.map((q, index) => (
                  <div key={index} className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeQuirk(index)}
                        className="ml-auto text-zinc-500 hover:text-red-400 text-xs transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                    <div>
                      <label className={labelCls}>Nome</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={q.name}
                          onChange={(e) => updateQuirk(index, e.target.value)}
                          className={inputCls}
                          placeholder="ex: Coruja Noturna"
                        />
                        <span className="text-xs font-mono text-green-500 font-bold shrink-0">-1</span>
                      </div>
                    </div>
                  </div>
                ))}
                {quirks.length === 0 ? (
                  <p className="text-zinc-600 text-sm">Nenhuma mania adicionada ainda.</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={addQuirk}
                disabled={quirks.length >= MAX_QUIRKS}
                className="mt-4 w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                + Adicionar Mania
              </button>
            </section>

        <div className="border-t border-zinc-700/40 pt-6">
          <span className="text-sm text-zinc-500 mb-2 block">{selSkills.length} selecionadas</span>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-green-100">Perícias</h2>
            <SplitToggle active={splitSkills} onToggle={() => setSplitSkills((v) => !v)} />
            <button
              type="button"
              onClick={() => setSearchFor("skills")}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              Buscar
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Os pontos seguem a tabela de custo de perícia do GURPS por dificuldade. Ao selecionar uma perícia, mantém-se o nível padrão: a predefinição (atributo menos o valor predef, mostrado sob o nome) custa 0 pontos. Cada + sobe um nível rumo ao atributo e além; o − volta um nível. Os pontos são derivados automaticamente.
          </p>
          <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-x-2 p-2 pb-2 pr-2 text-xs font-medium text-zinc-500 border-b border-zinc-700/40 mb-1">
              <div className="w-4 shrink-0" />
              <div className="flex-1 min-w-0" style={{maxWidth: "Calc(100% - 240px)"}}>Perícia</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-6 shrink-0" />
                  <span className="w-20 text-center">Nível da Perícia</span>
                  <div className="w-6 shrink-0" />
                </div>
                <span className="w-10 text-center">Pts</span>
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
                        { label: "Tipo", value: [sk.predefinition_type, sk.predefinition_difficulty].filter(Boolean).join(" · ") },
                        { label: "Padrão", value: skillPredefLabel(sk) },
                        { label: "Categoria", value: sk.category },
                        { label: "Subcategoria", value: sk.subcategory },
                        { label: "Efeito", value: sk.effect },
                        { label: "Descrição", value: sk.description },
                        {
                          label: "Predefinição",
                          value:
                            sk.predefinition
                              ?.map((p) => [p.skill, p.depends_on_skill_for_others_attributes ?? p.value].filter(Boolean).join(" "))
                              .filter(Boolean)
                              .join(", ") || undefined,
                        },
                        {
                          label: "Dependências",
                          value:
                            sk.dependencies
                              ?.map((d) => [d.skill, d.value].filter(Boolean).join(" "))
                              .filter(Boolean)
                              .join(", ") || undefined,
                        },
                      ]}
                    >
                      <div
                        className={`flex flex-wrap items-center gap-x-2 gap-y-1 p-2 rounded-lg hover:bg-zinc-700/30 ${
                          sel ? "bg-zinc-700/40 border border-green-700/30" : "border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel}
                          onChange={(e) => toggleSkill({ id: sk.id, name: sk.name }, e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-200 truncate">{sk.name || "Sem nome"}</div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            {SKILL_TYPE_META[type] ? (
                              <svg className={`w-3.5 h-3.5 ${SKILL_TYPE_META[type].color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={SKILL_TYPE_META[type].svg} />
                              </svg>
                            ) : null}
                            <span>
                              {sk.predefinition_type === "Physical" ? "Física" : sk.predefinition_type === "Mental" ? "Mental" : sk.predefinition_type || "Perícia"}
                              {sk.predefinition_difficulty
                                ? ` · ${
                                    sk.predefinition_difficulty === "Easy"
                                      ? "Fácil"
                                      : sk.predefinition_difficulty === "Medium"
                                        ? "Média"
                                        : sk.predefinition_difficulty === "Hard"
                                          ? "Difícil"
                                          : sk.predefinition_difficulty === "Very Hard"
                                            ? "Muito difícil"
                                            : sk.predefinition_difficulty
                                  }`
                                : ""}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {skillPredefLabel(sk) ? `Padrão: ${skillPredefLabel(sk)}` : "Padrão: nenhum"}
                          </div>
                          {sk.description ? <div className="text-xs text-zinc-500 truncate">{sk.description}</div> : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjSkill(sk.id, -1)}
                              className="w-6 h-6 shrink-0 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-bold flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-xs font-mono text-green-500 font-bold text-center whitespace-nowrap w-20">
                              {sel ? `${rel} (${abs})` : "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjSkill(sk.id, 1)}
                              className="w-6 h-6 shrink-0 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-bold flex items-center justify-center"
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
                if (available.skills.length === 0) return <p className="text-zinc-600 text-sm">Nenhuma perícia registrada para esta mesa.</p>;
                if (splitSkills) {
                  return (
                    <>
                      {selRows.length > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{selRows.length} selecionadas</div>
                          {selRows.map(renderSkill)}
                        </>
                      ) : null}
                      {unselRows.length > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{unselRows.length} não selecionadas</div>
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
        </>
        )}

        {activeTab === "items" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">Defesa &amp; Velocidade</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: "Esquiva", value: String(Math.floor(basicSpeed + 3)), color: "text-cyan-400", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                  { label: "HP", value: String(attrs.ht), color: "text-red-400", d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
                  { label: "FP", value: String(initial?.character?.sheet?.fatigue ?? 10), color: "text-green-500", d: "M13 10V3L4 14h7v7l9-11h-7z" },
                  { label: "Deslocamento Básico", value: basicSpeed.toFixed(2), suffix: "km/h", color: "text-emerald-400", d: "M13 5l7 7-7 7M5 5l7 7-7 7" },
                  { label: "Deslocamento", value: String(move), color: "text-blue-400", d: "M5 12h14M12 5l7 7-7 7" },
                  { label: "Carga", value: ENCUMBRANCE_LABELS[encumbranceValue], sub: `${itemsWeight.toFixed(1)} lb`, color: "text-purple-400", d: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
                ] as Array<{ label: string; value: string; suffix?: string; color: string; d: string }>).map(({ label, value, suffix, color, d }) => (
                  <div key={label} className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[80px]">
                    <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
                    </svg>
                    <span className={`${color} text-sm font-bold`}>{value}{suffix ? <span className="font-light text-xs ml-0.5">{suffix}</span> : null}</span>
                    <span className="text-zinc-500 text-xs font-semibold uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const armorItems = selItems.filter((s) => isArmorish(available.items.find((i) => i.id === s.id)));
              const armors = armorItems.map((s) => {
                const item = available.items.find((i) => i.id === s.id);
                const eq = equipped[s.id];
                return { id: s.id, name: s.name, fit: eq?.location, value: item?.armor?.dr != null ? `DR ${item.armor.dr}` : undefined };
              });
              return (
                <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">Corpo</h3>
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
                                  className="absolute flex flex-col items-center justify-center p-1 rounded border border-cyan-400/60"
                                  style={{ ...style, width: 52, height: 44 }}
                                >
                                  <span className="text-zinc-400 uppercase" style={{ fontSize: 7, lineHeight: 1, letterSpacing: 0.3 }}>{label}</span>
                                  <span className="text-cyan-400 font-bold text-sm leading-none mt-0.5">{dr}</span>
                                </div>
                              );
                              return (
                                <>
                                  {badge("cabeça", head, { top: -54, left: "50%", transform: "translateX(-50%)" })}
                                  {badge("b.dir", armR, { top: -32, right: -50 })}
                                  {badge("b.esq", armL, { top: -32, left: -50 })}
                                  {badge("torso", torso, { top: 23, width: 50, left: -45, height: 50 })}
                                  {badge("p.dir", legR, { top: 85, right: -50 })}
                                  {badge("p.esq", legL, { top: 85, left: -50 })}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-1 mt-4 border-t border-zinc-700/40 pt-4">
                    {armors.map((a) => (
                      <div key={a.id} className="flex justify-between text-xs">
                        <span className="text-zinc-300">{a.name}</span>
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
            <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5 mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Equipar</h3>
              <div className="space-y-3">
                {selItems.filter((s) => isArmorish(available.items.find((i) => i.id === s.id))).map((s) => {
                  const item = available.items.find((i) => i.id === s.id);
                  const eq = equipped[s.id];
                  return (
                    <div key={s.id} className="bg-zinc-900/50 rounded-lg border border-zinc-700/50 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span className="text-sm font-medium text-zinc-200 flex-1 truncate">{s.name}</span>
                        {item?.weight_lb != null ? <span className="text-[10px] text-zinc-500">{item.weight_lb} lb</span> : null}
                        {item?.armor?.dr != null ? <span className="text-[10px] text-cyan-400">DR {item.armor.dr}</span> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Estado</label>
                          <select
                            value={eq?.status ?? ""}
                            onChange={(e) => setEquipped((prev) => ({ ...prev, [s.id]: { ...prev[s.id], status: e.target.value || undefined } }))}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200"
                          >
                            <option value="">—</option>
                            <option value="equipped">Equipado</option>
                            <option value="wielded">Empunhado</option>
                            <option value="in_inventory">Na mochila</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Local</label>
                          <select
                            value={eq?.location ?? ""}
                            onChange={(e) => setEquipped((prev) => ({ ...prev, [s.id]: { ...prev[s.id], location: e.target.value || undefined } }))}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200"
                          >
                            <option value="">Nenhum</option>
                            {BODY_LOCATIONS.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {eq?.status === "equipped" || eq?.status === "wielded" ? (
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-[10px] text-emerald-400">{eq.status === "wielded" ? "Empunhado" : "Equipado"}{eq.location ? ` — ${eq.location}` : ""}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="border-t border-zinc-700/40 pt-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-green-100">Itens</h2>
                <SplitToggle active={splitItems} onToggle={() => setSplitItems((v) => !v)} />
                <button
                  type="button"
                  onClick={() => setSearchFor("items")}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                  </svg>
                  Buscar
                </button>
              </div>
              <span className="text-sm text-zinc-500">{selItems.length} selecionados</span>
            </div>
            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto scroll-thin pr-2">
                {(() => {
                  const renderItem = (item: Item) => {
                    const isSelected = selItems.some((s) => s.id === item.id);
                    return (
                      <InfoTooltip
                        key={item.id}
                        rows={[
                          { label: "Categoria", value: item.category },
                          { label: "Tipo", value: item.kind },
                          { label: "Peso", value: item.weight_lb != null ? `${item.weight_lb} lb` : undefined },
                          { label: "Qualidade", value: item.quality },
                          { label: "Condição", value: item.condition },
                          { label: "Descrição", value: item.description },
                        ]}
                      >
                        <label
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                            isSelected ? "bg-zinc-700/40 border border-green-700/30" : "border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleItem({ id: item.id, name: item.name }, e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 text-white0 focus:ring-green-800 bg-zinc-900"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{item.name || "Sem nome"}</div>
                            <div className="text-xs text-zinc-500 truncate">
                              {[item.category, item.quality, item.condition].filter(Boolean).join(" · ") || ""}
                              {item.weight_lb != null ? ` · ${item.weight_lb} lb` : ""}
                            </div>
                            {item.description ? <div className="text-xs text-zinc-500 truncate">{item.description}</div> : null}
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
                            <div className="col-span-full text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-1">{selRows.length} selecionados</div>
                            {selRows.map(renderItem)}
                          </>
                        ) : null}
                        {unselRows.length > 0 ? (
                          <>
                            <div className="col-span-full text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3">{unselRows.length} não selecionados</div>
                            {unselRows.map(renderItem)}
                          </>
                        ) : null}
                      </>
                    );
                  }
                  return available.items.map(renderItem);
                })()}
                {available.items.length === 0 ? (
                  <p className="col-span-full text-zinc-600 text-sm">Nenhum item registrado para esta mesa.</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <label className={labelCls}>
                Carga — {ENCUMBRANCE_LABELS[encumbranceValue]} ({itemsWeight.toFixed(1)} lb carregadas)
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
                      active ? "bg-green-700/20 text-green-300" : "bg-zinc-700/30 text-zinc-500"
                    }`}
                  >
                    {label}
                    <div className="text-[10px] text-zinc-500">{i === 0 ? "0" : `>${threshold} lb`}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!isEdit ? (
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : "Criar Personagem"}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/characters` : "/narrator"} className="text-zinc-400 hover:text-zinc-300 text-sm transition-colors">
              Cancelar
            </a>
          </div>
        ) : null}
      </form>

      {searchFor ? (
        <SearchModal
          title={
            searchFor === "advantages"
              ? "Buscar Vantagens"
              : searchFor === "disadvantages"
                ? "Buscar Desvantagens"
                : searchFor === "skills"
                  ? "Buscar Perícias"
                  : "Buscar Itens"
          }
          onSearch={doSearch}
          filters={
            searchFor === "skills"
              ? [
                  {
                    key: "type",
                    label: "Tipo",
                    options: [
                      { value: "Physical", label: "Física" },
                      { value: "Mental", label: "Mental" },
                    ],
                  },
                  {
                    key: "difficulty",
                    label: "Dificuldade",
                    options: [["Easy", "Fácil"], ["Medium", "Média"], ["Hard", "Difícil"], ["Very Hard", "Muito difícil"]].map(([value, label]) => ({ value, label })),
                  },
                ]
              : searchFor === "items"
                ? [
                    {
                      key: "category",
                      label: "Categoria",
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
                      label: "Tipo",
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
                      label: "Categoria",
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
