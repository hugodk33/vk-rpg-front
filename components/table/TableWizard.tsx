"use client";

/* ============================================================
   TableWizard — montagem da mesa em 3 passos.
   Identidade → Kit inicial → Pontos da ficha.
   Paleta e estrutura espelham a rota /table (ledger): hero com
   anéis verdes, linha de status mono e barra de passos no padrão
   TableTabs. Copia segue o idioma do LanguageSwitch (default EN).
   Ao final, cria a mesa com os módulos e grava o orçamento de
   pontos nas regras (game_table_settings).
   ============================================================ */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "../forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { ContentCatalog } from "@/lib/types";

const mono = "font-mono uppercase tracking-widest text-[11px]";

interface TableWizardProps {
  narratorOptions: Array<{ id: string; name: string }>;
  defaultNarratorId?: string;
  catalog: ContentCatalog | null;
}

const DOMAINS: Array<{ key: string; domain: string }> = [
  { key: "c.skills", domain: "skill" },
  { key: "c.items", domain: "item" },
  { key: "c.npcs", domain: "npc" },
  { key: "c.advantages", domain: "advantage" },
  { key: "c.disadvantages", domain: "disadvantage" },
];

/* ---------- sigil (igual ao ledger) ---------- */

function sigilLetters(title: string): string {
  const words = title.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const PALETTE = [
  { dot: "#fbbf24", ring: "#fbbf2455" },
  { dot: "#34d399", ring: "#34d39955" },
  { dot: "#38bdf8", ring: "#38bdf855" },
  { dot: "#f472b6", ring: "#f472b655" },
  { dot: "#a78bfa", ring: "#a78bfa55" },
  { dot: "#fb923c", ring: "#fb923c55" },
];

function hueFor(name: string): (typeof PALETTE)[number] {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

function Sigil({ title, name }: { title: string; name: string }) {
  const hue = hueFor(title || name);
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 54, height: 54 }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0" style={{ width: 54, height: 54 }}>
        <circle cx="32" cy="32" r="27" fill="none" stroke={hue.ring} strokeWidth="1.5" />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke={hue.dot}
          strokeWidth="0.75"
          strokeDasharray="1.5 6"
          strokeDashoffset="14"
        />
      </svg>
      <span
        className="font-mono font-bold leading-none relative z-10"
        style={{ color: hue.dot, fontSize: 20, letterSpacing: "-0.02em" }}
      >
        {sigilLetters(title)}
      </span>
    </div>
  );
}

/* ---------- helpers de cor ---------- */

const moduleCard = (active: boolean) =>
  `text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/70 ${
    active ? "border-green-500/70 bg-green-500/10" : "border-zinc-700/60 hover:border-zinc-500"
  }`;

const chipTone =
  "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-700/60 text-zinc-400";

const secondaryBtn =
  "text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-600 hover:text-green-400 transition-colors";

export default function TableWizard({ narratorOptions, defaultNarratorId, catalog }: TableWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [narratorId, setNarratorId] = useState(defaultNarratorId ?? narratorOptions[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [budget, setBudget] = useState(150);
  const [customBudget, setCustomBudget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTranslation();

  /* --- contagem de conteúdo por módulo (a "carga da mesa") --- */
  const perModule = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    const add = (moduleId: string, domain: string, count: number) => {
      if (!map.has(moduleId)) map.set(moduleId, {});
      const bucket = map.get(moduleId)!;
      bucket[domain] = (bucket[domain] ?? 0) + count;
      bucket._total = (bucket._total ?? 0) + count;
    };
    for (const c of catalog?.counts ?? []) add(c.moduleId, c.domain, c.count);
    return map;
  }, [catalog]);

  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const id of moduleIds) {
      const bucket = perModule.get(id);
      if (!bucket) continue;
      for (const [domain, n] of Object.entries(bucket)) {
        if (domain === "_total") continue;
        acc[domain] = (acc[domain] ?? 0) + n;
      }
    }
    const sum = (keys: string[]) => keys.reduce((s, k) => s + (acc[k] ?? 0), 0);
    return {
      ...acc,
      _total: sum(["skill", "item", "npc", "advantage", "disadvantage"]),
    } as Record<string, number>;
  }, [moduleIds, perModule]);

  const modules = catalog?.modules ?? [];
  const moduleList = useMemo(
    () =>
      (catalog?.modules ?? [])
        .sort((a, b) => a.sort - b.sort)
        .map((m) => ({
          ...m,
          counts: perModule.get(m.id) ?? {},
        })),
    [catalog, perModule]
  );

  const toggleModule = (id: string) =>
    setModuleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const baseComplete = title.trim().length > 0 && narratorId.length > 0;
  const canContinue = (to: number) => to === 1 || baseComplete;

  const go = (to: number) => {
    setError(null);
    if (!canContinue(to)) {
      setError(t("w.needTitle"));
      return;
    }
    setStep(to);
  };

  async function doCreate() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        narratorId,
        title: title.trim(),
        system: "GURPS",
        intro: intro.trim(),
        modules: moduleIds,
        categories: [] as string[],
      };
      const result = await submitJson<{ gameTable?: { id: string }; id?: string }>(
        "/api/create-game-table",
        "POST",
        payload
      );
      const tableId = result?.gameTable?.id ?? result?.id;
      if (!tableId) throw new Error(t("w.createError"));

      // grava o orçamento de pontos nas regras da mesa
      await submitJson("/api/game-table-settings", "PUT", {
        table_id: tableId,
        starting_points: budget,
      }).catch(() => undefined);

      router.push(`/table/${tableId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("w.createError"));
      setSaving(false);
    }
  }

  const selectedLabel =
    moduleIds.length === 0
      ? t("s2.selectedZero")
      : moduleIds.length === 1
        ? t("s2.selectedOne")
        : interpolate(t("s2.selectedMany"), { n: moduleIds.length });

  /* ------------------------------------------------------------ */

  const steps = [
    { n: "01", title: t("s1.title"), desc: t("s1.desc") },
    { n: "02", title: t("s2.title"), desc: t("s2.desc") },
    { n: "03", title: t("s3.title"), desc: t("s3.desc") },
  ];

  const stepReached = (n: number) => (n === 1 ? true : baseComplete);

  const stepTab = (n: number) => {
    const isCurrent = step === n;
    return (
      <button
        key={n}
        type="button"
        onClick={() => go(n)}
        disabled={!stepReached(n)}
        aria-current={isCurrent ? "step" : undefined}
        className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 rounded-md disabled:cursor-not-allowed ${
          isCurrent ? "text-green-400" : "text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
        }`}
      >
        {isCurrent ? (
          <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-green-800" />
        ) : null}
        <span>{steps[n - 1].n}</span>
        <span className="hidden sm:inline">{steps[n - 1].title}</span>
      </button>
    );
  };

  const fieldInput =
    "mt-1.5 w-full bg-transparent border-b border-zinc-700/60 text-base text-zinc-100 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-green-500 transition-colors";
  const fieldLabel = mono + " text-zinc-500";

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* ---- breadcrumb ---- */}
      <a
        href="/narrator"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200 transition-colors mb-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        {t("wizard.breadcrumb")}
      </a>

      {/* ---- hero (campaign ledger) ---- */}
      <section className="relative rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-900/80 to-zinc-950">
        {/* ambience */}
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-2xl opacity-[0.06] pointer-events-none select-none">
          <div className="absolute -top-10 -right-8 w-80 h-80 rounded-full border border-green-700" />
          <div className="absolute -top-2 -right-2 w-64 h-64 rounded-full border border-green-700" />
          <div className="absolute top-10 right-8 w-44 h-44 rounded-full border border-green-700" />
        </div>

        <div className="flex flex-col md:flex-row relative">
          <div className="flex-1 p-6 md:p-7 min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <Sigil title="New Table" name="GM" />
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-widest uppercase text-green-500/90">
                  {t("wizard.eyebrow")}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5 truncate">
                  {steps[0].title} → {steps[1].title} → {steps[2].title}
                </p>
              </div>
            </div>

            <h1 className="text-[clamp(26px,5vw,44px)] font-bold tracking-tight text-green-100 leading-[1.05] mt-5">
              {t("wizard.title")}
            </h1>
            <p className="text-stone-400 text-sm mt-4 max-w-2xl leading-relaxed">{t("wizard.subtitle")}</p>
          </div>
        </div>
      </section>

      {/* ---- running status line ---- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 leading-none select-none">
        <span>
          {t("w.step")} <span className="text-green-500/80">{step}/3</span>
        </span>
        <span className="text-zinc-700">·</span>
        <span>{moduleIds.length} {t("w.modules")}</span>
        <span className="text-zinc-700">·</span>
        <span>{totals._total} {t("w.load")}</span>
        <span className="text-zinc-700">·</span>
        <span>
          <span className="text-green-500/80">{budget}</span> {t("rail.points")}
        </span>
      </div>

      {/* ---- steps (tab bar, como o TableTabs) ---- */}
      <nav aria-label="Steps" className="flex gap-0.5 border-b border-zinc-800 mt-6">
        {steps.map((_, i) => stepTab(i + 1))}
      </nav>

      {/* ---- painel do passo ---- */}
      <main className="mt-6 rounded-2xl border border-zinc-700/50 bg-zinc-950/60 p-6 sm:p-8">
        {step === 1 && (
          <section className="space-y-5">
            <div>
              <label className={fieldLabel}>{t("f.narrator")}</label>
              <select
                value={narratorId}
                onChange={(e) => setNarratorId(e.target.value)}
                required
                className={fieldInput}
              >
                <option value="" disabled className="bg-zinc-950">
                  {t("f.narratorPh")}
                </option>
                {narratorOptions.map((n) => (
                  <option key={n.id} value={n.id} className="bg-zinc-950">
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={fieldLabel}>{t("f.titleField")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder={t("f.titlePh")}
                className={fieldInput}
              />
            </div>

            <div>
              <label className={fieldLabel}>{t("f.system")}</label>
              <div className="mt-1.5">
                <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-green-700/10 text-green-400 border border-green-700/20">
                  GURPS
                </span>
                <p className="mt-1.5 text-xs text-zinc-500">{t("f.systemLocked")}</p>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>{t("f.intro")}</label>
              <input
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder={t("f.introPh")}
                className={fieldInput}
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-sm text-zinc-400 leading-snug">
                <span style={{ color: "#22c55e" }}>{selectedLabel}</span> · {t("s2.hint")}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModuleIds(modules.map((m) => m.id))} className={secondaryBtn}>
                  {t("s2.addAll")}
                </button>
                <button type="button" onClick={() => setModuleIds([])} className={secondaryBtn}>
                  {t("s2.clearAll")}
                </button>
              </div>
            </div>

            {moduleList.length === 0 ? (
              <p className="text-sm text-zinc-500 py-10 text-center">—</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {moduleList.map((m) => {
                  const active = moduleIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggleModule(m.id)}
                      className={moduleCard(active)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          {m.accent ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: m.accent, boxShadow: `0 0 6px ${m.accent}88` }}
                            />
                          ) : null}
                          <span className="font-semibold text-[15px] truncate text-zinc-100">{m.name}</span>
                        </span>
                        {m.tech_level ? (
                          <span className={mono + " text-zinc-500"}>{m.tech_level}</span>
                        ) : null}
                      </span>
                      {m.description ? (
                        <span className="block mt-1.5 text-xs text-zinc-500 leading-snug">{m.description}</span>
                      ) : null}
                      <span className="flex flex-wrap gap-1.5 mt-3">
                        {DOMAINS.map(({ key, domain }) => {
                          const n = m.counts[domain];
                          if (!n) return null;
                          return (
                            <span key={domain} className={chipTone}>
                              <span className="tabular-nums font-bold text-zinc-100">{n}</span>
                              {t(key)}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {moduleIds.length === 0 ? (
              <p className="mt-4 text-xs text-zinc-500/80 italic">{t("s2.empty")}</p>
            ) : null}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <p className="text-sm text-zinc-400 leading-snug max-w-xl">{t("s3.hint")}</p>

            <div>
              <p className={fieldLabel}>{t("s3.suggestions")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[100, 150, 200, 250].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setBudget(n);
                      setCustomBudget(false);
                    }}
                    className={`px-5 py-2.5 rounded-xl border font-mono text-sm font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/70 ${
                      budget === n && !customBudget
                        ? "border-green-500/70 bg-green-500/10 text-green-400"
                        : "border-zinc-700/60 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={fieldLabel}>{t("s3.custom")}</p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={customBudget ? budget : ""}
                  placeholder={String(budget)}
                  onFocus={() => setCustomBudget(true)}
                  onChange={(e) => {
                    setCustomBudget(true);
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0) setBudget(Math.floor(v));
                  }}
                  className="w-40 bg-transparent border-b border-zinc-700/60 text-2xl font-bold tabular-nums text-green-400 py-1.5 placeholder:text-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
                />
                <span className={fieldLabel}>{t("s3.footnote")}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500/80">{t("s3.note")}</p>
            </div>
          </section>
        )}

        {error ? <p className="mt-5 text-sm text-red-400">{error}</p> : null}

        {/* ---- navegação ---- */}
        <footer className="mt-8 pt-6 border-t border-zinc-800 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="text-sm px-4 py-2.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
            >
              ← {t("act.back")}
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => go(step + 1)}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white bg-green-800 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
            >
              {t("act.next")} →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void doCreate()}
              disabled={saving}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white bg-green-800 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
            >
              {saving ? t("act.creating") : t("act.create")}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}