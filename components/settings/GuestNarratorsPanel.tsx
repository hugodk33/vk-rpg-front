"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import {
  RESOURCE_LABEL_KEY,
  TABLE_RESOURCES,
  sanitizePermissions,
  type AccessLevel,
  type PermissionMap,
  type TableAccessGrant,
  type TableAccessResponse,
  type TableResourceKey,
} from "@/lib/userTypes";

/* ============================================================
   Narradores convidados — a mesa continua sendo do narrador
   titular; o convidado só alcança os recursos liberados aqui.
   Salva sozinho, fora do botão geral de configurações.
   ============================================================ */

interface GuestNarratorsPanelProps {
  tableId: string;
  /** `narrator.userId` da mesa: quem está nesta tela de configuração. */
  actorId: string;
}

const CYCLE: Record<string, AccessLevel | undefined> = {
  none: "read",
  read: "write",
  write: undefined,
};

/** Opção do select que abre o formulário de criação, em vez de um id real. */
const NEW_SENTINEL = "__new__";

export default function GuestNarratorsPanel({
  tableId,
  actorId,
}: GuestNarratorsPanelProps) {
  const { t } = useTranslation();

  const [data, setData] = useState<TableAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Rascunho local por convidado; só vira concessão salva ao clicar em salvar. */
  const [drafts, setDrafts] = useState<Record<string, PermissionMap>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState("");
  const [newPerms, setNewPerms] = useState<PermissionMap>({});

  const [creating, setCreating] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftPassword, setDraftPassword] = useState("");

  const resetAddForm = () => {
    setAdding(false);
    setPicked("");
    setNewPerms({});
    setCreating(false);
    setDraftUsername("");
    setDraftEmail("");
    setDraftPhone("");
    setDraftPassword("");
  };

  const pickCandidate = (value: string) => {
    setPicked(value);
    setCreating(value === NEW_SENTINEL);
    if (value === NEW_SENTINEL) {
      // Convidados nunca são narradores titulares: sugiro um handle livre.
      setDraftUsername((prev) => prev || "guest_narrator");
    }
  };

  /** Cria o usuário tipo 3 e devolve o id recém-criado. */
  const createGuestUser = async (): Promise<string | null> => {
    const username = draftUsername.trim();
    const email = draftEmail.trim();
    const phone = draftPhone.trim();
    const password = draftPassword;
    if (!username || !email || !phone || !password) {
      setError(t("ga.createMissingFields"));
      return null;
    }
    setError(null);
    const created = await api<{ id?: string; userId?: string }>("/create-user", {
      method: "POST",
      body: JSON.stringify({ type: 3, username, email, phone, password, name: username }),
    });
    const id = created?.id ?? created?.userId ?? null;
    if (!id) {
      setError(t("ga.createFailed"));
      return null;
    }
    return id;
  };

  const fetchAccess = useCallback(async (): Promise<TableAccessResponse> => {
    return api<TableAccessResponse>(
      `/game-table/${tableId}/access?actor=${encodeURIComponent(actorId)}`
    );
  }, [tableId, actorId]);

  const applyData = useCallback((res: TableAccessResponse) => {
    setData(res);
    const next: Record<string, PermissionMap> = {};
    for (const g of res.grants) next[g.user_id] = sanitizePermissions(g.permissions);
    setDrafts(next);
  }, []);

  // O primeiro setState só acontece depois do await — setar de forma síncrona
  // dentro do efeito dispara render em cascata (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchAccess();
        if (cancelled) return;
        applyData(res);
      } catch {
        if (!cancelled) setError(t("ga.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAccess, applyData, t]);

  const reload = useCallback(async () => {
    try {
      applyData(await fetchAccess());
    } catch {
      setError(t("ga.loadError"));
    }
  }, [fetchAccess, applyData, t]);

  const canManage = data?.canManage ?? false;
  const grants = data?.grants ?? [];
  const candidates = data?.candidates ?? [];

  const setLevel = (userId: string, res: TableResourceKey, level?: AccessLevel) => {
    setNotice(null);
    setDrafts((prev) => {
      const current = { ...(prev[userId] ?? {}) };
      if (level) current[res] = level;
      else delete current[res];
      return { ...prev, [userId]: current };
    });
  };

  const allOf = (perms: PermissionMap, level: AccessLevel) =>
    TABLE_RESOURCES.every((r) => perms[r] === level);

  const toggleWholeTable = (perms: PermissionMap, level: AccessLevel): PermissionMap => {
    if (allOf(perms, level)) {
      const cleared: PermissionMap = {};
      return cleared;
    }
    const full: PermissionMap = {};
    for (const r of TABLE_RESOURCES) full[r] = level;
    return full;
  };

  const cycle = (userId: string, res: TableResourceKey, current?: AccessLevel) => {
    setLevel(userId, res, CYCLE[current ?? "none"]);
  };

  const saveGrant = async (userId: string) => {
    const permissions = drafts[userId] ?? {};
    if (Object.keys(sanitizePermissions(permissions)).length === 0) {
      setError(t("ga.pickAtLeastOne"));
      return;
    }
    setSavingId(userId);
    setError(null);
    try {
      await api(`/game-table/${tableId}/access`, {
        method: "PUT",
        body: JSON.stringify({ actor: actorId, user_id: userId, permissions }),
      });
      setNotice(t("ga.saved"));
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("ga.loadError"));
    } finally {
      setSavingId(null);
    }
  };

  const revoke = async (userId: string) => {
    setSavingId(userId);
    setError(null);
    try {
      await api(
        `/game-table/${tableId}/access/${encodeURIComponent(userId)}?actor=${encodeURIComponent(actorId)}`,
        { method: "DELETE" }
      );
      setNotice(t("ga.revoked"));
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("ga.loadError"));
    } finally {
      setSavingId(null);
    }
  };

  const grant = async () => {
    if (!picked) return;
    const permissions = sanitizePermissions(newPerms);
    if (Object.keys(permissions).length === 0) {
      setError(t("ga.pickAtLeastOne"));
      return;
    }
    setError(null);
    setSavingId(picked);
    try {
      const userId =
        picked === NEW_SENTINEL ? await createGuestUser() : picked;
      if (!userId) {
        setSavingId(null);
        return;
      }
      await api(`/game-table/${tableId}/access`, {
        method: "POST",
        body: JSON.stringify({ actor: actorId, user_id: userId, permissions }),
      });
      setNotice(t("ga.saved"));
      resetAddForm();
      await reload();
    } catch (e) {
      setError((e as Error)?.message ?? t("ga.loadError"));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("ga.loading")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5">06</span>
        <div>
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t("ga.title")}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">{t("ga.hint")}</p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-400 mb-3" role="alert">
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p className="text-xs text-emerald-400 mb-3" role="status">
          {notice}
        </p>
      ) : null}

      {grants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700/60 px-4 py-6 text-center">
          <p className="text-sm text-zinc-300">{t("ga.empty")}</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-prose mx-auto">{t("ga.emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grants.map((g: TableAccessGrant) => {
            const perms = drafts[g.user_id] ?? {};
            const dirty =
              JSON.stringify(sanitizePermissions(g.permissions)) !==
              JSON.stringify(sanitizePermissions(perms));
            return (
              <div
                key={g.id}
                className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">
                      {g.user?.username ?? g.user_id}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">
                      {g.user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void revoke(g.user_id)}
                          disabled={savingId === g.user_id}
                          title={t("ga.revoke")}
                          className="p-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveGrant(g.user_id)}
                          disabled={!dirty || savingId === g.user_id}
                          className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {savingId === g.user_id ? t("ga.saving") : t("ga.grant")}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {t("ga.resources")}
                  </span>
                  {canManage ? (
                    <>
                      <QuickToggle
                        label={`${t("ga.wholeTable")} — ${t("ga.read")}`}
                        active={allOf(perms, "read")}
                        onClick={() =>
                          setDrafts((p) => ({ ...p, [g.user_id]: toggleWholeTable(p[g.user_id] ?? {}, "read") }))
                        }
                      />
                      <QuickToggle
                        label={`${t("ga.wholeTable")} — ${t("ga.write")}`}
                        active={allOf(perms, "write")}
                        onClick={() =>
                          setDrafts((p) => ({ ...p, [g.user_id]: toggleWholeTable(p[g.user_id] ?? {}, "write") }))
                        }
                      />
                    </>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {TABLE_RESOURCES.map((res) => (
                    <ResourceRow
                      key={res}
                      label={t(RESOURCE_LABEL_KEY[res])}
                      level={perms[res]}
                      disabled={!canManage}
                      onClick={() => cycle(g.user_id, res, perms[res])}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage ? (
        <div className="mt-4">
          {adding ? (
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/10 p-3 space-y-3">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
                  {t("ga.candidates")}
                </span>
                <select
                  value={picked}
                  onChange={(e) => pickCandidate(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
                >
                  <option value="">—</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username} ({c.email})
                    </option>
                  ))}
                  {creating ? <option value={NEW_SENTINEL}>{t("ga.createNew")}</option> : null}
                </select>
                {candidates.length === 0 && !creating ? (
                  <span className="block text-xs text-zinc-500 mt-1.5">{t("ga.noCandidates")}</span>
                ) : null}
                {creating ? (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
                    <Field
                      label={t("ga.fUsername")}
                      value={draftUsername}
                      onChange={setDraftUsername}
                      placeholder="guest_narrator"
                    />
                    <Field
                      label={t("ga.fEmail")}
                      value={draftEmail}
                      onChange={setDraftEmail}
                      placeholder="guest@email.com"
                    />
                    <Field
                      label={t("ga.fPhone")}
                      value={draftPhone}
                      onChange={setDraftPhone}
                      placeholder="85999999999"
                    />
                    <Field
                      label={t("ga.fPassword")}
                      value={draftPassword}
                      onChange={setDraftPassword}
                      type="password"
                      placeholder="••••••"
                    />
                    <p className="sm:col-span-2 text-[11px] text-zinc-500">
                      {t("ga.createNewHint")}
                    </p>
                  </div>
                ) : null}
              </label>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {t("ga.resources")}
                  </span>
                  <QuickToggle
                    label={`${t("ga.wholeTable")} — ${t("ga.read")}`}
                    active={allOf(newPerms, "read")}
                    onClick={() => setNewPerms((p) => toggleWholeTable(p, "read"))}
                  />
                  <QuickToggle
                    label={`${t("ga.wholeTable")} — ${t("ga.write")}`}
                    active={allOf(newPerms, "write")}
                    onClick={() => setNewPerms((p) => toggleWholeTable(p, "write"))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {TABLE_RESOURCES.map((res) => (
                    <ResourceRow
                      key={res}
                      label={t(RESOURCE_LABEL_KEY[res])}
                      level={newPerms[res]}
                      onClick={() =>
                        setNewPerms((p) => {
                          const next = { ...p };
                          const lvl = CYCLE[next[res] ?? "none"];
                          if (lvl) next[res] = lvl;
                          else delete next[res];
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void grant()}
                  disabled={!picked || savingId === picked}
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                >
                  {creating ? t("ga.createAndGrant") : t("ga.grant")}
                </button>
                <button
                  type="button"
                  onClick={resetAddForm}
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="font-mono text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md border border-emerald-700/50 text-emerald-300 hover:bg-emerald-700/10 transition-colors"
            >
              + {t("ga.add")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2.5 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
      />
    </label>
  );
}

function QuickToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${
        active
          ? "border-emerald-600/60 bg-emerald-700/15 text-emerald-300"
          : "border-zinc-700/60 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function ResourceRow({
  label,
  level,
  disabled,
  onClick,
}: {
  label: string;
  level?: AccessLevel;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? undefined : t("ga.level")}
      className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
        level === "write"
          ? "border-emerald-600/60 bg-emerald-700/10"
          : level === "read"
            ? "border-sky-800/60 bg-sky-950/20"
            : "border-zinc-700/40 bg-zinc-800/20"
      } ${disabled ? "cursor-default" : "hover:border-zinc-500/70"}`}
    >
      <span
        className={`text-xs truncate ${
          level ? "text-zinc-100" : "text-zinc-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[9px] uppercase tracking-wider shrink-0 ${
          level === "write"
            ? "text-emerald-300"
            : level === "read"
              ? "text-sky-300"
              : "text-zinc-600"
        }`}
      >
        {level === "write" ? t("ga.write") : level === "read" ? t("ga.read") : "—"}
      </span>
    </button>
  );
}
