"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, GameTableCharacters, TableCharacter } from "@/lib/types";
import { readSeat, writeSeat, type Seat } from "@/lib/seat";

/* ============================================================
   Perspective Switch — dev tool that simulates an OAuth seat.
   No real auth exists; identity is a URL + a localStorage seat
   (the player USER seated at a table). This pill flips between
   the narrator (GM) perspective and the player perspective,
   remembering who you are:

     npm run dev  →  visit any page, click the pill bottom-right.

   Landing rules, switching INTO the player side:
     · /character/<id>   → /player/character/<id>  (your own console,
                            sheet open by default — your sheet).
     · /table/<id>/...   → /player/character/<your seat>  (console
                            open, table resources accessible from there).
     · anything else     → /player.
   ============================================================ */

type Role = "narrator" | "player";

const ROLE_KEY = "vkrpg.role";

function currentRole(pathname: string): Role {
  return pathname.startsWith("/player") ? "player" : "narrator";
}

function siblingPath(pathname: string, target: Role): string {
  const table = pathname.match(/^\/(?:table|player\/table)\/([^/]+)(?:\/([^/]+))?/);
  if (table) {
    const [, tableId] = table;
    if (target === "player") return "/player";
    return `/table/${tableId}`;
  }

  const playerChar = pathname.match(/^\/player\/character\/([^/]+)(?:\/(session|view))?/);
  if (playerChar) return `/character/${playerChar[1]}`;

  const narratorChar = pathname.match(/^\/character\/([^/]+)/);
  if (narratorChar) return `/player/character/${narratorChar[1]}`;

  if (pathname === "/narrator") return "/player";
  if (pathname === "/player") return "/narrator";

  return target === "player" ? "/player" : "/narrator";
}

/* Pick the seat for a table: my stored user if seated there,
   otherwise the first player-user with a character. */
async function adoptSeat(tableId: string, preferCharId?: string): Promise<Seat | null> {
  try {
    const data = await api<GameTableCharacters>(`/game-table-characters/${tableId}`);
    const seats = (data?.characters ?? [])
      .filter((c: TableCharacter) => !c.isNpc && c.user?.id)
      .map((c: TableCharacter) => ({
        userId: c.user!.id!,
        username: c.user!.username ?? undefined,
        characterId: c.id,
      }));
    if (seats.length === 0) return readSeat().userId ? readSeat() : null;

    const target = preferCharId
      ? seats.find((s) => s.characterId === preferCharId)
      : undefined;
    const stored = readSeat();
    const mine = stored.userId ? seats.find((s) => s.userId === stored.userId) : undefined;
    const picked = target ?? mine ?? seats[0];
    return { ...picked, username: picked.username ?? stored.username };
  } catch {
    return readSeat().userId ? readSeat() : null;
  }
}

export default function PerspectiveSwitch() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [fallbackName, setFallbackName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* player seat name for the badge — prefers the seat USER (username);
     falls back to the seat character's sheet name. */
  useEffect(() => {
    if (currentRole(pathname) !== "player") return;
    const seat = readSeat();
    if (seat.username) return;
    const pid = seat.characterId;
    if (!pid) return;
    let alive = true;
    api<CharacterViewer>(`/game-table-character/${pid}`)
      .then((d) => {
        if (alive) setFallbackName(d?.character?.sheet?.name || d?.character?.name || null);
      })
      .catch(() => {
        if (alive) setFallbackName(null);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  const onSwitch = async () => {
    if (busy) return;
    const isPlayer = currentRole(pathname) === "player";
    setBusy(true);
    try {
      if (!isPlayer) {
        const charPage = pathname.match(/^\/character\/([^/]+)/);
        const me = charPage
          ? await api<CharacterViewer>(`/game-table-character/${charPage[1]}`).catch(() => null)
          : null;
        const tableId = me?.table?.id;
        if (charPage && me) {
          if (tableId) {
            const seat = await adoptSeat(tableId, charPage[1]);
            if (seat) writeSeat(seat);
          }
          router.push(`/player/character/${charPage[1]}`);
          return;
        }
        const tableRoute = pathname.match(/^\/table\/([^/]+)/);
        if (tableRoute && tableRoute[1]) {
          const seat = await adoptSeat(tableRoute[1]);
          if (seat) writeSeat(seat);
          if (seat?.characterId) {
            router.push(`/player/character/${seat.characterId}`);
          } else {
            router.push("/player");
          }
          return;
        }
        router.push("/player");
        return;
      }
      /* player → narrator */
      localStorage.setItem(ROLE_KEY, "narrator");
      router.push(siblingPath(pathname, "narrator"));
    } finally {
      setBusy(false);
    }
  };

  const isPlayer = currentRole(pathname) === "player";
  const seat = readSeat();
  const displayName = seat.username ?? fallbackName;
  const seatLabel = isPlayer
    ? displayName
      ? `Player · ${displayName}`
      : "Player"
    : "Narrator";
  const hint = isPlayer ? "→ GM" : "→ Player";

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      <button
        type="button"
        onClick={onSwitch}
        title={
          isPlayer
            ? "Switch to the narrator (GM) perspective"
            : "Switch to the player perspective (your seat)"
        }
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
          isPlayer
            ? "bg-blue-900/80 border-blue-700/60 text-blue-100 hover:bg-blue-800/80"
            : "bg-green-900/80 border-green-900/60 text-white hover:bg-green-900/80"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${isPlayer ? "bg-blue-300" : "bg-green-500"}`}
        />
        <span className="font-mono uppercase tracking-widest">{seatLabel}</span>
        <span className={`font-mono text-[10px] ${isPlayer ? "text-blue-300/70" : "text-green-400/70"}`}>
          {busy ? "…" : hint}
        </span>
      </button>
    </div>
  );
}