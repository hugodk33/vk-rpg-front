import { api } from "@/lib/api";
import type { CharacterViewer } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import CharacterSheet from "@/components/character/CharacterSheet";

export const dynamic = "force-dynamic";

export default async function CharacterViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ moment?: string }>;
}) {
  const { id } = await params;
  const { moment } = await searchParams;
  const qs = moment ? `?moment=${moment}` : "";
  const data = await api<CharacterViewer>(`/game-table-character-viewer/${id}${qs}`);
  const basePath = `/personagem/${id}`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {data.table?.id ? (
        <TableTabs tableId={data.table.id} active="character" characterHref={basePath} />
      ) : null}
      <CharacterSheet data={data} basePath={basePath} />
    </div>
  );
}
