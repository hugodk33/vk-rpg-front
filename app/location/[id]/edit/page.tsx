import { notFound } from "next/navigation";
import { api } from "@/lib/api";
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

  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  let all: GameTableLocations | null = null;
  if (location.tableId) {
    try {
      all = await api<GameTableLocations>(`/game-table-locations/${location.tableId}`);
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