"use client";

import { useState } from "react";
import DiceMystery from "@/components/session/DiceMystery";

type Judgment = {
  crit: boolean;
  success: boolean;
  text: string;
};

function judge(sum: number, target: number): Judgment {
  if (sum <= 4) return { crit: true, success: true, text: "Sucesso crítico!" };
  if (sum >= 18 || (sum === 17 && target <= 15)) {
    return { crit: true, success: false, text: "Falha crítica." };
  }
  const margin = target - sum;
  return margin >= 0
    ? { crit: false, success: true, text: `Sucesso por ${margin}` }
    : { crit: false, success: false, text: `Falha por ${-margin}` };
}

export default function GmDiceRoller() {
  const [target, setTarget] = useState(12);
  const [dice, setDice] = useState<[number, number, number] | null>(null);
  const [sum, setSum] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [rollId, setRollId] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);

  function roll() {
    const d = [
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
    ] as [number, number, number];
    const total = d[0] + d[1] + d[2];
    setDice(d);
    setSum(total);
    setJudgment(judge(total, target));
    setRevealed(false);
    setRollId((id) => id + 1);
    setHistory((h) => [...h, total]);
  }

  function reset() {
    setDice(null);
    setSum(null);
    setJudgment(null);
    setHistory([]);
    setRollId(0);
    setRevealed(false);
  }

  const counts = new Map<number, number>();
  for (const s of history) counts.set(s, (counts.get(s) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());

  return (
    <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Rolar contra o alvo
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Alvo</span>
          <button
            type="button"
            onClick={() => setTarget((t) => Math.max(3, t - 1))}
            disabled={target <= 3}
            aria-label="Diminuir alvo"
            className="w-8 h-8 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-800 hover:text-green-400 transition-colors disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
          >
            −
          </button>
          <span className="w-10 text-center font-mono text-lg font-bold text-zinc-100 tabular-nums">
            {target}
          </span>
          <button
            type="button"
            onClick={() => setTarget((t) => Math.min(18, t + 1))}
            disabled={target >= 18}
            aria-label="Aumentar alvo"
            className="w-8 h-8 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-800 hover:text-green-400 transition-colors disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-5 flex-wrap">
        <div className="flex gap-2" aria-hidden>
          {rollId === 0 ? (
            [0, 1, 2].map((i) => (
              <span
                key={`rest-${i}`}
                className={`flex w-14 h-14 items-center justify-center rounded-lg border-2 bg-zinc-800/60 font-mono text-2xl font-bold border-zinc-700 text-zinc-600`}
              >
                {"–"}
              </span>
            ))
          ) : (
            <DiceMystery
              burn={rollId}
              count={3}
              die={6}
              faces={dice ?? []}
              onReveal={() => setRevealed(true)}
              chipClass="border-green-900/70 bg-zinc-800/70"
              faceClass="text-zinc-100"
              glowColor="rgba(52,211,153,0.35)"
              size={56}
            />
          )}
        </div>
        <p
          key={rollId}
          aria-live="polite"
          className={`min-h-[3rem] font-mono text-sm leading-snug ${
            judgment
              ? judgment.success
                ? "text-emerald-400"
                : "text-red-400"
              : "text-zinc-500"
          }`}
        >
          {revealed && sum !== null && judgment ? (
            <>
              <span className={`block text-2xl font-bold tabular-nums ${judgment.crit ? "" : "text-zinc-100"}`}>
                = {sum}
              </span>
              <span className="uppercase">{judgment.text}</span>
            </>
          ) : (
            <>
              <span className="block text-base">{rollId === 0 ? "Defina um alvo e role." : "Os dados ainda estão no ar…"}</span>
              <span className="text-zinc-600 uppercase text-[11px] tracking-wider">{rollId === 0 ? "" : `3d6 contra o alvo ${target}`}</span>
            </>
          )}
        </p>
      </div>

      <div
        className="mt-6 flex h-20 items-end gap-1 border-b border-zinc-700 pb-px"
        role="img"
        aria-label={
          history.length > 0
            ? `Distribuição de ${history.length} rolagens, de 3 a 18`
            : "Distribuição vazia de rolagens"
        }
      >
        {Array.from({ length: 16 }, (_, i) => {
          const face = i + 3;
          const count = counts.get(face) ?? 0;
          const isCurrent = revealed && sum === face;
          return (
            <span key={face} className="flex h-full flex-1 items-end">
              <span
                className={`w-full rounded-t-sm transition-[height] ${
                  isCurrent ? "bg-green-600" : count > 0 ? "bg-zinc-600" : "bg-zinc-800"
                }`}
                style={{ height: `${count > 0 ? (count / maxCount) * 100 : 4}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span>3</span>
        <span>{history.length === 0 ? "a curva aparece à medida que você rola" : `${history.length} rolagens`}</span>
        <span>18</span>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={roll}
          disabled={rollId > 0 && !revealed}
          className="bg-green-900/60 hover:bg-green-800 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rollId > 0 && !revealed ? "Rolando…" : "Rolar 3d6"}
        </button>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors"
          >
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}
