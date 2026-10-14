import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationTabs from "@/components/location/LocationTabs";
import type { GameTableLocations, Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* O `actor` é obrigatório nas leituras de location: sem ele o backend
     recusa (401) em vez de devolver o local. A mesa do local vem primeiro
     para sabermos de quem é o `actor`. */
  const tableId = await getLocationTableId(id);
  const { query: actorQs } = tableId ? await getNarratorSideView(tableId) : { query: "" };

  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}${actorQs}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  /* As passagens + o catálogo alimentam o organograma da localidade. */
  let all: GameTableLocations | null = null;
  const ownerTable = location.tableId ?? tableId;
  if (ownerTable) {
    try {
      all = await api<GameTableLocations>(`/game-table-locations/${ownerTable}${actorQs}`);
    } catch {
      all = null;
    }
  }

  return (
    <>
      {location.images?.length ? (
        <div className="max-w-5xl mx-auto px-6 pt-6 flex flex-wrap gap-3">
          {location.images.map((url, i) => (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block h-28 w-28 overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900"
            >
              <img src={url} alt={`${location.name} ${i + 1}`} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      <LocationTabs
        location={location}
        locations={all?.locations ?? []}
        connections={all?.connections ?? []}
        tableId={location.tableId}
      />
    </>
  );
}