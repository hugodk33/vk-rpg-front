"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import FormShell from "./FormShell";
import EntityModifiers from "@/components/modifiers/EntityModifiers";
import { useTranslation } from "@/lib/i18n";
import type { Advantage } from "@/lib/types";

export interface AdvantageFormProps {
  tableId?: string;
  tableTitle?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: Advantage;
}

export default function AdvantageForm({ tableId, tableTitle, tables, initial }: AdvantageFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [costPoints, setCostPoints] = useState(initial?.cost_points != null ? String(initial.cost_points) : "");
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
      cost_points: costPoints === "" ? 0 : Number(costPoints),
      category: category || null,
      subcategory: subcategory || null,
      description,
    };

    try {
      await submitJson<{ success?: boolean }>(
        isEdit && initial ? `/api/game-table-advantage/${initial.id}` : "/api/game-table-advantage",
        isEdit ? "PUT" : "POST",
        payload
      );
      router.push(`/table/${currentTableId}/advantages`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.advantage"));
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
      resourceLabel="nav.advantages"
      actionLabel={isEdit ? "fr.adv.editTitle" : "fr.adv.newTitle"}
      title={isEdit ? t("fr.adv.editTitle") : t("fr.adv.newTitle")}
      wide
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
              {(tables ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
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
              placeholder={t("fr.adv.categoryPh")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("fr.subcategory")}</label>
            <input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={t("fr.adv.subcategoryPh")}
              className={inputCls}
            />
          </div>
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

        <EntityModifiers
          ownerField="advantage_id"
          ownerId={initial?.id}
          tableId={currentTableId || undefined}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
            {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.adv.create")}
          </button>
          <Link
            href={currentTableId ? `/table/${currentTableId}/advantages` : "/narrator"}
            className={cancelCls}
          >
            {t("fr.cancel")}
          </Link>
        </div>
      </form>
    </FormShell>
  );
}