import { api } from "@/lib/api";
import { getNarratorSideView } from "@/lib/actor";
import LocationForm from "@/components/forms/LocationForm";
import type { GameTableLocations } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parent_id?: string; kind?: string }>;
}) {
  const { id } = await params;
  const { parent_id, kind } = await searchParams;



  const { query: actorQs } = await getNarratorSideView(id);

  let all: GameTableLocations | null = null;
  try {
    all = await api<GameTableLocations>(`/game-table-locations/${id}${actorQs}`);
  } catch {
    all = null;
  }

  return (
    <LocationForm
      tableId={id}
      allLocations={all?.locations ?? []}
      defaultParentId={parent_id}
      defaultKind={kind}
    />
  );
}