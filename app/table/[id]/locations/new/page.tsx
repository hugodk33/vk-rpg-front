import { api } from "@/lib/api";
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

  let all: GameTableLocations | null = null;
  try {
    all = await api<GameTableLocations>(`/game-table-locations/${id}`);
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