"use client";

/* ============================================================
   LocationTabs — a rota individual de uma localidade (/location/:id)
   ganha dois modos de visualização: a PLACA (survey plate, default)
   e o ORGANOGRAMA das passagens das áreas abaixo dela. O tab do
   organograma só aparece quando alguma subárea está interligada.
   ============================================================ */

import { useState } from "react";
import LocationPlate from "@/components/location/LocationPlate";
import LocationOrganogram from "@/components/location/LocationOrganogram";
import { useTranslation } from "@/lib/i18n";
import type { Location, LocationConnection } from "@/lib/types";

type ViewMode = "plate" | "organogram";

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
  const [view, setView] = useState<ViewMode>("plate");

  const subtree = new Set<string>();
  const stack = [location.id];
  while (stack.length) {
    const id = stack.pop() as string;
    if (subtree.has(id)) continue;
    subtree.add(id);
    for (const loc of locations) {
      if (loc.parentId === id) stack.push(loc.id);
    }
  }
  const hasLinks = connections.some(
    (c) => subtree.has(c.from?.id ?? "") || subtree.has(c.to?.id ?? "")
  );

  if (!hasLinks) {
    return <LocationPlate location={location} tableId={tableId} mode={mode} />;
  }

  const tabs: Array<{ key: ViewMode; label: string }> = [
    { key: "plate", label: "lc.view.tab.plate" },
    { key: "organogram", label: "lc.view.tab.organogram" },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t("lc.view.tab.plate")}
        className="max-w-5xl mx-auto flex items-center gap-1"
      >
        {tabs.map((tabDef) => (
          <button
            key={tabDef.key}
            role="tab"
            type="button"
            aria-selected={view === tabDef.key}
            onClick={() => setView(tabDef.key)}
            className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 rounded-md ${
              view === tabDef.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t(tabDef.label)}
            {view === tabDef.key ? (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                style={{ background: "#4ade80" }}
              />
            ) : null}
          </button>
        ))}
      </div>

      {view === "organogram" ? (
        <div className="max-w-7xl mx-auto rounded-2xl bg-zinc-900/90 border border-zinc-700/50 shadow-2xl p-6 lg:p-8">
          <LocationOrganogram root={location} locations={locations} connections={connections} />
        </div>
      ) : (
        <LocationPlate location={location} tableId={tableId} mode={mode} />
      )}
    </div>
  );
}
