"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GameTableLocations, Location } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { KindGlyph, KIND_LABELS, KIND_TINT } from "@/lib/location-glyphs";

function formatScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km/hex`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m/hex`;
}

function formatRulerScale(m?: number | null): string {
  if (m == null) return "";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m`;
}

/* ============================================================
   Survey Atlas — the location list as an open atlas.
   The tree is a genuine zoom: each division's hex scale shrinks
   (500 km → 1 m). Instead of a full-width nested dump, you hold
   the atlas open at one plate and zoom into the divisions it
   contains. The zoom ruler up top is the territory chain drawn
   as a cartographic scale bar whose segments shrink with each
   division's real hex scale.
   ============================================================ */

interface IndexNode {
  node: Location;
  chain: Location[];
}

function indexTree(roots: Location[]): Map<string, IndexNode> {
  const map = new Map<string, IndexNode>();
  const walk = (node: Location, trail: Location[]) => {
    const chain = [...trail, node];
    map.set(node.id, { node, chain });
    for (const child of node.children ?? []) walk(child, chain);
  };
  for (const root of roots) walk(root, []);
  return map;
}

/* The ruler: segment width ∝ log scale so the bar visibly
   converges as the atlas zooms from world to battlemap. */
function ZoomRuler({ chain, onJump }: { chain: Location[]; onJump: (id: string) => void }) {
  if (chain.length < 2) return null;
  const raw = chain.map((n) => {
    const m = n.hex?.sizeM;
    return m != null && m > 0 ? Math.max(Math.log10(m), 0.08) : 0.08;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((w) => (w / sum) * 100);
  const active = chain[chain.length - 1].id;

  return (
    <nav aria-label="Trilha de zoom" className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-4 py-3.5">
      {/* rung names */}
      <div className="flex flex-wrap items-center gap-y-1.5">
        {chain.map((node, i) => {
          const isActive = node.id === active;
          return (
            <span key={node.id} className="flex items-center min-w-0">
              {i > 0 ? (
                <span className="mx-2 text-zinc-700" aria-hidden>›</span>
              ) : null}
              {isActive ? (
                <span className="font-mono text-[11px] uppercase tracking-widest truncate text-teal-300"
                  title={node.name}>
                  {node.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onJump(node.id)}
                  className="font-mono text-[11px] uppercase tracking-widest truncate text-zinc-500 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded-sm"
                  title={`Ir para ${node.name}`}
                >
                  {node.name}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* scale ruler */}
      <div className="mt-3">
        <div className="flex">
          {widths.map((w, i) => (
            <div key={i} className="relative" style={{ width: `${w}%` }}>
              {/* segment run */}
              <div
                className={
                  i === chain.length - 1
                    ? "h-[3px] rounded-full bg-teal-400/70 shadow-[0_0_8px_rgba(94,234,212,0.35)]"
                    : "h-[3px] rounded-full bg-zinc-600/70 group-hover:bg-zinc-500/70 transition-colors"
                }
              />
              {/* boundary ticks */}
              <span className="absolute top-1/2 -translate-y-1/2 -right-px h-2 w-px bg-zinc-500" aria-hidden />
            </div>
          ))}
        </div>
        <div className="flex mt-1.5">
          {widths.map((w, i) => (
            <div key={i} className="flex items-center min-w-0"
              style={{ width: `${w}%` }}>
              <span
                className={`font-mono text-[9px] tracking-widest uppercase pr-2 ${
                  i === chain.length - 1 ? "text-teal-400/90" : "text-zinc-600"
                }`}
              >
                {formatRulerScale(chain[i].hex?.sizeM)}
              </span>
            </div>
          ))}
        </div>
        {/* you-are-here marker */}
        <div className="relative mt-1" aria-hidden>
          <span
            className="absolute -translate-x-1/2 text-[10px] leading-none text-teal-300"
            style={{ left: `calc(${widths.slice(0, -1).reduce((a, b) => a + b, 0)}% + ${widths[widths.length - 1] / 2}% )` }}
          >
            ▼
          </span>
        </div>
      </div>
    </nav>
  );
}

function Trail({ chain }: { chain: Location[] }) {
  if (chain.length === 0) return null;
  return (
    <div className="font-mono text-[9px] tracking-widest uppercase text-zinc-600 truncate" title={chain.map((n) => n.name).join(" › ")}>
      {chain.slice(0, 4).map((n) => n.name).join(" › ")}
      {chain.length > 4 ? " › …" : ""}
    </div>
  );
}

function Plate({
  node,
  onZoom,
  onSetDefault,
  trail,
  isDefault = false,
  busy = false,
}: {
  node: Location;
  onZoom: (id: string) => void;
  onSetDefault: (id: string) => void;
  trail?: Location[];
  isDefault?: boolean;
  busy?: boolean;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const battle = !!node.isBattlemap;
  return (
    <div className="group relative flex h-full gap-3 rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-4 py-3.5 transition-all hover:bg-zinc-800/70 hover:border-zinc-600/60">
      {/* kind icon — the glyph alone, centered vertically in its column */}
      <div className={`flex items-center shrink-0 ${KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500"}`} aria-hidden>
        <KindGlyph
          kind={node.kind}
          className="h-11 w-11 opacity-90 transition-all duration-300 group-hover:opacity-100 group-hover:drop-shadow-[0_0_10px_currentColor]"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetDefault(node.id)}
            title={isDefault ? "Local padrão dos jogadores — clique para remover" : "Definir como local padrão dos jogadores"}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60 disabled:opacity-40 ${
              isDefault
                ? "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
                : "text-zinc-600 hover:text-amber-300/80 hover:bg-amber-400/10"
            }`}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isDefault ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>Padrão</span>
        </button>
          {battle ? (
            <span className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
              Batalha
            </span>
          ) : null}
          {hasChildren ? (
            <span className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-teal-400/10 text-teal-300">
              +{(node.children?.length ?? 0).toString().padStart(2, "0")}
            </span>
          ) : null}
        </div>

        <span className="block mt-2 text-sm font-medium text-zinc-200 truncate">{node.name || "Sem nome"}</span>
        <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5 truncate">
          {KIND_LABELS[node.kind ?? "site"] ?? node.kind ?? "Local"}
          {node.region ?? node.subRegion ? (
            <span className="text-zinc-600"> · {node.region ?? node.subRegion}</span>
          ) : null}
        </p>
        {trail ? <div className="mt-1"><Trail chain={trail} /></div> : null}

        <div className="mt-3 font-mono text-[10px] tracking-widest uppercase text-zinc-600">
          {formatScale(node.hex?.sizeM)}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-700/40 pt-2.5 mt-auto">
          <button
            type="button"
            onClick={() => onZoom(node.id)}
            disabled={!hasChildren}
            title={hasChildren ? "Abrir subdivisões" : "Esta divisão não contém subdivisões"}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-teal-400/25 bg-teal-400/5 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-teal-300/90 transition-colors hover:bg-teal-400/10 hover:text-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-teal-400/5 disabled:hover:text-teal-300/90"
          >
            ◱ Sublocais
          </button>
          <Link
            href={`/location/${node.id}`}
            title={`Abrir ${node.name || "local"} em página própria`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
          >
            Abrir →
          </Link>
        </div>
      </div>
    </div>
  );
}

function CurrentMapStrip({ node, isDefault = false }: { node: Location; isDefault?: boolean }) {
  const hex = node.hex;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-teal-400/20 bg-teal-400/[0.04] px-4 py-3">
      <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shrink-0 shadow-[0_0_8px_rgba(94,234,212,0.6)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[12px] font-bold tracking-widest uppercase text-teal-100 truncate">{node.name}</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 hidden sm:inline">
            {KIND_LABELS[node.kind ?? "site"] ?? node.kind ?? "Local"} · {formatScale(hex?.sizeM)}
          </span>
          {isDefault ? (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 shrink-0">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Padrão
            </span>
          ) : null}
        </div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-600 mt-0.5 truncate">
          {node.region ?? node.subRegion ?? node.address ?? node.country ?? "—"}
        </div>
      </div>
      {(node.children?.length ?? 0) > 0 ? (
        <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 shrink-0">
          {(node.children?.length ?? 0)} {(node.children?.length ?? 0) !== 1 ? "divisões" : "divisão"}
        </span>
      ) : (
        <Link
          href={`/location/${node.id}`}
          className="font-mono text-[10px] tracking-widest uppercase text-teal-300/90 hover:text-teal-200 shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded-sm"
        >
          Abrir mapa →
        </Link>
      )}
    </div>
  );
}

export default function TableLocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableLocations | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const filtered = search
    ? flat.filter(({ node }) => {
        const q = search.toLowerCase();
        return (node.name ?? "").toLowerCase().includes(q)
          || (node.region ?? "").toLowerCase().includes(q)
          || (node.address ?? "").toLowerCase().includes(q);
      })
    : null;

  const zoom = (nodeId: string) => {
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

  const plates = active ? (active.node.children ?? []) : (data?.tree ?? []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-100">Locais</h1>
          <span className="text-sm text-zinc-500">{data?.table?.title ?? ""}</span>
        </div>
        <Link
          href={`/table/${id}/locations/new${active ? `?parent_id=${active.node.id}` : ""}`}
          className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          + Novo local
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-zinc-500">
        <span>{flat.length} {flat.length !== 1 ? "locais" : "local"} · {data?.tree?.length ?? 0} {(data?.tree?.length ?? 0) !== 1 ? "raízes de território" : "raiz de território"}</span>
      </div>

      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar o território…"
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-700/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60">
            Limpar
          </button>
        ) : null}
      </div>

      {!data ? (
        <div className="text-center py-16 text-zinc-600 text-sm">Carregando território…</div>
      ) : filtered !== null ? (
        filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">Nenhum local corresponde à sua pesquisa.</p>
          </div>
        ) : (
          <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-live="polite">
            {filtered.map(({ node, chain }) => (
              <Plate
                key={node.id}
                node={node}
                onZoom={zoom}
                onSetDefault={toggleDefault}
                trail={chain.slice(0, -1)}
                isDefault={defaultId === node.id}
                busy={settingDefault}
              />
            ))}
          </div>
        )
      ) : flat.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">Nenhum território mapeado ainda. Crie seu primeiro mundo.</p>
        </div>
      ) : !active && (data.tree?.length ?? 0) > 1 ? (
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-widest uppercase text-zinc-600">
            Vários mundos — abra um para levantar
          </p>
          <div ref={platesRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plates.map((node) => (
              <Plate key={node.id} node={node} onZoom={zoom} onSetDefault={toggleDefault} isDefault={defaultId === node.id} busy={settingDefault} />
            ))}
          </div>
        </div>
      ) : (
        <div ref={platesRef} className="space-y-4">
          {active ? <ZoomRuler chain={active.chain} onJump={zoom} /> : null}
          {active ? <CurrentMapStrip node={active.node} isDefault={defaultId === active.node.id} /> : null}
          {plates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">Nenhuma divisão dentro de {active?.node.name ?? "este território"} ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
{plates.map((node) => (
            <Plate key={node.id} node={node} onZoom={zoom} onSetDefault={toggleDefault} isDefault={defaultId === node.id} busy={settingDefault} />
          ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}