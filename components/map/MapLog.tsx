"use client";

/* ============================================================
   MapLog — the battle-log map.
   A dedicated surface for the floor-plan perspective, read like
   a moment-by-moment account:
     · CHAPTER / SCENE selects narrow the story;
     · every narration of the scene is a beat in the log;
     · each action inside a beat is a row — click any of them to
       put ONE movement on camera: the map scrubs to "where everyone
       stood" and draws only that move's vector;
     · clicking the beat itself shows the snapshot with no arrows.
   The chronicle's mini-maps keep the full record; this tab exists
   to isolate each move without the noise of every vector at once.
   ============================================================ */

import { useMemo, useState } from "react";
import type { Location, Narration, NarrationAction, Scene, TableCharacter, VisibilityRule } from "@/lib/types";
import { narrationBoardAt } from "@/lib/board";
import type { BoardToken } from "@/lib/board";
import { maskedLocationName, maskedTargetName } from "@/lib/visibility";
import TacticalPlate from "@/components/tactical/TacticalPlate";

const ROMAN = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
function roman(n: number): string {
  return ROMAN[Math.max(0, Math.min(ROMAN.length - 1, Math.floor(n)))] ?? String(n);
}

const hexLbl = (hex: { q: number; r: number } | null | undefined): string => {
  if (!hex) return "fora";
  const col = hex.q >= 0 ? String.fromCharCode(65 + (hex.q % 26)) : "?";
  return `${col}${hex.r + 1}`;
};

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const toneOf = (isPlayer: boolean) => ({
  accent: isPlayer ? "#3b82f6" : "#16a34a",
  text: isPlayer ? "text-blue-300" : "text-green-400",
  sel: isPlayer
    ? "border-blue-500/60 bg-blue-700/20 text-blue-200"
    : "border-green-700/60 bg-green-900/20 text-green-200",
  focusRing: isPlayer ? "focus-visible:ring-blue-500/60" : "focus-visible:ring-green-800/60",
  focusSelect: isPlayer ? "focus:border-blue-600/70" : "focus:border-green-900/60",
});

interface MapLogProps {
  scenes: Scene[];
  locations: Location[];
  /** roster to complete token names (fallback when a beat lacks a token). */
  characters?: TableCharacter[];
  npcIds?: string[];
  role?: "narrator" | "player";
  viewerId?: string;
  /** the viewer's OWN visibility rules (applied when role === "player"). */
  visibility?: VisibilityRule[] | null;
  /** present the page as a full-viewport console (no page scroll on lg):
      log and map each get a fixed row with their own internal scroll. */
  fillViewport?: boolean;
}

export default function MapLog({
  scenes,
  locations,
  characters = [],
  npcIds = [],
  role = "narrator",
  viewerId,
  visibility = null,
  fillViewport = false,
}: MapLogProps) {
  const isPlayer = role === "player";
  const t = toneOf(isPlayer);

  const [chapterSel, setChapterSel] = useState<number>(0);
  const [sceneSel, setSceneSel] = useState<string>("");
  const [narrationSel, setNarrationSel] = useState<string>("");
  const [actionSel, setActionSel] = useState<string>("");

  const chapters = useMemo(() => {
    const map = new Map<number, Scene[]>();
    for (const s of scenes) {
      const ch = s.chapter || 1;
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch)!.push(s);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [scenes]);

  const effChapter = chapters.some(([c]) => c === chapterSel) ? chapterSel : chapters.length > 0 ? chapters[chapters.length - 1][0] : 0;
  const chapterScenes = chapters.find(([c]) => c === effChapter)?.[1] ?? [];
  const effScene = chapterScenes.find((s) => s.id === sceneSel) ?? chapterScenes[chapterScenes.length - 1];
  const narrations = effScene?.narrations ?? [];
  const effBeat = narrations.find((n) => n.id === narrationSel) ?? narrations[narrations.length - 1];
  const actionList = effBeat ? [...(effBeat.actions ?? [])].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0)) : [];
  const effAction = actionList.find((a) => a.id === actionSel) ?? null;
  const narrationCount = scenes.reduce((acc, s) => acc + s.narrations.length, 0);

  /* ---- the scrubbed snapshot ---- */
  const board = narrationBoardAt(effBeat as Narration | null, {
    untilActionId: effAction ? effAction.id : "",
    fallbackLocation: null,
  });

  const actionLoc = effAction?.locationId ? locations.find((l) => l.id === effAction.locationId) : null;
  const mapLocation =
    actionLoc ??
    effBeat?.location ??
    locations.find((l) => !!l.hex?.width && !!l.hex?.height) ??
    locations[0] ??
    null;

  const shownLocation = mapLocation
    ? isPlayer
      ? maskedLocationName(visibility, mapLocation.id, mapLocation.name || "Sem nome")
      : mapLocation.name || "Sem nome"
    : null;

  /* ---- tokens: roster completes anyone a beat doesn't place ---- */
  const rosterTokens: BoardToken[] = characters.map((c) => ({
    id: c.id,
    name: c.sheet?.name || c.name || c.user?.username || "Desconhecido",
    isPlayer: !npcIds.includes(c.id),
    unconscious: false,
  }));
  const tokenById = new Map<string, BoardToken>(rosterTokens.map((t) => [t.id, t]));
  for (const bt of board.tokens) {
    tokenById.set(bt.id, {
      ...(tokenById.get(bt.id) ?? { id: bt.id, name: bt.name, isPlayer: !npcIds.includes(bt.id), unconscious: false }),
      ...bt,
    });
  }
  const mapTokens: BoardToken[] = [...tokenById.values()].map((token) =>
    isPlayer && token.id !== viewerId
      ? { ...token, name: maskedTargetName(visibility, token.id, token.name) }
      : token
  );

  const moveCount = (effBeat?.actions ?? []).filter((a) => a.q != null && a.r != null).length;

  function pickChapter(ch: number) {
    setChapterSel(ch);
    setSceneSel("");
    setNarrationSel("");
    setActionSel("");
  }
  function pickScene(id: string) {
    setSceneSel(id);
    setNarrationSel("");
    setActionSel("");
  }
  function pickNarration(id: string) {
    setNarrationSel(id);
    setActionSel("");
  }

  const charShown = (a: NarrationAction): string => {
    const c = a.character;
    if (!c) return "Alguém";
    if (isPlayer) {
      if (viewerId && c.id === viewerId) return c.name || c.username || "Você";
      return maskedTargetName(visibility, c.id, c.name || c.username || "Alguém");
    }
    return c.name || c.username || "Alguém";
  };

  const wasUnconscious = isPlayer
    ? (() => {
        const c = (effBeat?.characters ?? []).find((x) => x.id === viewerId);
        return !!c && c.conscious === false;
      })()
    : false;

  return (
    <div className={`max-w-6xl mx-auto px-4 py-6 ${fillViewport ? "lg:h-[calc(100dvh-9rem)] lg:flex lg:flex-col" : ""}`}>
      {/* canopy */}
      <div className={`mb-5 ${fillViewport ? "lg:mb-3 lg:shrink-0" : ""}`}>
        <p className={`font-mono text-[10px] tracking-widest uppercase ${isPlayer ? "text-blue-300/90" : "text-green-500/90"}`}>
          O registro de batalha
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-1">Mapa</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
          {chapters.length} {chapters.length !== 1 ? "capítulos" : "capítulo"}
          <span className="text-zinc-700">·</span> {scenes.length} {scenes.length !== 1 ? "cenas" : "cena"}
          <span className="text-zinc-700">·</span> {narrationCount} {narrationCount !== 1 ? "narrações" : "narração"}
          <span className="text-zinc-700">·</span> um movimento por vez
        </div>
      </div>

      {scenes.length === 0 ? (
        <div className="text-center py-24 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-zinc-600 block mb-2">{icon("M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7", "w-10 h-10")}</span>
          <p className="text-zinc-500 text-sm">Nenhuma cena registrada ainda — o registro começa em branco.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-5 ${fillViewport ? "lg:flex-1 lg:min-h-0 lg:grid-rows-[minmax(0,44%)_minmax(0,1fr)]" : ""}`}>
          {/* ================= LOG ================= */}
          <aside className="grid grid-cols-1 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-4">
            {/* chapter + scene */}
            <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4 space-y-3 lg:self-start">
              <div>
                <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Capítulo</label>
                <div className="flex items-center gap-2">
                  <select
                    value={effChapter}
                    onChange={(e) => pickChapter(Number(e.target.value))}
                    className={`w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${t.focusSelect} transition-colors`}
                  >
                    {chapters.map(([ch]) => (
                      <option key={ch} value={ch} className="bg-zinc-800">
                        Capítulo {roman(ch)}
                      </option>
                    ))}
                  </select>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    M {Math.max(0, effScene?.moment ?? 0) + 1}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Cena</label>
                <select
                  value={effScene?.id ?? ""}
                  onChange={(e) => pickScene(e.target.value)}
                  className={`w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${t.focusSelect} transition-colors`}
                >
                  {chapterScenes.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-800">
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Narração</label>
                <select
                  value={effBeat?.id ?? ""}
                  onChange={(e) => pickNarration(e.target.value)}
                  className={`w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none ${t.focusSelect} transition-colors`}
                >
                  {narrations.map((n, idx) => (
                    <option key={n.id} value={n.id} className="bg-zinc-800">
                      {String(idx + 1).padStart(2, "0")} · {n.title || "Batida sem título"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* narrations — the timeline */}
            <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4 lg:min-h-0 lg:max-h-[72vh] lg:overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Narrações</span>
                <span className="font-mono text-[10px] text-zinc-600">({narrations.length})</span>
                {moveCount ? (
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">{moveCount} {moveCount !== 1 ? "movimentos" : "movimento"}</span>
                ) : null}
              </div>

              {narrations.length === 0 ? (
                <p className="text-sm text-zinc-600 italic font-mono">Nenhuma batida nesta cena ainda.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-zinc-800 pl-4">
                  {narrations.map((n, idx) => {
                    const active = n.id === effBeat?.id;
                    const acts = [...(n.actions ?? [])].sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0));
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => pickNarration(n.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 ${t.focusRing} ${
                            active ? t.sel : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 text-zinc-300"
                          }`}
                        >
                          <span className="flex items-baseline gap-2">
                            <span className={`font-mono text-[10px] tabular-nums ${active ? t.text : "text-zinc-600"}`}>
                              {String(idx + 1).padStart(2, "0")}.
                            </span>
                            <span className={`text-[13px] font-medium ${wasUnconscious && active ? "text-zinc-600" : ""}`}>
                              {n.title || "Batida sem título"}
                            </span>
                          </span>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                            {n.narration ? n.narration.slice(0, 90) : "sem texto"}
                            {n.narration && n.narration.length > 90 ? "…" : ""}
                          </span>
                        </button>

                        {active && acts.length ? (
                          <ol className="mt-2 space-y-1 border-l border-zinc-800 ml-2 pl-3">
                            {acts.map((a) => {
                              const aActive = a.id === actionSel;
                              const isMove = a.q != null && a.r != null;
                              return (
                                <li key={a.id}>
                                  <button
                                    type="button"
                                    onClick={() => setActionSel((prev) => (prev === a.id ? "" : a.id))}
                                    className={`w-full flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                                      aActive ? t.sel : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-600 text-zinc-400"
                                    }`}
                                  >
                                    <span className={`font-mono text-[10px] tabular-nums pt-px ${aActive ? t.text : "text-zinc-600"}`}>
                                      {a.queue ?? "·"}.
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={`block text-[12px] font-medium truncate ${aActive ? "text-zinc-100" : "text-zinc-300"}`}>
                                        {charShown(a)}
                                      </span>
                                      <span className="block text-[11px] text-zinc-500 truncate">
                                        {a.description || (isMove ? "move-se no mapa" : "registrado")}
                                      </span>
                                    </span>
                                    {isMove ? (
                                      <span className="shrink-0 inline-flex items-center gap-1 rounded bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sky-300">
                                        mov {hexLbl({ q: a.q as number, r: a.r as number })}
                                      </span>
                                    ) : a.dice_roll ? (
                                      <span className="shrink-0 inline-flex items-center gap-1 rounded bg-zinc-800/70 border border-zinc-700/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                                        rolagem
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>

          {/* ================= MAP ================= */}
          <section className={`space-y-4 ${fillViewport ? "lg:min-h-0" : ""}`}>
            <div className={`rounded-xl border border-zinc-700/40 bg-zinc-900/80 overflow-hidden ${fillViewport ? "lg:h-full lg:flex lg:flex-col" : ""}`}>
              <div className={`flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-zinc-700/40 ${fillViewport ? "lg:shrink-0" : ""}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Planta do local</span>
                {shownLocation ? (
                  <span className="text-sm font-semibold text-zinc-100">{shownLocation}</span>
                ) : (
                  <span className="text-sm text-zinc-500 italic">Nenhuma planta fixada nesta batida</span>
                )}
                {mapLocation?.hex?.width != null ? (
                  <span className="ml-auto font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                    {mapLocation.hex.width}×{mapLocation.hex.height} hex · {mapLocation.hex.sizeM ?? 1}m/hex
                  </span>
                ) : null}
                {effAction?.locationId && actionLoc && actionLoc.id !== effBeat?.location?.id ? (
                  <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-amber-500/40 text-amber-300">
                    esta ação levou o combate para outro mapa
                  </span>
                ) : null}
              </div>

              <div className={`${fillViewport ? "lg:flex-1 lg:min-h-0 lg:flex lg:flex-col" : ""}`}>
              {mapLocation ? (
                <TacticalPlate
                  location={mapLocation}
                  tokens={mapTokens}
                  trail={board.trail}
                  mark={effAction && effAction.q != null && effAction.r != null ? { q: effAction.q, r: effAction.r } : null}
                  accent={t.accent}
                  R={24}
                  M={14}
                  fill={fillViewport}
                />
              ) : (
                <div className={`px-5 py-14 text-center ${fillViewport ? "lg:flex-1" : ""}`}>
                  <p className="text-sm text-zinc-600 font-mono italic">
                    Registre um local com grade hexagonal para abrir o mapa tático.
                  </p>
                </div>
              )}
              </div>

              {/* the current moment, read out loud */}
              <div className={`border-t border-zinc-700/40 px-5 py-4 space-y-3 ${fillViewport ? "lg:shrink-0" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] tracking-widest uppercase ${t.text}`}>Momento</span>
                  {effAction ? (
                    <button
                      type="button"
                      onClick={() => setActionSel("")}
                      className="ml-auto font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md border border-zinc-700/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500"
                    >
                      Mostrar batida (sem setas)
                    </button>
                  ) : null}
                </div>

                {effBeat ? (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500">Capítulo {roman(effChapter)}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[13px] text-zinc-400">{effScene?.title}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="font-mono text-[10px] tabular-nums text-zinc-500">{effBeat.moment ?? 0}</span>
                    </div>

                    {effAction ? (
                      <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/50 px-3.5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-[11px] font-semibold ${t.text}`}>{charShown(effAction)}</span>
                          <span className="font-mono text-[10px] text-zinc-600">{effAction.queue ?? "—"}.</span>
                          <span className="text-sm text-zinc-300 flex-1 min-w-0">{effAction.description || "registrado"}</span>
                        </div>
                        {effAction.dice_roll || effAction.result ? (
                          <div className="mt-2 flex items-center gap-2.5">
                            <span className="font-mono text-xs text-zinc-400">{effAction.dice_roll || "—"}</span>
                            {effAction.dice_roll && effAction.result ? <span className="text-zinc-600">=</span> : null}
                            <span className="font-mono text-base font-bold tabular-nums text-zinc-100">{effAction.result}</span>
                          </div>
                        ) : null}
                        {effAction.q != null && effAction.r != null ? (
                          <p className="mt-2 font-mono text-[11px] text-sky-300">
                            este movimento → hex {effAction.q},{effAction.r}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 italic">
                        {moveCount > 0
                          ? "Selecione um movimento no registro para pôr um vetor no mapa."
                          : "Esta batida não tem movimentos registrados — o mapa mostra as posições finais."}
                      </p>
                    )}

                    <p className="text-[13px] leading-relaxed text-zinc-400">{effBeat.narration}</p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600 italic">Escolha uma narração para ver seu tabuleiro.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}