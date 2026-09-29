import { api } from "@/lib/api";
import type { GameTable, TableSettings } from "@/lib/types";
import CharacterForm from "@/components/forms/CharacterForm";

export const dynamic = "force-dynamic";

export default async function NewCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ table_id?: string }>;
}) {
  const { table_id } = await searchParams;

  const [tables, settings] = await Promise.all([
    api<GameTable[]>("/game-tables")
      .then((all) => all.map((t) => ({ id: t.id, title: t.title })))
      .catch(() => [] as Array<{ id: string; title: string }>),
    table_id
      ? api<TableSettings>(`/game-table-settings/${table_id}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  return <CharacterForm tableId={table_id} tables={tables} settings={settings} />;
}
