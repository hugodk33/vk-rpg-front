"use client";

/* ============================================================
   Seat — who you are at the table (dev-only identity).
   No real auth exists; a seat is the player USER seated at a
   table (`game_table_players`). We remember `{ userId, username,
   characterId }` so the player flow, the hub and the pill all
   agree on whose character is "mine".
   ============================================================ */

export interface Seat {
  userId?: string
  username?: string
  characterId?: string
}

const SEAT_KEY = "vkrpg.seat";

import { ACTOR_COOKIE } from "@/lib/actorCookie";
import { readPerspective, markPlayerSide } from "@/lib/side";

/**
 * Same identity, mirrored as a cookie.
 *
 * Server Components cannot read localStorage, and the backend now decides what
 * a request may see from `?actor=<userId>`. The cookie is what lets a server
 * page supply that actor without every screen taking a user id as a prop.
 * Still not auth — it is the same dev-only identity, just readable both sides.
 *
 * ACTOR_COOKIE lives in lib/actorCookie.ts because this file is a client
 * module, and a server module importing it would not receive plain values.
 */
export { ACTOR_COOKIE };

export function readSeat(): Seat {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as Seat) : {};
  } catch {
    return {};
  }
}

export function writeSeat(seat: Seat): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    /* storage unavailable — the seat stays ephemeral */
  }
  syncActorCookie(seat.userId);
  // Sentar num assento é uma escolha de perspectiva: você acabou de declarar
  // que está jogando, não narrando. Sem isso, abrir o console do jogador era
  // suficiente para ser expulso das rotas do narrador.
  if (seat.userId) markPlayerSide();
}

/** Keeps the actor cookie in step with the seat (clears it when seating out). */
export function syncActorCookie(userId?: string): void {
  if (typeof document === "undefined") return;
  if (userId) {
    document.cookie = `${ACTOR_COOKIE}=${encodeURIComponent(userId)}; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${ACTOR_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }
}

/**
 * `?actor=<userId>&asCharacter=<characterId>` for CLIENT components.
 *
 * Server Components use lib/actor.ts; a client component reads the cookies
 * that lib/side.ts keeps in step. Empty string when there is no identity yet —
 * the backend then refuses the read instead of handing back the whole
 * narrator catalog.
 */
export function seatActorQuery(): string {
  const { actor, asCharacter } = readPerspective();
  if (!actor) return "";
  return `?actor=${encodeURIComponent(actor)}${
    asCharacter ? `&asCharacter=${encodeURIComponent(asCharacter)}` : ""
  }`;
}