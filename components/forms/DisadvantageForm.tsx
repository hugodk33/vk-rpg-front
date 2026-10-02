"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import FormShell from "./FormShell";
import { useTranslation } from "@/lib/i18n";
import type { Disadvantage } from "@/lib/types";

export interface DisadvantageFormProps {
  tableId?: string;
  tableTitle?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: Disadvantage;
}

export default function DisadvantageForm({ tableId, tableTitle, tables, initial }: DisadvantageFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [costPoints, setCostPoints] = useState(initial?.cost_points != null ? String(initial.cost_points) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [effect, setEffect] = useState(initial?.effect ?? "");
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
      cost_points: costPoints === "" ? 0 : Number(costPoints),
      category: category || null,
      subcategory: subcategory || null,
      effect,
      description,
    };

    try {
      await submitJson<{ success?: boolean }>(
        isEdit && initial ? `/api/game-table-disadvantage/${initial.id}` : "/api/game-table-disadvantage",
        isEdit ? "PUT" : "POST",
        payload
      );
      router.push(`/table/${currentTableId}/disadvantages`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.disadvantage"));
      setSaving(false);
    }
  }

  const contextTableId = tableId ?? initial?.table_id ?? "";
  const contextTableTitle =
    tableTitle ?? tables?.find((entry) => entry.id === contextTableId)?.title;

  return (
    <FormShell
      tableId={contextTableId || undefined}
      tableTitle={contextTableTitle}
      resourceLabel="nav.disadvantages"
      actionLabel={isEdit ? "fr.dis.editTitle" : "fr.dis.newTitle"}
      title={isEdit ? t("fr.dis.editTitle") : t("fr.dis.newTitle")}
    >
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.costPoints")}</label>
              <input
                type="number"
                value={costPoints}
                onChange={(e) => setCostPoints(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.category")}</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t("fr.dis.categoryPh")}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fr.subcategory")}</label>
              <input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder={t("fr.dis.subcategoryPh")}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("fr.effect")}</label>
            <input
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              placeholder={t("fr.dis.effectPh")}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t("fr.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.dis.create")}
            </button>
            <Link
              href={currentTableId ? `/table/${currentTableId}/disadvantages` : "/narrator"}
              className={cancelCls}
            >
              {t("fr.cancel")}
            </Link>
          </div>
        </form>
    </FormShell>
  );
}