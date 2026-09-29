"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { CURRENCY_PRESETS, DEFAULT_CURRENCY_PRESET } from "@/lib/currency";
import type { CurrencyPreset } from "@/lib/currency";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import type { Item, TableCurrency, TableSettings } from "@/lib/types";

/* ============================================================
   Table Settings — regras de mesa configuráveis por tabela.
   Cada grupo é uma escolha de duas vias (modo de jogo).
   ============================================================ */

interface ChoiceProps {
  active: boolean;
  onClick?: () => void;
  title: string;
  tag: string;
  body: string;
  disabled?: boolean;
}

function Choice({ active, onClick, title, tag, body, disabled }: ChoiceProps) {
  const activeCls = active
    ? "border-emerald-500/60 bg-emerald-700/10 ring-1 ring-emerald-500/30"
    : "border-zinc-700/50 bg-zinc-800/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 text-left rounded-xl border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 disabled:opacity-40 disabled:cursor-not-allowed ${activeCls}`}
    >
      <span className="flex items-center gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${active ? "text-emerald-300" : "text-zinc-500"}`}>
          {tag}
        </span>
        {active ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </span>
      <span className="block text-sm font-semibold text-zinc-100 mt-1">{title}</span>
      <span className="block text-xs text-zinc-500 mt-1 leading-snug">{body}</span>
    </button>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5">{index}</span>
        <div>
          <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface TableSettingsPanelProps {
  tableId: string;
  initialSettings: TableSettings | null;
  items: Item[];
}

export default function TableSettingsPanel({
  tableId,
  initialSettings,
  items,
}: TableSettingsPanelProps) {
  const { t } = useTranslation();
  const s = initialSettings ?? {
    table_id: tableId,
    turn_end_mode: "after_test" as const,
    item_mode: "gm" as const,
    reaction_mode: "gm" as const,
    gm_adds_item: 1,
    money_item_id: null,
    starting_shop: 0,
    starting_points: 0,
    currencies: [] as TableCurrency[],
  };
  const [turnEndMode, setTurnEndMode] = useState<"after_test" | "after_move">(s.turn_end_mode);
  const [itemMode, setItemMode] = useState<"points" | "gm">(s.item_mode);
  const [reactionMode, setReactionMode] = useState<"points" | "gm">(s.reaction_mode);
  const [gmAddsItem, setGmAddsItem] = useState(Boolean(s.gm_adds_item));
  // A maioria das mesas usa UMA moeda, então o padrão já vem escolhido; as
  // extras são só para quem realmente precisa de mais de uma.
  const [standard, setStandard] = useState<CurrencyPreset>(DEFAULT_CURRENCY_PRESET);
  const [standardAmount, setStandardAmount] = useState(0);
  const [extras, setExtras] = useState<TableCurrency[]>(s.currencies ?? []);
  const [startingShop, setStartingShop] = useState(Boolean(s.starting_shop));
  const [startingPoints, setStartingPoints] = useState(s.starting_points ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao abrir uma mesa já configurada, o padrão passa a ser a moeda que ela já
  // tem (caso contrário o catálogo padrão sobrescreveria o que foi escolhido).
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated) {
    setHydrated(true);
    const first = (s.currencies ?? [])[0]
    if (first) {
      setStandard({
        value: first.item_id ?? first.name ?? "generic",
        name: first.name ?? DEFAULT_CURRENCY_PRESET.name,
        label: first.name ?? DEFAULT_CURRENCY_PRESET.label,
        symbol: DEFAULT_CURRENCY_PRESET.symbol,
      })
      setExtras((s.currencies ?? []).slice(1))
      setStandardAmount(first.starting_amount ?? 0)
    }
  }

  // Uma moeda por linha nas extras: escolhe o item e quanto o mestre dá.
  function addExtra() {
    const used = new Set(extras.map((c) => c.item_id).filter(Boolean))
    used.add(standard.name)
    const next = items.find((it) => !used.has(it.id))
    setExtras((prev) => [
      ...prev,
      next ? { item_id: next.id, name: next.name, starting_amount: 0 } : { name: "", starting_amount: 0 },
    ])
  }

  function setExtra(index: number, patch: Partial<TableCurrency>) {
    setExtras((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function removeExtra(index: number) {
    setExtras((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await api("/game-table-settings", {
        method: "PUT",
        body: JSON.stringify({
          table_id: tableId,
          turn_end_mode: turnEndMode,
          item_mode: itemMode,
          reaction_mode: reactionMode,
          gm_adds_item: gmAddsItem ? 1 : 0,
          currencies: [
            { name: standard.name, starting_amount: standardAmount },
            ...extras.filter((c) => c.item_id || c.name),
          ],
          starting_shop: startingShop ? 1 : 0,
          starting_points: startingPoints,
        }),
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section
        index="01"
        title={t("vs.sp.s1Title")}
        hint={t("vs.sp.s1Hint")}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={turnEndMode === "after_test"}
            onClick={() => setTurnEndMode("after_test")}
            tag={t("vs.sp.s1TagA")}
            title={t("vs.sp.s1TitleA")}
            body={t("vs.sp.s1BodyA")}
          />
          <Choice
            active={turnEndMode === "after_move"}
            onClick={() => setTurnEndMode("after_move")}
            tag={t("vs.sp.s1TagB")}
            title={t("vs.sp.s1TitleB")}
            body={t("vs.sp.s1BodyB")}
          />
        </div>
      </Section>

      <Section
        index="02"
        title={t("vs.sp.s2Title")}
        hint={t("vs.sp.s2Hint")}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={itemMode === "points"}
            onClick={() => setItemMode("points")}
            tag={t("vs.sp.tagPoints")}
            title={t("vs.sp.s2TitleA")}
            body={t("vs.sp.s2BodyA")}
          />
          <Choice
            active={itemMode === "gm"}
            onClick={() => setItemMode("gm")}
            tag={t("vs.sp.tagGm")}
            title={t("vs.sp.s2TitleB")}
            body={t("vs.sp.s2BodyB")}
          />
        </div>
      </Section>

      <Section
        index="03"
        title={t("vs.sp.s3Title")}
        hint={t("vs.sp.s3Hint")}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Choice
            active={reactionMode === "points"}
            onClick={() => setReactionMode("points")}
            tag={t("vs.sp.tagPoints")}
            title={t("vs.sp.s3TitleA")}
            body={t("vs.sp.s3BodyA")}
          />
          <Choice
            active={reactionMode === "gm"}
            onClick={() => setReactionMode("gm")}
            tag={t("vs.sp.tagGm")}
            title={t("vs.sp.s3TitleB")}
            body={t("vs.sp.s3BodyB")}
          />
        </div>
      </Section>

      <Section
        index="04"
        title={t("vs.sp.s4Title")}
        hint={t("vs.sp.s4Hint")}
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={gmAddsItem}
              onChange={(e) => setGmAddsItem(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-100">{t("vs.sp.gmAddsTitle")}</span>
              <span className="block text-xs text-zinc-500 mt-0.5">
                {t("vs.sp.gmAddsBody")}
              </span>
            </span>
          </label>

          {/* ---- moeda padrão: uma só, como em LOCATION_KINDS ---- */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {t("vs.sp.standardCurrency")}
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CURRENCY_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setStandard(p)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    standard.value === p.value
                      ? "border-emerald-600/70 bg-emerald-900/20"
                      : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
                  }`}
                >
                  <span className="block text-sm font-medium text-zinc-200">
                    {t(`vs.sp.cur.${p.value}`)}
                  </span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{p.symbol}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-zinc-500">{t("vs.sp.startingAmount")}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={standardAmount}
                onChange={(e) =>
                  setStandardAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
                className="w-24 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
              />
              <span className="text-xs text-zinc-500">{standard.name}</span>
            </div>
            <p className="text-xs text-zinc-500">{t("vs.sp.currenciesBody")}</p>
          </div>

          {/* ---- outras moedas: a exceção ---- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {t("vs.sp.extraCurrencies")}
              </span>
              <button
                type="button"
                onClick={addExtra}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {t("vs.sp.addCurrency")}
              </button>
            </div>

            {extras.length === 0 ? (
              <p className="text-xs text-zinc-500">{t("vs.sp.singleCurrency")}</p>
            ) : (
              <ul className="space-y-2">
                {extras.map((c, i) => {
                  const used = new Set(
                    extras.filter((_, j) => j !== i).map((o) => o.item_id).filter(Boolean)
                  )
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <select
                        value={c.item_id ?? ""}
                        onChange={(e) => {
                          const it = items.find((x) => x.id === e.target.value)
                          setExtra(i, { item_id: e.target.value, name: it?.name ?? c.name })
                        }}
                        className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
                      >
                        <option value="" className="bg-zinc-800">
                          {t("vs.sp.pickCurrency")}
                        </option>
                        {items.map((it) => (
                          <option
                            key={it.id}
                            value={it.id}
                            disabled={used.has(it.id)}
                            className="bg-zinc-800"
                          >
                            {it.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={c.starting_amount}
                        onChange={(e) =>
                          setExtra(i, {
                            starting_amount: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          })
                        }
                        aria-label={t("vs.sp.startingAmount")}
                        className="w-24 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
                      />
                      <button
                        type="button"
                        onClick={() => removeExtra(i)}
                        aria-label={t("vs.sp.removeCurrency")}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={startingShop}
                onChange={(e) => setStartingShop(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{t("vs.sp.shopTitle")}</span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  {t("vs.sp.shopBody")}
                </span>
              </span>
            </label>
          </div>
        </div>
      </Section>

      <Section
        index="05"
        title={t("vs.sp.s5Title")}
        hint={t("vs.sp.s5Hint")}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[100, 150, 200, 250].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStartingPoints(n)}
                className={`font-mono text-sm font-bold tabular-nums px-4 py-2 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 ${
                  startingPoints === n
                    ? "border-emerald-500/60 bg-emerald-700/10 text-emerald-300"
                    : "border-zinc-700/50 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
              {t("vs.sp.customValue")}
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              value={startingPoints || ""}
              placeholder={t("vs.sp.noPoints")}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value === "") setStartingPoints(0);
                else if (Number.isFinite(v) && v >= 0) setStartingPoints(Math.floor(v));
              }}
              className="w-full max-w-xs bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-600/60"
            />
            <span className="block text-xs text-zinc-500 mt-1.5">
              {t("vs.sp.customValueBody")}
            </span>
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="font-mono text-[12px] font-semibold uppercase tracking-widest px-5 py-2.5 rounded-lg bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? t("vs.sp.saving") : t("vs.sp.save")}
        </button>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    </div>
  );
}