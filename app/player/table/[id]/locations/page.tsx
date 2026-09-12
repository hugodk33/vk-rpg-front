"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameTableLocations, Location } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { readSeat } from "@/lib/seat";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

const KIND_LABELS: Record<string, string> = {
  world: "World",
  continent: "Continent",
  nation: "Nation",
  region: "Region",
  biome: "Biome",
  province: "Province",
  city: "City",
  district: "District",
  locale: "Locale",
  site: "Site",
  battlemap: "Battle Map",
  point: "Point",
};

function formatScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km/hex`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m/hex`;
}

interface IndexNode {
  node: Location;
  chain: Location[];
}

function indexTree(roots: Location[]): Map<string, IndexNode> {
  const map = new Map<string, IndexNode>();
  const walk = (node: Location, trail: Location[]) => {
    const chain = [...trail, node];
    map.set(node.id, { node, chain });
    for (const child of node.children ?? []) walk(child, chain);
  };
  for (const root of roots) walk(root, []);
  return map;
}

function PlayerLocCard({ loc, childCount }: { loc: Location; childCount: number }) {
  const router = useRouter();
  const hasChildren = childCount > 0;
  return (
    <div className="group relative flex h-full flex-col rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-4 py-3 transition-all hover:border-blue-700/50 hover:bg-zinc-800">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-zinc-200 font-medium group-hover:text-blue-100 truncate">{loc.name || "Unnamed"}</span>
      </div>
      {loc.region ? <p className="text-xs text-zinc-500 ml-6">{loc.region}{loc.subRegion ? ", " + loc.subRegion : ""}</p> : null}
      {loc.address ? <p className="text-xs text-zinc-500 ml-6">{loc.address}</p> : null}

      <div className="mt-3 flex items-center gap-2 border-t border-zinc-700/40 pt-2.5 mt-auto">
        <button
          type="button"
          onClick={() => router.push(`/player/location/${loc.id}`)}
          disabled={!hasChildren}
          title={hasChildren ? `Abrir ${childCount} subdivisões` : "Este local não contém subdivisões"}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-blue-700/40 bg-blue-400/5 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-blue-300/90 transition-colors hover:bg-blue-400/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-400/5 disabled:hover:text-blue-300/90"
        >
          ◱ Sublocations
        </button>
        <Link
          href={`/player/location/${loc.id}`}
          title={`Abrir ${loc.name || "location"} em página própria`}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}

export default function PlayerTableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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

  const index = useMemo(() => indexTree(data?.tree ?? []), [data]);
  const childCountOf = (locId: string) => index.get(locId)?.node.children?.length ?? 0;

  const defaultLocId = data?.defaultLocationId ?? null;
  const perspective = defaultLocId ? index.get(defaultLocId) : undefined;
  const perspectiveChildren = perspective?.node.children ?? [];

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

      {!search && perspective ? (
        <div className="mb-8 rounded-xl border border-blue-400/25 bg-blue-400/[0.05] p-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-300 shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Mapa padrão — sua perspectiva</span>
            <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.35), transparent)" }} />
          </div>

          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <Link href={`/player/location/${perspective.node.id}`} className="text-xl font-bold text-blue-100 hover:underline">
              {perspective.node.name || "Unnamed"}
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
              {KIND_LABELS[perspective.node.kind ?? "site"] ?? perspective.node.kind ?? "Location"} · {formatScale(perspective.node.hex?.sizeM)}
            </span>
          </div>

          {perspective.chain.length > 1 ? (
            <div className="mt-2 flex items-center flex-wrap gap-1.5 font-mono text-[10px] tracking-widest uppercase">
              {perspective.chain.map((loc, i) => {
                const isSelf = i === perspective!.chain.length - 1;
                return (
                  <span key={loc.id} className="flex items-center gap-1.5">
                    {isSelf ? (
                      <span className="text-blue-200">{loc.name || "Unnamed"}</span>
                    ) : (
                      <>
                        <Link href={`/player/location/${loc.id}`} className="text-zinc-500 hover:text-blue-300 transition-colors">
                          {loc.name || "Unnamed"}
                        </Link>
                        <span className="text-zinc-700" aria-hidden>›</span>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          ) : null}

          <p className="mt-3 text-xs text-zinc-500 italic">
            Esta é a divisão onde você está agora — veja abaixo o que existe dentro dela. Pesquise acima para navegar por outras locations conhecidas.
          </p>

          {perspectiveChildren.length > 0 ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-400 mb-2">
                Divisions of {perspective.node.name || "this location"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perspectiveChildren.map((child) => (
                  <PlayerLocCard key={child.id} loc={child} childCount={childCountOf(child.id)} />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-600 italic">Esta divisão é o ponto mais profundo que você conhece aqui.</p>
          )}
        </div>
      ) : null}

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-mono text-[11px] tracking-widest uppercase text-zinc-500">All locations</h2>
        <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-600">{locations.length}</span>
      </div>

      {locations.length === 0 ? (
        <p className="text-zinc-500 italic">No locations found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((l: Location) => (
            <PlayerLocCard key={l.id} loc={l} childCount={childCountOf(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}