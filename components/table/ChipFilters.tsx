"use client";

import { useTranslation } from "@/lib/i18n";

export interface ChipOption {
  value: string;
  count: number;
}

export interface ChipGroupData {
  key: string;
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (next: string) => void;
  /** Rótulo exibido no chip; o valor cru fica no `title`. */
  labelOf?: (value: string) => string;
}

/** Conta valores não vazios de uma lista de linhas, ordenado por frequência. */
export function countValues(values: Array<string | null | undefined>): ChipOption[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value)
  );
}

const pillCls = (active: boolean) =>
  `shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 ${
    active
      ? "bg-emerald-600/80 border-emerald-500/70 text-white"
      : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600/60"
  }`;

/**
 * Uma linha de chips por agrupamento (categoria, tipo, alvo…). Cada chip é
 * seleção única: clicar de novo limpa o grupo. Grupos diferentes dividem a
 * mesma linha de wrapping, separados por um filete.
 */
export default function ChipFilters({
  groups,
  onClearAll,
}: {
  groups: ChipGroupData[];
  onClearAll: () => void;
}) {
  const { t } = useTranslation();
  const visible = groups.filter((g) => g.options.length > 0);
  if (visible.length === 0) return null;
  const active = visible.some((g) => g.value);

  return (
    <div className="flex flex-wrap items-center gap-y-2 mb-5">
      {visible.map((g, i) => (
        <div
          key={g.key}
          className={`flex flex-wrap items-center gap-1.5 pr-3 mb-1 ${
            i > 0 ? "border-l border-zinc-800/80 pl-3" : ""
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mr-0.5">
            {g.label}
          </span>
          <button
            type="button"
            onClick={() => g.onChange("")}
            className={pillCls(g.value === "")}
          >
            {t("tp.filter.all")} ·{" "}
            {g.options.reduce((n, o) => n + o.count, 0)}
          </button>
          {g.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => g.onChange(g.value === o.value ? "" : o.value)}
              className={pillCls(g.value === o.value)}
              title={g.labelOf ? o.value : undefined}
            >
              {g.labelOf ? g.labelOf(o.value) : o.value} · {o.count}
            </button>
          ))}
        </div>
      ))}
      {active ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors mb-1"
        >
          {t("tp.filter.clear")}
        </button>
      ) : null}
    </div>
  );
}
