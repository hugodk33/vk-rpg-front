import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTableItems, Item } from "@/lib/types";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function TableItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await api<GameTableItems>(`/game-table-items/${id}`);
  const items = data.items ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />
      <h1 className="text-2xl font-bold text-amber-100 mb-6">
        {data.table?.title || "Table"} — Items
      </h1>

      {items.length === 0 ? (
        <p className="text-zinc-500 italic">No items registered for this table.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((i: Item) => (
            <div key={i.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{i.name || "Unnamed"}</span>
                {i.weight ? <span className="text-zinc-500 text-xs">{i.weight} kg</span> : null}
              </div>
              {i.category || i.quality || i.condition ? (
                <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 mb-1">
                  {i.category ? <span>{i.category}</span> : null}
                  {i.quality ? <span>{i.quality}</span> : null}
                  {i.condition ? <span>{i.condition}</span> : null}
                </div>
              ) : null}
              {i.description ? <p className="text-zinc-500 text-xs">{i.description}</p> : null}
              <div className="mt-2 flex gap-2">
                <Link href={`/item/${i.id}/edit`} className="text-xs text-amber-400 hover:text-amber-300">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
