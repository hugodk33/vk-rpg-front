"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { GameTableCharacters } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import RadarChart from "@/components/RadarChart";
import { api } from "@/lib/api";

export default function PlayerTableCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableCharacters | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getPlayerCharacterUrl(id)
      .then((url) => {
        setCharacterUrl(url);
        const myId = url?.match(/\/player\/character\/([^/?]+)/)?.[1];
        const charsUrl = myId
          ? `/game-table-characters/${id}?viewer=${encodeURIComponent(myId)}`
          : `/game-table-characters/${id}`;
        return api<GameTableCharacters>(charsUrl);
      })
      .then(setData)
      .catch(() => setData({ table: null, characters: [] }));
  }, [id]);

  const myId = characterUrl?.match(/\/player\/character\/([^/?]+)/)?.[1];

  const allChars = data?.characters ?? [];
  const players = allChars.filter((ch) => !ch.isNpc);
  const npcs = allChars.filter((ch) => ch.isNpc && (ch.known ?? false));

  const q = search.toLowerCase();
  const filteredPlayers = players.filter((ch) => {
    if (!q) return true;
    const s = ch.sheet;
    return (s?.name ?? ch.name ?? "").toLowerCase().includes(q)
      || (ch.user?.username ?? "").toLowerCase().includes(q);
  });
  const filteredNpcs = npcs.filter((ch) => {
    if (!q) return true;
    const s = ch.sheet;
    return (s?.name ?? ch.name ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-4">
        {data?.table?.title || "Table"} — Characters
      </h1>

      <div className="flex gap-2 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search characters..." className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60" />
        <button type="button" onClick={() => setSearch("")} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Clear</button>
      </div>

      <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-blue-400/80 mb-2">
        Company {filteredPlayers.length}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filteredPlayers.map((ch) => {
          const s = ch.sheet;
          return (
            <div key={ch.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3 flex flex-col items-center">
              <div className="w-full flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{s?.name || ch.name || "???"}</span>
                <span className="text-zinc-500 text-xs">{ch.user?.username ?? ""}</span>
              </div>
              {s ? <RadarChart st={s.st} dx={s.dx} iq={s.iq} ht={s.ht} /> : null}
              {s ? (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs mt-2">
                  <span className="text-red-400">ST {s.st ?? "-"}</span>
                  <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                  <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                  <span className="text-purple-400">HT {s.ht ?? "-"}</span>
                </div>
              ) : (
                <p className="text-zinc-600 text-xs italic mt-1">No sheet</p>
              )}
              {myId ? (
                <Link
                  href={ch.id === myId ? characterUrl ?? `/character/${ch.id}` : `/player/character/${ch.id}/view?viewer=${myId}`}
                  className="w-full text-center bg-blue-700/60 hover:bg-blue-600 text-blue-100 text-xs font-medium px-3 py-2 rounded-lg transition-colors mt-3"
                >
                  {ch.id === myId ? "My sheet" : "View sheet"}
                </Link>
              ) : (
                <Link
                  href={`/character/${ch.id}`}
                  className="w-full text-center bg-blue-700/60 hover:bg-blue-600 text-blue-100 text-xs font-medium px-3 py-2 rounded-lg transition-colors mt-3"
                >
                  Sheet
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-blue-400/80 mb-2">
        NPCs you know {filteredNpcs.length}
      </h2>
      {myId && filteredNpcs.length === 0 ? (
        <p className="text-zinc-500 italic text-sm mb-8">No NPCs released to you yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNpcs.map((ch) => {
            const s = ch.sheet;
            return (
              <div key={ch.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3 flex flex-col items-center">
                <div className="w-full flex justify-between items-start mb-1">
                  <span className="text-zinc-200 font-medium">{s?.name || ch.name || "???"}</span>
                  <span className="text-zinc-500 text-xs">NPC</span>
                </div>
                {s ? (
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs mt-2">
                    <span className="text-red-400">ST {s.st ?? "-"}</span>
                    <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                    <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                    <span className="text-purple-400">HT {s.ht ?? "-"}</span>
                  </div>
                ) : (
                  <p className="text-zinc-600 text-xs italic mt-1">Unknown</p>
                )}
                {myId ? (
                  <Link
                    href={`/player/character/${ch.id}/view?viewer=${myId}`}
                    className="w-full text-center bg-blue-700/60 hover:bg-blue-600 text-blue-100 text-xs font-medium px-3 py-2 rounded-lg transition-colors mt-3"
                  >
                    See what you know
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}