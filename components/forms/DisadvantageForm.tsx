"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import type { Disadvantage } from "@/lib/types";

export interface DisadvantageFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: Disadvantage;
}

export default function DisadvantageForm({ tableId, tables, initial }: DisadvantageFormProps) {
  const router = useRouter();
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
      setError("Selecione a mesa.");
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
      setError(err instanceof Error ? err.message : "Falha ao salvar a desvantagem.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? "Editar Desvantagem" : "Nova Desvantagem"}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Custo (pontos)</label>
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
              <label className={labelCls}>Categoria</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ex: Física, Mental, Social"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Subcategoria</label>
              <input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="ex: Autocontrole"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Efeito</label>
            <input
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              placeholder="ex: -2 em testes de Vontade"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
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
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Desvantagem"}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/disadvantages` : "/narrator"} className={cancelCls}>
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}