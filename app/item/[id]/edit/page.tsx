import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { GameTableItems, Item } from "@/lib/types";
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

  /* O detalhe do item não traz a mesa; buscamos a lista da mesa apenas para
     obter `table.title` usado no breadcrumb do shell. */
  let tableTitle: string | undefined;
  if (item.table_id) {
    try {
      const data = await api<GameTableItems>(`/game-table-items/${item.table_id}`);
      tableTitle = data.table?.title;
    } catch {
      tableTitle = undefined;
    }
  }

  return <ItemForm initial={item} tableId={item.table_id} tableTitle={tableTitle} />;
}
