"use client";

import { useState } from "react";

type Judgment = {
  crit: boolean;
  success: boolean;
  text: string;
};

function judge(sum: number, target: number): Judgment {
  if (sum <= 4) return { crit: true, success: true, text: "Critical success!" };
  if (sum >= 18 || (sum === 17 && target <= 15)) {
    return { crit: true, success: false, text: "Critical failure." };
  }
  const margin = target - sum;
  return margin >= 0
    ? { crit: false, success: true, text: `Succeeded by ${margin}` }
    : { crit: false, success: false, text: `Failed by ${-margin}` };
}

export default function GmDiceRoller() {
  const [target, setTarget] = useState(12);
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
    setJudgment(judge(total, target));
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
    <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Roll vs target
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Target</span>
          <button
            type="button"
            onClick={() => setTarget((t) => Math.max(3, t - 1))}
            disabled={target <= 3}
            aria-label="Decrease target"
            className="w-8 h-8 rounded-lg border border-zinc-700 text-zinc-300 hover:border-amber-600 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
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
            aria-label="Increase target"
            className="w-8 h-8 rounded-lg border border-zinc-700 text-zinc-300 hover:border-amber-600 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-5 flex-wrap">
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={`${rollId}-${i}`}
              className={`flex w-14 h-14 items-center justify-center rounded-lg border-2 bg-zinc-800/60 font-mono text-2xl font-bold ${
                dice ? "border-amber-600/70 text-zinc-100" : "border-zinc-700 text-zinc-600"
              }`}
            >
              {dice ? dice[i] : "–"}
            </span>
          ))}
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
          {sum !== null && judgment ? (
            <>
              <span className={`block text-2xl font-bold tabular-nums ${judgment.crit ? "" : "text-zinc-100"}`}>
                = {sum}
              </span>
              <span className="uppercase">{judgment.text}</span>
            </>
          ) : (
            "Set a target and roll."
          )}
        </p>
      </div>

      <div
        className="mt-6 flex h-20 items-end gap-1 border-b border-zinc-700 pb-px"
        role="img"
        aria-label={
          history.length > 0
            ? `Distribution of ${history.length} rolls, from 3 to 18`
            : "Empty distribution of rolls"
        }
      >
        {Array.from({ length: 16 }, (_, i) => {
          const face = i + 3;
          const count = counts.get(face) ?? 0;
          const isCurrent = sum === face;
          return (
            <span key={face} className="flex h-full flex-1 items-end">
              <span
                className={`w-full rounded-t-sm transition-[height] ${
                  isCurrent ? "bg-amber-400" : count > 0 ? "bg-zinc-600" : "bg-zinc-800"
                }`}
                style={{ height: `${count > 0 ? (count / maxCount) * 100 : 4}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span>3</span>
        <span>{history.length === 0 ? "the curve appears as you roll" : `${history.length} rolls`}</span>
        <span>18</span>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={roll}
          className="bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Roll 3d6
        </button>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
