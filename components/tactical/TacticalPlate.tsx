"use client";

/* ============================================================
   TacticalPlate — a floor plan rendered as an axial hex grid.
   Same geometry as LocationMap/MapStudio (hexgrid + terrain),
   drawn onto a 2D <canvas> via lib/canvasgrid, plus the TOKEN
   layer: characters and npcs placed on hexes (q/r + facing), the
   movement trail of the last action and an optional interactive
   hex picker (used by the session MAP tab to log a move).
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { hexFromPoint } from "@/lib/hexgrid";
import {
  drawPlateBoard,
  drawPlateDrawing,
  drawPlateLinks,
  drawPlateTokens,
  drawPlateTrail,
  hitPlateLink,
  paintCanvas,
  plateCanvas,
  screenToGrid,
  type CanvasPlate,
  type CanvasToken,
  type GridSpec,
  type PlateLink,
} from "@/lib/canvasgrid";
import ZoomControls from "@/components/map/ZoomControls";
import { useTranslation } from "@/lib/i18n";
import type { BoardToken, BoardTrail } from "@/lib/board";
import type { Location } from "@/lib/types";

/* ---- avatar photo cache (module-level, survives re-renders) ---- */
const IMG_MISSING = Symbol("missing");
const imageCache = new Map<string, HTMLImageElement | symbol>();

function useTokenImages(tokens: CanvasToken[]): Map<string, HTMLImageElement | null> {
  const [version, setVersion] = useState(0);
  const urlKey = tokens
    .map((t) => t.imageUrl ?? "")
    .filter(Boolean)
    .join("\u0000");
  useEffect(() => {
    const list = urlKey ? urlKey.split("\u0000") : [];
    if (!list.length || typeof Image === "undefined") return;
    let cancelled = false;
    let pending = 0;
    for (const url of list) {
      if (imageCache.has(url)) continue;
      pending++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      const settle = (ok: boolean) => {
        imageCache.set(url, ok ? img : IMG_MISSING);
        if (!cancelled && --pending === 0) setVersion((v) => v + 1);
      };
      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [urlKey]);
  return useMemo(() => {
    const list = urlKey ? urlKey.split("\u0000") : [];
    const out = new Map<string, HTMLImageElement | null>();
    if (typeof HTMLImageElement === "undefined") {
      for (const url of list) out.set(url, null);
      return out;
    }
    for (const url of list) {
      const hit = imageCache.get(url);
      out.set(
        url,
        hit && hit !== IMG_MISSING && hit instanceof HTMLImageElement ? hit : null
      );
    }
    return out;
    // `version` is read below so the map is rebuilt when a photo finishes loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, version]);
}

export interface PlatePoint {
  q: number;
  r: number;
}

interface TacticalPlateProps {
  location: Location | null;
  tokens?: BoardToken[];
  trail?: BoardTrail | null;
  /** hex destacado (destino selecionado / origem pintada) */
  mark?: PlatePoint | null;
  /** passagens que começam neste mapa (badges clicáveis) */
  links?: PlateLink[];
  /** resposta a clique numa passagem — leva ao local vizinho */
  onLinkClick?: (linkId: string) => void;
  /** resposta a clique num hex (modo interativo) */
  onHexClick?: (q: number, r: number) => void;
  accent?: string;
  R?: number;
  M?: number;
  /** fill the parent's height instead of a fixed content box */
  fill?: boolean;
}

export default function TacticalPlate({
  location,
  tokens = [],
  trail = null,
  mark = null,
  links = [],
  onLinkClick,
  onHexClick,
  accent = "#38bdf8",
  R = 24,
  M = 12,
  fill = false,
}: TacticalPlateProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const lastZoomRef = useRef(1);
  const [hand, setHand] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [linkHoverId, setLinkHoverId] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);

  const toggleHand = () => setHand((h) => !h);

  /* Zoom anchored at the viewport centre — what is on screen stays under
     the centre as the scale changes (the canvas scales about its top-left,
     so the scroll position is re-derived to compensate). */
  function applyZoom(next: number) {
    const from = lastZoomRef.current;
    const clamped = Math.min(3.5, Math.max(0.5, next));
    lastZoomRef.current = clamped;
    setZoom(clamped);
    const s = scrollerRef.current;
    if (!s || clamped === from) return;
    const vw = s.clientWidth;
    const vh = s.clientHeight;
    const canvasLeft = vw > boxW ? (vw - boxW) / 2 : 0;
    const px = (s.scrollLeft + vw / 2 - canvasLeft) / from;
    const py = (s.scrollTop + vh / 2) / from;
    s.scrollLeft = px * clamped + canvasLeft - vw / 2;
    s.scrollTop = py * clamped - vh / 2;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (scrollerRef.current && t && !scrollerRef.current.contains(t)) return;
      setHand((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const plate: CanvasPlate = useMemo(
    () => plateCanvas({ width: location?.hex?.width, height: location?.hex?.height, orientation: location?.hex?.orientation }, R, M, 120, 100),
    [location?.hex?.width, location?.hex?.height, location?.hex?.orientation, R, M]
  );
  const spec: GridSpec = useMemo(
    () => ({ ...plate.spec, rotationDeg: location?.hex?.rotationDeg ?? 0 }),
    [plate, location?.hex?.rotationDeg]
  );
  const { W, H } = plate;

  /* Fixed, wider-than-tall canvas: the grid is letterbox-fitted into a
     stable box regardless of zoom — zoom only scales the content inside. */
  const boxW = Math.max(R * 40, 320);
  const boxH = Math.max(R * 25, 200);
  const fit = Math.min(boxW / W, boxH / H);
  const drawW = W * fit;
  const drawH = H * fit;
  const offX = (boxW - drawW) / 2;
  const offY = (boxH - drawH) / 2;
  const fitBox = useMemo(
    () => ({ scale: fit, dx: offX, dy: offY, boxW, boxH }),
    [fit, offX, offY, boxW, boxH]
  );

  const placed = useMemo(
    () => tokens.filter((t) => t.q != null && t.r != null && t.q! >= 0 && t.r! >= 0 && t.q! < spec.cols && t.r! < spec.rows),
    [tokens, spec]
  );
  const tokenImages = useTokenImages(placed);

  const linkLabelIds = useMemo(() => {
    const ids = new Set<string>();
    if (!links.length) return ids;
    if (links.length <= 3) for (const l of links) ids.add(l.id);
    if (linkHoverId) ids.add(linkHoverId);
    return ids;
  }, [links, linkHoverId]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paintCanvas(cv, W, H, (ctx) => {
      drawPlateBoard(ctx, W, H, spec, location?.tiles ?? [], { accent, mark });
      drawPlateDrawing(ctx, W, H, spec, location?.drawing ?? []);
      drawPlateLinks(ctx, W, H, spec, links, { labelIds: linkLabelIds });
      drawPlateTrail(ctx, W, H, spec, accent, trail?.moves ?? [], "tic", { tokens: placed });
      drawPlateTokens(ctx, W, H, spec, placed, { images: tokenImages, labelId: hoverId });
    }, zoom, fitBox);
  }, [location, placed, links, linkLabelIds, trail, mark, accent, W, H, spec, zoom, fitBox, tokenImages, hoverId]);

  function meshFromClient(clientX: number, clientY: number): { q: number; r: number } | null {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const contentRect = {
      left: rect.left + offX * zoom,
      top: rect.top + offY * zoom,
      width: drawW * zoom,
      height: drawH * zoom,
    };
    const p = screenToGrid(clientX, clientY, contentRect, W, H, spec);
    const cell = hexFromPoint(p.x, p.y, spec.orientation, spec.R);
    if (cell.q >= 0 && cell.q < spec.cols && cell.r >= 0 && cell.r < spec.rows) return cell;
    return null;
  }

  /** Mesh-space point (px, no offset) for a client coordinate. */
  function meshPointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const contentRect = {
      left: rect.left + offX * zoom,
      top: rect.top + offY * zoom,
      width: drawW * zoom,
      height: drawH * zoom,
    };
    return screenToGrid(clientX, clientY, contentRect, W, H, spec);
  }

  function handleClick(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (hand) return;
    if (onLinkClick && links.length) {
      const p = meshPointFromClient(e.clientX, e.clientY);
      if (p) {
        const hit = hitPlateLink(links, p, spec);
        if (hit) {
          onLinkClick(hit);
          return;
        }
      }
    }
    if (!onHexClick) return;
    const cell = meshFromClient(e.clientX, e.clientY);
    if (cell) onHexClick(cell.q, cell.r);
  }

  function handleHover(e: React.PointerEvent<HTMLCanvasElement>) {
    const cell = meshFromClient(e.clientX, e.clientY);
    const token = cell ? placed.find((t) => t.q === cell.q && t.r === cell.r) ?? null : null;
    setHoverId(token ? token.id : null);
    if (links.length) {
      const p = meshPointFromClient(e.clientX, e.clientY);
      setLinkHoverId(p ? hitPlateLink(links, p, spec) : null);
    } else {
      setLinkHoverId(null);
    }
  }

  function onPanDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!hand) return;
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPanMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = scrollerRef.current;
    const d = dragRef.current;
    if (!s || !d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    s.scrollLeft -= dx;
    s.scrollTop -= dy;
    d.x = e.clientX;
    d.y = e.clientY;
  }

  function onPanUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className={`relative rounded-lg border border-zinc-700/40 bg-zinc-950/60 overflow-hidden ${fill ? "h-full" : ""}`}>
      <div
        ref={scrollerRef}
        className={`relative overflow-auto select-none ${fill ? "h-full" : ""}`}
        style={{
          cursor: hand ? (dragging ? "grabbing" : "grab") : onHexClick || (onLinkClick && linkHoverId) ? "pointer" : undefined,
          touchAction: hand ? "none" : undefined,
        }}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
        onPointerLeave={() => setHoverId(null)}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block mx-auto"
          role="img"
          aria-label={t("vs.tp.floorPlan")}
          style={{
            width: `${Math.round(boxW)}px`,
            height: `${Math.round(boxH)}px`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
          onClick={handleClick}
          onPointerMove={handleHover}
        />
      </div>
      <ZoomControls zoom={zoom} onZoom={applyZoom} hand={hand} onToggleHand={toggleHand} />
    </div>
  );
}