"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  JoinRole,
  TableMemberRole,
  type JoinRequestsResponse,
  type JoinRoleValue,
  type TableJoinRequest,
  type TableMember,
  type TableMembersResponse,
} from "@/lib/joinTypes";
import {
  fetchJoinRequests,
  fetchTableMembers,
  removeTableMember,
  resolveJoinRequest,
  setMemberMuted,
} from "@/lib/join";

/* ============================================================
   Painel do dono — "Elenco da mesa".

   Reúne, num só painel: quem está vinculado à mesa (dono,
   co-narradores e jogadores) com as ações de silenciar/remover;
   os pedidos de entrada pendentes; e os links de convite.

   Silenciar congela as AÇÕES de um jogador na sessão (o backend
   recusa ação, fila e fim de turno). Remover tira o vínculo e
   desativa a ficha — reversível: o jogador pede de novo e o dono
   reaprova.
   ============================================================ */

interface TableMembersPanelProps {
  tableId: string;
  /** `narrator.userId` da mesa: quem está nesta tela de configuração. */
  actorId: string;
}

const roleLabelKey = (role: JoinRoleValue) =>
  role === JoinRole.CoNarrator ? "jn.req.roleCoNarrator" : "jn.req.rolePlayer";

export default function TableMembersPanel({ tableId, actorId }: TableMembersPanelProps) {
  const { t } = useTranslation();

  const [members, setMembers] = useState<TableMembersResponse | null>(null);
  const [requests, setRequests] = useState<JoinRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // A origem só existe no cliente; hidrata depois do mount.
  useEffect(() => {
    const applyOrigin = () => setOrigin(window.location.origin);
    applyOrigin();
  }, []);

  const load = useCallback(
    () =>
      Promise.all([fetchTableMembers(tableId, actorId), fetchJoinRequests(tableId, actorId)]),
    [tableId, actorId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [membersRes, requestsRes] = await load();
        if (cancelled) return;
        setMembers(membersRes);
        setRequests(requestsRes);
      } catch {
        if (!cancelled) setError(t("jn.mem.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const reload = useCallback(async () => {
    try {
      const [membersRes, requestsRes] = await load();
      setMembers(membersRes);
      setRequests(requestsRes);
    } catch {
      setError(t("jn.mem.loadError"));
    }
  }, [load, t]);

  const resolve = async (userId: string, action: "approve" | "reject") => {
    setBusyId(userId);
    setError(null);
    setNotice(null);
    try {
      await resolveJoinRequest(tableId, userId, actorId, action);
      setNotice(t("jn.req.done"));
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.req.loadError"));
    } finally {
      setBusyId(null);
    }
  };

  const toggleMute = async (member: TableMember) => {
    setBusyId(member.userId);
    setError(null);
    setNotice(null);
    try {
      await setMemberMuted(tableId, member.userId, actorId, !member.isMuted);
      setNotice(member.isMuted ? t("jn.mem.unmutedNotice") : t("jn.mem.mutedNotice"));
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.req.loadError"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member: TableMember) => {
    const name = member.characterName || member.username || member.userId;
    if (!window.confirm(t("jn.mem.confirmRemove").replace("{name}", name))) return;
    setBusyId(member.userId);
    setError(null);
    setNotice(null);
    try {
      await removeTableMember(tableId, member.userId, actorId);
      setNotice(t("jn.mem.removed"));
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("jn.req.loadError"));
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (role: JoinRoleValue) => {
    const url = `${origin}/join/${tableId}?role=${role}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(role);
      setNotice(t("jn.req.copied"));
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(url);
    }
  };

  const allRequests = requests?.requests ?? [];
  const pending = allRequests.filter((r) => r.status === "pending");
  const resolved = allRequests.filter((r) => r.status !== "pending");
  const roster = members?.members ?? [];

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("jn.mem.loading")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5">07</span>
        <div>
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t("jn.mem.title")}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">{t("jn.mem.hint")}</p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-400 mb-3 break-all" role="alert">
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p className="text-xs text-emerald-400 mb-3" role="status">
          {notice}
        </p>
      ) : null}

      {/* ---- elenco atual ---- */}
      <div className="space-y-2">
        {roster.map((m) => (
          <MemberRow
            key={`${m.role}:${m.userId}`}
            member={m}
            busy={busyId === m.userId}
            onToggleMute={() => void toggleMute(m)}
            onRemove={() => void remove(m)}
          />
        ))}
      </div>

      {/* ---- pedidos pendentes ---- */}
      <div className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
          {t("jn.req.pending")}
        </p>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700/60 px-4 py-5 text-center">
            <p className="text-sm text-zinc-400">{t("jn.req.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                busy={busyId === r.user_id}
                onApprove={() => void resolve(r.user_id, "approve")}
                onReject={() => void resolve(r.user_id, "reject")}
              />
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 ? (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
            {t("jn.req.resolved")}
          </p>
          <div className="space-y-2">
            {resolved.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2"
              >
                <span className="text-xs text-zinc-400 truncate">
                  {r.user?.username ?? r.user_id}
                </span>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- convites ---- */}
      <div className="mt-5 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
          {t("jn.req.invite")}
        </p>
        <p className="text-[11px] text-zinc-500 mb-3 max-w-prose">{t("jn.req.inviteHint")}</p>
        <div className="space-y-2">
          <InviteRow
            label={t("jn.req.asPlayer")}
            url={`${origin}/join/${tableId}?role=${JoinRole.Player}`}
            copied={copied === JoinRole.Player}
            onCopy={() => void copy(JoinRole.Player)}
          />
          <InviteRow
            label={t("jn.req.asCoNarrator")}
            url={`${origin}/join/${tableId}?role=${JoinRole.CoNarrator}`}
            copied={copied === JoinRole.CoNarrator}
            onCopy={() => void copy(JoinRole.CoNarrator)}
          />
        </div>
      </div>
    </div>
  );
}

const memberRoleKey: Record<string, string> = {
  [TableMemberRole.Owner]: "jn.mem.owner",
  [TableMemberRole.CoNarrator]: "jn.mem.coNarrator",
  [TableMemberRole.Player]: "jn.mem.player",
};

function MemberRow({
  member,
  busy,
  onToggleMute,
  onRemove,
}: {
  member: TableMember;
  busy: boolean;
  onToggleMute: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isPlayer = member.role === TableMemberRole.Player;
  const isOwner = member.role === TableMemberRole.Owner;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5">
      <span className="shrink-0 text-zinc-500">
        {isOwner ? (
          <Crown className="w-4 h-4 text-amber-300" />
        ) : isPlayer ? (
          <UserPlus className="w-4 h-4 text-emerald-400" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-sky-400" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100 truncate">
          {member.characterName || member.username || member.userId}
          {isPlayer && member.isMuted ? (
            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-amber-300 border border-amber-700/50 rounded px-1.5 py-0.5 align-middle">
              <VolumeX className="w-3 h-3" />
              {t("jn.mem.muted")}
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-zinc-500 font-mono truncate">
          {member.username || member.email || member.userId}
          {isPlayer && member.characterName ? (
            <span className="text-zinc-600">
              {" · "}
              {member.characterActive ? member.characterName : t("jn.mem.inactive")}
            </span>
          ) : null}
          {isPlayer && !member.characterId ? (
            <span className="text-zinc-600"> · {t("jn.mem.noCharacter")}</span>
          ) : null}
        </p>
      </div>

      <span
        className={`shrink-0 font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
          isOwner
            ? "border-amber-800/60 text-amber-300"
            : isPlayer
              ? "border-emerald-800/60 text-emerald-300"
              : "border-sky-800/60 text-sky-300"
        }`}
      >
        {t(memberRoleKey[member.role] ?? "jn.mem.player")}
      </span>

      {isPlayer ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            disabled={busy}
            title={member.isMuted ? t("jn.mem.unmute") : t("jn.mem.mute")}
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-40 ${
              member.isMuted
                ? "border-emerald-700/60 text-emerald-300 hover:bg-emerald-700/10"
                : "border-amber-700/60 text-amber-300 hover:bg-amber-700/10"
            }`}
          >
            {member.isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {member.isMuted ? t("jn.mem.unmute") : t("jn.mem.mute")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title={t("jn.mem.remove")}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60 transition-colors disabled:opacity-40"
          >
            <UserMinus className="w-3.5 h-3.5" />
            {t("jn.mem.remove")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RequestRow({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: TableJoinRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const coNarrator = request.role === JoinRole.CoNarrator;
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">
            {request.user?.username ?? request.user_id}
          </p>
          <p className="text-[11px] text-zinc-500 font-mono truncate">{request.user?.email}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
            coNarrator
              ? "border-sky-800/60 text-sky-300"
              : "border-emerald-800/60 text-emerald-300"
          }`}
        >
          {coNarrator ? (
            <ShieldCheck className="w-3 h-3" />
          ) : (
            <UserPlus className="w-3 h-3" />
          )}
          {t(roleLabelKey(request.role))}
        </span>
      </div>

      {request.message ? (
        <p className="text-xs text-zinc-400 mb-3 italic">“{request.message}”</p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
        >
          {t("jn.req.approve")}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60 transition-colors disabled:opacity-40"
        >
          {t("jn.req.reject")}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const approved = status === "approved";
  return (
    <span
      className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${
        approved
          ? "border-emerald-800/60 text-emerald-300"
          : "border-red-800/60 text-red-300"
      }`}
    >
      {approved ? t("jn.req.approved") : t("jn.req.rejected")}
    </span>
  );
}

function InviteRow({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 w-28 shrink-0">
        {label}
      </span>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-700/50 rounded-md px-2.5 py-1.5 text-zinc-300 text-xs font-mono focus:outline-none focus:border-emerald-600/60"
      />
      <button
        type="button"
        onClick={onCopy}
        title={t("jn.req.copy")}
        className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-md border border-emerald-700/50 text-emerald-300 hover:bg-emerald-700/10 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t("jn.req.copied") : t("jn.req.copy")}
      </button>
    </div>
  );
}
