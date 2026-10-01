"use client";

import {
  ACTOR_COOKIE,
  AS_CHARACTER_COOKIE,
  DEFAULT_SIDE,
  SIDE_COOKIE,
  parseSide,
  type Side,
} from "@/lib/actorCookie";

/* ============================================================
   Which hat am I wearing?

   There used to be only one piece of identity — the seat, meaning
   "the PC I am playing". That made it impossible to be the narrator
   while a player seat was saved: every narrator route read the seat,
   treated you as that player and redirected you to the player
   console.

   Now the side is explicit and separate from the seat:

     side = "gm"      → you are the narrator; full catalog, no redirect
     side = "player"  → you are playing; filtered, and narrator routes
                        hand you over to the player console

   The narrator side is the default, and picking a player side also
   records WHICH character you picked (`asCharacter`), so the narrator
   can preview the table through any PC's eyes — including their own,
   which a plain user id could never express.

   Still not auth. These are three cookies any client can write.
   ============================================================ */

const SIDE_KEY = "vkrpg.side";
const AS_CHARACTER_KEY = "vkrpg.asCharacter";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable — the cookie below still carries the state */
  }
}

function setCookie(name: string, value: string | null): void {
  if (typeof document === "undefined") return;
  document.cookie = value
    ? `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`
    : `${name}=; path=/; Max-Age=0; SameSite=Lax`;
}

export interface Perspective {
  side: Side;
  /** Character being previewed. Only meaningful on the player side. */
  asCharacter: string | null;
  /** User id the backend should treat as the requester. */
  actor: string | null;
}

export function readPerspective(): Perspective {
  const cookieSide = typeof document === "undefined" ? null : readCookie(SIDE_COOKIE);
  const side = parseSide(cookieSide ?? readStorage(SIDE_KEY));
  const asCharacter =
    (typeof document === "undefined" ? null : readCookie(AS_CHARACTER_COOKIE)) ??
    readStorage(AS_CHARACTER_KEY);
  const actor = typeof document === "undefined" ? null : readCookie(ACTOR_COOKIE);
  return { side, asCharacter: asCharacter || null, actor: actor || null };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) || null : null;
}

/**
 * Puts on the narrator hat: full catalog, and narrator routes stop
 * redirecting you to the player console.
 */
export function setNarratorSide(): void {
  writeStorage(SIDE_KEY, "gm");
  setCookie(SIDE_COOKIE, "gm");
  setCookie(AS_CHARACTER_COOKIE, null);
  writeStorage(AS_CHARACTER_KEY, null);
}

/**
 * Puts on a player's hat, looking through `characterId`'s eyes.
 *
 * `actorUserId` is that character's real owner, so the backend resolves us
 * as that player without any special-casing. `asCharacter` is sent alongside
 * because when the character is the narrator's own PC, the user id alone
 * would still earn the narrator's unfiltered view.
 */
export function setPlayerSide(characterId: string, actorUserId?: string): void {
  writeStorage(SIDE_KEY, "player");
  writeStorage(AS_CHARACTER_KEY, characterId);
  setCookie(SIDE_COOKIE, "player");
  setCookie(AS_CHARACTER_COOKIE, characterId);
  if (actorUserId) {
    setCookie(ACTOR_COOKIE, actorUserId);
    writeStorage("vkrpg.actor", actorUserId);
  }
}

/**
 * Only records the hat, leaving any chosen character alone.
 *
 * Used when someone seats at the player hub: sitting down is itself a
 * statement that you are playing now, and that must not leave the narrator
 * routes locked out.
 */
export function markPlayerSide(): void {
  writeStorage(SIDE_KEY, "player");
  setCookie(SIDE_COOKIE, "player");
}

export { DEFAULT_SIDE };
export type { Side };
