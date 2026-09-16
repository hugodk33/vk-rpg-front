import type { HexTileKind } from "./types";

export interface TerrainMeta {
  label: string;
  fill: string;
  stroke: string;
  glyph?: string;
}

export const TERRAIN: Record<HexTileKind, TerrainMeta> = {
  open: { label: "Open", fill: "#13161f", stroke: "#333846" },
  grass: { label: "Grass", fill: "#17351f", stroke: "#2f5c3f" },
  water: { label: "Water", fill: "#0b2a47", stroke: "#245c8a" },
  forest: { label: "Forest", fill: "#142c1a", stroke: "#3d6b40" },
  stone: { label: "Stone", fill: "#373430", stroke: "#5c5347" },
  wall: { label: "Wall", fill: "#41444c", stroke: "#71767e" },
  door: { label: "Door", fill: "#57451e", stroke: "#9a7d2f", glyph: "D" },
  rubble: { label: "Rubble", fill: "#453129", stroke: "#7a4d3a" },
};