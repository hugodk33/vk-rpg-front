import { api } from "@/lib/api";
import type { GameTableItems, Item } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function PlayerTableItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, characterUrl] = await Promise.all([
    api<GameTableItems>(`/game-table-items/${id}`),
    getPlayerCharacterUrl(id),
  ]);
  const items = data.items ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-6">
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
                {i.weight_lb != null ? <span className="text-zinc-500 text-xs">{i.weight_lb} lb</span> : null}
              </div>
              {i.category || i.quality || i.condition ? (
                <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 mb-1">
                  {i.category ? <span>{i.category}</span> : null}
                  {i.quality ? <span>{i.quality}</span> : null}
                  {i.condition ? <span>{i.condition}</span> : null}
                </div>
              ) : null}
              {i.description ? <p className="text-zinc-500 text-xs">{i.description}</p> : null}
              {i.weapon?.attacks?.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 bg-red-900/40 border border-red-700/50 text-red-300 px-2 py-0.5 rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243-4.243z" />
                    </svg>
                    {i.weapon.attacks.length} ataque{i.weapon.attacks.length !== 1 ? "s" : ""}
                  </span>
                  {i.weapon.reach ? <span className="text-zinc-500">Reach {i.weapon.reach}</span> : null}
                </div>
              ) : null}
              {i.armor ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 bg-cyan-900/40 border border-cyan-700/50 text-cyan-300 px-2 py-0.5 rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    DR {i.armor.dr ?? "—"}
                  </span>
                  {i.armor.locations ? <span className="text-zinc-500">{i.armor.locations}</span> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
