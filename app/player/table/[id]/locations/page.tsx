"use client";

import { use, useEffect, useState } from "react";
import type { GameTableLocations, Location } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function PlayerTableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableLocations | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPlayerCharacterUrl(id).then((url) => {
      if (cancelled) return;
      setCharacterUrl(url);
      const viewerId = url?.split("/").pop() ?? "";
      const q = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
      api<GameTableLocations>(`/game-table-locations/${id}${q}`)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData({ table: null, locations: [] }); });
    }).catch(() => {
      if (!cancelled) setCharacterUrl(undefined);
    });
    return () => { cancelled = true; };
  }, [id]);

  const locations = (data?.locations ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.name ?? "").toLowerCase().includes(q)
      || (l.region ?? "").toLowerCase().includes(q)
      || (l.address ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-4">
        {data?.table?.title || "Table"} — Locations
      </h1>

      <div className="flex gap-2 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search locations..." className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60" />
        <button type="button" onClick={() => setSearch("")} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Clear</button>
      </div>

      {locations.length === 0 ? (
        <p className="text-zinc-500 italic">No locations found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((l: Location) => (
            <div key={l.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-zinc-200 font-medium">{l.name || "Unnamed"}</span>
              </div>
              {l.region ? <p className="text-xs text-zinc-500 ml-6">{l.region}{l.subRegion ? ", " + l.subRegion : ""}</p> : null}
              {l.address ? <p className="text-xs text-zinc-500 ml-6">{l.address}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
