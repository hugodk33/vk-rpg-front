import { api } from "@/lib/api";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function PlayerTableAdvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, characterUrl] = await Promise.all([
    api<GameTableAdvantages>(`/game-table-advantages/${id}`),
    getPlayerCharacterUrl(id),
  ]);
  const advantages = data.advantages ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-amber-100 mb-6">
        {data.table?.title || "Table"} — Advantages
      </h1>

      {advantages.length === 0 ? (
        <p className="text-zinc-500 italic">No advantages registered for this table.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advantages.map((a: Advantage) => (
            <div key={a.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{a.name || "Unnamed"}</span>
                <span className="text-emerald-400 text-xs font-semibold">{a.cost_points ?? ""}</span>
              </div>
              {a.category ? (
                <span className="text-xs text-zinc-500">
                  {a.category}
                  {a.subcategory ? ` / ${a.subcategory}` : ""}
                </span>
              ) : null}
              {a.description ? <p className="text-zinc-500 text-xs mt-1">{a.description}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
