"use client";

import { useState } from "react";

const TARGET = 12;

type Judgment = {
  crit: boolean;
  success: boolean;
  text: string;
};

function judge(sum: number): Judgment {
  if (sum <= 4) return { crit: true, success: true, text: "Sucesso crítico!" };
  if (sum >= 18) return { crit: true, success: false, text: "Falha crítica." };
  const margin = TARGET - sum;
  return margin >= 0
    ? { crit: false, success: true, text: `Bem-sucedido por ${margin}.` }
    : { crit: false, success: false, text: `Falhou por ${-margin}.` };
}

export default function DiceRoller() {
  const [dice, setDice] = useState<[number, number, number] | null>(null);
  const [sum, setSum] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [rollId, setRollId] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  function roll() {
    const d = [
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
    ] as [number, number, number];
    const total = d[0] + d[1] + d[2];
    setDice(d);
    setSum(total);
    setJudgment(judge(total));
    setRollId((id) => id + 1);
    setHistory((h) => [...h, total]);
  }

  function reset() {
    setDice(null);
    setSum(null);
    setJudgment(null);
    setHistory([]);
    setRollId(0);
  }

  const counts = new Map<number, number>();
  for (const s of history) counts.set(s, (counts.get(s) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());

  return (
    <div className="flex h-full flex-col border-2 border-ink/80 bg-paper-dim/50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pencil">
          Teste contra {TARGET}-
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-pencil">
          role baixo
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={`${rollId}-${i}`}
              className={`flex h-16 w-13 items-center justify-center border-2 border-ink/70 bg-paper font-mono text-2xl font-medium text-ink ${
                dice ? "anim-pip" : ""
              }`}
            >
              {dice ? dice[i] : "–"}
            </span>
          ))}
        </div>
        <p
          key={rollId}
          aria-live="polite"
          className={`min-h-12 flex-1 font-mono text-sm leading-snug ${
            judgment?.crit ? "anim-stamp font-semibold text-stamp" : "text-ink"
          }`}
        >
          {sum !== null && judgment ? (
            <>
              = {sum}
              <br />
              <span className="uppercase">{judgment.text}</span>
            </>
          ) : (
            <span className="text-pencil">role 3d6 e tire {TARGET} ou menos</span>
          )}
        </p>
      </div>

      <div
        className="mt-6 flex h-20 items-end gap-1 border-b border-ink/50 pb-px"
        role="img"
        aria-label={
          history.length > 0
            ? `Distribuição de ${history.length} rolagens, de 3 a 18`
            : "Distribuição vazia das rolagens"
        }
      >
        {Array.from({ length: 16 }, (_, i) => {
          const face = i + 3;
          const count = counts.get(face) ?? 0;
          const isCurrent = sum === face;
          return (
            <span key={face} className="flex h-full flex-1 items-end">
              <span
                className={`w-full transition-[height] ${
                  isCurrent
                    ? "bg-stamp"
                    : count > 0
                      ? "bg-ink/25"
                      : "bg-ink/10"
                }`}
                style={{ height: `${count > 0 ? (count / maxCount) * 100 : 3}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-pencil">
        <span>3</span>
        <span>{history.length === 0 ? "a curva aparece quando você rola" : `${history.length} rolagens`}</span>
        <span>18</span>
      </div>

      <div className="mt-auto flex items-center gap-4 pt-6">
        <button
          type="button"
          onClick={roll}
          className="stretch-form bg-ink px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-paper transition-colors hover:bg-stamp"
        >
          Rolar 3d6
        </button>
        {history.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="font-mono text-xs uppercase tracking-[0.14em] text-pencil underline underline-offset-4 hover:text-stamp"
          >
            zerar
          </button>
        )}
      </div>
    </div>
  );
}
