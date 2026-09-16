"use client";

/* ============================================================
   TableQuickActions — the GM&apos;s at-a-glance modifier console
   for the campaign cover page. Three one-shot moves:

   · Status — push Δ HP / Δ FP as an additive modifier (with the
     story note) straight onto the character;
   · Item   — grant an existing table item to a character and log
     the award as a modifier record;
   · Exp.   — award (or spend) campaign points on the sheet and
     log it as a modifier record.

   Every move follows the same doctrine as ModifiersPanel: the
   base sheet composes from these rows, nothing is rewritten, and
   each action stays replayable by story moment.
   ============================================================ */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export interface QuickTarget {
  id: string;
  name: string;
  kind: "player" | "npc";
  hp: number | null;
  baseHp: number | null;
  points: number | null;
}

export interface QuickItem {
  id: string;
  name: string;
}

const EQUIP_STATUS: { value: string; label: string }[] = [
  { value: "in_inventory", label: "In inventory" },
  { value: "equipped", label: "Equipped" },
  { value: "wielded", label: "Wielded" },
];

const fieldCls =
  "w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-teal-700/60 focus:outline-none";

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const VALIDATION = "_validation_error_";

interface Done {
  kind: "status" | "item" | "xp";
  summary: string;
}

export default function TableQuickActions({
  tableId,
  targets,
  items,
}: {
  tableId: string;
  targets: QuickTarget[];
  items: QuickItem[];
}) {
  const router = useRouter();

  const [targetId, setTargetId] = useState("");
  const [mode, setMode] = useState<"status" | "item" | "xp">("status");

  const [hpDelta, setHpDelta] = useState("");
  const [fpDelta, setFpDelta] = useState("");
  const [note, setNote] = useState("");

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [eqStatus, setEqStatus] = useState("in_inventory");

  const [xpDelta, setXpDelta] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);

  const target = targets.find((t) => t.id === targetId) ?? null;
  const itemName = items.find((i) => i.id === itemId)?.name ?? "";

  const reset = () => {
    setHpDelta("");
    setFpDelta("");
    setNote("");
    setItemId("");
    setQty("1");
    setEqStatus("in_inventory");
    setXpDelta("");
    setError(null);
  };

  const applyStatus = async (): Promise<string> => {
    const modHp = num(hpDelta);
    const modFp = num(fpDelta);
    if (modHp == null && modFp == null) {
      setError("Enter a HP and/or FP delta.");
      throw new Error(VALIDATION);
    }
    const chips = [
      modHp != null ? `${modHp > 0 ? "+" : ""}${modHp} HP` : "",
      modFp != null ? `${modFp > 0 ? "+" : ""}${modFp} FP` : "",
      note.trim(),
    ].filter(Boolean);
    const summary = chips.join(", ");
    await api("/game-table-modifier", {
      method: "POST",
      body: JSON.stringify({
        character_id: targetId,
        name: note.trim() || "Status update",
        mod_hp: modHp,
        mod_fatigue: modFp,
        description: summary,
        effect: summary,
      }),
    });
    return summary;
  };

  const applyItem = async (): Promise<string> => {
    const q = num(qty);
    if (q == null || q < 1 || Math.round(q) !== q) {
      setError("Item quantity must be a whole number ≥ 1.");
      throw new Error(VALIDATION);
    }
    if (!itemName) {
      setError("Pick an item to grant.");
      throw new Error(VALIDATION);
    }
    const summary = `+${q}× ${itemName} · ${EQUIP_STATUS.find((s) => s.value === eqStatus)?.label ?? eqStatus}`;
    await api("/game-table-item/grant", {
      method: "POST",
      body: JSON.stringify({
        character_id: targetId,
        item_id: itemId,
        quantity: q,
        status: eqStatus,
        name: note.trim() || `Granted ${itemName}`,
        description: note.trim() || `+${q}× ${itemName}`,
      }),
    });
    return summary;
  };

  const applyXp = async (): Promise<string> => {
    const delta = num(xpDelta);
    if (delta == null || delta === 0) {
      setError("Enter a signed point delta (e.g. 10 or -5).");
      throw new Error(VALIDATION);
    }
    const summary = `${delta > 0 ? "+" : ""}${delta} points${note.trim() ? ` · ${note.trim()}` : ""}`;
    await api("/game-table-character/points", {
      method: "POST",
      body: JSON.stringify({
        character_id: targetId,
        points: delta,
        name: note.trim() || (delta > 0 ? "Experience award" : "Experience cost"),
        description: note.trim() || `${delta > 0 ? "+" : ""}${delta} campaign points`,
      }),
    });
    return summary;
  };

  const run = async () => {
    if (!target) {
      setError("Pick a target character first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let summary = "";
      if (mode === "status") summary = await applyStatus();
      else if (mode === "item") summary = await applyItem();
      else summary = await applyXp();
      setDone((d) => [{ kind: mode, summary: `${target.name}: ${summary}` }, ...d].slice(0, 6));
      reset();
      router.refresh();
    } catch (e) {
      if (e instanceof Error && e.message !== VALIDATION) {
        setError("Failed to apply. Check that the table API is reachable.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 overflow-hidden">
      {error ? (
        <div className="border-b border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>
      ) : null}

      <div className="p-4">
        <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-3">
          Target
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={fieldCls} disabled={targets.length === 0}>
            <option value="">{targets.length === 0 ? "No character with a sheet yet" : "Pick a character…"}</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {(t.baseHp ?? 0) > 0 ? `${t.hp ?? t.baseHp}/${t.baseHp} HP` : ""} · {(t.points != null ? t.points : "")} pts
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-[9rem_1fr]">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Move</span>
            <div className="flex flex-col gap-1">
              {([["status", "Status"], ["item", "Item"], ["xp", "Exp."]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`font-mono text-[10px] uppercase tracking-widest rounded-md px-3 py-1.5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 ${
                    mode === key
                      ? "bg-teal-500/10 border-teal-500/40 text-teal-300"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            {mode === "status" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Δ HP
                    <input type="number" value={hpDelta} onChange={(e) => setHpDelta(e.target.value)} placeholder={`target ${target?.hp ?? "?"} HP`} className={fieldCls} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Δ FP
                    <input type="number" value={fpDelta} onChange={(e) => setFpDelta(e.target.value)} placeholder="−2, +1…" className={fieldCls} />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Note (why)
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Goblin blade, First aid…" className={fieldCls} />
                </label>
              </div>
            ) : null}

            {mode === "item" ? (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Item
                  <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={fieldCls} disabled={items.length === 0}>
                    <option value="">{items.length === 0 ? "No items on file" : "Pick an item…"}</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Quantity
                    <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldCls} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    State
                    <select value={eqStatus} onChange={(e) => setEqStatus(e.target.value)} className={fieldCls}>
                      {EQUIP_STATUS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Note (why)
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Loot from the ambush…" className={fieldCls} />
                </label>
              </div>
            ) : null}

            {mode === "xp" ? (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Points (signed)
                  <input type="number" value={xpDelta} onChange={(e) => setXpDelta(e.target.value)} placeholder="10, −5…" className={fieldCls} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Note (why)
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Survived the ritual…" className={fieldCls} />
                </label>
              </div>
            ) : null}

            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-800">
              <button
                type="button"
                disabled={busy || !target}
                onClick={run}
                className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
              >
                {busy ? "Applying…" : "Apply"}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                {mode === "status" ? "logs an additive modifier" : mode === "item" ? "grants + logs the item" : "adds sheet points + logs"}
              </span>
            </div>
          </div>
        </div>

        {done.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {done.map((d, i) => (
              <li key={`${i}-${d.summary}`} className="flex items-start gap-2 font-mono text-[10px] uppercase tracking-widest">
                <span className={d.kind === "item" ? "text-amber-400/90" : d.kind === "xp" ? "text-violet-400/90" : "text-rose-300/90"}>
                  {d.kind === "status" ? "◆" : d.kind === "item" ? "◇" : "✚"}
                </span>
                <span className="text-zinc-500">{d.summary}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}