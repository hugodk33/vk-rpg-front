"use client";

/* ============================================================
   EntityModifiers — the modification a single advantage,
   disadvantage or skill implies.

   The narrator already owns modifier rows that say *what* a
   change does (advantage_value / disadvantage_value /
   skill_value, the attribute mods, whether it applies on the
   roll). What was missing is the answer to "which ones did I buy
   by writing this advantage?" — the owner link existed in the
   schema and in the shared endpoints, but nothing ever set it and
   nothing read it.

   This panel pins those rows to the entity being edited. Writes go
   through the same /game-table-modifier endpoints with the owner
   column set, so the rows keep appearing in the table-wide
   modifier listing and in the character sheet.

   One caveat that shapes every write here: `editGameModifier`
   rewrites the scalar columns unconditionally, so a PUT carrying
   only `{ id, advantage_id: null }` would blank the row. Detach and
   edit therefore both replay the values already on record.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { cancelCls, inputCls, labelCls } from "@/components/forms/formStyles";
import type { GameTableModifiers, Modifier } from "@/lib/types";

/** The owner column in `modifiers` that pins a row to the entity. */
export type OwnerField = "advantage_id" | "disadvantage_id" | "skill_id";

/** Which value column carries the mechanical change, per entity kind. */
const VALUE_FIELD = {
  advantage_id: "advantage_value",
  disadvantage_id: "disadvantage_value",
  skill_id: "skill_value",
} as const satisfies Record<OwnerField, keyof Modifier>;

const VALUE_LABEL = {
  advantage_id: "fr.emod.valAdv",
  disadvantage_id: "fr.emod.valDis",
  skill_id: "fr.emod.valSkill",
} as const satisfies Record<OwnerField, string>;

const ATTR_MODS: Array<{ key: keyof Modifier; label: string }> = [
  { key: "mod_hp", label: "HP" },
  { key: "mod_st", label: "ST" },
  { key: "mod_dx", label: "DX" },
  { key: "mod_iq", label: "IQ" },
  { key: "mod_ht", label: "HT" },
  { key: "mod_fatigue", label: "FAT" },
];

interface FormState {
  id?: string;
  name: string;
  effect: string;
  description: string;
  cost_points: string;
  value: string;
  on_roll: boolean;
}

const emptyForm = (): FormState => ({
  name: "",
  effect: "",
  description: "",
  cost_points: "",
  value: "",
  on_roll: false,
});

const txt = (v: string): string | undefined =>
  v.trim() === "" ? undefined : v.trim();

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default function EntityModifiers({
  ownerField,
  ownerId,
  tableId,
}: {
  ownerField: OwnerField;
  ownerId?: string;
  tableId?: string;
}) {
  const { t } = useTranslation();
  const valueField = VALUE_FIELD[ownerField];

  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api<GameTableModifiers>(`/game-table-modifiers/${tableId}`);
      setModifiers(res.modifiers ?? []);
    } catch {
      setModifiers([]);
    }
  }, [tableId]);

  useEffect(() => {
    let cancel = false;
    if (!tableId) return;
    api<GameTableModifiers>(`/game-table-modifiers/${tableId}`)
      .then((res) => {
        if (!cancel) setModifiers(res.modifiers ?? []);
      })
      .catch(() => {
        if (!cancel) setModifiers([]);
      });
    return () => {
      cancel = true;
    };
  }, [tableId]);

  const local = useMemo(
    () =>
      ownerId
        ? modifiers.filter((m) => String(m[ownerField] ?? "") === String(ownerId))
        : [],
    [modifiers, ownerField, ownerId]
  );

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const startEdit = (m: Modifier) => {
    setForm({
      id: m.id,
      name: m.name ?? "",
      effect: m.effect ?? "",
      description: m.description ?? "",
      cost_points: m.cost_points != null ? String(m.cost_points) : "",
      value: (m[valueField] as string | undefined) ?? "",
      on_roll: !!m.apply_on_roll,
    });
    setShowForm(true);
    setError(null);
  };

  /* Replays what is already on record so the unconditional scalar
     write in `editGameModifier` cannot blank untouched columns. */
  const replay = (m: Modifier): Record<string, unknown> => ({
    name: m.name ?? "",
    cost_points: m.cost_points ?? null,
    effect: m.effect ?? "",
    description: m.description ?? "",
    hp: m.hp ?? null,
    st: m.st ?? null,
    dx: m.dx ?? null,
    iq: m.iq ?? null,
    ht: m.ht ?? null,
    fatigue: m.fatigue ?? null,
    encumbrance: m.encumbrance ?? null,
    mod_hp: m.mod_hp ?? null,
    mod_st: m.mod_st ?? null,
    mod_dx: m.mod_dx ?? null,
    mod_iq: m.mod_iq ?? null,
    mod_ht: m.mod_ht ?? null,
    mod_fatigue: m.mod_fatigue ?? null,
    mod_encumbrance: m.mod_encumbrance ?? null,
    skill_value: m.skill_value ?? null,
    advantage_value: m.advantage_value ?? null,
    disadvantage_value: m.disadvantage_value ?? null,
    armor_value: m.armor_value ?? null,
    damage_value: m.damage_value ?? null,
    item_quantity: m.item_quantity ?? null,
    item_dimension: m.item_dimension ?? null,
    item_weight: m.item_weight ?? null,
    item_range: m.item_range ?? null,
    item_status: m.item_status ?? null,
    apply_on_roll: m.apply_on_roll ?? 0,
  });

  const save = async () => {
    if (!ownerId) return;
    setBusy(true);
    setError(null);

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name.trim(),
      effect: txt(form.effect) ?? "",
      description: txt(form.description) ?? "",
      cost_points: num(form.cost_points) ?? null,
      [valueField]: txt(form.value) ?? null,
      apply_on_roll: form.on_roll ? 1 : 0,
    };

    try {
      if (form.id) {
        /* No owner key: `editGameModifier` only rewrites link columns
           that are present in the payload, so the row stays pinned. */
        await api("/game-table-modifier", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/game-table-modifier", {
          method: "POST",
          body: JSON.stringify({ ...payload, [ownerField]: ownerId }),
        });
      }
      setForm(emptyForm());
      setShowForm(false);
      await refetch();
    } catch {
      setError(t("fr.emod.error"));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (m: Modifier) => {
    setBusy(true);
    setError(null);
    try {
      await api("/game-table-modifier", {
        method: "PUT",
        body: JSON.stringify({ ...replay(m), id: m.id, [ownerField]: null }),
      });
      if (form.id === m.id) {
        setForm(emptyForm());
        setShowForm(false);
      }
      await refetch();
    } catch {
      setError(t("fr.emod.error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Modifier) => {
    if (!window.confirm(t("fr.emod.confirmRemove"))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/game-table-modifier/${m.id}`, { method: "DELETE" });
      if (form.id === m.id) {
        setForm(emptyForm());
        setShowForm(false);
      }
      await refetch();
    } catch {
      setError(t("fr.emod.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!tableId) return null;

  if (!ownerId) {
    return (
      <section className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5">
        <header className="flex items-center gap-2.5 pb-1.5 mb-3 border-b border-zinc-700/60">
          <span aria-hidden className="font-mono text-base leading-none text-green-300">◐</span>
          <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
            {t("fr.emod.title")}
          </span>
        </header>
        <p className="text-xs text-zinc-500 leading-relaxed">{t("fr.emod.saveFirst")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5">
      <header className="flex items-center gap-2.5 pb-1.5 mb-3 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none text-green-300">◐</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
          {t("fr.emod.title")}
        </span>
        <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #22c55e55, transparent)" }} />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setForm(emptyForm());
            setShowForm((v) => !v);
            setError(null);
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-green-300/90 hover:text-green-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60 rounded-sm"
        >
          {showForm && !form.id ? t("fr.emod.close") : t("fr.emod.add")}
        </button>
      </header>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      {local.length === 0 && !showForm ? (
        <p className="text-xs text-zinc-500">{t("fr.emod.empty")}</p>
      ) : null}

      {showForm ? (
        <div className="space-y-3 mb-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{t("fr.emod.name")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fr.emod.namePh")}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t(VALUE_LABEL[ownerField])}</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={t("fr.emod.valuePh")}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fr.costPoints")}</label>
              <input
                type="number"
                value={form.cost_points}
                onChange={(e) => set("cost_points", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("fr.emod.effect")}</label>
            <input
              type="text"
              value={form.effect}
              onChange={(e) => set("effect", e.target.value)}
              placeholder={t("fr.emod.effectPh")}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t("fr.description")}</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder={t("fr.emod.descPh")}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={form.on_roll}
              onChange={(e) => set("on_roll", e.target.checked)}
              className="accent-green-700"
            />
            {t("fr.emod.onRoll")}
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
            >
              {busy ? t("fr.saving") : form.id ? t("fr.emod.save") : t("fr.emod.create")}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setShowForm(false);
                  setError(null);
                }}
                className={cancelCls}
              >
                {t("fr.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {local.length > 0 ? (
        <ul>
          {local.map((m) => {
            const value = m[valueField] as string | undefined;
            const attrs = ATTR_MODS.filter(
              (a) => m[a.key] != null && m[a.key] !== ""
            );
            return (
              <li key={m.id} className="border-b border-zinc-700/40 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-100 truncate min-w-0">
                    {m.name || t("fr.emod.untitled")}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(m)}
                      className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-zinc-100 hover:border-zinc-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
                    >
                      {t("fr.emod.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unlink(m)}
                      className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-amber-300 hover:border-amber-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60"
                    >
                      {t("fr.emod.unlink")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(m)}
                      className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-red-400 hover:border-red-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/60"
                    >
                      {t("fr.emod.remove")}
                    </button>
                  </div>
                </div>

                {m.description ? (
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{m.description}</p>
                ) : null}

                {m.effect ? (
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{m.effect}</p>
                ) : null}

                <div className="flex flex-wrap gap-1 mt-2">
                  {value ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-green-200 bg-green-900/40 border border-green-800/50 rounded px-1.5 py-0.5">
                      {t(VALUE_LABEL[ownerField])} {value}
                    </span>
                  ) : null}
                  {m.cost_points != null ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5">
                      {t("fr.costPoints")} ={m.cost_points}
                    </span>
                  ) : null}
                  {attrs.map((a) => (
                    <span
                      key={String(a.key)}
                      className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5"
                    >
                      {a.label} {String(m[a.key])}
                    </span>
                  ))}
                  {m.apply_on_roll ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-amber-300 bg-amber-900/30 border border-amber-800/50 rounded px-1.5 py-0.5">
                      {t("fr.emod.onRoll")}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}