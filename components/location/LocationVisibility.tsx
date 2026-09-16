"use client";

/* ============================================================
   LocationVisibility — per-location knowledge ledger.
   Shows, for every player observer at the table, what THIS place
   reads to them: Unknown (?), Known (masked alias) or Specialist
   (real survey). Rows are observer-global (a place isn't bound to
   a single target sheet), persisted instantly to the shared
   /game-table-visibility endpoints with location_id set.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GameTableCharacters,
  GameTableScenes,
  TableCharacter,
  VisibilityRule,
} from "@/lib/types";
import DiscoveryContext, {
  discoveryFromRule,
  type DiscoverySelection,
} from "@/components/visibility/DiscoveryContext";

type VisStatus = "unknown" | "known" | "specialist";

const STATUS_META: Record<VisStatus, { label: string; active: string }> = {
  unknown: {
    label: "?",
    active: "text-zinc-200 border-zinc-500/70 bg-zinc-600/40",
  },
  known: {
    label: "Alias",
    active: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  },
  specialist: {
    label: "Survey",
    active: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  },
};

const charName = (c: TableCharacter) => c.sheet?.name || c.name || "Unnamed";

const statusOf = (rule?: VisibilityRule): VisStatus =>
  (rule?.status as VisStatus) ?? "unknown";

export default function LocationVisibility({
  locationId,
  tableId,
}: {
  locationId: string;
  tableId?: string;
}) {
  const [characters, setCharacters] = useState<TableCharacter[]>([]);
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [scenes, setScenes] = useState<GameTableScenes | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowDiscovery, setRowDiscovery] = useState<Record<string, DiscoverySelection>>({});
  const [rowMomentOpen, setRowMomentOpen] = useState<Record<string, boolean>>({});

  const observers = useMemo(
    () => (characters ?? []).filter((c) => !c.isNpc && c.user?.id),
    [characters]
  );

  useEffect(() => {
    if (!tableId) return;
    let cancel = false;
    api<GameTableCharacters>(`/game-table-characters/${tableId}`)
      .then((d) => { if (!cancel) setCharacters(d.characters ?? []); })
      .catch(() => { if (!cancel) setCharacters([]); });
    api<GameTableScenes>(`/game-table-scenes/${tableId}`)
      .then((d) => { if (!cancel) setScenes(d ?? null); })
      .catch(() => { if (!cancel) setScenes(null); });
    return () => { cancel = true; };
  }, [tableId]);

  const index = useMemo(() => {
    const m = new Map<string, VisibilityRule>();
    for (const r of rules ?? []) {
      if (r.location_id && String(r.location_id) === String(locationId)) {
        m.set(String(r.character_id), r);
      }
    }
    return m;
  }, [rules, locationId]);

  const sync = (observerId: string) => {
    api<VisibilityRule[]>(`/game-table-visibility/${observerId}`)
      .then((d) => {
        setRules((prev) => {
          const next = (prev ?? []).filter(
            (r) => String(r.character_id) !== observerId
          );
          return [...next, ...(Array.isArray(d) ? d : [])];
        });
      })
      .catch(() => {});
  };

  const persist = async (observerId: string, status: VisStatus, value: string) => {
    const existing = index.get(observerId);
    const d = rowDiscovery[observerId];
    const body: Omit<VisibilityRule, "id"> = {
      character_id: observerId,
      other_character_id: null,
      location_id: locationId,
      status,
      value: value ?? "",
      scene_id: d ? d.sceneId ?? null : existing ? undefined : null,
      narration_id: d ? d.narrationId ?? null : existing ? undefined : null,
      moment: d ? d.moment ?? null : existing ? undefined : null,
    };
    setSavingKey(`${observerId}:${status}`);
    setError(null);
    try {
      if (existing) {
        await api("/game-table-visibility", {
          method: "PUT",
          body: JSON.stringify({ ...body, id: existing.id }),
        });
      } else {
        await api("/game-table-visibility", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      sync(observerId);
    } catch {
      setError("Failed to save this location’s visibility rule.");
    } finally {
      setSavingKey(null);
    }
  };

  if (observers.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-1 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none text-teal-300">◍</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">Knowledge</span>
        <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #2dd4bf55, transparent)" }} />
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">
        Who knows this place — ? unknown, Alias masked name, Survey real data.
      </p>

      {error ? <p className="text-[11px] text-red-400/80 mb-2">{error}</p> : null}

      <ul className="space-y-2">
        {observers.map((o) => {
          const rule = index.get(o.id);
          const status = statusOf(rule);
          const busy = savingKey === `${o.id}:${status}` || savingKey?.startsWith(o.id);
          return (
            <li key={o.id} className="flex flex-col gap-1 py-1">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 pt-1">
                  <span className="block text-sm text-zinc-200 truncate">{charName(o)}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    {status === "specialist"
                      ? "full survey"
                      : status === "known"
                      ? "masked as alias"
                      : "not yet known"}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {(["unknown", "known", "specialist"] as VisStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => persist(o.id, s, rule?.value ?? "")}
                      aria-pressed={status === s}
                      className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 disabled:opacity-40 ${
                        status === s ? STATUS_META[s].active : "text-zinc-600 border-zinc-800 hover:text-zinc-300 hover:border-zinc-600"
                      }`}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
              {status !== "specialist" ? (
                <div className="flex items-center gap-2 pl-0.5">
                  <input
                    type="text"
                    defaultValue={rule?.value ?? ""}
                    placeholder="Masked name (what the player sees)"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (rule?.value ?? "")) persist(o.id, status, v);
                    }}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-teal-700/60"
                  />
                  <span className="text-[10px] font-mono text-zinc-600 uppercase shrink-0">alias</span>
                </div>
              ) : null}
              {(() => {
                const fromRule = discoveryFromRule(rule);
                const d = rowDiscovery[o.id] ?? fromRule ?? {};
                const attached = !!rowDiscovery[o.id]
                  ? !!(rowDiscovery[o.id]!.sceneId || rowDiscovery[o.id]!.narrationId)
                  : !!fromRule;
                const open = !!rowMomentOpen[o.id];
                return (
                  <>
                    <div className="flex items-center gap-2 pl-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRowMomentOpen((p) => ({ ...p, [o.id]: !p[o.id] }))
                        }
                        aria-expanded={open}
                        title="Attach / edit when this place became known"
                        className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider rounded-full px-2 py-0.5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 ${
                          attached
                            ? "text-teal-300 border-teal-700/50 bg-teal-500/5"
                            : "text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-600"
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          />
                        </svg>
                        {attached ? "moment attached" : "moment"}
                        {fromRule && fromRule.moment != null ? (
                          <span className="text-[9px] text-zinc-500">· {fromRule.moment}</span>
                        ) : null}
                      </button>
                    </div>
                    {open ? (
                      <div className="pl-0.5">
                        <DiscoveryContext
                          scenes={scenes}
                          value={d}
                          onChange={(sel) =>
                            setRowDiscovery((p) => ({ ...p, [o.id]: sel }))
                          }
                        />
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </li>
          );
        })}
      </ul>
    </div>
  );
}