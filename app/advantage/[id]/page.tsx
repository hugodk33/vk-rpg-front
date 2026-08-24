import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Advantage, GameTableAdvantages } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdvantageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let advantage: Advantage | undefined;
  let tableId: string | undefined;
  try {
    const raw = await api<Advantage>(`/game-table-advantage/${id}`);
    advantage = raw;
    if (raw.table_id) tableId = raw.table_id;
  } catch {
    advantage = undefined;
  }
  if (!advantage) notFound();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-100">{advantage.name || "Unnamed Advantage"}</h1>
              {advantage.category ? (
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {advantage.category}{advantage.subcategory ? ` / ${advantage.subcategory}` : ""}
                </span>
              ) : null}
            </div>
            <span className="text-emerald-400 font-bold text-lg">
              {advantage.cost_points != null ? (advantage.cost_points >= 0 ? "+" : "") + advantage.cost_points : "±0"}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {advantage.description ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
              <p className="text-zinc-300 text-sm">{advantage.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
              <span className="text-zinc-500 text-xs uppercase block">Cost</span>
              <span className="text-emerald-400 font-bold text-xl">
                {advantage.cost_points != null ? (advantage.cost_points >= 0 ? "+" : "") + advantage.cost_points : "±0"}
              </span>
            </div>
            {advantage.category ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Category</span>
                <span className="text-zinc-200 font-medium text-sm">{advantage.category}</span>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/advantage/${advantage.id}/edit`} className="bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Edit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
