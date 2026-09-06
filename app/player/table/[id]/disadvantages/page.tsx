"use client";

import { use, useEffect, useState } from "react";
import type { Disadvantage, GameTableDisadvantages } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

const COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#1e1b4b", border: "#4338ca", badge: "bg-purple-600/80 text-purple-200" },
  Physical: { bg: "#450a0a", border: "#dc2626", badge: "bg-red-600/80 text-red-200" },
  Social: { bg: "#172554", border: "#2563eb", badge: "bg-blue-600/80 text-blue-200" },
  Exotic: { bg: "#083344", border: "#0891b2", badge: "bg-cyan-600/80 text-cyan-200" },
  "Self-Control": { bg: "#2e1065", border: "#7c3aed", badge: "bg-indigo-600/80 text-indigo-200" },
};
const FALLBACK = { bg: "#27272a", border: "#52525b", badge: "bg-zinc-600/80 text-zinc-200" };

export default function PlayerTableDisadvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableDisadvantages | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`).then(setData).catch(() => setData({ table: null, disadvantages: [] }));
    getPlayerCharacterUrl(id).then(setCharacterUrl).catch(() => setCharacterUrl(undefined));
  }, [id]);

  const disadvantages = (data?.disadvantages ?? []).filter((d: Disadvantage) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q)
      || (d.description ?? "").toLowerCase().includes(q)
      || (d.effect ?? "").toLowerCase().includes(q)
      || (d.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-4">
        {data?.table?.title || "Table"} — Disadvantages
      </h1>

      <div className="flex gap-2 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search disadvantages..." className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60" />
        <button type="button" onClick={() => setSearch("")} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Clear</button>
      </div>

      {disadvantages.length === 0 ? (
        <p className="text-zinc-500 italic">No disadvantages found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {disadvantages.map((d: Disadvantage) => {
            const colors = COLORS[d.category ?? ""] ?? FALLBACK;
            return (
              <div key={d.id} className="rounded-lg px-4 py-3" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-zinc-100 font-medium">{d.name || "Unnamed"}</span>
                  <span className="text-red-400 text-xs font-semibold">{d.cost_points ?? ""}</span>
                </div>
                {d.category ? <span className={`inline-block ${colors.badge} text-xs px-2 py-0.5 rounded-full mt-1`}>{d.category}{d.subcategory ? ` / ${d.subcategory}` : ""}</span> : null}
                {d.effect ? <p className="text-zinc-400 text-xs mt-2">{d.effect}</p> : null}
                {d.description ? <p className="text-zinc-500 text-xs mt-1">{d.description}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
