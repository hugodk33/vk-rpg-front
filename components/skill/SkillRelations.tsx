"use client";

/* ============================================================
   SkillRelations — the requirement / default ledger of one skill.

   Two ledgers hang off every skill:

     "requires"      origin_skill_id -> depends_on_skill_id
                     this skill cannot be trained without the other.
     "offers default" origin_skill_id -> depends_on_skill_id
                     this skill grants a free level in the other.

   Both tables could only be written by duplicating or deleting a whole
   skill, so a narrator could never point a skill at another one. These
   are now first-class rows, editable one at a time.

   Cycle detection lives in the backend (`wouldCreateSkillDependencyCycle`),
   not here: a three-node loop cannot be spotted from the single skill
   being edited. The backend rejects the write and this panel surfaces the
   message. Cycles only make sense for "requires" — two skills each
   granting the other a default is legitimate, so the backend does not
   police that ledger.

   The rows come from the skill detail already loaded by the parent form
   (`relation_id` rides along), so there is no second fetch to drift out of
   sync with what the narrator just saved.
   ============================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { cancelCls, inputCls, labelCls } from "@/components/forms/formStyles";
import type { SkillItem } from "@/lib/types";

type Kind = "dependency" | "predefinition";

interface Row {
  relation_id?: string;
  skill: string | null;
  skill_id?: string | null;
  value: string | null;
  /** dependency */
  type: string | null;
  /** predefinition */
  depends_on_skill_for_others_attributes: string | null;
}

interface Ledgers {
  dependency: Row[];
  predefinition: Row[];
}

interface FormState {
  id?: string;
  kind: Kind;
  targetId: string;
  value: string;
  type: string;
  attributesFormula: string;
}

const emptyForm = (kind: Kind): FormState => ({
  kind,
  targetId: "",
  value: "",
  type: "",
  attributesFormula: "",
});

const txt = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export default function SkillRelations({
  skill,
  tableId,
}: {
  skill?: SkillItem;
  tableId?: string;
}) {
  const { t } = useTranslation();
  /* Derived from the parent's copy of the skill, then overridden by
     `patch` once this panel writes something. Deriving instead of
     mirroring in an effect keeps a save from cascading a render. */
  const [patch, setPatch] = useState<{ id: string; rows: Ledgers } | null>(null);
  const [targets, setTargets] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState<FormState>(emptyForm("dependency"));
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromSkill: Ledgers = {
    dependency: (skill?.dependencies ?? []) as Row[],
    predefinition: (skill?.predefinition ?? []) as Row[],
  };
  /* A write replaces what the server said; pointing the panel at another
     skill (or none) drops the override instead of showing stale rows. */
  const rows: Ledgers =
    patch && skill?.id && patch.id === skill.id ? patch.rows : fromSkill;

  /* Only the target picker needs a fetch: the rows already came down with
     the skill. */
  useEffect(() => {
    if (!tableId) return;
    let cancel = false;
    api<{ skills?: Array<{ id: string; name?: string }> }>(`/game-table-skills/${tableId}`)
      .then((res) => {
        if (cancel) return;
        setTargets(
          (res.skills ?? [])
            .filter((s) => !!s.id && s.id !== skill?.id)
            .map((s) => ({ id: s.id, name: s.name || s.id }))
        );
      })
      .catch(() => {
        if (!cancel) setTargets([]);
      });
    return () => {
      cancel = true;
    };
  }, [tableId, skill?.id]);

  /* Re-reads the skill so the ledger reflects the write. Not memoised on
     purpose: it is only ever called from an event handler, never passed
     down as a dependency. */
  async function refetch() {
    if (!skill?.id) return;
    try {
      const fresh = await api<SkillItem>(`/game-table-skill/${skill.id}`);
      setPatch({
        id: skill.id,
        rows: {
          dependency: (fresh.dependencies ?? []) as Row[],
          predefinition: (fresh.predefinition ?? []) as Row[],
        },
      });
    } catch {
      /* Keep what is on screen; the next edit will try again. */
    }
  }

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const startEdit = (kind: Kind, row: Row) => {
    setForm({
      id: row.relation_id,
      kind,
      targetId: row.skill_id ?? "",
      value: row.value ?? "",
      type: row.type ?? "",
      attributesFormula: row.depends_on_skill_for_others_attributes ?? "",
    });
    setShowForm(true);
    setError(null);
  };

  const save = async () => {
    if (!skill?.id) return;
    setBusy(true);
    setError(null);

    const extra =
      form.kind === "dependency"
        ? { type: txt(form.type) }
        : { depends_on_skill_for_others_attributes: txt(form.attributesFormula) };

    const payload: Record<string, unknown> = {
      origin_skill_id: skill.id,
      depends_on_skill_id: txt(form.targetId),
      depends_on_skill_value: txt(form.value),
      ...extra,
    };

    try {
      const url = form.id
        ? `/game-table-skill-relation/${form.kind}/${form.id}`
        : `/game-table-skill-relation/${form.kind}`;
      await api(url, {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setForm(emptyForm("dependency"));
      setShowForm(false);
      await refetch();
    } catch (err) {
      /* `api()` anexa o `error` do servidor depois de um "—"; essa é a
         mensagem que nomeia o par que fecharia o ciclo. */
      const raw = err instanceof Error ? err.message : "";
      const cut = raw.indexOf("—");
      setError(cut >= 0 ? raw.slice(cut + 1).trim() : t("fr.srel.error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind: Kind, row: Row) => {
    if (!row.relation_id) return;
    if (!window.confirm(t("fr.srel.confirmRemove"))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/game-table-skill-relation/${kind}/${row.relation_id}`, { method: "DELETE" });
      if (form.id === row.relation_id) {
        setForm(emptyForm("dependency"));
        setShowForm(false);
      }
      await refetch();
    } catch {
      setError(t("fr.srel.error"));
    } finally {
      setBusy(false);
    }
  };

  const list = (
    kind: Kind,
    ledger: Row[],
    labelKey: string,
  ) => (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2.5 pb-1.5 mb-2 border-b border-zinc-700/60">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          {t(labelKey)}
        </span>
        <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #22c55e55, transparent)" }} />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setForm(emptyForm(kind));
            setShowForm(true);
            setError(null);
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-green-300/90 hover:text-green-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60 rounded-sm"
        >
          {t("fr.srel.add")}
        </button>
      </div>

      {ledger.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("fr.srel.empty")}</p>
      ) : (
        <ul>
          {ledger.map((row, i) => (
            <li key={row.relation_id ?? i} className="border-b border-zinc-700/40 py-2.5 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {row.skill_id ? (
                    <Link
                      href={`/skill/${row.skill_id}`}
                      className="text-sm text-zinc-200 hover:text-amber-400 transition-colors truncate"
                    >
                      {row.skill || row.skill_id}
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-400">{t("fr.srel.attributeOnly")}</span>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {row.value ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-green-200 bg-green-900/40 border border-green-800/50 rounded px-1.5 py-0.5">
                        {t("fr.srel.value")} {row.value}
                      </span>
                    ) : null}
                    {row.type ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-300 bg-zinc-800/80 border border-zinc-700/50 rounded px-1.5 py-0.5">
                        {t("fr.srel.type")} {row.type}
                      </span>
                    ) : null}
                    {row.depends_on_skill_for_others_attributes ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-amber-300 bg-amber-900/30 border border-amber-800/50 rounded px-1.5 py-0.5">
                        {row.depends_on_skill_for_others_attributes}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(kind, row)}
                    className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-zinc-100 hover:border-zinc-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
                  >
                    {t("fr.emod.edit")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(kind, row)}
                    className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-700/60 rounded-md px-2 py-1 hover:text-red-400 hover:border-red-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/60"
                  >
                    {t("fr.emod.remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && form.kind === kind ? (
        <div className="space-y-3 mt-3 mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t("fr.srel.target")}</label>
              <select
                value={form.targetId}
                onChange={(e) => set("targetId", e.target.value)}
                className={inputCls}
              >
                <option value="">{t("fr.srel.targetNone")}</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">{t("fr.srel.targetHint")}</p>
            </div>
            <div>
              <label className={labelCls}>{t("fr.srel.value")}</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={t("fr.srel.valuePh")}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {t(kind === "dependency" ? "fr.srel.type" : "fr.srel.attributesFormula")}
            </label>
            <input
              type="text"
              value={kind === "dependency" ? form.type : form.attributesFormula}
              onChange={(e) =>
                set(kind === "dependency" ? "type" : "attributesFormula", e.target.value)
              }
              placeholder={t("fr.srel.formulaPh")}
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
            >
              {busy ? t("fr.saving") : form.id ? t("fr.emod.save") : t("fr.emod.create")}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm("dependency"));
                setShowForm(false);
                setError(null);
              }}
              className={cancelCls}
            >
              {t("fr.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!tableId) return null;

  if (!skill?.id) {
    return (
      <section className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5">
        <header className="flex items-center gap-2.5 pb-1.5 mb-3 border-b border-zinc-700/60">
          <span aria-hidden className="font-mono text-base leading-none text-green-300">⌁</span>
          <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
            {t("fr.srel.title")}
          </span>
        </header>
        <p className="text-xs text-zinc-500 leading-relaxed">{t("fr.emod.saveFirst")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5">
      <header className="flex items-center gap-2.5 pb-1.5 mb-3 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none text-green-300">⌁</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">
          {t("fr.srel.title")}
        </span>
      </header>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      {list("dependency", rows.dependency, "fr.srel.requires")}
      {list("predefinition", rows.predefinition, "fr.srel.defaults")}
    </section>
  );
}