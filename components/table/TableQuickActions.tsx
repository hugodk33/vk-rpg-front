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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { TableSettings } from "@/lib/types";

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
  cost?: number;
}

const EQUIP_STATUS: { value: string; label: string }[] = [
  { value: "in_inventory", label: "qa.equip.in_inventory" },
  { value: "equipped", label: "qa.equip.equipped" },
  { value: "wielded", label: "qa.equip.wielded" },
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
  const { t } = useTranslation();

  const [tableSettings, setTableSettings] = useState<TableSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game-table-settings/${tableId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setTableSettings(j as TableSettings);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tableId]);

  /* item custa pontos da ficha quando a mesa usa 'points' e o mestre não
     o adiciona de graça (gm_adds_item) */
  const pointsMode = tableSettings?.item_mode === "points" && !tableSettings.gm_adds_item;

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
      setError(t("qa.err.hpFp"));
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
        name: note.trim() || "Atualização de status",
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
      setError(t("qa.err.qty"));
      throw new Error(VALIDATION);
    }
    if (!itemName) {
      setError(t("qa.err.item"));
      throw new Error(VALIDATION);
    }
    const unitCost = items.find((i) => i.id === itemId)?.cost;
    const totalCost = pointsMode ? (unitCost ?? 0) * q : 0;
    if (pointsMode) {
      if (unitCost == null) {
        setError(t("qa.err.points"));
        throw new Error(VALIDATION);
      }
      const have = target?.points ?? 0;
      if (have < totalCost) {
        setError(interpolate(t("qa.err.notEnough"), { target: target?.name ?? "?", have, q, name: itemName, total: totalCost }));
        throw new Error(VALIDATION);
      }
    }
    const statusLabel = EQUIP_STATUS.find((s) => s.value === eqStatus)?.label ?? eqStatus;
    const summary = `+${q}× ${itemName}${pointsMode ? ` · −${totalCost} pts` : ""} · ${t(statusLabel)}`;
    await api("/game-table-item/grant", {
      method: "POST",
      body: JSON.stringify({
        character_id: targetId,
        item_id: itemId,
        quantity: q,
        status: eqStatus,
        name: note.trim() || (pointsMode ? `${itemName} (compra)` : `Concedido ${itemName}`),
        description: note.trim() || (pointsMode ? `${q}× ${itemName} · −${totalCost} pts` : `+${q}× ${itemName}`),
      }),
    });
    if (pointsMode) {
      /* cobra o custo da ficha como gasto de pontos, sempre depois do grant */
      await api("/game-table-character/points", {
        method: "POST",
        body: JSON.stringify({
          character_id: targetId,
          points: -totalCost,
          name: `Comprado ${itemName}`,
          description: `−${totalCost} points · ${q}× ${itemName}`,
        }),
      });
    }
    return summary;
  };

  const applyXp = async (): Promise<string> => {
    const delta = num(xpDelta);
    if (delta == null || delta === 0) {
      setError(t("qa.err.pointsSigned"));
      throw new Error(VALIDATION);
    }
    const summary = `${delta > 0 ? "+" : ""}${delta} points${note.trim() ? ` · ${note.trim()}` : ""}`;
    await api("/game-table-character/points", {
      method: "POST",
      body: JSON.stringify({
        character_id: targetId,
        points: delta,
        name: note.trim() || (delta > 0 ? "Prêmio de experiência" : "Custo de experiência"),
        description: note.trim() || `${delta > 0 ? "+" : ""}${delta} pontos de campanha`,
      }),
    });
    return summary;
  };

  const run = async () => {
    if (!target) {
      setError(t("qa.err.target"));
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
        setError(t("qa.err.api"));
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
          {t("qa.target")}
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={fieldCls} disabled={targets.length === 0}>
            <option value="">{targets.length === 0 ? t("qa.noTargets") : t("qa.chooseTarget")}</option>
            {targets.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name} · {(tr.baseHp ?? 0) > 0 ? interpolate(t("qa.hpVal"), { cur: tr.hp ?? tr.baseHp ?? 0, max: tr.baseHp ?? 0 }) : ""} · {(tr.points != null ? tr.points : "")} pts
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-[9rem_1fr]">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{t("qa.action")}</span>
            <div className="flex flex-col gap-1">
              {([["status", "qa.status"], ["item", "qa.item"], ["xp", "qa.xp"]] as const).map(([key, labelKey]) => (
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
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            {mode === "status" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {t("qa.hp")}
                    <input type="number" value={hpDelta} onChange={(e) => setHpDelta(e.target.value)} placeholder={interpolate(t("qa.hpPh"), { hp: target?.hp ?? "?" })} className={fieldCls} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {t("qa.fp")}
                    <input type="number" value={fpDelta} onChange={(e) => setFpDelta(e.target.value)} placeholder={t("qa.fpPh")} className={fieldCls} />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("qa.note")}
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("qa.noteHpPh")} className={fieldCls} />
                </label>
              </div>
            ) : null}

            {mode === "item" ? (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("qa.item")}
                  <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={fieldCls} disabled={items.length === 0}>
                    <option value="">{items.length === 0 ? t("qa.noItems") : t("qa.chooseItem")}</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {pointsMode ? (i.cost != null ? ` · ${interpolate(t("qa.ptsEach"), { n: i.cost })}` : ` · ${t("qa.noCost")}`) : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {t("qa.quantity")}
                    <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldCls} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {t("qa.state")}
                    <select value={eqStatus} onChange={(e) => setEqStatus(e.target.value)} className={fieldCls}>
                      {EQUIP_STATUS.map((s) => (
                        <option key={s.value} value={s.value}>{t(s.label)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("qa.note")}
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("qa.noteItemPh")} className={fieldCls} />
                </label>
                {pointsMode ? (
                  <p className="text-[11px] text-amber-300/90">
                    {interpolate(t("qa.itemPointsWarn"), { name: target?.name ?? "?", pts: target?.points ?? 0 })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === "xp" ? (
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("qa.pointsSigned")}
                  <input type="number" value={xpDelta} onChange={(e) => setXpDelta(e.target.value)} placeholder={t("qa.ptsPh")} className={fieldCls} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {t("qa.note")}
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("qa.noteXpPh")} className={fieldCls} />
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
                {busy ? t("qa.applying") : t("qa.apply")}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                {mode === "status" ? t("qa.hint.status") : mode === "item" ? t("qa.hint.item") : t("qa.hint.xp")}
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