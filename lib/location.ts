import type { Location } from "./types";

export const LOCATION_KINDS: Array<{ value: string; label: string; desc: string }> = [
  { value: "world", label: "Mundo", desc: "O globo — escala macro (continentes)" },
  { value: "continent", label: "Continente", desc: "Uma massa de terra" },
  { value: "nation", label: "Nação", desc: "Um estado soberano" },
  { value: "region", label: "Região", desc: "Grande área geográfica" },
  { value: "biome", label: "Bioma", desc: "Faixa de clima / habitat" },
  { value: "province", label: "Província", desc: "Divisão administrativa" },
  { value: "city", label: "Cidade", desc: "Um assentamento" },
  { value: "district", label: "Distrito", desc: "Um bairro da cidade" },
  { value: "locale", label: "Localidade", desc: "Ponto de referência nomeado" },
  { value: "site", label: "Local", desc: "Cenário de cena / aventura" },
  { value: "battlemap", label: "Mapa de Batalha", desc: "Grid tático (hex ≲ 2 m)" },
  { value: "point", label: "Ponto", desc: "Marcador / coordenada única" },
];

export function formatHexScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km/hex`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m/hex`;
}

export interface HexGridInput {
  sizeM?: number | null;
  width?: number | null;
  height?: number | null;
  centerQ?: number;
  centerR?: number;
  orientation?: string;
  rotationDeg?: number;
}

export interface HexNodeInput {
  id?: string | null;
  name?: string | null;
  hex?: HexGridInput | null;
  ancestors?: HexNodeInput[] | null;
}

export interface AbsoluteHex {
  q: number;
  r: number;
  sizeM: number | null;
  orientation?: string | null;
  rotationDeg?: number;
  chain: Array<{ id?: string | null; name?: string | null; q: number; r: number; sizeM: number | null }>;
}

/**
 * Reduce the ancestry chain into ONE axial coordinate expressed in the
 * *deepest* hex scale (the location's own grid). Each ancestor's center is
 * re-scaled by `sizeM value / own hex size`, so a child at q:2 on a 500 m
 * grid lands correctly inside the world whose hexes are 1 m. This is the
 * seam the future map engine uses to plot any node on its battle grid.
 */
export function absoluteHex(location: HexNodeInput): AbsoluteHex {
  const chain = [...(location.ancestors ?? []), location];
  const selfM = location.hex?.sizeM ?? null;

  let q = 0;
  let r = 0;
  const steps: AbsoluteHex["chain"] = [];
  for (const node of chain) {
    const cq = node.hex?.centerQ ?? 0;
    const cr = node.hex?.centerR ?? 0;
    const m = node.hex?.sizeM ?? null;
    const factor = selfM && m ? m / selfM : 1;
    q += cq * factor;
    r += cr * factor;
    steps.push({ id: node.id, name: node.name, q: cq, r: cr, sizeM: m });
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    q: round(q),
    r: round(r),
    sizeM: selfM,
    orientation: location.hex?.orientation ?? null,
    rotationDeg: location.hex?.rotationDeg ?? 0,
    chain: steps,
  };
}

/**
 * Floor-plan group of a location — the maps that belong to the SAME
 * place, like the floors of one house. A map qualifies when it is
 * itself a container with subdivisions (the building) or a subdivision
 * sharing a host (a floor). Returns [] — and therefore hides the map
 * switcher — when the location has no such configuration.
 */
export function floorPlanGroup(loc: Location | null | undefined, all: Location[]): Location[] {
  if (!loc) return [];
  const host = loc.parentId ?? loc.id;
  const group = all.filter((l) => l.id === host || l.parentId === host);
  return group.length > 1 ? group : [];
}