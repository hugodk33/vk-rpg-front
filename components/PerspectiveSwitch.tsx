"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, GameTableCharacters, TableCharacter } from "@/lib/types";
import { interpolate, useTranslation } from "@/lib/i18n";
import { readSeat, writeSeat, type Seat } from "@/lib/seat";
import { readPerspective, setNarratorSide, setPlayerSide, type Side } from "@/lib/side";

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

   Which hat is on is stored explicitly (lib/side.ts) instead of being
   guessed from the seat. Guessing is what used to break: adopting a player
   seat wrote a player id into the actor cookie, and every narrator route
   then read that cookie, decided "that is a player" and redirected here.
   Switching back has to actually undo it, not just write a `vkrpg.role`
   key that nothing ever read.
   ============================================================ */

type Role = "narrator" | "player";

/* The URL is still a strong hint about where you are, but it is no longer the
   source of truth: landing on /player should not, by itself, mean the server
   should filter you as that seat on the narrator's desk. */
function pathRole(pathname: string): Role {
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
  const { t } = useTranslation();
  const [fallbackName, setFallbackName] = useState<string | null>(null);
  const [seat, setSeat] = useState<Seat>({});
  const [side, setSide] = useState<Side>("gm");
  const [busy, setBusy] = useState(false);

  /* localStorage only exists on the client — read the seat after mount
     (and again on navigation / cross-tab changes) so SSR and the first
     client render always agree and no hydration mismatch occurs. */
  useEffect(() => {
    const refresh = () => {
      setSeat(readSeat());
      setSide(readPerspective().side);
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [pathname]);

  /* player seat name for the badge — prefers the seat USER (username);
     falls back to the seat character's sheet name. */
  useEffect(() => {
    if (pathRole(pathname) !== "player") return;
    const s = readSeat();
    if (s.username) return;
    const pid = s.characterId;
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
    const isPlayer = pathRole(pathname) === "player";
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
            if (seat) {
              writeSeat(seat);
              // Also record WHOSE character we are looking through. Without
              // this the narrator cannot preview their own PC: the owner user
              // id alone would still earn the unfiltered view.
              if (seat.characterId) setPlayerSide(seat.characterId, seat.userId);
              setSide("player");
            }
          }
          router.push(`/player/character/${charPage[1]}`);
          return;
        }
        const tableRoute = pathname.match(/^\/table\/([^/]+)/);
        if (tableRoute && tableRoute[1]) {
          const seat = await adoptSeat(tableRoute[1]);
          if (seat) {
            writeSeat(seat);
            if (seat.characterId) {
              setPlayerSide(seat.characterId, seat.userId);
              setSide("player");
              router.push(`/player/character/${seat.characterId}`);
            } else {
              router.push("/player");
            }
          } else {
            router.push("/player");
          }
          return;
        }
        router.push("/player");
        return;
      }
      /* player → narrator.

         This has to clear the perspective, not just move the URL. The seat
         stays (so the player hub still remembers who you were), but the
         narrator hat now wins over whatever the actor cookie says, which is
         what stops narrator routes from bouncing us back here. */
      setNarratorSide();
      setSide("gm");
      router.push(siblingPath(pathname, "narrator"));
    } finally {
      setBusy(false);
    }
  };

  /* Two different questions, deliberately kept apart:
     `isPlayer` (from the URL) decides where the button takes you;
     `wearingPlayerHat` (stored) is what the server actually honours when it
     filters. When they disagree — sitting on /player with the narrator hat
     on — the hat wins the badge, because that is what the data will show. */
  const isPlayer = pathRole(pathname) === "player";
  const wearingPlayerHat = side === "player";
  const displayName = seat.username ?? fallbackName;
  const seatLabel = wearingPlayerHat
    ? displayName
      ? interpolate(t("ps.playerSeat"), { name: displayName })
      : t("ps.player")
    : t("ps.narrator");
  const hint = isPlayer ? t("ps.toGm") : t("ps.toPlayer");

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      <button
        type="button"
        onClick={onSwitch}
        disabled={busy}
        title={
          isPlayer
            ? t("ps.titleGm")
            : t("ps.titlePlayer")
        }
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-70 ${
          wearingPlayerHat
            ? "bg-blue-900/80 border-blue-700/60 text-blue-100 hover:bg-blue-800/80"
            : "bg-green-900/80 border-green-900/60 text-white hover:bg-green-900/80"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${wearingPlayerHat ? "bg-blue-300" : "bg-green-500"}`}
        />
        <span className="font-mono uppercase tracking-widest">{seatLabel}</span>
        <span
          className={`font-mono text-[10px] ${wearingPlayerHat ? "text-blue-300/70" : "text-green-400/70"}`}
        >
          {busy ? "…" : hint}
        </span>
      </button>
    </div>
  );
}