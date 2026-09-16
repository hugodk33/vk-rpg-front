import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, VisibilityRule } from "@/lib/types";
import CharacterSheet from "@/components/character/CharacterSheet";

export const dynamic = "force-dynamic";

export default async function PlayerCharacterViewedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewer?: string }>;
}) {
  const { id } = await params;
  const { viewer } = await searchParams;

  if (!viewer) {
    redirect("/player");
  }

  let data: CharacterViewer;
  try {
    data = await api<CharacterViewer>(
      `/game-table-character/${id}?viewer=${encodeURIComponent(viewer)}`
    );
  } catch {
    redirect("/player");
  }
  if (!data.character) {
    redirect("/player");
  }
  const visibility = await api<VisibilityRule[]>(
    `/game-table-visibility/${viewer}`
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">
        You are viewing this character as your character. Everything you
        cannot see yet (the narrator has kept it hidden) is what you have not
        discovered in play — not a page glitch.
      </div>
      <CharacterSheet
        data={data}
        basePath={`/player/character/${id}`}
        visibility={viewer === id ? null : Array.isArray(visibility) ? visibility : null}
      />
    </div>
  );
}