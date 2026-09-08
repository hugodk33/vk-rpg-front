import { api } from "@/lib/api";
import type {
  GameTableCharacters,
  GameTableModifiers,
  GameTableScenes,
} from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import ModifiersPanel from "@/components/modifiers/ModifiersPanel";

export const dynamic = "force-dynamic";

export default async function TableModifiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [mods, chars, scenes] = await Promise.all([
    api<GameTableModifiers>(`/game-table-modifiers/${id}`).catch(() => ({
      table: null,
      modifiers: [],
    })),
    api<GameTableCharacters>(`/game-table-characters/${id}`).catch(() => ({
      table: null,
      characters: [],
    })),
    api<GameTableScenes>(`/game-table-scenes/${id}`).catch(() => ({
      table: null,
      scenes: [],
    })),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="modifiers" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Modifiers</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Shape characters through time without touching their base sheet.
          Each modifier can be tied to a chapter, a scene or a narration — the
          engine resolves them from the story-folder&apos;s last moment onward.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 mb-6 text-xs text-zinc-400 space-y-1.5">
        <p>
          <span className="font-mono uppercase tracking-widest text-green-500/80 text-[10px]">GURPS fatigue rule</span>
        </p>
        <p>
          FP starts at <span className="text-zinc-200">HT</span>. Below{" "}
          <span className="text-amber-300">1/3 of max</span> the character is{" "}
          <span className="text-amber-300">tired</span> — ST, Move and Dodge are
          halved (round up). At <span className="text-rose-300">0 FP</span> or less
          they are <span className="text-rose-300">exhausted</span>: each further FP
          lost costs 1 HP, and acting requires a Will roll. The character sheet
          shows the effective values, never the base.
        </p>
      </div>

      <ModifiersPanel
        tableId={id}
        initialModifiers={mods?.modifiers ?? []}
        characters={chars?.characters ?? []}
        scenes={scenes ?? null}
      />
    </div>
  );
}