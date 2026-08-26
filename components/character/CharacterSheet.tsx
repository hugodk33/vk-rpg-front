import Link from "next/link";
import type { CharacterViewer, Sheet } from "@/lib/types";
import RadarChart from "@/components/RadarChart";
import { parseDamageEntries, DAMAGE_TYPES } from "@/lib/damage";

function statDiff(base: number | undefined, current: number | undefined): React.ReactNode {
  if (base == null || current == null || base === current) return null;
  const diff = current - base;
  const color = diff < 0 ? "text-red-400" : "text-emerald-400";
  return (
    <span className={`${color} text-xs ml-1`}>
      ({diff >= 0 ? "+" : ""}
      {diff})
    </span>
  );
}

function drFor(armors: Array<{ fit?: string; value?: string }> | undefined, ...fits: string[]): number {
  let total = 0;
  for (const a of armors ?? []) {
    if (fits.some((f) => a.fit?.toLowerCase()?.includes(f))) {
      const m = /(\d+)/.exec(a.value ?? "");
      if (m) total += parseInt(m[1], 10);
    }
  }
  return total;
}

function hitLocationBadge(label: string, dr: number, style: React.CSSProperties): React.ReactNode {
  return (
    <div
      className="absolute flex flex-col items-center justify-center p-1 rounded border border-cyan-400/60"
      style={{ ...style, width: 52, height: 44 }}
    >
      <span
        className="text-zinc-400 uppercase"
        style={{ fontSize: 7, lineHeight: 1, letterSpacing: 0.3 }}
      >
        {label}
      </span>
      <span className="text-cyan-400 font-bold text-sm leading-none mt-0.5">{dr}</span>
    </div>
  );
}

function armorDiagram(armors: CharacterViewer["character"]["armors"]): React.ReactNode {
  const head = drFor(armors, "head", "helmet", "skull");
  const torso = drFor(armors, "torso", "chest", "body", "full body");
  const armR = drFor(armors, "arm", "arms");
  const armL = armR;
  const legR = drFor(armors, "leg", "legs");
  const legL = legR;

  return (
    <div className="relative flex justify-center py-12">
      <div className="relative">
        <svg fill="#52525b" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ width: 90 }}>
          <circle cx="256" cy="56" r="56" />
          <path d="M437,128H75a27,27,0,0,0,0,54H176.88c6.91,0,15,3.09,19.58,15,5.35,13.83,2.73,40.54-.57,61.23l-4.32,24.45a.42.42,0,0,1-.12.35l-34.6,196.81A27.43,27.43,0,0,0,179,511.58a27.06,27.06,0,0,0,31.42-22.29l23.91-136.8S242,320,256,320c14.23,0,21.74,32.49,21.74,32.49l23.91,136.92a27.24,27.24,0,1,0,53.62-9.6L320.66,283a.45.45,0,0,0-.11-.35l-4.33-24.45c-3.3-20.69-5.92-47.4-.57-61.23,4.56-11.88,12.91-15,19.28-15H437a27,27,0,0,0,0-54Z" />
        </svg>
        <div className="absolute inset-0 w-full">
          {hitLocationBadge("head", head, { top: -54, left: "50%", transform: "translateX(-50%)" })}
          {hitLocationBadge("a.rig", armR, { top: -32, right: -50 })}
          {hitLocationBadge("a.lef", armL, { top: -32, left: -50 })}
          {hitLocationBadge("torso", torso, { top: 23, width: 50, left: -45, height: 50 })}
          {hitLocationBadge("l.rig", legR, { top: 85, right: -50 })}
          {hitLocationBadge("l.lef", legL, { top: 85, left: -50 })}
        </div>
      </div>
    </div>
  );
}

function section(title: string, content: React.ReactNode, icon?: React.ReactNode): React.ReactNode {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 border-b border-zinc-700/60 pb-1.5">
        {icon || null}
        <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-300">{title}</h2>
      </div>
      {content}
    </div>
  );
}

function meleeIcon(): React.ReactNode {
  return (
    <svg className="w-3.5 h-3.5 inline align-text-bottom" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"
      />
    </svg>
  );
}

function rangedIcon(): React.ReactNode {
  return (
    <svg className="w-3.5 h-3.5 inline align-text-bottom" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 21L13 11M10 14L21 3M15 15L21 21M3 3L9 9"
      />
    </svg>
  );
}

function isRanged(type?: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return t.includes("range") || t.includes("ranged") || t.includes("bow") || t.includes("thrown");
}

function isMelee(type?: string): boolean {
  if (!type) return true;
  const t = type.toLowerCase();
  return t.includes("melee") || t.includes("swing") || t.includes("thrust") || t.includes("sword");
}

function hpPct(hp: number | undefined, base: number | undefined): number {
  return Math.min(100, Math.max(0, ((hp || 0) / (base || 1)) * 100));
}

function fpPct(fatigue: number | undefined, ht: number | undefined): number {
  return Math.min(100, ((fatigue || 0) / (ht || 1)) * 100);
}

const attrCards = [
  {
    label: "ST",
    color: "text-red-400",
    svg: "M13 10V3L4 14h7v7l9-11h-7z",
    value: (s: Sheet) => s.st,
    base: (s: Sheet) => s.base_st,
  },
  {
    label: "DX",
    color: "text-emerald-400",
    svg: "M13 5l7 7-7 7M5 5l7 7-7 7",
    value: (s: Sheet) => s.dx,
    base: (s: Sheet) => s.base_dx,
  },
  {
    label: "IQ",
    color: "text-blue-400",
    svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    value: (s: Sheet) => s.iq,
    base: (s: Sheet) => s.base_iq,
  },
  {
    label: "HT",
    color: "text-purple-400",
    svg: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    value: (s: Sheet) => s.ht,
    base: (s: Sheet) => s.base_ht,
  },
];

interface CharacterSheetProps {
  data: CharacterViewer;
  basePath: string;
}

export default function CharacterSheet({ data, basePath }: CharacterSheetProps) {
  const ch = data.character;
  const s = ch.sheet;
  const name = s?.name || ch.name || "Character";
  const modifiers = ch.modifiers ?? [];
  const moments = data.moments ?? [];
  const selectedMoment = data.selected_moment;
  const hasBottom = moments.length > 0 || modifiers.length > 0;

  return (
    <>
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        <div className="py-4 pl-4">
          <h1 className="text-3xl font-bold text-amber-100 tracking-tight">{name}</h1>
          {s?.bio ? <p className="text-xl text-zinc-400 mt-1">{s.bio}</p> : null}
          {s?.backstory ? <p className="text-zinc-500 text-sm mt-1">{s.backstory}</p> : null}
          <div className="flex mt-3 gap-1 items-center">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Points</span>
            <p className="text-amber-400 font-bold text-xl">{s?.points ?? "0"}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 mb-8">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Core Attributes
              </h3>
              <div className="flex justify-center flex-wrap gap-1 mb-4">
                {attrCards.map((a) => (
                  <div
                    key={a.label}
                    className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[55px]"
                  >
                    <svg
                      className="w-5 h-5"
                      style={{ color: a.color }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={a.svg}
                      />
                    </svg>
                    <span className={`${a.color} text-xl font-bold`}>
                      {s ? a.value(s) ?? "-" : "-"}
                      {s ? statDiff(a.base(s), a.value(s)) : null}
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold uppercase">{a.label}</span>
                  </div>
                ))}
              </div>
              <br />
              <div className="flex justify-center pb-10">
                {s ? (
                  <RadarChart
                    st={s.st ?? 10}
                    dx={s.dx ?? 10}
                    iq={s.iq ?? 10}
                    ht={s.ht ?? 10}
                    size={165}
                    showValues
                  />
                ) : null}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Vitals
              </h3>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
                <div className="flex items-center gap-2 w-full">
                  <div className="flex w-full items-center">
                    <span className="flex justify-between items-center pr-2 w-2/5">
                      <span className="text-zinc-500 text-xs font-semibold uppercase">HP </span>
                      <span className="text-red-400 font-bold text-lg ml-1">
                        {s?.hp ?? "-"}/{s?.base_hp ?? "-"}
                      </span>
                    </span>
                    <div className="w-3/5 bg-zinc-700/50 rounded-full h-2">
                      <div
                        className="bg-red-500/80 h-2 rounded-full"
                        style={{ width: `${hpPct(s?.hp, s?.base_hp)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <div className="flex w-full items-center">
                    <span className="flex justify-between items-center pr-2 w-2/5">
                      <span className="text-zinc-500 text-xs font-semibold uppercase">FP </span>
                      <span className="text-blue-400 font-bold text-lg ml-1">{s?.fatigue ?? "-"}</span>
                    </span>
                    <div className="w-3/5 bg-zinc-700/50 rounded-full h-2">
                      <div
                        className="bg-blue-500/80 h-2 rounded-full"
                        style={{ width: `${fpPct(s?.fatigue, s?.ht)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Movement
              </h3>
              <div className="flex justify-center flex-wrap gap-1">
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[72px]">
                  <svg
                    className="w-5 h-5 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                  <span className="text-cyan-400 text-sm font-bold">
                    {s?.basic_speed ?? "-"}
                    <span className="font-light">{s?.move ? " km/h" : ""}</span>
                  </span>
                  <span className="text-zinc-500 text-xs font-semibold uppercase">Basic Speed</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[72px]">
                  <svg
                    className="w-5 h-5 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                  <span className="text-cyan-400 text-sm font-bold">{s?.move ?? "-"}</span>
                  <span className="text-zinc-500 text-xs font-semibold uppercase">Move</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg min-w-[72px]">
                  <svg
                    className="w-5 h-5 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                  <span className="text-cyan-400 text-sm font-bold">{s?.encumbrance ?? "-"}</span>
                  <span className="text-zinc-500 text-xs font-semibold uppercase">Enc</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Body</h3>
              {armorDiagram(ch.armors)}
              <div className="space-y-1 mt-4 border-t border-zinc-700/40 pt-4">
                {(ch.armors ?? []).map((a) => (
                  <div key={a.id} className="flex justify-between text-xs">
                    <span className="text-zinc-300">{a.name}</span>
                    <span className="text-amber-400/80">
                      {(a.value ?? "").replace("DR ", "")} {a.fit || ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              {section(
                "Advantages",
                !ch.advantages || ch.advantages.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">None</p>
                ) : (
                  ch.advantages.map((a) => (
                    <div
                      key={a.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 flex justify-between items-center mb-1.5"
                    >
                      <span className="text-zinc-200 text-sm font-medium">{a.name}</span>
                      <span className="text-emerald-400 text-xs font-semibold">{a.cost_points}</span>
                    </div>
                  ))
                ),
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <div>
              {section(
                "Disadvantages",
                !ch.disadvantages || ch.disadvantages.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">None</p>
                ) : (
                  ch.disadvantages.map((d) => (
                    <div
                      key={d.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 flex justify-between items-center mb-1.5"
                    >
                      <span className="text-zinc-200 text-sm font-medium">{d.name}</span>
                      <span className="text-red-400 text-xs font-semibold">{d.cost_points}</span>
                    </div>
                  ))
                ),
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              {section(
                "Skills",
                !ch.skills || ch.skills.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">None</p>
                ) : (
                  ch.skills.map((sk) => (
                    <div
                      key={sk.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-200 text-sm font-medium">{sk.skill_name || sk.name}</span>
                        <span className="text-zinc-500 text-xs">
                          {sk.predefinition_type || ""}
                          {sk.predefinition_difficulty ? "/" + sk.predefinition_difficulty : ""}
                        </span>
                      </div>
                      {sk.effect ? <p className="text-zinc-500 text-xs mt-0.5">{sk.effect}</p> : null}
                    </div>
                  ))
                ),
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              )}
            </div>
            <div>
              {section(
                "Attacks & Damage",
                !ch.damages || ch.damages.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">None</p>
                ) : (
                  ch.damages.map((d) => {
                    const entries = parseDamageEntries(d.value);
                    return (
                      <div
                        key={d.id}
                        className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-zinc-200 text-sm font-medium">{d.name || "Unnamed"}</span>
                            {d.type ? (
                              <span className="text-zinc-500 text-xs ml-1">
                                {isMelee(d.type) ? meleeIcon() : null}
                                {isRanged(d.type) ? rangedIcon() : null}
                                {d.type}
                                {d.subtype ? "/" + d.subtype : ""}
                              </span>
                            ) : null}
                            {d.range ? <span className="text-zinc-500 text-xs ml-1">{d.range}</span> : null}
                          </div>
                          {entries.length === 0 ? (
                            <span className="text-red-400 font-bold text-sm">{d.value || ""}</span>
                          ) : null}
                        </div>
                        {entries.length > 0 ? (
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-zinc-700/40">
                                  <th className="text-left text-zinc-500 font-medium py-1 px-2">ST</th>
                                  {Array.from(new Set(entries.map((e) => e.type))).map((t) => (
                                    <th key={t} className="text-left text-zinc-500 font-medium py-1 px-2">
                                      {DAMAGE_TYPES[t] || t}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from(new Set(entries.map((e) => e.st)))
                                  .sort((a, b) => a - b)
                                  .map((st) => {
                                    const row = entries.filter((e) => e.st === st);
                                    const types = Array.from(new Set(entries.map((e) => e.type)));
                                    return (
                                      <tr key={st} className="border-b border-zinc-800/60">
                                        <td className="text-zinc-300 font-mono py-1 px-2 tabular-nums">{st}</td>
                                        {types.map((t) => {
                                          const cell = row.find((e) => e.type === t);
                                          return (
                                            <td key={t} className="text-red-300 font-bold font-mono py-1 px-2">
                                              {cell?.damage || "—"}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {d.description ? <p className="text-zinc-500 text-xs mt-0.5">{d.description}</p> : null}
                      </div>
                    );
                  })
                ),
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                  />
                </svg>
              )}
            </div>
            <div>
              {section(
                "Items",
                !ch.items || ch.items.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">None</p>
                ) : (
                  ch.items.map((i) => (
                    <div
                      key={i.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-zinc-200 text-sm font-medium">{i.name || "Unnamed"}</span>
                        {i.weight ? <span className="text-zinc-500 text-xs">{i.weight} kg</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500">
                        {i.category ? <span>{i.category}</span> : null}
                        {i.quality ? <span>{i.quality}</span> : null}
                        {i.condition ? <span>{i.condition}</span> : null}
                        {i.dimensions ? <span>{i.dimensions}</span> : null}
                      </div>
                      {i.description ? <p className="text-zinc-500 text-xs mt-0.5">{i.description}</p> : null}
                    </div>
                  ))
                ),
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasBottom ? (
        <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden mt-6">
          <div className="p-4">
            {moments.length > 0 ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1">
                    History
                  </span>
                  <Link
                    href={basePath}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      !selectedMoment
                        ? "bg-amber-600/30 text-amber-300 border border-amber-600/50"
                        : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200"
                    }`}
                  >
                    Present
                  </Link>
                  {[...moments].reverse().map((m, i, arr) => {
                    const label = i === arr.length - 1 ? "Starting" : `${m}`;
                    const isSel = selectedMoment === m;
                    return (
                      <Link
                        key={m}
                        href={`${basePath}?moment=${m}`}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          isSel
                            ? "bg-amber-600/30 text-amber-300 border border-amber-600/50"
                            : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
                {selectedMoment ? (
                  <p className="text-xs text-zinc-500 mt-2">
                    Viewing character state at{" "}
                    <span className="text-amber-400 font-medium">Moment {selectedMoment}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            {modifiers.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-3 border-b border-zinc-700/60 pb-1.5">
                  <svg
                    className="w-4 h-4 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-300">
                    Modifiers Applied
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {modifiers.map((m) => (
                    <div
                      key={m.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-zinc-200 text-sm font-medium">{m.name}</span>
                        <span className="text-xs text-zinc-500">{m.damage_value || ""}</span>
                      </div>
                      {m.description ? (
                        <p className="text-zinc-500 text-xs mt-0.5">{m.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 mt-1 text-xs">
                        {m.mod_hp != null ? (
                          <span className="text-red-400">
                            HP {m.mod_hp >= 0 ? "+" : ""}
                            {m.mod_hp}
                          </span>
                        ) : null}
                        {m.mod_st != null ? (
                          <span className="text-red-400">
                            ST {m.mod_st >= 0 ? "+" : ""}
                            {m.mod_st}
                          </span>
                        ) : null}
                        {m.mod_dx != null ? (
                          <span className="text-emerald-400">
                            DX {m.mod_dx >= 0 ? "+" : ""}
                            {m.mod_dx}
                          </span>
                        ) : null}
                        {m.mod_iq != null ? (
                          <span className="text-blue-400">
                            IQ {m.mod_iq >= 0 ? "+" : ""}
                            {m.mod_iq}
                          </span>
                        ) : null}
                        {m.mod_ht != null ? (
                          <span className="text-purple-400">
                            HT {m.mod_ht >= 0 ? "+" : ""}
                            {m.mod_ht}
                          </span>
                        ) : null}
                        {m.mod_fatigue != null ? (
                          <span className="text-blue-400">
                            FP {m.mod_fatigue >= 0 ? "+" : ""}
                            {m.mod_fatigue}
                          </span>
                        ) : null}
                        {m.hp != null ? (
                          <span className="text-red-400">
                            Base HP&rarr;{m.hp}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
