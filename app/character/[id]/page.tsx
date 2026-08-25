import Link from "next/link";
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
  const data = await api<CharacterViewer>(`/game-table-character/${id}${qs}`);
  const basePath = `/character/${id}`;
  const tableId = data.table?.id;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <>
          <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
            &larr; Back to table
          </Link>
          <TableTabs tableId={tableId} active="character" characterHref={basePath} hideBreadcrumb />
        </>
      ) : null}
      <CharacterSheet data={data} basePath={basePath} />
    </div>
  );
}
