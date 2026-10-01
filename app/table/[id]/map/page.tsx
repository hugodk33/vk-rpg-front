import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import { getNarratorSideView } from "@/lib/actor";
import type { GameTableCharacters, GameTableLocations, GameTableNpcs, GameTableScenes } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import MapLog from "@/components/map/MapLog";

export const dynamic = "force-dynamic";

export default async function TableMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = makeT(await getLang());

  /* Ações do narrador (zoom, copiar local, editar) não fazem sentido para quem
     está na perspectiva de jogador. Mandamos esse player para o próprio
     console em vez de renderizar o mapa do GM.

     Só redireciona na perspectiva de JOGADOR: com o chapéu de narrador
     escolhido, o dono da mesa tem que conseguir olhar o mapa mesmo com um
     assento de jogador salvo no navegador. */
  const { query: actorQs, playerCharacterId } = await getNarratorSideView(id);
  if (playerCharacterId) redirect(`/player/character/${playerCharacterId}`);

  const [scenesData, charsData, npcsData, locationsData] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
    api<GameTableLocations>(`/game-table-locations/${id}${actorQs}`).catch(() => ({
      table: null,
      locations: [],
      connections: [],
      tree: [],
      defaultLocationId: null,
    })),
  ]);

  const characters = charsData?.characters ?? [];
  const npcIds = (npcsData?.npcs ?? []).map((n) => n.character_id).filter(Boolean) as string[];
  const locations = locationsData?.locations ?? [];

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-0">
        <TableTabs tableId={id} active="map" />
        <h1 className="text-2xl font-bold text-green-100 mt-3">
          {scenesData.table?.title || t("nav.map")}
        </h1>
      </div>
      <MapLog scenes={scenesData.scenes} locations={locations} connections={locationsData?.connections ?? []} characters={characters} npcIds={npcIds} role="narrator" tableId={id} defaultLocationId={locationsData?.defaultLocationId ?? null} />
    </>
  );
}
