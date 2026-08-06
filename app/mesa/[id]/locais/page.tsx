import { api } from "@/lib/api";
import type { GameTableScenes, Location } from "@/lib/types";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function TableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenes = await api<GameTableScenes>(`/game-table-scenes/${id}`);

  const locations: Location[] = [];
  const seen = new Set<string>();
  for (const scene of scenes?.scenes ?? []) {
    for (const n of scene.narrations ?? []) {
      const loc = n.location;
      if (loc && loc.name && !seen.has(loc.name)) {
        seen.add(loc.name);
        locations.push(loc);
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />
      <h1 className="text-2xl font-bold text-amber-100 mb-6">
        {scenes.table?.title || "Table"} — Locations
      </h1>

      {locations.length === 0 ? (
        <p className="text-zinc-500 italic">No locations registered for this table.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((l: Location) => (
            <div key={l.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className="w-4 h-4 text-blue-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-zinc-200 font-medium">{l.name || "Unnamed"}</span>
              </div>
              {l.region ? (
                <p className="text-xs text-zinc-500 ml-6">
                  {l.region}
                  {l.subRegion ? ", " + l.subRegion : ""}
                </p>
              ) : null}
              {l.address ? <p className="text-xs text-zinc-500 ml-6">{l.address}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
