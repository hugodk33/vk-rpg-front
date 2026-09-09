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
}