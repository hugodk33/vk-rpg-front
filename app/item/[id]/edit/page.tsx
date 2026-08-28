import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
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

  return <ItemForm initial={item} tableId={item.table_id} />;
}
