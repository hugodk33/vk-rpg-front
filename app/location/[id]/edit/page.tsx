import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import LocationForm from "@/components/forms/LocationForm";
import MapStudio from "@/components/location/MapStudio";
import type { GameTableLocations, Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <LocationForm initial={location} tableId={location.tableId} allLocations={all?.locations ?? []} />
      <div>
        <div className="mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            Plate layer — terrain tiles · SVG strokes · grid seam
          </span>
        </div>
        <MapStudio location={location} />
      </div>
    </div>
  );
}