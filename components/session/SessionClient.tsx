"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NarrationAction, QueueEntry, Sheet } from "@/lib/types";

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

const queuePos = (entry: QueueEntry): number => {
  const n = Number(entry.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

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

  const pendingQueue = [...queue]
    .filter((q) => (q.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));
  const nextQueuePos =
    pendingQueue.length > 0 ? Math.max(...pendingQueue.map(queuePos)) + 1 : 1;

  const [modal, setModal] = useState<null | "chapter" | "moment" | "narration">(null);
  const [modalTitle, setModalTitle] = useState("");
  const [narrationChar, setNarrationChar] = useState("");
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
        body: JSON.stringify({
          character_id: queueChar,
          queue: String(nextQueuePos),
          status: "pending",
        }),
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
        body: JSON.stringify({
          id: entry.id,
          character_id: entry.character_id ?? null,
          action_id: entry.action_id ?? null,
          queue: "",
          status: "done",
        }),
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
      body: JSON.stringify({
        id: entry.id,
        character_id: entry.character_id ?? null,
        action_id: entry.action_id ?? null,
        queue: String(nextQueuePos),
        status: "pending",
      }),
    });
  }

  const [diceType, setDiceType] = useState("6");
  const [diceCount, setDiceCount] = useState(3);
  const [diceMod, setDiceMod] = useState(0);
  const [actChar, setActChar] = useState("");
  const [actSkill, setActSkill] = useState("dx");
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [actRoll, setActRoll] = useState("");
  const [actTarget, setActTarget] = useState("");
  const [actDesc, setActDesc] = useState("");

  const selectedChar = characters.find((c) => c.id === actChar);
  const attrib = (): number => {
    if (!selectedChar) return 10;
    const attr = actSkill as "st" | "dx" | "iq" | "ht";
    return selectedChar[attr] ?? selectedChar.sheet?.[attr] ?? 10;
  };
  const modValue = isPlayer
    ? diceMod
    : Math.floor((Number(attrib()) - 10) / 2) + diceMod;

  function rollAll() {
    const die = parseInt(diceType, 10);
    const count = diceCount;
    const newRolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * die) + 1;
      newRolls.push(r);
      sum += r;
    }
    setRolls(newRolls);
    setTotal(sum + modValue);
  }

  function rollBtn() {
    rollAll();
    const text = `${diceCount}d${diceType} [ ${rolls.join(" , ")} ]`;
    setActRoll(text);
  }

  async function copyRoll() {
    const text = `${rolls.join("+")}=${total ?? 0}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  async function submitChapter() {
    if (!modalTitle) return;
    const res = await fetch("/api/game-table-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId, title: modalTitle, chapter: chapter + 1, moment: 0 }),
    });
    const j = await res.json();
    if (j.success) {
      setModal(null);
      setModalTitle("");
      router.refresh();
    } else {
      alert("Error: " + (j.error || "Unknown"));
    }
  }

  async function submitMoment() {
    if (!modalTitle) return;
    const res = await fetch("/api/game-table-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId, title: modalTitle, chapter, moment: latestMoment + 1 }),
    });
    const j = await res.json();
    if (j.success) {
      setModal(null);
      setModalTitle("");
      router.refresh();
    } else {
      alert("Error: " + (j.error || "Unknown"));
    }
  }

  async function submitNarration() {
    if (!modalTitle) return;
    const opt = characters.find((c) => c.id === narrationChar);
    const prefix = opt ? `**${opt.name || opt.username || "Unknown"}**: ` : "";
    const res = await fetch("/api/game-table-narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: tableId,
        scene_id: latestSceneId,
        title: modalTitle,
        narration: prefix + narrationText,
        moment: latestMoment,
      }),
    });
    const j = await res.json();
    if (j.success) {
      setModal(null);
      setModalTitle("");
      setNarrationChar("");
      setNarrationText("");
      router.refresh();
    } else {
      alert("Error: " + (j.error || "Unknown"));
    }
  }

  async function addAction() {
    if (!actChar) {
      alert("Select a character");
      return;
    }
    if (!actDesc) {
      alert("Enter a description");
      return;
    }
    const payload = {
      narrations_id: null,
      character_id: actChar,
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
        try {
          await advanceQueue(actChar);
        } catch {
          /* ignore */
        }
        setActDesc("");
        setActRoll("");
        setActTarget("");
        setActChar("");
        router.refresh();
      } else {
        alert("Error: " + (j.error || "Unknown"));
      }
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  const inputCls =
    "w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-700/60 transition-colors";

  return (
    <>
      <div className="space-y-6">
        <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-zinc-300">
              <span className="text-zinc-500 uppercase text-xs tracking-wider">Chapter</span>
              <span className="text-amber-400 font-bold text-xl ml-1">{chapter}</span>
              <span className="text-zinc-600 mx-2">·</span>
              <span className="text-zinc-500 uppercase text-xs tracking-wider">Part</span>
              <span className="text-amber-400 font-bold text-xl ml-1">{part}</span>
              <span className="text-zinc-600 mx-2">·</span>
              <span className="text-zinc-300">{latestTitle}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isPlayer ? (
                <>
                  <button
                    onClick={() => setModal("chapter")}
                    className="bg-transparent border border-amber-700 text-amber-400 hover:bg-amber-700/10 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    + Next Chapter
                  </button>
                  <button
                    onClick={() => setModal("moment")}
                    className="bg-transparent border border-zinc-600 text-zinc-300 hover:bg-zinc-700/10 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    + Next Part
                  </button>
                  <button
                    onClick={() => setModal("narration")}
                    className="bg-transparent border border-zinc-600 text-zinc-300 hover:bg-zinc-700/10 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    + Next Narration
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {latestNarration ? (
            <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-zinc-700/50 pl-3 mt-3">
              {latestNarration}
            </p>
          ) : null}
        </div>

        <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Turn Queue</h2>
          {pendingQueue.length ? (
            <ul className="mb-4">
              {pendingQueue.map((entry, i) => {
                const charId = entry.character_id || "";
                const name = charName(charId);
                const isNext = i === 0;
                const isNpc = npcIds.includes(charId);
                return (
                  <li
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      isNext ? "bg-amber-700/10 border border-amber-700/40" : "border border-transparent"
                    }`}
                  >
                    <span
                      className={`text-xs w-4 mt-0.5 font-mono ${
                        isNext ? "text-amber-400" : "text-zinc-600"
                      }`}
                    >
                      {i + 1}.
                    </span>
                    {charId ? (
                      <a href={`/character/${charId}`} className="text-sm text-zinc-200 hover:text-blue-400">
                        {name}
                      </a>
                    ) : (
                      <span className="text-sm text-zinc-200">{name}</span>
                    )}
                    {isNpc ? (
                      <span className="text-[10px] uppercase tracking-wider bg-zinc-700/60 text-zinc-300 px-1.5 py-0.5 rounded">
                        NPC
                      </span>
                    ) : null}
                    {isNext ? (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        Up now
                      </span>
                    ) : null}
                    {!isPlayer && !isNext ? (
                      <button
                        onClick={() => removeFromQueue(entry)}
                        aria-label={`Remove ${name} from queue`}
                        className={isNext ? "" : "ml-auto text-zinc-600 hover:text-red-400 transition-colors"}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500 mb-4">
              No one in the queue yet — pick who acts next.
            </p>
          )}
          {!isPlayer ? (
            <div className="flex gap-2">
              <select
                value={queueChar}
                onChange={(e) => setQueueChar(e.target.value)}
                aria-label="Choose who is next"
                className={`${inputCls} flex-1`}
              >
                <option value="">Choose who is next…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.username || "Unknown"}
                    {npcIds.includes(c.id) ? " — NPC" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={addToQueue}
                disabled={!queueChar}
                className="bg-transparent border border-amber-700 text-amber-400 hover:bg-amber-700/10 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                + Add to queue
              </button>
            </div>
          ) : null}
        </div>

        <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1 text-center">Dice</label>
                  <select
                    value={diceType}
                    onChange={(e) => setDiceType(e.target.value)}
                    className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-amber-700/60"
                  >
                    {["4", "6", "8", "10", "12", "20"].map((d) => (
                      <option key={d} value={d} className="bg-zinc-800">
                        d{d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1 text-center">Count</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDiceCount((c) => Math.max(1, c - 1))}
                      className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-lg font-bold text-amber-400 font-mono">{diceCount}</span>
                    <button
                      onClick={() => setDiceCount((c) => Math.min(20, c + 1))}
                      className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1 text-center">Mod</label>
                  <input
                    type="number"
                    value={diceMod}
                    min={-20}
                    max={20}
                    readOnly={isPlayer}
                    onChange={(e) => setDiceMod(Number(e.target.value))}
                    className="w-16 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-2 text-zinc-100 text-sm text-center focus:outline-none focus:border-amber-700/60"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-4 min-h-[4rem]">
                {rolls.length === 0 ? (
                  <div className="w-10 h-10 bg-zinc-800/30 border border-zinc-700/30 rounded-lg flex items-center justify-center text-lg font-mono text-zinc-700 shadow-inner">
                    ?
                  </div>
                ) : (
                  rolls.map((r, i) => {
                    const die = parseInt(diceType, 10);
                    const color = r >= die ? "text-emerald-400" : r <= die * 0.25 ? "text-red-400" : "text-amber-400";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 bg-zinc-800 border border-zinc-600/50 rounded-lg flex items-center justify-center text-lg font-bold ${color} font-mono shadow-inner`}
                        >
                          {r}
                        </div>
                        {i < rolls.length - 1 ? <span className="text-zinc-600 text-sm">+</span> : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm text-zinc-500">
                <span>
                  Modifier: <span className="text-zinc-300 font-semibold">{modValue >= 0 ? "+" : ""}{modValue}</span>
                </span>
                <span className="text-base">
                  Total: <span className="text-amber-400 font-bold text-xl font-mono">{total ?? ""}</span>
                </span>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={rollBtn}
                  className="bg-amber-700/80 hover:bg-amber-600 text-amber-100 text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🎲</span> Roll
                </button>
                <button
                  onClick={copyRoll}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {!isPlayer ? (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Character</label>
                  <select
                    value={actChar}
                    onChange={(e) => setActChar(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.username || "Unknown"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Skill / Attribute</label>
                <select
                  value={actSkill}
                  onChange={(e) => setActSkill(e.target.value)}
                  className={inputCls}
                >
                  {["st", "dx", "iq", "ht"].map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Dice Roll</label>
                <input
                  type="text"
                  value={actRoll}
                  readOnly={isPlayer}
                  onChange={(e) => setActRoll(e.target.value)}
                  placeholder="3d6+2=14"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Target Character</label>
                <select
                  value={actTarget}
                  onChange={(e) => setActTarget(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.username || "Unknown"}
                    </option>
                  ))}
                </select>
              </div>
              {!isPlayer ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Description</label>
                    <input
                      type="text"
                      value={actDesc}
                      onChange={(e) => setActDesc(e.target.value)}
                      placeholder="Attacks the goblin..."
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <button
                      onClick={addAction}
                      className="w-full bg-amber-700/80 hover:bg-amber-600 text-amber-100 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      + Add Action
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {actions.length ? (
            <div className="mt-5 border-t border-zinc-700/40 pt-3">
              {[...actions]
                .sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0))
                .map((a) => {
                  const charId = a.character?.id || "";
                  const charName = a.character?.name || a.character?.username || "Unknown";
                  return (
                    <div key={a.id} className="flex items-start gap-3 py-1.5">
                      <span className="text-xs text-zinc-600 w-4 mt-0.5">{a.queue}.</span>
                      <div className="flex-1">
                        <span className="text-sm text-zinc-300">
                          {charId ? (
                            <a href={`/character/${charId}`} className="text-zinc-200 hover:text-blue-400">
                              {charName}
                            </a>
                          ) : (
                            charName
                          )}
                          {a.description ? ` — ${a.description}` : ""}
                        </span>
                        {a.dice_roll ? (
                          <span className="text-xs text-zinc-400 ml-1">
                            {a.dice_roll}
                            {a.result ? ` = ${a.result}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : null}
        </div>
      </div>

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
                <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  required
                  placeholder="Title..."
                  className={inputCls}
                />
              </div>
              {modal === "narration" ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Character in Scene</label>
                    <select
                      value={narrationChar}
                      onChange={(e) => setNarrationChar(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.username || "Unknown"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Narration</label>
                    <textarea
                      value={narrationText}
                      onChange={(e) => setNarrationText(e.target.value)}
                      rows={3}
                      placeholder="Describe what happens..."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </>
              ) : null}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                    modal === "chapter"
                      ? "bg-amber-700/80 hover:bg-amber-600 text-amber-100"
                      : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                  }`}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
