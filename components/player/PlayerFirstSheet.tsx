"use client";

/* ============================================================
   PlayerFirstSheet — primeira ficha do jogador.
   Rota /player/table/[id]/character/new. Usa o orçamento de
   pontos gravado nas regras da mesa (starting_points) e envia
   respect_budget para o servidor garantir o limite.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import SearchModal, { type SearchModalItem } from "@/components/forms/SearchModal";
import { readSeat } from "@/lib/seat";
import { useTranslation } from "@/lib/i18n";
import type {
  Advantage,
  Disadvantage,
  GameTableAdvantages,
  GameTableDisadvantages,
  GameTableItems,
  GameTableSkills,
  Item,
  SkillItem,
  TableSettings,
} from "@/lib/types";

/* ------------------------------------------------------------
   Paleta (mesa à noite) — mesma identidade do wizard.
   ------------------------------------------------------------ */

const COLORS = {
  ink: "#0E110D",
  tabletone: "#182018",
  parchment: "#EDE6CE",
  ember: "#E07B3A",
  brass: "#A9A177",
  moss: "#7E876A",
};

const mono = "font-mono uppercase tracking-[0.14em] text-[11px]";

/* ------------------------------------------------------------
   Custos de atributo/perícia (GURPS) — mesmas tabelas da ficha.
   ------------------------------------------------------------ */

const ATTR_COSTS: Record<"st" | "dx" | "iq" | "ht", number> = { st: 10, dx: 20, iq: 20, ht: 10 };

type SkillType = "Physical" | "Mental";
type SkillDifficulty = "Easy" | "Medium" | "Hard" | "Very Hard";

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

function skillPredefMods(sk?: SkillItem): number[] {
  return (sk?.predefinition ?? [])
    .map((p) => p.depends_on_skill_for_others_attributes)
    .filter((f): f is string => !!f)
    .map((formula) => {
      const m = formula.trim().toLowerCase().match(/^([a-z]+)\s*([+-])\s*(\d+)$/);
      if (!m) return null;
      return (m[2] === "-" ? -1 : 1) * Number(m[3]);
    })
    .filter((v): v is number => v !== null);
}

function formatPoints(points: number): string {
  return points % 1 === 0 ? String(points) : points.toFixed(1);
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

interface PlayerFirstSheetProps {
  tableId: string;
  tableTitle?: string;
  initialSettings: TableSettings | null;
  users: UserOption[];
}

const DOMAINS_LABEL: Record<string, string> = {
  advantages: "p.adv",
  disadvantages: "p.dis",
  skills: "p.skills",
  items: "p.items",
};

export default function PlayerFirstSheet({ tableId, tableTitle, initialSettings, users }: PlayerFirstSheetProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const budget = Math.max(0, initialSettings?.starting_points ?? 150);
  const players = useMemo(() => users.filter((u) => u.type !== 2), [users]);

  const [who, setWho] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const s = readSeat();
    return s.userId && players.some((p) => p.id === s.userId) ? s.userId : "";
  });
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [backstory, setBackstory] = useState("");
  const [attrs, setAttrs] = useState<Record<"st" | "dx" | "iq" | "ht", number>>({ st: 10, dx: 10, iq: 10, ht: 10 });
  const [quirks, setQuirks] = useState<string[]>([]);
  const [selAdv, setSelAdv] = useState<Selection[]>([]);
  const [selDis, setSelDis] = useState<Selection[]>([]);
  const [selSkills, setSelSkills] = useState<Selection[]>([]);
  const [selItems, setSelItems] = useState<Selection[]>([]);
  const [searchFor, setSearchFor] = useState<null | "advantages" | "disadvantages" | "skills" | "items">(null);
  const [available, setAvailable] = useState<{
    advantages: Advantage[];
    disadvantages: Disadvantage[];
    skills: SkillItem[];
    items: Item[];
  }>({ advantages: [], disadvantages: [], skills: [], items: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [adv, dis, sk, items] = await Promise.all([
          api<GameTableAdvantages>(`/game-table-advantages/${tableId}`),
          api<GameTableDisadvantages>(`/game-table-disadvantages/${tableId}`),
          api<GameTableSkills>(`/game-table-skills/${tableId}`),
          api<GameTableItems>(`/game-table-items/${tableId}`),
        ]);
        if (!active) return;
        setAvailable({
          advantages: adv?.advantages ?? [],
          disadvantages: dis?.disadvantages ?? [],
          skills: sk?.skills ?? [],
          items: items?.items ?? [],
        });
      } catch {
        /* a ficha funciona mesmo sem catálogo */
      }
    })();
    return () => {
      active = false;
    };
  }, [tableId]);

  const peculiarities = quirks.filter((q) => q.trim() !== "").map((q) => ({ name: q.trim(), cost_points: -1, effect: "" }));

  const spent = useMemo(() => {
    const attrCost = Object.entries(attrs).reduce((s, [k, v]) => s + (v - 10) * ATTR_COSTS[k as keyof typeof ATTR_COSTS], 0);
    const advCost = selAdv.reduce((s, a) => s + (a.cost_points || 0), 0);
    const disCost = selDis.reduce((s, d) => s + (d.cost_points || 0), 0);
    const skCost = selSkills.reduce((s, sk) => s + (sk.cost_points || 0), 0);
    return attrCost + advCost - disCost + skCost - peculiarities.length;
  }, [attrs, selAdv, selDis, selSkills, peculiarities]);

  const over = spent > budget;
  const remaining = budget - spent;

  function adjAttr(key: "st" | "dx" | "iq" | "ht", delta: number) {
    if (delta > 0 && spent + ATTR_COSTS[key] > budget) return;
    const next = attrs[key] + delta;
    if (next < 1 || next > 50) return;
    setAttrs((prev) => ({ ...prev, [key]: next }));
  }

  function toggleSelection(type: "advantages" | "disadvantages", item: { id: string; name: string; cost_points?: number }, checked: boolean) {
    const apply = (prev: Selection[]): Selection[] =>
      checked
        ? prev.some((s) => s.id === item.id)
          ? prev
          : [...prev, { id: item.id, name: item.name, cost_points: item.cost_points ?? 0 }]
        : prev.filter((s) => s.id !== item.id);
    if (type === "advantages") setSelAdv(apply);
    else setSelDis(apply);
  }

  function toggleSkill(item: { id: string; name: string }, checked: boolean) {
    if (checked) {
      const sk = available.skills.find((s) => s.id === item.id);
      const mods = skillPredefMods(sk);
      const level = mods.length > 0 ? mods[0] : 0;
      setSelSkills((prev) =>
        prev.some((s) => s.id === item.id)
          ? prev
          : [...prev, { id: item.id, name: item.name, cost_points: mods.length > 0 ? 0 : skillCostFor(sk ?? {}, level), level }]
      );
    } else {
      setSelSkills((prev) => prev.filter((s) => s.id !== item.id));
    }
  }

  function adjSkill(id: string, delta: number) {
    const sk = available.skills.find((s) => s.id === id);
    const diff = skillDifficultyOf(sk ?? {});
    const mods = skillPredefMods(sk);
    const floor = mods.length > 0 ? Math.min(mods[0], MIN_LEVEL[diff]) : MIN_LEVEL[diff];
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
    setSelItems((prev) =>
      checked
        ? prev.some((s) => s.id === item.id)
          ? prev
          : [...prev, { id: item.id, name: item.name, cost_points: 0 }]
        : prev.filter((s) => s.id !== item.id)
    );
  }

  const doSearch = useCallback(
    async (query: string, filters: Record<string, string>): Promise<SearchModalItem[]> => {
      if (!searchFor) return [];
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const qs = params.toString();
      const path = `/game-table-${searchFor}/${tableId}${qs ? `?${qs}` : ""}`;
      if (searchFor === "advantages") {
        const data = await api<GameTableAdvantages>(path);
        return (data?.advantages ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          meta: [a.category, a.subcategory].filter(Boolean).join(" · ") || undefined,
          description: a.description,
        }));
      }
      if (searchFor === "disadvantages") {
        const data = await api<GameTableDisadvantages>(path);
        return (data?.disadvantages ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          meta: [d.category, d.subcategory].filter(Boolean).join(" · ") || undefined,
          description: d.description,
        }));
      }
      if (searchFor === "skills") {
        const data = await api<GameTableSkills>(path);
        return (data?.skills ?? []).map((sk) => ({
          id: sk.id,
          name: sk.name,
          meta: `${sk.predefinition_type || ""}${sk.predefinition_difficulty ? ` · ${sk.predefinition_difficulty}` : ""}`,
          description: sk.description,
        }));
      }
      const data = await api<GameTableItems>(path);
      return (data?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        meta: [item.category, item.kind, item.weight_lb != null ? `${item.weight_lb} lb` : null].filter(Boolean).join(" · ") || undefined,
        description: item.description,
      }));
    },
    [searchFor, tableId]
  );

  function selectedSet(list: Selection[]) {
    return new Set(list.map((s) => s.id));
  }

  async function doSave() {
    setSaving(true);
    setError(null);
    if (!who) {
      setError(t("p.whoEmpty"));
      setSaving(false);
      return;
    }
    if (over) {
      setError(t("p.over"));
      setSaving(false);
      return;
    }
    try {
      const sheet = {
        name: name.trim(),
        bio,
        backstory,
        points: spent,
        hp: attrs.ht,
        st: attrs.st,
        dx: attrs.dx,
        iq: attrs.iq,
        ht: attrs.ht,
        fatigue: 10,
        encumbrance: "None",
      };
      const result = await submitJson<{ character_id: string }>("/api/game-table-character", "POST", {
        table_id: tableId,
        user_id: who,
        sheet,
        advantages: selAdv.map((a) => ({ advantage_id: a.id, name: a.name, cost_points: a.cost_points, effect: "" })),
        disadvantages: selDis.map((d) => ({ disadvantage_id: d.id, name: d.name, cost_points: d.cost_points, effect: "" })),
        skills: selSkills.map((s) => ({ skill_id: s.id, cost_points: s.cost_points, effect: "" })),
        equipment: selItems.map((i) => ({ item_id: i.id, quantity: 1, status: "in_inventory", location: "none" })),
        peculiarities,
        respect_budget: true,
      });
      router.push(`/player/character/${result.character_id}/session`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const pct = budget > 0 ? Math.max(0, Math.min(100, (spent / budget) * 100)) : 0;

  const rulesTags: string[] = [
    initialSettings?.turn_end_mode === "after_move" ? t("p.ruleMove") : t("p.ruleTurn"),
    initialSettings?.item_mode === "points" ? t("p.ruleItemsPoints") : t("p.ruleItemsGm"),
  ];

  return (
    <div className="min-h-[80vh]" style={{ background: `radial-gradient(1100px 500px at 20% -10%, #18201866, transparent 60%), ${COLORS.ink}` }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* ---- breadcrumb ---- */}
        <a
          href="/player"
          className="inline-flex items-center gap-1.5 text-sm text-[#A9A177] hover:text-[#EDE6CE] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07B3A]/70"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t("p.breadcrumb")}
        </a>

        <header className="mt-8 border-l-2 pl-5" style={{ borderColor: COLORS.ember }}>
          <p className={mono} style={{ color: COLORS.ember }}>
            {t("p.eyebrow")} {tableTitle ? `— ${tableTitle}` : ""}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight" style={{ color: COLORS.parchment }}>
            {t("p.title")}
          </h1>
          <p className="mt-2 text-sm text-[#7E876A] max-w-xl">{t("p.subtitle")}</p>
        </header>

        {/* ---- orçamento + regras ---- */}
        <div className="mt-6 rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={mono} style={{ color: COLORS.moss }}>
                  {t("p.budgetTitle")}
                </span>
                <span
                  className={`font-mono tabular-nums text-sm font-bold ${over ? "text-red-400" : "text-[#E07B3A]"}`}
                >
                  {formatPoints(spent)} / {formatPoints(budget)} · {Math.max(0, remaining)} {t("p.remaining")}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#0E110D] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: over ? "#f87171" : COLORS.ember,
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {rulesTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#A9A177]/30 text-[#A9A177]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {/* ---- quem você é ---- */}
          <div className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
            <label className={mono} style={{ color: COLORS.moss }}>
              {t("p.who")}
            </label>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value)}
              required
              className="mt-1.5 w-full bg-transparent border-b border-[#A9A177]/40 text-base text-[#EDE6CE] py-2.5 focus:outline-none focus:border-[#E07B3A] transition-colors"
            >
              <option value="" disabled className="bg-[#182018]">
                {t("p.whoPh")}
              </option>
              {players.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#182018]">
                  {u.username || u.email || u.id}
                </option>
              ))}
            </select>
            {players.length === 0 ? (
              <p className="mt-1 text-xs" style={{ color: COLORS.moss }}>
                {t("p.whoEmpty")}
              </p>
            ) : null}
          </div>

          {/* ---- identidade ---- */}
          <div className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
            <h2 className={mono} style={{ color: COLORS.ember }}>
              {t("p.eyebrow")} — {t("p.name")}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4">
              <div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t("p.name")}
                  className="w-full bg-transparent border-b border-[#A9A177]/40 text-base text-[#EDE6CE] py-2 placeholder:text-[#7E876A]/60 focus:outline-none focus:border-[#E07B3A] transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={mono} style={{ color: COLORS.moss }}>
                    {t("p.bio")}
                  </label>
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-1 w-full bg-transparent border-b border-[#A9A177]/40 text-sm text-[#EDE6CE] py-2 placeholder:text-[#7E876A]/60 focus:outline-none focus:border-[#E07B3A] transition-colors"
                  />
                </div>
                <div>
                  <label className={mono} style={{ color: COLORS.moss }}>
                    {t("p.backstory")}
                  </label>
                  <input
                    value={backstory}
                    onChange={(e) => setBackstory(e.target.value)}
                    className="mt-1 w-full bg-transparent border-b border-[#A9A177]/40 text-sm text-[#EDE6CE] py-2 placeholder:text-[#7E876A]/60 focus:outline-none focus:border-[#E07B3A] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ---- atributos ---- */}
          <div className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
            <h2 className={mono} style={{ color: COLORS.ember }}>
              {t("p.attrs")}
            </h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(ATTR_COSTS) as Array<"st" | "dx" | "iq" | "ht">).map((key) => (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <span className={mono} style={{ color: COLORS.moss }}>
                    {key.toUpperCase()} ×{ATTR_COSTS[key]}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjAttr(key, -1)}
                      className="w-8 h-8 rounded-lg border border-[#A9A177]/30 text-[#A9A177] hover:border-[#A9A177] text-lg font-bold leading-none transition-colors"
                    >
                      −
                    </button>
                    <span className="w-9 text-center text-xl font-bold tabular-nums" style={{ color: COLORS.ember }}>
                      {attrs[key]}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjAttr(key, 1)}
                      className="w-8 h-8 rounded-lg border border-[#A9A177]/30 text-[#A9A177] hover:border-[#A9A177] text-lg font-bold leading-none transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- vantagens / desvantagens / perícias ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(["advantages", "disadvantages", "skills", "items"] as const).map((kind) => {
              if (kind === "advantages") {
                return (
                  <section key={kind} className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={mono} style={{ color: COLORS.ember }}>
                        {t(DOMAINS_LABEL[kind])} · <span style={{ color: COLORS.parchment }}>{selAdv.length}</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setSearchFor("advantages")}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E07B3A]/60 text-[#E07B3A] hover:bg-[#E07B3A]/10 transition-colors"
                      >
                        + {t("p.add")}
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {selAdv.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-[#EDE6CE]">{s.name}</span>
                          <span className="font-mono tabular-nums text-xs shrink-0" style={{ color: COLORS.brass }}>
                            +{s.cost_points}
                          </span>
                        </li>
                      ))}
                      {selAdv.length === 0 ? (
                        <li className="text-xs text-[#7E876A]/70 italic">{t("p.add")}…</li>
                      ) : null}
                    </ul>
                  </section>
                );
              }
              if (kind === "disadvantages") {
                return (
                  <section key={kind} className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={mono} style={{ color: COLORS.ember }}>
                        {t(DOMAINS_LABEL[kind])} · <span style={{ color: COLORS.parchment }}>{selDis.length}</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setSearchFor("disadvantages")}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E07B3A]/60 text-[#E07B3A] hover:bg-[#E07B3A]/10 transition-colors"
                      >
                        + {t("p.add")}
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {selDis.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-[#EDE6CE]">{s.name}</span>
                          <span className="font-mono tabular-nums text-xs shrink-0" style={{ color: COLORS.brass }}>
                            −{s.cost_points}
                          </span>
                        </li>
                      ))}
                      {selDis.length === 0 ? (
                        <li className="text-xs text-[#7E876A]/70 italic">{t("p.add")}…</li>
                      ) : null}
                    </ul>
                  </section>
                );
              }
              if (kind === "skills") {
                return (
                  <section key={kind} className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={mono} style={{ color: COLORS.ember }}>
                        {t(DOMAINS_LABEL[kind])} · <span style={{ color: COLORS.parchment }}>{selSkills.length}</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setSearchFor("skills")}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E07B3A]/60 text-[#E07B3A] hover:bg-[#E07B3A]/10 transition-colors"
                      >
                        + {t("p.add")}
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {selSkills.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-[#EDE6CE]">{s.name}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => adjSkill(s.id, -1)}
                              className="w-6 h-6 rounded border border-[#A9A177]/30 text-[#A9A177] text-xs leading-none"
                            >
                              −
                            </button>
                            <span className="font-mono tabular-nums text-xs w-4 text-center" style={{ color: COLORS.brass }}>
                              {formatPoints(s.cost_points)}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjSkill(s.id, 1)}
                              className="w-6 h-6 rounded border border-[#A9A177]/30 text-[#A9A177] text-xs leading-none"
                            >
                              +
                            </button>
                          </span>
                        </li>
                      ))}
                      {selSkills.length === 0 ? (
                        <li className="text-xs text-[#7E876A]/70 italic">{t("p.add")}…</li>
                      ) : null}
                    </ul>
                  </section>
                );
              }
              return (
                <section key={kind} className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={mono} style={{ color: COLORS.ember }}>
                      {t(DOMAINS_LABEL[kind])} · <span style={{ color: COLORS.parchment }}>{selItems.length}</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSearchFor("items")}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E07B3A]/60 text-[#E07B3A] hover:bg-[#E07B3A]/10 transition-colors"
                    >
                      + {t("p.add")}
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {selItems.map((s) => (
                      <li key={s.id} className="text-sm truncate text-[#EDE6CE]">
                        {s.name}
                      </li>
                    ))}
                    {selItems.length === 0 ? (
                      <li className="text-xs text-[#7E876A]/70 italic">{t("p.add")}…</li>
                    ) : null}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* ---- manias ---- */}
          <div className="rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className={mono} style={{ color: COLORS.ember }}>
                {t("p.quirks")}
              </h2>
              <button
                type="button"
                onClick={() => setQuirks((prev) => (prev.length >= 5 ? prev : [...prev, ""]))}
                disabled={quirks.length >= 5}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E07B3A]/60 text-[#E07B3A] hover:bg-[#E07B3A]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + {t("p.add")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {quirks.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQuirks((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="flex-1 bg-transparent border-b border-[#A9A177]/40 text-sm text-[#EDE6CE] py-1.5 placeholder:text-[#7E876A]/60 focus:outline-none focus:border-[#E07B3A] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setQuirks((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-[#7E876A] hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {quirks.length === 0 ? (
                <p className="text-xs text-[#7E876A]/70 italic">−1 pt cada</p>
              ) : null}
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <footer className="flex items-center justify-between gap-3 pt-2">
            <a href="/player" className="text-sm text-[#A9A177] hover:text-[#EDE6CE] transition-colors">
              ← {t("p.breadcrumb")}
            </a>
            <button
              type="button"
              onClick={() => void doSave()}
              disabled={saving || over || !name.trim() || !who}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-[#0E110D] bg-[#E07B3A] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07B3A]/70"
            >
              {saving ? t("p.saving") : t("p.save")}
            </button>
          </footer>
        </div>
      </div>

      {searchFor ? (
        <SearchModal
          title={t(DOMAINS_LABEL[searchFor])}
          onSearch={doSearch}
          isSelected={(id) => {
            if (searchFor === "advantages") return selectedSet(selAdv).has(id);
            if (searchFor === "disadvantages") return selectedSet(selDis).has(id);
            if (searchFor === "skills") return selectedSet(selSkills).has(id);
            return selectedSet(selItems).has(id);
          }}
          onToggle={(id, checked) => {
            if (searchFor === "advantages") {
              const it = available.advantages.find((a) => a.id === id);
              if (it) toggleSelection("advantages", { id, name: it.name, cost_points: it.cost_points }, checked);
            } else if (searchFor === "disadvantages") {
              const it = available.disadvantages.find((d) => d.id === id);
              if (it) toggleSelection("disadvantages", { id, name: it.name, cost_points: it.cost_points }, checked);
            } else if (searchFor === "skills") {
              const it = available.skills.find((s) => s.id === id);
              if (it) toggleSkill({ id, name: it.name }, checked);
            } else {
              const it = available.items.find((i) => i.id === id);
              if (it) toggleItem({ id, name: it.name }, checked);
            }
          }}
          onClose={() => setSearchFor(null)}
        />
      ) : null}
    </div>
  );
}