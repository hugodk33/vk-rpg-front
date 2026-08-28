import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
import ItemExhibit from "@/components/item/ItemExhibit";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: Item | undefined;
  try {
    item = await api<Item>(`/game-table-item/${id}`);
  } catch {
    item = undefined;
  }
  if (!item) notFound();

  return <ItemExhibit item={item} tableId={item.table_id} />;
}
