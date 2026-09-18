/* ============================================================
   StoryRail — the campaign&apos;s dynamics drawn as a horizontal
   rail. The narrative flows left → right:

   · CHAPTER folios break the line like roman-numeral plaques;
   · each SCENE runs as a span of narration nodes with a caption
     beneath the line;
   · each NARRATION is a node on the spine carrying its moment and
     location;
   · each ACTION is a tick on its node — a quiet, countable pulse;
   · the rail&apos;s cursor rests on the latest narration (where the
     chronicle now stands), and the top bar reads how much story
     has been told — a gauge built from recorded chapters, scenes,
     narrations, actions and modifiers, with no deadline and no
     end-percentage, so it only ever grows as the tale unfolds.
   ============================================================ */

import Link from "next/link";
import type { SessionState } from "@/lib/session";
import type { Narration, Scene } from "@/lib/types";

const ROMAN = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
const roman = (n: number) => ROMAN[Math.max(0, Math.min(ROMAN.length - 1, Math.floor(n)))] ?? String(n);

const METER_SEGMENTS = 16;

interface StoryRailProps {
  tableId: string;
  scenes: Scene[];
  state: SessionState;
  modifierCount?: number;
}

export default function StoryRail({ tableId, scenes, state, modifierCount = 0 }: StoryRailProps) {
  const sorted = [...scenes].sort(
    (a, b) => (a.chapter ?? 0) - (b.chapter ?? 0) || (a.moment ?? 0) - (b.moment ?? 0)
  );

  const totalNarrations = sorted.reduce((sum, s) => sum + (s.narrations?.length ?? 0), 0);
  const totalActions = sorted.reduce(
    (sum, s) => sum + (s.narrations ?? []).reduce((a2, n) => a2 + (n.actions?.length ?? 0), 0),
    0
  );

  const now = state.latestNarrationId;

  const chapters = [] as { chapter: number; scenes: Scene[] }[];
  for (const s of sorted) {
    const ch = s.chapter ?? 1;
    const last = chapters[chapters.length - 1];
    if (last && last.chapter === ch) last.scenes.push(s);
    else chapters.push({ chapter: ch, scenes: [s] });
  }

  const taleMass = chapters.length + sorted.length + totalNarrations + totalActions + modifierCount;
  const meterFilled = Math.min(METER_SEGMENTS, taleMass);
  const meterOverflow = taleMass - METER_SEGMENTS;
  const massBreakdown =
    `${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${sorted.length} scene${sorted.length === 1 ? "" : "s"} · ` +
    `${totalNarrations} narration${totalNarrations === 1 ? "" : "s"} · ${totalActions} action${totalActions === 1 ? "" : "s"} · ` +
    `${modifierCount} modifier${modifierCount === 1 ? "" : "s"}`;

  if (sorted.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 overflow-hidden">
      {/* header strip */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="font-mono text-base leading-none text-teal-400">◍</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Chronicle rail
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 hidden sm:inline">
            {massBreakdown}
          </span>
        </div>
        <div className="flex items-center gap-3" title={massBreakdown}>
          <div className="flex flex-col items-end leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Tale told</span>
            <span className="font-mono text-xs text-teal-300 tabular-nums">{taleMass}</span>
          </div>
          <div className="flex items-center gap-[3px]" aria-hidden>
            {Array.from({ length: METER_SEGMENTS }).map((_, i) => (
              <span
                key={i}
                className={`block h-4 w-1.5 rounded-sm transition-colors ${
                  i < meterFilled ? "bg-teal-400/70" : "bg-zinc-800"
                }`}
              />
            ))}
            {meterOverflow > 0 ? (
              <span className="font-mono text-[9px] text-teal-300/80">+{meterOverflow}</span>
            ) : null}
          </div>
          <Link
            href={`/table/${tableId}/sessions`}
            className="font-mono text-[9px] uppercase tracking-widest text-teal-300/90 hover:text-teal-200 transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 px-1"
          >
            Open chronicle →
          </Link>
        </div>
      </div>

      {/* the rail */}
      <div className="overflow-x-auto max-w-full scroll-thin">
        <div className="relative min-w-max px-4 pb-10 pt-4">
          {/* spine */}
          <div aria-hidden className="absolute left-0 right-0 top-[21px] h-px bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800" />

          <div className="flex items-start">
            {chapters.map(({ chapter, scenes: chScenes }) => (
              <div key={`${chapter}`} className="flex items-start">
                <ChapterFolio chapter={chapter} isCurrent={chapter === state.chapter} />

                {chScenes.map((scene, si) => (
                  <div key={scene.id} className="flex flex-col">
                    <div className="flex items-start">
                      {(scene.narrations?.length ?? 0) === 0 ? (
                        <span className="w-px h-[21px] bg-zinc-700/60" aria-hidden />
                      ) : (
                        (scene.narrations ?? []).map((n, ni) => (
                          <NarrationNode
                            key={n.id}
                            narration={n}
                            index={ni}
                            isCurrent={n.id === now}
                            totalActions={totalActions}
                          />
                        ))
                      )}
                    </div>
                    <SceneCaption scene={scene} sceneIndex={si} />
                  </div>
                ))}
              </div>
            ))}

            {/* end cap */}
            <div className="flex flex-col items-center px-2" aria-hidden>
              <div className="h-[13px]" />
              <span className="block h-3 w-3 rounded-full border border-zinc-600 bg-zinc-900 shadow-[0_0_10px_rgba(148,163,184,0.25)]" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-600 mt-1.5">end</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- chapter folio ---------- */

function ChapterFolio({ chapter, isCurrent }: { chapter: number; isCurrent: boolean }) {
  return (
    <div className="flex flex-col items-center px-3 shrink-0">
      <div className="h-[13px]" aria-hidden />
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-sm border font-mono text-[11px] font-bold transition-colors ${
          isCurrent
            ? "border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
            : "border-zinc-700 bg-zinc-900 text-zinc-400"
        }`}
        title={isCurrent ? "Chapter in progress" : `Chapter ${roman(chapter)}`}
      >
        {roman(chapter)}
      </div>
      <span className={`font-mono text-[8px] uppercase tracking-[0.2em] mt-1.5 ${isCurrent ? "text-amber-400/80" : "text-zinc-600"}`}>
        Ch. {roman(chapter)}
      </span>
      {isCurrent ? (
        <span aria-hidden className="font-mono text-[9px] text-amber-400/70 -mt-0.5">▾ here</span>
      ) : null}
    </div>
  );
}

/* ---------- narration node ---------- */

function NarrationNode({
  narration,
  index,
  isCurrent,
  totalActions,
}: {
  narration: Narration;
  index: number;
  isCurrent: boolean;
  totalActions: number;
}) {
  const actions = narration.actions ?? [];
  const loc = narration.location?.name;
  return (
    <div className={`relative flex flex-col items-center w-44 px-1.5 shrink-0 ${isCurrent ? "" : "opacity-90"}`}>
      <div className="h-[13px]" aria-hidden />
      <div
        aria-hidden
        className={`block h-4 w-4 rounded-full border transition-colors ${
          isCurrent
            ? "border-teal-300 bg-teal-400/80 shadow-[0_0_12px_rgba(45,212,191,0.6)]"
            : totalActions > 0
            ? "border-zinc-600 bg-zinc-800"
            : "border-zinc-700 bg-zinc-900"
        }`}
      />

      <div
        className={`mt-2 w-full rounded-md border px-2 py-1.5 text-center transition-colors ${
          isCurrent
            ? "border-teal-500/40 bg-teal-500/10"
            : "border-zinc-800 bg-zinc-950/40"
        }`}
      >
        {narration.title ? (
          <span className="block text-[11px] font-medium leading-tight text-zinc-200">{narration.title}</span>
        ) : (
          <span className="block text-[11px] italic leading-tight text-zinc-500">Beats</span>
        )}
        <span className="block font-mono text-[8px] uppercase tracking-widest text-zinc-600 mt-0.5">
          M{index + 1}{loc ? ` · ${loc}` : ""}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-center gap-[3px]" title={actions.length > 0 ? "Actions told in this beat" : undefined}>
        {actions.length === 0 ? (
          <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-700">— no moves —</span>
        ) : (
          <>
            {actions.slice(0, 6).map((a) => (
              <span
                key={a.id}
                title={
                  a.description || a.result || a.dice_roll
                    ? `${a.queue != null ? `${a.queue}. ` : ""}${a.description ?? ""}${a.dice_roll ? ` · ${a.dice_roll}` : ""}${a.result ? ` → ${a.result}` : ""}`
                    : "Action"
                }
                className={`block h-3 w-1 rounded-full ${isCurrent ? "bg-teal-400/80" : "bg-amber-400/50"}`}
              />
            ))}
            {actions.length > 6 ? (
              <span className="font-mono text-[8px] text-zinc-600">+{actions.length - 6}</span>
            ) : null}
          </>
        )}
      </div>

      {isCurrent ? (
        <span aria-hidden className="absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] text-teal-300">
          ▼
        </span>
      ) : null}
    </div>
  );
}

/* ---------- scene caption ---------- */

function SceneCaption({ scene, sceneIndex }: { scene: Scene; sceneIndex: number }) {
  const shown = scene.title || (scene.moment != null ? `Part ${(scene.moment ?? 0) + 1}` : "");
  if (!shown) return null;
  return (
    <div className="mt-2.5 flex items-center justify-center gap-1.5 px-1.5 min-w-0" aria-hidden>
      <span className="h-px w-3 bg-zinc-800" />
      <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-zinc-500 truncate max-w-[9rem]">
        {sceneIndex > 0 ? `◈ ${shown}` : shown}
      </span>
      <span className="h-px w-3 bg-zinc-800" />
    </div>
  );
}