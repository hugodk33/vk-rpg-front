import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function TableOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let table: GameTable | null = null;
  try {
    table = await api<GameTable>(`/game-table/${id}`);
  } catch {
    /* ignore */
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} active="overview" />
      <h1 className="text-2xl font-bold text-amber-100 mt-3 mb-1">
        {table?.title || "Table"}
      </h1>
      {table?.intro ? (
        <p className="text-zinc-400 text-sm mb-6">{table.intro}</p>
      ) : (
        <div className="mb-6" />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Link
          href={`/table/${id}/characters`}
          className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-emerald-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-emerald-400 group-hover:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm text-emerald-200 font-medium">Characters</span>
        </Link>

        <Link
          href={`/character/new?table_id=${id}`}
          className="bg-cyan-900/30 border border-cyan-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-cyan-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-cyan-400 group-hover:text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span className="text-sm text-cyan-200 font-medium">New Character</span>
        </Link>

        <Link
          href={`/table/${id}/items`}
          className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-amber-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-amber-400 group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm text-amber-200 font-medium">Items</span>
        </Link>

        <Link
          href={`/item/new?table_id=${id}`}
          className="bg-amber-900/20 border border-dashed border-amber-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-amber-500/60 hover:bg-amber-900/30 transition-colors group"
        >
          <svg className="w-7 h-7 text-amber-400 group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-amber-200 font-medium">Add Item</span>
        </Link>

        <Link
          href={`/table/${id}/advantages`}
          className="bg-indigo-900/30 border border-indigo-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-indigo-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-indigo-400 group-hover:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <span className="text-sm text-indigo-200 font-medium">Advantages</span>
        </Link>

        <Link
          href={`/advantage/new?table_id=${id}`}
          className="bg-indigo-900/20 border border-dashed border-indigo-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-indigo-500/60 hover:bg-indigo-900/30 transition-colors group"
        >
          <svg className="w-7 h-7 text-indigo-400 group-hover:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-indigo-200 font-medium">Add Advantage</span>
        </Link>

        <Link
          href={`/table/${id}/disadvantages`}
          className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-red-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm text-red-200 font-medium">Disadvantages</span>
        </Link>

        <Link
          href={`/disadvantage/new?table_id=${id}`}
          className="bg-red-900/20 border border-dashed border-red-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-red-500/60 hover:bg-red-900/30 transition-colors group"
        >
          <svg className="w-7 h-7 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-red-200 font-medium">Add Disadvantage</span>
        </Link>

        <Link
          href={`/table/${id}/skills`}
          className="bg-violet-900/30 border border-violet-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-violet-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-violet-400 group-hover:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm text-violet-200 font-medium">Skills</span>
        </Link>

        <Link
          href={`/table/${id}/skills`}
          className="bg-violet-900/20 border border-dashed border-violet-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-violet-500/60 hover:bg-violet-900/30 transition-colors group"
        >
          <svg className="w-7 h-7 text-violet-400 group-hover:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-violet-200 font-medium">Add Skill</span>
        </Link>

        <Link
          href={`/table/${id}/locations`}
          className="bg-pink-900/30 border border-pink-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-pink-500/60 transition-colors group"
        >
          <svg className="w-7 h-7 text-pink-400 group-hover:text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm text-pink-200 font-medium">Locations</span>
        </Link>

        <Link
          href={`/npc/new?table_id=${id}`}
          className="bg-pink-900/20 border border-dashed border-pink-700/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-pink-500/60 hover:bg-pink-900/30 transition-colors group"
        >
          <svg className="w-7 h-7 text-pink-400 group-hover:text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-pink-200 font-medium">Add NPC</span>
        </Link>
      </div>

      <div className="mt-5">
        <Link
          href={`/table/${id}/edit`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Table
        </Link>
      </div>
    </div>
  );
}
