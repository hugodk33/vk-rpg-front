"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { GameTable, GameTableCharacters, TableCharacter } from "@/lib/types";
import { readSeat } from "@/lib/seat";

/* ============================================================
   /player/character — no character id on the path.
   Resolves "my" seat (localStorage `vkrpg.seat`): if it already
   has a character, jump straight to that console; otherwise find
   the first table + seat for the stored user and land there;
   fall back to /player when there's no seat at all.
   ============================================================ */

export default function PlayerCharacterIndex() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const seat = readSeat();

    if (seat.characterId) {
      router.replace(`/player/character/${seat.characterId}`);
      return;
    }

    (async () => {
      try {
        const tables = await api<GameTable[]>("/game-tables");
        for (const t of tables) {
          const chars = await api<GameTableCharacters>(`/game-table-characters/${t.id}`).catch(
            () => ({ table: null, characters: [] })
          );
          const seats = (chars?.characters ?? []).filter((c: TableCharacter) => !c.isNpc && c.user?.id);
          const mine = seat.userId
            ? seats.find((c: TableCharacter) => c.user?.id === seat.userId)
            : undefined;
          const picked = mine ?? seats[0];
          if (picked) {
            if (alive) router.replace(`/player/character/${picked.id}`);
            return;
          }
        }
        if (alive) router.replace("/player");
      } catch {
        if (alive) router.replace("/player");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 beacon mx-auto" />
        <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
          Encontrando seu assento…
        </p>
      </div>
    </div>
  );
}