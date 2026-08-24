import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { SkillItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { color: string; bg: string; ring: string; label: string; svg: string; diamonds: number }> = {
  Physical: {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    ring: "ring-amber-400/20",
    label: "Physical",
    svg: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11",
    diamonds: 1,
  },
  Mental: {
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    ring: "ring-violet-400/20",
    label: "Mental",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    diamonds: 1,
  },
  Social: {
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    ring: "ring-teal-400/20",
    label: "Social",
    svg: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    diamonds: 1,
  },
};

const DIFFICULTY: Record<string, { diamonds: number; label: string }> = {
  Easy: { diamonds: 1, label: "Easy" },
  Average: { diamonds: 2, label: "Average" },
  Hard: { diamonds: 3, label: "Hard" },
  "Very Hard": { diamonds: 4, label: "Very Hard" },
};

function DiamondRow({ count, max, colorClass }: { count: number; max: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${count} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`inline-block w-2.5 h-2.5 rotate-45 transition-colors ${
            i < count ? colorClass : "bg-zinc-700/60"
          }`}
        />
      ))}
    </div>
  );
}

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let skill: SkillItem | undefined;
  try {
    skill = await api<SkillItem>(`/game-table-skill/${id}`);
  } catch {
    skill = undefined;
  }
  if (!skill) notFound();

  const tableId = skill.table_id;
  const typeKey = skill.predefinition_type ?? "";
  const typeConfig = TYPE_CONFIG[typeKey] ?? null;
  const diffKey = skill.predefinition_difficulty ?? "";
  const diff = DIFFICULTY[diffKey] ?? null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link
          href={`/table/${tableId}`}
          className="text-zinc-500 hover:text-zinc-300 text-sm mb-6 inline-flex items-center gap-1.5 transition-colors group"
        >
          <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to table
        </Link>
      ) : null}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-5">
          {typeConfig ? (
            <div className={`shrink-0 w-11 h-11 rounded-lg ${typeConfig.bg} ring-1 ${typeConfig.ring} flex items-center justify-center`}>
              <svg className={`w-5.5 h-5.5 ${typeConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={typeConfig.svg} />
              </svg>
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight leading-tight">
              {skill.name || "Unnamed Skill"}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {typeConfig ? (
                <span className={`text-sm font-medium ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              ) : skill.predefinition_type ? (
                <span className="text-sm font-medium text-zinc-400">
                  {skill.predefinition_type}
                </span>
              ) : null}
              {(typeConfig || skill.predefinition_type) && skill.category ? (
                <span className="text-zinc-600">·</span>
              ) : null}
              {skill.category ? (
                <span className="text-sm text-zinc-500">
                  {skill.category}{skill.subcategory ? ` / ${skill.subcategory}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-6 py-5 relative overflow-hidden">
          {/* Subtle ruled lines behind difficulty — rulebook motif */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-3 left-6 right-6 h-px bg-zinc-800/60" />
            <div className="absolute bottom-3 left-6 right-6 h-px bg-zinc-800/60" />
          </div>

          <div className="relative flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 block mb-2">
                Difficulty
              </span>
              <div className="flex items-center gap-4">
                <span className={`text-2xl font-bold tracking-tight ${
                  typeConfig?.color ?? "text-zinc-200"
                }`}>
                  {diff?.label ?? (diffKey || "—")}
                </span>
                {diff ? (
                  <DiamondRow
                    count={diff.diamonds}
                    max={4}
                    colorClass={typeConfig?.color?.replace("text-", "bg-") ?? "bg-amber-400"}
                  />
                ) : null}
              </div>
            </div>

            {skill.predefinition_value != null ? (
              <div className="text-right shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 block mb-1">
                  Default Level
                </span>
                <span className="text-xl font-bold text-zinc-200 tabular-nums">
                  {skill.predefinition_value}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6">
        {skill.description ? (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-2">
              Description
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {skill.description}
            </p>
          </div>
        ) : null}

        {skill.effect ? (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-2">
              Effect
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {skill.effect}
            </p>
          </div>
        ) : null}

        {/* Dependencies */}
        {skill.dependencies && skill.dependencies.length > 0 ? (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-3">
              Requires
            </h3>
            <div className="space-y-2">
              {skill.dependencies.map((dep, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5"
                >
                  <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-sm text-zinc-300">
                    {dep.skill || "Unknown skill"}
                  </span>
                  {dep.value ? (
                    <span className="text-xs text-zinc-500 ml-auto font-mono">
                      {dep.value}
                    </span>
                  ) : null}
                  {dep.type ? (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      dep.type === "prerequisite"
                        ? "bg-amber-900/30 text-amber-400"
                        : "bg-violet-900/30 text-violet-400"
                    }`}>
                      {dep.type}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Predefinitions */}
        {skill.predefinition && skill.predefinition.length > 0 ? (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-3">
              Defaults to
            </h3>
            <div className="space-y-2">
              {skill.predefinition.map((pre, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5"
                >
                  <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm text-zinc-300">
                    {pre.skill || "Unknown skill"}
                  </span>
                  {pre.value ? (
                    <span className="text-xs text-zinc-500 ml-auto font-mono">
                      {pre.value}
                    </span>
                  ) : null}
                  {pre.depends_on_skill_for_others_attributes ? (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {pre.depends_on_skill_for_others_attributes}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
