"use client";

/* ============================================================
   LocationTabs — a rota individual de uma localidade (/location/:id)
   mostra a PLACA (survey plate). Um botão flutuante, sempre visível,
   leva à TELA DEDICADA do organograma (/location/:id/organogram)
   — o "controlador de dungeon": nela o narrador percorre as salas e
   vê como elas se conectam.
   ============================================================ */

import Link from "next/link";
import LocationPlate from "@/components/location/LocationPlate";
import { useTranslation } from "@/lib/i18n";
import type { Location, LocationConnection } from "@/lib/types";

export default function LocationTabs({
  location,
  locations,
  connections,
  tableId,
  mode = "narrator",
}: {
  location: Location;
  locations: Location[];
  connections: LocationConnection[];
  tableId?: string;
  mode?: "narrator" | "player";
}) {
  const { t } = useTranslation();

  return (
    <>
      <LocationPlate location={location} tableId={tableId} mode={mode} />

      <Link
        href={`/location/${location.id}/organogram`}
        title={t("lc.org.title")}
        aria-label={t("lc.org.title")}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-green-600/60 bg-zinc-900/95 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-green-300 shadow-2xl backdrop-blur-sm transition-colors hover:bg-green-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="9" y="2.5" width="6" height="5" rx="1" />
          <rect x="2.5" y="16.5" width="6" height="5" rx="1" />
          <rect x="15.5" y="16.5" width="6" height="5" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12M5.5 16.5V12h13v4.5" />
        </svg>
        {t("lc.view.tab.organogram")}
      </Link>
    </>
  );
}
