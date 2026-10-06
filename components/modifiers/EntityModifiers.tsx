"use client";

/* ============================================================
   EntityModifiers — the modification a single advantage,
   disadvantage, skill or item implies.

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
export type OwnerField =
  | "advantage_id"
  | "disadvantage_id"
  | "skill_id"
  | "item_id";

/**
 * Which value column carries the mechanical change, per entity kind.
 *
 * Items are the exception: `modifiers` gives them five separate columns
 * (quantity, dimension, weight, range, status) instead of one value, so they
 * get `ITEM_FIELDS` below and a wider form. `armor_value` / `damage_value`
 * stay reachable from the table-wide ModifiersPanel.
 */
const VALUE_FIELD = {
  advantage_id: "advantage_value",
  disadvantage_id: "disadvantage_value",
  skill_id: "skill_value",
} as const satisfies Record<Exclude<OwnerField, "item_id">, keyof Modifier>;

const VALUE_LABEL = {
  advantage_id: "fr.emod.valAdv",
  disadvantage_id: "fr.emod.valDis",
  skill_id: "fr.emod.valSkill",
} as const satisfies Record<Exclude<OwnerField, "item_id">, string>;

/** The five `item_*` columns an item modifier can write. */
type ItemFieldKey =
  | "item_quantity"
  | "item_weight"
  | "item_dimension"
  | "item_range"
  | "item_status";

const ITEM_FIELDS: Array<{
  key: ItemFieldKey;
  labelKey: string;
  numeric: boolean;
}> = [
  { key: "item_quantity", labelKey: "vs.mp.f.itemQuantity", numeric: true },
  { key: "item_weight", labelKey: "vs.mp.f.itemWeight", numeric: true },
  { key: "item_dimension", labelKey: "vs.mp.f.itemDimension", numeric: false },
  { key: "item_range", labelKey: "vs.mp.f.itemRange", numeric: false },
  { key: "item_status", labelKey: "vs.mp.f.itemStatus", numeric: false },
];

const ATTR_MODS: Array<{ key: AttrModKey; label: string }> = [
  { key: "mod_hp", label: "HP" },
  { key: "mod_st", label: "ST" },
  { key: "mod_dx", label: "DX" },
  { key: "mod_iq", label: "IQ" },
  { key: "mod_ht", label: "HT" },
  { key: "mod_fatigue", label: "FAT" },
];

/** The attribute columns a modifier adds to (never replaces). */
type AttrModKey =
  | "mod_hp"
  | "mod_st"
  | "mod_dx"
  | "mod_iq"
  | "mod_ht"
  | "mod_fatigue";

type AttrMods = Record<AttrModKey, string>;

interface FormState {
  id?: string;
  name: string;
  effect: string;
  description: string;
  cost_points: string;
  value: string;
  attrs: AttrMods;
  on_roll: boolean;
  /** Only used when the owner is an item; see ITEM_FIELDS. */
  item_quantity: string;
  item_weight: string;
  item_dimension: string;
  item_range: string;
  item_status: string;
}

const emptyAttrs = (): AttrMods => ({
  mod_hp: "",
  mod_st: "",
  mod_dx: "",
  mod_iq: "",
  mod_ht: "",
  mod_fatigue: "",
});

const emptyForm = (): FormState => ({
  name: "",
  effect: "",
  description: "",
  cost_points: "",
  value: "",
  attrs: emptyAttrs(),
  on_roll: false,
  item_quantity: "",
  item_weight: "",
  item_dimension: "",
  item_range: "",
  item_status: "",
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
  bare = false,
}: {
  ownerField: OwnerField;
  ownerId?: string;
  tableId?: string;
  /** Drops the outer card — for hosts that already provide a frame. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const isItem = ownerField === "item_id";
  const valueField = isItem ? null : VALUE_FIELD[ownerField];
  /* Inside the modifiers dialog the dialog IS the frame; a card there would
     be a box inside a box. */
  const shellCls = bare
    ? ""
    : "rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5";

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

  const setAttr = (field: AttrModKey, value: string) =>
    setForm((f) => ({ ...f, attrs: { ...f.attrs, [field]: value } }));

  const startEdit = (m: Modifier) => {
    setForm({
      id: m.id,
      name: m.name ?? "",
      effect: m.effect ?? "",
      description: m.description ?? "",
      cost_points: m.cost_points != null ? String(m.cost_points) : "",
      value: valueField ? ((m[valueField] as string | undefined) ?? "") : "",
      attrs: {
        mod_hp: m.mod_hp != null ? String(m.mod_hp) : "",
        mod_st: m.mod_st != null ? String(m.mod_st) : "",
        mod_dx: m.mod_dx != null ? String(m.mod_dx) : "",
        mod_iq: m.mod_iq != null ? String(m.mod_iq) : "",
        mod_ht: m.mod_ht != null ? String(m.mod_ht) : "",
        mod_fatigue: m.mod_fatigue != null ? String(m.mod_fatigue) : "",
      },
      on_roll: !!m.apply_on_roll,
      item_quantity: m.item_quantity != null ? String(m.item_quantity) : "",
      item_weight: m.item_weight != null ? String(m.item_weight) : "",
      item_dimension: m.item_dimension ?? "",
      item_range: m.item_range ?? "",
      item_status: m.item_status ?? "",
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
    kind: m.kind ?? "modelo",
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
      apply_on_roll: form.on_roll ? 1 : 0,
      /* The attribute the entry moves: these are what actually reach the
         character sheet's composition. */
      mod_hp: num(form.attrs.mod_hp) ?? null,
      mod_st: num(form.attrs.mod_st) ?? null,
      mod_dx: num(form.attrs.mod_dx) ?? null,
      mod_iq: num(form.attrs.mod_iq) ?? null,
      mod_ht: num(form.attrs.mod_ht) ?? null,
      mod_fatigue: num(form.attrs.mod_fatigue) ?? null,
      /* An item carries five value columns instead of one, so the payload
         branches rather than writing a literal "null" key. */
      ...(isItem
        ? {
            item_quantity: num(form.item_quantity) ?? null,
            item_weight: num(form.item_weight) ?? null,
            item_dimension: txt(form.item_dimension) ?? null,
            item_range: txt(form.item_range) ?? null,
            item_status: txt(form.item_status) ?? null,
          }
        : { [valueField as string]: txt(form.value) ?? null }),
      /* Attached to a catalog entry, so it is a rule: every character
         holding that trait or item picks it up on read. */
      kind: form.id ? undefined : "modelo",
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
      <section className={shellCls}>
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
    <section className={shellCls}>
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
            {isItem ? (
              <div className="sm:col-span-3 grid gap-3 sm:grid-cols-3">
                {ITEM_FIELDS.map((f) => (
                  <div key={String(f.key)}>
                    <label className={labelCls}>{t(f.labelKey)}</label>
                    <input
                      type={f.numeric ? "number" : "text"}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className={labelCls}>
                  {t(VALUE_LABEL[ownerField as Exclude<OwnerField, "item_id">])}
                </label>
                <input
                  type="text"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder={t("fr.emod.valuePh")}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>{t("fr.emod.attrs")}</label>
              <div className="grid grid-cols-3 gap-2">
                {ATTR_MODS.map((a) => (
                  <label key={String(a.key)} className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 pointer-events-none">
                      {a.label}
                    </span>
                    <input
                      type="number"
                      value={form.attrs[a.key]}
                      onChange={(e) => setAttr(a.key, e.target.value)}
                      placeholder={t("fr.emod.attrPh")}
                      className={`${inputCls} pl-9`}
                    />
                  </label>
                ))}
              </div>
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

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {t("fr.emod.passive")}
          </p>

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
            const value = valueField
              ? (m[valueField] as string | undefined)
              : undefined;
            const attrs = ATTR_MODS.filter((a) => m[a.key] != null);
            const itemChips = isItem
              ? ITEM_FIELDS.filter((f) => {
                  const v = m[f.key];
                  return v != null && v !== "";
                })
              : [];
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
                  {valueField && value ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-green-200 bg-green-900/40 border border-green-800/50 rounded px-1.5 py-0.5">
                      {t(VALUE_LABEL[ownerField as Exclude<OwnerField, "item_id">])}{" "}
                      {value}
                    </span>
                  ) : null}
                  {itemChips.map((f) => (
                    <span
                      key={String(f.key)}
                      className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5"
                    >
                      {t(f.labelKey)} {String(m[f.key])}
                    </span>
                  ))}
                  {m.cost_points != null ? (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5">
                      {t("fr.costPoints")} ={m.cost_points}
                    </span>
                  ) : null}
                  {attrs.map((a) => (
                    <span
                      key={String(a.key)}
                      className="font-mono text-[9px] uppercase tracking-widest text-emerald-300 bg-emerald-900/30 border border-emerald-800/50 rounded px-1.5 py-0.5"
                    >
                      {a.label} {Number(m[a.key]) > 0 ? `+${m[a.key]}` : String(m[a.key])}
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