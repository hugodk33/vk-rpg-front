"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import type { Item, DamageEntry } from "@/lib/types";
import { DAMAGE_TYPES, generateGurpsDamageEntries, damageEntriesToJson, parseDamageEntries } from "@/lib/damage";

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
  const [damageEntries, setDamageEntries] = useState<DamageEntry[]>(() =>
    parseDamageEntries(initial?.damage_value)
  );
  const [newDmgType, setNewDmgType] = useState("gdp");
  const [newDmgSt, setNewDmgSt] = useState("10");
  const [newDmgValue, setNewDmgValue] = useState("");
  const [quickFillType, setQuickFillType] = useState("gdp+bal");
  const [quickFillMin, setQuickFillMin] = useState("4");
  const [quickFillMax, setQuickFillMax] = useState("20");
  const [range, setRange] = useState("");
  const [armorValue, setArmorValue] = useState("");
  const [fit, setFit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addDamageEntry() {
    if (!newDmgValue.trim()) return;
    setDamageEntries((prev) => [
      ...prev,
      { damage: newDmgValue.trim(), type: newDmgType, st: Number(newDmgSt) || 10 },
    ]);
    setNewDmgValue("");
  }

  function removeDamageEntry(index: number) {
    setDamageEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function applyQuickFill() {
    const types = quickFillType.split("+").filter(Boolean);
    const entries = generateGurpsDamageEntries(types, Number(quickFillMin) || 4, Number(quickFillMax) || 20);
    setDamageEntries(entries);
  }

  function sortDamageEntries() {
    setDamageEntries((prev) =>
      [...prev].sort((a, b) => a.st - b.st || a.type.localeCompare(b.type))
    );
  }

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
      damage_value: type === 1 && damageEntries.length > 0 ? damageEntriesToJson(damageEntries) : null,
      range: type === 1 ? range || "Melee" : null,
      skill_id: "",
      armor_value: type === 2 || type === 3 ? armorValue || null : null,
      fit: type === 2 || type === 3 ? fit || "Torso" : null,
    };
    try {
      await submitJson<{ success?: boolean }>("/api/game-table-item", isEdit ? "PUT" : "POST", payload);
      router.push(`/table/${currentTableId}/items`);
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Alcance</label>
                  <input value={range} onChange={(e) => setRange(e.target.value)} className={inputCls} placeholder="Melee" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Tabela de Dano</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={quickFillType}
                      onChange={(e) => setQuickFillType(e.target.value)}
                      className={inputCls}
                    >
                      <option value="gdp">Golpe de Ponta</option>
                      <option value="bal">Balanço</option>
                      <option value="gdp+bal">Golpe de Ponta + Balanço</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      value={quickFillMin}
                      onChange={(e) => setQuickFillMin(e.target.value)}
                      className={inputCls}
                      placeholder="ST min"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      value={quickFillMax}
                      onChange={(e) => setQuickFillMax(e.target.value)}
                      className={inputCls}
                      placeholder="ST max"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyQuickFill}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-3 py-2 rounded-lg transition-colors"
                  >
                    Preencher
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Entradas de Dano</label>
                {damageEntries.length > 0 ? (
                  <div className="mb-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-700/40">
                          <th className="text-left text-zinc-500 font-medium py-1 px-2">ST</th>
                          <th className="text-left text-zinc-500 font-medium py-1 px-2">Tipo</th>
                          <th className="text-left text-zinc-500 font-medium py-1 px-2">Dano</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {damageEntries.map((entry, i) => (
                          <tr key={i} className="border-b border-zinc-800/60">
                            <td className="text-zinc-300 font-mono py-1 px-2">{entry.st}</td>
                            <td className="text-zinc-400 py-1 px-2">{DAMAGE_TYPES[entry.type] || entry.type}</td>
                            <td className="text-red-300 font-bold font-mono py-1 px-2">{entry.damage}</td>
                            <td className="py-1 px-1">
                              <button
                                type="button"
                                onClick={() => removeDamageEntry(i)}
                                className="text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={sortDamageEntries}
                      className="text-zinc-500 hover:text-zinc-300 text-xs mt-1 transition-colors"
                    >
                      Ordenar por ST
                    </button>
                  </div>
                ) : (
                  <p className="text-zinc-600 text-sm italic mb-2">Nenhuma entrada de dano</p>
                )}

                <div className="flex gap-2 items-end">
                  <div className="w-20">
                    <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">ST</label>
                    <input
                      type="number"
                      value={newDmgSt}
                      onChange={(e) => setNewDmgSt(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="w-40">
                    <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Tipo</label>
                    <select
                      value={newDmgType}
                      onChange={(e) => setNewDmgType(e.target.value)}
                      className={inputCls}
                    >
                      {Object.entries(DAMAGE_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Dano</label>
                    <input
                      value={newDmgValue}
                      onChange={(e) => setNewDmgValue(e.target.value)}
                      className={inputCls}
                      placeholder="ex: 1D+2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addDamageEntry}
                    disabled={!newDmgValue.trim()}
                    className="bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
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
            <a href={currentTableId ? `/table/${currentTableId}/items` : "/narrator"} className={cancelCls}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
