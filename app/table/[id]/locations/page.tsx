"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { GameTableScenes, Location } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function TableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tableName, setTableName] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableScenes>(`/game-table-scenes/${id}`).then((scenes) => {
      setTableName(scenes?.table?.title ?? "");
      const locs: Location[] = [];
      const seen = new Set<string>();
      for (const scene of scenes?.scenes ?? []) {
        for (const n of scene.narrations ?? []) {
          const loc = n.location;
          if (loc && loc.name && !seen.has(loc.name)) {
            seen.add(loc.name);
            locs.push(loc);
          }
        }
      }
      setLocations(locs);
    }).catch(() => setLocations([]));
  }, [id]);

  const filtered = locations.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.name ?? "").toLowerCase().includes(q)
      || (l.region ?? "").toLowerCase().includes(q)
      || (l.address ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">Locations</h1>
        <span className="text-sm text-zinc-500">{tableName}</span>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-zinc-500">
        <span>{filtered.length} location{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter locations..."
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-700/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            Clear
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? "No locations match your filter." : "No locations discovered yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l: Location) => (
            <Link
              key={l.id}
              href={`/location/${l.id}`}
              className="group block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-teal-400/70 px-4 py-3 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-4 h-4 shrink-0 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">
                    {l.name || "Unnamed"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {l.isIndoor != null ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${l.isIndoor ? "bg-amber-400/10 text-amber-400" : "bg-sky-400/10 text-sky-400"}`}>
                      {l.isIndoor ? "Indoor" : "Outdoor"}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 ml-7">
                {l.region ? (
                  <span className="text-[11px] text-zinc-500">
                    {l.region}{l.subRegion ? ` / ${l.subRegion}` : ""}
                  </span>
                ) : null}
                {l.address ? (
                  <span className="text-[11px] text-zinc-600 truncate">— {l.address}</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
