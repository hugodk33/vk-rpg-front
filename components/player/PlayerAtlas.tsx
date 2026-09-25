"use client";

/* ============================================================
   PlayerAtlas — the player's "Locais" tab as a Survey Atlas.
   Read-only. Every node comes from `/game-table-locations?viewer=`,
   so the server has already dropped the locations this character
   doesn't know and shaped the names/details of the others (masked
   alias / blanked detail). The atlas only re-renders those fields:
   no route to the narrator's editor, no set-default, no raw path.
   The banner card carries the region's sublocation selector
   ("pesquisa"), mirroring the narrator's atlas.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { Location } from "@/lib/types";
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

  const query = search.trim().toLowerCase();
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
      {(tree?.length ?? 0) === 0 ? (
        <p className="text-sm text-zinc-500 italic">{t("pl.res.empty.locations")}</p>
      ) : !active ? (
        <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plates.map((node) => (
            <LocationPlate key={node.id} node={node} onZoom={zoom} player />
          ))}
        </div>
      ) : (
        <div ref={platesRef} className="space-y-4">
          {active ? <ZoomRuler chain={active.chain} onJump={zoom} /> : null}
          {active ? (
            <CurrentMapStrip
              node={active.node}
              group={stripGroup}
              onJump={zoom}
              player
              searchable={firstId !== null && active.node.id === firstId}
              searchValue={search}
              onSearchChange={setSearch}
            />
          ) : null}
          {plates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">
                {search
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