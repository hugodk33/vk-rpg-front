"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterSkill, NarrationAction, QueueEntry, TableCharacter } from "@/lib/types";
import { skillLabel, skillLevel } from "@/lib/skill";

/* ============================================================
   Turn — the player's active scene console.
   Built around *waiting*. The queue is a procession; dice
   unlock ONLY when this character is up, with a warm beacon on
   the tray. Rendered inside the player's unified tab panel.
   ============================================================ */

interface TurnPanelProps {
  chapter: number;
  part: string;
  latestTitle: string;
  latestNarration: string;
  actions: NarrationAction[];
  queue: QueueEntry[];
  roster: TableCharacter[];
  myId: string;
  mySkills: CharacterSkill[];
}

const queuePos = (e: QueueEntry): number => {
  const n = Number(e.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const attrMeta: Record<string, { label: string; hex: string }> = {
  st: { label: "ST", hex: "#f87171" },
  dx: { label: "DX", hex: "#34d399" },
  iq: { label: "IQ", hex: "#60a5fa" },
  ht: { label: "HT", hex: "#a78bfa" },
};

type Judgment = { crit: boolean; ok: boolean; text: string };
function judgeRoll(total: number, target: number): Judgment {
  if (total <= 4) return { crit: true, ok: true, text: "Critical success" };
  if (total >= 18 || (total === 17 && target <= 15))
    return { crit: true, ok: false, text: "Critical failure" };
  const m = target - total;
  return m >= 0
    ? { crit: false, ok: true, text: `Succeeded by ${m}` }
    : { crit: false, ok: false, text: `Failed by ${-m}` };
}

function SheetSummary({ c }: { c: TableCharacter }) {
  const s = c.sheet;
  if (!s) return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">No sheet</span>
  );
  const attrs = [
    { label: "ST", value: s.st ?? s.base_st, hex: "#f87171" },
    { label: "DX", value: s.dx ?? s.base_dx, hex: "#34d399" },
    { label: "IQ", value: s.iq ?? s.base_iq, hex: "#60a5fa" },
    { label: "HT", value: s.ht ?? s.base_ht, hex: "#a78bfa" },
  ];
  return (
    <span className="flex items-center gap-2.5">
      {attrs.map((a) => (
        <span key={a.label} className="inline-flex items-baseline gap-0.5">
          <span className="font-mono text-[9px] uppercase text-zinc-600">{a.label}</span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: a.hex }}>{a.value ?? "–"}</span>
        </span>
      ))}
      {s.current_hp != null && s.hp ? (
        <span className="font-mono text-[10px] text-zinc-500 ml-1">HP {s.current_hp}/{s.hp}</span>
      ) : null}
    </span>
  );
}

function rollDice(count: number, die: number, mod: number): { r: number[]; tot: number } {
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const v = Math.floor(Math.random() * die) + 1;
    r.push(v);
    sum += v;
  }
  return { r, tot: sum + mod };
}

export default function TurnPanel({
  chapter,
  part,
  latestTitle,
  latestNarration,
  actions,
  queue,
  roster,
  myId,
  mySkills,
}: TurnPanelProps) {
  const router = useRouter();
  const pendingQueue = [...queue]
    .filter((e) => (e.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));

  const myIndex = pendingQueue.findIndex((e) => e.character_id === myId);
  const isMyTurn = myIndex === 0;
  const notInQueue = myIndex === -1;

  const charName = (id?: string | null): string => {
    if (!id) return "Someone";
    const c = roster.find((x) => x.id === id);
    return c?.sheet?.name || c?.name || c?.user?.username || id;
  };
  const charIsMine = (id?: string | null): boolean => id === myId;

  /* ---- dice (narrator-controlled test) ---- */
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [effectNote, setEffectNote] = useState<string | null>(null);

  const myEntry = pendingQueue.find((e) => e.character_id === myId);
  const testAttr = (myEntry?.test_attr as "st" | "dx" | "iq" | "ht") || "dx";
  const testDie = myEntry?.test_dice || "6";
  const testCount = Math.max(1, Number(myEntry?.test_count ?? 3) || 3);
  const testMod = Number(myEntry?.test_mod ?? 0) || 0;
  const testSet = (myEntry?.test_dice ?? null) != null;

  const myChar = roster.find((c) => c.id === myId);
  const s = myChar?.sheet;
  const attrib = (): number => {
    const attr = testAttr;
    return s?.[attr] ?? s?.[`base_${attr}` as "base_st"] ?? 10;
  };

  const skillMode = myEntry?.test_kind === "skill" && !!myEntry.test_skill;
  const skillData = skillMode && myEntry.test_skill
    ? mySkills.find((sk) => sk.skill_id === myEntry.test_skill || sk.id === myEntry.test_skill) ?? null
    : null;
  const skillLevelVal = skillData ? skillLevel(skillData, myChar?.sheet ?? null) : null;
  const target = skillMode ? (skillLevelVal ?? 10) : attrib();
  const modValue = skillMode ? testMod : Math.floor((Number(attrib()) - 10) / 2) + testMod;
  const attrHex = skillMode ? "#fbbf24" : (attrMeta[testAttr]?.hex ?? "#3b82f6");
  const rollDisabled = () => !isMyTurn || !myId;

  function performRoll(): { r: number[]; tot: number } {
    const die = parseInt(testDie, 10);
    if (rollDisabled()) return { r: [], tot: 0 };
    const { r, tot } = rollDice(testCount, die, modValue);
    const j = judgeRoll(tot, target);
    setRolls(r);
    setTotal(tot);
    setJudgment(j);
    if (j.ok && skillMode && myEntry?.test_skill) {
      void applySkillConsequence(myEntry.test_skill);
      router.refresh();
    }
    return { r, tot };
  }

  async function applySkillConsequence(skillIdToApply: string) {
    try {
      const res = await fetch("/api/game-table-roll-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: myId, skill_id: skillIdToApply }),
      });
      const j = await res.json();
      if (j.success && Array.isArray(j.applied) && j.applied.length) {
        setEffectNote(`Effect applied: ${j.applied.map((a: { name?: string }) => a.name || "Effect").join(", ")}`);
      } else {
        setEffectNote(null);
      }
    } catch {
      setEffectNote(null);
    }
  }

  const counts = new Map<number, number>();
  for (const v of rolls) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());
  const sortedActions = [...actions].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));

  const waitingText = notInQueue
    ? "You're not in this scene's queue yet — hold for the narrator to call you in."
    : isMyTurn
      ? ""
      : `You're up after ${myIndex} ${myIndex === 1 ? "seat" : "seats"}.`;

  return (
    <div className="space-y-6">
      {/* context bar */}
      <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Chapter</span>
              <span className="font-mono text-xl font-bold text-blue-300 tabular-nums">{chapter}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60" aria-hidden />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Part</span>
              <span className="font-mono text-xl font-bold text-blue-300 tabular-nums">{part}</span>
            </div>
            {latestTitle ? (
              <>
                <span className="w-px h-6 bg-zinc-700/60 hidden sm:block" aria-hidden />
                <span className="text-sm text-zinc-300 hidden md:inline">{latestTitle}</span>
              </>
            ) : null}
          </div>
          <span
            className={`inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border ${
              isMyTurn ? "border-blue-500/50 text-blue-300" : "border-zinc-700/50 text-zinc-500"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"}`}
              style={isMyTurn ? { boxShadow: "0 0 8px rgba(59,130,246,.7)" } : undefined} />
            {isMyTurn ? "Your turn" : notInQueue ? "Not in queue" : "Waiting"}
          </span>
        </div>
        {latestNarration ? (
          <p className="text-sm text-zinc-400 leading-relaxed italic border-t border-zinc-700/40 px-5 py-3">{latestNarration}</p>
        ) : null}
      </div>

      {/* queue procession */}
      <section aria-label="Initiative queue">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">Turn order</span>
          <span className="flex-1 h-px bg-zinc-700/40" />
          <span className="font-mono text-[10px] text-zinc-600">{pendingQueue.length} in queue</span>
        </div>

        {pendingQueue.length === 0 ? (
          <div className="border border-dashed border-zinc-700/60 rounded-xl px-5 py-10 text-center">
            <p className="text-sm text-zinc-500">The queue is empty &mdash; the scene hasn&apos;t opened yet.</p>
          </div>
        ) : (
          <div className="relative space-y-2.5 pl-5">
            <span aria-hidden className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />
            {pendingQueue.map((entry, i) => {
              const cid = entry.character_id || "";
              const mine = charIsMine(cid);
              const up = i === 0;
              return (
                <div
                  key={entry.id}
                  className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                    up
                      ? "border-blue-600/50 bg-blue-700/10"
                      : mine
                        ? "border-blue-700/50 bg-blue-900/10"
                        : "border-zinc-700/40 bg-zinc-900/50"
                  }`}
                >
                  <span
                    className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 ${
                      up
                        ? "border-blue-400 bg-blue-500 beacon"
                        : mine
                          ? "border-blue-500 bg-zinc-950"
                          : "border-zinc-600 bg-zinc-800"
                    }`}
                    style={up ? { boxShadow: "0 0 10px rgba(59,130,246,.6)" } : undefined}
                  />
                  <span className="font-mono text-[11px] text-zinc-500 w-6 text-right shrink-0">
                    {up ? <span className="text-blue-400 font-bold">NOW</span> : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${mine ? "text-blue-200" : "text-zinc-200"}`}>
                      {charName(cid)}
                      {mine ? <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-blue-400">you</span> : null}
                    </div>
                    <div className="mt-0.5">
                      {roster.find((r) => r.id === cid) ? (
                        <SheetSummary c={roster.find((r) => r.id === cid)!} />
                      ) : null}
                    </div>
                  </div>
                  {up && mine ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-blue-300">Roll now</span>
                  ) : up ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-blue-400/70">acting</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* status banner */}
      {waitingText ? (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            isMyTurn
              ? "border-blue-500/40 bg-blue-700/10 text-blue-200"
              : "border-zinc-700/40 bg-zinc-900/40 text-zinc-400"
          }`}
        >
          {icon(isMyTurn ? "M13 10V3L4 14h7v7l9-11h-7z" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "w-5 h-5")}
          <span className="text-sm">
            {isMyTurn ? "It's your moment — the dice are live." : waitingText}
          </span>
        </div>
      ) : null}

      {/* dice tray */}
      <section aria-label="Dice tray">
        <div
          className="rounded-2xl border overflow-hidden relative transition-colors"
          style={{
            borderColor: isMyTurn ? "#3b82f655" : "#27272a",
            boxShadow: isMyTurn ? "0 0 40px -12px rgba(59,130,246,.45)" : undefined,
          }}
        >
          <div className="bg-zinc-900/90 p-5">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-700/40">
              <span className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"}`}
                style={isMyTurn ? { boxShadow: "0 0 10px rgba(251,191,36,.7)" } : undefined} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Acting now</span>
              <span className="text-sm font-semibold text-zinc-100">
                {pendingQueue[0] ? charName(pendingQueue[0].character_id) : "empty queue"}
              </span>
<span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                  target: <span style={{ color: attrHex }}>{target}</span> ({skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "—") : attrMeta[testAttr]?.label})
                </span>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Die</span>
                  <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">d{testDie}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Count</span>
                  <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">{testCount}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Mod</span>
                  <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">{testMod >= 0 ? `+${testMod}` : testMod}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">{skillMode ? "Skill" : "Attribute"}</span>
                  <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">
                    {skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "—") : testAttr.toUpperCase()}
                  </span>
                </div>
                <div className="w-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    {testSet
                      ? "Locked by the narrator — roll with these."
                      : "No test set yet — defaults locked until the narrator tunes it."}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 min-h-[3.5rem]">
                {rolls.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    {icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-7 h-7 text-zinc-600")}
                    {isMyTurn ? "It's your turn — roll to act." : "Dice unlock when it's your turn."}
                  </div>
                ) : (
                  rolls.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg border bg-zinc-800 flex items-center justify-center text-xl font-bold font-mono text-blue-300 shadow-inner" style={{ borderColor: "#3b82f655" }}>
                        {r}
                      </div>
                      {i < rolls.length - 1 ? <span className="text-zinc-600">+</span> : null}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {total !== null && judgment ? (
                  <div className={`rounded-lg border px-4 py-2.5 ${judgment.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"}`}>
                    <span className={`font-mono text-2xl font-bold tabular-nums ${judgment.ok ? "text-emerald-300" : "text-red-300"}`}>= {total}</span>
                    <span className={`block font-mono text-[11px] uppercase tracking-widest ${judgment.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {judgment.text}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">
                    Click <span className={isMyTurn ? "text-blue-400 font-semibold" : "text-zinc-500"}>Roll</span> to test.
                  </span>
                )}
                <button
                  onClick={performRoll}
                  disabled={rollDisabled()}
                  className={`${
                    isMyTurn
                      ? "bg-blue-600 hover:bg-blue-500 text-blue-950 shadow-lg shadow-blue-900/30"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  } text-sm font-bold px-6 py-2.5 rounded-lg transition-colors`}
                >
                  {icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-4 h-4 inline mr-1")}Roll {testCount}d{testDie}
                </button>
              </div>

              {effectNote ? (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-amber-300">{effectNote}</span>
                </div>
              ) : null}

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">3d6 curve</span>
                  <span className="flex-1 h-px bg-zinc-700/40" />
                </div>
                <div className="flex h-16 items-end gap-0.5 border-b border-zinc-700/40">
                  {Array.from({ length: 16 }, (_, i) => {
                    const face = i + 3;
                    const c = counts.get(face) ?? 0;
                    const isCurrent = total === face;
                    return (
                      <span key={face} className="flex-1 h-full flex items-end" title={`=${face}`}>
                        <span className={`w-full rounded-t-sm transition-[height] ${isCurrent ? (judgment?.ok ? "bg-emerald-400" : "bg-red-400") : c ? "bg-blue-500/50" : "bg-zinc-800"}`} style={{ height: `${c ? Math.max(8, (c / maxCount) * 100) : 3}%` }} />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {!isMyTurn ? (
            <div className="pointer-events-none absolute inset-0 bg-zinc-950/55 backdrop-blur-[1px] flex items-center justify-center">
              <div className="text-center px-6">
                <div className={`mx-auto mb-3 flex items-center justify-center w-12 h-12 rounded-full border-2 ${notInQueue ? "border-zinc-600" : "border-blue-600/50"}`}>
                  {icon(notInQueue ? "M12 8v8m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "w-6 h-6")}
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                  {notInQueue ? "Not in the queue" : `Waiting — ${myIndex} seat${myIndex === 1 ? "" : "s"} ahead`}
                </p>
                <p className="text-[13px] text-zinc-500 mt-1 max-w-xs mx-auto">
                  {notInQueue
                    ? "The dice stay sealed until the narrator opens the scene for you."
                    : "The dice stay sealed while another adventurer acts."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* recent rolls */}
      {sortedActions.length ? (
        <section aria-label="Recently rolled">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">Recently rolled</span>
            <span className="flex-1 h-px bg-zinc-700/40" />
          </div>
          <div className="space-y-1.5">
            {sortedActions.slice(-4).reverse().map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-zinc-400 border border-zinc-700/40 bg-zinc-900/50 rounded-lg px-3 py-2">
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  {a.character?.name || a.character?.username || "Someone"}
                </span>
                <span className="font-mono text-xs text-zinc-600">{a.dice_roll}</span>
                <span className="text-zinc-500 truncate flex-1 min-w-0">{a.description}</span>
                {a.result ? <span className="font-mono text-base font-bold">{a.result}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
