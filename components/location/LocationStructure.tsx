"use client";

/* ============================================================
   LocationStructure — a tela da Estrutura: o organograma das
   passagens e o formulário que as edita, juntos. Ao salvar/remover
   uma passagem, o organograma é recarregado com os dados da mesa,
   então a árvore reflete a mudança na hora.
   ============================================================ */

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import LocationOrganogram from "@/components/location/LocationOrganogram";
import LocationLinks from "@/components/location/LocationLinks";
import type { GameTableLocations, Location, LocationConnection } from "@/lib/types";

export default function LocationStructure({
  root,
  locations,
  connections,
  tableId,
  actorQuery = "",
}: {
  root: Location;
  locations: Location[];
  connections: LocationConnection[];
  tableId?: string;
  actorQuery?: string;
}) {
  const [locs, setLocs] = useState<Location[]>(locations);
  const [conns, setConns] = useState<LocationConnection[]>(connections);

  /* Passagens só fazem sentido na escala local: cidade (1 km/hex) para
     baixo. Em mundo/continente/nação o form fica escondido. */
  const sizeM = root.hex?.sizeM;
  const canLink = sizeM != null && sizeM <= 1000;

  const refresh = useCallback(() => {
    if (!tableId) return;
    api<GameTableLocations>(`/game-table-locations/${tableId}${actorQuery}`)
      .then((d) => {
        setLocs(d?.locations ?? []);
        setConns(d?.connections ?? []);
      })
      .catch(() => {});
  }, [tableId, actorQuery]);

  if (!canLink) {
    return (
      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 p-3 shadow-2xl sm:p-6 overflow-auto">
        <LocationOrganogram root={root} locations={locs} connections={conns} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 p-3 shadow-2xl sm:p-6 overflow-auto">
        <LocationOrganogram root={root} locations={locs} connections={conns} />
      </div>
      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 p-4 shadow-2xl sm:p-6">
        <LocationLinks location={root} allLocations={locs} onChanged={refresh} />
      </div>
    </div>
  );
}
