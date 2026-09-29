"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GameTableLocations } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";
import {
  CurrentMapStrip,
  indexTree,
  LocationPlate,
  ZoomRuler,
} from "@/components/location/locAtlas";
import { atlasStripGroup } from "@/components/location/locAtlas";

/* ============================================================
   Survey Atlas — the location list as an open atlas.
   The tree is a genuine zoom: each division's hex scale shrinks
   (500 km → 1 m). The zoom ruler up top is the territory chain
   drawn as a cartographic scale bar. On any open plate, the
   banner card carries the region's sublocation selector
   ("pesquisa"), the same shape MapLog uses for sublocations.
   ============================================================ */

export default function TableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [data, setData] = useState<GameTableLocations | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const platesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<GameTableLocations>(`/game-table-locations/${id}`)
      .then((d) => {
        setData(d);
        setDefaultId(d?.defaultLocationId ?? null);
      })
      .catch(() => setData(null));
  }, [id]);

  const index = useMemo(() => indexTree(data?.tree ?? []), [data]);
  const flat = useMemo(() => Array.from(index.values()), [index]);
  const active = activeId ? index.get(activeId) : null;
  const stripGroup = useMemo(() => atlasStripGroup(active?.node, flat.map((i) => i.node)), [active, flat]);
  const atFirst = !active || (firstId !== null && active.node.id === firstId);
  const inSub = !!active && !atFirst;

  const filtered = search.trim()
    ? flat.filter(({ node }) => {
        const q = search.trim().toLowerCase();
        return (node.name ?? "").toLowerCase().includes(q)
          || (node.region ?? "").toLowerCase().includes(q)
          || (node.address ?? "").toLowerCase().includes(q);
      })
    : null;

  const query = inSub ? search.trim().toLowerCase() : "";
  const children = active ? (active.node.children ?? []) : (data?.tree ?? []);
  const plates = query
    ? children.filter((n) =>
        (n.name ?? "").toLowerCase().includes(query)
          || (n.region ?? "").toLowerCase().includes(query)
          || (n.address ?? "").toLowerCase().includes(query)
      )
    : children;

  const zoom = (nodeId: string) => {
    if (index.get(nodeId)?.node.parentId) setSearch("");
    setFirstId((f) => f ?? nodeId);
    setActiveId(nodeId);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    platesRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  };

  const toggleDefault = async (nodeId: string) => {
    if (settingDefault) return;
    setSettingDefault(true);
    try {
      const next = defaultId === nodeId ? null : nodeId;
      const res = await submitJson<{ success: boolean; defaultLocationId: string | null }>(
        "/api/game-table-locations/default",
        "POST",
        { tableId: id, locationId: next ?? null }
      );
      setDefaultId(res.defaultLocationId ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setSettingDefault(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-100">{t("tp.title")}</h1>
          <span className="text-sm text-zinc-500">{data?.table?.title ?? ""}</span>
        </div>
        <Link
          href={`/table/${id}/locations/new${active ? `?parent_id=${active.node.id}` : ""}`}
          className="shrink-0 inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
        >
          <span>+ {t("tp.new")}</span>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-zinc-500">
        <span>
          {interpolate(t(flat.length !== 1 ? "tp.count" : "tp.countOne"), { n: flat.length })} ·{" "}
          {interpolate(t((data?.tree?.length ?? 0) !== 1 ? "tp.roots" : "tp.rootOne"), { n: data?.tree?.length ?? 0 })}
        </span>
      </div>

      {atFirst ? (
        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("tp.searchPh")}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-700/60"
            />
          </div>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
            >
              {t("tp.clear")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!data ? (
        <div className="text-center py-16 text-zinc-600 text-sm">{t("tp.loading")}</div>
      ) : flat.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">{t("tp.empty")}</p>
        </div>
      ) : atFirst && filtered !== null ? (
        filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">{t("tp.noResults")}</p>
          </div>
        ) : (
          <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-live="polite">
            {filtered.map(({ node, chain }) => (
              <LocationPlate
                key={node.id}
                node={node}
                onZoom={zoom}
                onSetDefault={toggleDefault}
                trail={chain.slice(0, -1)}
                isDefault={defaultId === node.id}
                busy={settingDefault}
                copyHref={`/api/table-location/${node.id}/copy`}
                tableId={id}
              />
            ))}
          </div>
        )
      ) : !active && (data.tree?.length ?? 0) > 1 ? (
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-widest uppercase text-zinc-600">
            {t("tp.manyWorlds")}
          </p>
          <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plates.map((node) => (
              <LocationPlate key={node.id} node={node} onZoom={zoom} onSetDefault={toggleDefault} isDefault={defaultId === node.id} busy={settingDefault} copyHref={`/api/table-location/${node.id}/copy`} tableId={id} />
            ))}
          </div>
        </div>
      ) : (
        <div ref={platesRef} className="space-y-4">
          {active ? (
            <CurrentMapStrip
              node={active.node}
              isDefault={defaultId === active.node.id}
              group={stripGroup}
              onJump={zoom}
              searchable={inSub}
              searchValue={search}
              onSearchChange={setSearch}
            />
          ) : null}
          {active ? <ZoomRuler chain={active.chain} onJump={zoom} minZoomId={defaultId} /> : null}
          {plates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">
                {inSub && search
                  ? t("tp.noResults")
                  : interpolate(t("tp.noDivisions"), { name: active?.node.name ?? t("tp.locKind.generic") })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plates.map((node) => (
                <LocationPlate key={node.id} node={node} onZoom={zoom} onSetDefault={toggleDefault} isDefault={defaultId === node.id} busy={settingDefault} copyHref={`/api/table-location/${node.id}/copy`} tableId={id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}