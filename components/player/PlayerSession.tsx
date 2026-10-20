"use client";

import { useEffect, useRef, useState } from "react";
import type { CharacterSkill, Location, Narration, NarrationAction, QueueEntry, TableCharacter, TableSettings, VisibilityRule } from "@/lib/types";
import { skillLabel, skillLevel } from "@/lib/skill";
import { narrationBoard, narrationBoardAt, tokenAt, type BoardToken, type BoardTrail, type TrailMove } from "@/lib/board";
import { hexDir, hexDist } from "@/lib/hexgrid";
import { floorPlanGroup } from "@/lib/location";
import { maskedLocationName, maskedTargetName } from "@/lib/visibility";
import TacticalPlate from "@/components/tactical/TacticalPlate";
import QueueProcession from "@/components/session/QueueProcession";
import { interpolate, useTranslation } from "@/lib/i18n";

/* ============================================================
   Turn — the player's active scene console.
   Built around *waiting*. The queue is a procession; dice
   unlock ONLY when this character is up, with a warm beacon on
   the tray. Rendered inside the player's unified tab panel.
   ============================================================ */

interface TurnPanelProps {
  tableId: string;
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
  /** O mestre silenciou este jogador: esconde/desabilita as ações do turno. */
  muted?: boolean;
}

const queuePos = (e: QueueEntry): number => {
  const n = Number(e.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const hexLbl = (hex: { q: number; r: number } | null, off: string): string => {
  if (!hex) return off;
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
function judgeRoll(total: number, target: number, t: (key: string) => string): Judgment {
  if (total <= 4) return { crit: true, ok: true, text: t("pl.roll.critSuccess") };
  if (total >= 18 || (total === 17 && target <= 15))
    return { crit: true, ok: false, text: t("pl.roll.critFail") };
  const m = target - total;
  return m >= 0
    ? { crit: false, ok: true, text: interpolate(t("pl.roll.successBy"), { n: m }) }
    : { crit: false, ok: false, text: interpolate(t("pl.roll.failBy"), { n: -m }) };
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
  tableId,
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
  muted = false,
}: TurnPanelProps) {
  const { t } = useTranslation();
  const pendingQueue = [...queue]
    .filter((e) => (e.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));

  const myIndex = pendingQueue.findIndex((e) => e.character_id === myId);
  const isMyTurn = myIndex === 0;
  /* Silenciado: é a vez dele, mas o mestre congelou as ações. Mantemos a
     "vez" para os indicadores, mas todo affordance de agir passa por canAct. */
  const canAct = isMyTurn && !muted;
  const notInQueue = myIndex === -1;

  const charName = (id?: string | null): string => {
    if (!id) return t("pl.session.someone");
    const c = roster.find((x) => x.id === id);
    return c?.sheet?.name || c?.name || c?.user?.username || id;
  };

  /* ---- dice ---- */
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [tableSettings, setTableSettings] = useState<TableSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game-table-settings/${tableId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setTableSettings(j as TableSettings);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tableId]);
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
  const rollDisabled = () => !canAct || !myId || committed;

  function performRoll(): { r: number[]; tot: number } {
    const die = parseInt(testDie, 10);
    if (rollDisabled()) return { r: [], tot: 0 };
    const { r, tot } = rollDice(testCount, die, modValue);
    const j = judgeRoll(tot, target, t);
    setRolls(r);
    setTotal(tot);
    setJudgment(j);
    setCommitted(false);
    setCommitError(null);
    setActDesc("");
    if (j.ok && skillMode && selSkill) {
      void applySkillConsequence(selSkill);
    }
    return { r, tot };
  }

  const rollLog = () =>
    `${testCount}d${testDie} [ ${rolls.join(" , ")} ]`;

  async function commitAction() {
    if (!canAct || !myEntry || rolls.length === 0 || total === null || !judgment) return;
    setSubmitting(true);
    setCommitError(null);
    /* posição da próxima action = append na sequência da narração atual */
    const nextActionQueue =
      (latestBeat?.actions ?? []).reduce((m, a) => Math.max(m, Number(a.queue) || 0), 0) + 1;
    const defaultDesc = `${skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "Perícia") : actAttr.toUpperCase()} teste — ${judgment.ok ? "sucesso" : "falha"}.`;
    const description = actDesc.trim() || defaultDesc;
    /* um teste encerra o turno só no modo 'after_test' (no 'after_move' o turno
       encerra ao mover; o teste fica como ação registrada e a vez continua) */
    const endTurnByTest = (tableSettings?.turn_end_mode ?? "after_test") !== "after_move";
    try {
      const res = await fetch(endTurnByTest ? "/api/game-table-end-turn" : "/api/game-table-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: myId,
          narrations_id: latestNarrationId || null,
          description,
          dice_roll: rollLog(),
          result: String(total),
          queue: nextActionQueue,
          target: actTarget || null,
          multitarget: false,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || t("pl.session.err.action"));
      setCommitted(true);
      setActDesc("");
      setActTarget("");
      window.location.reload();
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
        setEffectNote(
          interpolate(t("ss.effectApplied"), {
            list: j.applied.map((a: { name?: string }) => a.name || t("ss.effect")).join(", "),
          })
        );
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
  /* visibilidade SEMPRE: um local fora do catálogo (não revelado pelo
     narrador) aparece só como "…", sem planta nem detalhes expostos. */
  const locRevealed = !mapLocation || locations.some((l) => l.id === mapLocation.id);

  /* ---- movement replay: default = ONLY the latest move; each action
     with a hex also gets its own toggle below ("All" stacks every
     vector of the scene). ---- */
  const boardFull = narrationBoard(latestBeat, mapLocation);
  const boardMoves = boardFull.trail?.moves ?? [];
  const boardActionIds = boardMoves.map((m) => m.actionId).filter((x): x is string => !!x);
  const boardActionKey = boardActionIds.join("\u0000");
  const [shownMoves, setShownMoves] = useState<string[]>([]);
  const [replayOpen, setReplayOpen] = useState(false);
  const lastSeenMoves = useRef<string[]>([]);
  useEffect(() => {
    const fresh = boardActionIds.filter((id) => !lastSeenMoves.current.includes(id));
    lastSeenMoves.current = boardActionIds;
    if (fresh.length > 0) setShownMoves([boardActionIds[boardActionIds.length - 1]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardActionKey]);
  const shownSet = new Set(shownMoves);
  const shownTrailMoves = boardMoves.filter(
    (m): m is TrailMove & { actionId: string } => !!m.actionId && shownSet.has(m.actionId)
  );
  const lastShownId =
    shownTrailMoves.length > 0 ? shownTrailMoves[shownTrailMoves.length - 1].actionId : null;
  const activeTrail: BoardTrail | null = shownTrailMoves.length
    ? {
        from: shownTrailMoves[shownTrailMoves.length - 1]?.from ?? null,
        to: shownTrailMoves[shownTrailMoves.length - 1].to,
        moves: shownTrailMoves,
      }
    : null;

  function toggleMove(actionId: string) {
    setShownMoves((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  }

  /* tokens = toda a party (roster) + quem a narration posiciona; o nome
     real é preservado só para o próprio jogador — todo o resto passa pelo
     filtro de visibility (aliados no roster também, pois NPCs controlados
     pelo narrador podem estar entre eles). */
  const rosterTokens: BoardToken[] = roster.map((c) => ({
    id: c.id,
    name: c.sheet?.name || c.name || c.user?.username || t("ss.unknown"),
    isPlayer: true,
    unconscious: false,
  }));
  const mergeTokens = (src: BoardToken[]): BoardToken[] => {
    const byId = new Map<string, BoardToken>(rosterTokens.map((t) => [t.id, t]));
    for (const bt of src) {
      byId.set(bt.id, {
        ...(byId.get(bt.id) ?? { id: bt.id, name: bt.name, isPlayer: true }),
        ...bt,
      });
    }
    return [...byId.values()].map((t) => ({
      ...t,
      name: t.id === myId ? t.name : maskedTargetName(visibility, t.id, t.name),
    }));
  };

  /* ---- the board is frozen at the LAST SHOWN movement ---- the token
     lands exactly on the destination of the latest shown move, with the
     arrow showing where it came from; a newer move simply replaces the
     older vector. */
  const fullTokens = mergeTokens(boardFull.tokens);
  const fromCurrent = tokenAt(fullTokens, myId);
  const previewMove: TrailMove | null =
    canAct && !committed && moveTarget && fromCurrent
      ? { id: myId, from: fromCurrent, to: moveTarget }
      : null;
  const frozen = lastShownId !== null && !previewMove;
  const board = frozen
    ? narrationBoardAt(latestBeat, { untilActionId: lastShownId, fallbackLocation: mapLocation })
    : boardFull;
  const mapTokens = frozen ? mergeTokens(board.tokens) : fullTokens;
  const from = tokenAt(mapTokens, myId);
  const me = mapTokens.find((t) => t.id === myId);
  const fatigued = s?.fatigue_state !== "active";
  const myMove = fatigued ? (s?.effective_move ?? s?.move) : s?.move;

  const tooFar = (d: number): string =>
    interpolate(t("pl.session.err.tooFar"), {
      cap: myMove ?? 0,
      dist: d,
      hex: myMove === 1 ? t("pl.session.hexOne") : t("pl.session.hexMany"),
    });

  /* ---- the play map ----: while it's my turn the picked hex is drawn as a
     preview (arrow + destination ghost); the token itself only strides when
     the move is committed and the fresh board comes back. */
  const playTrail: BoardTrail | null =
    previewMove && moveTarget
      ? {
          from: activeTrail?.moves?.length ? activeTrail.from : from,
          to: moveTarget,
          moves: [...(activeTrail?.moves ?? []), previewMove],
        }
      : activeTrail;

  /* bússola de 8 direções (índice = ângulo · 45° no sentido horário a partir do Leste)
     + AUTO como 9ª opção, no centro do compasso */
  const FACING_DIRS: { label: string; arrow: string }[] = [
    { label: "E", arrow: "→" },
    { label: "SE", arrow: "↘" },
    { label: "S", arrow: "↓" },
    { label: "SW", arrow: "↙" },
    { label: "W", arrow: "←" },
    { label: "NW", arrow: "↖" },
    { label: "N", arrow: "↑" },
    { label: "NE", arrow: "↗" },
  ];
  const COMPASS_ROWS: (number | "auto")[][] = [
    [5, 6, 7],
    [4, "auto", 0],
    [3, 2, 1],
  ]; /* NW N NE / W AUTO E / SW S SE */

  function handleMapClick(q: number, r: number) {
    if (!canAct || committed) return;
    const target = { q, r };
    if (myMove != null && from) {
      const d = hexDist(from, target);
      if (d > myMove) {
        setMoveWarn(tooFar(d));
        return;
      }
    }
    setMoveWarn(null);
    setMoveTarget(target);
  }

  function pickFacing(v: number | "auto") {
    if (!canAct || committed || moving) return;
    setFacingChoice(v);
    setMoveWarn(null);
  }

  /** Move (ou giro, quando sem destino) + encerra o turno num único POST. */
  async function logMove() {
    if (!canAct || committed || moving || !mapLocation?.id || !myEntry) return;
    const target = moveTarget;
    const facing = facingChoice === "auto" ? (target && from ? hexDir(from, target) : me?.facing ?? 0) : facingChoice;
    let q = from?.q ?? null;
    let r = from?.r ?? null;
    if (target) {
      if (myMove != null && from) {
        const d = hexDist(from, target);
        if (d > myMove) {
          setMoveWarn(tooFar(d));
          return;
        }
      }
      q = target.q;
      r = target.r;
    } else if (q == null || r == null) {
      setMoveWarn(t("pl.session.err.notPlaced"));
      return;
    }
    const description = target
      ? `Moves to hex ${target.q},${target.r}`
      : `Turns to face ${FACING_DIRS[facing]?.label ?? facing}`;
    setMoving(true);
    setMoveError(null);
    const nextActionQueue =
      (latestBeat?.actions ?? []).reduce((m, a) => Math.max(m, Number(a.queue) || 0), 0) + 1;
    /* só um deslocamento real (com destino) encerra o turno no modo 'after_move' */
    const endTurnByMove = tableSettings?.turn_end_mode === "after_move" && !!target;
    try {
      const res = await fetch(endTurnByMove ? "/api/game-table-end-turn" : "/api/game-table-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: myId,
          narrations_id: latestNarrationId || null,
          description,
          queue: nextActionQueue,
          result: null,
          dice_roll: null,
          target: null,
          multitarget: false,
          location_id: mapLocation.id,
          q,
          r,
          facing,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || t("pl.session.err.endTurn"));
      setCommitted(true);
      setMoveTarget(null);
      setFacingChoice("auto");
      setMoveWarn(null);
      window.location.reload();
    } catch (err: unknown) {
      setMoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* context bar */}
      <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{t("ss.chapter")}</span>
              <span className="font-mono text-xl font-bold text-blue-300 tabular-nums">{chapter}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60" aria-hidden />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{t("ss.part")}</span>
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
              isMyTurn && muted
                ? "border-amber-500/50 text-amber-300"
                : isMyTurn
                ? "border-blue-500/50 text-blue-300"
                : "border-zinc-700/50 text-zinc-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isMyTurn && muted ? "bg-amber-400" : isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"
              }`}
              style={isMyTurn && !muted ? { boxShadow: "0 0 8px rgba(59,130,246,.7)" } : undefined}
            />
            {isMyTurn && muted
              ? t("pl.session.muted.pill")
              : isMyTurn
              ? t("pl.seat.yourTurn")
              : notInQueue
              ? t("pl.seat.outOfQueue")
              : t("pl.seat.waiting")}
          </span>
        </div>
        {latestNarration ? (
          <p className="text-sm text-zinc-400 leading-relaxed italic border-t border-zinc-700/40 px-5 py-3">{latestNarration}</p>
        ) : null}
      </div>

      {/* queue procession — o turno fica acima do mapa */}
      <QueueProcession
        entries={queue}
        roster={roster}
        tone="blue"
        myId={myId}
        emptyText={t("pl.queue.emptyScene")}
      />

      {/* floor plan + action — the map, your move and the dice stay in one card */}
      <section aria-label={t("ss.floorPlan")} className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden">
        <div className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"}`}
            style={isMyTurn ? { boxShadow: "0 0 10px rgba(96,165,250,.7)" } : undefined}
          />
          <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{t("ss.floorPlan")}</span>
          {mapGroup.length > 1 ? (
            <select
              value={mapLocation?.id ?? ""}
              onChange={(e) => { setLocSel(e.target.value); setMoveTarget(null); setMoveWarn(null); }}
              aria-label={t("pl.session.aria.whereYouAre")}
              className="max-w-xs bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors"
            >
              {!locRevealed ? (
                <option value={mapLocation?.id ?? ""} className="bg-zinc-800">…</option>
              ) : null}
              {mapGroup.map((l) => (
                <option key={l.id} value={l.id} className="bg-zinc-800">
                  {maskedLocationName(visibility, l.id, l.name || t("ss.unnamed"))}
                </option>
              ))}
            </select>
          ) : mapLocation && locRevealed ? (
            <span className="text-sm font-semibold text-zinc-100">
              {maskedLocationName(visibility, mapLocation.id, mapLocation.name || t("ss.unnamed"))}
            </span>
          ) : mapLocation ? (
            <span className="text-sm text-zinc-500 italic">…</span>
          ) : (
            <span className="text-sm text-zinc-500 italic">{t("ss.noFloorPlanYet")}</span>
          )}
          {mapLocation?.hex?.width != null && locRevealed ? (
            <span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              {mapLocation.hex.width}×{mapLocation.hex.height} hex · {mapLocation.hex.sizeM ?? 1}m/hex
            </span>
          ) : null}
        </div>

        {mapLocation && locRevealed ? (
          <TacticalPlate
            location={mapLocation}
            tokens={mapTokens}
            trail={playTrail}
            mark={moveTarget}
            accent="#3b82f6"
            R={22}
            M={12}
            onHexClick={canAct && !committed ? handleMapClick : undefined}
          />
        ) : mapLocation ? (
          <div className="p-10 text-center">
            <span className="font-mono text-3xl text-zinc-700 block mb-3" aria-hidden>…</span>
            <p className="text-sm text-zinc-500 italic">{t("lc.log.unrevealed")}</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 font-mono italic">
            {t("pl.session.sceneNoFloorPlan")}
          </p>
        )}

        {/* ---- replay movement per action (collapsed dropdown) ---- */}
        {boardMoves.length > 0 ? (
          <div className="mt-3 border-t border-zinc-700/40 pt-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setReplayOpen((o) => !o)}
                aria-expanded={replayOpen}
                aria-label={t("ss.aria.toggleMoveReplay")}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span
                  className={`inline-flex items-center justify-center w-3.5 h-3.5 transition-transform ${
                    replayOpen ? "rotate-90" : ""
                  }`}
                >
                  {icon("M9 18l6-6-6-6", "w-3.5 h-3.5")}
                </span>
                {t("ss.replayMoves")}
              </button>
              <span className="font-mono text-[10px] text-zinc-600">
                {interpolate(
                  boardMoves.length === 1 ? t("ss.movesOne") : t("ss.movesMany"),
                  { n: boardMoves.length }
                )}
              </span>
              {replayOpen ? (
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() =>
                      setShownMoves(
                        boardMoves.length && boardMoves[boardMoves.length - 1].actionId
                          ? [boardMoves[boardMoves.length - 1].actionId as string]
                          : []
                      )
                    }
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-blue-300 hover:text-blue-100 bg-blue-500/10 border border-blue-500/40"
                  >
                    {t("ss.last")}
                  </button>
                  <button
                    onClick={() => setShownMoves(boardMoves.map((m) => m.actionId).filter((x): x is string => !!x))}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 border border-zinc-700/40"
                  >
                    {t("ss.all")}
                  </button>
                  <button
                    onClick={() => setShownMoves([])}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 border border-zinc-700/40"
                  >
                    {t("ss.none")}
                  </button>
                </div>
              ) : null}
            </div>
            {replayOpen ? (
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
                      <span className="opacity-60"> {hexLbl(m.from, "—")} → {hexLbl(m.to, "—")}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>

      {/* action zone: movement + dice — fora da caixa da planta */}
      <section aria-label={t("pl.session.aria.actions")} className="relative bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-700/40">
              <span className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? "bg-blue-400 beacon" : "bg-zinc-600"}`}
                style={isMyTurn ? { boxShadow: "0 0 10px rgba(251,191,36,.7)" } : undefined} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{t("ss.actingNow")}</span>
              <span className="text-sm font-semibold text-zinc-100">
                {pendingQueue[0] ? charName(pendingQueue[0].character_id) : t("ss.emptyQueue")}
              </span>
              <span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                {t("ss.targetPrefix")}: <span style={{ color: attrHex }}>{target}</span> ({skillMode ? (skillData ? skillLabel(skillData, myChar?.sheet ?? null) : "—") : attrMeta[actAttr]?.label})
              </span>
            </div>

            {/* movement | dice test — two columns side by side */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="">
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-3">{t("cs.movement")}</span>
                {isMyTurn ? (
          <div className="space-y-3">
            {/* move column: value + where you stand, label at the bottom */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-mono text-lg font-bold text-blue-300 tabular-nums">{myMove ?? "—"}</span>
                <span className="text-[11px] text-zinc-500">{myMove === 1 ? t("pl.session.hexOne") : t("pl.session.hexMany")}</span>
                <span className="text-sm text-zinc-500 flex-1 min-w-0">
                  {from ? (
                    <span className="font-mono text-[12px] text-zinc-400">
                      {interpolate(t("pl.session.atHex"), { q: from.q, r: from.r })}
                      {me?.facing != null && me?.facing >= 0
                        ? interpolate(t("pl.session.facingOf"), { dir: FACING_DIRS[me.facing]?.label ?? me.facing })
                        : ""}
                    </span>
                  ) : (
                    <span className="text-zinc-600 italic">{t("pl.session.notPlacedYet")}</span>
                  )}
                  {moveTarget ? (
                    <span className="font-mono text-[12px] text-emerald-300 ml-2">→ {moveTarget.q},{moveTarget.r}</span>
                  ) : null}
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("cs.movement")}</p>
            </div>

            {moveTarget ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/80">
                {t("pl.session.movePreview")}
              </p>
            ) : null}

            {/* facing + log move — two rows stacked, labels at the bottom */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="inline-grid grid-cols-3 rounded-lg border border-zinc-700/50 bg-zinc-950/40 overflow-hidden">
                    {COMPASS_ROWS.map((row, ri) =>
                      row.map((cell, ci) => {
                        if (cell === "auto") {
                          return (
                            <button
                              key={`auto-${ri}-${ci}`}
                              type="button"
                              onClick={() => pickFacing("auto")}
                              className={`h-10 px-2.5 font-mono text-[10px] font-bold transition-colors ${
                                ri < COMPASS_ROWS.length - 1 ? "border-b border-zinc-700/40" : ""
                              } ${ci < row.length - 1 ? "border-r border-zinc-700/40" : ""} ${
                                facingChoice === "auto" ? "bg-blue-700/20 text-blue-300" : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              AUTO
                            </button>
                          );
                        }
                        const i = cell;
                        const dir = FACING_DIRS[i];
                        const isSel = facingChoice === i;
                        const isCur = !isSel && facingChoice === "auto" && me?.facing === i;
                        return (
                          <button
                            key={`${ri}-${ci}-${dir.label}`}
                            type="button"
                            title={dir.label}
                            onClick={() => pickFacing(i)}
                            className={`h-10 flex flex-col items-center justify-center leading-none transition-colors ${
                              ri < COMPASS_ROWS.length - 1 ? "border-b border-zinc-700/40" : ""
                            } ${ci < row.length - 1 ? "border-r border-zinc-700/40" : ""} ${
                              isSel
                                ? "border-blue-500/60 bg-blue-700/20 text-blue-300"
                                : isCur
                                  ? "text-zinc-200 bg-zinc-700/40"
                                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                            }`}
                          >
                            <span className="text-sm">{dir.arrow}</span>
                            <span className="text-[8px] font-mono">{dir.label}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("ss.facing")}</p>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => void logMove()}
                  disabled={(!moveTarget && (facingChoice === "auto" || !from)) || moving}
                  className="bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-tight"
                >
                  <span className="block">
                    {moving
                      ? t("pl.session.logging")
                      : moveTarget
                        ? tableSettings?.turn_end_mode === "after_move"
                          ? t("pl.session.moveAndEndTurn")
                          : t("pl.session.logMove")
                        : facingChoice !== "auto"
                          ? tableSettings?.turn_end_mode === "after_move"
                            ? t("pl.session.faceAndEndTurn")
                            : t("pl.session.faceInPlace")
                          : t("pl.session.logMove")}
                  </span>
                  <span className="block text-[10px] font-mono font-medium opacity-80 mt-0.5">
                    {moving
                      ? t("pl.session.waitHint")
                      : moveTarget
                        ? `→ ${moveTarget.q},${moveTarget.r}`
                        : facingChoice !== "auto"
                          ? t("pl.session.inPlace")
                          : t("pl.session.pickHexHint")}
                  </span>
                </button>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("pl.session.logMove")}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
            {interpolate(t("pl.session.mapOpensOnTurn"), {
              detail:
                myMove != null
                  ? interpolate(
                      myMove === 1 ? t("pl.session.moveRangeOne") : t("pl.session.moveRangeMany"),
                      { n: myMove }
                    )
                  : t("pl.session.noMove"),
            })}
          </p>
        )}

              {moveWarn ? <p className="mt-2 font-mono text-[11px] text-amber-300">{moveWarn}</p> : null}
              {moveError ? <p className="mt-2 font-mono text-[11px] text-red-400">{moveError}</p> : null}
              </div>

              <div className="">
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-3">{t("pl.session.diceTest")}</span>
                <div className="grid grid-cols-1 gap-5">
              <div className="flex flex-col items-center gap-5">
                {/* line 1 — choose the test basis */}
                <div className="flex flex-col items-center gap-1.5">
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
                        {b === "attr" ? t("ss.attribute") : t("ss.skill")}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("ss.testBase")}</p>
                </div>

                {/* line 2 — the selector */}
                <div className="flex flex-col items-center gap-1.5">
                  {basis === "skill" ? (
                    <select
                      value={selSkill}
                      onChange={(e) => setSelSkill(e.target.value)}
                      disabled={committed}
                      className="w-48 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors disabled:opacity-50"
                    >
                      <option value="" className="bg-zinc-800">{t("ss.select")}…</option>
                      {mySkills.map((sk) => (
                        <option key={sk.id} value={sk.skill_id || sk.id} className="bg-zinc-800">
                          {skillLabel(sk, myChar?.sheet ?? null)}
                        </option>
                      ))}
                    </select>
                  ) : (
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
                  )}
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {basis === "skill" ? t("ss.skill") : t("ss.attribute")}
                  </p>
                </div>

                {/* line 3 — read-only modifiers: the test is already set, no inputs here */}
                <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">d{testDie}</span>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("ss.die")}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">{testCount}</span>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("ss.quantity")}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[3.5rem] h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 text-zinc-100 text-sm font-mono">{testMod >= 0 ? `+${testMod}` : testMod}</span>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Mod</p>
                  </div>
                </div>

                {/* status */}
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 text-center">
                  {testSet
                    ? interpolate(t("pl.seat.testLocked"), {
                        dice: `${testCount}d${testDie}${testMod >= 0 ? `+${testMod}` : testMod}`,
                      })
                    : t("pl.seat.testNone")}
                </p>

                {/* line 4 — alvo (quem você mira/afeta na ação) */}
                <div className="flex flex-col items-center gap-1.5">
                  <select
                    value={actTarget}
                    onChange={(e) => setActTarget(e.target.value)}
                    disabled={committed}
                    className="w-48 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-blue-600/70 transition-colors disabled:opacity-50"
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
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("ss.target")}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 min-h-[3.5rem]">
                {rolls.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    {icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-7 h-7 text-zinc-600")}
                    {isMyTurn ? t("pl.session.yourTurnRoll") : t("pl.seat.diceLocked")}
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
                    {t("ss.clickRollBefore")}<span className={isMyTurn ? "text-blue-400 font-semibold" : "text-zinc-500"}>{t("ss.rollShort")}</span>{t("ss.clickRollAfter")}
                  </span>
                )}
                <button
                  onClick={performRoll}
                  disabled={rollDisabled()}
                  className={`${
                    canAct && !committed
                      ? "bg-blue-600 hover:bg-blue-500 text-blue-950 shadow-lg shadow-blue-900/30"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  } text-sm font-bold px-6 py-2.5 rounded-lg transition-colors`}
                >
                  {icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-4 h-4 inline mr-1")}{interpolate(t("ss.rollNdM"), { n: testCount, d: testDie })}
                </button>
              </div>

              {rolls.length > 0 && canAct && !committed ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("ss.queue.endTurn")}</span>
                    <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.3), transparent)" }} />
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-3">
                    {t("pl.session.endTurnHint")}
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
                    placeholder={t("pl.session.descPh")}
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-600/70 transition-colors"
                  />
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => void commitAction()}
                      disabled={submitting || rolls.length === 0}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {icon("M5 13l4 4L19 7", "w-4 h-4")}
                      {submitting ? t("pl.session.logging") : t("pl.session.registerEndTurn")}
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
                    <p className="text-sm font-medium text-emerald-300">{t("pl.session.turnLogged")}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {t("pl.session.turnLoggedHint")}
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
          </div>
          </div>

          {!canAct ? (
            <div className="pointer-events-none absolute inset-0 bg-zinc-950/55 backdrop-blur-[1px] flex items-center justify-center">
              <div className="text-center px-6">
                <div className={`mx-auto mb-3 flex items-center justify-center w-12 h-12 rounded-full border-2 ${muted ? "border-amber-600/60" : notInQueue ? "border-zinc-600" : "border-blue-600/50"}`}>
                  {icon(muted ? "M18.364 5.636l-3.536 3.536M9 9l-6-6m9 9a3 3 0 100-6m-3 6a3 3 0 01-3-3m0 0V5m3 10l6 6" : notInQueue ? "M12 8v8m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "w-6 h-6")}
                </div>
                <p className={`font-mono text-[11px] uppercase tracking-widest ${muted ? "text-amber-400" : "text-zinc-500"}`}>
                  {muted
                    ? t("pl.session.muted.pill")
                    : notInQueue
                    ? t("pl.seat.outOfQueue")
                    : interpolate(myIndex === 1 ? t("pl.seat.aheadOne") : t("pl.seat.aheadMany"), { n: myIndex })}
                </p>
                <p className="text-[13px] text-zinc-500 mt-1 max-w-xs mx-auto">
                  {muted
                    ? t("pl.session.muted.body")
                    : notInQueue
                    ? t("pl.seat.sealedScene")
                    : t("pl.seat.sealedOther")}
                </p>
              </div>
            </div>
          ) : null}
      </section>

      {/* recent rolls */}
      {sortedActions.length ? (
        <section aria-label={t("pl.session.recentRolls")}>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">{t("pl.session.recentRolls")}</span>
            <span className="flex-1 h-px bg-zinc-700/40" />
          </div>
          <div className="space-y-1.5">
            {sortedActions.slice(-4).reverse().map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-zinc-400 border border-zinc-700/40 bg-zinc-900/50 rounded-lg px-3 py-2">
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  {a.character?.name || a.character?.username || t("ss.someone")}
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
