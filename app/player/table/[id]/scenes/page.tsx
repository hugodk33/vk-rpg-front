import { api } from "@/lib/api";
import type { GameTableScenes } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import SceneTimeline from "@/components/scenes/SceneTimeline";

export const dynamic = "force-dynamic";

export default async function PlayerTableScenesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ character?: string; user?: string }>;
}) {
  const { id } = await params;
  const { character, user } = await searchParams;
  const [data, characterUrl] = await Promise.all([
    api<GameTableScenes>(`/game-table-scenes/${id}`),
    getPlayerCharacterUrl(id, { characterId: character, userId: user }),
  ]);

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 pb-0">
        <TableTabs tableId={id} role="player" active="timeline" characterUrl={characterUrl} />
      </div>
      <SceneTimeline table={data.table} scenes={data.scenes ?? []} showEditButtons={false} role="player" />
    </>
  );
}
