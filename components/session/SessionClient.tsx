"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CharacterSkill, CharacterViewer, Location, Narration, NarrationAction, QueueEntry, Sheet, TableSettings } from "@/lib/types";
import { api } from "@/lib/api";
import { skillLabel, skillLevel } from "@/lib/skill";
import { narrationBoard, narrationBoardAt, tokenAt } from "@/lib/board";
import type { BoardToken, BoardTrail, TrailMove } from "@/lib/board";
import { hexDir, hexDist } from "@/lib/hexgrid";
import { floorPlanGroup } from "@/lib/location";
import TacticalPlate from "@/components/tactical/TacticalPlate";
import QueueProcession from "@/components/session/QueueProcession";
import DiceMystery from "@/components/session/DiceMystery";

/* ============================================================
   Session Console
   Three tabs organizing the narrator/player work:
     · TURN   — the initiative queue as horizontal cards.
     · DICE   — an intuitive dice tray (rolled against attribute).
     · JOURNAL — the session diary + roll slips.
   The context bar (Chapter · Part · latest action) stays fixed
   above the tabs.

   Two trails share this console: the narrator trail glows olive,
   the player trail glows blue (`role` selects the tone).
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
  latestNarrationId?: string;
  /** última narration (com location/tokens) — alimenta o mapa */
  latestBeat?: Narration | null;
  latestSceneId: string;
  latestMoment: number;
  characters: SessionChar[];
  actions: NarrationAction[];
  queue?: QueueEntry[];
  npcIds?: string[];
  locations?: Location[];
  myCharacterId?: string;
  role?: "narrator" | "player";
}

type SessionTab = "turn" | "dice" | "journal";

const queuePos = (entry: QueueEntry): number => {
  const n = Number(entry.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

/* bússola de 8 direções (índice = ângulo · 45° no sentido horário a partir do Leste)
   + AUTO como 9ª opção, no centro do compasso. */
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
const COMPASS_ORDER = [5, 6, 7, 4, 0, 3, 2, 1]; /* NW N NE / W · AUTO · E / SW S SE */

const hexLbl = (hex: { q: number; r: number } | null): string => {
  if (!hex) return "off";
  const col = hex.q >= 0 ? String.fromCharCode(65 + (hex.q % 26)) : "?";
  return `${col}${hex.r + 1}`;
};

const inputCls = (focus: string) =>
  `w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none ${focus} transition-colors`;

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

function performRoll(diceCount: number, diceType: string, modValue: number): { r: number[]; tot: number } {
  const die = parseInt(diceType, 10);
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < diceCount; i++) {
    const v = Math.floor(Math.random() * die) + 1;
    r.push(v);
    sum += v;
  }
  return { r, tot: sum + modValue };
}

export default function SessionClient({
  tableId,
  chapter,
  part,
  latestTitle,
  latestNarration,
  latestNarrationId = "",
  latestBeat = null,
  latestSceneId,
  latestMoment,
  characters,
  actions,
  queue = [],
  npcIds = [],
  locations = [],
  myCharacterId,
  role = "narrator",
}: SessionClientProps) {
  const isPlayer = role === "player";
  const T = isPlayer
    ? {
        ring: "focus-visible:ring-blue-500/60",
        activeTab: "bg-zinc-700 text-blue-300",
        text: "text-blue-400",
        textSoft: "text-blue-300",
        textSofter: "text-blue-200",
        softBg: "bg-blue-700/10",
        softBorder: "border-blue-600/60",
        btnFill: "bg-blue-600 hover:bg-blue-500 text-blue-950",
        borderCta: "border-blue-600 text-blue-400 hover:bg-blue-700/10",
        borderHover: "hover:border-blue-500 hover:text-blue-300",
        badge: "bg-blue-500 text-blue-950",
        dot: "bg-blue-400",
        curve: "bg-blue-500/50",
        inputBorder: "focus:border-blue-700/60",
        diceText: "text-blue-300",
        diceBorder: "#3b82f655",
        diceChip: "border-blue-500/40 bg-blue-950/50",
        shadow: "rgba(59,130,246,.6)",
        shadowCardA: "rgba(59,130,246,.15)",
        shadowCardB: "rgba(59,130,246,.35)",
        accent: "accent-blue-500",
        hex: "#3b82f6",
        linkHover: "hover:text-blue-300",
      }
    : {
        ring: "focus-visible:ring-green-800/60",
        activeTab: "bg-zinc-700 text-green-400",
        text: "text-green-500",
        textSoft: "text-green-400",
        textSofter: "text-green-300",
        softBg: "bg-green-900/10",
        softBorder: "border-green-800/60",
        btnFill: "bg-green-800 hover:bg-green-700 text-white",
        borderCta: "border-green-800 text-green-500 hover:bg-green-900/10",
        borderHover: "hover:border-green-700 hover:text-green-400",
        badge: "bg-green-700 text-white",
        dot: "bg-green-500",
        curve: "bg-green-700/50",
        inputBorder: "focus:border-green-900/60",
        diceText: "text-green-400",
        diceBorder: "#16a34a55",
        diceChip: "border-green-700/40 bg-green-950/50",
        shadow: "rgba(22,101,52,.6)",
        shadowCardA: "rgba(22,101,52,.15)",
        shadowCardB: "rgba(22,101,52,.35)",
        accent: "accent-green-800",
        hex: "#16a34a",
        linkHover: "hover:text-green-400",
      };
  const router = useRouter();
  const [tab, setTab] = useState<SessionTab>("turn");

  /* config de mesa: decide se o movimento encerra o turno (after_move) */
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

  const pendingQueue = [...queue]
    .filter((q) => (q.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));
  const nextQueuePos =
    pendingQueue.length > 0 ? Math.max(...pendingQueue.map(queuePos)) + 1 : 1;
  /* posição da PRÓXIMA action na narração atual = append da sequência dela
     (a fila de turnos é outra coisa — a sequência do texto da narração). */
  const nextActionQueue =
    (latestBeat?.actions ?? []).reduce((m, a) => Math.max(m, Number(a.queue) || 0), 0) + 1;

  const [modal, setModal] = useState<null | "chapter" | "moment" | "narration">(null);
  const [modalTitle, setModalTitle] = useState("");
  const [narrationChars, setNarrationChars] = useState<string[]>([]);
  const [narrationConsc, setNarrationConsc] = useState<Record<string, boolean>>({});
  const [narrationText, setNarrationText] = useState("");

  const [queueChar, setQueueChar] = useState("");

  /* apenas quem está NA CENA (narração atual) pode entrar na fila —
     alvos = characters listados na narration + NPCs presentes nela. */
  const sceneCharIds = new Set<string>();
  for (const c of latestBeat?.characters ?? []) sceneCharIds.add(c.id);
  for (const n of latestBeat?.npcs ?? []) if (n.characterId) sceneCharIds.add(n.characterId);

  const charName = (charId?: string | null): string => {
    if (!charId) return "Unknown";
    const c = characters.find((x) => x.id === charId);
    return c?.name || c?.username || "Unknown";
  };

  async function addToQueue() {
    if (!queueChar || !sceneCharIds.has(queueChar)) return;
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

  async function applyTest() {
    const entry = pendingQueue[0];
    if (!entry) return;
    const payload = {
      id: entry.id,
      character_id: entry.character_id ?? null,
      action_id: entry.action_id ?? null,
      queue: entry.queue ?? "",
      status: entry.status ?? "pending",
      test_dice: diceType,
      test_count: diceCount,
      test_mod: diceMod,
      test_attr: actSkill,
      test_kind: basis,
      test_skill: basis === "skill" ? skillId || null : null,
    };
    try {
      const res = await fetch("/api/game-table-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.success) alert("Error: " + (j.error || "Unknown"));
      router.refresh();
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  /* ---- dice ---- */
  const [diceType, setDiceType] = useState("6");
  const [diceCount, setDiceCount] = useState(3);
  const [diceMod, setDiceMod] = useState(0);
  const [actSkill, setActSkill] = useState("dx");
  const [rollBasis, setRollBasis] = useState<"attr" | "skill">("attr");
  const [skillId, setSkillId] = useState<string>("");
  const [actorSkills, setActorSkills] = useState<CharacterSkill[]>([]);
  const [rolls, setRolls] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [effectNote, setEffectNote] = useState<string | null>(null);
  const [actRoll, setActRoll] = useState("");
  const [actTarget, setActTarget] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [revealKey, setRevealKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastDice, setLastDice] = useState({ count: 3, die: "6" });

  const actorCharId = pendingQueue[0]?.character_id || "";
  const upEntry = pendingQueue[0];
  const selectedChar = characters.find((c) => c.id === actorCharId);
  const attrib = (): number => {
    if (!selectedChar) return 10;
    const attr = actSkill as "st" | "dx" | "iq" | "ht";
    return selectedChar[attr] ?? selectedChar.sheet?.[attr] ?? 10;
  };

  const allowSkill = !isPlayer || (myCharacterId ? actorCharId === myCharacterId : false);
  const basis = allowSkill ? rollBasis : "attr";
  const attrHex = basis === "skill" ? "#fbbf24" : (attrMeta[actSkill]?.hex ?? T.hex);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!actorCharId) return;
      const viewer = await api<CharacterViewer>(
        `/game-table-character/${actorCharId}${myCharacterId ? `?viewer=${encodeURIComponent(myCharacterId)}` : ""}`
      ).catch(() => null);
      if (cancelled) return;
      setActorSkills(viewer?.character?.skills ?? []);
      setSkillId((prev) =>
        prev && (viewer?.character?.skills ?? []).some((s) => s.skill_id === prev || s.id === prev) ? prev : ""
      );
    };
    load();
    return () => { cancelled = true; };
  }, [actorCharId, myCharacterId]);

  const selectedSkill = actorSkills.find((s) => s.skill_id === skillId || s.id === skillId) ?? null;
  const selectedSkillLevel = selectedSkill ? skillLevel(selectedSkill, selectedChar?.sheet ?? null) : null;
  const seatSkillNote =
    upEntry && upEntry.test_kind === "skill" && upEntry.test_skill
      ? (() => {
          const st = actorSkills.find((s) => s.skill_id === upEntry.test_skill || s.id === upEntry.test_skill);
          return st ? skillLabel(st, selectedChar?.sheet ?? null) : "skill";
        })()
      : null;
  const targetValue = (): number => (basis === "skill" ? (selectedSkillLevel ?? 10) : attrib());
  const modValue = basis === "skill" ? diceMod : isPlayer ? diceMod : Math.floor((Number(attrib()) - 10) / 2) + diceMod;

  async function applySkillConsequence(skillIdToApply: string) {
    try {
      const res = await fetch("/api/game-table-roll-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: actorCharId, skill_id: skillIdToApply }),
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

  function performRollFn(): { r: number[]; tot: number; j: Judgment } {
    const { r, tot } = performRoll(diceCount, diceType, modValue);
    const j = judgeRoll(tot, targetValue());
    setRolls(r);
    setTotal(tot);
    setJudgment(j);
    setLastDice({ count: diceCount, die: diceType });
    setRevealed(false);
    setRevealKey((k) => k + 1);
    return { r, tot, j };
  }

  async function rollBtn() {
    const { r, j } = performRollFn();
    setActRoll(`${diceCount}d${diceType} [ ${r.join(" , ")} ]`);
    setEffectNote(null);
    if (j.ok && basis === "skill" && skillId) {
      await applySkillConsequence(skillId);
      router.refresh();
    }
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
    if (j.success) {
      setModalTitle("");
      setNarrationChars([]);
      setNarrationConsc({});
      router.refresh();
      /* a narration vem logo em seguida da cena (capítulo/parte) */
      setModal("narration");
    }
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
    if (j.success) {
      setModalTitle("");
      setNarrationChars([]);
      setNarrationConsc({});
      router.refresh();
      /* a narration vem logo em seguida da parte */
      setModal("narration");
    }
    else alert("Error: " + (j.error || "Unknown"));
  }

  async function submitNarration() {
    if (!modalTitle) return;
    const opted = characters.filter((c) => narrationChars.includes(c.id));
    const prefix = opted.length
      ? `**${opted.map((c) => c.name || c.username || "Unknown").join(", ")}**: `
      : "";
    const moved = new Map(mapTokens.map((t) => [t.id, t]));
    const present = opted.map((c) => ({
      character_id: c.id,
      conscious: narrationConsc[c.id] !== false,
      q: moved.get(c.id)?.q ?? null,
      r: moved.get(c.id)?.r ?? null,
      facing: moved.get(c.id)?.facing ?? 0,
    }));
    const loc = narrationLocation || defaultLocation?.id || latestBeat?.location?.id || null;
    const res = await fetch("/api/game-table-narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: tableId,
        scene_id: latestSceneId,
        title: modalTitle,
        narration: prefix + narrationText,
        moment: latestMoment,
        location_id: loc,
        present,
      }),
    });
    const j = await res.json();
    if (j.success) { setModal(null); setModalTitle(""); setNarrationChars([]); setNarrationConsc({}); setNarrationText(""); setNarrationLocation(defaultLocation?.id ?? ""); router.refresh(); }
    else alert("Error: " + (j.error || "Unknown"));
  }

  async function addAction() {
    if (!actorCharId) { alert("No one is up in the queue"); return; }
    if (!actDesc) { alert("Enter an action description"); return; }
    const payload = {
      narrations_id: latestNarrationId || null,
      character_id: actorCharId,
      description: actDesc,
      dice_roll: actRoll || null,
      queue: nextActionQueue,
      target: actTarget || null,
      multitarget: false,
      location_id: actionLocation?.id ?? null,
      q: actHex?.q ?? null,
      r: actHex?.r ?? null,
      facing: actFacing,
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
        setActDesc(""); setActRoll(""); setActTarget(""); setActionHex(null); router.refresh();
      } else alert("Error: " + (j.error || "Unknown"));
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  /* ---- helpers ---- */
  const actorIsNpc = npcIds.includes(actorCharId);

  const counts = new Map<number, number>();
  for (const s of rolls) counts.set(s, (counts.get(s) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());

  const sortedActions = [...actions].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));

  /* ---- floor plan / map ---- */
  const defaultLocation =
    latestBeat?.location ??
    locations.find((l) => !!l.hex?.width && !!l.hex?.height) ??
    locations[0] ??
    null;

  const [narrationLocation, setNarrationLocation] = useState<string>(() => defaultLocation?.id ?? "");
  const [locSel, setLocSel] = useState<string | undefined>(() => defaultLocation?.id ?? undefined);
  const [moveTarget, setMoveTarget] = useState<null | { q: number; r: number }>(null);
  /* ---- facing (8 setas + auto) do personagem da vez ---- */
  const [facingChoice, setFacingChoice] = useState<number | "auto">("auto");
  /* ---- movement uses whoever is up in the turn (no picker) ---- */

  /* ---- log-action map (hex da ação) ---- */
  const [actionLocId, setActionLocId] = useState<string>(() => defaultLocation?.id ?? "");
  const [actionHex, setActionHex] = useState<null | { q: number; r: number }>(null);

  /* ---- test-on-map (alvo por distância) — integrado à action ---- */
  const [actionMode, setActionMode] = useState<"move" | "melee" | "ranged">("move");
  const combatRange = actionMode === "ranged" ? "ranged" : "melee";
  const [combatActor, setCombatActor] = useState<string>(() => pendingQueue[0]?.character_id || "");
  const [combatTarget, setCombatTarget] = useState<string>("");
  const [meleeReach, setMeleeReach] = useState(3);
  const [mapCastAttr, setMapCastAttr] = useState<"st" | "dx" | "iq" | "ht">("dx");
  const [mapRoll, setMapRoll] = useState<null | { r: number[]; tot: number; j: Judgment }>(null);
  const [mapSaving, setMapSaving] = useState(false);

  const mapLocation = locations.find((l) => l.id === locSel) ?? defaultLocation;
  const mapGroup = floorPlanGroup(mapLocation, locations);

  /* ---- movement replay: each action with a hex gets its own toggle ----
     on camera: ONLY the freshly made move — each vector is a single
     movement, toggled below; "All" stacks every vector of the scene. */
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

  /* ---- the board is frozen at the LAST SHOWN movement ---- the token
     lands exactly on that action's destination (the arrow shows where it
     came from), so an earlier vector is never painted over a later
     position. No selection → the final snapshot with no arrows. */
  const shownSet = new Set(shownMoves);
  const shownTrailMoves = boardMoves.filter(
    (m): m is TrailMove & { actionId: string } => !!m.actionId && shownSet.has(m.actionId)
  );
  const lastShownId =
    shownTrailMoves.length > 0 ? shownTrailMoves[shownTrailMoves.length - 1].actionId : null;
  const board = lastShownId
    ? narrationBoardAt(latestBeat, { untilActionId: lastShownId, fallbackLocation: mapLocation })
    : narrationBoardAt(latestBeat, { untilActionId: "", fallbackLocation: mapLocation });
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

  // The narration's floor-plan picker follows the same rule: only maps of
  // the same place (plus whatever the scene already pins) so narrations
  // stay anchored to the plan you are working with.
  const narrationPool = Array.from(
    new Map<string, Location>(
      [
        ...mapGroup,
        ...locations.filter(
          (l) => l.id === narrationLocation || l.id === latestBeat?.location?.id
        ),
      ].map((l) => [l.id, l])
    ).values()
  );

  // posições vêm da narration (replay das actions); o roster completa quem ainda não tem token
  const rosterTokens = characters.map((c) => ({
    id: c.id,
    name: c.name || c.username || "Unknown",
    isPlayer: !npcIds.includes(c.id),
    status: npcIds.includes(c.id) ? "npc" : undefined,
    unconscious: false,
  }));
  const tokenById = new Map<string, BoardToken>(rosterTokens.map((t) => [t.id, t]));
  for (const bt of board.tokens) {
    tokenById.set(bt.id, { ...(tokenById.get(bt.id) ?? { id: bt.id, name: bt.name, isPlayer: !npcIds.includes(bt.id) }), ...bt });
  }
  const mapTokens: BoardToken[] = [...tokenById.values()];

  const actorPos = actorCharId ? tokenAt(mapTokens, actorCharId) : null;

  /* ---- log-action hex (sempre visível, acima das tabs) ---- */
  const actionLocation = locations.find((l) => l.id === actionLocId) ?? defaultLocation;
  const actActorHex = actorCharId ? tokenAt(mapTokens, actorCharId) : null;
  const actHex = actionHex ?? actActorHex;
  const actFacing = actActorHex && actHex ? hexDir(actActorHex, actHex) : 0;

  /* ---- test-on-map: distância + alvo ajustado ---- */
  const atkPos = combatActor ? tokenAt(mapTokens, combatActor) : null;
  const tgtPos = combatTarget ? tokenAt(mapTokens, combatTarget) : null;
  const distance = atkPos && tgtPos ? hexDist(atkPos, tgtPos) : null;
  const mapAttacker = characters.find((c) => c.id === combatActor);
  const mapBaseTarget =
    mapAttacker ? mapAttacker[mapCastAttr] ?? mapAttacker.sheet?.[mapCastAttr] ?? 10 : 10;
  const combat =
    atkPos && tgtPos && distance != null
      ? combatRange === "ranged"
        ? {
            penalty: -(distance - 1),
            label: `Ranged · ${distance} hex${distance === 1 ? "" : "es"}`,
            reachable: true,
            dist: distance,
          }
        : distance <= 1
        ? { penalty: 0, label: "Melee · adjacent", reachable: true, dist: distance }
        : distance <= meleeReach
        ? { penalty: -2 * (distance - 1), label: `Melee · reach (${distance} hex)`, reachable: true, dist: distance }
        : { penalty: -2 * (distance - 1), label: `Out of reach (reach ${meleeReach})`, reachable: false, dist: distance }
      : null;
  const adjustedTarget = combat ? mapBaseTarget + combat.penalty : mapBaseTarget;
  const combatMark = actionMode !== "move" && combatTarget && tgtPos ? { q: tgtPos.q, r: tgtPos.r } : null;
  const plateMark = combatMark ?? moveTarget;

  function setMapLocation(id: string) {
    setLocSel(id);
    setMoveTarget(null);
  }

  async function logMove() {
    const loc = mapLocation;
    if (!loc?.id) { alert("No floor plan selected for this session."); return; }
    const actor = actorCharId;
    if (!actor) { alert("No one is up in the queue to move."); return; }
    const fromTok = mapTokens.find((t) => t.id === actor) ?? null;
    const from = { q: fromTok?.q ?? null, r: fromTok?.r ?? null, facing: fromTok?.facing ?? null };
    if (from.q == null || from.r == null) { alert(`${charName(actor)} isn't placed on the map yet.`); return; }
    const start: { q: number; r: number } = { q: from.q, r: from.r };
    const target = moveTarget;
    const turnOnly = !target && facingChoice !== "auto";
    if (!turnOnly && !target) { alert("Click a destination hex on the map first."); return; }
    const facing =
      facingChoice === "auto"
        ? target
          ? hexDir(start, target)
          : (from.facing ?? 0)
        : facingChoice;
    if (target) {
      const dist = hexDist(start, target);
      const mover = characters.find((x) => x.id === actor);
      const sheet = mover?.sheet;
      if (sheet && sheet.move != null) {
        const fatigued = sheet.fatigue_state !== "active";
        const cap = fatigued ? (sheet.effective_move ?? sheet.move) : sheet.move;
        if (dist > cap) {
          alert(`${charName(actor)} has Move ${cap} — ${dist} hexes is too far.`);
          return;
        }
      }
    }
    const payload = {
      narrations_id: latestNarrationId || null,
      character_id: actor,
      description: turnOnly
        ? `Turns to face ${FACING_DIRS[facing]?.label ?? facing}`
        : target
          ? `Moves to hex ${target.q},${target.r}`
          : `Stays at hex ${from.q},${from.r}`,
      queue: nextActionQueue,
      location_id: loc.id,
      q: turnOnly ? from.q : (target ? target.q : from.q),
      r: turnOnly ? from.r : (target ? target.r : from.r),
      facing,
    };
    const alreadyQueued = pendingQueue.some((q) => q.character_id === actor);
    /* no modo 'after_move', um deslocamento real (com destino) encerra o turno
       de quem já estava na vez; quem acabou de entrar pela jogada permanece */
    const endTurnByMove = tableSettings?.turn_end_mode === "after_move" && !!target;
    try {
      /* movimento = tomada de decisão: se o ator não está na fila, abre a vez
         dele no TOPO da fila antes de registrar a ação. */
      if (!alreadyQueued) {
        const enq = await fetch("/api/game-table-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: actor, queue: "0", status: "pending" }),
        });
        const enqJ = await enq.json();
        if (!enqJ.success) throw new Error(enqJ.error || "Failed to enqueue move");
      }
      const res = await fetch("/api/game-table-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        if (endTurnByMove && alreadyQueued) {
          const front = pendingQueue.find((e) => e.character_id === actor) ?? pendingQueue[0];
          if (front) {
            try { await removeFromQueue(front); } catch { /* ignore */ }
          }
        } else if (alreadyQueued) {
          try { await advanceQueue(actor); } catch { /* ignore */ }
        }
        setMoveTarget(null);
        setFacingChoice("auto");
        window.location.reload();
      } else {
        alert("Error: " + (j.error || "Unknown"));
      }
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  function rollMapTest() {
    if (!combat?.reachable) return;
    const { r, tot } = performRoll(3, "6", combat.penalty);
    const j = judgeRoll(tot, adjustedTarget);
    setMapRoll({ r, tot, j });
  }

  async function logMapTest() {
    if (!combat?.reachable || !combatActor || !combatTarget || !atkPos) return;
    if (!mapRoll) { rollMapTest(); return; }
    const tgtName = charName(combatTarget);
    const posture = combatRange === "melee" ? "Melee" : "Ranged";
    const payload = {
      narrations_id: latestNarrationId || null,
      character_id: combatActor,
      description: `${posture} attack on ${tgtName} — ${combat.dist} hex · target ${adjustedTarget}`,
      dice_roll: `${mapRoll.r.join("+")}=${mapRoll.tot}`,
      queue: nextActionQueue,
      target: combatTarget,
      q: atkPos.q,
      r: atkPos.r,
      facing: tgtPos ? hexDir(atkPos, tgtPos) : 0,
      location_id: mapLocation?.id ?? null,
    };
    setMapSaving(true);
    try {
      const res = await fetch("/api/game-table-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        if (pendingQueue.some((q) => q.character_id === combatActor)) {
          try { await advanceQueue(combatActor); } catch { /* ignore */ }
        }
        setMapRoll(null);
        setCombatTarget("");
        router.refresh();
      } else {
        alert("Error: " + (j.error || "Unknown"));
      }
    } catch (err: unknown) {
      alert("Network error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setMapSaving(false);
    }
  }

  const shownActor = actorCharId;
  /* cenas/chapters: sem uma cena existente, part(e) e narration ficam travados */
  const hasScene = !!latestSceneId;
  const currentFacing = actorCharId ? (mapTokens.find((t) => t.id === actorCharId)?.facing ?? null) : null;

  return (
    <>
      {/* ---- CONTEXT BAR (fixed) ---- */}
      <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl overflow-hidden mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Chapter</span>
              <span className={`font-mono text-xl font-bold ${T.text} tabular-nums`}>{chapter}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60" aria-hidden />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Part</span>
              <span className={`font-mono text-xl font-bold ${T.text} tabular-nums`}>{part}</span>
            </div>
            <span className="w-px h-6 bg-zinc-700/60 hidden sm:block" aria-hidden />
            {latestTitle ? (
              <span className="text-sm text-zinc-300 hidden md:inline">{latestTitle}</span>
            ) : null}
          </div>
          {!isPlayer ? (
            <div className="flex gap-2 flex-wrap items-center">
              {[
                { m: "chapter" as const, label: "+ Chapter", hex: T.hex, needsScene: false },
                { m: "moment" as const, label: "+ Part", hex: "#a1a1aa", needsScene: true },
                { m: "narration" as const, label: "+ Narration", hex: "#a1a1aa", needsScene: true },
              ].map((b) => (
                <button
                  key={b.m}
                  onClick={() => setModal(b.m)}
                  disabled={b.needsScene && !hasScene}
                  title={b.needsScene && !hasScene ? "Create a chapter first" : b.label}
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: `${b.hex}55`, color: b.needsScene && !hasScene ? "#52525b" : b.hex }}
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
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 ${T.ring} ${
              tab === t.key ? T.activeTab : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(t.icon, "w-3.5 h-3.5")}
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= TURN QUEUE (above the map) ================= */}
      <div className="space-y-4 mb-6">
        <QueueProcession
          entries={pendingQueue}
          roster={characters}
          tone={isPlayer ? "blue" : "green"}
          myId={isPlayer ? myCharacterId : undefined}
          npcIds={npcIds}
          linkHref={(charId) => `/character/${charId}`}
          onRemove={!isPlayer ? removeFromQueue : undefined}
          onEndTurn={!isPlayer ? (entry) => removeFromQueue(entry) : undefined}
          emptyText={
            isPlayer
              ? "The queue is empty — the scene hasn't opened yet."
              : "The queue is empty — pick who acts next."
          }
        />

        {!isPlayer ? (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/40 p-3">
            <select
              value={queueChar}
              onChange={(e) => setQueueChar(e.target.value)}
              aria-label="Who enters the queue"
              className={`${inputCls(T.inputBorder)} flex-1`}
            >
              <option value="">Who acts next?…</option>
              {characters
                .filter((c) => sceneCharIds.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.username || "Unknown"}{npcIds.includes(c.id) ? " — NPC" : ""}
                  </option>
                ))}
            </select>
            <button
              onClick={addToQueue}
              disabled={!queueChar}
              className={`font-mono text-[12px] font-semibold uppercase tracking-widest px-4 py-2 rounded-lg border ${T.borderCta} transition-colors disabled:opacity-40 w-full sm:w-auto`}
            >
              + Add to queue
            </button>
          </div>
        ) : null}
      </div>

      {/* ================= MAP & ACTION (battle board, under the queue/tabs) ================= */}
      <div className="space-y-4 mb-6">
        <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full ${T.dot}`} style={{ boxShadow: `0 0 8px ${T.shadow}` }} />
            <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Floor plan</span>
            {mapGroup.length > 1 ? (
              <select
                value={mapLocation?.id ?? ""}
                onChange={(e) => setMapLocation(e.target.value)}
                className={`${inputCls(T.inputBorder)} max-w-xs`}
              >
                {mapGroup.map((l) => (
                  <option key={l.id} value={l.id} className="bg-zinc-800">
                    {l.name || "Unnamed"}
                  </option>
                ))}
              </select>
            ) : mapLocation ? (
              <span className="text-sm font-semibold text-zinc-100">{mapLocation.name}</span>
            ) : (
              <span className="text-sm text-zinc-500 italic">No floor plan registered yet</span>
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
              mark={plateMark}
              accent={T.hex}
              R={28}
              M={16}
              onHexClick={
                !isPlayer
                  ? (q, r) => {
                      if (actionMode !== "move") {
                        const t = mapTokens.find((m) => m.q === q && m.r === r);
                        setCombatTarget(t?.id ?? "");
                        if (t?.q != null && t.r != null) {
                          setActionLocId(mapLocation?.id ?? "");
                          setActionHex({ q: t.q, r: t.r });
                        }
                      } else {
                        setMoveTarget({ q, r });
                        setActionLocId(mapLocation?.id ?? "");
                        setActionHex({ q, r });
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <p className="text-sm text-zinc-600 font-mono italic">
              Register a location with a hex grid to open the tactical map.
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
                  aria-label="Toggle replay movement"
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 transition-transform ${
                      replayOpen ? "rotate-90" : ""
                    }`}
                  >
                    {icon("M9 18l6-6-6-6", "w-3.5 h-3.5")}
                  </span>
                  Replay movement
                </button>
                <span className="font-mono text-[10px] text-zinc-600">
                  ({boardMoves.length} move{boardMoves.length !== 1 ? "s" : ""})
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
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-sky-300 hover:text-sky-100 bg-sky-500/10 border border-sky-500/40"
                    >
                      Latest
                    </button>
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
                ) : null}
              </div>
              {replayOpen ? (
                <div className="flex flex-wrap gap-1.5">
                  {boardMoves.map((m) => {
                    const active = !!m.actionId && shownMoves.includes(m.actionId);
                    return (
                      <button
                        key={`${m.id}-${m.actionId ?? "act"}`}
                        onClick={() => m.actionId && toggleMove(m.actionId)}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                          active
                            ? "bg-sky-500/15 border-sky-500/50 text-sky-200"
                            : "bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {charName(m.id)}
                        <span className="opacity-60"> {hexLbl(m.from)} → {hexLbl(m.to)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ---- integrated action: move / melee / ranged + dice ---- */}
        {!isPlayer && mapLocation?.hex?.width != null ? (
          <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`w-2.5 h-2.5 rounded-full ${T.dot}`} style={{ boxShadow: `0 0 8px ${T.shadow}` }} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Action on map</span>
              <div className="flex items-center gap-1">
                {(["move", "melee", "ranged"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setActionMode(m); setMapRoll(null); }}
                    className={`font-mono text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-lg border transition-colors ${
                      actionMode === m ? T.borderCta + " text-zinc-100" : "border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {actionMode === "melee" ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Reach</span>
                  <button
                    type="button"
                    onClick={() => setMeleeReach((v) => Math.max(1, v - 1))}
                    className="w-7 h-7 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none"
                  >
                    −
                  </button>
                  <span className={`w-7 text-center font-mono text-sm font-bold ${T.text}`}>{meleeReach}</span>
                  <button
                    type="button"
                    onClick={() => setMeleeReach((v) => Math.min(6, v + 1))}
                    className="w-7 h-7 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none"
                  >
                    +
                  </button>
                </div>
              ) : null}
            </div>

            {actionMode === "move" ? (
              <>
                <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-4">
                  {/* who is moving + destination */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                      {actorCharId ? (
                        <>
                          <b className={`font-mono text-sm font-bold ${T.text}`}>{charName(actorCharId)}</b>
                          {actorPos ? (
                            <span className="font-mono text-[11px] text-zinc-400">at {actorPos.q},{actorPos.r}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-sm text-zinc-600 italic">no one is up yet — authorize in the queue</span>
                      )}
                      {moveTarget ? (
                        <span className="font-mono text-[12px] font-bold text-emerald-300">→ {moveTarget.q},{moveTarget.r}</span>
                      ) : null}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      Moving
                    </p>
                  </div>

                  {/* facing: horizontal strip · tap the arrow or AUTO */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="inline-flex items-stretch rounded-lg border border-zinc-700/50 bg-zinc-950/40 overflow-hidden">
                        {COMPASS_ORDER.map((i) => {
                          const dir = FACING_DIRS[i];
                          const isSel = facingChoice === i;
                          const isCur = !isSel && facingChoice === "auto" && currentFacing === i;
                          return (
                            <button
                              key={dir.label}
                              type="button"
                              title={dir.label}
                              onClick={() => setFacingChoice(i)}
                              disabled={!actorCharId || !actorPos}
                              className={`w-9 h-10 flex flex-col items-center justify-center leading-none transition-colors border-r border-zinc-700/40 disabled:opacity-30 disabled:cursor-not-allowed ${
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
                        })}
                        <button
                          type="button"
                          onClick={() => setFacingChoice("auto")}
                          disabled={!actorCharId || !actorPos}
                          className={`px-2.5 h-10 font-mono text-[10px] font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            facingChoice === "auto"
                              ? "bg-blue-700/20 text-blue-300"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          auto
                        </button>
                      </div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      Facing
                    </p>
                  </div>

                  {/* log move */}
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={logMove}
                      disabled={!actorCharId || !actorPos || (!moveTarget && facingChoice === "auto")}
                      className={`${T.btnFill} text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {!moveTarget && facingChoice !== "auto"
                        ? `Log turn · face ${FACING_DIRS[facingChoice]?.label ?? facingChoice}`
                        : moveTarget
                          ? `Log move → ${moveTarget.q},${moveTarget.r}`
                          : "Log move · pick a hex"}
                    </button>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      Log move
                    </p>
                  </div>
                </div>
                <p className="mt-2 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                  each move becomes an action with the destination hex: {shownActor ? charName(shownActor) : "—"} from {actorPos ? `${actorPos.q},${actorPos.r}` : "—"} {moveTarget ? `→ ${moveTarget.q},${moveTarget.r}` : facingChoice !== "auto" ? `→ turns to face ${FACING_DIRS[facingChoice]?.label}` : "→ click a hex"}
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[13rem]">
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Attacker</label>
                    <select
                      value={combatActor}
                      onChange={(e) => { setCombatActor(e.target.value); setMapRoll(null); setCombatTarget(""); }}
                      className={inputCls(T.inputBorder)}
                    >
                      {characters.map((c) => (
                        <option key={c.id} value={c.id} className="bg-zinc-800">
                          {c.name || c.username || "Unknown"}{npcIds.includes(c.id) ? " — NPC" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Basis</span>
                      <select
                        value={mapCastAttr}
                        onChange={(e) => { setMapCastAttr(e.target.value as "st" | "dx" | "iq" | "ht"); setMapRoll(null); }}
                        className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1 text-zinc-100 text-sm focus:outline-none"
                      >
                        {["st", "dx", "iq", "ht"].map((s) => (
                          <option key={s} value={s} className="bg-zinc-800">{s.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[13rem]">
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Target</label>
                    <select
                      value={combatTarget}
                      onChange={(e) => { setCombatTarget(e.target.value); setMapRoll(null); }}
                      className={inputCls(T.inputBorder)}
                    >
                      <option value="" className="bg-zinc-800">
                        …click a token on the map
                      </option>
                      {mapTokens
                        .filter((t) => t.q != null && t.r != null && t.id !== combatActor)
                        .map((t) => (
                          <option key={t.id} value={t.id} className="bg-zinc-800">
                            {t.name} — {t.q},{t.r}
                          </option>
                        ))}
                    </select>
                    <p className="mt-2 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                      {combatTarget ? `hex ${tgtPos ? `${tgtPos.q},${tgtPos.r}` : "—"}` : "click a token on the map"}
                    </p>
                  </div>

                  <div className="flex-1 min-w-[13rem]">
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Resolution</span>
                    <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-3 py-2">
                      {combat ? (
                        <>
                          <span className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Distance</span>
                            <b className={`tabular-nums ${T.text}`}>{combat.dist} hex</b>
                          </span>
                          <span className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Posture</span>
                            <span className={combat.reachable ? "text-zinc-200" : "text-red-400"}>{combat.label}</span>
                          </span>
                          <span className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Penalty</span>
                            <b className={`tabular-nums ${combat.penalty >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                              {combat.penalty >= 0 ? "+0" : combat.penalty}
                            </b>
                          </span>
                          <span className="flex items-center justify-between font-mono text-[13px] border-t border-zinc-700/40 pt-1.5">
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Target</span>
                            <b className={`tabular-nums font-bold ${combat.reachable ? (adjustedTarget <= 4 ? "text-emerald-300" : T.text) : "text-red-400"}`}>
                              {mapBaseTarget}{combat.penalty ? ` ${combat.penalty > 0 ? "+" : ""}${combat.penalty} = ${adjustedTarget}` : ""}
                            </b>
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic">
                          click a token on the map to resolve
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {mapRoll ? (
                    <span className={`rounded-lg border px-3 py-1.5 font-mono text-sm tabular-nums ${mapRoll.j.ok ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-red-500/50 bg-red-500/10 text-red-300"}`}>
                      {mapRoll.r.join(" + ")} = {mapRoll.tot} · {mapRoll.j.text}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-600 italic">3d6 · {combat ? `under ${adjustedTarget}` : "awaiting combatants"}</span>
                  )}
                  <button
                    type="button"
                    onClick={rollMapTest}
                    disabled={!combat?.reachable}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Roll 3d6
                  </button>
                  <button
                    type="button"
                    onClick={logMapTest}
                    disabled={mapSaving || !mapRoll || !combat?.reachable}
                    className={`${T.btnFill} text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {mapSaving ? "Saving…" : "+ Log test"}
                  </button>
                </div>
                <p className="mt-2 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                  melee: full at adjacent · −2/hex beyond (reach {meleeReach}) — ranged: −1/hex of distance · logged as an action with the attacker&apos;s hex {combatActor ? charName(combatActor) : "—"}
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* ================= DICE ================= */}
      {tab === "dice" ? (
        <div className="grid grid-cols-1 gap-5">
          {/* tray */}
          <div className="bg-zinc-900/80 border border-zinc-700/40 rounded-xl p-5">
            {/* acting now */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-700/40">
              <span className={`w-2.5 h-2.5 rounded-full ${T.dot}`} style={{ boxShadow: `0 0 8px ${T.shadow}` }} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Acting now</span>
              <span className="text-sm font-semibold text-zinc-100">
                {actorCharId ? charName(actorCharId) : <span className="text-zinc-500">empty queue</span>}
              </span>
              {actorIsNpc ? <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-px rounded bg-amber-400/15 text-amber-300">NPC</span> : null}
<span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                  target: <span style={{ color: attrHex }}>{targetValue()}</span> ({basis === "skill" ? (selectedSkill ? skillLabel(selectedSkill, selectedChar?.sheet ?? null) : "—") : (attrMeta[actSkill]?.label ?? "DX")})
                </span>
            </div>

            {!isPlayer ? (
              <div className="flex items-center gap-2 mb-5 -mt-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  {upEntry && (upEntry.test_dice ?? null) != null
                    ? `Seat test: ${upEntry.test_count ?? 3}d${upEntry.test_dice ?? "6"}${(upEntry.test_mod ?? 0) >= 0 ? "+" : ""}${upEntry.test_mod ?? 0}${
                        upEntry.test_kind === "skill"
                          ? ` · ${seatSkillNote ?? "skill"}`
                          : ` (${(upEntry.test_attr ?? "dx").toUpperCase()})`
                      }`
                    : "No test set for this seat yet"}
                </span>
                <span className="flex-1 h-px bg-zinc-700/40" />
                <button
                  onClick={applyTest}
                  className={`font-mono text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 ${T.borderHover} transition-colors shrink-0`}
                >
                  Save as this seat&apos;s test
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {/* roll builder — a base (skill × attribute) vai primeiro */}
                <div className="flex flex-wrap items-end gap-3 mb-5">
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Test basis</span>
                    {allowSkill ? (
                      <div className="flex items-center gap-1">
                        {(["attr", "skill"] as const).map((b) => (
                          <button
                            key={b}
                            onClick={() => setRollBasis(b)}
                            className={`font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-lg border transition-colors ${
                              basis === b ? T.borderCta + " text-zinc-100" : "border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {b === "attr" ? "Attribute" : "Skill"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-lg border border-zinc-700/50 text-zinc-400">
                        Attribute
                      </div>
                    )}
                  </div>
                  {basis === "skill" ? (
                    <div>
                      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Skill (target level)</span>
                      <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className={`bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${T.inputBorder}`}>
                        <option value="" className="bg-zinc-800">Select…</option>
                        {actorSkills.map((s) => (
                          <option key={s.id} value={s.skill_id || s.id} className="bg-zinc-800">
                            {skillLabel(s, selectedChar?.sheet ?? null)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Attribute</span>
                      <select value={actSkill} onChange={(e) => setActSkill(e.target.value)} className={`bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${T.inputBorder}`}>
                        {["st", "dx", "iq", "ht"].map((s) => (
                          <option key={s} value={s} className="bg-zinc-800">{s.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Die</span>
                    <select value={diceType} onChange={(e) => setDiceType(e.target.value)} className={`bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${T.inputBorder}`}>
                      {["4", "6", "8", "10", "12", "20"].map((d) => (
                        <option key={d} value={d} className="bg-zinc-800">d{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Count</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDiceCount((c) => Math.max(1, c - 1))} className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none">−</button>
                      <span className={`w-10 text-center text-lg font-bold font-mono ${T.text}`}>{diceCount}</span>
                      <button onClick={() => setDiceCount((c) => Math.min(20, c + 1))} className="w-8 h-9 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors leading-none">+</button>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Mod</span>
                    <input type="number" value={diceMod} min={-20} max={20} readOnly={isPlayer} onChange={(e) => setDiceMod(Number(e.target.value))} className={`w-16 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-2 text-zinc-100 text-sm text-center focus:outline-none ${T.inputBorder}`} />
                  </div>
                </div>

                {/* faces */}
                <div className="flex flex-wrap items-center gap-2 mb-5 min-h-[3.5rem]">
                  {rolls.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">{icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-7 h-7 text-zinc-600")} Roll? Your faces appear here.</div>
                  ) : (
                    <DiceMystery
                      burn={revealKey}
                      count={lastDice.count}
                      die={Number(lastDice.die)}
                      faces={rolls}
                      onReveal={() => setRevealed(true)}
                      chipClass={T.diceChip}
                      faceClass={T.diceText}
                      glowColor={T.shadow}
                      size={48}
                    />
                  )}
                </div>

                {/* result */}
                <div className="flex items-center gap-4 flex-wrap">
                  {revealed && total !== null && judgment ? (
                    <div className={`rounded-lg border px-4 py-2.5 ${judgment.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"}`}>
                      <span className={`font-mono text-2xl font-bold tabular-nums ${judgment.ok ? "text-emerald-300" : "text-red-300"}`}>= {total}</span>
                      <span className={`block font-mono text-[11px] uppercase tracking-widest ${judgment.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {judgment.text}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-600">
                      {revealKey > 0 ? "The dice are still in the air…" : <>Click <span className={`${T.textSofter} font-semibold`}>Roll</span> to test.</>}
                    </span>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={rollBtn} disabled={revealKey > 0 && !revealed} className={`${T.btnFill} text-sm font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>{icon("M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z", "w-4 h-4 inline mr-1")}{revealKey > 0 && !revealed ? "Rolling…" : `Roll ${diceCount}d${diceType}`}</button>
                    <button onClick={copyRoll} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">Copy</button>
                  </div>
                </div>

                {effectNote ? (
                  <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-amber-300">{effectNote}</span>
                  </div>
                ) : null}

                {/* curve */}
                {isPlayer ? (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">3d6 curve</span>
                      <span className="flex-1 h-px bg-zinc-700/40" />
                    </div>
                    <div className="flex h-16 items-end gap-0.5 border-b border-zinc-700/40">
                      {Array.from({ length: 16 }, (_, i) => {
                        const face = i + 3;
                        const c = counts.get(face) ?? 0;
                        const isCurrent = revealed && total === face;
                        return (
                          <span key={face} className="flex-1 h-full flex items-end" title={`=${face}`}>
                            <span className={`w-full rounded-t-sm transition-[height] ${isCurrent ? (judgment?.ok ? "bg-emerald-400" : "bg-red-400") : c ? T.curve : "bg-zinc-800"}`} style={{ height: `${c ? Math.max(8, (c / maxCount) * 100) : 3}%` }} />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* log action */}
              {!isPlayer ? (
                <div className="border-l border-zinc-700/40 pl-6 space-y-3">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block">Log action</span>
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-3 py-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Action hex (from the map above)</span>
                    <p className="mt-0.5 font-mono text-[12px] text-zinc-300">
                      {actHex ? (
                        <>hex {actHex.q},{actHex.r} · {actionLocation?.name ?? "—"}{actActorHex ? ` · facing from ${actActorHex.q},${actActorHex.r}` : ""}</>
                      ) : (
                        "click a hex on the floor plan"
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Dice (prefilled)</label>
                    <input type="text" value={actRoll} onChange={(e) => setActRoll(e.target.value)} placeholder="3d6+2=14" className={inputCls(T.inputBorder)} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Target</label>
                    <select value={actTarget} onChange={(e) => setActTarget(e.target.value)} className={inputCls(T.inputBorder)}>
                      <option value="">—</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name || c.username || "Unknown"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Description</label>
                    <input type="text" value={actDesc} onChange={(e) => setActDesc(e.target.value)} placeholder="Attacks the goblin…" className={inputCls(T.inputBorder)} />
                  </div>
                  <button onClick={addAction} className={`w-full ${T.btnFill} text-sm font-bold px-4 py-2.5 rounded-lg transition-colors`}>+ Log action</button>
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
                <span className={`font-mono text-[10px] ${T.text}`}>M.{latestMoment}</span>
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
                  <RollSlip key={a.id} a={a} linkHover={T.linkHover} />
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
                <input type="text" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} required placeholder="Title…" className={inputCls(T.inputBorder)} />
              </div>
              {modal === "narration" ? (
                <>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Floor plan (location)</label>
                    <select value={narrationLocation} onChange={(e) => setNarrationLocation(e.target.value)} className={inputCls(T.inputBorder)}>
                      <option value="" className="bg-zinc-800">No map</option>
                      {narrationPool.map((l) => (
                        <option key={l.id} value={l.id} className="bg-zinc-800">
                          {l.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </div>
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
                              onChange={() => {
                                setNarrationChars((prev) =>
                                  checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                );
                                if (!checked) setNarrationConsc((prev) => ({ ...prev, [c.id]: true }));
                              }}
                              className={T.accent}
                            />
                            <span className={checked ? "text-zinc-100" : "text-zinc-400"}>
                              {c.name || c.username || "Unknown"}
                              {npcIds.includes(c.id) ? " — NPC" : ""}
                            </span>
                            <input
                              type="checkbox"
                              title="Conscious"
                              checked={checked ? (narrationConsc[c.id] !== false) : true}
                              disabled={!checked}
                              onChange={() =>
                                setNarrationConsc((prev) => ({
                                  ...prev,
                                  [c.id]: prev[c.id] !== false ? false : true,
                                }))
                              }
                              className={T.accent}
                            />
                            <span className={`text-[10px] uppercase tracking-wider ${checked ? (narrationConsc[c.id] !== false ? "text-emerald-400/80" : "text-red-400/80") : "text-zinc-600"}`}>
                              {checked ? (narrationConsc[c.id] !== false ? "conscious" : "unconscious") : "—"}
                            </span>
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
                    <textarea value={narrationText} onChange={(e) => setNarrationText(e.target.value)} rows={3} placeholder="Describe what happens…" className={`${inputCls(T.inputBorder)} resize-none`} />
                  </div>
                </>
              ) : null}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModal(null)} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${T.btnFill}`}>Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---- roll slip (journal) ---- */
function RollSlip({ a, linkHover }: { a: NarrationAction; linkHover: string }) {
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
            {charId ? <Link href={`/character/${charId}`} className={linkHover}>{charName}</Link> : charName}
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