import { api } from "@/lib/api";
import { getNarratorSideView } from "@/lib/actor";
import type { GameTableLocations } from "@/lib/types";
import LocationsAtlas from "@/components/location/LocationsAtlas";

export const dynamic = "force-dynamic";

/* ============================================================
   Survey Atlas — server side of the location list.
   The `?actor=` is resolved HERE from the narrator relation, like
   the other narrator tabs (map, sessions, modifiers), instead of
   trusting the browser's seat cookie — a stale saved player seat
   used to make this single client page request locations with an
   actor the backend could not resolve (404).
   ============================================================ */

export default async function TableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { query: actorQs } = await getNarratorSideView(id);
  const data = await api<GameTableLocations>(`/game-table-locations/${id}${actorQs}`).catch(() => null);
  return <LocationsAtlas key={id} tableId={id} data={data} />;
}