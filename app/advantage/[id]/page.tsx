import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Advantage } from "@/lib/types";

export const dynamic = "force-dynamic";

const getAdvantage = cache(async (id: string): Promise<Advantage | undefined> => {
  try {
    return await api<Advantage>(`/game-table-advantage/${id}`);
  } catch {
    return undefined;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const advantage = await getAdvantage(id);
  return { title: `${advantage?.name || "Advantage"} — VKRPG` };
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; ring: string; svg: string }> = {
  Physical: {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    ring: "ring-amber-400/20",
    svg: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11",
  },
  Mental: {
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    ring: "ring-violet-400/20",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  Social: {
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    ring: "ring-teal-400/20",
    svg: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
};

function formatCost(cost: number): string {
  return cost >= 0 ? `+${cost}` : `${cost}`;
}

export default async function AdvantageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const advantage = await getAdvantage(id);
  if (!advantage) notFound();

  const tableId = advantage.table_id;
  const typeConfig = advantage.category ? TYPE_CONFIG[advantage.category] ?? null : null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {typeConfig ? (
                <div className={`shrink-0 w-11 h-11 rounded-lg ${typeConfig.bg} ring-1 ${typeConfig.ring} flex items-center justify-center`}>
                  <svg className={`w-5.5 h-5.5 ${typeConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={typeConfig.svg} />
                  </svg>
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-amber-100 leading-tight">{advantage.name || "Unnamed Advantage"}</h1>
                {advantage.category || advantage.subcategory ? (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {advantage.category ? (
                      <span className={`text-xs font-medium ${typeConfig ? typeConfig.color : "text-zinc-400"}`}>
                        {advantage.category}
                      </span>
                    ) : null}
                    {advantage.category && advantage.subcategory ? <span className="text-zinc-600">·</span> : null}
                    {advantage.subcategory ? (
                      <span className="text-xs text-zinc-500">{advantage.subcategory}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <span className="block text-xs uppercase tracking-wider text-zinc-500">Cost</span>
              <span className="text-emerald-400 font-bold text-3xl tabular-nums leading-tight">
                {advantage.cost_points != null ? formatCost(advantage.cost_points) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
            {advantage.description ? (
              <p className="text-zinc-300 text-sm leading-relaxed">{advantage.description}</p>
            ) : (
              <p className="text-zinc-600 text-sm italic">No description recorded for this advantage yet.</p>
            )}
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
