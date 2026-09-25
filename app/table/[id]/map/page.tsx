import { api } from "@/lib/api";
import type { GameTableCharacters, GameTableLocations, GameTableNpcs, GameTableScenes } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import MapLog from "@/components/map/MapLog";

export const dynamic = "force-dynamic";

export default async function TableMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scenesData, charsData, npcsData, locationsData] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
    api<GameTableLocations>(`/game-table-locations/${id}`).catch(() => ({ table: null, locations: [] })),
  ]);

  const characters = charsData?.characters ?? [];
  const npcIds = (npcsData?.npcs ?? []).map((n) => n.character_id).filter(Boolean) as string[];
  const locations = locationsData?.locations ?? [];

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-0">
        <TableTabs tableId={id} active="map" />
        <h1 className="text-2xl font-bold text-green-100 mt-3">
          {scenesData.table?.title || "Mapa"}
        </h1>
      </div>
      <MapLog scenes={scenesData.scenes} locations={locations} characters={characters} npcIds={npcIds} role="narrator" fillViewport tableId={id} />
    </>
  );
}