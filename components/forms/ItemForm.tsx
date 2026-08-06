"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import type { Item } from "@/lib/types";

export interface ItemFormProps {
  initial?: Item;
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  characters?: Array<{ id: string; name: string }>;
}

const QUALITIES = ["", "ruim", "boa", "excelente", "master"];
const CONDITIONS = ["", "danificado", "quebrado", "gasto"];

export default function ItemForm({ initial, tableId, tables, characters }: ItemFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [type, setType] = useState(initial?.type ?? 1);
  const [weight, setWeight] = useState(initial?.weight != null ? String(initial.weight) : "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [quality, setQuality] = useState(initial?.quality ?? "");
  const [condition, setCondition] = useState(initial?.condition ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [characterId, setCharacterId] = useState("");
  const [damageValue, setDamageValue] = useState("");
  const [range, setRange] = useState("");
  const [armorValue, setArmorValue] = useState("");
  const [fit, setFit] = useState("");
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
      ...(isEdit && initial ? { id: initial.id } : {}),
      table_id: currentTableId,
      name,
      type,
      category,
      weight: weight === "" ? null : Number(weight),
      dimensions,
      description,
      quality,
      condition,
      holder_id: "",
      owner_id: "",
      skill_user_id: "",
      skill_level: "",
      character_id: characterId || null,
      damage_value: type === 1 ? damageValue || null : null,
      range: type === 1 ? range || "Melee" : null,
      skill_id: "",
      armor_value: type === 2 || type === 3 ? armorValue || null : null,
      fit: type === 2 || type === 3 ? fit || "Torso" : null,
    };
    try {
      await submitJson<{ success?: boolean }>("/api/game-table-item", isEdit ? "PUT" : "POST", payload);
      router.push(`/mesa/${currentTableId}/itens`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o item.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-amber-100 mb-6">
          {isEdit ? "Editar Item" : "Novo Item"}
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
              <label className={labelCls}>Categoria</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
                placeholder="ex: Arma, Armadura, Poção"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={type} onChange={(e) => setType(Number(e.target.value))} className={inputCls}>
                <option value={1}>Arma</option>
                <option value={2}>Armadura</option>
                <option value={3}>Roupa</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Dimensões</label>
              <input
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className={inputCls}
                placeholder="ex: 30x5cm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Qualidade</label>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} className={inputCls}>
                <option value="">Comum</option>
                {QUALITIES.slice(1).map((q) => (
                  <option key={q} value={q}>
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Condição</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
                <option value="">Intacto</option>
                {CONDITIONS.slice(1).map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(characters?.length ?? 0) > 0 ? (
            <div>
              <label className={labelCls}>Atribuir a personagem</label>
              <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} className={inputCls}>
                <option value="">Nenhum</option>
                {(characters ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {type === 1 ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Dano</label>
                <input
                  value={damageValue}
                  onChange={(e) => setDamageValue(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 2d6+2"
                />
              </div>
              <div>
                <label className={labelCls}>Alcance</label>
                <input value={range} onChange={(e) => setRange(e.target.value)} className={inputCls} placeholder="Melee" />
              </div>
            </div>
          ) : null}

          {type === 2 || type === 3 ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>DR</label>
                <input
                  value={armorValue}
                  onChange={(e) => setArmorValue(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 4"
                />
              </div>
              <div>
                <label className={labelCls}>Ajuste</label>
                <input value={fit} onChange={(e) => setFit(e.target.value)} className={inputCls} placeholder="Torso" />
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Item"}
            </button>
            <a href={currentTableId ? `/mesa/${currentTableId}/itens` : "/narrator"} className={cancelCls}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
