"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import { useTranslation } from "@/lib/i18n";
import type { SkillItem } from "@/lib/types";

export interface SkillFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: SkillItem;
}

const TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: "Physical", label: "fr.sk.typePhysical", hint: "fr.sk.hintPhysical" },
  { value: "Mental", label: "fr.sk.typeMental", hint: "fr.sk.hintMental" },
  { value: "Social", label: "fr.sk.typeSocial", hint: "fr.sk.hintSocial" },
];

const DIFFICULTIES: Array<{ value: string; label: string }> = [
  { value: "Easy", label: "fr.diff.easy" },
  { value: "Average", label: "fr.diff.average" },
  { value: "Hard", label: "fr.diff.hard" },
  { value: "Very Hard", label: "fr.diff.veryHard" },
];

export default function SkillForm({ tableId, tables, initial }: SkillFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.predefinition_type ?? initial?.type ?? "Physical");
  const [difficulty, setDifficulty] = useState(initial?.predefinition_difficulty ?? "Average");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTableId) {
      setError(t("fr.error.selectTable"));
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      id: isEdit && initial ? initial.id : undefined,
      table_id: currentTableId,
      name,
      type,
      predefinition_type: type,
      predefinition_difficulty: difficulty,
      category: category || null,
      subcategory: subcategory || null,
      description,
    };

    try {
      await submitJson<{ success?: boolean }>(
        isEdit && initial ? `/api/game-table-skill/${initial.id}` : "/api/game-table-skill",
        isEdit ? "PUT" : "POST",
        payload
      );
      router.push(`/table/${currentTableId}/skills`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.skill"));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? t("fr.sk.editTitle") : t("fr.sk.newTitle")}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && !tableId ? (
            <div>
              <label className={labelCls}>{t("fr.table")}</label>
              <select
                value={currentTableId}
                onChange={(e) => setCurrentTableId(e.target.value)}
                required
                className={inputCls}
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

          <div>
            <label className={labelCls}>{t("fr.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.type")}</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {TYPES.map((t2) => (
                  <option key={t2.value} value={t2.value}>
                    {t(t2.label)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">{t(TYPES.find((t2) => t2.value === type)?.hint ?? "fr.sk.hintPhysical")}</p>
            </div>
            <div>
              <label className={labelCls}>{t("fr.difficulty")}</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.category")}</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder={t("fr.sk.categoryPh")} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.subcategory")}</label>
              <input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={inputCls} placeholder={t("fr.sk.subcategoryPh")} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("fr.description")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.sk.create")}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/skills` : "/narrator"} className={cancelCls}>
              {t("fr.cancel")}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}