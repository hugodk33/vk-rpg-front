import { api } from "@/lib/api";
import type { GameTableCharacters, GameTableScenes } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import { getSessionState } from "@/lib/session";
import TableTabs from "@/components/TableTabs";
import SessionClient from "@/components/session/SessionClient";

export const dynamic = "force-dynamic";

export default async function PlayerTableSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scenesData, charsData, characterUrl] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    getPlayerCharacterUrl(id),
  ]);

  const state = getSessionState(scenesData.scenes);
  const characters = charsData?.characters ?? [];

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 pb-0">
        <TableTabs tableId={id} role="player" active="act" characterUrl={characterUrl} />
        <h1 className="text-2xl font-bold text-amber-100 mt-3 mb-4">
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
        />
      </div>
    </>
  );
}
