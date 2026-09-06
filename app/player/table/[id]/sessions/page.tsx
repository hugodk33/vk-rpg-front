import { api } from "@/lib/api";
import type { GameTableCharacters, GameTableNpcs, GameTableScenes, QueueEntry } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { getSessionState } from "@/lib/session";
import TableTabs from "@/components/TableTabs";
import SessionClient from "@/components/session/SessionClient";

export const dynamic = "force-dynamic";

export default async function PlayerTableSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const characterUrl = await getPlayerCharacterUrl(id);
  const viewerId = characterUrl?.split("/").pop() ?? "";
  const [scenesData, charsData, npcsData, queue] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    api<GameTableCharacters>(`/game-table-characters/${id}${viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : ""}`),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
    api<QueueEntry[]>(`/game-table-queue/${id}`).catch(() => []),
  ]);

  const state = getSessionState(scenesData.scenes);
  const characters = charsData?.characters ?? [];
  const npcIds = (npcsData?.npcs ?? []).map((n) => n.character_id).filter(Boolean) as string[];

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 pb-0">
        <TableTabs tableId={id} role="player" active="sessions" characterUrl={characterUrl} />
        <h1 className="text-2xl font-bold text-blue-100 mt-3 mb-4">
          {scenesData.table?.title || "Session"}
        </h1>
        <SessionClient
          tableId={id}
          role="player"
          chapter={state.chapter}
          part={state.part}
          latestTitle={state.latestTitle}
          latestNarration={state.latestNarration}
          latestSceneId={state.latestSceneId}
          latestMoment={state.latestMoment}
          characters={characters}
          actions={state.actions}
          queue={queue}
          npcIds={npcIds}
        />
      </div>
    </>
  );
}
