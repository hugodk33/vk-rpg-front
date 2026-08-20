import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { GameTableCharacters, Item } from "@/lib/types";
import ItemForm from "@/components/forms/ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let item: Item | undefined;
  try {
    item = await api<Item>(`/game-table-item/${id}`);
  } catch {
    item = undefined;
  }
  if (!item) notFound();

  let characters: Array<{ id: string; name: string }> = [];
  if (item.table_id) {
    try {
      const chars = await api<GameTableCharacters>(`/game-table-characters/${item.table_id}`);
      characters = (chars.characters ?? [])
        .filter((c) => c.name)
        .map((c) => ({ id: c.id, name: c.name! }));
    } catch {
      characters = [];
    }
  }

  return <ItemForm initial={item} tableId={item.table_id} characters={characters} />;
}
