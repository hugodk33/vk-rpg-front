"use client";

/* ============================================================
   LocationOrganogram — modo de visualização que desenha as
   PASSAGENS que interligam as áreas abaixo de uma localidade,
   como um organograma. A localidade é a raiz; as subdivisões
   descem em níveis; cada passagem vira uma aresta colorida pelo
   tipo, rotulada com o ponto cardeal de saída. Áreas de fora da
   árvore aparecem como caixas tracejadas — é onde um organograma
   "sai" para outro.
   ============================================================ */

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Location, LocationConnection } from "@/lib/types";

const KIND_COLOR: Record<string, string> = {
  door: "#f59e0b",
  stairs: "#38bdf8",
  trapdoor: "#a78bfa",
  portal: "#34d399",
  bridge: "#94a3b8",
  elevator: "#2dd4bf",
  secret: "#fb7185",
};

const X_GAP = 210;
const Y_GAP = 150;
const PAD = 90;
const BOX_W = 140;
const BOX_H = 46;

interface Positioned {
  id: string;
  name: string;
  x: number;
  y: number;
  external: boolean;
}

function buildChildren(ids: Set<string>, all: Location[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const loc of all) {
    if (!ids.has(loc.id)) continue;
    const parent = loc.parentId && ids.has(loc.parentId) ? loc.parentId : null;
    if (!parent) continue;
    const list = children.get(parent) ?? [];
    list.push(loc.id);
    children.set(parent, list);
  }
  return children;
}

export default function LocationOrganogram({
  root,
  locations,
  connections,
}: {
  root: Location;
  locations: Location[];
  connections: LocationConnection[];
}) {
  const { t } = useTranslation();

  const model = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l]));
    byId.set(root.id, root);

    /* subárvore enraizada no local */
    const subtreeIds = new Set<string>();
    const stack = [root.id];
    while (stack.length) {
      const id = stack.pop() as string;
      if (subtreeIds.has(id)) continue;
      subtreeIds.add(id);
      for (const loc of locations) {
        if (loc.parentId === id) stack.push(loc.id);
      }
    }

    /* passagens que tocam a subárvore */
    const edges = connections.filter(
      (c) => subtreeIds.has(c.from?.id ?? "") || subtreeIds.has(c.to?.id ?? "")
    );

    /* nós externos que aparecem nessas passagens */
    const externalIds = new Set<string>();
    for (const c of edges) {
      for (const end of [c.from?.id, c.to?.id]) {
        if (end && !subtreeIds.has(end)) externalIds.add(end);
      }
    }

    /* layout em árvore (leaves espaçadas; pais centralizados) */
    const children = buildChildren(subtreeIds, locations);
    const pos = new Map<string, { x: number; y: number }>();
    let leaf = 0;
    const dfs = (id: string, depth: number): number => {
      const kids = children.get(id) ?? [];
      let x: number;
      if (!kids.length) {
        x = leaf * X_GAP;
        leaf += 1;
      } else {
        const xs = kids.map((k) => dfs(k, depth + 1));
        x = (Math.min(...xs) + Math.max(...xs)) / 2;
      }
      pos.set(id, { x: PAD + x, y: PAD + depth * Y_GAP });
      return x;
    };
    dfs(root.id, 0);

    const treeRight = pos.size
      ? Math.max(...Array.from(pos.values()).map((p) => p.x))
      : PAD;

    /* nós externos: coluna tracejada à direita */
    const nodes: Positioned[] = [];
    for (const id of subtreeIds) {
      const p = pos.get(id);
      if (!p) continue;
      nodes.push({ id, name: byId.get(id)?.name ?? id.slice(0, 8), x: p.x, y: p.y, external: false });
    }
    let ei = 0;
    for (const id of externalIds) {
      const p = pos.get(root.id) ?? { x: PAD, y: PAD };
      nodes.push({
        id,
        name: byId.get(id)?.name ?? id.slice(0, 8),
        x: treeRight + X_GAP,
        y: p.y + ei * Y_GAP,
        external: true,
      });
      ei += 1;
    }

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const width = Math.max(...nodes.map((n) => n.x), treeRight) + PAD + X_GAP;
    const height = Math.max(...nodes.map((n) => n.y), PAD) + PAD;

    return { nodes, nodeById, edges, width, height };
  }, [root, locations, connections]);

  if (model.edges.length === 0) {
    return <p className="text-sm text-zinc-600 italic">{t("lc.org.empty")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {t("lc.org.title")}
          </h3>
          <p className="text-[11px] text-zinc-600 mt-0.5">{t("lc.org.subtitle")}</p>
        </div>
        <ul className="flex items-center gap-3 flex-wrap">
          {Array.from(new Set(model.edges.map((e) => e.kind ?? "door"))).map((kind) => (
            <li key={kind} className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[kind] ?? "#94a3b8" }} />
              {t(`lc.conn.kind.${kind}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-700/50 bg-zinc-950/60 p-4">
        <svg width={model.width} height={model.height} className="block">
          <defs>
            {Array.from(new Set(model.edges.map((e) => e.kind ?? "door"))).map((kind) => (
              <marker
                key={kind}
                id={`org-arrow-${kind}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={KIND_COLOR[kind] ?? "#94a3b8"} />
              </marker>
            ))}
          </defs>

          {/* arestas */}
          {model.edges.map((c) => {
            const a = c.from?.id ? model.nodeById.get(c.from.id) : undefined;
            const b = c.to?.id ? model.nodeById.get(c.to.id) : undefined;
            if (!a || !b) return null;
            const color = KIND_COLOR[c.kind ?? "door"] ?? "#94a3b8";
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const my2 = (a.y + b.y) / 2 - Math.min(60, Math.abs(a.x - b.x) / 3);
            const dir = c.direction
              ? t(`lc.conn.dir.${c.direction}`)
              : "";
            return (
              <g key={c.id}>
                <path
                  d={`M ${a.x} ${a.y} Q ${mx} ${my2} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  markerEnd={c.bidirectional ? undefined : `url(#org-arrow-${c.kind ?? "door"})`}
                />
                <g transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-46}
                    y={-11}
                    width={92}
                    height={22}
                    rx={11}
                    fill="#18181b"
                    stroke={color}
                    strokeOpacity={0.6}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    className="fill-zinc-300"
                    style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                  >
                    {dir ? `${dir} · ` : ""}
                    {t(`lc.conn.kind.${c.kind ?? "door"}`)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* nós */}
          {model.nodes.map((n) => {
            const isRoot = n.id === root.id;
            return (
              <g key={n.id} transform={`translate(${n.x - BOX_W / 2}, ${n.y - BOX_H / 2})`}>
                <rect
                  width={BOX_W}
                  height={BOX_H}
                  rx={10}
                  fill={n.external ? "#1c1917" : "#18181b"}
                  stroke={n.external ? "#a8a29e" : isRoot ? "#4ade80" : "#52525b"}
                  strokeWidth={isRoot ? 2 : 1.5}
                  strokeDasharray={n.external ? "5 4" : undefined}
                />
                <text
                  x={BOX_W / 2}
                  y={BOX_H / 2 + 4}
                  textAnchor="middle"
                  style={{ fontSize: 12, fontFamily: "ui-sans-serif, system-ui" }}
                  className={isRoot ? "fill-green-200 font-semibold" : "fill-zinc-300"}
                >
                  {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {model.nodes.some((n) => n.external) ? (
        <p className="text-[11px] text-zinc-600 flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded border border-dashed border-stone-400" />
          {t("lc.org.external")}
        </p>
      ) : null}
    </div>
  );
}
