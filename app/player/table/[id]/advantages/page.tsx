"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { readSeat } from "@/lib/seat";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function PlayerTableAdvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const seat = readSeat();
  const seatUserId = searchParams.get("user") ?? seat.userId;
  const seatCharId = searchParams.get("character") ?? seat.characterId;
  const [data, setData] = useState<GameTableAdvantages | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPlayerCharacterUrl(id, { userId: seatUserId, characterId: seatCharId }).then((url) => {
      if (cancelled) return;
      setCharacterUrl(url);
      const viewerId = url?.split("/").pop() ?? "";
      const q = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
      api<GameTableAdvantages>(`/game-table-advantages/${id}${q}`)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData({ table: null, advantages: [] }); });
    }).catch(() => { if (!cancelled) setCharacterUrl(undefined); });
    return () => { cancelled = true; };
  }, [id, seatUserId, seatCharId]);

  const advantages = (data?.advantages ?? []).filter((a: Advantage) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name ?? "").toLowerCase().includes(q)
      || (a.description ?? "").toLowerCase().includes(q)
      || (a.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-4">
        {data?.table?.title || "Table"} — Advantages
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search advantages..."
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60"
        />
        <button type="button" onClick={() => setSearch("")} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Clear
        </button>
      </div>

      {advantages.length === 0 ? (
        <p className="text-zinc-500 italic">No advantages found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advantages.map((a: Advantage) => (
            <div key={a.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{a.name || "Unnamed"}</span>
                <span className="text-emerald-400 text-xs font-semibold">{a.cost_points ?? ""}</span>
              </div>
              {a.category ? (
                <span className="text-xs text-zinc-500">{a.category}{a.subcategory ? ` / ${a.subcategory}` : ""}</span>
              ) : null}
              {a.description ? <p className="text-zinc-500 text-xs mt-1">{a.description}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
