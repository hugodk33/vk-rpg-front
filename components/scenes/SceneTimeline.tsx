import Link from "next/link";
import type { GameTable, Location, Modifier, NarrationAction, Scene } from "@/lib/types";

function locationCard(loc: Location | null) {
  if (!loc) return null;
  return (
    <p className="text-sm text-zinc-500 mt-2">
      <span className="text-blue-400">{loc.name}</span>
      {loc.region ? (
        <>
          {" "}· {loc.region}
          {loc.subRegion ? `, ${loc.subRegion}` : ""}
        </>
      ) : null}
      {loc.address ? ` · ${loc.address}` : null}
    </p>
  );
}

function entityBadge(id: string, name: string, subtitle: string, moment?: number) {
  const url = `/personagem/${id}${moment != null ? `?moment=${moment}` : ""}`;
  return (
    <Link
      href={url}
      className="inline-flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 rounded px-3 py-1.5 text-sm transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-blue-500" />
      <div>
        <div className="font-medium text-zinc-200">{name}</div>
        <div className="text-xs text-zinc-500">{subtitle}</div>
      </div>
    </Link>
  );
}

function modifierTag(m: Modifier | null) {
  if (!m) return null;
  const parts: React.ReactNode[] = [];
  const push = (node: React.ReactNode) => parts.push(node);
  if (m.mod_hp != null) push(<span key="hp" className="text-red-400 font-medium">{m.mod_hp >= 0 ? "+" : ""}{m.mod_hp} HP</span>);
  if (m.mod_st != null) push(<span key="st" className="text-red-400 font-medium">{m.mod_st >= 0 ? "+" : ""}{m.mod_st} ST</span>);
  if (m.mod_dx != null) push(<span key="dx" className="text-emerald-400 font-medium">{m.mod_dx >= 0 ? "+" : ""}{m.mod_dx} DX</span>);
  if (m.mod_iq != null) push(<span key="iq" className="text-blue-400 font-medium">{m.mod_iq >= 0 ? "+" : ""}{m.mod_iq} IQ</span>);
  if (m.mod_ht != null) push(<span key="ht" className="text-purple-400 font-medium">{m.mod_ht >= 0 ? "+" : ""}{m.mod_ht} HT</span>);
  if (m.mod_fatigue != null) push(<span key="fp" className="text-blue-400 font-medium">{m.mod_fatigue >= 0 ? "+" : ""}{m.mod_fatigue} FP</span>);
  if (m.hp != null) push(<span key="hp-set" className="text-red-400 font-medium">HP&rarr;{m.hp}</span>);
  if (m.damage_value != null) push(<span key="dmg" className="text-red-400 font-medium">{m.damage_value}</span>);
  if (m.skill_value != null) push(<span key="skill" className="text-amber-400 font-medium">Skill: {m.skill_value}</span>);
  if (m.item_quantity != null) push(<span key="qty" className="text-amber-400 font-medium">Qty: {m.item_quantity}</span>);
  if (m.item_weight != null) push(<span key="wt" className="text-amber-400 font-medium">Wt: {m.item_weight}</span>);
  if (!parts.length) return null;
  return <div className="flex flex-wrap gap-2 mt-1 ml-7 text-xs">{parts}</div>;
}

function actionRow(a: NarrationAction, moment?: number) {
  const charId = a.character?.id || "";
  const charName = a.character?.name || a.character?.username || "Unknown";
  const charUrl = charId ? `/personagem/${charId}${moment != null ? `?moment=${moment}` : ""}` : "";
  return (
    <div key={a.id} className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-zinc-600 w-4 mt-0.5">{a.queue}.</span>
      <div className="flex-1">
        <span className="text-sm text-zinc-300">
          {charUrl ? (
            <Link href={charUrl} className="text-zinc-200 hover:text-blue-400">{charName}</Link>
          ) : (
            charName
          )}
          {a.description ? ` — ${a.description}` : ""}
        </span>
        {a.dice_roll ? (
          <span className="text-xs text-zinc-400 ml-1">
            {a.dice_roll}
            {a.result ? ` = ${a.result}` : ""}
          </span>
        ) : null}
        {modifierTag(a.modifier)}
      </div>
    </div>
  );
}

interface SceneTimelineProps {
  table: GameTable | null;
  scenes: Scene[];
  showEditButtons?: boolean;
}

export default function SceneTimeline({ table, scenes, showEditButtons = true }: SceneTimelineProps) {
  const chapters = new Map<number, Scene[]>();
  for (const scene of scenes) {
    const ch = scene.chapter || 1;
    if (!chapters.has(ch)) chapters.set(ch, []);
    chapters.get(ch)!.push(scene);
  }
  const chapterEntries = [...chapters.entries()];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-amber-100">{table?.title || "Scenes"}</h1>
      {table?.intro ? (
        <p className="text-zinc-400 mt-1 mb-6">{table.intro}</p>
      ) : (
        <br />
      )}

      {scenes.length === 0 ? (
        <p className="text-zinc-500 italic">No scenes yet.</p>
      ) : (
        chapterEntries.map(([chapter, chapterScenes]) => (
          <div key={chapter} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-amber-100">Chapter {chapter}</h2>
            </div>
            {chapterScenes.map((scene) => (
              <div key={scene.id} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-zinc-200">{scene.title}</h3>
                  {showEditButtons ? (
                    <button
                      type="button"
                      className="px-3 py-1 text-xs font-medium text-amber-400 bg-transparent border border-amber-700/50 rounded-lg hover:bg-amber-900/20 transition-colors"
                    >
                      Edit Scene
                    </button>
                  ) : null}
                </div>
                {scene.narrations.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No narrations.</p>
                ) : (
                  scene.narrations.map((n, ni) => (
                    <div key={n.id} className="mb-5 pl-6 border-l-2 border-zinc-700/50">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">
                          {(scene.moment ?? 0) + 1}.{ni + 1}
                        </span>
                        {n.title ? <span className="text-sm font-medium text-zinc-300">{n.title}</span> : null}
                      </div>
                      <p className="text-base text-zinc-300 leading-relaxed">{n.narration}</p>
                      {showEditButtons ? (
                        <button
                          type="button"
                          className="mt-2 px-2.5 py-1 text-[11px] font-medium text-amber-400/70 bg-transparent border border-amber-800/40 rounded hover:bg-amber-900/15 transition-colors"
                        >
                          Edit Narration
                        </button>
                      ) : null}
                      {locationCard(n.location)}
                      {n.characters.length || n.npcs.length ? (
                        <div className="flex flex-wrap gap-3 mt-3">
                          {n.characters.map((ch) =>
                            entityBadge(ch.id, ch.name || ch.username || "Unknown", "Player", n.moment)
                          )}
                          {n.npcs.map((npc) =>
                            entityBadge(npc.characterId, npc.name || "Unknown", npc.status || "NPC", n.moment)
                          )}
                        </div>
                      ) : null}
                      {n.actions?.length ? (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Actions</p>
                          {[...n.actions]
                            .sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0))
                            .map((a) => actionRow(a, n.moment))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
