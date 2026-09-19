"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterSkill, Location, Narration, NarrationAction, QueueEntry, TableCharacter, VisibilityRule } from "@/lib/types";
import { skillLabel, skillLevel } from "@/lib/skill";
import { narrationBoard, tokenAt, type BoardToken, type BoardTrail } from "@/lib/board";
import { hexDir, hexDist } from "@/lib/hexgrid";
import { floorPlanGroup } from "@/lib/location";
import { maskedLocationName, maskedTargetName } from "@/lib/visibility";
import TacticalPlate from "@/components/tactical/TacticalPlate";
import QueueProcession from "@/components/session/QueueProcession";

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
  latestNarrationId: string;
  actions: NarrationAction[];
  queue: QueueEntry[];
  roster: TableCharacter[];
  targets?: TableCharacter[];
  myId: string;
  mySkills: CharacterSkill[];
  locations: Location[];
  latestBeat?: Narration | null;
  visibility?: VisibilityRule[] | null;
}

const queuePos = (e: QueueEntry): number => {
  const n = Number(e.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const hexLbl = (hex: { q: number; r: number } | null): string => {
  if (!hex) return "off";
  const col = hex.q >= 0 ? String.fromCharCode(65 + (hex.q % 26)) : "?";
  return `${col}${hex.r + 1}`;
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
  latestNarrationId,
  actions,
  queue,
  roster,
  targets,
  myId,
  mySkills,
  locations,
  latestBeat = null,
  visibility = null,
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

  /* ---- dice ---- */
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [effectNote, setEffectNote] = useState<string | null>(null);
  const [actDesc, setActDesc] = useState("");
  const [actTarget, setActTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  /* ---- floor plan / your move ---- */
  const [locSel, setLocSel] = useState<string>(() =>
    latestBeat?.location?.id ?? locations.find((l) => !!l.hex?.width && !!l.hex?.height)?.id ?? locations[0]?.id ?? ""
  );
  const [moveTarget, setMoveTarget] = useState<null | { q: number; r: number }>(null);
  const [facingChoice, setFacingChoice] = useState<number | "auto">("auto");
  const [moveWarn, setMoveWarn] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const myEntry = pendingQueue.find((e) => e.character_id === myId);
  const testDie = myEntry?.test_dice || "6";
  const testCount = Math.max(1, Number(myEntry?.test_count ?? 3) || 3);
  const testMod = Number(myEntry?.test_mod ?? 0) || 0;
  const testSet = (myEntry?.test_dice ?? null) != null;

  /* ---- test basis — the narrator locks the dice, the player
       picks what to test it against (attribute or their skill). */
  const lockKind = myEntry?.test_kind ?? null;
  const lockAttr = (myEntry?.test_attr as "st" | "dx" | "iq" | "ht" | null) ?? null;
  const lockSkill = myEntry?.test_skill ?? null;

  const [basis, setBasis] = useState<"attr" | "skill">(
    lockKind === "skill" && !!lockSkill ? "skill" : "attr"
  );
  const [actAttr, setActAttr] = useState<"st" | "dx" | "iq" | "ht">(lockAttr || "dx");
  const [selSkill, setSelSkill] = useState<string>(lockKind === "skill" && lockSkill ? lockSkill : "");

  useEffect(() => {
    // The narrator may set or change the seat test between renders.
    // Sync the player's default attribute/skill to that lock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBasis(lockKind === "skill" && !!lockSkill ? "skill" : "attr");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActAttr(lockAttr || "dx");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelSkill(lockKind === "skill" && lockSkill ? lockSkill : "");
  }, [lockKind, lockAttr, lockSkill]);

  const myChar = roster.find((c) => c.id === myId);
  const s = myChar?.sheet;
  const attrib = (): number => {
    const attr = actAttr;
    return s?.[attr] ?? s?.[`base_${attr}` as "base_st"] ?? 10;
  };

  const skillMode = basis === "skill";
  const skillData = skillMode && selSkill
    ? mySkills.find((sk) => sk.skill_id === selSkill || sk.id === selSkill) ?? null
    : null;
  const skillLevelVal = skillData ? skillLevel(skillData, myChar?.sheet ?? null) : null;
  const target = skillMode ? (skillLevelVal ?? 10) : attrib();
  const modValue = skillMode ? testMod : Math.floor((Number(attrib()) - 10) / 2) + testMod;
  const attrHex = skillMode ? "#fbbf24" : (attrMeta[actAttr]?.hex ?? "#3b82f6");
  const rollDisabled = () => !isMyTurn || !myId || committed;

  function performRoll(): { r: number[]; tot: number } {
    const die = parseInt(testDie, 10);
    if (rollDisabled()) return { r: [], tot: 0 };
    const { r, tot } = rollDice(testCount, die, modValue);
    const j = judgeRoll(tot, target);
    setRolls(r);
    setTotal(tot);
    setJudgment(j);
    setCommitted(false);
    setCommitError(null);
    setActDesc("");
    if (j.ok && skillMode && selSkill) {
      void applySkillConsequence(selSkill);
      router.refresh();
    }
    return { r, tot };
  }

  const rollLog = () =>
    `${testCount}d${testDie} [ ${rolls.join(" , ")} ]`;

  async function commitAction() {
    if (!isMyTurn || !myEntry || rolls.length === 0 || total === null || !judgment) return;
    setSubmitting(true);
    setCommitError(null);
    const defaultDesc = `${skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "Skill") : actAttr.toUpperCase()} test — ${judgment.ok ? "success" : "failure"}.`;
    const description = actDesc.trim() || defaultDesc;
    try {
      const res = await fetch("/api/game-table-end-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: myId,
          narrations_id: latestNarrationId || null,
          description,
          dice_roll: rollLog(),
          result: String(total),
          queue: Number(myEntry.queue) || 0,
          target: actTarget || null,
          multitarget: false,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed to end your turn");
      setCommitted(true);
      setActDesc("");
      setActTarget("");
      router.refresh();
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
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

  const sortedActions = [...actions].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));

  /* ---- floor plan / your move (capped by your Move) ---- */
  const defaultLocation =
    latestBeat?.location ??
    locations.find((l) => !!l.hex?.width && !!l.hex?.height) ??
    locations[0] ??
    null;
  const mapLocation = locations.find((l) => l.id === locSel) ?? defaultLocation;
  const mapGroup = floorPlanGroup(mapLocation, locations);
  const board = narrationBoard(latestBeat, mapLocation);

  /* ---- movement replay: each action with a hex gets its own toggle ---- */
  const boardMoves = board.trail?.moves ?? [];
  const [shownMoves, setShownMoves] = useState<string[]>([]);
  const activeMoves = boardMoves.filter((m) => m.actionId && shownMoves.includes(m.actionId));
  const activeTrail: BoardTrail | null = activeMoves.length
    ? {
        from: activeMoves[activeMoves.length - 1]?.from ?? null,
        to: activeMoves[activeMoves.length - 1]?.to,
        moves: activeMoves,
      }
    : null;

  function toggleMove(actionId: string) {
    setShownMoves((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  }
  /* tokens = toda a party (roster) + quem a narration posiciona; nomes
     reais para personagens de jogadores, mascarados só para NPCs. */
  const rosterTokens: BoardToken[] = roster.map((c) => ({
    id: c.id,
    name: c.sheet?.name || c.name || c.user?.username || "Unknown",
    isPlayer: true,
    unconscious: false,
  }));
  const tokenById = new Map<string, BoardToken>(rosterTokens.map((t) => [t.id, t]));
  for (const bt of board.tokens) {
    tokenById.set(bt.id, {
      ...(tokenById.get(bt.id) ?? { id: bt.id, name: bt.name, isPlayer: true }),
      ...bt,
    });
  }
  const mapTokens = [...tokenById.values()].map((t) => ({
    ...t,
    name: t.id === myId || t.isPlayer ? t.name : maskedTargetName(visibility, t.id, t.name),
  }));
  const from = tokenAt(mapTokens, myId);
  const me = mapTokens.find((t) => t.id === myId);
  const fatigued = s?.fatigue_state !== "active";
  const myMove = fatigued ? (s?.effective_move ?? s?.move) : s?.move;

  const FACING_LABELS = ["E", "SE", "SW", "W", "NW", "NE"];

  function handleMapClick(q: number, r: number) {
    if (!isMyTurn || committed) return;
    const target = { q, r };
    if (myMove != null && from) {
      const d = hexDist(from, target);
      if (d > myMove) {
        setMoveWarn(`Move is ${myMove} hex${myMove === 1 ? "" : "es"} — ${d} is too far.`);
        return;
      }
    }
    setMoveWarn(null);
    setMoveTarget(target);
  }

  function pickFacing(v: number | "auto") {
    if (!isMyTurn || committed || moving) return;
    setFacingChoice(v);
    setMoveWarn(null);
  }

  /** Move (ou giro, quando sem destino) + encerra o turno num único POST. */
  async function logMove() {
    if (!isMyTurn || committed || moving || !mapLocation?.id || !myEntry) return;
    const target = moveTarget;
    const facing = facingChoice === "auto" ? (target && from ? hexDir(from, target) : me?.facing ?? 0) : facingChoice;
    let q = from?.q ?? null;
    let r = from?.r ?? null;
    if (target) {
      if (myMove != null && from) {
        const d = hexDist(from, target);
        if (d > myMove) {
          setMoveWarn(`Move is ${myMove} hex${myMove === 1 ? "" : "es"} — ${d} is too far.`);
          return;
        }
      }
      q = target.q;
      r = target.r;
    } else if (q == null || r == null) {
      setMoveWarn("You're not placed on the map yet — pick a destination hex first.");
      return;
    }
    const description = target
      ? `Moves to hex ${target.q},${target.r}`
      : `Turns to face ${FACING_LABELS[facing] ?? facing}`;
    setMoving(true);
    setMoveError(null);
    try {
      const res = await fetch("/api/game-table-end-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: myId,
          narrations_id: latestNarrationId || null,
          description,
          queue: Number(myEntry.queue) || 0,
          result: null,
          dice_roll: null,
          location_id: mapLocation.id,
          q,
          r,
          facing,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed to end your turn");
      setCommitted(true);
      setMoveTarget(null);
      setFacingChoice("auto");
      setMoveWarn(null);
      router.refresh();
    } catch (err: unknown) {
      setMoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(false);
    }
  }

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

      {/* floor plan — you move up to your Move, one turn at a time */}
      <section aria-label="Floor plan" className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"}`}
            style={isMyTurn ? { boxShadow: "0 0 10px rgba(96,165,250,.7)" } : undefined}
          />
          <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Floor plan</span>
          {mapGroup.length > 1 ? (
            <select
              value={mapLocation?.id ?? ""}
              onChange={(e) => { setLocSel(e.target.value); setMoveTarget(null); setMoveWarn(null); }}
              aria-label="Where you are"
              className="max-w-xs bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors"
            >
              {mapGroup.map((l) => (
                <option key={l.id} value={l.id} className="bg-zinc-800">
                  {maskedLocationName(visibility, l.id, l.name || "Unnamed")}
                </option>
              ))}
            </select>
          ) : mapLocation ? (
            <span className="text-sm font-semibold text-zinc-100">
              {maskedLocationName(visibility, mapLocation.id, mapLocation.name || "Unnamed")}
            </span>
          ) : (
            <span className="text-sm text-zinc-500 italic">No floor plan on this table yet.</span>
          )}
          {mapLocation?.hex?.width != null ? (
            <span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              {mapLocation.hex.width}×{mapLocation.hex.height} hex · {mapLocation.hex.sizeM ?? 1}m/hex
            </span>
          ) : null}
        </div>

        {mapLocation ? (
          <TacticalPlate
            location={mapLocation}
            tokens={mapTokens}
            trail={activeTrail}
            mark={moveTarget}
            accent="#3b82f6"
            R={22}
            M={12}
            onHexClick={isMyTurn && !committed ? handleMapClick : undefined}
          />
        ) : (
          <p className="text-sm text-zinc-600 font-mono italic">
            The scene opens a floor plan here when the narrator draws it.
          </p>
        )}

        {/* ---- replay movement per action ---- */}
        {boardMoves.length > 0 ? (
          <div className="mt-3 border-t border-zinc-700/40 pt-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
                Replay movement
              </span>
              <span className="font-mono text-[10px] text-zinc-600">
                ({boardMoves.length} move{boardMoves.length !== 1 ? "s" : ""})
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => setShownMoves(boardMoves.map((m) => m.actionId).filter((x): x is string => !!x))}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 border border-zinc-700/40"
                >
                  All
                </button>
                <button
                  onClick={() => setShownMoves([])}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 border border-zinc-700/40"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {boardMoves.map((m) => {
                const active = !!m.actionId && shownMoves.includes(m.actionId);
                const nm =
                  mapTokens.find((t) => t.id === m.id)?.name ?? charName(m.id);
                return (
                  <button
                    key={`${m.id}-${m.actionId ?? "act"}`}
                    onClick={() => m.actionId && toggleMove(m.actionId)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      active
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-200"
                        : "bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {nm}
                    <span className="opacity-60"> {hexLbl(m.from)} → {hexLbl(m.to)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isMyTurn ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Move</span>
                <span className="font-mono text-lg font-bold text-blue-300 tabular-nums">{myMove ?? "—"}</span>
                <span className="text-[11px] text-zinc-500">hex{myMove === 1 ? "" : "es"}</span>
              </div>
              <span className="text-sm text-zinc-500 flex-1 min-w-0">
                {from ? (
                  <span className="font-mono text-[12px] text-zinc-400">
                    you are at hex {from.q},{from.r}
                    {me?.facing != null && me?.facing >= 0 ? ` · facing ${FACING_LABELS[me.facing] ?? me.facing}` : ""}
                  </span>
                ) : (
                  <span className="text-zinc-600 italic">you&apos;re not placed yet</span>
                )}
                {moveTarget ? (
                  <span className="font-mono text-[12px] text-emerald-300 ml-2">→ {moveTarget.q},{moveTarget.r}</span>
                ) : null}
              </span>
              <button
                onClick={() => void logMove()}
                disabled={(!moveTarget && (facingChoice === "auto" || !from)) || moving}
                className="bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {moving
                  ? "Logging…"
                  : moveTarget
                    ? `Move & end turn → ${moveTarget.q},${moveTarget.r}`
                    : facingChoice !== "auto"
                      ? "Turn & end turn"
                      : "Log move · click a hex"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Facing</span>
              <button
                type="button"
                onClick={() => pickFacing("auto")}
                className={`font-mono text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-md border transition-colors ${
                  facingChoice === "auto"
                    ? "border-blue-500/60 bg-blue-700/20 text-blue-300"
                    : "border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                auto
              </button>
              {FACING_LABELS.map((lbl, i) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => pickFacing(i)}
                  className={`w-9 h-8 font-mono text-[11px] font-bold rounded-md border transition-colors ${
                    facingChoice === i
                      ? "border-blue-500/60 bg-blue-700/20 text-blue-300"
                      : "border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {lbl}
                </button>
              ))}
              <span className="text-[10px] text-zinc-600 ml-1">
                {facingChoice === "auto" ? "faces the way you move" : "you turn to face this direction"}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
            the map opens for movement when it&apos;s your turn ·{" "}
            {myMove != null ? `you can cover ${myMove} hex${myMove === 1 ? "" : "es"}` : "your sheet has no Move"}
          </p>
        )}

        {moveWarn ? <p className="mt-2 font-mono text-[11px] text-amber-300">{moveWarn}</p> : null}
        {moveError ? <p className="mt-2 font-mono text-[11px] text-red-400">{moveError}</p> : null}
      </section>

      {/* queue procession */}
      <QueueProcession
          entries={queue}
          roster={roster}
          tone="blue"
          myId={myId}
          emptyText="The queue is empty — the scene hasn't opened yet."
        />

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
                  target: <span style={{ color: attrHex }}>{target}</span> ({skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "—") : attrMeta[actAttr]?.label})
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
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Test basis</span>
                  <div className="flex items-center gap-1">
                    {(["attr", "skill"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBasis(b)}
                        disabled={committed}
                        className={`font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                          basis === b
                            ? "border-blue-600/70 text-blue-300"
                            : "border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {b === "attr" ? "Attribute" : "Skill"}
                      </button>
                    ))}
                  </div>
                </div>
                {basis === "skill" ? (
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Skill</span>
                    <select
                      value={selSkill}
                      onChange={(e) => setSelSkill(e.target.value)}
                      disabled={committed}
                      className="w-48 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors disabled:opacity-50"
                    >
                      <option value="" className="bg-zinc-800">Select…</option>
                      {mySkills.map((sk) => (
                        <option key={sk.id} value={sk.skill_id || sk.id} className="bg-zinc-800">
                          {skillLabel(sk, myChar?.sheet ?? null)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Attribute</span>
                    <select
                      value={actAttr}
                      onChange={(e) => setActAttr(e.target.value as "st" | "dx" | "iq" | "ht")}
                      disabled={committed}
                      className="w-24 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors disabled:opacity-50"
                    >
                      {(["st", "dx", "iq", "ht"] as const).map((a) => (
                        <option key={a} value={a} className="bg-zinc-800">{a.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="w-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    {testSet
                      ? `Seat test locked (${testCount}d${testDie}${testMod >= 0 ? `+${testMod}` : testMod}) — the dice come from the narrator; pick an attribute or skill to roll against.`
                      : "No seat test set yet — dice default until the narrator tunes it. You pick the attribute or skill."}
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
                    isMyTurn && !committed
                      ? "bg-blue-600 hover:bg-blue-500 text-blue-950 shadow-lg shadow-blue-900/30"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  } text-sm font-bold px-6 py-2.5 rounded-lg transition-colors`}
                >
                  {icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-4 h-4 inline mr-1")}Roll {testCount}d{testDie}
                </button>
              </div>

              {rolls.length > 0 && isMyTurn && !committed ? (
                <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/[0.05] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Finish your turn</span>
                    <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.3), transparent)" }} />
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-3">
                    Describe what you did and pass the spotlight to the next adventurer.
                  </p>
                  <input
                    type="text"
                    value={actDesc}
                    onChange={(e) => setActDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !submitting && rolls.length > 0) {
                        e.preventDefault();
                        void commitAction();
                      }
                    }}
                    placeholder="What did you do? (optional)"
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-600/70 transition-colors"
                  />
                  <div className="mt-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Target</span>
                    <select
                      value={actTarget}
                      onChange={(e) => setActTarget(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-600/70 transition-colors"
                    >
                      <option value="" className="bg-zinc-800">—</option>
                      {(targets ?? roster)
                        .filter((c) => c.id !== myId)
                        .map((c) => (
                          <option key={c.id} value={c.id} className="bg-zinc-800">
                            {c.sheet?.name || c.name || c.user?.username || c.id}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => void commitAction()}
                      disabled={submitting || rolls.length === 0}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {icon("M5 13l4 4L19 7", "w-4 h-4")}
                      {submitting ? "Logging…" : "Log action & end turn"}
                    </button>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                      {skillMode && skillData
                        ? `${skillLabel(skillData, myChar?.sheet ?? null)} · `
                        : ""}
                      {rolls.join("+")}={total ?? 0} {judgment?.text ?? ""}
                    </span>
                  </div>
                  {commitError ? (
                    <p className="mt-2 text-[11px] text-red-400">{commitError}</p>
                  ) : null}
                </div>
              ) : null}

              {committed ? (
                <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 flex items-center gap-3">
                  {icon("M5 13l4 4L19 7", "w-5 h-5 text-emerald-400")}
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Turn logged — you&apos;re out of the queue.</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      The roll is in the chronicle. The narrator will call you back in for the next round.
                    </p>
                  </div>
                </div>
              ) : null}

              {effectNote ? (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-amber-300">{effectNote}</span>
                </div>
              ) : null}
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
