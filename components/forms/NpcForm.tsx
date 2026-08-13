"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, disabledSubmitCls, inputCls, labelCls, submitCls } from "./formStyles";
import type { NpcViewer } from "@/lib/types";

export interface NpcFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: NpcViewer;
}

const STATUSES = [
  { value: "ally", label: "Aliado" },
  { value: "neutral", label: "Neutro" },
  { value: "enemy", label: "Inimigo" },
  { value: "boss", label: "Chefe" },
];

const ATTRS: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string }> = [
  { key: "st", label: "ST" },
  { key: "dx", label: "DX" },
  { key: "iq", label: "IQ" },
  { key: "ht", label: "HT" },
];

export default function NpcForm({ tableId, tables, initial }: NpcFormProps) {
  const router = useRouter();
  const isEdit = !!initial;
  const sheet = initial?.character?.sheet;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table?.id ?? "");
  const [name, setName] = useState(sheet?.name ?? initial?.character?.name ?? "");
  const [points, setPoints] = useState(sheet?.points != null ? String(sheet.points) : "");
  const [status, setStatus] = useState(initial?.npc?.status ?? "neutral");
  const [st, setSt] = useState(sheet?.st != null ? String(sheet.st) : "10");
  const [dx, setDx] = useState(sheet?.dx != null ? String(sheet.dx) : "10");
  const [iq, setIq] = useState(sheet?.iq != null ? String(sheet.iq) : "10");
  const [ht, setHt] = useState(sheet?.ht != null ? String(sheet.ht) : "10");
  const [hp, setHp] = useState(sheet?.hp != null ? String(sheet.hp) : "10");
  const [fatigue, setFatigue] = useState(sheet?.fatigue != null ? String(sheet.fatigue) : "10");
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
      table_id: currentTableId,
      user_id: null,
      status,
      sheet: {
        name,
        bio: "",
        backstory: "",
        points: points === "" ? 0 : Number(points),
        hp: hp === "" ? 10 : Number(hp),
        st: st === "" ? 10 : Number(st),
        dx: dx === "" ? 10 : Number(dx),
        iq: iq === "" ? 10 : Number(iq),
        ht: ht === "" ? 10 : Number(ht),
        fatigue: fatigue === "" ? 10 : Number(fatigue),
        encumbrance: "None",
      },
      advantages: [],
      disadvantages: [],
      skills: [],
    };
    try {
      await submitJson<{ success?: boolean }>("/api/game-table-npc", "POST", payload);
      router.push(`/mesa/${currentTableId}/cenas`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o NPC.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-amber-100 mb-6">
          {isEdit ? "Editar NPC" : "Novo NPC"}
        </h1>

        {isEdit ? (
          <div className="mb-6 rounded-lg bg-zinc-900 border border-zinc-600 px-4 py-3 text-sm text-zinc-400">
            O backend ainda não expõe rota de edição de NPC (PUT). A edição está indisponível por
            enquanto — o salvamento está desabilitado.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="border-b border-zinc-700/40 pb-4">
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Identidade</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pontos</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Atributos</h2>
            <div className="grid grid-cols-4 gap-3">
              {ATTRS.map(({ key, label }) => {
                const value = { st, dx, iq, ht }[key];
                const setters: Record<"st" | "dx" | "iq" | "ht", (v: string) => void> = {
                  st: setSt,
                  dx: setDx,
                  iq: setIq,
                  ht: setHt,
                };
                return (
                  <div key={key}>
                    <label className={`${labelCls} text-center`}>{label}</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setters[key](e.target.value)}
                      className={`${inputCls} text-center`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>HP</label>
              <input type="number" value={hp} onChange={(e) => setHp(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>FP</label>
              <input
                type="number"
                value={fatigue}
                onChange={(e) => setFatigue(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            {isEdit ? (
              <button type="button" disabled className={disabledSubmitCls}>
                Salvar Alterações
              </button>
            ) : (
              <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
                {saving ? "Salvando..." : "Criar NPC"}
              </button>
            )}
            <a href={currentTableId ? `/mesa/${currentTableId}/cenas` : "/narrator"} className={cancelCls}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
