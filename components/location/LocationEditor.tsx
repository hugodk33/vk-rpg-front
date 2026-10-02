"use client";

import { useState } from "react";
import Link from "next/link";
import LocationForm from "@/components/forms/LocationForm";
import MapStudio from "@/components/location/MapStudio";
import LocationLinks from "@/components/location/LocationLinks";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { Location } from "@/lib/types";

/* ============================================================
   LocationEditor — the edit screen for a location. The cadastro
   (LocationForm) and the plate editor (MapStudio) are split into
   two tabs, with the same back chrome used across the narrator
   flow ("← Back to locations") and a shortcut back to the plate
   itself (previous screen). Container keeps the default width
   (max-w-5xl) used by the survey plates.
   ============================================================ */

type EditorTab = "form" | "map" | "links";

const EDITOR_TABS: Array<{ key: EditorTab; label: string; hint: string }> = [
  { key: "form", label: "lc.editor.tab.form", hint: "lc.editor.hint.form" },
  { key: "map", label: "lc.editor.tab.map", hint: "lc.editor.hint.map" },
  { key: "links", label: "lc.editor.tab.links", hint: "lc.editor.hint.links" },
];

export default function LocationEditor({
  location,
  tableId,
  tableTitle,
  allLocations,
  defaultTab = "form",
}: {
  location: Location;
  tableId?: string;
  tableTitle?: string;
  allLocations: Location[];
  defaultTab?: EditorTab;
}) {
  const [tab, setTab] = useState<EditorTab>(defaultTab);
  const { t } = useTranslation();
  const baseTableId = tableId ?? location.tableId;
  const backHref = baseTableId ? `/table/${baseTableId}/locations` : "/narrator";

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        {/* top strip — same back chrome as the survey plate */}
        <div className="exhibit-reveal flex items-center justify-between px-6 pt-6 lg:px-8">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-green-400 transition-colors"
            >
              <span aria-hidden>←</span> {t("lc.editor.back")}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <span className="hidden sm:inline">{location.name}</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span className="text-green-300">{t("lc.editor.badge")}</span>
          </div>
        </div>

        {/* title + back to the previous screen (the plate) */}
        <div className="px-6 lg:px-8 mt-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,4vw,34px)] leading-none font-bold tracking-tight text-green-100">
              {location.name || t("lc.common.unmapped")}
            </h1>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {tab === "map" ? t("lc.editor.subMap") : tab === "links" ? t("lc.editor.subLinks") : t("lc.editor.subForm")}
            </p>
          </div>
          <Link
            href={`/location/${location.id}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-green-400 transition-colors"
          >
            <span aria-hidden>←</span>{" "}
            {interpolate(t("lc.editor.backTo"), {
              name: location.name || t("lc.editor.localWord"),
            })}
          </Link>
        </div>

        {/* editor tabs */}
        <div
          role="tablist"
          aria-label={t("lc.editor.aria")}
          className="mt-5 flex items-center gap-1 border-b border-zinc-700/40 px-6 lg:px-8"
        >
          {EDITOR_TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              role="tab"
              type="button"
              aria-selected={tab === tabDef.key}
              title={t(tabDef.hint)}
              onClick={() => setTab(tabDef.key)}
              className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 rounded-md ${
                tab === tabDef.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t(tabDef.label)}
              {tab === tabDef.key ? (
                <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: "#4ade80" }} />
              ) : null}
            </button>
          ))}
        </div>

        {/* active panel */}
        <div className="px-6 py-8 lg:px-8" role="tabpanel">
          {tab === "form" ? (
            <LocationForm initial={location} tableId={baseTableId} tableTitle={tableTitle} allLocations={allLocations} />
          ) : tab === "map" ? (
            <MapStudio location={location} />
          ) : (
            <LocationLinks location={location} allLocations={allLocations} />
          )}
        </div>
      </div>
    </div>
  );
}