"use client";

/* ============================================================
   MapStudio — the drawing studio for a location.

   The canvas is a plain SHEET, not a hex grid: a centered
   rectangle whose size comes from the Largura × Altura chosen
   below (like a blank sheet of paper). The sheet is the base of
   the map; everything is drawn on top of it.

   1. DRAWING — vector strokes: pen (freehand), line, rect and
                ellipse, in a chosen color/weight. Shapes are
                stored NORMALIZED (unit:"hexR"; 1 unit = 1 hex
                radius, origin = center of cell (0,0)) and the
                sheet spans that frame, so old strokes stay put.
                Legacy pixel shapes (authored at R = 24) convert
                on load.
   2. SELECT  — click a stroke to select it, drag to move,
                Delete/Backspace removes it.
   3. SPLIT   — click a stroke/line to cut it into two.
   4. ZOOM    — the toolbar owns the hand (pan) tool and the zoom
                stepper; zoom is a pure CSS transform over a sized
                spacer so the backing pixel grid stays crisp.

   Saving posts a PARTIAL update to PUT /api/table-location/:id —
   only the sheet size, indoor flag and the stroke layer. The tile
   layer and the hex metadata are left untouched.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "@/components/forms/submit";
import { gridFrame } from "@/lib/hexgrid";
import { useTranslation } from "@/lib/i18n";
import {
  drawShapes,
  hitDrawShapes,
  normalizeShapeToHexR,
  paintCanvas,
  screenToGrid,
  shiftShape,
  splitShape,
  toNormalized,
  withRotated,
  type GridSpec,
  type Point,
} from "@/lib/canvasgrid";
import { Hand, Maximize, Minus, Plus } from "lucide-react";
import { useImageCache } from "@/lib/imagecache";
import { uploadImage } from "@/lib/api";
import { prepareUpload } from "@/lib/upload";
import type { DrawShape, Location } from "@/lib/types";

const R = 30;
const M = 48;

const STROKES = ["#e4e4e7", "#38bdf8", "#fbbf24", "#f87171", "#4ade80", "#a78bfa"];
const STROKE_WEIGHTS = [1, 1.6, 2.5, 4, 6];

/* Zoom limits shared by the toolbar buttons and the wheel handler. */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

type Tool = "select" | "pen" | "line" | "rect" | "ellipse" | "split" | "image";
type ShapeType = "path" | "rect" | "ellipse" | "line";

interface MapStudioProps {
  location: Location;
}

export default function MapStudio({ location }: MapStudioProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const h = location.hex;

  const [cols, setCols] = useState(Math.max(1, Math.floor(h?.width ?? 12)));
  const [rows, setRows] = useState(Math.max(1, Math.floor(h?.height ?? 9)));
  const [orientation] = useState<string>(h?.orientation ?? "flat");
  const [rotationDeg, setRotationDeg] = useState<number>(h?.rotationDeg ?? 0);
  const [isIndoor, setIsIndoor] = useState(!!location.isIndoor);

  const [tool, setTool] = useState<Tool>("select");
  const [strokeColor, setStrokeColor] = useState(STROKES[0]);
  const [strokeWeight, setStrokeWeight] = useState(STROKE_WEIGHTS[2]);
  const [zoom, setZoom] = useState(1);
  const [hand, setHand] = useState(false);

  const [shapes, setShapes] = useState<DrawShape[]>(() => (location.drawing ?? []).map(normalizeShapeToHexR));
  const [draft, setDraft] = useState<DrawShape | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [hoverShape, setHoverShape] = useState<number | null>(null);

  const [savedAt, setSavedAt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [grab, setGrab] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const dragRef = useRef<{ index: number; anchor: Point; grab: Point } | null>(null);
  const snapRef = useRef<DrawShape[] | null>(null);
  const zoomRef = useRef(zoom);
  const spaceRef = useRef(false);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  /* The sheet is the frame the strokes were authored against: a rectangle
     covering the cols×rows mesh. Drawing it (instead of the cells) keeps the
     old normalized strokes aligned while reading as a blank sheet. */
  const g = gridFrame(cols, rows, orientation, R);
  const W = g.w + M * 2;
  const H = g.h + M * 2;
  const offX = M - g.x0;
  const offY = M - g.y0;

  const spec: GridSpec = useMemo(
    () => ({ cols, rows, orientation, R, M, rotationDeg, ox: g.x0, oy: g.y0 }),
    [cols, rows, orientation, rotationDeg, g]
  );

  /* Decoded <img> elements for every image shape on the sheet. */
  const imageMap = useImageCache(shapes.filter((s) => s.type === "image").map((s) => s.src ?? null));

  /* ---------- helpers ---------- */

  const toGridPoint = useCallback(
    (e: React.PointerEvent): Point => {
      const cv = canvasRef.current;
      if (!cv) return { x: 0, y: 0 };
      const rect = cv.getBoundingClientRect();
      return screenToGrid(e.clientX, e.clientY, rect, W, H, spec);
    },
    [W, H, spec]
  );

  const takeSnapshot = useCallback(() => {
    snapRef.current = shapes;
    setCanUndo(true);
  }, [shapes]);

  /* ---------- pointer handlers ---------- */

  function onPointerDown(e: React.PointerEvent) {
    if (e.button === 1 || e.button === 0 && (spaceRef.current || hand)) {
      e.preventDefault();
      const wrap = wrapRef.current;
      if (wrap) {
        panRef.current = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
        canvasRef.current?.setPointerCapture(e.pointerId);
        setGrab(true);
      }
      return;
    }

    const p = toGridPoint(e);
    const n = toNormalized(p, R);
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    originRef.current = n;

    if (tool === "split") {
      const idx = hitDrawShapes(shapes, n, 1, 8 / R);
      if (idx != null) {
        const parts = splitShape(shapes[idx], n, 8 / R);
        if (parts) {
          takeSnapshot();
          setShapes((prev) => {
            const next = prev.slice();
            next.splice(idx, 1, parts[0], parts[1]);
            return next;
          });
          setHoverShape(null);
          setSelection(null);
        }
      }
      return;
    }

    if (tool === "select") {
      const idx = hitDrawShapes(shapes, n, 1, 6 / R);
      if (idx != null) {
        takeSnapshot();
        const target = shapes[idx];
        const anchor =
          target.type === "path"
            ? shapeAnchor(shapes, idx, n)
            : {
                x: target.type === "ellipse" ? target.cx ?? 0 : target.x ?? 0,
                y: target.type === "ellipse" ? target.cy ?? 0 : target.y ?? 0,
              };
        dragRef.current = { index: idx, anchor, grab: { x: n.x - anchor.x, y: n.y - anchor.y } };
        setSelection(idx);
      } else {
        dragRef.current = null;
        setSelection(null);
      }
      return;
    }

    if (tool === "image") {
      setSelection(null);
      return;
    }

    takeSnapshot();
    if (tool === "pen") {
      setDraft({ type: "path", d: `M ${n.x.toFixed(3)} ${n.y.toFixed(3)}`, size: strokeWeight, color: strokeColor, unit: "hexR" });
    } else {
      setDraft({ type: tool as ShapeType, x: n.x, y: n.y, w: 0, h: 0, size: strokeWeight, color: strokeColor, unit: "hexR" });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const wrap = wrapRef.current;
      if (wrap) {
        const d = panRef.current;
        wrap.scrollLeft = Math.max(0, d.sl - (e.clientX - d.x));
        wrap.scrollTop = Math.max(0, d.st - (e.clientY - d.y));
      }
      return;
    }

    const p = toGridPoint(e);

    if (drawingRef.current && dragRef.current && tool === "select") {
      const n = toNormalized(p, R);
      const d = dragRef.current;
      const anchor = { x: n.x - d.grab.x, y: n.y - d.grab.y };
      const dx = anchor.x - d.anchor.x;
      const dy = anchor.y - d.anchor.y;
      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
        setShapes((prev) => {
          const next = prev.slice();
          const idx = d.index;
          if (idx >= 0 && idx < next.length) next[idx] = shiftShape(next[idx], dx, dy);
          return next;
        });
      }
      return;
    }

    if (drawingRef.current && draft) {
      const o = originRef.current;
      if (draft.type === "path") {
        const n = toNormalized(p, R);
        setDraft({ ...draft, d: `${draft.d ?? ""} L ${n.x.toFixed(3)} ${n.y.toFixed(3)}` });
      } else {
        const s = toNormalized(p, R);
        const x = Math.min(o.x, s.x);
        const y = Math.min(o.y, s.y);
        const w = Math.abs(s.x - o.x);
        const h = Math.abs(s.y - o.y);
        setDraft({
          ...draft,
          x,
          y,
          w,
          h,
          cx: (o.x + s.x) / 2,
          cy: (o.y + s.y) / 2,
          rx: w / 2,
          ry: h / 2,
        });
      }
      return;
    }

    if (tool === "split") setHoverShape(hitDrawShapes(shapes, toNormalized(p, R), 1, 8 / R));
  }

  function onPointerUp() {
    if (panRef.current) {
      panRef.current = null;
      setGrab(spaceRef.current);
      return;
    }
    drawingRef.current = false;
    dragRef.current = null;
    if (draft) {
      setShapes((prev) => [...prev, draft]);
      setSelection(shapes.length);
      setDraft(null);
    }
  }

  function onPointerLeave() {
    if (panRef.current) return;
    setHoverShape(null);
  }

  /* ---------- keyboard shortcuts (delete selection) ---------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (spaceRef.current) return;
        setHand((prev) => !prev);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        spaceRef.current = true;
        setGrab(true);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection != null) {
        e.preventDefault();
        setShapes((prev) => prev.filter((_, i) => i !== selection));
        setSelection(null);
      } else if (e.key === "Escape") {
        setSelection(null);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceRef.current = false;
        setGrab(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selection, hand]);

  /* ---------- zoom + pan ---------- */

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const cv = canvasRef.current;
      const wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const zold = zoomRef.current;
      const delta = e.deltaY;
      const step = e.deltaMode === 1 ? 0.2 : e.deltaMode === 2 ? 2 : 0.1;
      const znew = clampZoom(zold + (delta < 0 ? step : -step));
      const ratio = znew / zold;
      if (ratio === 1) return;

      const rect = cv.getBoundingClientRect();
      const ccx = (e.clientX - rect.left) / zold;
      const ccy = (e.clientY - rect.top) / zold;

      zoomRef.current = znew;
      setZoom(znew);

      /* keep the point under the cursor fixed once the spacer reflows */
      requestAnimationFrame(() => {
        const w = wrapRef.current;
        if (!w) return;
        const wr = w.getBoundingClientRect();
        w.scrollLeft = Math.max(0, ccx * znew - (e.clientX - wr.left));
        w.scrollTop = Math.max(0, ccy * znew - (e.clientY - wr.top));
      });
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------- actions ---------- */

  /* Shrink the zoom so the whole sheet fits the viewport, then centre it. */
  function fitToView() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = Math.min((wrap.clientWidth - 32) / W, (wrap.clientHeight - 32) / H);
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
    zoomRef.current = z;
    setZoom(z);
    requestAnimationFrame(() => {
      const w = wrapRef.current;
      if (!w) return;
      w.scrollLeft = Math.max(0, (w.scrollWidth - w.clientWidth) / 2);
      w.scrollTop = Math.max(0, (w.scrollHeight - w.clientHeight) / 2);
    });
  }

  function undo() {
    if (!snapRef.current) return;
    setShapes(snapRef.current);
    snapRef.current = null;
    setCanUndo(false);
    setSelection(null);
  }

  function updateSelected(patch: Partial<DrawShape>) {
    setShapes((prev) => {
      const next = prev.slice();
      if (selection != null && next[selection]) next[selection] = { ...next[selection], ...patch };
      return next;
    });
  }

  function clearStrokes() {
    takeSnapshot();
    setShapes([]);
    setSelection(null);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgBusy(true);
    setError(null);
    try {
      const dataUrl = await prepareUpload(file, 1600);
      const url = await uploadImage(dataUrl, "maps");
      takeSnapshot();
      const side = 6;
      const cx = (g.x0 + g.w / 2) / R;
      const cy = (g.y0 + g.h / 2) / R;
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const shape: DrawShape = {
        type: "image",
        src: url,
        x: r3(cx - side / 2),
        y: r3(cy - side / 2),
        w: side,
        h: side,
        size: strokeWeight,
        color: strokeColor,
        unit: "hexR",
        rotationDeg: 0,
      };
      setShapes((prev) => [...prev, shape]);
      setSelection(shapes.length);
      setTool("select");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("lc.ms.error"));
    } finally {
      setImgBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await submitJson(`/api/table-location/${location.id}`, "PUT", {
        id: location.id,
        hex: { width: cols, height: rows, rotationDeg },
        is_indoor: isIndoor ? 1 : 0,
        drawing: shapes,
      });
      setSavedAt(Date.now());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("lc.ms.error"));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- canvas render ---------- */

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paintCanvas(cv, W, H, (ctx) => {
      /* desk backdrop so the sheet reads as a page on a table */
      ctx.fillStyle = "#08090d";
      ctx.fillRect(0, 0, W, H);

      withRotated(ctx, W, H, rotationDeg, () => {
        ctx.save();
        ctx.translate(offX, offY);

        /* the sheet (paper) — base of the map */
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = "#1b202a";
        ctx.beginPath();
        ctx.rect(g.x0, g.y0, g.w, g.h);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#454f63";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(g.x0, g.y0, g.w, g.h);
        /* faint inner margin */
        ctx.strokeStyle = "#2a3140";
        ctx.lineWidth = 1;
        ctx.setLineDash([7, 7]);
        ctx.strokeRect(g.x0 + 18, g.y0 + 18, g.w - 36, g.h - 36);
        ctx.setLineDash([]);

        /* strokes + draft + selection */
        const accent = tool === "split" ? "#f472b6" : "#38bdf8";
        drawShapes(ctx, shapes, R, tool === "split" ? hoverShape : selection, accent, imageMap);
        if (draft) drawShapes(ctx, [draft], R, null, "#38bdf8", imageMap);

        ctx.restore();
      });
    }, zoom);
  }, [shapes, draft, selection, hoverShape, tool, strokeColor, rotationDeg, W, H, g, offX, offY, zoom, imageMap]);

  /* ---------- derived UI ---------- */

  const activeShape = selection != null && shapes[selection] ? shapes[selection] : null;

  const toolBtn = (id: Tool, icon: string, labelKey: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTool(id)}
      aria-pressed={tool === id}
      className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors ${
        tool === id ? "border-green-500/70 bg-green-500/10 text-green-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="font-mono text-[8px] uppercase tracking-widest">{t(labelKey)}</span>
    </button>
  );

  return (
    <section className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="font-mono text-base leading-none text-green-300">◉</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("lc.ms.title")}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 hidden sm:inline">
            {cols}×{rows}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt > 0 ? (
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400">{t("lc.ms.saved")}</span>
          ) : null}
          <button type="button" onClick={undo} disabled={!canUndo} className="font-mono text-[9px] uppercase tracking-widest px-2 py-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40">
            {t("lc.ms.undo")}
          </button>
          <button type="button" onClick={clearStrokes} className="font-mono text-[9px] uppercase tracking-widest px-2 py-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-red-300 transition-colors">
            {t("lc.ms.clearStrokes")}
          </button>
          <button type="button" onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-green-50 text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
            {saving ? t("lc.common.saving") : t("lc.ms.save")}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        {/* control rail — a full-width band on top, canvas below. */}
        <div className="flex flex-wrap items-start gap-x-8 gap-y-5 border-b border-zinc-800 p-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.tool")}</p>
            <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-600 mb-1">{t("lc.ms.groupPick")}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {toolBtn("select", "⬚", "lc.ms.toolSelect")}
                </div>
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-600 mb-1">{t("lc.ms.groupShapes")}</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {toolBtn("pen", "✎", "lc.ms.toolPen")}
                  {toolBtn("line", "╱", "lc.ms.toolLine")}
                  {toolBtn("rect", "▭", "lc.ms.toolRect")}
                  {toolBtn("ellipse", "◯", "lc.ms.toolEllipse")}
                  {toolBtn("split", "✂", "lc.ms.toolSplit")}
                  {toolBtn("image", "🖼", "lc.ms.toolImage")}
                </div>
              </div>
            </div>
          </div>

          {tool === "select" ? (
            <div className="min-w-[196px]">
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.selection")}</p>
              <div className="space-y-2">
                <p className="text-[10px] leading-snug text-zinc-500">
                  {activeShape ? (
                    <>
                      <b className="text-zinc-300">{activeShape.type}</b> {t("lc.ms.selDrag")},{" "}
                      <b className="text-red-300">Del</b> {t("lc.ms.selRemove")}.
                    </>
                  ) : (
                    t("lc.ms.selectHint")
                  )}
                </p>

                {activeShape ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const i = STROKES.indexOf(activeShape.color);
                        updateSelected({ color: STROKES[(i + 1) % STROKES.length] });
                      }}
                      className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      {t("lc.ms.recolor")}
                    </button>
                    {activeShape.type === "image" ? (
                      <button
                        type="button"
                        onClick={() => updateSelected({ rotationDeg: ((activeShape.rotationDeg ?? 0) + 90) % 360 })}
                        className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        {t("lc.ms.rotate")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse" ? (
            <div className="min-w-[196px] space-y-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.stroke")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {STROKES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStrokeColor(c)}
                      className={`h-6 w-6 rounded-full border transition-transform ${strokeColor === c ? "scale-110 border-zinc-200" : "border-zinc-700"}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.weight")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {STROKE_WEIGHTS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStrokeWeight(w)}
                      className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                        strokeWeight === w ? "border-green-500/70 bg-green-500/10" : "border-zinc-700/40 hover:border-zinc-600"
                      }`}
                      title={`${w}px`}
                    >
                      <span className="block rounded-full" style={{ width: Math.max(2, w), height: Math.max(2, w), backgroundColor: strokeColor }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tool === "split" ? (
            <div className="min-w-[196px]">
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.splitHint")}</p>
            </div>
          ) : null}

          {tool === "image" ? (
            <div className="min-w-[196px] space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{t("lc.ms.imageHint")}</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imgBusy}
                className="w-full rounded-md border border-green-500/60 bg-green-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
              >
                {imgBusy ? t("lc.common.saving") : t("lc.ms.imageAdd")}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
          ) : null}

          <div className="min-w-[196px]">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.indoorGroup")}</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsIndoor(false)}
                className={`rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${!isIndoor ? "border-green-500/70 bg-green-500/10 text-green-300" : "border-zinc-700/40 text-zinc-500"}`}
              >
                {t("lc.ms.exterior")}
              </button>
              <button
                type="button"
                onClick={() => setIsIndoor(true)}
                className={`rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${isIndoor ? "border-green-500/70 bg-green-500/10 text-green-300" : "border-zinc-700/40 text-zinc-500"}`}
              >
                {t("lc.ms.indoor")}
              </button>
            </div>
            {isIndoor ? (
              <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">{t("lc.ms.indoorHint")}</p>
            ) : null}
          </div>
        </div>

        {/* canvas */}
        <div className="p-4">
          <div className="relative overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-950/50">
            <div ref={wrapRef} className="relative overflow-auto scroll-thin" style={{ height: "min(76vh, 640px)" }}>
              <div className="flex min-w-full min-h-full">
                <div className="relative m-auto" style={{ width: `${Math.round(W * zoom)}px`, height: `${Math.round(H * zoom)}px` }}>
                  <canvas
                    ref={canvasRef}
                    width={W}
                    height={H}
                    className={`block touch-none select-none ${hand ? (grab ? "cursor-grabbing" : "cursor-grab") : grab ? "cursor-grabbing" : "cursor-crosshair"}`}
                    style={{
                      width: `${W}px`,
                      height: `${H}px`,
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerLeave}
                    onPointerCancel={onPointerUp}
                    role="img"
                    aria-label={t("lc.ms.canvasAria")}
                  />
                </div>
              </div>
            </div>

            {/* floating view controls — anchored to the wrapper, so they never scroll with the map */}
            <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setHand((v) => !v)}
                aria-pressed={hand}
                title={`${t("lc.zoom.hand")} (H)`}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur transition-colors ${
                  hand ? "border-sky-500/60 bg-sky-500/15 text-sky-300" : "border-zinc-700/60 bg-zinc-900/80 text-zinc-300 hover:text-white"
                }`}
              >
                <Hand className="w-4 h-4" strokeWidth={2.25} />
              </button>
              <span className="max-w-[132px] font-mono text-[8px] uppercase tracking-widest text-zinc-600 leading-snug">{t("lc.ms.navHint")}</span>
            </div>

            <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900/80 backdrop-blur p-1">
              <button
                type="button"
                onClick={fitToView}
                title={t("lc.zoom.fit")}
                aria-label={t("lc.zoom.fit")}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Maximize className="w-4 h-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((v) => clampZoom(v + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                title={t("lc.zoom.in")}
                aria-label={t("lc.zoom.in")}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Plus className="w-4 h-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
                title={t("lc.zoom.resetTitle")}
                className="h-8 w-8 rounded-md font-mono text-[10px] tabular-nums text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((v) => clampZoom(v - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                title={t("lc.zoom.out")}
                aria-label={t("lc.zoom.out")}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Minus className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </div>

            {error ? <p className="absolute inset-x-0 top-0 bg-red-950/90 text-red-200 text-xs px-3 py-2">{error}</p> : null}
          </div>

          {/* status bar */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span>
              {t("lc.ms.strokes")} <b className="text-zinc-300">{shapes.length}</b>
            </span>
            <span>
              {t("lc.ms.chain")} <b className="text-zinc-400 truncate max-w-[16rem] inline-block align-top">
                {(location.ancestors ?? []).map((a) => a.name).join(" › ") || "—"}
              </b>
            </span>
          </div>

          {/* sheet sizing — below the canvas */}
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">{t("lc.ms.sheet")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl">
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5 block">{t("lc.ms.width")}</span>
                <input type="number" min={1} value={cols} onChange={(e) => setCols(Math.max(1, Math.floor(Number(e.target.value)) || 1))} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5 block">{t("lc.ms.height")}</span>
                <input type="number" min={1} value={rows} onChange={(e) => setRows(Math.max(1, Math.floor(Number(e.target.value)) || 1))} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5 block">{t("lc.ms.rotDeg")}</span>
                <input type="number" step="15" value={rotationDeg} onChange={(e) => setRotationDeg(Number(e.target.value) || 0)} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Anchor of a path when dragging with Select (its first vertex). */
function shapeAnchor(shapes: DrawShape[], idx: number, fallback: Point): Point {
  const target = shapes[idx];
  if (target?.type !== "path") return fallback;
  const start = (target.d ?? "").match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!start || start.length < 2) return fallback;
  return { x: Number(start[0]), y: Number(start[1]) };
}
