import Link from "next/link";
import { api } from "@/lib/api";
import type { Disadvantage, GameTableDisadvantages } from "@/lib/types";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

const DISADVANTAGE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#1e1b4b", border: "#4338ca", badge: "bg-purple-600/80 text-purple-200" },
  Physical: { bg: "#450a0a", border: "#dc2626", badge: "bg-red-600/80 text-red-200" },
  Social: { bg: "#172554", border: "#2563eb", badge: "bg-blue-600/80 text-blue-200" },
  Exotic: { bg: "#083344", border: "#0891b2", badge: "bg-cyan-600/80 text-cyan-200" },
  "Self-Control": { bg: "#2e1065", border: "#7c3aed", badge: "bg-indigo-600/80 text-indigo-200" },
};

const DISADVANTAGE_FALLBACK = { bg: "#27272a", border: "#52525b", badge: "bg-zinc-600/80 text-zinc-200" };

export default async function TableDisadvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`);
  const disadvantages = data.disadvantages ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />
      <h1 className="text-2xl font-bold text-amber-100 mb-6">
        {data.table?.title || "Table"} — Disadvantages
      </h1>

      {disadvantages.length === 0 ? (
        <p className="text-zinc-500 italic">No disadvantages registered for this table.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {disadvantages.map((d: Disadvantage) => {
            const colors = DISADVANTAGE_COLORS[d.category ?? ""] ?? DISADVANTAGE_FALLBACK;
            return (
              <div
                key={d.id}
                className="rounded-lg px-4 py-3"
                style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-zinc-100 font-medium">{d.name || "Unnamed"}</span>
                  <span className="text-red-400 text-xs font-semibold">{d.cost_points ?? ""}</span>
                </div>
                {d.category ? (
                  <span className={`inline-block ${colors.badge} text-xs px-2 py-0.5 rounded-full mt-1`}>
                    {d.category}
                    {d.subcategory ? ` / ${d.subcategory}` : ""}
                  </span>
                ) : null}
                {d.effect ? <p className="text-zinc-400 text-xs mt-2">{d.effect}</p> : null}
                {d.description ? <p className="text-zinc-500 text-xs mt-1">{d.description}</p> : null}
                <div className="mt-3">
                  <Link
                    href={`/desvantagem/${d.id}/editar?table_id=${id}`}
                    className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
