"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Dices,
  Loader2,
  LogIn,
  ScrollText,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  JoinRole,
  type JoinRoleValue,
  type JoinStatusResponse,
  type TableJoinCandidate,
  type TablePreview,
} from "@/lib/joinTypes";
import {
  cancelJoinRequest,
  fetchJoinCandidates,
  getJoinStatus,
  readJoinIdentity,
  submitJoinRequest,
  writeJoinIdentity,
} from "@/lib/join";

/* ============================================================
   Landing page de convite (/join/[tableId]).

   A identidade chega pela URL (papel + usuário) e é lembrada no
   namespace `vkrpg.join.<tableId>`. Nada aqui toca em vkrpg.seat /
   vkrpg.side: visitar um convite não senta ninguém nem troca a
   perspectiva. O backend confere o tipo do usuário contra o papel.
   ============================================================ */

interface JoinLandingProps {
  tableId: string;
  tableTitle: string | null;
  ownerName: string | null;
  initialRole: JoinRoleValue | null;
  initialUserId: string | null;
  tableExists: boolean;
  /** Amostra da mesa (pitch, escala, elenco). Ausente = sem painel. */
  preview: TablePreview | null;
}

const ROLE_OPTIONS: JoinRoleValue[] = [JoinRole.Player, JoinRole.CoNarrator];

export default function JoinLanding({
  tableId,
  tableTitle,
  ownerName,
  initialRole,
  initialUserId,
  tableExists,
  preview,
}: JoinLandingProps) {
  const { t } = useTranslation();

  const [role, setRole] = useState<JoinRoleValue>(initialRole ?? JoinRole.Player);
  const [userId, setUserId] = useState<string>(initialUserId ?? "");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<JoinStatusResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(initialUserId));
  const [candidates, setCandidates] = useState<TableJoinCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  /** Depois de recusado, o formulário volta a aparecer só se o usuário pedir. */
  const [retrying, setRetrying] = useState(false);

  // Hidrata a identidade lembrada. setState fica dentro de uma função — o
  // mesmo padrão do PerspectiveSwitch evita o aviso de set-state-in-effect.
  useEffect(() => {
    const stored = readJoinIdentity(tableId);
    const applyStored = () => {
      if (!initialUserId && stored.userId) setUserId(stored.userId);
      if (!initialRole && stored.role) setRole(stored.role);
    };
    applyStored();
  }, [tableId, initialUserId, initialRole]);

  // Candidatos compatíveis com o papel escolhido.
  useEffect(() => {
    if (!tableExists) return;
    let alive = true;
    void (async () => {
      setCandidatesLoading(true);
      try {
        const list = await fetchJoinCandidates(tableId, role);
        if (alive) setCandidates(list);
      } catch {
        if (alive) setCandidates([]);
      } finally {
        if (alive) setCandidatesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tableId, role, tableExists]);

  // Estado do pedido de quem está consultando.
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!tableExists) {
        setLoading(false);
        return;
      }
      if (!userId) {
        setStatus(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await getJoinStatus(tableId, userId);
        if (alive) {
          setStatus(res);
          setError(null);
        }
      } catch {
        if (alive) setError(t("jn.loadError"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tableId, userId, tableExists, t]);

  const refreshStatus = async () => {
    if (!userId) return;
    try {
      setStatus(await getJoinStatus(tableId, userId));
    } catch {
      setError(t("jn.loadError"));
    }
  };

  const submit = async () => {
    if (!userId) {
      setError(t("jn.whoEmpty"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitJoinRequest(tableId, { userId, role, message });
      writeJoinIdentity(tableId, { userId, role });
      setRetrying(false);
      await refreshStatus();
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!userId) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelJoinRequest(tableId, userId);
      await refreshStatus();
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.submitError"));
    } finally {
      setCancelling(false);
    }
  };

  /* ---------- estados impossíveis / erro ---------- */
  if (!tableExists) {
    return (
      <Card>
        <Icon tone="red">
          <XCircle className="w-5 h-5" />
        </Icon>
        <h1 className="text-lg font-bold text-zinc-100">{t("jn.notFound.title")}</h1>
        <p className="text-sm text-zinc-400 mt-1">{t("jn.notFound.body")}</p>
        <Link
          href="/"
          className="inline-block mt-4 font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md border border-zinc-700/60 text-zinc-300 hover:text-zinc-100"
        >
          {t("jn.backHome")}
        </Link>
      </Card>
    );
  }

  const request = status?.request ?? null;
  const approved = request?.status === "approved" || status?.isPlayer || status?.hasGrant;
  const pending = request?.status === "pending";
  const rejected = request?.status === "rejected" && !retrying;
  const isOwner = Boolean(status && userId && status.ownerId === userId);

  return (
    <div className="space-y-6">
      {preview ? <TablePreviewPanel preview={preview} /> : null}

      <Card>
        <div className="flex items-start gap-3">
          <Icon tone="emerald">
            <LogIn className="w-5 h-5" />
          </Icon>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-zinc-100">{t("jn.title")}</h1>
            {tableTitle ? (
              <p className="text-sm text-zinc-400 mt-0.5">
                {t("jn.guest").replace("{title}", tableTitle)}
              </p>
            ) : (
              <p className="text-sm text-zinc-400 mt-0.5">{t("jn.subtitle")}</p>
            )}
            {ownerName ? (
              <p className="font-mono text-[11px] text-zinc-500 mt-1">
                <ShieldCheck className="w-3 h-3 inline -mt-0.5 mr-1" />
                {ownerName}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-400 mt-4" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500 mt-5">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("jn.loading")}
          </p>
        ) : isOwner ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            {t("jn.alreadyOwner")}
          </div>
        ) : approved ? (
          <ApprovedCard
            tableId={tableId}
            role={request?.role ?? role}
            userId={userId || request?.user?.id || null}
          />
        ) : pending ? (
          <PendingCard cancelling={cancelling} onCancel={() => void cancel()} />
        ) : rejected ? (
          <RejectedCard onRetry={() => setRetrying(true)} />
        ) : (
          <JoinForm
            role={role}
            onRole={setRole}
            userId={userId}
            onUser={setUserId}
            candidates={candidates}
            candidatesLoading={candidatesLoading}
            message={message}
            onMessage={setMessage}
            submitting={submitting}
            onSubmit={() => void submit()}
          />
        )}
      </Card>
    </div>
  );
}

/* ---------------- pedaços de UI ---------------- */

/* Amostra da mesa exibida acima do cartão de entrada: o pitch, a escala e o
   elenco. É só um aperitivo — nada de spoiler de narrativa ou mapa. */
function TablePreviewPanel({ preview }: { preview: TablePreview }) {
  const { t } = useTranslation();
  const hasStats = preview.system !== null || preview.players > 0 || preview.npcs > 0;

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 overflow-hidden">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {t("jn.preview.title")}
          </span>
        </div>
        {preview.intro ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-300 line-clamp-5">
            {preview.intro}
          </p>
        ) : null}
      </div>

      {hasStats ? (
        <div className="flex flex-wrap gap-2 px-6 pb-4">
          {preview.system ? (
            <StatChip icon={<Dices className="w-3.5 h-3.5" />} label={preview.system} />
          ) : null}
          {preview.players > 0 ? (
            <StatChip
              icon={<Users className="w-3.5 h-3.5" />}
              label={t("jn.preview.players").replace("{n}", String(preview.players))}
            />
          ) : null}
          {preview.npcs > 0 ? (
            <StatChip
              icon={<UserRound className="w-3.5 h-3.5" />}
              label={t("jn.preview.npcs").replace("{n}", String(preview.npcs))}
            />
          ) : null}
        </div>
      ) : null}

      {preview.party.length > 0 ? (
        <div className="px-6 pb-5 pt-1 border-t border-zinc-800/60">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mt-4 mb-2.5">
            {t("jn.preview.party")}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {preview.party.map((member) => (
              <div key={member.id} className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-9 h-9 rounded-full overflow-hidden border border-zinc-700/60 bg-zinc-800 grid place-items-center">
                  {member.portraitUrl ? (
                    <img
                      src={member.portraitUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-zinc-400">
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-xs text-zinc-300 truncate max-w-[8.5rem]">{member.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1 text-[11px] text-zinc-300">
      <span className="text-emerald-400/80">{icon}</span>
      {label}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-6">{children}</div>
  );
}

function Icon({ tone, children }: { tone: "emerald" | "red"; children: React.ReactNode }) {
  const cls = tone === "red" ? "border-red-700/50 text-red-400" : "border-emerald-700/50 text-emerald-400";
  return (
    <span className={`shrink-0 w-9 h-9 rounded-lg border grid place-items-center ${cls}`}>
      {children}
    </span>
  );
}

function JoinForm({
  role,
  onRole,
  userId,
  onUser,
  candidates,
  candidatesLoading,
  message,
  onMessage,
  submitting,
  onSubmit,
}: {
  role: JoinRoleValue;
  onRole: (r: JoinRoleValue) => void;
  userId: string;
  onUser: (id: string) => void;
  candidates: TableJoinCandidate[];
  candidatesLoading: boolean;
  message: string;
  onMessage: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const roleLabel = (r: JoinRoleValue) =>
    r === JoinRole.Player ? t("jn.role.player") : t("jn.role.coNarrator");
  const known = candidates.some((c) => c.id === userId);

  return (
    <div className="mt-5 space-y-4">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
          {t("jn.role")}
        </span>
        <div className="flex gap-2">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRole(r)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                role === r
                  ? "border-emerald-600/60 bg-emerald-700/15 text-emerald-200"
                  : "border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {r === JoinRole.Player ? (
                <UserPlus className="w-4 h-4 inline -mt-0.5 mr-1.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 inline -mt-0.5 mr-1.5" />
              )}
              {roleLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
          {t("jn.who")}
        </span>
        <select
          value={userId}
          onChange={(e) => onUser(e.target.value)}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
        >
          <option value="">{t("jn.whoPh")}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.username} ({c.email})
            </option>
          ))}
          {userId && !known ? <option value={userId}>{userId}</option> : null}
        </select>
        {!candidatesLoading && candidates.length === 0 ? (
          <span className="block text-xs text-zinc-500 mt-1.5">{t("jn.noCandidates")}</span>
        ) : null}
      </label>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
          {t("jn.message")}
        </span>
        <input
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          placeholder={t("jn.messagePh")}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
        />
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!userId || submitting}
        className="w-full font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2.5 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? t("jn.submitting") : t("jn.submit")}
      </button>
    </div>
  );
}

function PendingCard({ cancelling, onCancel }: { cancelling: boolean; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Clock className="w-4 h-4" />
        {t("jn.pending.title")}
      </p>
      <p className="text-sm text-zinc-400 mt-1">{t("jn.pending.body")}</p>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
      >
        {cancelling ? t("jn.cancelling") : t("jn.cancel")}
      </button>
    </div>
  );
}

function RejectedCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
        <XCircle className="w-4 h-4" />
        {t("jn.rejected.title")}
      </p>
      <p className="text-sm text-zinc-400 mt-1">{t("jn.rejected.body")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors"
      >
        {t("jn.requestAgain")}
      </button>
    </div>
  );
}

function ApprovedCard({
  tableId,
  role,
  userId,
}: {
  tableId: string;
  role: JoinRoleValue;
  userId?: string | null;
}) {
  const { t } = useTranslation();
  const coNarrator = role === JoinRole.CoNarrator;
  // O jogador cai na mesa dele: a URL `?user=` diz quem é, para a tela mostrar
  // a própria ficha (ou a tela de boas-vindas se ainda não existir).
  const playerHref = userId
    ? `/player/table/${tableId}?user=${encodeURIComponent(userId)}`
    : `/player/table/${tableId}`;
  return (
    <div className="mt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <CheckCircle2 className="w-4 h-4" />
        {t("jn.approved.title")}
      </p>
      <p className="text-sm text-zinc-400 mt-1">
        {coNarrator ? t("jn.approved.coNarrator") : t("jn.approved.player")}
      </p>
      <Link
        href={coNarrator ? `/table/${tableId}` : playerHref}
        className="inline-block mt-4 font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors"
      >
        {coNarrator ? t("jn.openGm") : t("jn.openPlayer")}
      </Link>
    </div>
  );
}
