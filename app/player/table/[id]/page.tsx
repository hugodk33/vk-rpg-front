import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function PlayerTableOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ character?: string; user?: string }>;
}) {
  const { id } = await params;
  const { character, user } = await searchParams;
  const [table, characterUrl] = await Promise.all([
    api<GameTable>(`/game-table/${id}`).catch(() => null as GameTable | null),
    getPlayerCharacterUrl(id, { characterId: character, userId: user }),
  ]);

  const groups = [
    {
      label: "Characters",
      list: { href: `/player/table/${id}/characters`, color: "text-emerald-400", d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    },
    {
      label: "Items",
      list: { href: `/player/table/${id}/items`, color: "text-amber-400", d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    },
    {
      label: "Advantages",
      list: { href: `/player/table/${id}/advantages`, color: "text-emerald-400", d: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
    },
    {
      label: "Disadvantages",
      list: { href: `/player/table/${id}/disadvantages`, color: "text-red-400", d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
    },
    {
      label: "Skills",
      list: { href: `/player/table/${id}/skills`, color: "text-violet-400", d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
    },
    {
      label: "Locations",
      list: { href: `/player/table/${id}/locations`, color: "text-pink-400", d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" active="overview" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mt-3 mb-1">
        {table?.title || "Table"}
      </h1>
      {table?.intro ? (
        <p className="text-zinc-400 text-sm mb-6">{table.intro}</p>
      ) : (
        <div className="mb-6" />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => (
          <Link
            key={g.label}
            href={g.list.href}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 flex items-center gap-3 hover:bg-zinc-700/40 transition-colors"
          >
            <svg className={`w-6 h-6 shrink-0 ${g.list.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={g.list.d} />
            </svg>
            <span className="text-sm text-zinc-200 font-medium">{g.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
