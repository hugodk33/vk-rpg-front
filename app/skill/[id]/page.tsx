import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { SkillItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const SKILL_TYPE_META: Record<string, { color: string; label: string; svg: string }> = {
  Physical: { color: "text-orange-400", label: "Physical", svg: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" },
  Mental: { color: "text-violet-400", label: "Mental", svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
};

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
  const typeMeta = SKILL_TYPE_META[skill.predefinition_type ?? ""] ?? null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {typeMeta ? (
                <svg className={`w-6 h-6 ${typeMeta.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeMeta.svg} />
                </svg>
              ) : null}
              <div>
                <h1 className="text-2xl font-bold text-amber-100">{skill.name || "Unnamed Skill"}</h1>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {skill.predefinition_type || "Skill"}{skill.predefinition_difficulty ? ` / ${skill.predefinition_difficulty}` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {skill.effect ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Effect</h3>
              <p className="text-zinc-300 text-sm">{skill.effect}</p>
            </div>
          ) : null}

          {skill.description ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
              <p className="text-zinc-300 text-sm">{skill.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {skill.predefinition_type ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Type</span>
                <span className={`font-medium text-sm ${typeMeta?.color ?? "text-zinc-200"}`}>{skill.predefinition_type}</span>
              </div>
            ) : null}
            {skill.predefinition_difficulty ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Difficulty</span>
                <span className="text-zinc-200 font-medium text-sm">{skill.predefinition_difficulty}</span>
              </div>
            ) : null}
            {skill.predefinition_value != null ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Default Level</span>
                <span className="text-zinc-200 font-medium text-sm">{skill.predefinition_value}</span>
              </div>
            ) : null}
            {skill.category ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Category</span>
                <span className="text-zinc-200 font-medium text-sm">{skill.category}{skill.subcategory ? ` / ${skill.subcategory}` : ""}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
