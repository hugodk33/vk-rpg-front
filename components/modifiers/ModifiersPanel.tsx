"use client";

/* ============================================================
   ModifiersPanel — narrator control for character modifiers.

   Each modifier carries the story coordinates it belongs to:
   a chapter, a scene and a narration (all optional — a modifier
   without coordinates is persistent). The GM can also push stat
   overrides (set) or deltas (mod) onto the target character.

   The base sheet is never rewritten: progression lives in these
   modifier rows, resolved by the rules engine when the sheet is
   read. Changes persist to POST/PUT /game-table-modifier.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { interpolate, useTranslation } from "@/lib/i18n";
import type {
  GameTableModifiers,
  GameTableScenes,
  GameTableSkills,
  Location,
  Modifier,
  SkillItem,
  TableCharacter,
} from "@/lib/types";

const charName = (c: TableCharacter, t: (key: string) => string) =>
  c.sheet?.name || c.name || t("vs.common.noName");
const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const txt = (v: string): string | undefined =>
  v.trim() === "" ? undefined : v.trim();

/* ---------- form fields ---------- */

interface FieldDef {
  key: string;
  label?: string;
  labelKey?: string;
  numeric?: boolean;
}

const fieldLabel = (f: FieldDef, t: (key: string) => string) =>
  f.labelKey ? t(f.labelKey) : (f.label ?? "");

const SET_FIELDS: FieldDef[] = [
  { key: "hp", label: "HP", numeric: true },
  { key: "st", label: "ST", numeric: true },
  { key: "dx", label: "DX", numeric: true },
  { key: "iq", label: "IQ", numeric: true },
  { key: "ht", label: "HT", numeric: true },
  { key: "fatigue", label: "FP", numeric: true },
  { key: "encumbrance", labelKey: "vs.mp.f.encumbrance" },
];

const DELTA_FIELDS: FieldDef[] = [
  { key: "mod_hp", label: "Δ HP", numeric: true },
  { key: "mod_st", label: "Δ ST", numeric: true },
  { key: "mod_dx", label: "Δ DX", numeric: true },
  { key: "mod_iq", label: "Δ IQ", numeric: true },
  { key: "mod_ht", label: "Δ HT", numeric: true },
  { key: "mod_fatigue", label: "Δ FP", numeric: true },
  { key: "mod_encumbrance", labelKey: "vs.mp.f.dEncumbrance" },
];

const ITEM_FIELDS: FieldDef[] = [
  { key: "damage_value", labelKey: "vs.mp.f.damage" },
  { key: "skill_value", labelKey: "vs.mp.f.skillValue" },
  { key: "armor_value", labelKey: "vs.mp.f.armorValue" },
  { key: "advantage_value", labelKey: "vs.mp.f.advantageValue" },
  { key: "disadvantage_value", labelKey: "vs.mp.f.disadvantageValue" },
  { key: "item_quantity", labelKey: "vs.mp.f.itemQuantity", numeric: true },
  { key: "item_weight", labelKey: "vs.mp.f.itemWeight", numeric: true },
  { key: "item_dimension", labelKey: "vs.mp.f.itemDimension" },
  { key: "item_range", labelKey: "vs.mp.f.itemRange" },
  { key: "item_status", labelKey: "vs.mp.f.itemStatus" },
];

const effectChips = (m: Modifier, t: (key: string) => string): { label: string; value: string }[] => {
  const out: { label: string; value: string }[] = [];
  const deltas = [
    ["HP", m.mod_hp],
    ["ST", m.mod_st],
    ["DX", m.mod_dx],
    ["IQ", m.mod_iq],
    ["HT", m.mod_ht],
    ["FP", m.mod_fatigue],
  ] as const;
  for (const [label, v] of deltas) {
    if (v != null && v !== 0)
      out.push({ label, value: `${v > 0 ? "+" : ""}${v}` });
  }
  const sets = [
    ["HP", m.hp],
    ["ST", m.st],
    ["DX", m.dx],
    ["IQ", m.iq],
    ["HT", m.ht],
    ["FP", m.fatigue],
  ] as const;
  for (const [label, v] of sets) {
    if (v != null) out.push({ label, value: `=${v}` });
  }
  if (m.encumbrance) out.push({ label: t("vs.mp.c.enc"), value: m.encumbrance });
  if (m.mod_encumbrance) out.push({ label: t("vs.mp.c.enc"), value: m.mod_encumbrance });
  if (m.damage_value) out.push({ label: t("vs.mp.c.damage"), value: m.damage_value });
  if (m.skill_value) out.push({ label: t("vs.mp.c.skill"), value: m.skill_value });
  if (m.armor_value) out.push({ label: "DR", value: m.armor_value });
  if (m.advantage_value) out.push({ label: t("vs.mp.c.adv"), value: m.advantage_value });
  if (m.disadvantage_value) out.push({ label: t("vs.mp.c.dis"), value: m.disadvantage_value });
  if (m.item_quantity) out.push({ label: t("vs.mp.c.qty"), value: `=${m.item_quantity}` });
  if (m.item_weight != null) out.push({ label: t("vs.mp.c.weight"), value: `${m.item_weight} lb` });
  return out;
};

interface FormState {
  id?: string;
  character_id: string;
  chapter: string;
  scene_id: string;
  narration_id: string;
  action_id: string;
  name: string;
  description: string;
  effect: string;
  cost_points: string;
  hp: string;
  st: string;
  dx: string;
  iq: string;
  ht: string;
  fatigue: string;
  encumbrance: string;
  mod_hp: string;
  mod_st: string;
  mod_dx: string;
  mod_iq: string;
  mod_ht: string;
  mod_fatigue: string;
  mod_encumbrance: string;
  damage_value: string;
  skill_value: string;
  armor_value: string;
  advantage_value: string;
  disadvantage_value: string;
  item_quantity: string;
  item_weight: string;
  item_dimension: string;
  item_range: string;
  item_status: string;
  skill_id: string;
  apply_on_roll: number;
  location_id: string;
}

const emptyForm = (): FormState => ({
  id: undefined,
  character_id: "",
  chapter: "",
  scene_id: "",
  narration_id: "",
  action_id: "",
  name: "",
  description: "",
  effect: "",
  cost_points: "",
  hp: "",
  st: "",
  dx: "",
  iq: "",
  ht: "",
  fatigue: "",
  encumbrance: "",
  mod_hp: "",
  mod_st: "",
  mod_dx: "",
  mod_iq: "",
  mod_ht: "",
  mod_fatigue: "",
  mod_encumbrance: "",
  damage_value: "",
  skill_value: "",
  armor_value: "",
  advantage_value: "",
  disadvantage_value: "",
  item_quantity: "",
  item_weight: "",
  item_dimension: "",
  item_range: "",
  item_status: "",
  skill_id: "",
  apply_on_roll: 0,
  location_id: "",
});

const toForm = (m: Modifier, scenes: GameTableScenes | null): FormState => {
  const scene = (scenes?.scenes ?? []).find((s) => s.id === m.scene_id);
  const f = emptyForm();
  return {
    ...f,
    id: m.id,
    character_id: m.character_id ?? "",
    chapter: scene?.chapter != null ? String(scene.chapter) : "",
    scene_id: m.scene_id ?? "",
    narration_id: m.narration_id ?? "",
    action_id: m.action_id ?? "",
    name: m.name ?? "",
    description: m.description ?? "",
    effect: m.effect ?? "",
    cost_points: m.cost_points != null ? String(m.cost_points) : "",
    hp: m.hp != null ? String(m.hp) : "",
    st: m.st != null ? String(m.st) : "",
    dx: m.dx != null ? String(m.dx) : "",
    iq: m.iq != null ? String(m.iq) : "",
    ht: m.ht != null ? String(m.ht) : "",
    fatigue: m.fatigue != null ? String(m.fatigue) : "",
    encumbrance: m.encumbrance ?? "",
    mod_hp: m.mod_hp != null ? String(m.mod_hp) : "",
    mod_st: m.mod_st != null ? String(m.mod_st) : "",
    mod_dx: m.mod_dx != null ? String(m.mod_dx) : "",
    mod_iq: m.mod_iq != null ? String(m.mod_iq) : "",
    mod_ht: m.mod_ht != null ? String(m.mod_ht) : "",
    mod_fatigue: m.mod_fatigue != null ? String(m.mod_fatigue) : "",
    mod_encumbrance: m.mod_encumbrance ?? "",
    damage_value: m.damage_value ?? "",
    skill_value: m.skill_value ?? "",
    armor_value: m.armor_value ?? "",
    advantage_value: m.advantage_value ?? "",
    disadvantage_value: m.disadvantage_value ?? "",
    item_quantity: m.item_quantity != null ? String(m.item_quantity) : "",
    item_weight: m.item_weight != null ? String(m.item_weight) : "",
    item_dimension: m.item_dimension ?? "",
    item_range: m.item_range ?? "",
    item_status: m.item_status ?? "",
    skill_id: m.skill_id ?? "",
    apply_on_roll: m.apply_on_roll ? 1 : 0,
    location_id: m.location_id ?? "",
  };
};

/* ---------- panel ---------- */

interface ModifiersPanelProps {
  tableId: string;
  initialModifiers: Modifier[];
  characters: TableCharacter[];
  scenes: GameTableScenes | null;
  locations?: Location[];
  initialTab?: "list" | "form";
}

export default function ModifiersPanel({
  tableId,
  initialModifiers,
  characters,
  scenes,
  locations,
  initialTab = "list",
}: ModifiersPanelProps) {
  const { t } = useTranslation();
  const [modifiers, setModifiers] = useState<Modifier[]>(initialModifiers);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"list" | "form">(initialTab);

  const locationNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations ?? []) if (l.id) m.set(String(l.id), l.name);
    return m;
  }, [locations]);

  const locationNameOf = (id?: string | null) => {
    if (!id) return null;
    return locationNames.get(String(id)) || t("vs.common.noName");
  };

  const [skills, setSkills] = useState<SkillItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await api<GameTableSkills>(`/game-table-skills/${tableId}`).catch(
        () => ({ table: null, skills: [] })
      );
      if (!cancelled) setSkills(res.skills ?? []);
    };
    load();
    return () => { cancelled = true; };
  }, [tableId]);

  const chapters = useMemo(() => {
    const set = new Set<number>();
    for (const s of scenes?.scenes ?? []) {
      if (s.chapter != null) set.add(s.chapter);
    }
    return [...set].sort((a, b) => a - b);
  }, [scenes]);

  const visibleScenes = useMemo(
    () =>
      (scenes?.scenes ?? []).filter(
        (s) => form.chapter === "" || String(s.chapter) === form.chapter
      ),
    [scenes, form.chapter]
  );
  const visibleNarrations = useMemo(
    () =>
      visibleScenes.find((s) => s.id === form.scene_id)?.narrations ?? [],
    [visibleScenes, form.scene_id]
  );
  const visibleActions = useMemo(
    () =>
      visibleNarrations.find((n) => n.id === form.narration_id)?.actions ?? [],
    [visibleNarrations, form.narration_id]
  );

  const nameOf = (id?: string) =>
    characters.find((c) => c.id === id) ?? null;

  const sceneOf = (id?: string) =>
    (scenes?.scenes ?? []).find((s) => s.id === id) ?? null;

  const actionOf = (id?: string) => {
    if (!id) return null;
    for (const s of scenes?.scenes ?? []) {
      for (const n of s.narrations ?? []) {
        const action = (n.actions ?? []).find((a) => a.id === id);
        if (action) return { scene: s, narration: n, action };
      }
    }
    return null;
  };

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const refetch = async () => {
    const res = await api<GameTableModifiers>(
      `/game-table-modifiers/${tableId}`
    );
    setModifiers(res.modifiers ?? []);
  };

  const save = async () => {
    if (!form.character_id && !form.location_id) {
      setError(t("vs.mp.errTarget"));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      id: form.id,
      character_id: txt(form.character_id),
      scene_id: txt(form.scene_id),
      narration_id: txt(form.narration_id),
      action_id: txt(form.action_id),
      name: form.name.trim() || "Modificador",
      description: txt(form.description) ?? "",
      effect: txt(form.effect) ?? "",
      cost_points: num(form.cost_points),
      hp: num(form.hp),
      st: num(form.st),
      dx: num(form.dx),
      iq: num(form.iq),
      ht: num(form.ht),
      fatigue: num(form.fatigue),
      encumbrance: txt(form.encumbrance),
      mod_hp: num(form.mod_hp),
      mod_st: num(form.mod_st),
      mod_dx: num(form.mod_dx),
      mod_iq: num(form.mod_iq),
      mod_ht: num(form.mod_ht),
      mod_fatigue: num(form.mod_fatigue),
      mod_encumbrance: txt(form.mod_encumbrance),
      damage_value: txt(form.damage_value),
      skill_value: txt(form.skill_value),
      armor_value: txt(form.armor_value),
      advantage_value: txt(form.advantage_value),
      disadvantage_value: txt(form.disadvantage_value),
      item_quantity: num(form.item_quantity),
      item_weight: num(form.item_weight),
      item_dimension: txt(form.item_dimension),
      item_range: txt(form.item_range),
      item_status: txt(form.item_status),
      skill_id: txt(form.skill_id),
      apply_on_roll: form.apply_on_roll ? 1 : 0,
      location_id: form.location_id ? txt(form.location_id) ?? null : null,
    };
    try {
      if (form.id) {
        await api("/game-table-modifier", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/game-table-modifier", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setForm(emptyForm());
      setShowAdvanced(false);
      setTab("list");
      await refetch();
    } catch {
      setError(t("vs.mp.errSave"));
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    "w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-green-700/60 focus:outline-none";

  return (
    <div className="w-full">
      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-1 border-b border-zinc-800 mb-5">
        <button
          type="button"
          onClick={() => setTab("list")}
          className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
            tab === "list"
              ? "text-green-400 border-green-600"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          {t("vs.mp.tabList")}
          <span className="ml-2 text-zinc-600">{modifiers.length}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setShowAdvanced(false);
            setTab("form");
          }}
          className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
            tab === "form"
              ? "text-green-400 border-green-600"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          {form.id ? t("vs.mp.tabEdit") : t("vs.mp.tabNew")}
        </button>
      </div>

      {tab === "list" ? (
        <section>

          {modifiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700/60 px-4 py-10 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {t("vs.mp.emptyTitle")}
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                {t("vs.mp.emptyBody")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {modifiers.map((m) => {
                const char = nameOf(m.character_id);
                const scene = sceneOf(m.scene_id);
                const locName = locationNameOf(m.location_id);
                const narration = scene?.narrations.find(
                  (n) => n.id === m.narration_id
                );
                const actionRef = actionOf(m.action_id);
                const chips = effectChips(m, t);
                return (
                  <li
                    key={m.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 truncate">
                          {m.name || t("vs.mp.unnamed")}
                        </p>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">
                          {char ? charName(char, t) : "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForm(toForm(m, scenes));
                          setShowAdvanced(false);
                          setTab("form");
                        }}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-zinc-100 hover:border-zinc-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
                      >
                        {t("vs.mp.tabEdit")}
                      </button>
                    </div>

                    {m.description ? (
                      <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                        {m.description}
                      </p>
                    ) : null}

                    {locName ? (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-teal-300/80 mt-1.5">
                        {interpolate(t("vs.mp.atLocation"), { name: locName })}
                      </p>
                    ) : null}

                    {scene ? (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-1.5">
                        {scene.chapter != null
                          ? interpolate(t("vs.dc.chapterShort"), { n: scene.chapter })
                          : t("vs.mp.any")}
                        {scene.title ? ` · ${scene.title}` : ""}
                        {narration?.title
                          ? ` / ${narration.title}`
                          : narration?.id === m.narration_id
                          ? ` / ${t("vs.mp.thisNarration")}`
                          : ""}
                      </p>
                    ) : locName ? (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mt-1.5">
                        {t("vs.mp.locNoMoment")}
                      </p>
                    ) : (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mt-1.5">
                        {t("vs.mp.persistent")}
                      </p>
                    )}

                    {actionRef ? (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-amber-300/80 mt-1">
                        {t("vs.mp.afterAction")}{" "}
                        {actionRef.action.queue != null
                          ? `${actionRef.action.queue}.`
                          : ""}{" "}
                        {actionRef.action.description
                          ? `“${actionRef.action.description}”`
                          : "—"}
                      </p>
                    ) : null}

                    {m.apply_on_roll === 1 ? (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-green-400/90 mt-1">
                        {t("vs.mp.onRollSuccess")}
                      </p>
                    ) : null}

                    {chips.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chips.map((c) => (
                          <span
                            key={`${m.id}-${c.label}-${c.value}`}
                            className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5"
                          >
                            {c.label} {c.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-green-500/80 mb-3">
            {form.id ? t("vs.mp.formEdit") : t("vs.mp.formNew")}
          </h3>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.character")}
                <select
                  value={form.character_id}
                  onChange={(e) => set("character_id", e.target.value)}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {charName(c, t)}
                      {c.isNpc ? " (NPC)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.name")}
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("vs.mp.f.namePh")}
                  className={fieldCls}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.tl.chapter")}
                <select
                  value={form.chapter}
                  onChange={(e) => {
                    set("chapter", e.target.value);
                    set("scene_id", "");
                    set("narration_id", "");
                    set("action_id", "");
                  }}
                  className={fieldCls}
                >
                  <option value="">{t("vs.mp.any")}</option>
                  {chapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {interpolate(t("vs.sr.chapterTitle"), { n: ch })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.dc.scene")}
                <select
                  value={form.scene_id}
                  onChange={(e) => {
                    set("scene_id", e.target.value);
                    set("narration_id", "");
                    set("action_id", "");
                  }}
                  disabled={visibleScenes.length === 0}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {visibleScenes.map((s: { id: string; title: string }) => (
                    <option key={s.id} value={s.id}>
                      {s.title || t("vs.dc.untitledScene")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.dc.narration")}
                <select
                  value={form.narration_id}
                  onChange={(e) => {
                    set("narration_id", e.target.value);
                    set("action_id", "");
                  }}
                  disabled={visibleNarrations.length === 0}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {visibleNarrations.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title || t("vs.dc.narration")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-300/70">
                {t("vs.mp.f.actionAfter")}
                <select
                  value={form.action_id}
                  onChange={(e) => set("action_id", e.target.value)}
                  disabled={visibleActions.length === 0}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {visibleActions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.queue != null ? `${a.queue}. ` : ""}
                      {a.description || t("vs.mp.f.action")}
                      {a.result ? ` → ${a.result}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 border-t border-zinc-800 pt-4">
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.consequenceSkill")}
                <span className="normal-case text-zinc-600 font-sans text-[10px]">
                  {t("vs.mp.f.consequenceHint")}
                </span>
                <select
                  value={form.skill_id}
                  onChange={(e) => {
                    set("skill_id", e.target.value);
                    if (!e.target.value) setForm((f) => ({ ...f, apply_on_roll: 0 }));
                  }}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col justify-center gap-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("vs.mp.f.applyOnSuccess")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.apply_on_roll === 1}
                  disabled={!form.skill_id}
                  onClick={() =>
                    setForm((f) => ({ ...f, apply_on_roll: f.apply_on_roll ? 0 : 1 }))
                  }
                  className={`w-12 h-6 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
                    form.apply_on_roll === 1
                      ? "bg-green-600 border-green-500"
                      : "bg-zinc-800 border-zinc-700"
                  } ${form.skill_id ? "" : "opacity-30 cursor-not-allowed"}`}
                >
                  <span
                    className={`block w-4 h-4 mt-[3px] rounded-full bg-zinc-100 transition-transform ${
                      form.apply_on_roll === 1 ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {form.apply_on_roll === 1 && form.skill_id ? (
              <p className="text-[10px] text-amber-300/70 -mt-2">
                {t("vs.mp.f.applyOnSuccessNote")}
              </p>
            ) : null}

            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.description")}
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={2}
                  placeholder={t("vs.mp.f.descriptionPh")}
                  className={fieldCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.effect")}
                <input
                  type="text"
                  value={form.effect}
                  onChange={(e) => set("effect", e.target.value)}
                  placeholder={t("vs.mp.f.effectPh")}
                  className={fieldCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {t("vs.mp.f.costPoints")}
                <input
                  type="number"
                  value={form.cost_points}
                  onChange={(e) => set("cost_points", e.target.value)}
                  className={fieldCls}
                />
              </label>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                {t("vs.mp.f.setValues")} <span className="text-zinc-600 normal-case">({t("vs.mp.f.absolute")})</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SET_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500"
                  >
                    {fieldLabel(f, t)}
                    <input
                      type={f.numeric ? "number" : "text"}
                      value={form[f.key as keyof FormState] as string}
                      onChange={(e) =>
                        set(f.key as keyof FormState, e.target.value)
                      }
                      className={fieldCls}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                {t("vs.mp.f.deltas")} <span className="text-zinc-600 normal-case">({t("vs.mp.f.additive")})</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DELTA_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500"
                  >
                    {fieldLabel(f, t)}
                    <input
                      type={f.numeric ? "number" : "text"}
                      value={form[f.key as keyof FormState] as string}
                      onChange={(e) =>
                        set(f.key as keyof FormState, e.target.value)
                      }
                      className={fieldCls}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {t("vs.mp.f.itemAdvanced")}
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAdvanced ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-3 pb-3">
                  {ITEM_FIELDS.map((f) => (
                    <label
                      key={f.key}
                      className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500"
                    >
                      {fieldLabel(f, t)}
                      <input
                        type={f.numeric ? "number" : "text"}
                        value={form[f.key as keyof FormState] as string}
                        onChange={(e) =>
                          set(f.key as keyof FormState, e.target.value)
                        }
                        className={fieldCls}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-green-800 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
              >
                {saving
                  ? t("vs.sp.saving")
                  : form.id
                  ? t("vs.mp.saveChanges")
                  : t("vs.mp.addModifier")}
              </button>
              {form.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm());
                    setShowAdvanced(false);
                    setTab("list");
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  {t("vs.mp.cancel")}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}