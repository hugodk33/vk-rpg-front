"use client";

/* ============================================================
   Player location detail — the Survey Plate, from the field.
   Resolves the seat's player character for the location's table,
   then fetches this place THROUGH that character's eyes
   (?viewer=…), so the shape helper masks/marks anything not yet
   revealed by the narrator. A place the observer may not know
   resolves to a neutral "unrevealed" panel instead of its plate.
   ============================================================ */

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Location } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { readSeat } from "@/lib/seat";
import { api } from "@/lib/api";
import TableTabs from "@/components/TableTabs";
import LocationPlate from "@/components/location/LocationPlate";

interface PlateLocation extends Location {
  table_id?: string;
  table_title?: string;
}

type PlateState =
  | { status: "loading" }
  | { status: "unrevealed" }
  | { status: "ready"; data: PlateLocation; tableId: string };

export default function PlayerLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const seat = readSeat();
  const seatUserId = searchParams.get("user") ?? seat.userId;
  const seatCharId = searchParams.get("character") ?? seat.characterId;

  const [state, setState] = useState<PlateState>({ status: "loading" });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (loadedId === id) return;
    let cancelled = false;

    const resolve = async () => {
      try {
        // Step 1 — the table id isn't in the route; read it from the
        // location itself. This probe is never rendered: the plate only
        // renders after the viewer-shaped fetch (step 3).
        const probe = await api<PlateLocation | null>(`/table-location/${id}`);
        if (cancelled) return;
        if (!probe?.table_id) {
          setState({ status: "unrevealed" });
          setLoadedId(id);
          return;
        }
        const tableId = probe.table_id;

        // Step 2 — which player character represents me here?
        const url = await getPlayerCharacterUrl(tableId, {
          userId: seatUserId,
          characterId: seatCharId,
        });
        if (cancelled) return;
        setCharacterUrl(url);

        // Step 3 — fetch this place through that character's eyes.
        const viewerId = url?.split("/").pop() ?? "";
        const q = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
        const data = await api<PlateLocation | null>(`/table-location/${id}${q}`);
        if (cancelled) return;
        if (!data) {
          setState({ status: "unrevealed" });
        } else {
          setState({ status: "ready", data, tableId });
        }
        setLoadedId(id);
      } catch {
        if (!cancelled) {
          setState({ status: "unrevealed" });
          setLoadedId(id);
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [id, seatUserId, seatCharId, loadedId]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs
        tableId={state.status === "ready" ? state.tableId : ""}
        role="player"
        characterUrl={characterUrl}
      />

      {state.status === "unrevealed" ? (
        <div className="mt-16 text-center">
          <p className="font-mono text-[11px] tracking-widest uppercase text-zinc-600">Survey • restricted</p>
          <h1 className="text-3xl font-bold text-zinc-500 mt-2">This place is not on your map</h1>
          <p className="text-sm text-zinc-600 mt-3 max-w-md mx-auto leading-relaxed">
            You have not yet discovered (or been told of) this location. When the narrator
            reveals it to your character, it will appear in your locations here.
          </p>
        </div>
      ) : state.status === "ready" ? (
        <LocationPlate location={state.data} tableId={state.tableId} mode="player" />
      ) : (
        <div className="mt-16 flex justify-center">
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-600 animate-pulse">
            surveying…
          </span>
        </div>
      )}
    </div>
  );
}