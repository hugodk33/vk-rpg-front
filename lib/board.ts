/* ============================================================
   board — how a narration becomes a floor-plan snapshot.
   Each narration pins a location and places tokens (characters +
   npcs) at their starting hexes; actions then move those tokens
   hex by hex (q/r is the destination of the movement). This module
   replays the actions in queue order and returns the final token
   positions plus the last movement trail, so the same snapshot
   drives the mini-map in the timeline and the session MAP tab.
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

  const sorted = [...(n.actions ?? [])].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));
  let trail: BoardTrail | null = null;
  const moves: TrailMove[] = [];

  for (const a of sorted) {
    if (a.q == null || a.r == null) continue;
    const token = tokens.find((t) => t.id === a.character?.id);
    if (!token) continue;
    const from = token.q != null && token.r != null ? { q: token.q, r: token.r } : null;
    setPos(token, a.q, a.r, a.facing);
    const to = { q: a.q, r: a.r };
    moves.push({ id: token.id, from, to });
    trail = { from, to, moves: [...moves] };
  }

  return {
    location: n.location ?? fallbackLocation ?? null,
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