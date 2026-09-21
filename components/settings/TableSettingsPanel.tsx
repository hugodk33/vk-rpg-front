"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { Item, TableSettings } from "@/lib/types";

/* ============================================================
   Table Settings — regras de mesa configuráveis por tabela.
   Cada grupo é uma escolha de duas vias (modo de jogo).
   ============================================================ */

interface ChoiceProps {
  active: boolean;
  onClick?: () => void;
  title: string;
  tag: string;
  body: string;
  disabled?: boolean;
}

function Choice({ active, onClick, title, tag, body, disabled }: ChoiceProps) {
  const activeCls = active
    ? "border-emerald-500/60 bg-emerald-700/10 ring-1 ring-emerald-500/30"
    : "border-zinc-700/50 bg-zinc-800/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 text-left rounded-xl border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 disabled:opacity-40 disabled:cursor-not-allowed ${activeCls}`}
    >
      <span className="flex items-center gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${active ? "text-emerald-300" : "text-zinc-500"}`}>
          {tag}
        </span>
        {active ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </span>
      <span className="block text-sm font-semibold text-zinc-100 mt-1">{title}</span>
      <span className="block text-xs text-zinc-500 mt-1 leading-snug">{body}</span>
    </button>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5">{index}</span>
        <div>
          <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface TableSettingsPanelProps {
  tableId: string;
  initialSettings: TableSettings | null;
  items: Item[];
}

export default function TableSettingsPanel({
  tableId,
  initialSettings,
  items,
}: TableSettingsPanelProps) {
  const s = initialSettings ?? {
    table_id: tableId,
    turn_end_mode: "after_test" as const,
    item_mode: "gm" as const,
    reaction_mode: "gm" as const,
    gm_adds_item: 1,
    money_item_id: null,
    starting_shop: 0,
    starting_points: 150,
  };

  const [turnEndMode, setTurnEndMode] = useState<"after_test" | "after_move">(s.turn_end_mode);
  const [itemMode, setItemMode] = useState<"points" | "gm">(s.item_mode);
  const [reactionMode, setReactionMode] = useState<"points" | "gm">(s.reaction_mode);
  const [gmAddsItem, setGmAddsItem] = useState(Boolean(s.gm_adds_item));
  const [moneyItemId, setMoneyItemId] = useState(s.money_item_id ?? "");
  const [startingShop, setStartingShop] = useState(Boolean(s.starting_shop));
  const [startingPoints, setStartingPoints] = useState(s.starting_points ?? 150);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api("/game-table-settings", {
        method: "PUT",
        body: JSON.stringify({
          table_id: tableId,
          turn_end_mode: turnEndMode,
          item_mode: itemMode,
          reaction_mode: reactionMode,
          gm_adds_item: gmAddsItem ? 1 : 0,
          money_item_id: moneyItemId || null,
          starting_shop: startingShop ? 1 : 0,
          starting_points: startingPoints,
        }),
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section
        index="01"
        title="Encerramento do turno"
        hint="Quando o personagem que está na vez termina a sua rodada."
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={turnEndMode === "after_test"}
            onClick={() => setTurnEndMode("after_test")}
            tag="Após um teste"
            title="Depois de um teste"
            body="O turno encerra quando o personagem resolve um teste (rolagem contra atributo ou perícia)."
          />
          <Choice
            active={turnEndMode === "after_move"}
            onClick={() => setTurnEndMode("after_move")}
            tag="Após mover"
            title="Depois de mover + virar-se"
            body="O turno encerra quando o personagem se desloca no mapa e define a direção em que fica apontando."
          />
        </div>
      </Section>

      <Section
        index="02"
        title="Itens dos personagens"
        hint="Como um personagem recebe novos itens — com recurso próprio ou pelo mestre."
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={itemMode === "points"}
            onClick={() => setItemMode("points")}
            tag="Com pontos"
            title="Gastar pontos da ficha"
            body="O personagem gasta pontos de ficha para adicionar o item ao seu inventário."
          />
          <Choice
            active={itemMode === "gm"}
            onClick={() => setItemMode("gm")}
            tag="Pelo mestre"
            title="O mestre concede"
            body="O mestre adiciona os itens de acordo com a ficha do personagem (riqueza inicial etc.)."
          />
        </div>
      </Section>

      <Section
        index="03"
        title="Teste de reação"
        hint="Como a reação de um NPC a uma abordagem é determinada."
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={reactionMode === "points"}
            onClick={() => setReactionMode("points")}
            tag="Com pontos"
            title="Com pontos"
            body="O jogador gasta pontos da ficha para tentar influenciar a reação."
          />
          <Choice
            active={reactionMode === "gm"}
            onClick={() => setReactionMode("gm")}
            tag="Pelo mestre"
            title="O mestre resolve"
            body="O mestre define a reação do NPC diretamente, sem rolagem."
          />
        </div>
      </Section>

      <Section
        index="04"
        title="Mestre & loja inicial"
        hint="Perdões do mestre concede itens e a moeda de uma loja inicial."
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={gmAddsItem}
              onChange={(e) => setGmAddsItem(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-100">O mestre pode adicionar o item diretamente</span>
              <span className="block text-xs text-zinc-500 mt-0.5">
                Mesmo quando a compra é por pontos, o mestre continua podendo entregar itens na mão.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Item de dinheiro (moeda da loja inicial)</span>
              <select
                value={moneyItemId}
                onChange={(e) => setMoneyItemId(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
              >
                <option value="" className="bg-zinc-800">Nenhum — sem moeda</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id} className="bg-zinc-800">
                    {it.name}
                    {typeof it.cost === "number" ? ` — $${it.cost}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none pt-6">
              <input
                type="checkbox"
                checked={startingShop}
                onChange={(e) => setStartingShop(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">Loja inicial habilitada</span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  Os personagens começam com o item de dinheiro para comprar em uma loja inicial.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Section>

      <Section
        index="05"
        title="Pontos para a primeira ficha"
        hint="O orçamento que cada jogador recebe para criar a primeira ficha."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[100, 150, 200, 250].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStartingPoints(n)}
                className={`font-mono text-sm font-bold tabular-nums px-4 py-2 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 ${
                  startingPoints === n
                    ? "border-emerald-500/60 bg-emerald-700/10 text-emerald-300"
                    : "border-zinc-700/50 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
              Outro valor (pontos)
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              value={startingPoints}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0) setStartingPoints(Math.floor(v));
              }}
              className="w-full max-w-xs bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
            />
            <span className="block text-xs text-zinc-500 mt-1.5">
              O jogador usa essa quantidade para montar a ficha na rota de primeiro acesso.
            </span>
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="font-mono text-[12px] font-semibold uppercase tracking-widest px-5 py-2.5 rounded-lg bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    </div>
  );
}