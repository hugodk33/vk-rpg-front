import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import ItemForm from "@/components/forms/ItemForm";

export const dynamic = "force-dynamic";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ table_id?: string; table?: string; location?: string }>;
}) {
  const sp = await searchParams;
  const tableId = sp.table_id ?? sp.table;

  let tables: Array<{ id: string; title: string }> = [];
  try {
    const all = await api<GameTable[]>("/game-tables");
    tables = all.map((t) => ({ id: t.id, title: t.title }));
  } catch {
    tables = [];
  }

  return <ItemForm tableId={tableId} tables={tables} defaultLocationId={sp.location} />;
}
