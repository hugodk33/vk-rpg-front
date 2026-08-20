import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTableCharacters } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import RadarChart from "@/components/RadarChart";

export const dynamic = "force-dynamic";

export default async function PlayerTableCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, characterUrl] = await Promise.all([
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    getPlayerCharacterUrl(id),
  ]);
  const characters = data.characters ?? [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold mb-1">{data.table?.title || "Characters"}</h1>
      {data.table?.intro ? (
        <p className="text-zinc-400 text-sm mb-6">{data.table.intro}</p>
      ) : null}

      {characters.length === 0 ? (
        <div className="bg-zinc-800 rounded p-6 text-center text-zinc-400">No characters in this table.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map((ch) => {
            const s = ch.sheet;
            return (
              <Link
                key={ch.id}
                href={characterUrl ?? `/character/${ch.id}`}
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600/60 rounded-xl px-5 py-4 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-100 font-semibold text-lg">
                        {s?.name || ch.name || "Unnamed"}
                      </span>
                      <span className="text-zinc-500 text-xs">{ch.user?.username ?? ""}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      {s ? (
                        <>
                          <RadarChart st={s.st} dx={s.dx} iq={s.iq} ht={s.ht} />
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-red-400">ST {s.st ?? "-"}</span>
                            <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                            <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                            <span className="text-purple-400">HT {s.ht ?? "-"}</span>
                            <span className="text-zinc-500">·</span>
                            <span className="text-red-400/80">HP {s.hp ?? "-"}</span>
                            <span className="text-emerald-400/80">FP {s.fatigue ?? "-"}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-600 text-xs italic">No sheet</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
