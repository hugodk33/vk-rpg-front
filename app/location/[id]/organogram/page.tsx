import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getLocationTableId, getNarratorSideView } from "@/lib/actor";
import LocationStructure from "@/components/location/LocationStructure";
import type { GameTableLocations, Location } from "@/lib/types";
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
    <div className="relative max-w-5xl mx-auto">
      {/* top strip — mesmo chrome da placa (primeira tela) */}
      <div className="exhibit-reveal flex items-center justify-between px-6 pt-6 lg:px-8">
        {baseTableId ? (
          <Link
            href={`/table/${baseTableId}/locations`}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-green-400 transition-colors"
          >
            <span aria-hidden>←</span> {t("lc.lp.backToLocations")}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          {all?.table?.title ? <span className="hidden sm:inline">{all.table.title}</span> : null}
          <span className="hidden sm:inline text-zinc-700">/</span>
          <span className="text-green-300">{t("lc.org.structure")}</span>
        </div>
      </div>

      {/* title + back to the plate */}
      <div className="px-6 lg:px-8 mt-5 flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[clamp(24px,4vw,34px)] leading-none font-bold tracking-tight text-green-100">
            {t("lc.org.structure")}
          </h1>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {location.name || t("lc.common.unmapped")}
          </p>
        </div>
        <Link
          href={`/location/${location.id}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-green-400 transition-colors"
        >
          <span aria-hidden>←</span>{" "}
          {t("lc.editor.backTo").replace("{name}", location.name || t("lc.editor.localWord"))}
        </Link>
      </div>

      <div className="px-6 py-8 lg:px-8">
        <LocationStructure
          root={location}
          locations={all?.locations ?? []}
          connections={all?.connections ?? []}
          tableId={ownerTable ?? baseTableId}
          actorQuery={actorQs}
        />
      </div>
    </div>
  );
}
