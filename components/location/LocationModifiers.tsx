"use client";

/* ============================================================
   LocationModifiers — field conditions pinned to THIS place.
   A modifier bound to a location is a durable condition or event
   ("the bridge is down", "the mines are cursed", "ashes drift all
   day") that only exists while it's on record. Saved through the
   shared /game-table-modifier endpoints with location_id set, so
   it shows up anywhere a table's modifiers are listed.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { interpolate, useTranslation } from "@/lib/i18n";
import type {
  GameTableModifiers,
  GameTableScenes,
  Modifier,
  Scene,
} from "@/lib/types";

interface FormState {
  id?: string;
  name: string;
  effect: string;
  description: string;
  cost_points: string;
  chapter: string;
  scene_id: string;
  narration_id: string;
}

const emptyForm = (): FormState => ({
  name: "",
  effect: "",
  description: "",
  cost_points: "",
  chapter: "",
  scene_id: "",
  narration_id: "",
});

const txt = (v: string): string | undefined =>
  v.trim() === "" ? undefined : v.trim();
const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const effectChips = (m: Modifier): { labelKey: string; value: string }[] => {
  const out: { labelKey: string; value: string }[] = [];
  if (m.cost_points != null) out.push({ labelKey: "lc.mod.chipPts", value: `=${m.cost_points}` });
  if (m.effect) out.push({ labelKey: "lc.mod.chipEffect", value: m.effect });
  return out;
};

const fieldCls =
  "w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-teal-700/60 focus:outline-none";

export default function LocationModifiers({
  locationId,
  tableId,
}: {
  locationId: string;
  tableId?: string;
}) {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [scenes, setScenes] = useState<GameTableScenes | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!tableId) return;
    let cancel = false;
    Promise.all([
      api<GameTableModifiers>(`/game-table-modifiers/${tableId}`).catch(() => ({
        table: null,
        modifiers: [],
      })),
      api<GameTableScenes>(`/game-table-scenes/${tableId}`).catch(() => ({
        table: null,
        scenes: [],
      })),
    ]).then(([m, s]) => {
      if (cancel) return;
      setModifiers(m.modifiers ?? []);
      setScenes(s);
    });
    return () => { cancel = true; };
  }, [tableId]);

  const local = useMemo(
    () => (modifiers ?? []).filter((m) => String(m.location_id) === String(locationId)),
    [modifiers, locationId]
  );

  const chapters = useMemo(() => {
    const set = new Set<number>();
    for (const s of scenes?.scenes ?? []) if (s.chapter != null) set.add(s.chapter);
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

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const refetch = async () => {
    const res = await api<GameTableModifiers>(`/game-table-modifiers/${tableId}`);
    setModifiers(res.modifiers ?? []);
  };

  const sceneName = (scene?: Scene) => scene?.title || t("lc.mod.sceneUntitled");

  const coordsOf = (m: Modifier): string | null => {
    const scene = (scenes?.scenes ?? []).find((s) => s.id === m.scene_id);
    if (!scene) return null;
    const narration = scene.narrations?.find((n) => n.id === m.narration_id);
    return [
      scene.chapter != null ? interpolate(t("lc.mod.chapterShort"), { n: scene.chapter }) : null,
      sceneName(scene),
      narration?.title ? ` / ${narration.title}` : null,
    ].filter(Boolean).join(" · ");
  };

  const startEdit = (m: Modifier) => {
    const scene = (scenes?.scenes ?? []).find((s) => s.id === m.scene_id);
    setForm({
      id: m.id,
      name: m.name ?? "",
      effect: m.effect ?? "",
      description: m.description ?? "",
      cost_points: m.cost_points != null ? String(m.cost_points) : "",
      chapter: scene?.chapter != null ? String(scene.chapter) : "",
      scene_id: m.scene_id ?? "",
      narration_id: m.narration_id ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      id: form.id,
      location_id: locationId,
      scene_id: txt(form.scene_id),
      narration_id: txt(form.narration_id),
      name: form.name.trim() || "Condição",
      effect: txt(form.effect) ?? "",
      description: txt(form.description) ?? "",
      cost_points: num(form.cost_points),
    };
    try {
      if (form.id) {
        await api("/game-table-modifier", { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/game-table-modifier", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(emptyForm());
      setShowForm(false);
      await refetch();
    } catch {
      setError(t("lc.mod.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 pb-1.5 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none text-teal-300">◐</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{t("lc.mod.title")}</span>
        <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #2dd4bf55, transparent)" }} />
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setShowForm((v) => !v);
            setError(null);
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-teal-300/90 hover:text-teal-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded-sm"
        >
          {showForm && !form.id ? t("lc.mod.close") : t("lc.mod.add")}
        </button>
      </div>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      {local.length === 0 && !showForm ? (
        <p className="text-xs text-zinc-500">
          {t("lc.mod.empty")}
        </p>
      ) : null}

      {showForm ? (
        <div className="space-y-3 mb-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {t("lc.mod.name")}
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder={t("lc.mod.namePh")} className={fieldCls} />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {t("lc.mod.cost")}
              <input type="number" value={form.cost_points} onChange={(e) => set("cost_points", e.target.value)} className={fieldCls} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            {t("lc.mod.effect")}
            <input type="text" value={form.effect} onChange={(e) => set("effect", e.target.value)}
              placeholder={t("lc.mod.effectPh")} className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            {t("lc.mod.desc")}
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={2} placeholder={t("lc.mod.descPh")} className={fieldCls} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {t("lc.mod.chapter")}
              <select value={form.chapter} onChange={(e) => { set("chapter", e.target.value); set("scene_id", ""); set("narration_id", ""); }} className={fieldCls}>
                <option value="">{t("lc.mod.anyChapter")}</option>
                {chapters.map((ch) => (
                  <option key={ch} value={ch}>{interpolate(t("lc.mod.chapterN"), { n: ch })}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {t("lc.mod.scene")}
              <select value={form.scene_id} onChange={(e) => { set("scene_id", e.target.value); set("narration_id", ""); }} disabled={visibleScenes.length === 0} className={fieldCls}>
                <option value="">—</option>
                {visibleScenes.map((s) => (
                  <option key={s.id} value={s.id}>{sceneName(s)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {t("lc.mod.narration")}
              <select value={form.narration_id} onChange={(e) => set("narration_id", e.target.value)} disabled={visibleNarrations.length === 0} className={fieldCls}>
                <option value="">—</option>
                {visibleNarrations.map((n) => (
                  <option key={n.id} value={n.id}>{n.title || t("lc.mod.narration")}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
            >
              {saving ? t("lc.common.saving") : form.id ? t("lc.mod.save") : t("lc.mod.create")}
            </button>
            {form.id ? (
              <button type="button" onClick={() => { setForm(emptyForm()); setShowForm(false); setError(null); }}
                className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
                {t("lc.common.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {local.length > 0 ? (
        <ul>
          {local.map((m) => {
            const coords = coordsOf(m);
            const chips = effectChips(m);
            return (
              <li key={m.id} className="border-b border-zinc-700/40 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100 truncate min-w-0">{m.name || t("lc.mod.untitled")}</p>
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-zinc-100 hover:border-zinc-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
                  >
                    {t("lc.common.edit")}
                  </button>
                </div>
                {m.description ? (
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{m.description}</p>
                ) : null}
                {coords ? (
                  <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-1.5">{coords}</p>
                ) : (
                  <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mt-1.5">{t("lc.mod.noMoment")}</p>
                )}
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {chips.map((c) => (
                      <span key={`${m.id}-${c.labelKey}-${c.value}`} className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5">
                        {t(c.labelKey)} {c.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}