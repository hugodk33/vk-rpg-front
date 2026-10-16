import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationTabs from "@/components/location/LocationTabs";
import LocationGallery from "@/components/gallery/LocationGallery";
import type { GameTableLocations, Location } from "@/lib/types";

export const dynamic = "force-dynamic";

/*
  Versão do jogador da rota /location/[id]: as abas ficam read-only
  (LocationTabs com mode="player"). A galeria de fotos, não: o jogador
  abre as imagens no modal e pode substituir/apagar/adicionar as suas,
  pelo mesmo PUT curto de imagens que o narrador usa. A leitura usa o
  `actor` da perspectiva atual, então o backend já devolve só o que o
  personagem conhece (nomes mascarados / detalhes em branco).
*/
export default async function PlayerLocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tableId = await getLocationTableId(id);
  const { query: actorQs } = tableId ? await getNarratorSideView(tableId) : { query: "" };

  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}${actorQs}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

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
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <LocationGallery locationId={id} name={location.name} images={location.images ?? []} />
      </div>
      <LocationTabs
        location={location}
        locations={all?.locations ?? []}
        connections={all?.connections ?? []}
        tableId={location.tableId}
        mode="player"
      />
    </>
  );
}
