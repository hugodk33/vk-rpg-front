"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import type { SkillItem } from "@/lib/types";

export interface SkillFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: SkillItem;
}

const TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: "Physical", label: "Física", hint: "Testes contra Destreza (DX)" },
  { value: "Mental", label: "Mental", hint: "Testes contra Inteligência (IQ)" },
  { value: "Social", label: "Social", hint: "Testes contra Vontade" },
];

const DIFFICULTIES: Array<{ value: string; label: string }> = [
  { value: "Easy", label: "Fácil" },
  { value: "Average", label: "Média" },
  { value: "Hard", label: "Difícil" },
  { value: "Very Hard", label: "Muito difícil" },
];

export default function SkillForm({ tableId, tables, initial }: SkillFormProps) {
  const router = useRouter();
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
      setError("Selecione a mesa.");
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
      setError(err instanceof Error ? err.message : "Falha ao salvar a perícia.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? "Editar Perícia" : "Nova Perícia"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && !tableId ? (
            <div>
              <label className={labelCls}>Mesa</label>
              <select
                value={currentTableId}
                onChange={(e) => setCurrentTableId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="" disabled>
                  Selecione a mesa
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
            <label className={labelCls}>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">{TYPES.find((t) => t.value === type)?.hint}</p>
            </div>
            <div>
              <label className={labelCls}>Dificuldade</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoria</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="ex: Combate, Magia, Conhecimento" />
            </div>
            <div>
              <label className={labelCls}>Subcategoria</label>
              <input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={inputCls} placeholder="ex: Espada, Fogo, Erudição" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Perícia"}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/skills` : "/narrator"} className={cancelCls}>
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}