"use client";

/* ============================================================
   PlayerAtlas — the player's "Locais" tab as a Survey Atlas.
   Read-only. Every node comes from `/game-table-locations?actor=`,
   so the server has already dropped the locations this character
   doesn't know and shaped the names/details of the others (masked
   alias / blanked detail). The atlas only re-renders those fields:
   no route to the narrator's editor, no set-default, no raw path.
   The banner card carries the region's sublocation selector
   ("pesquisa"), mirroring the narrator's atlas.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { interpolate, useTranslation } from "@/lib/i18n";
import { absoluteHex } from "@/lib/location";
import type { Location } from "@/lib/types";
import LocationMap from "@/components/location/LocationMap";
import {
  atlasStripGroup,
  CurrentMapStrip,
  indexTree,
  LocationPlate,
  ZoomRuler,
} from "@/components/location/locAtlas";

interface PlayerAtlasProps {
  tree: Location[];
  defaultLocationId?: string | null;
  /** the viewer's current place (last narrated location), used to
      open the atlas — only if that place is in the player's tree. */
  currentLocationId?: string | null;
}

export default function PlayerAtlas({ tree, defaultLocationId = null, currentLocationId = null }: PlayerAtlasProps) {
  const { t } = useTranslation();
  const index = useMemo(() => indexTree(tree ?? []), [tree]);
  const flat = useMemo(() => Array.from(index.values()), [index]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const platesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeId !== null) return;
    const cands = [currentLocationId, defaultLocationId].filter(
      (c): c is string => !!c && index.has(c)
    );
    const next = cands[0] ?? flat[0]?.node.id ?? null;
    if (next !== null) {
      setFirstId(next);
      setActiveId(next);
    }
  }, [activeId, currentLocationId, defaultLocationId, index, flat]);

  const active = activeId ? index.get(activeId) : null;
  const stripGroup = useMemo(() => atlasStripGroup(active?.node, flat.map((i) => i.node)), [active, flat]);
  const atFirst = !active || (firstId !== null && active.node.id === firstId);
  const inSub = !!active && !atFirst;
  const parentLoc = active && active.chain.length >= 2 ? active.chain[active.chain.length - 2] : null;
  const rootLoc = active && active.chain.length >= 2 ? active.chain[0] : null;

  /* Alvo de mapa: battlemap (com tiles/traços dos personagens ou não).
     Tiles/traços sempre chegam sem mascaramento; se um visitado ainda
     não tiver nada pintado, o grid em branco ainda se mostra. */
  const canShowMap =
    !!active &&
    (!!active.node.isBattlemap ||
      (active.node.tiles?.length ?? 0) > 0 ||
      (active.node.drawing?.length ?? 0) > 0);
  const activeAbs = useMemo(
    () =>
      canShowMap
        ? absoluteHex({
            id: active.node.id,
            name: active.node.name,
            hex: active.node.hex,
            ancestors: active.chain.slice(0, -1).map((n) => ({ id: n.id, name: n.name, hex: n.hex })),
          })
        : undefined,
    [canShowMap, active],
  );

  const filtered = search.trim()
    ? flat.filter(({ node }) => {
        const q = search.trim().toLowerCase();
        return (node.name ?? "").toLowerCase().includes(q)
          || (node.region ?? "").toLowerCase().includes(q)
          || (node.address ?? "").toLowerCase().includes(q);
      })
    : null;

  const query = inSub ? search.trim().toLowerCase() : "";
  const children = active ? (active.node.children ?? []) : (tree ?? []);
  const plates = query
    ? children.filter((n) =>
        (n.name ?? "").toLowerCase().includes(query)
          || (n.region ?? "").toLowerCase().includes(query)
          || (n.address ?? "").toLowerCase().includes(query)
      )
    : children;

  const zoom = (nodeId: string) => {
    if (index.get(nodeId)?.node.parentId) setSearch("");
    setActiveId(nodeId);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    platesRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="space-y-4">
      {atFirst ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("tp.searchPh")}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-600/70"
            />
          </div>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60"
            >
              {t("tp.clear")}
            </button>
          ) : null}
        </div>
      ) : null}

      {(tree?.length ?? 0) === 0 ? (
        <p className="text-sm text-zinc-500 italic">{t("pl.res.empty.locations")}</p>
      ) : atFirst && filtered !== null ? (
        filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">{t("tp.noResults")}</p>
          </div>
        ) : (
          <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-live="polite">
            {filtered.map(({ node, chain }) => (
              <LocationPlate key={node.id} node={node} onZoom={zoom} player trail={chain.slice(0, -1)} />
            ))}
          </div>
        )
      ) : !active ? (
        <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plates.map((node) => (
            <LocationPlate key={node.id} node={node} onZoom={zoom} player />
          ))}
        </div>
      ) : (
        <div ref={platesRef} className="space-y-4">
          {active ? (
            <CurrentMapStrip
              node={active.node}
              group={stripGroup}
              onJump={zoom}
              onBack={inSub && parentLoc ? () => zoom(parentLoc.id) : undefined}
              backName={parentLoc?.name ?? undefined}
              onPlanet={rootLoc ? () => zoom(rootLoc.id) : undefined}
              planetName={rootLoc?.name ?? undefined}
              player
              searchable={inSub}
              searchValue={search}
              onSearchChange={setSearch}
            />
          ) : null}
          {active ? <ZoomRuler chain={active.chain} onJump={zoom} player minZoomId={defaultLocationId} /> : null}
          {active ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/player/location/${active.node.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-blue-200 transition-colors hover:bg-blue-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              >
                {t("tp.openMap")}
              </Link>
              <Link
                href={`/player/location/${active.node.id}/organogram`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/50 bg-slate-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
              >
                <span aria-hidden>▣</span> {t("lc.view.tab.organogram")}
              </Link>
            </div>
          ) : null}
          {canShowMap && activeAbs ? (
            <LocationMap
              hex={active.node.hex ?? null}
              abs={activeAbs}
              accent="#60a5fa"
              tiles={active.node.tiles ?? []}
              drawing={active.node.drawing ?? []}
            />
          ) : null}
          {plates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">
                {inSub && search
                  ? t("tp.noResults")
                  : interpolate(t("tp.noDivisions"), { name: active.node.name ?? t("tp.locKind.generic") })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plates.map((node) => (
                <LocationPlate key={node.id} node={node} onZoom={zoom} player />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}