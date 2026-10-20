import { api } from "@/lib/api";
import { getSeatedUserId } from "@/lib/actor";
import type { GameTable, GameTableCharacters, TableCharacter } from "@/lib/types";
import TableLobby from "@/components/player/TableLobby";

export const dynamic = "force-dynamic";

/* ============================================================
   /player/table/[id] — a mesa do jogador.

   É o console da mesa pela ótica de quem senta: mostra a ficha
   própria (ou a tela de boas-vindas quando ainda não existe) e o
   botão de sair da mesa. O dono e co-narradores ficam na rota
   /table/[id].

   A identidade vem de `?user=` (trazida pelo link de aprovação do
   convite) ou do assento (`vkrpg.actor`). Sem nenhuma das duas a
   tela pede para o jogador escolher o assento.
   ============================================================ */

const characterUserId = (c: TableCharacter) => c.userId ?? c.user?.id ?? null;
const characterLabel = (c: TableCharacter) => c.sheet?.name || c.name || null;

export default async function PlayerTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ user?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [seat, table, chars] = await Promise.all([
    getSeatedUserId(),
    api<GameTable>(`/game-table/${id}`).catch(() => null),
    api<GameTableCharacters>(`/game-table-characters/${id}`).catch(() => null),
  ]);

  const userId = sp.user ?? seat ?? null;
  const roster = chars?.characters ?? [];
  const mine = userId
    ? roster.filter((c) => c.is_active !== false && characterUserId(c) === userId)
    : [];

  return (
    <TableLobby
      tableId={id}
      tableTitle={table?.title ?? null}
      userId={userId}
      characters={mine.map((c) => ({ id: c.id, name: characterLabel(c) }))}
    />
  );
}
