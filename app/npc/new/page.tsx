import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import NpcForm from "@/components/forms/NpcForm";

export const dynamic = "force-dynamic";

export default async function NewNpcPage({
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

  return <NpcForm tableId={tableId} tables={tables} defaultLocationId={sp.location} />;
}
