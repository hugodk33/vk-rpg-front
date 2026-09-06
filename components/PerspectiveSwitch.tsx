"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, GameTableCharacters } from "@/lib/types";

/* ============================================================
   Perspective Switch — dev tool that simulates an OAuth seat.
   No real auth exists; identity is a URL + a localStorage seat.
   This pill lets you flip between the narrator (GM) perspective
   and the player (Elric) perspective from anywhere, remembering
   who you are:

     npm run dev  →  visit any page, click the pill bottom-right.

   It maps the current route to its sibling (narrator <-> player)
   and, when entering the player view of a character sheet, injects
   `?viewer=<your character>` so the player only sees what their
   visibility rules release to them.
   ============================================================ */

type Role = "narrator" | "player";

const ROLE_KEY = "vkrpg.role";
const CHAR_KEY = "vkrpg.playerCharacter";

/* sub-pages shared by both route trees; narrator-only pages
   (visibility, edit, ...) fall back to the table home. */
const SHARED_SUBS = new Set([
  "sessions",
  "scenes",
  "characters",
  "items",
  "skills",
  "advantages",
  "disadvantages",
  "locations",
]);

function currentRole(pathname: string): Role {
  return pathname.startsWith("/player") ? "player" : "narrator";
}

function siblingPath(pathname: string, target: Role, viewer: string | null): string {
  const table = pathname.match(/^\/(?:table|player\/table)\/([^/]+)(?:\/([^/]+))?/);
  if (table) {
    const [, tableId, sub] = table;
    const keep = sub && SHARED_SUBS.has(sub) ? sub : "";
    const base = target === "player" ? `/player/table/${tableId}` : `/table/${tableId}`;
    return keep ? `${base}/${keep}` : base;
  }

  const playerChar = pathname.match(/^\/player\/character\/([^/]+)(?:\/(session|view))?/);
  if (playerChar) return `/character/${playerChar[1]}`;

  const narratorChar = pathname.match(/^\/character\/([^/]+)/);
  if (narratorChar && target === "player") {
    const base = `/player/character/${narratorChar[1]}/view`;
    return viewer ? `${base}?viewer=${encodeURIComponent(viewer)}` : base;
  }

  if (pathname === "/narrator" && target === "player") return "/player";
  if (pathname === "/player" && target === "narrator") return "/narrator";

  return target === "player" ? "/player" : "/narrator";
}

export default function PerspectiveSwitch() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* remember the player seat while browsing player console routes */
  useEffect(() => {
    const m = pathname.match(/^\/player\/character\/([^/]+)/);
    if (m) {
      const id = m[1];
      if (localStorage.getItem(CHAR_KEY) !== id) localStorage.setItem(CHAR_KEY, id);
    }
  }, [pathname]);

  /* player seat name for the badge */
  useEffect(() => {
    if (currentRole(pathname) !== "player") return;
    const pid = localStorage.getItem(CHAR_KEY);
    if (!pid) return;
    let alive = true;
    api<CharacterViewer>(`/game-table-character/${pid}`)
      .then((d) => {
        if (alive) setName(d?.character?.sheet?.name || d?.character?.name || null);
      })
      .catch(() => {
        if (alive) setName(null);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  const onSwitch = async () => {
    if (busy) return;
    const next: Role = currentRole(pathname) === "narrator" ? "player" : "narrator";
    const charPage = pathname.match(/^\/character\/([^/]+)/);
    let viewer: string | null = localStorage.getItem(CHAR_KEY);
    setBusy(true);
    try {
      if (next === "player" && charPage && !viewer) {
        const me = await api<CharacterViewer>(`/game-table-character/${charPage[1]}`);
        const tableId = me?.table?.id;
        if (tableId) {
          const chars = await api<GameTableCharacters>(`/game-table-characters/${tableId}`);
          const id = (chars?.characters ?? []).find((c) => !c.isNpc)?.id ?? null;
          if (id) {
            viewer = id;
            localStorage.setItem(CHAR_KEY, id);
          }
        }
      }
    } catch {
      /* keep viewer null — the player view falls back to full */
    } finally {
      localStorage.setItem(ROLE_KEY, next);
      setBusy(false);
      router.push(siblingPath(pathname, next, viewer));
    }
  };

  const isPlayer = currentRole(pathname) === "player";
  const seat = isPlayer ? (name ? `Player · ${name}` : "Player") : "Narrator";
  const hint = isPlayer ? "→ GM" : "→ Player";

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      <button
        type="button"
        onClick={onSwitch}
        title={
          isPlayer
            ? "Switch to the narrator (GM) perspective"
            : `Switch to the player perspective${name ? ` (${name})` : ""}`
        }
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
          isPlayer
            ? "bg-blue-900/80 border-blue-700/60 text-blue-100 hover:bg-blue-800/80"
            : "bg-amber-900/80 border-amber-700/60 text-amber-100 hover:bg-amber-800/80"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${isPlayer ? "bg-blue-300" : "bg-amber-300"}`}
        />
        <span className="font-mono uppercase tracking-widest">{seat}</span>
        <span className={`font-mono text-[10px] ${isPlayer ? "text-blue-300/70" : "text-amber-300/70"}`}>
          {busy ? "…" : hint}
        </span>
      </button>
    </div>
  );
}