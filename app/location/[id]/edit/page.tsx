import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationEditor from "@/components/location/LocationEditor";
import type { GameTableLocations, Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const defaultTab = sp.tab === "map" ? "map" : sp.tab === "links" ? "links" : "form";

  /* O `actor` é obrigatório nas leituras de location: sem ele o backend
     recusa (401) em vez de devolver o catálogo inteiro. A mesa do local vem
     primeiro para sabermos de quem é o `actor`. */
  const locationTableId = await getLocationTableId(id);
  const { query: actorQs } = locationTableId ? await getNarratorSideView(locationTableId) : { query: "" };

  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}${actorQs}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  let all: GameTableLocations | null = null;
  if (location.tableId) {
    try {
      all = await api<GameTableLocations>(`/game-table-locations/${location.tableId}${actorQs}`);
    } catch {
      all = null;
    }
  }

  return (
    <LocationEditor
      location={location}
      tableId={location.tableId}
      allLocations={all?.locations ?? []}
      defaultTab={defaultTab}
    />
  );
}