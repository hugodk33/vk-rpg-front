"use client";

/* ============================================================
   TableWizard — montagem da mesa em 3 passos.
   Identidade → Kit inicial → Pontos da ficha.

   O passo 2 é um compêndio: pacotes base em coluna única e, em
   seções por domínio (perícias · itens · vantagens · desvantagens
   · locais · npcs) separadas por traço, cada categoria em coluna
   única com as entradas em grade de 3. A seleção é perícia a
   perícia (ou item a item) e há busca em destaque sobre o acervo.
   O payload envia apenas `references` (por domínio + id) — a
   instalação no backend é exata, sem efeito de módulo inteiro.
   Copia segue o idioma do LanguageSwitch (default PT).
   ============================================================ */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "../forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { ContentCatalog, ContentReference } from "@/lib/types";

const mono = "font-mono uppercase tracking-widest text-[11px]";
const EMPTY_REFS: ContentReference[] = [];

interface TableWizardProps {
  narratorOptions: Array<{ id: string; name: string }>;
  defaultNarratorId?: string;
  catalog: ContentCatalog | null;
}

const DOMAIN_ORDER: Array<{ label: string; domain: string }> = [
  { label: "c.skills", domain: "skill" },
  { label: "c.items", domain: "item" },
  { label: "c.advantages", domain: "advantage" },
  { label: "c.disadvantages", domain: "disadvantage" },
  { label: "c.locations", domain: "location" },
  { label: "c.npcs", domain: "npc" },
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

const chipTone =
  "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-700/60 text-zinc-400";

const secondaryBtn =
  "text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-600 hover:text-green-400 transition-colors";

function ItemCard({
  entry,
  checked,
  onToggle,
  tag,
}: {
  entry: ContentReference;
  checked: boolean;
  onToggle: () => void;
  tag?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-1 py-2 cursor-pointer select-none border-b border-dashed border-zinc-800/80 last:border-b-0 ${
        checked ? "text-green-400" : "text-zinc-100"
      }`}
    >
      <span className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 accent-green-600 shrink-0"
        />
        <span className="text-sm font-semibold leading-snug min-w-0">{entry.name}</span>
      </span>
      {entry.description ? (
        <span className="text-[11px] text-zinc-500 leading-snug line-clamp-2">{entry.description}</span>
      ) : null}
      {tag ? <span className={mono + " text-zinc-600 pt-0.5"}>{tag}</span> : null}
    </label>
  );
}

function TypeHeader({
  label,
  checked,
  total,
  hint,
}: {
  label: string;
  checked: number;
  total: number;
  hint?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-t-2 border-zinc-600/40 pt-5 relative before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-green-700/80 before:via-green-700/20 before:to-transparent">
      <div className="min-w-0">
        <h2 className={mono + " text-[16px] sm:text-[18px] uppercase tracking-[0.3em] text-green-400 leading-none"}>
          {label}
        </h2>
        {hint ? <span className="block mt-1.5 text-xs text-zinc-500/80 leading-snug">{hint}</span> : null}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-green-500/80 tabular-nums whitespace-nowrap">
        {checked}/{total}
      </span>
    </header>
  );
}

export default function TableWizard({ narratorOptions, defaultNarratorId, catalog }: TableWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [narratorId, setNarratorId] = useState(defaultNarratorId ?? narratorOptions[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [budget, setBudget] = useState(150);
  const [customBudget, setCustomBudget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTranslation();

  const allRefs = catalog?.references ?? EMPTY_REFS;

  /* ---- índices derivados ---- */
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

  const domainRefs = useMemo(() => {
    const map = new Map<string, ContentReference[]>();
    for (const r of allRefs) {
      const bucket = map.get(r.domain) ?? [];
      bucket.push(r);
      map.set(r.domain, bucket);
    }
    return map;
  }, [allRefs]);

  const moduleRefs = useMemo(() => {
    const map = new Map<string, ContentReference[]>();
    for (const r of allRefs) {
      if (!r.moduleId) continue;
      const bucket = map.get(r.moduleId) ?? [];
      bucket.push(r);
      map.set(r.moduleId, bucket);
    }
    return map;
  }, [allRefs]);

  const refById = useMemo(() => {
    const map = new Map<string, ContentReference>();
    for (const r of allRefs) map.set(r.id, r);
    return map;
  }, [allRefs]);

  const q = query.trim().toLowerCase();

  const catLabel = (domain: string, name: string) =>
    catalog?.categories.find((x) => x.domain === domain && x.name === name)?.display_name ?? name;

  const searchMatches = useMemo(() => {
    if (!q) return EMPTY_REFS;
    const catDisplay = new Map<string, string>();
    for (const ct of catalog?.categories ?? []) catDisplay.set(`${ct.domain}/${ct.name}`, ct.display_name);
    return allRefs.filter((r) => {
      if (typeFilter && r.domain !== typeFilter) return false;
      const display = catDisplay.get(`${r.domain}/${r.category}`) ?? r.category ?? "";
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q) ||
        display.toLowerCase().includes(q)
      );
    });
  }, [q, typeFilter, allRefs, catalog]);

  const moduleList = useMemo(
    () =>
      [...(catalog?.modules ?? [])]
        .sort((a, b) => a.sort - b.sort)
        .map((m) => ({ ...m, counts: perModule.get(m.id) ?? {} })),
    [catalog, perModule]
  );

  /* ---- seleção (set de ids de referência — independe de módulo) ---- */
  const isSel = (id: string) => sel.has(id);
  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const countSelOf = (rows: ContentReference[]) => rows.reduce((s, r) => s + (sel.has(r.id) ? 1 : 0), 0);
  const allOf = (rows: ContentReference[]) => rows.length > 0 && rows.every((r) => sel.has(r.id));
  const setRows = (rows: ContentReference[], on: boolean) => {
    const ids = rows.map((r) => r.id);
    setSel((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    const rows = moduleRefs.get(moduleId) ?? [];
    setRows(rows, !allOf(rows));
  };

  const toggleCat = (domain: string, category: string) => {
    const rows = (domainRefs.get(domain) ?? []).filter((r) => r.category === category);
    setRows(rows, !allOf(rows));
  };

  const categoryGroups = (domain: string) => {
    const seen = new Map<string, ContentReference[]>();
    for (const r of domainRefs.get(domain) ?? []) {
      const bucket = seen.get(r.category) ?? [];
      bucket.push(r);
      seen.set(r.category, bucket);
    }
    return [...seen.entries()];
  };

  const totalSelected = sel.size;
  const selectedLabel =
    totalSelected === 0
      ? t("s2.selectedZero")
      : interpolate(t("s2.selectedMany"), { n: totalSelected });

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
      const byDomain = new Map<string, string[]>();
      for (const id of sel) {
        const ref = refById.get(id);
        if (!ref) continue;
        const arr = byDomain.get(ref.domain) ?? [];
        arr.push(id);
        byDomain.set(ref.domain, arr);
      }
      const references = [...byDomain.entries()].map(([domain, ids]) => ({ domain, ids }));

      const payload = {
        narratorId,
        title: title.trim(),
        system: "GURPS",
        intro: intro.trim(),
        modules: [] as string[],
        categories: [] as unknown[],
        references,
      };
      const result = await submitJson<{ gameTable?: { id: string }; id?: string }>(
        "/api/create-game-table",
        "POST",
        payload
      );
      const tableId = result?.gameTable?.id ?? result?.id;
      if (!tableId) throw new Error(t("w.createError"));

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

  /* domínio visíveis e com conteúdo */
  const activeDomains = DOMAIN_ORDER.filter(({ domain }) => (domainRefs.get(domain) ?? []).length > 0);
  const visibleDomains = activeDomains.filter(({ domain }) => !typeFilter || typeFilter === domain);

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
        <span>
          <span className="text-green-500/80">{totalSelected}</span> {t("w.load")}
        </span>
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
      <main>
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
            {/* ---- barra de seleção + busca ---- */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("s2.searchPh")}
                  aria-label={t("s2.searchPh")}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-700/60 bg-zinc-900/40 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <button type="button" onClick={() => setRows(allRefs, true)} className={secondaryBtn}>
                {t("s2.addAll")}
              </button>
              <button type="button" onClick={() => setSel(new Set())} className={secondaryBtn}>
                {t("s2.clearAll")}
              </button>
            </div>

            <p className="mt-3 text-sm text-zinc-400 leading-snug">
              <span style={{ color: "#22c55e" }}>{selectedLabel}</span> · {t("s2.hint")}
            </p>

            {moduleList.length === 0 && allRefs.length === 0 ? (
              <p className="text-sm text-zinc-500 py-10 text-center">—</p>
            ) : (
              <>
                {/* ================= barra de filtro por tipo ================= */}
                <div className="mt-5">
                  <p className={mono + " text-[10px] uppercase tracking-widest text-zinc-500"}>{t("s2.typeHint")}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setTypeFilter("")}
                      aria-pressed={typeFilter === ""}
                      className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
                        typeFilter === ""
                          ? "border-green-600/70 bg-green-700/15 text-green-400"
                          : "border-zinc-700/60 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {t("s2.allTypes")}
                    </button>
                    {activeDomains.map(({ label, domain }) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setTypeFilter(domain)}
                        aria-pressed={typeFilter === domain}
                        className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 ${
                          typeFilter === domain
                            ? "border-green-600/70 bg-green-700/15 text-green-400"
                            : "border-zinc-700/60 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </div>

                {q ? (
                  /* ================= RESULTADOS DA BUSCA ================= */
                  searchMatches.length === 0 ? (
                    <p className="mt-6 text-sm text-zinc-500">{interpolate(t("s2.searchEmpty"), { q })}</p>
                  ) : (
                    visibleDomains.map(({ label, domain }) => {
                      const rows = searchMatches.filter((r) => r.domain === domain);
                      if (rows.length === 0) return null;
                      const checkedCount = countSelOf(rows);
                      return (
                        <section key={domain} className="mt-8">
                          <TypeHeader label={t(label)} checked={checkedCount} total={rows.length} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
                            {rows.map((r) => (
                              <ItemCard
                                key={r.id}
                                entry={r}
                                checked={isSel(r.id)}
                                onToggle={() => toggle(r.id)}
                                tag={catLabel(domain, r.category)}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })
                  )
                ) : (
                  /* ================= COMPÊNDIO por domínio ================= */
                  visibleDomains.map(({ label, domain }) => {
                    const domainRows = domainRefs.get(domain) ?? [];
                    const checkedCount = countSelOf(domainRows);
                    return (
                      <section key={domain} className="mt-8">
                        <TypeHeader label={t(label)} checked={checkedCount} total={domainRows.length} />
                        {categoryGroups(domain).map(([category, rows]) => {
                          const on = allOf(rows);
                          return (
                            <div key={category} className="mt-5 pt-4 border-t border-dashed border-zinc-800">
                              <div className="flex items-center gap-2.5">
                                <label className="inline-flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleCat(domain, category)}
                                    className="accent-green-600"
                                  />
                                  <span className="text-[13px] font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors">
                                    {catLabel(domain, category)}
                                  </span>
                                </label>
                                <span className="font-mono text-[10px] text-zinc-600 tabular-nums">×{rows.length}</span>
                                {countSelOf(rows) > 0 ? (
                                  <span className="font-mono text-[10px] text-green-500/80 tabular-nums">
                                    {interpolate(t("s2.selectedTag"), { n: countSelOf(rows) })}
                                  </span>
                                ) : null}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
                                {rows.map((r) => (
                                  <ItemCard
                                    key={r.id}
                                    entry={r}
                                    checked={isSel(r.id)}
                                    onToggle={() => toggle(r.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })
                )}

                {/* ================= PACOTES BASE (coluna única, no fim) ================= */}
                <section className="mt-10">
                  <TypeHeader
                    label={t("s2.kit")}
                    checked={moduleList.reduce((s, m) => s + countSelOf(moduleRefs.get(m.id) ?? []), 0)}
                    total={moduleList.reduce((s, m) => s + (moduleRefs.get(m.id) ?? []).length, 0)}
                    hint={t("s2.kitHint")}
                  />
                  <div className="mt-4">
                    {moduleList.map((m, idx) => {
                      const rows = moduleRefs.get(m.id) ?? [];
                      const on = allOf(rows);
                      const partial = countSelOf(rows) > 0 && !on;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-start gap-3 pb-4 pt-4 cursor-pointer transition-colors sm:pb-4 ${
                            idx > 0 ? "border-t border-dashed border-zinc-800" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleModule(m.id)}
                            className="mt-1 accent-green-600 shrink-0"
                            aria-label={m.name}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 min-w-0">
                              {m.accent ? (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: m.accent, boxShadow: `0 0 6px ${m.accent}88` }}
                                />
                              ) : null}
                              <span className="font-semibold text-[15px] text-zinc-100">{m.name}</span>
                              {m.tech_level ? (
                                <span className={mono + " text-zinc-500"}>{m.tech_level}</span>
                              ) : null}
                            </span>
                            {m.description ? (
                              <span className="block mt-1 text-xs text-zinc-500 leading-snug max-w-xl">
                                {m.description}
                              </span>
                            ) : null}
                            <span className="flex flex-wrap gap-1.5 mt-2.5">
                              {DOMAIN_ORDER.map(({ label, domain }) => {
                                const n = m.counts[domain];
                                if (!n) return null;
                                return (
                                  <span key={domain} className={chipTone}>
                                    <span className="tabular-nums font-bold text-zinc-100">{n}</span>
                                    {t(label)}
                                  </span>
                                );
                              })}
                            </span>
                            {partial ? (
                              <span className="block mt-2 font-mono text-[10px] uppercase tracking-widest text-green-500/80">
                                {interpolate(t("s2.selectedTag"), { n: countSelOf(rows) })}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {totalSelected === 0 ? (
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