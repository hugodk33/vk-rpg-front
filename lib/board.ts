/* ============================================================
   board — how a narration becomes a floor-plan snapshot.
   Each narration pins a location and places tokens (characters +
   npcs) at their starting hexes; actions then move those tokens
   hex by hex (q/r is the destination of the movement). This module
   replays the actions in queue order and returns the final token
   positions plus the movement trail, so the same snapshot drives
   the mini-map in the timeline, the session MAP tab and the
   battle-log map (one action at a time).
   ============================================================ */

import type { Location, Narration } from "./types";

export interface BoardToken {
  /** character_id (characters e npcs compartilham o mesmo namespace) */
  id: string;
  name: string;
  q?: number | null;
  r?: number | null;
  facing?: number | null;
  isPlayer: boolean;
  unconscious?: boolean;
  status?: string;
}

export interface TrailMove {
  id: string;
  /** action that produced this move (for per-action replay toggles) */
  actionId?: string;
  /** queue position of the action in the narration */
  queue?: number | null;
  from: { q: number; r: number } | null;
  to: { q: number; r: number };
}

export interface BoardTrail {
  from: { q: number; r: number } | null;
  to: { q: number; r: number };
  /** movements of every token, in queue order (polyline source) */
  moves?: TrailMove[];
}

export interface BeatBoard {
  location: Location | null;
  tokens: BoardToken[];
  trail: BoardTrail | null;
}

function setPos(t: { q?: number | null; r?: number | null; facing?: number | null }, q: number | null | undefined, r: number | null | undefined, facing?: number | null | undefined) {
  t.q = q ?? null;
  t.r = r ?? null;
  if (facing != null) t.facing = facing;
}

export function narrationBoard(n: Narration | null | undefined, fallbackLocation?: Location | null): BeatBoard {
  return narrationBoardAt(n, { fallbackLocation });
}

export interface NarrationBoardOpts {
  /** replay only ONE movement: positions land after that action, the trail
      carries just that move. Pass "" to pause before replaying any move —
      positions resolve to the final snapshot but no arrow is drawn. When
      set to an action without a hex, the trail is similarly null. */
  untilActionId?: string | null;
  fallbackLocation?: Location | null;
}

/** The floor-plan snapshot of a narration, optionally paused at one action.
    With `untilActionId` the tokens are replayed up to (and including) that
    action — so "where everyone stood when it happened" — while the trail
    exposes only that single movement, the perspective the battle-log map
    uses to show one move at a time instead of every vector at once.
    `untilActionId: ""` yields the same board with no trail at all. */
export function narrationBoardAt(n: Narration | null | undefined, opts?: NarrationBoardOpts): BeatBoard {
  if (!n) return { location: null, tokens: [], trail: null };

  const tokens: BoardToken[] = [
    ...(n.characters ?? []).map((c) => ({
      id: c.id,
      name: c.name || c.username || "Player",
      q: c.q,
      r: c.r,
      facing: c.facing,
      isPlayer: true,
      unconscious: c.conscious === false,
    })),
    ...(n.npcs ?? []).map((np) => ({
      id: np.characterId,
      name: np.name || "NPC",
      q: np.q,
      r: np.r,
      facing: np.facing,
      isPlayer: false,
      status: np.status,
    })),
  ];

  const sorted = [...(n.actions ?? [])].sort(
    (a, b) => (a.moment ?? 0) - (b.moment ?? 0) || (a.queue ?? 0) - (b.queue ?? 0),
  );
  const until = opts?.untilActionId ?? null;
  const freezeBefore = until === "";
  const targetIdx = until ? sorted.findIndex((a) => a.id === until) : -1;
  const moves: TrailMove[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (targetIdx >= 0 && i > targetIdx) break;
    if (a.q == null || a.r == null) continue;
    const token = tokens.find((t) => t.id === a.character?.id);
    if (!token) continue;
    const from = token.q != null && token.r != null ? { q: token.q, r: token.r } : null;
    setPos(token, a.q, a.r, a.facing);
    const to = { q: a.q, r: a.r };
    const record = freezeBefore ? false : targetIdx >= 0 ? i === targetIdx : true;
    if (record) moves.push({ id: token.id, actionId: a.id, queue: a.queue, from, to });
  }

  const trail: BoardTrail | null = moves.length
    ? { from: moves[moves.length - 1]?.from ?? null, to: moves[moves.length - 1].to, moves }
    : null;

  return {
    location: n.location ?? opts?.fallbackLocation ?? null,
    tokens,
    trail,
  };
}

/** Posição atual do token (o replay já aplicou as moves da narration). */
export function tokenAt(tokens: BoardToken[], id: string): { q: number; r: number } | null {
  const t = tokens.find((x) => x.id === id);
  if (t && t.q != null && t.r != null) return { q: t.q, r: t.r };
  return null;
}