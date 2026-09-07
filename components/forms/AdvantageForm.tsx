"use client";

import { useState } from "react";
import { cancelCls, disabledSubmitCls, inputCls, labelCls } from "./formStyles";
import type { Advantage } from "@/lib/types";

export interface AdvantageFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: Advantage;
}

export default function AdvantageForm({ tableId, tables, initial }: AdvantageFormProps) {
  const isEdit = !!initial;
  const [currentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [costPoints, setCostPoints] = useState(initial?.cost_points != null ? String(initial.cost_points) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-lime-100 mb-6">
          {isEdit ? "Editar Vantagem" : "Nova Vantagem"}
        </h1>

        <div className="mb-6 rounded-lg bg-zinc-900 border border-zinc-600 px-4 py-3 text-sm text-zinc-400">
          O backend ainda não expõe rota de criação/edição de vantagens (POST/PUT). Este formulário
          está desabilitado por enquanto.
        </div>

        <form className="space-y-5">
          {!isEdit && !tableId && (tables?.length ?? 0) > 0 ? (
            <div>
              <label className={labelCls}>Mesa</label>
              <select defaultValue={currentTableId} className={inputCls} disabled>
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
              <input value={name} onChange={(e) => setName(e.target.value)} required disabled className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Custo (pontos)</label>
              <input
                type="number"
                value={costPoints}
                onChange={(e) => setCostPoints(e.target.value)}
                disabled
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
                disabled
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Subcategoria</label>
              <input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="ex: Combate, Magia"
                disabled
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" disabled className={disabledSubmitCls}>
              {isEdit ? "Salvar Alterações" : "Criar Vantagem"}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/advantages` : "/narrator"} className={cancelCls}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
