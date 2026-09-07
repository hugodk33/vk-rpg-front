"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";

export interface TableFormProps {
  initial?: { id: string; title: string; system: string; intro: string };
  narratorOptions: Array<{ id: string; name: string }>;
  defaultNarratorId?: string;
}

export default function TableForm({ initial, narratorOptions, defaultNarratorId }: TableFormProps) {
  const router = useRouter();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [system, setSystem] = useState(initial?.system ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [narratorId, setNarratorId] = useState(defaultNarratorId ?? narratorOptions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await submitJson<{ success?: boolean }>(`/api/game-table/edit/${initial.id}`, "PUT", { title, system, intro });
        router.push("/narrator");
        router.refresh();
      } else {
        const result = await submitJson<{ id: string }>("/api/create-game-table", "POST", {
          narratorId,
          title,
          system,
          intro,
        });
        router.push(`/table/${result.id}`);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a mesa.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? "Editar Mesa" : "Nova Mesa"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && (
            <div>
              <label className={labelCls}>Narrador</label>
              <select
                value={narratorId}
                onChange={(e) => setNarratorId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="" disabled>
                  Selecione um narrador
                </option>
                {narratorOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Sistema</label>
            <input
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className={inputCls}
              placeholder="ex: GURPS"
            />
          </div>

          <div>
            <label className={labelCls}>Introdução</label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Mesa"}
            </button>
            <a href="/narrator" className={cancelCls}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
