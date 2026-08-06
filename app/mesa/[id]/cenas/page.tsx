import { api } from "@/lib/api";
import type { GameTableScenes } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import SceneTimeline from "@/components/scenes/SceneTimeline";

export const dynamic = "force-dynamic";

export default async function TableScenesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await api<GameTableScenes>(`/game-table-scenes/${id}`);

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 pb-0">
        <TableTabs tableId={id} active="timeline" />
      </div>
      <SceneTimeline table={data.table} scenes={data.scenes ?? []} />
    </>
  );
}
