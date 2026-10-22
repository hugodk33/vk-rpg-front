import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getNarratorSideView } from "@/lib/actor";
import type { GameTable } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import TableTrades from "@/components/table/TableTrades";

export const dynamic = "force-dynamic";

export default async function TableTradesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await getNarratorSideView(id);
  const table = await api<GameTable>(`/game-table/${id}`).catch(() => null);
  if (!table) notFound();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" />
      {actor ? (
        <TableTrades tableId={id} actorId={actor} />
      ) : (
        <p className="text-sm text-red-400">Narrator actor not found.</p>
      )}
    </div>
  );
}
