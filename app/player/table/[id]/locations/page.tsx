"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameTableLocations, Location } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { readSeat } from "@/lib/seat";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function PlayerTableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const seat = readSeat();
  const seatUserId = searchParams.get("user") ?? seat.userId;
  const seatCharId = searchParams.get("character") ?? seat.characterId;
  const [data, setData] = useState<GameTableLocations | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPlayerCharacterUrl(id, { userId: seatUserId, characterId: seatCharId }).then((url) => {
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
  }, [id, seatUserId, seatCharId]);

  const locations = (data?.locations ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.name ?? "").toLowerCase().includes(q)
      || (l.region ?? "").toLowerCase().includes(q)
      || (l.address ?? "").toLowerCase().includes(q);
  });

  const childCounts = useMemo(() => {
    const m = new Map<string, number>();
    const walk = (node: Location) => {
      const kids = node.children ?? [];
      m.set(node.id, kids.length);
      for (const kid of kids) walk(kid);
    };
    for (const root of data?.tree ?? []) walk(root);
    return m;
  }, [data]);

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
          {locations.map((l: Location) => {
            const hasChildren = (childCounts.get(l.id) ?? 0) > 0;
            return (
              <div
                key={l.id}
                className="group relative flex h-full flex-col rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-4 py-3 transition-all hover:border-blue-700/50 hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-zinc-200 font-medium group-hover:text-blue-100 truncate">{l.name || "Unnamed"}</span>
                </div>
                {l.region ? <p className="text-xs text-zinc-500 ml-6">{l.region}{l.subRegion ? ", " + l.subRegion : ""}</p> : null}
                {l.address ? <p className="text-xs text-zinc-500 ml-6">{l.address}</p> : null}

                <div className="mt-3 flex items-center gap-2 border-t border-zinc-700/40 pt-2.5 mt-auto">
                  <button
                    type="button"
                    onClick={() => router.push(`/player/location/${l.id}`)}
                    disabled={!hasChildren}
                    title={hasChildren ? `Abrir ${childCounts.get(l.id)} subdivisões` : "Este local não contém subdivisões"}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-blue-700/40 bg-blue-400/5 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-blue-300/90 transition-colors hover:bg-blue-400/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-400/5 disabled:hover:text-blue-300/90"
                  >
                    ◱ Sublocations
                  </button>
                  <Link
                    href={`/player/location/${l.id}`}
                    title={`Abrir ${l.name || "location"} em página própria`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
