import { api } from "@/lib/api";
import type { GameTable, GameTableCharacters } from "@/lib/types";
import ItemForm from "@/components/forms/ItemForm";

export const dynamic = "force-dynamic";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ table_id?: string }>;
}) {
  const { table_id } = await searchParams;

  let tables: Array<{ id: string; title: string }> = [];
  try {
    const all = await api<GameTable[]>("/game-tables");
    tables = all.map((t) => ({ id: t.id, title: t.title }));
  } catch {
    tables = [];
  }

  let characters: Array<{ id: string; name: string }> = [];
  if (table_id) {
    try {
      const chars = await api<GameTableCharacters>(`/game-table-characters/${table_id}`);
      characters = (chars.characters ?? [])
        .filter((c) => c.name)
        .map((c) => ({ id: c.id, name: c.name! }));
    } catch {
      characters = [];
    }
  }

  return <ItemForm tableId={table_id} tables={tables} characters={characters} />;
}
