"use client";

/* ============================================================
   CategoryField — a linha de categoria/recurso (vantagem,
   desvantagem, perícia, item) recolhida por padrão.

   A categoria nunca foi obrigatória, mas os dois campos de texto
   sempre ocupavam uma linha inteira do formulário — em criar era a
   primeira coisa que o narrador via, antes do nome. Aqui a seção
   fica fechada mostrando só o resumo (ou "Sem categoria"), e abre
   sob demanda.

   Ao abrir, o narrador escolhe entre as categorias que a mesa já
   usa, digita uma nova, ou deixa vazio. A lista vem da própria
   listagem do recurso, então as opções são sempre as categorias
   que já existem naquele catálogo.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { inputCls, labelCls } from "./formStyles";
import { useTranslation } from "@/lib/i18n";

export type CategoryEntity = "advantage" | "disadvantage" | "skill" | "item";

/** Sentinel shown by the selects to switch into free text. */
const NEW = "__new__";

const ENDPOINT: Record<CategoryEntity, (tableId: string) => string> = {
  advantage: (id) => `/game-table-advantages/${id}`,
  disadvantage: (id) => `/game-table-disadvantages/${id}`,
  skill: (id) => `/game-table-skills/${id}`,
  item: (id) => `/game-table-items/${id}`,
};

const LIST_KEY: Record<CategoryEntity, string> = {
  advantage: "advantages",
  disadvantage: "disadvantages",
  skill: "skills",
  item: "items",
};

interface CategoryRow {
  category?: string | null;
  subcategory?: string | null;
}

export default function CategoryField({
  tableId,
  entity,
  category,
  subcategory,
  onCategory,
  onSubcategory,
  initiallyOpen = false,
  hasSubcategory = true,
  categoryPlaceholder,
  subcategoryPlaceholder,
}: {
  tableId?: string;
  entity: CategoryEntity;
  category: string;
  subcategory: string;
  onCategory: (v: string) => void;
  onSubcategory: (v: string) => void;
  /** Editing an entry that already has a category: open, so the value is visible. */
  initiallyOpen?: boolean;
  /** Items have no subcategory column. */
  hasSubcategory?: boolean;
  categoryPlaceholder?: string;
  subcategoryPlaceholder?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(
    initiallyOpen || Boolean(category) || Boolean(subcategory)
  );
  const [newCategory, setNewCategory] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState(false);

  const [rows, setRows] = useState<CategoryRow[]>([]);

  useEffect(() => {
    if (!tableId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    api<Record<string, unknown>>(ENDPOINT[entity](tableId))
      .then((res) => {
        if (cancelled) return;
        const list = (res[LIST_KEY[entity]] ?? []) as CategoryRow[];
        setRows(list);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId, entity]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      const v = row.category?.trim();
      if (v) seen.add(v);
    }
    const current = category.trim();
    if (current) seen.add(current);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows, category]);

  const subcategories = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      const v = row.subcategory?.trim();
      if (!v) continue;
      /* Narrowed by the chosen category; with none picked, every option. */
      if (category && row.category?.trim() !== category) continue;
      seen.add(v);
    }
    const current = subcategory.trim();
    if (current) seen.add(current);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows, category, subcategory]);

  const hasValue = Boolean(category || subcategory);

  const summary = !category && !subcategory
    ? t("fr.cat.none")
    : [category, subcategory].filter(Boolean).join(" / ");

  const pickCategory = (value: string) => {
    if (value === NEW) {
      setNewCategory(true);
      return;
    }
    setNewCategory(false);
    onCategory(value);
    /* The subcategory belonged to the category just left behind. */
    if (subcategory && value && !subcategories.includes(subcategory)) {
      onSubcategory("");
    }
  };

  const pickSubcategory = (value: string) => {
    if (value === NEW) {
      setNewSubcategory(true);
      return;
    }
    setNewSubcategory(false);
    onSubcategory(value);
  };

  const selectCls = `${inputCls} pr-8`;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-zinc-400 text-sm font-semibold uppercase tracking-wider">
            {t("fr.category")}
          </p>
          <p
            className={`text-sm mt-0.5 truncate ${
              hasValue ? "text-zinc-200" : "text-zinc-600"
            }`}
          >
            {summary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-green-300/90 hover:text-green-200 border border-zinc-700/60 rounded-md px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
        >
          {expanded
            ? t("fr.cat.collapse")
            : hasValue
              ? t("fr.cat.edit")
              : t("fr.cat.add")}
        </button>
      </div>

      {expanded ? (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>{t("fr.category")}</label>
            {newCategory ? (
              <input
                autoFocus
                value={category}
                onChange={(e) => onCategory(e.target.value)}
                placeholder={categoryPlaceholder}
                className={inputCls}
              />
            ) : (
              <select
                value={category}
                onChange={(e) => pickCategory(e.target.value)}
                className={selectCls}
              >
                <option value="">{t("fr.cat.none")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW}>{t("fr.cat.newOption")}</option>
              </select>
            )}
            {newCategory ? (
              <button
                type="button"
                onClick={() => {
                  setNewCategory(false);
                  onCategory("");
                }}
                className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {t("fr.cat.cancelNew")}
              </button>
            ) : null}
          </div>

          {hasSubcategory ? (
            <div>
              <label className={labelCls}>{t("fr.subcategory")}</label>
              {newSubcategory ? (
                <input
                  autoFocus
                  value={subcategory}
                  onChange={(e) => onSubcategory(e.target.value)}
                  placeholder={subcategoryPlaceholder}
                  className={inputCls}
                />
              ) : (
                <select
                  value={subcategory}
                  onChange={(e) => pickSubcategory(e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t("fr.cat.none")}</option>
                  {subcategories.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value={NEW}>{t("fr.cat.newSubOption")}</option>
                </select>
              )}
              {newSubcategory ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewSubcategory(false);
                    onSubcategory("");
                  }}
                  className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {t("fr.cat.cancelNew")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
