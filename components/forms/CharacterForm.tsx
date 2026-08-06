"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { inputCls, labelCls, submitCls } from "./formStyles";
import type { Advantage, CharacterViewer, Disadvantage, GameTableAdvantages, GameTableDisadvantages, GameTableItems, GameTableSkills, Item, SkillItem } from "@/lib/types";

export interface CharacterFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: CharacterViewer;
}

interface Selection {
  id: string;
  name: string;
  cost_points: number;
}

interface UserOption {
  id: string;
  username?: string;
  email?: string;
  type?: number;
}

const ATTR_COSTS: Record<"st" | "dx" | "iq" | "ht", number> = { st: 10, dx: 20, iq: 20, ht: 10 };
const ATTR_NAMES: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string }> = [
  { key: "st", label: "ST" },
  { key: "dx", label: "DX" },
  { key: "iq", label: "IQ" },
  { key: "ht", label: "HT" },
];

export default function CharacterForm({ tableId, tables, initial }: CharacterFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? (initial ? initial.table?.id ?? "" : ""));
  const [charType, setCharType] = useState<"pc" | "npc">(
    initial ? (!initial.character.user?.id || initial.character.user?.type === 2 ? "npc" : "pc") : "pc"
  );
  const [name, setName] = useState(initial?.character?.name ?? "");
  const [bio, setBio] = useState(initial?.character?.sheet?.bio ?? "");
  const [backstory, setBackstory] = useState(initial?.character?.sheet?.backstory ?? "");
  const [userId, setUserId] = useState(initial?.character?.userId ?? "");
  const totalPoints = initial?.character?.sheet?.points ?? 150;
  const [attrs, setAttrs] = useState<Record<"st" | "dx" | "iq" | "ht", number>>({
    st: initial?.character?.sheet?.st ?? 10,
    dx: initial?.character?.sheet?.dx ?? 10,
    iq: initial?.character?.sheet?.iq ?? 10,
    ht: initial?.character?.sheet?.ht ?? 10,
  });
  const [pecLines, setPecLines] = useState(
    (initial?.peculiarities ?? [])
      .map((p) => `${p.name || ""}: ${p.cost_points ?? 0}: ${p.effect || ""}`)
      .join("\n")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [available, setAvailable] = useState<{
    advantages: Advantage[];
    disadvantages: Disadvantage[];
    skills: SkillItem[];
    items: Item[];
  }>({ advantages: [], disadvantages: [], skills: [], items: [] });

  const [selAdv, setSelAdv] = useState<Selection[]>(
    (initial?.character?.advantages ?? []).map((a) => ({
      id: a.advantage_id || a.id,
      name: a.name,
      cost_points: a.cost_points ?? 0,
    }))
  );
  const [selDis, setSelDis] = useState<Selection[]>(
    (initial?.character?.disadvantages ?? []).map((d) => ({
      id: d.disadvantage_id || d.id,
      name: d.name,
      cost_points: d.cost_points ?? 0,
    }))
  );
  const [selSkills, setSelSkills] = useState<Selection[]>(
    (initial?.character?.skills ?? []).map((s) => ({
      id: s.skill_id || s.id,
      name: s.skill_name || s.name || "",
      cost_points: s.cost_points ?? 0,
    }))
  );
  const [selItems, setSelItems] = useState<Selection[]>(
    (initial?.character?.items ?? []).map((i) => ({ id: i.item_id || i.id, name: i.name, cost_points: 0 }))
  );

  useEffect(() => {
    if (!currentTableId) return;
    let active = true;
    (async () => {
      try {
        const [adv, dis, sk, items, us] = await Promise.all([
          fetch(`/api/game-table-advantages/${currentTableId}`).then((r) => r.json()),
          fetch(`/api/game-table-disadvantages/${currentTableId}`).then((r) => r.json()),
          fetch(`/api/game-table-skills/${currentTableId}`).then((r) => r.json()),
          fetch(`/api/game-table-items/${currentTableId}`).then((r) => r.json()),
          fetch(`/api/users`).then((r) => r.json()),
        ]);
        if (!active) return;
        setAvailable({
          advantages: (adv as GameTableAdvantages)?.advantages ?? (Array.isArray(adv) ? adv : []),
          disadvantages: (dis as GameTableDisadvantages)?.disadvantages ?? (Array.isArray(dis) ? dis : []),
          skills: (sk as GameTableSkills)?.skills ?? (Array.isArray(sk) ? sk : []),
          items: (items as GameTableItems)?.items ?? (Array.isArray(items) ? items : []),
        });
        setUsers(Array.isArray(us) ? us : []);
      } catch {
        /* forms degrade gracefully */
      }
    })();
    return () => {
      active = false;
    };
  }, [currentTableId]);

  const spent = useMemo(() => {
    const attrCost = ATTR_NAMES.reduce((sum, { key }) => sum + (attrs[key] - 10) * ATTR_COSTS[key], 0);
    const advCost = selAdv.reduce((s, a) => s + (a.cost_points || 0), 0);
    const disCost = selDis.reduce((s, d) => s + (d.cost_points || 0), 0);
    const skCost = selSkills.reduce((s, sk) => s + (sk.cost_points || 0), 0);
    return attrCost + advCost + disCost + skCost;
  }, [attrs, selAdv, selDis, selSkills]);

  function adjAttr(key: "st" | "dx" | "iq" | "ht", delta: number) {
    if (delta > 0 && spent + ATTR_COSTS[key] > totalPoints) return;
    const next = attrs[key] + delta;
    if (next < 1 || next > 50) return;
    setAttrs((prev) => ({ ...prev, [key]: next }));
  }

  function toggleSelection(type: "advantages" | "disadvantages", item: { id: string; name: string; cost_points?: number }, checked: boolean) {
    const apply = (prev: Selection[]): Selection[] => {
      if (checked) {
        const exists = prev.some((s) => s.id === item.id);
        if (exists) return prev;
        return [...prev, { id: item.id, name: item.name, cost_points: item.cost_points ?? 0 }];
      }
      return prev.filter((s) => s.id !== item.id);
    };
    if (type === "advantages") setSelAdv(apply);
    else setSelDis(apply);
  }

  function toggleSkill(item: { id: string; name: string }, checked: boolean) {
    if (checked) {
      setSelSkills((prev) =>
        prev.some((s) => s.id === item.id) ? prev : [...prev, { id: item.id, name: item.name, cost_points: 1 }]
      );
    } else {
      setSelSkills((prev) => prev.filter((s) => s.id !== item.id));
    }
  }

  function adjSkill(id: string, delta: number) {
    setSelSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, cost_points: Math.max(0, (s.cost_points || 0) + delta) } : s))
    );
  }

  function toggleItem(item: { id: string; name: string }, checked: boolean) {
    if (checked) {
      setSelItems((prev) =>
        prev.some((s) => s.id === item.id) ? prev : [...prev, { id: item.id, name: item.name, cost_points: 0 }]
      );
    } else {
      setSelItems((prev) => prev.filter((s) => s.id !== item.id));
    }
  }

  const peculiarities = pecLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":").map((s) => s.trim());
      return { name: parts[0] || "", cost_points: parseInt(parts[1], 10) || 0, effect: parts[2] || "" };
    });

  async function doSave() {
    if (!currentTableId) {
      setError("Selecione a mesa.");
      return;
    }
    setSaving(true);
    setError(null);

    const sheet = {
      name,
      bio,
      backstory,
      points: totalPoints,
      hp: attrs.ht,
      st: attrs.st,
      dx: attrs.dx,
      iq: attrs.iq,
      ht: attrs.ht,
      fatigue: initial?.character?.sheet?.fatigue ?? 10,
      encumbrance: initial?.character?.sheet?.encumbrance ?? "None",
    };
    const advantages = selAdv.map((a) => ({ advantage_id: a.id, name: a.name, cost_points: a.cost_points, effect: "" }));
    const disadvantages = selDis.map((d) => ({ disadvantage_id: d.id, name: d.name, cost_points: d.cost_points, effect: "" }));
    const skills = selSkills.map((s) => ({ skill_id: s.id, cost_points: s.cost_points, effect: "" }));

    try {
      if (isEdit && initial) {
        await submitJson<{ success?: boolean }>("/api/game-table-character", "PUT", {
          id: initial.character.id,
          user_id: charType === "npc" ? "" : userId,
          table_id: currentTableId,
        });
        router.push(`/personagem/${initial.character.id}`);
      } else if (charType === "npc") {
        const result = await submitJson<{ character_id: string }>("/api/game-table-npc", "POST", {
          table_id: currentTableId,
          user_id: "",
          status: "Alive",
          sheet,
          advantages,
          disadvantages,
          skills,
        });
        router.push(`/personagem/${result.character_id}`);
      } else {
        const result = await submitJson<{ character_id: string }>("/api/game-table-character", "POST", {
          table_id: currentTableId,
          user_id: userId,
          sheet,
          advantages,
          disadvantages,
          skills,
          items: selItems.map((i) => ({ item_id: i.id })),
          peculiarities,
        });
        router.push(`/personagem/${result.character_id}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o personagem.");
      setSaving(false);
    }
  }

  const budgetPct = totalPoints > 0 ? Math.min(100, (spent / totalPoints) * 100) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doSave();
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {!isEdit ? (
        <div className="sticky top-14 z-40 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-700/50 -mx-4 px-4 py-3 mb-6">
          <div className="flex items-center justify-center gap-6 max-w-3xl mx-auto">
            <div className="text-md font-bold text-amber-400 whitespace-nowrap">
              {spent} / {totalPoints}
            </div>
            <div className="flex-1 max-w-md">
              <div className="w-full bg-zinc-800 rounded-full h-3">
                <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-amber-100">
            {isEdit ? "Editar Personagem" : "Novo Personagem"}
          </h1>
          <p className="text-zinc-400 text-sm">{isEdit ? "Salvar alterações" : "Crie um personagem para a mesa"}</p>
        </div>
        {isEdit ? (
          <button
            onClick={() => void doSave()}
            disabled={saving}
            className={`${submitCls} disabled:opacity-50`}
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-amber-100 mb-4">Identidade</h2>

            {!isEdit && !tableId ? (
              <div className="mb-4">
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
                <label className={labelCls}>Bio</label>
                <input value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>História</label>
              <textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} rows={2} className={inputCls} />
            </div>

            {!isEdit ? (
              <>
                <div className="mt-4 pt-4 border-t border-zinc-700/40">
                  <label className={`${labelCls} mb-2`}>Tipo</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="charType"
                        value="pc"
                        checked={charType === "pc"}
                        onChange={() => setCharType("pc")}
                        className="w-4 h-4 border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <span className="text-zinc-200 text-sm">Personagem Jogador</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="charType"
                        value="npc"
                        checked={charType === "npc"}
                        onChange={() => setCharType("npc")}
                        className="w-4 h-4 border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <span className="text-zinc-200 text-sm">NPC</span>
                    </label>
                  </div>
                </div>
                {charType === "pc" ? (
                  <div className="mt-3">
                    <label className={labelCls}>Atribuir a jogador</label>
                    <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
                      <option value="">Selecione um jogador</option>
                      {users
                        .filter((u) => u.type !== 2)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username || u.email || u.id}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-amber-100 mb-4">Atributos</h2>
            <div className="grid grid-cols-2 gap-y-5 gap-x-6">
              {ATTR_NAMES.map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjAttr(key, -1)}
                      className="w-8 h-8 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-lg font-bold text-amber-100">{attrs[key]}</span>
                    <button
                      type="button"
                      onClick={() => adjAttr(key, 1)}
                      className="w-8 h-8 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold flex items-center justify-center leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-700/40">
              <label className={labelCls}>HP</label>
              <div className="bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-2.5 text-zinc-400 font-mono text-center">
                {attrs.ht}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-amber-100">Vantagens</h2>
                <span className="text-sm text-zinc-500">{selAdv.length} selecionadas</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {available.advantages.map((a) => {
                  const isSelected = selAdv.some((s) => s.id === a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                        isSelected ? "bg-zinc-700/40 border border-amber-500/30" : "border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelection("advantages", { id: a.id, name: a.name, cost_points: a.cost_points }, e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">{a.name || "Sem nome"}</div>
                        {a.description ? <div className="text-xs text-zinc-500 truncate">{a.description}</div> : null}
                      </div>
                      <span className="text-xs font-mono text-zinc-400 shrink-0">
                        {a.cost_points != null ? (a.cost_points >= 0 ? "+" : "") + a.cost_points : "±0"}
                      </span>
                    </label>
                  );
                })}
                {available.advantages.length === 0 ? (
                  <p className="text-zinc-600 text-sm">Nenhuma vantagem cadastrada nesta mesa.</p>
                ) : null}
              </div>
            </section>

            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-amber-100">Itens</h2>
                <span className="text-sm text-zinc-500">{selItems.length} selecionados</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {available.items.map((item) => {
                  const isSelected = selItems.some((s) => s.id === item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                        isSelected ? "bg-zinc-700/40 border border-amber-500/30" : "border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleItem({ id: item.id, name: item.name }, e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">{item.name || "Sem nome"}</div>
                        <div className="text-xs text-zinc-500 truncate">
                          {item.category || ""}
                          {item.weight != null ? ` · ${item.weight} kg` : ""}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {available.items.length === 0 ? (
                  <p className="text-zinc-600 text-sm">Nenhum item cadastrado nesta mesa.</p>
                ) : null}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-amber-100">Desvantagens</h2>
                <span className="text-sm text-zinc-500">{selDis.length} selecionadas</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {available.disadvantages.map((d) => {
                  const isSelected = selDis.some((s) => s.id === d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                        isSelected ? "bg-zinc-700/40 border border-amber-500/30" : "border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelection("disadvantages", { id: d.id, name: d.name, cost_points: d.cost_points }, e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">{d.name || "Sem nome"}</div>
                        {d.description ? <div className="text-xs text-zinc-500 truncate">{d.description}</div> : null}
                      </div>
                      <span className="text-xs font-mono text-zinc-400 shrink-0">
                        {d.cost_points != null ? (d.cost_points >= 0 ? "+" : "") + d.cost_points : "±0"}
                      </span>
                    </label>
                  );
                })}
                {available.disadvantages.length === 0 ? (
                  <p className="text-zinc-600 text-sm">Nenhuma desvantagem cadastrada nesta mesa.</p>
                ) : null}
              </div>
            </section>

            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-amber-100">Habilidades</h2>
                <span className="text-sm text-zinc-500">{selSkills.length} selecionadas</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {available.skills.map((sk) => {
                  const sel = selSkills.find((s) => s.id === sk.id);
                  return (
                    <div
                      key={sk.id}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 ${
                        sel ? "bg-zinc-700/40 border border-amber-500/30" : "border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!sel}
                        onChange={(e) => toggleSkill({ id: sk.id, name: sk.name }, e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{sk.name || "Sem nome"}</div>
                        <div className="text-xs text-zinc-500">
                          {sk.predefinition_type || ""}
                          {sk.predefinition_difficulty ? ` · ${sk.predefinition_difficulty}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjSkill(sk.id, -1)}
                          className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-bold flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm font-mono text-amber-400 w-6 text-center">{sel?.cost_points ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => adjSkill(sk.id, 1)}
                          className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-bold flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {available.skills.length === 0 ? (
                  <p className="text-zinc-600 text-sm">Nenhuma habilidade cadastrada nesta mesa.</p>
                ) : null}
              </div>
            </section>

            <section className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-amber-100 mb-3">Peculiaridades</h2>
              <p className="text-xs text-zinc-500 mb-2">
                Uma por linha. Formato: <code>Nome: custo: efeito</code>
              </p>
              <textarea
                value={pecLines}
                onChange={(e) => setPecLines(e.target.value)}
                rows={4}
                placeholder={"Mal Humor: -5: -2 em testes de reação.\nCoruja Noturna: -5: +1 de alerta após a meia-noite."}
                className={`${inputCls} font-mono text-sm`}
              />
            </section>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!isEdit ? (
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : "Criar Personagem"}
            </button>
            <a href={currentTableId ? `/mesa/${currentTableId}/personagens` : "/narrator"} className="text-zinc-400 hover:text-zinc-300 text-sm transition-colors">
              Cancel
            </a>
          </div>
        ) : null}
      </form>
    </div>
  );
}
