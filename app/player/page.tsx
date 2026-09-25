import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable, GameTableCharacters, GameTableNpcs, Sheet, TableCharacter, TableNpc } from "@/lib/types";
import SeatPicker, { type SeatOption } from "@/components/player/SeatPicker";

export const dynamic = "force-dynamic";

interface PlayerEntry {
  table: GameTable;
  ch: TableCharacter;
  /** Set when the entry is an allied NPC (status `ally`). */
  npcStatus?: string;
}

const ALLY_NPC_STATUS = "ally";

async function loadPlayerEntries(): Promise<PlayerEntry[]> {
  try {
    const tables = await api<GameTable[]>("/game-tables");
    const entries: PlayerEntry[] = [];
    for (const t of tables) {
      const [chars, npcs] = await Promise.all([
        api<GameTableCharacters>(`/game-table-characters/${t.id}`),
        api<GameTableNpcs>(`/game-table-npcs/${t.id}`).catch(() => ({ table: null, npcs: [] })),
      ]);
      const npcOf = new Map<string, TableNpc>();
      for (const n of npcs?.npcs ?? []) if (n.character_id) npcOf.set(n.character_id, n);
      for (const ch of chars?.characters ?? []) {
        // Personagens desativados ficam na mesa, mas fora do jogo — não
        // aparecem no painel do jogador.
        if (ch.is_active === false) continue;
        const npc = npcOf.get(ch.id);
        if (npc) {
          // Companhia só inclui NPCs aliados — inimigos/neutros/bosses ficam
          // fora do painel do jogador até o mestre liberá-los como ally.
          if (npc.status === ALLY_NPC_STATUS) entries.push({ table: t, ch: { ...ch, isNpc: true }, npcStatus: npc.status });
        } else {
          entries.push({ table: t, ch });
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/* -------- sigil (per-character hue) -------- */

const PALETTE = [
  { dot: "#2dd4bf", ring: "#2dd4bf55" }, // teal
  { dot: "#38bdf8", ring: "#38bdf855" }, // sky
  { dot: "#a78bfa", ring: "#a78bfa55" }, // violet
  { dot: "#f472b6", ring: "#f472b655" }, // pink
  { dot: "#fbbf24", ring: "#fbbf2455" }, // amber
  { dot: "#34d399", ring: "#34d39955" }, // emerald
];

function hueFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  const h = PALETTE[sum % PALETTE.length];
  const letters = (name || "?").slice(0, 2).toUpperCase();
  return { ...h, letters };
}

/* -------- stats helpers -------- */

function statRow(s: Sheet) {
  return [
    { label: "ST", value: s.st ?? s.base_st, hex: "#f87171" },
    { label: "DX", value: s.dx ?? s.base_dx, hex: "#34d399" },
    { label: "IQ", value: s.iq ?? s.base_iq, hex: "#60a5fa" },
    { label: "HT", value: s.ht ?? s.base_ht, hex: "#a78bfa" },
  ];
}

/** HP current = effective `hp` (base + active modifiers); max = original `base_hp`. */
function hpBar(s: Sheet) {
  const max = s.base_hp ?? s.hp ?? 0;
  const cur = s.hp ?? max;
  const pct = max ? Math.max(0, Math.min(1, cur / max)) : 0;
  return { max, cur, pct };
}

interface EffectChip {
  key: string;
  label: string;
  value: string;
  cls: string;
}

function effectDeltas(m: {
  mod_hp?: number;
  mod_st?: number;
  mod_dx?: number;
  mod_iq?: number;
  mod_ht?: number;
}): EffectChip[] {
  const chips: EffectChip[] = [];
  if (m.mod_hp != null) chips.push({ key: "hp", label: "HP", value: signed(m.mod_hp), cls: "text-red-400" });
  if (m.mod_st != null) chips.push({ key: "st", label: "ST", value: signed(m.mod_st), cls: "text-red-400" });
  if (m.mod_dx != null) chips.push({ key: "dx", label: "DX", value: signed(m.mod_dx), cls: "text-emerald-400" });
  if (m.mod_iq != null) chips.push({ key: "iq", label: "IQ", value: signed(m.mod_iq), cls: "text-blue-400" });
  if (m.mod_ht != null) chips.push({ key: "ht", label: "HT", value: signed(m.mod_ht), cls: "text-purple-400" });
  return chips;
}

function effectSign(m: {
  mod_hp?: number;
  mod_st?: number;
  mod_dx?: number;
  mod_iq?: number;
  mod_ht?: number;
}): -1 | 0 | 1 {
  const deltas = [m.mod_hp, m.mod_st, m.mod_dx, m.mod_iq, m.mod_ht]
    .filter((n): n is number => n != null);
  if (!deltas.length) return 0;
  if (deltas.some((n) => n < 0) && !deltas.some((n) => n > 0)) return -1;
  if (deltas.some((n) => n > 0) && !deltas.some((n) => n < 0)) return 1;
  return 0;
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function seatOptionsFrom(entries: PlayerEntry[]): SeatOption[] {
  const seen = new Map<string, SeatOption>();
  for (const { ch } of entries) {
    const uid = ch.user?.id ?? ch.userId;
    if (uid && !seen.has(uid)) {
      seen.set(uid, { userId: uid, username: ch.user?.username ?? uid });
    }
  }
  return Array.from(seen.values());
}

export default async function PlayerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ seat?: string }>;
}) {
  const { seat } = await searchParams;
  const entries = await loadPlayerEntries();
  const seatOptions = seatOptionsFrom(entries);

  // With a seat picked, "your company" = your own characters plus the
  // rest of the party at the same tables. Companions open their sheet
  // filtered through this player's own visibility layers.
  const myEntries = seat ? entries.filter((e) => (e.ch.user?.id ?? e.ch.userId) === seat) : entries;
  const myTableIds = new Set<string>(myEntries.map((e) => e.table?.id).filter((t): t is string => !!t));
  const shown = seat ? entries.filter((e) => (e.table?.id && myTableIds.has(e.table.id)) || myEntries.includes(e)) : entries;

  const mySeats = new Set<string>();
  const observerByTable = new Map<string, string>();
  if (seat) {
    for (const { table, ch } of entries) {
      if ((ch.user?.id ?? ch.userId) !== seat) continue;
      mySeats.add(ch.id);
      if (table && !observerByTable.has(table.id)) observerByTable.set(table.id, ch.id);
    }
  }
  const mine = (ch: TableCharacter) => seat ? mySeats.has(ch.id) : false;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* ---- hero ---- */}
      <div className="relative rounded-2xl border border-blue-600/30 bg-gradient-to-b from-zinc-900/70 to-zinc-950 p-6 mb-8 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/2 opacity-[0.05] pointer-events-none select-none">
          <div className="absolute -bottom-14 -left-16 w-72 h-72 rounded-full border border-blue-500" />
          <div className="absolute top-4 -left-6 w-56 h-56 rounded-full border border-blue-500" />
        </div>
        <div className="relative">
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Na mesa</p>
          <div className="flex flex-wrap items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">Sua Companhia</h1>
              <p className="text-stone-400 text-sm mt-1.5">
                {shown.length === 0
                  ? "Nenhum aventureiro ainda — assuma um assento em uma campanha."
                  : `${shown.length} ${shown.length === 1 ? "aventureiro" : "aventureiros"} sob sua bandeira.`}
              </p>
            </div>
            {seatOptions.length > 0 ? <SeatPicker options={seatOptions} /> : null}
          </div>
        </div>
      </div>

      {/* ---- company (characters only) ---- */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-blue-700/40 text-center py-20 bg-zinc-900/40">
          <div className="font-mono text-[10px] tracking-widest uppercase text-blue-400/60">Nenhum aventureiro</div>
          <p className="text-zinc-300 mt-2 max-w-sm mx-auto text-sm">
            {seat
              ? "Este usuário ainda não tem personagens — escolha outro usuário acima."
              : "Quando um narrador te adiciona a uma campanha e você assume um personagem, ele aparecerá aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(({ table, ch, npcStatus }) => {
            const s = ch.sheet ?? ({} as Sheet);
            const name = s.name || ch.name || "Aventureiro sem nome";
            const hue = hueFor(name);
            const hp = hpBar(s);
            const attrs = statRow(s);
            const isNpc = !!ch.isNpc || npcStatus === ALLY_NPC_STATUS;
            const isMine = mine(ch);
            const sessionUrl = `/player/character/${ch.id}/session`;
            const sheetUrl = `/player/character/${ch.id}`;
            const observerId = !isMine && seat && table ? observerByTable.get(table.id) ?? null : null;
            const viewUrl = observerId
              ? `/player/character/${ch.id}/view?viewer=${encodeURIComponent(observerId)}`
              : isNpc
                ? `/player/character/${ch.id}/view`
                : sheetUrl;
            const ownerName = ch.user?.username ?? (ch.user?.id ?? ch.userId);
            const effects = (ch.active_effects ?? []).map((m) => ({
              m,
              deltas: effectDeltas(m),
              sign: effectSign(m),
            }));
            return (
              <div
                key={ch.id}
                className="group relative bg-zinc-900/60 border border-zinc-700/50 rounded-2xl overflow-hidden hover:border-blue-700/50 transition-colors flex flex-col sm:flex-row"
              >
                {/* hue rail */}
                <div className="hidden sm:block w-1 shrink-0" style={{ background: `linear-gradient(180deg, ${hue.dot}, ${hue.dot}33)` }} />

                <div className="flex-1 p-5 flex flex-col sm:flex-row items-start gap-4">
                  {/* sigil */}
                  <div className="relative flex items-center justify-center shrink-0" style={{ width: 56, height: 56 }}>
                    <svg viewBox="0 0 64 64" className="absolute inset-0" style={{ width: 56, height: 56 }}>
                      <circle cx="32" cy="32" r="27" fill="none" stroke={hue.ring} strokeWidth="1.5" />
                      <circle cx="32" cy="32" r="27" fill="none" stroke={hue.dot} strokeWidth="0.75" strokeDasharray="1.5 6" strokeDashoffset="14" />
                    </svg>
                    <span className="font-mono font-bold leading-none relative z-10" style={{ color: hue.dot, fontSize: 20, letterSpacing: "-0.02em" }}>
                      {hue.letters}
                    </span>
                  </div>

                  {/* identity + vitals */}
                  <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-zinc-100 leading-tight truncate">{name}</h2>
                          {isNpc ? (
                            <span className="font-mono text-[9px] uppercase tracking-widest text-amber-300/80 border border-amber-500/30 rounded px-1.5 py-0.5">
                              NPC Aliado
                            </span>
                          ) : seat ? (
                            isMine ? (
                              <span className="font-mono text-[9px] uppercase tracking-widest text-blue-300/80 border border-blue-500/30 rounded px-1.5 py-0.5">
                                Você
                              </span>
                            ) : (
                              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 border border-zinc-700/50 rounded px-1.5 py-0.5">
                                Companheiro
                              </span>
                            )
                          ) : null}
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                          {table ? table.title : "Mesa desconhecida"}
                          {isNpc ? "" : ownerName ? ` · ${ownerName}` : ""}
                        </p>
                      </div>
                      {hp.max ? (
                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block">HP</span>
                          <span className="font-mono text-sm font-bold text-red-300">{hp.cur}<span className="text-zinc-600">/</span>{hp.max}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                      {attrs.map((a) => (
                        <span key={a.label} className="inline-flex items-baseline gap-1">
                          <span className="font-mono text-[10px] uppercase text-zinc-600">{a.label}</span>
                          <span className="font-mono text-lg font-bold leading-none" style={{ color: a.hex }}>{a.value ?? "–"}</span>
                        </span>
                      ))}
                    </div>

                    {effects.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {effects.map(({ m, deltas, sign }) => {
                          const dot =
                            sign < 0 ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]" :
                            sign > 0 ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" :
                            "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]";
                          return (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1.5 bg-zinc-800/50 border border-zinc-700/40 rounded-md px-2 py-1"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                              <span className="text-zinc-300 text-xs font-medium">{m.name || "Efeito"}</span>
                              {deltas.length > 0 ? (
                                <span className="flex items-center gap-1.5">
                                  {deltas.map((d) => (
                                    <span key={d.key} className={`font-mono text-[10px] ${d.cls}`}>
                                      {d.label} {d.value}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* actions */}
                <div className="flex sm:flex-col items-center sm:items-stretch gap-3 px-5 pb-5 sm:pb-0 sm:pr-5 sm:justify-center shrink-0">
                  {isNpc ? (
                    <>
                      <Link
                        href={viewUrl}
                        className="w-full text-center bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                      >
                        Ver ficha
                      </Link>
                      {observerId ? (
                        <p className="text-[11px] leading-snug text-zinc-500 text-center sm:text-right">
                          Como você os vê — só o que seu personagem
                          descobriu em jogo aparece aqui.
                        </p>
                      ) : null}
                    </>
                  ) : isMine || !seat ? (
                    <>
                      <Link
                        href={sessionUrl}
                        className="w-full text-center bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                      >
                        Entrar na Sessão
                      </Link>
                      <div className="flex items-center justify-center gap-4 sm:flex-col sm:gap-1.5 font-mono text-[11px] uppercase tracking-widest">
                        <Link
                          href={`/player/character/${ch.id}?tab=table`}
                          className="text-zinc-500 hover:text-blue-300 transition-colors"
                        >
                          Mesa
                        </Link>
                        <Link href={sheetUrl} className="text-zinc-500 hover:text-blue-300 transition-colors">
                          Ficha
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <Link
                        href={viewUrl}
                        className="w-full text-center bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                      >
                        Ver ficha
                      </Link>
                      <p className="text-[11px] leading-snug text-zinc-500 text-center sm:text-right">
                        Como você os vê — só o que seu personagem
                        descobriu em jogo aparece aqui.
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="text-zinc-500 hover:text-blue-300 text-sm transition-colors">
          &larr; Voltar ao início
        </Link>
      </div>
    </div>
  );
}
