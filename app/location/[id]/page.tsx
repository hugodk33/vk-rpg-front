import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationPlate from "@/components/location/LocationPlate";
import type { Location } from "@/lib/types";

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

  return <LocationPlate location={location} tableId={location.tableId} />;
}