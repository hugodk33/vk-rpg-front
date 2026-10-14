import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationOrganogram from "@/components/location/LocationOrganogram";
import type { GameTableLocations, Location } from "@/lib/types";
import { interpolate } from "@/lib/i18n";
import { getLang, makeT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LocationOrganogramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* O `actor` é obrigatório nas leituras de location. */
  const tableId = await getLocationTableId(id);
  const { query: actorQs } = tableId ? await getNarratorSideView(tableId) : { query: "" };

  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}${actorQs}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  /* As passagens + o catálogo alimentam o organograma da localidade. */
  let all: GameTableLocations | null = null;
  const ownerTable = location.tableId ?? tableId;
  if (ownerTable) {
    try {
      all = await api<GameTableLocations>(`/game-table-locations/${ownerTable}${actorQs}`);
    } catch {
      all = null;
    }
  }

  const lang = await getLang();
  const t = makeT(lang);
  const baseTableId = location.tableId ?? ownerTable ?? tableId ?? "";

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">
              {t("lc.org.title")}
            </h1>
            {location.name ? (
              <p className="truncate text-[11px] sm:text-xs text-zinc-500">{location.name}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {baseTableId ? (
              <Link
                href={`/table/${baseTableId}/locations`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
              >
                <span aria-hidden>←</span> {t("lc.lp.backToLocations")}
              </Link>
            ) : null}
            <Link
              href={`/location/${location.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
            >
              {t("lc.editor.backToLocal").replace("{name}", location.name ?? "")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 p-3 shadow-2xl sm:p-6 overflow-auto">
          <LocationOrganogram
            root={location}
            locations={all?.locations ?? []}
            connections={all?.connections ?? []}
          />
        </div>
      </div>
    </div>
  );
}
