import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import NpcForm from "@/components/forms/NpcForm";

export const dynamic = "force-dynamic";

export default async function NewNpcPage({
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

  return <NpcForm tableId={table_id} tables={tables} />;
}
