import { api } from "@/lib/api";
import type { GameTableCharacters, GameTableLocations, GameTableNpcs, GameTableScenes, QueueEntry } from "@/lib/types";
import { getSessionState } from "@/lib/session";
import TableTabs from "@/components/TableTabs";
import SessionClient from "@/components/session/SessionClient";

export const dynamic = "force-dynamic";

export default async function TableSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scenesData, charsData, npcsData, queue, locationsData] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
    api<QueueEntry[]>(`/game-table-queue/${id}`).catch(() => []),
    api<GameTableLocations>(`/game-table-locations/${id}`).catch(() => ({ table: null, locations: [] })),
  ]);

  const state = getSessionState(scenesData.scenes);
  const characters = charsData?.characters ?? [];
  const npcIds = (npcsData?.npcs ?? []).map((n) => n.character_id).filter(Boolean) as string[];
  const locations = locationsData?.locations ?? [];

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 pb-0">
        <TableTabs tableId={id} active="sessions" />
        <h1 className="text-2xl font-bold text-green-100 mt-3 mb-4">
          {scenesData.table?.title || "Session"}
        </h1>
        <SessionClient
          tableId={id}
          chapter={state.chapter}
          part={state.part}
          latestTitle={state.latestTitle}
          latestNarration={state.latestNarration}
          latestNarrationId={state.latestNarrationId}
          latestBeat={state.latestBeat}
          latestSceneId={state.latestSceneId}
          latestMoment={state.latestMoment}
          characters={characters}
          actions={state.actions}
          queue={queue}
          npcIds={npcIds}
          locations={locations}
        />
      </div>
    </>
  );
}
