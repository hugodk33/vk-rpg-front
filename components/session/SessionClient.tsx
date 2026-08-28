"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { NarrationAction, QueueEntry, Sheet } from "@/lib/types";

/* ============================================================
   Session Console
   Three tabs organizing the narrator/player work:
     · TURN   — the initiative queue as horizontal cards.
     · DICE   — an intuitive dice tray (rolled against attribute).
     · JOURNAL — the session diary + roll slips.
   The context bar (Chapter · Part · latest action) stays fixed
   above the tabs.
   ============================================================ */

interface SessionChar {
  id: string;
  name?: string;
  username?: string;
  st?: number;
  dx?: number;
  iq?: number;
  ht?: number;
  sheet?: Sheet | null;
}

interface SessionClientProps {
  tableId: string;
  chapter: number;
  part: string;
  latestTitle: string;
  latestNarration: string;
  latestSceneId: string;
  latestMoment: number;
  characters: SessionChar[];
  actions: NarrationAction[];
  queue?: QueueEntry[];
  npcIds?: string[];
  role?: "narrator" | "player";
}

type SessionTab = "turn" | "dice" | "journal";

const queuePos = (entry: QueueEntry): number => {
  const n = Number(entry.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const inputCls =
  "w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-700/60 transition-colors";

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const TABS: Array<{ key: SessionTab; label: string; icon: string }> = [
  { key: "turn", label: "Turn", icon: "M4 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm0 8a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" },
  { key: "dice", label: "Dice", icon: "M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3zM5 20l1-1M19 20l1-1" },
  { key: "journal", label: "Journal", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
];

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

export default function SessionClient({
  tableId,
  chapter,
  part,
  latestTitle,
  latestNarration,
  latestSceneId,
  latestMoment,
  characters,
  actions,
  queue = [],
  npcIds = [],
  role = "narrator",
}: SessionClientProps) {
  const isPlayer = role === "player";
  const router = useRouter();
  const [tab, setTab] = useState<SessionTab>("turn");

  const pendingQueue = [...queue]
    .filter((q) => (q.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));
  const nextQueuePos =
    pendingQueue.length > 0 ? Math.max(...pendingQueue.map(queuePos)) + 1 : 1;

  const [modal, setModal] = useState<null | "chapter" | "moment" | "narration">(null);
  const [modalTitle, setModalTitle] = useState("");
  const [narrationChars, setNarrationChars] = useState<string[]>([]);
  const [narrationText, setNarrationText] = useState("");

  const [queueChar, setQueueChar] = useState("");

  const charName = (charId?: string | null): string => {
    if (!charId) return "Unknown";
    const c = characters.find((x) => x.id === charId);
    return c?.name || c?.username || "Unknown";
  };

  async function addToQueue() {
    if (!queueChar) return;
    try {
      await fetch("/api/game-table-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: queueChar, queue: String(nextQueuePos), status: "pending" }),
      });
      setQueueChar("");
      router.refresh();
    } catch {
      /* ignore */
    }
  }

  async function removeFromQueue(entry: QueueEntry) {
    try {
      await fetch("/api/game-table-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, character_id: entry.character_id ?? null, action_id: entry.action_id ?? null, queue: "", status: "done" }),
      });
      router.refresh();
    } catch {
      /* ignore */
    }
  }

  async function advanceQueue(characterId: string) {
    const entry = pendingQueue.find((q) => q.character_id === characterId);
    if (!entry) return;
    await fetch("/api/game-table-queue", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, character_id: entry.character_id ?? null, action_id: entry.action_id ?? null, queue: String(nextQueuePos), status: "pending" }),
    });
  }

  /* ---- dice ---- */
  const [diceType, setDiceType] = useState("6");
  const [diceCount, setDiceCount] = useState(3);
  const [diceMod, setDiceMod] = useState(0);
  const [actSkill, setActSkill] = useState("dx");
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [actRoll, setActRoll] = useState("");
  const [actTarget, setActTarget] = useState("");
  const [actDesc, setActDesc] = useState("");

  const actorCharId = pendingQueue[0]?.character_id || "";
  const selectedChar = characters.find((c) => c.id === actorCharId);
  const attrib = (): number => {
    if (!selectedChar) return 10;
    const attr = actSkill as "st" | "dx" | "iq" | "ht";
    return selectedChar[attr] ?? selectedChar.sheet?.[attr] ?? 10;
  };
  const modValue = isPlayer ? diceMod : Math.floor((Number(attrib()) - 10) / 2) + diceMod;
  const attrHex = attrMeta[actSkill]?.hex ?? "#fbbf24";

  function performRoll(): { r: number[]; tot: number } {
    const die = parseInt(diceType, 10);
    const r: number[] = [];
    let sum = 0;
    for (let i = 0; i < diceCount; i++) {
      const v = Math.floor(Math.random() * die) + 1;
      r.push(v);
      sum += v;
    }
    const tot = sum + modValue;
    setRolls(r);
    setTotal(tot);
    setJudgment(judgeRoll(tot, attrib()));
    return { r, tot };
  }

  function rollBtn() {
    const { r } = performRoll();
    setActRoll(`${diceCount}d${diceType} [ ${r.join(" , ")} ]`);
  }

  async function copyRoll() {
    const text = `${rolls.join("+")}=${total ?? 0}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  /* ---- modal submits ---- */
  async function submitChapter() {
    if (!modalTitle) return;
    const res = await fetch("/api/game-table-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId, title: modalTitle, chapter: chapter + 1, moment: 0 }),
    });
    const j = await res.json();
    if (j.success) { setModal(null); setModalTitle(""); router.refresh(); }
    else alert("Error: " + (j.error || "Unknown"));
  }

  async function submitMoment() {
    if (!modalTitle) return;
    const res = await fetch("/api/game-table-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId, title: modalTitle, chapter, moment: latestMoment + 1 }),
    });
    const j = await res.json();
    if (j.success) { setModal(null); setModalTitle(""); router.refresh(); }
    else alert("Error: " + (j.error || "Unknown"));
  }

  async function submitNarration() {
    if (!modalTitle) return;
    const opted = characters.filter((c) => narrationChars.includes(c.id));
    const prefix = opted.length
      ? `**${opted.map((c) => c.name || c.username || "Unknown").join(", ")}**: `
      : "";
    const res = await fetch("/api/game-table-narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId, scene_id: latestSceneId, title: modalTitle, narration: prefix + narrationText, moment: latestMoment }),
    });
    const j = await res.json();
    if (j.success) { setModal(null); setModalTitle(""); setNarrationChars([]); setNarrationText(""); router.refresh(); }
    else alert("Error: " + (j.error || "Unknown"));
  }

  async function addAction() {
    if (!actorCharId) { alert("No one is up in the queue"); return; }
    if (!actDesc) { alert("Enter an action description"); return; }
    const payload = {
      narrations_id: null,
      character_id: actorCharId,
      description: actDesc,
      dice_roll: actRoll || null,
      queue: 1,
      target: actTarget || null,
      multitarget: false,
    };
    try {
      const res = await fetch("/api/game-table-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        try { await advanceQueue(actorCharId); } catch { /* ignore */ }
        setActDesc(""); setActRoll(""); setActTarget(""); router.refresh();
      } else alert("Error: " + (j.error || "Unknown"));
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  /* ---- helpers ---- */
  const actorIsNpc = npcIds.includes(actorCharId);
  const attrMetaEntry = attrMeta[actSkill];

  const counts = new Map<number, number>();
  for (const s of rolls) counts.set(s, (counts.get(s) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());

  const sortedActions = [...actions].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));

  return (
    <>
      {/* ---- CONTEXT BAR (fixed) ---- */}
      <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Chapter</span>
              <span className="font-mono text-xl font-bold text-amber-400 tabular-nums">{chapter}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60" aria-hidden />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Part</span>
              <span className="font-mono text-xl font-bold text-amber-400 tabular-nums">{part}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60 hidden sm:block" aria-hidden />
            {latestTitle ? (
              <span className="text-sm text-zinc-300 hidden md:inline">{latestTitle}</span>
            ) : null}
          </div>
          {!isPlayer ? (
            <div className="flex gap-2 flex-wrap">
              {[
                { m: "chapter" as const, label: "+ Chapter", hex: "#fbbf24" },
                { m: "moment" as const, label: "+ Part", hex: "#a1a1aa" },
                { m: "narration" as const, label: "+ Narration", hex: "#a1a1aa" },
              ].map((b) => (
                <button
                  key={b.m}
                  onClick={() => setModal(b.m)}
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: `${b.hex}55`, color: b.hex }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {latestNarration ? (
          <p className="text-sm text-zinc-400 leading-relaxed italic border-t border-zinc-700/40 px-5 py-3">{latestNarration}</p>
        ) : null}
      </div>

      {/* ---- TAB SWITCHER ---- */}
      <div role="tablist" aria-label="Session console" className="inline-flex bg-zinc-800/50 border border-zinc-700/40 rounded-lg p-0.5 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
              tab === t.key ? "bg-zinc-700 text-amber-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(t.icon, "w-3.5 h-3.5")}
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= TURN ================= */}
      {tab === "turn" ? (
        <div className="space-y-4">
          {pendingQueue.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingQueue.map((entry, i) => {
                const charId = entry.character_id || "";
                const name = charName(charId);
                const isNext = i === 0;
                const isNpc = npcIds.includes(charId);
                return (
                  <div
                    key={entry.id}
                    className={`relative rounded-xl border p-4 transition-colors ${
                      isNext
                        ? "border-amber-600/60 bg-amber-700/10 shadow-[0_0_0_1px_rgba(245,158,11,.15),0_10px_30px_-18px_rgba(245,158,11,.35)]"
                        : "border-zinc-700/40 bg-zinc-800/40 hover:bg-zinc-800/60"
                    }`}
                  >
                    {isNext ? (
                      <span className="absolute -top-2.5 left-3 font-mono text-[9px] tracking-widest uppercase px-1.5 py-px rounded-full bg-amber-500 text-amber-950 font-bold">
                        Up now
                      </span>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${isNpc ? "bg-amber-400" : "bg-blue-400"}`}
                        style={{ boxShadow: isNext ? "0 0 8px rgba(245,158,11,.6)" : undefined }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-100 truncate">
                          {charId ? (
                            <Link href={`/character/${charId}`} className="hover:text-amber-300">{name}</Link>
                          ) : name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          {isNpc ? "NPC" : "Player"}
                        </div>
                      </div>
                      {!isPlayer && !isNext ? (
                        <button
                          onClick={() => removeFromQueue(entry)}
                          aria-label={`Remove ${name} from queue`}
                          className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                        >
                          {icon("M6 18L18 6M6 6l12 12", "w-4 h-4")}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Order #{i + 1}</span>
                      <span className="flex-1 h-px bg-zinc-700/40" />
                      {isNext ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Now</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-zinc-700/60 rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-zinc-500">The queue is empty — pick who acts next.</p>
            </div>
          )}

          {!isPlayer ? (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/40 p-3">
              <select
                value={queueChar}
                onChange={(e) => setQueueChar(e.target.value)}
                aria-label="Who enters the queue"
                className={`${inputCls} flex-1`}
              >
                <option value="">Who acts next?…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.username || "Unknown"}{npcIds.includes(c.id) ? " — NPC" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={addToQueue}
                disabled={!queueChar}
                className="font-mono text-[12px] font-semibold uppercase tracking-widest px-4 py-2 rounded-lg border border-amber-600 text-amber-400 hover:bg-amber-700/10 transition-colors disabled:opacity-40 w-full sm:w-auto"
              >
                + Add to queue
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ================= DICE ================= */}
      {tab === "dice" ? (
        <div className="grid grid-cols-1 gap-5">
          {/* tray */}
          <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
            {/* acting now */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-700/40">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px rgba(245,158,11,.6)" }} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Acting now</span>
              <span className="text-sm font-semibold text-zinc-100">
                {actorCharId ? charName(actorCharId) : <span className="text-zinc-500">empty queue</span>}
              </span>
              {actorIsNpc ? <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-px rounded bg-amber-400/15 text-amber-300">NPC</span> : null}
              <span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                target: <span style={{ color: attrHex }}>{attrib()}</span> ({attrMetaEntry?.label})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {/* roll builder */}
                <div className="flex flex-wrap items-end gap-3 mb-5">
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Die</span>
                    <select value={diceType} onChange={(e) => setDiceType(e.target.value)} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-amber-700/60">
                      {["4", "6", "8", "10", "12", "20"].map((d) => (
                        <option key={d} value={d} className="bg-zinc-800">d{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Count</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDiceCount((c) => Math.max(1, c - 1))} className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none">−</button>
                      <span className="w-10 text-center text-lg font-bold font-mono text-amber-400">{diceCount}</span>
                      <button onClick={() => setDiceCount((c) => Math.min(20, c + 1))} className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none">+</button>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Mod</span>
                    <input type="number" value={diceMod} min={-20} max={20} readOnly={isPlayer} onChange={(e) => setDiceMod(Number(e.target.value))} className="w-16 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-2 text-zinc-100 text-sm text-center focus:outline-none focus:border-amber-700/60" />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Attribute</span>
                    <select value={actSkill} onChange={(e) => setActSkill(e.target.value)} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-amber-700/60">
                      {["st", "dx", "iq", "ht"].map((s) => (
                        <option key={s} value={s} className="bg-zinc-800">{s.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* faces */}
                <div className="flex flex-wrap items-center gap-2 mb-5 min-h-[3.5rem]">
                  {rolls.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">{icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-7 h-7 text-zinc-600")} Roll? Your faces appear here.</div>
                  ) : (
                    rolls.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-lg border bg-zinc-800 flex items-center justify-center text-xl font-bold font-mono text-amber-300 shadow-inner" style={{ borderColor: "#fbbf2455" }}>
                          {r}
                        </div>
                        {i < rolls.length - 1 ? <span className="text-zinc-600">+</span> : null}
                      </div>
                    ))
                  )}
                </div>

                {/* result */}
                <div className="flex items-center gap-4 flex-wrap">
                  {total !== null && judgment ? (
                    <div className={`rounded-lg border px-4 py-2.5 ${judgment.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"}`}>
                      <span className={`font-mono text-2xl font-bold tabular-nums ${judgment.ok ? "text-emerald-300" : "text-red-300"}`}>= {total}</span>
                      <span className={`block font-mono text-[11px] uppercase tracking-widest ${judgment.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {judgment.text}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-600">Click <span className="text-amber-500 font-semibold">Roll</span> to test.</span>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={rollBtn} className="bg-amber-600 hover:bg-amber-500 text-amber-950 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">{icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-4 h-4 inline mr-1")}Roll {diceCount}d{diceType}</button>
                    <button onClick={copyRoll} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">Copy</button>
                  </div>
                </div>

                {/* curve */}
                <div className="mt-6">
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
                          <span className={`w-full rounded-t-sm transition-[height] ${isCurrent ? (judgment?.ok ? "bg-emerald-400" : "bg-red-400") : c ? "bg-amber-500/50" : "bg-zinc-800"}`} style={{ height: `${c ? Math.max(8, (c / maxCount) * 100) : 3}%` }} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* log action */}
              {!isPlayer ? (
                <div className="border-l border-zinc-700/40 pl-6 space-y-3">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block">Log action</span>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Dice (prefilled)</label>
                    <input type="text" value={actRoll} onChange={(e) => setActRoll(e.target.value)} placeholder="3d6+2=14" className={inputCls} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Target</label>
                    <select value={actTarget} onChange={(e) => setActTarget(e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name || c.username || "Unknown"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Description</label>
                    <input type="text" value={actDesc} onChange={(e) => setActDesc(e.target.value)} placeholder="Attacks the goblin…" className={inputCls} />
                  </div>
                  <button onClick={addAction} className="w-full bg-amber-600 hover:bg-amber-500 text-amber-950 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">+ Log action</button>

                  {sortedActions.length ? (
                    <div className="pt-2 border-t border-zinc-700/40">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1.5">Latest rolls</span>
                      <div className="space-y-1.5">
                        {sortedActions.map((a) => (
                          <RollSlip key={a.id} a={a} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ================= JOURNAL ================= */}
      {tab === "journal" ? (
        <div className="space-y-5">
          {latestNarration ? (
            <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Latest entry</span>
                <span className="flex-1 h-px bg-zinc-700/40" />
                <span className="font-mono text-[10px] text-amber-400">M.{latestMoment}</span>
              </div>
              <p className="text-[15px] leading-relaxed text-zinc-300 italic">{latestNarration}</p>
            </div>
          ) : null}

          <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">Moment rolls</span>
              <span className="flex-1 h-px bg-zinc-700/40" />
              <span className="font-mono text-[10px] text-zinc-600">{sortedActions.length}</span>
            </div>
            {sortedActions.length ? (
              <div className="space-y-2">
                {sortedActions.map((a) => (
                  <RollSlip key={a.id} a={a} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 font-mono italic">No actions recorded for this moment yet.</p>
            )}
          </div>
        </div>
      ) : null}

      {/* ---- modal ---- */}
      {modal ? (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-zinc-100 mb-4">
              {modal === "chapter" ? "New Chapter" : modal === "moment" ? "New Part" : "New Narration"}
            </h3>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (modal === "chapter") submitChapter();
                else if (modal === "moment") submitMoment();
                else submitNarration();
              }}
            >
              <div>
                <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Title</label>
                <input type="text" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} required placeholder="Title…" className={inputCls} />
              </div>
              {modal === "narration" ? (
                <>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Characters in scene</label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-zinc-700/50 rounded-lg p-2">
                      {characters.map((c) => {
                        const checked = narrationChars.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNarrationChars((prev) =>
                                  checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                )
                              }
                              className="accent-amber-500"
                            />
                            <span className={checked ? "text-zinc-100" : "text-zinc-400"}>{c.name || c.username || "Unknown"}</span>
                          </label>
                        );
                      })}
                      {characters.length === 0 ? (
                        <p className="text-zinc-600 text-sm font-mono italic">No characters in this table.</p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Narration</label>
                    <textarea value={narrationText} onChange={(e) => setNarrationText(e.target.value)} rows={3} placeholder="Describe what happens…" className={`${inputCls} resize-none`} />
                  </div>
                </>
              ) : null}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModal(null)} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-amber-600 hover:bg-amber-500 text-amber-950">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---- roll slip (journal) ---- */
function RollSlip({ a }: { a: NarrationAction }) {
  const charId = a.character?.id || "";
  const charName = a.character?.name || a.character?.username || "Unknown";
  const roll = (a.dice_roll ?? "").toLowerCase();
  const tone = a.modifier?.damage_value != null || a.modifier?.mod_hp != null || a.modifier?.mod_st != null
    ? "#f87171"
    : roll.includes("d")
      ? "#60a5fa"
      : "#a1a1aa";
  return (
    <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-zinc-700/40 bg-zinc-900/60">
      <div className="w-1" style={{ background: tone }} />
      <div className="flex-1 min-w-0 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-semibold text-zinc-200">
            {charId ? <Link href={`/character/${charId}`} className="hover:text-amber-300">{charName}</Link> : charName}
          </span>
          {a.queue != null ? <span className="font-mono text-[10px] text-zinc-500">{a.queue}.</span> : null}
          <span className="text-[13px] text-zinc-400 truncate flex-1 min-w-0">{a.description}</span>
        </div>
        {a.dice_roll || a.result ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-zinc-400">{a.dice_roll || "—"}</span>
            {a.dice_roll && a.result ? <span className="text-zinc-600">=</span> : null}
            <span className="font-mono text-base font-bold tabular-nums" style={{ color: a.result ? tone : "#d4d4d8" }}>{a.result}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
