import { api } from "@/lib/api";
import type { GameTableSkills, SkillItem } from "@/lib/types";
import TableTabs from "@/components/TableTabs";

export const dynamic = "force-dynamic";

export default async function TableSkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await api<GameTableSkills>(`/game-table-skills/${id}`);
  const skills = data.skills ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />
      <h1 className="text-2xl font-bold text-amber-100 mb-6">
        {data.table?.title || "Table"} — Skills
      </h1>

      {skills.length === 0 ? (
        <p className="text-zinc-500 italic">No skills registered for this table.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s: SkillItem) => (
            <div key={s.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{s.name || "Unnamed"}</span>
                <span className="text-zinc-500 text-xs">
                  {s.predefinition_type || ""}
                  {s.predefinition_difficulty ? "/" + s.predefinition_difficulty : ""}
                </span>
              </div>
              {s.effect ? <p className="text-zinc-500 text-xs mt-1">{s.effect}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
