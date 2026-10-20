"use client";

/* ============================================================
   TableLobby — a mesa de um jogador.

   Três estados, na ordem em que um jogador encontra a mesa:
     • sem assento → pede para escolher quem é;
     • sem ficha   → tela de boas-vindas que leva para a criação;
     • com ficha   → as próprias fichas, para entrar na sessão, e
                     o botão de sair da mesa (desativa a ficha e
                     tira o vínculo — reversível pedindo de novo).
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Swords, UserRound } from "lucide-react";
import { leaveTable } from "@/lib/join";
import { useTranslation } from "@/lib/i18n";

interface LobbyCharacter {
  id: string;
  name: string | null;
}

interface TableLobbyProps {
  tableId: string;
  tableTitle: string | null;
  userId: string | null;
  characters: LobbyCharacter[];
}

export default function TableLobby({ tableId, tableTitle, userId, characters }: TableLobbyProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);

  const doLeave = async () => {
    if (!userId) return;
    if (!window.confirm(t("jn.lobby.confirmLeave"))) return;
    setBusy(true);
    setError(null);
    try {
      await leaveTable(tableId, userId);
      setLeft(true);
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.lobby.error"));
    } finally {
      setBusy(false);
    }
  };

  if (left) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
            {t("jn.lobby.eyebrow")}
          </p>
          <h1 className="text-2xl font-bold text-zinc-100 mt-2">{t("jn.lobby.leftTitle")}</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-prose">{t("jn.lobby.leftBody")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/join/${tableId}`}
              className="font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors"
            >
              {t("jn.lobby.requestAgain")}
            </Link>
            <Link
              href="/player"
              className="font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t("jn.backHome")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
            {t("jn.lobby.eyebrow")}
          </p>
          <h1 className="text-2xl font-bold text-zinc-100 mt-2">{t("jn.lobby.noSeatTitle")}</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-prose">{t("jn.lobby.noSeat")}</p>
          <Link
            href="/player"
            className="inline-block mt-5 font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md bg-blue-600 text-blue-950 hover:bg-blue-500 transition-colors"
          >
            {t("jn.lobby.pickSeat")}
          </Link>
        </Card>
      </div>
    );
  }

  /* ---- sem ficha na mesa: boas-vindas ---- */
  if (characters.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card>
          <p className="font-mono text-[10px] tracking-widest uppercase text-emerald-400">
            {t("jn.lobby.eyebrow")}
            {tableTitle ? ` — ${tableTitle}` : ""}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mt-2">
            {t("jn.lobby.welcomeTitle")}
          </h1>
          <p className="text-sm text-zinc-400 mt-3 max-w-prose">
            {tableTitle
              ? t("jn.lobby.welcomeBodyTable").replace("{title}", tableTitle)
              : t("jn.lobby.welcomeBody")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/player/table/${tableId}/character/new`}
              className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest px-5 py-2.5 rounded-md bg-blue-600 text-blue-950 hover:bg-blue-500 transition-colors"
            >
              <UserRound className="w-4 h-4" />
              {t("jn.lobby.create")}
            </Link>
            <button
              type="button"
              onClick={() => void doLeave()}
              disabled={busy}
              className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest px-5 py-2.5 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60 transition-colors disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {t("jn.lobby.leave")}
            </button>
          </div>

          {error ? (
            <p className="text-xs text-red-400 mt-4" role="alert">
              {error}
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  /* ---- já tem ficha: a própria mesa ---- */
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <header className="border-l-2 border-blue-600 pl-5">
        <p className="font-mono text-[10px] tracking-widest uppercase text-blue-400">
          {t("jn.lobby.eyebrow")}
          {tableTitle ? ` — ${tableTitle}` : ""}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mt-2">
          {t("jn.lobby.sheetTitle")}
        </h1>
        <p className="text-sm text-zinc-500 mt-2 max-w-prose">{t("jn.lobby.sheetHint")}</p>
      </header>

      <div className="mt-8 space-y-3">
        {characters.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-5 py-4 flex flex-wrap items-center gap-4"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100 truncate">
                {c.name || t("jn.lobby.noName")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href={`/player/character/${c.id}/session`}
                className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md bg-blue-600 text-blue-950 hover:bg-blue-500 transition-colors"
              >
                <Swords className="w-4 h-4" />
                {t("jn.lobby.enterSession")}
              </Link>
              <Link
                href={`/player/character/${c.id}`}
                className="font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
              >
                {t("jn.lobby.viewSheet")}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 max-w-prose mb-3">{t("jn.lobby.leaveHint")}</p>
        <button
          type="button"
          onClick={() => void doLeave()}
          disabled={busy}
          className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60 transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          {t("jn.lobby.leave")}
        </button>
        {error ? (
          <p className="text-xs text-red-400 mt-3" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-8">{children}</div>
  );
}
