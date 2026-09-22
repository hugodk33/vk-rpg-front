import { api } from "@/lib/api";
import type {
  GameTableCharacters,
  GameTableLocations,
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

  const [mods, chars, scenes, locations] = await Promise.all([
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
    api<GameTableLocations>(`/game-table-locations/${id}`).catch(() => ({
      table: null,
      locations: [],
    })),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="modifiers" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Modificadores</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Modele personagens ao longo do tempo sem tocar na ficha base.
          Cada modificador pode ser ligado a um capítulo, uma cena, uma narração ou
          uma ação específica — o motor resolve tudo a partir do último momento
          da pasta da história.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 mb-6 text-xs text-zinc-400 space-y-1.5">
        <p>
          <span className="font-mono uppercase tracking-widest text-green-500/80 text-[10px]">Regra de fadiga GURPS</span>
        </p>
        <p>
          A barra de <span className="text-zinc-200">FP</span> acompanha o <span className="text-zinc-200">cansaço</span>:
          começa em <span className="text-zinc-200">0</span> (descansado) e
          enche em direção a <span className="text-zinc-200">HT</span>. Com menos
          de <span className="text-amber-300">1/3 do máximo</span> restante, o
          personagem está <span className="text-amber-300">cansado</span> — ST, Deslocamento
          e Esquiva são reduzidos à metade (arredonda para cima). No topo da barra (sem FP)
          ele está <span className="text-rose-300">exausto</span>: cada FP
          adicional custa 1 PV, e agir exige um teste de Vontade. A ficha
          mostra os valores efetivos, nunca os base.
        </p>
      </div>

      <ModifiersPanel
        tableId={id}
        initialModifiers={mods?.modifiers ?? []}
        characters={chars?.characters ?? []}
        scenes={scenes ?? null}
        locations={locations?.locations ?? []}
      />
    </div>
  );
}