import { Fragment } from "react";
import type { CharacterViewer, Sheet, VisibilityRule } from "@/lib/types";
import RadarChart from "@/components/RadarChart";
import { buildVisibilityMap, isItemHidden, isSkillHidden, isAttributeHidden, isAdvantageHidden, isDisadvantageHidden } from "@/lib/visibility";
import { resolveAttack, DAMAGE_TYPES } from "@/lib/damage";

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

function zoneInfo(
  armors: Array<{ locations?: string; fit?: string; value?: string; dr?: number }> | undefined,
  ...fits: string[]
): { dr: number; fit?: string } {
  let dr = 0;
  let fit: string | undefined;
  for (const a of armors ?? []) {
    if (fits.some((f) => a.locations?.toLowerCase()?.includes(f))) {
      if (a.dr != null) {
        dr += a.dr;
      } else {
        const m = /(\d+)/.exec(a.value ?? "");
        if (m) dr += parseInt(m[1], 10);
      }
      if (!fit && a.fit) fit = a.fit;
    }
  }
  return { dr, fit };
}

function zoneBadge(
  label: string,
  info: { dr: number; fit?: string },
  style: React.CSSProperties
): React.ReactNode {
  return (
    <div
      className="absolute flex flex-col items-center justify-center rounded border border-amber-400/40 bg-zinc-900/95"
      style={{ width: 58, height: 36, ...style }}
    >
      <span className="text-zinc-500 uppercase leading-none" style={{ fontSize: 7, letterSpacing: 0.4 }}>
        {label}
      </span>
      <span className="text-amber-400 font-bold leading-none mt-1" style={{ fontSize: 15 }}>
        DR {info.dr}
      </span>
      {info.fit ? (
        <span className="text-zinc-500 uppercase leading-none mt-0.5" style={{ fontSize: 6, letterSpacing: 0.3 }}>
          {info.fit}
        </span>
      ) : null}
    </div>
  );
}

function armorDiagram(armors: CharacterViewer["character"]["armors"]): React.ReactNode {
  const head = zoneInfo(armors, "head", "helmet", "skull");
  const torso = zoneInfo(armors, "torso", "chest", "body", "full body");
  const armL = zoneInfo(armors, "arm", "arms");
  const armR = armL;
  const legL = zoneInfo(armors, "leg", "legs");
  const legR = legL;

  return (
    <div className="relative flex justify-center py-12">
      <div className="relative">
        <svg
          fill="#52525b"
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: 90 }}
        >
          <circle cx="256" cy="56" r="56" />
          <path d="M437,128H75a27,27,0,0,0,0,54H176.88c6.91,0,15,3.09,19.58,15,5.35,13.83,2.73,40.54-.57,61.23l-4.32,24.45a.42.42,0,0,1-.12.35l-34.6,196.81A27.43,27.43,0,0,0,179,511.58a27.06,27.06,0,0,0,31.42-22.29l23.91-136.8S242,320,256,320c14.23,0,21.74,32.49,21.74,32.49l23.91,136.92a27.24,27.24,0,1,0,53.62-9.6L320.66,283a.45.45,0,0,0-.11-.35l-4.33-24.45c-3.3-20.69-5.92-47.4-.57-61.23,4.56-11.88,12.91-15,19.28-15H437a27,27,0,0,0,0-54Z" />
        </svg>
        {zoneBadge("Head", head, { top: -41, left: "50%", transform: "translateX(-50%)" })}
        {zoneBadge("Right Arm", armR, { top: 2, right: -64 })}
        {zoneBadge("Left Arm", armL, { top: 2, left: -64 })}
        {zoneBadge("Torso", torso, { top: 48, left: -64 })}
        {zoneBadge("Right Leg", legR, { top: 95, left: "50%", transform: "translateX(3px)" })}
        {zoneBadge("Left Leg", legL, { top: 95, left: "50%", transform: "translateX(calc(-100% - 3px))" })}
      </div>
    </div>
  );
}

function sectionTitle(title: string, icon?: React.ReactNode): React.ReactNode {
  return (
    <div className="flex items-center gap-2 mb-3 border-b border-zinc-700/60 pb-1.5">
      {icon || null}
      <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-300">{title}</h2>
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

function swordIcon(className = "w-4 h-4 text-amber-500"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <line x1="21" y1="16" x2="16" y2="21" />
    </svg>
  );
}

function shieldIcon(className = "w-3.5 h-3.5 text-cyan-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 2.5V10c0 4.6-3 7.9-7 9.5C8 17.9 5 14.6 5 10V5.5L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function axeIcon(className = "w-3.5 h-3.5 text-rose-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3l6 6-7 1-6-6 7-1z" />
      <path d="M2 22l7-7" />
      <path d="M14 9l-3-3" />
    </svg>
  );
}

function gunIcon(className = "w-3.5 h-3.5 text-emerald-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h13l3 4v3h-4l-2 2H8v-2H3V8z" />
      <path d="M9 8V6h4v2" />
    </svg>
  );
}

function bowIcon(className = "w-3.5 h-3.5 text-purple-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h6a6 6 0 016 6v1" />
      <path d="M3 16h6a6 6 0 006-6V9" />
      <path d="M13 9l-8-3 8-3v6z" />
    </svg>
  );
}

function windIcon(className = "w-4 h-4 text-cyan-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </svg>
  );
}

function footprintsIcon(className = "w-4 h-4 text-cyan-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 1-4 0" />
    </svg>
  );
}

function packageIcon(className = "w-4 h-4 text-cyan-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </svg>
  );
}

function swordsIcon(className = "w-4 h-4 text-amber-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <line x1="21" y1="16" x2="16" y2="21" />
    </svg>
  );
}

function dodgeIcon(className = "w-4 h-4 text-amber-400"): React.ReactNode {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}

function weaponIconFor(g: { kind?: string; category?: string; name: string }): React.ReactNode {
  const hay = `${g.kind ?? ""} ${g.category ?? ""} ${g.name}`.toLowerCase();
  if (/shield|buckler/.test(hay)) return shieldIcon();
  if (/axe|hatchet|tomahawk|cleaver/.test(hay)) return axeIcon();
  if (/bow|arrow|crossbow|sling|staff/.test(hay)) return bowIcon();
  if (/gun|pistol|rifle|revolver|shotgun|musket|carbine|ranged|firearm/.test(hay)) return gunIcon();
  return swordIcon("w-3.5 h-3.5 text-amber-400");
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

function hpPct(hp: number | undefined, base: number | undefined): number {
  return Math.min(100, Math.max(0, ((hp || 0) / (base || 1)) * 100));
}

function fpPct(fatigue: number | undefined, ht: number | undefined): number {
  return Math.min(100, Math.max(0, ((fatigue || 0) / (ht || 1)) * 100));
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

function activeEffects(m: {
  mod_hp?: number;
  mod_st?: number;
  mod_dx?: number;
  mod_iq?: number;
  mod_ht?: number;
  mod_fatigue?: number;
}): boolean {
  return (
    m.mod_hp != null || m.mod_st != null || m.mod_dx != null ||
    m.mod_iq != null || m.mod_ht != null || m.mod_fatigue != null
  );
}

function signedDelta(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function effectDeltas(m: {
  mod_hp?: number;
  mod_st?: number;
  mod_dx?: number;
  mod_iq?: number;
  mod_ht?: number;
  mod_fatigue?: number;
}): Array<{ key: string; label: string; value: string; cls: string }> {
  const chips: Array<{ key: string; label: string; value: string; cls: string }> = [];
  if (m.mod_hp != null) chips.push({ key: "hp", label: "HP", value: signedDelta(m.mod_hp), cls: "text-red-400" });
  if (m.mod_st != null) chips.push({ key: "st", label: "ST", value: signedDelta(m.mod_st), cls: "text-red-400" });
  if (m.mod_dx != null) chips.push({ key: "dx", label: "DX", value: signedDelta(m.mod_dx), cls: "text-emerald-400" });
  if (m.mod_iq != null) chips.push({ key: "iq", label: "IQ", value: signedDelta(m.mod_iq), cls: "text-blue-400" });
  if (m.mod_ht != null) chips.push({ key: "ht", label: "HT", value: signedDelta(m.mod_ht), cls: "text-purple-400" });
  if (m.mod_fatigue != null) chips.push({ key: "fp", label: "FP", value: signedDelta(m.mod_fatigue), cls: "text-blue-400" });
  return chips;
}

function effectSign(m: {
  mod_hp?: number;
  mod_st?: number;
  mod_dx?: number;
  mod_iq?: number;
  mod_ht?: number;
  mod_fatigue?: number;
}): -1 | 0 | 1 {
  const deltas = [m.mod_hp, m.mod_st, m.mod_dx, m.mod_iq, m.mod_ht, m.mod_fatigue]
    .filter((n): n is number => n != null);
  if (!deltas.length) return 0;
  if (deltas.some((n) => n < 0) && !deltas.some((n) => n > 0)) return -1;
  if (deltas.some((n) => n > 0) && !deltas.some((n) => n < 0)) return 1;
  return 0;
}

interface CharacterSheetProps {
  data: CharacterViewer;
  basePath: string;
  visibility?: VisibilityRule[] | null;
}

export default function CharacterSheet({ data, visibility }: CharacterSheetProps) {
  const ch = data.character;
  const s = ch.sheet;
  const name = s?.name || ch.name || "Character";
  const modifiers = ch.active_effects ?? [];
  const effects = modifiers.filter(activeEffects);

  const vis = visibility ? buildVisibilityMap(visibility) : null;
  const censored = (field: string): string => vis?.values.get(field) ?? "???";
  const itemHidden = (id?: string | null) => vis ? isItemHidden(vis, id) : false;
  const skillHidden = (id?: string | null) => vis ? isSkillHidden(vis, id) : false;
  const advHidden = (id?: string | null) => vis ? isAdvantageHidden(vis, id) : false;
  const disHidden = (id?: string | null) => vis ? isDisadvantageHidden(vis, id) : false;
  const attrHidden = (a?: string | null) => vis ? isAttributeHidden(vis, a) : false;
  const masked = (a?: string | null, raw?: string | number | null, fallback = "-") =>
    attrHidden(a) ? censored(`attr:${String(a).toLowerCase()}`) : (raw ?? fallback);

  const isCarried = (it: { equipment_status?: string }) =>
    it.equipment_status === "equipped" || it.equipment_status === "wielded";

  const weaponGroups = (ch.items ?? [])
    .filter((it) => isCarried(it) && it.weapon && it.weapon.attacks.length > 0)
    .map((it) => ({
      name: it.name || "Unnamed",
      kind: it.kind,
      category: it.category,
      quality: it.quality,
      condition: it.condition,
      location: it.equipment_location || it.equipment_status,
      weapon: it.weapon!,
    }));
  const visibleWeaponGroups = vis
    ? weaponGroups.filter((g) => !itemHidden(ch.items?.find((it) => it.name === g.name)?.id))
    : weaponGroups;

  const parseDefense = (val?: string | null): number | null => {
    if (!val) return null;
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : null;
  };

  const passive = (() => {
    const dx = s?.dx ?? 10;
    const parryVals = (ch.items ?? [])
      .filter(isCarried)
      .map((i) => parseDefense(i.weapon?.parry))
      .filter((n): n is number => n != null);
    const blockVals = (ch.items ?? [])
      .filter(isCarried)
      .map((i) => parseDefense(i.weapon?.block))
      .filter((n): n is number => n != null);
    const parry = parryVals.length ? Math.max(...parryVals) : Math.floor(dx / 2) + 3;
    const block = blockVals.length ? Math.max(...blockVals) : Math.floor(dx / 2) + 3;
    const dodge = Math.round(((s?.basic_speed ?? 0) + 3) * 10) / 10;
    return { parry, block, dodge };
  })();

  const fittedArmors = (ch.items ?? [])
    .filter((it) => isCarried(it) && it.armor)
    .map((it) => ({
      id: it.armor?.id || it.id,
      name: it.name || it.armor?.locations || "Armor",
      dr: it.armor?.dr ?? 0,
      fit: it.armor?.fit || it.armor?.locations || "",
      status: it.equipment_status || "Equipped",
      locations: it.equipment_location || it.armor?.locations || "",
    }));
  const visibleArmors = vis ? fittedArmors.filter((a) => !itemHidden(ch.items?.find((it) => (it.armor?.id || it.id) === a.id)?.id)) : fittedArmors;
  const equipmentItems = (ch.items ?? []).filter(
    (it) =>
      isCarried(it) &&
      !(it.weapon && it.weapon.attacks.length > 0) &&
      !it.armor
  );
  const visibleSkills = vis
    ? (ch.skills ?? []).filter((sk) => !skillHidden(sk.skill_id ?? sk.id))
    : ch.skills;
  const visibleAdvantages = vis
    ? (ch.advantages ?? []).filter((a) => !advHidden(a.advantage_id ?? a.id))
    : ch.advantages;
  const visibleDisadvantages = vis
    ? (ch.disadvantages ?? []).filter((d) => !disHidden(d.disadvantage_id ?? d.id))
    : ch.disadvantages;

  return (
    <>
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h1 className="text-3xl font-bold text-amber-100 tracking-tight">{name}</h1>
            {s?.bio ? <p className="text-lg text-zinc-400 mt-1">{s.bio}</p> : null}
            {s?.backstory ? <p className="text-zinc-500 text-sm mt-1 max-w-2xl">{s.backstory}</p> : null}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Build Points</span>
            <p className="text-amber-400 font-bold text-2xl leading-none mt-1">{masked("points", s?.points, "0")}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Core Attributes
              </h3>
              <div className="flex justify-center flex-wrap gap-1 mb-6">
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={a.svg} />
                    </svg>
                    <span className={`${a.color} text-xl font-bold`}>
                      {s ? (attrHidden(a.label) ? censored(`attr:${a.label.toLowerCase()}`) : (a.value(s) ?? "-")) : "-"}
                      {s && !attrHidden(a.label) ? statDiff(a.base(s), a.value(s)) : null}
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold uppercase">{a.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                {s ? (
                  <RadarChart
                    st={s.st ?? 10}
                    dx={s.dx ?? 10}
                    iq={s.iq ?? 10}
                    ht={s.ht ?? 10}
                    size={180}
                    showValues
                  />
                ) : null}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Vitals
              </h3>
              <div className="space-y-4">
                <div className="flex w-full items-center gap-2">
                  <span className="w-16 text-zinc-500 text-xs font-semibold uppercase shrink-0">HP</span>
                  <span className="text-red-400 font-bold text-lg shrink-0">
                    {s?.hp ?? "-"}
                    <span className="text-zinc-500 font-medium text-sm">/{s?.base_hp ?? "-"}</span>
                  </span>
                  <div className="w-full bg-zinc-700/50 rounded-full h-2">
                    <div
                      className="bg-red-500/80 h-2 rounded-full"
                      style={{ width: `${hpPct(s?.hp, s?.base_hp)}%` }}
                    />
                  </div>
                </div>

                <div className="flex w-full items-center gap-2">
                  <span className="w-16 text-zinc-500 text-xs font-semibold uppercase shrink-0">FP</span>
                  <span className="text-blue-400 font-bold text-lg shrink-0">
                    {s?.fatigue ?? "-"}
                    <span className="text-zinc-500 font-medium text-sm">/{s?.ht ?? "-"}</span>
                  </span>
                  <div className="w-full bg-zinc-700/50 rounded-full h-2">
                    <div
                      className="bg-blue-500/80 h-2 rounded-full"
                      style={{ width: `${fpPct(s?.fatigue, s?.ht)}%` }}
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-6 mb-3">
                Movement
              </h3>
              <div className="grid grid-cols-3 gap-1">
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {windIcon()}
                  <span className="text-cyan-400 text-sm font-bold">{masked("basic_speed", s?.basic_speed)}</span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Basic Speed</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {footprintsIcon()}
                  <span className="text-cyan-400 text-sm font-bold">{masked("move", s?.move)}</span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Move</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {packageIcon()}
                  <span className="text-cyan-400 text-sm font-bold truncate max-w-full">
                    {masked("encumbrance", s?.encumbrance)}
                  </span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Encumbrance</span>
                </div>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-6 mb-3">
                Passive Defenses
              </h3>
              <div className="grid grid-cols-3 gap-1">
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {swordsIcon()}
                  <span className="text-amber-400 text-sm font-bold">{masked("parry", s?.dx == null ? null : passive.parry)}</span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Parry</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {shieldIcon("w-4 h-4 text-amber-400")}
                  <span className="text-amber-400 text-sm font-bold">{masked("block", s?.dx == null ? null : passive.block)}</span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Block</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-zinc-800/40 rounded-lg">
                  {dodgeIcon()}
                  <span className="text-amber-400 text-sm font-bold">{masked("dodge", s?.basic_speed == null ? null : passive.dodge)}</span>
                  <span className="text-zinc-500 text-[10px] font-semibold uppercase text-center">Dodge</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Offense
              </h3>
              {visibleWeaponGroups.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">No weapons equipped</p>
              ) : (
                visibleWeaponGroups.map((g, gi) => {
                  const hand = g.weapon.handedness === 2 ? "2H" : g.weapon.handedness === 1 ? "1H" : "";
                  const tags = [hand, g.weapon.reach ? `Reach ${g.weapon.reach}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Fragment key={g.weapon.id || g.name}>
                      {gi > 0 ? (
                        <hr className="border-0 border-t border-dotted border-zinc-600 my-3" />
                      ) : null}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="shrink-0">{weaponIconFor(g)}</span>
                          <span className="text-zinc-100 font-semibold text-sm">{g.name}</span>
                          {g.location ? (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-500">
                              {g.location.replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1 text-xs mb-2">
                          {g.quality ? (
                            <div className="flex items-center">
                              <span className="w-20 shrink-0 text-zinc-500 uppercase tracking-wide">Quality</span>
                              <span className="text-amber-400/90 capitalize">{g.quality}</span>
                            </div>
                          ) : null}
                          {g.condition && g.condition !== "new" ? (
                            <div className="flex items-center">
                              <span className="w-20 shrink-0 text-zinc-500 uppercase tracking-wide">Condition</span>
                              <span className="text-zinc-300 capitalize">{g.condition}</span>
                            </div>
                          ) : null}
                          {tags ? (
                            <div className="flex items-center">
                              <span className="w-20 shrink-0 text-zinc-500 uppercase tracking-wide">Weapon</span>
                              <span className="text-zinc-400 uppercase">{tags}</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {g.weapon.attacks.map((atk, ai) => {
                            const resolved = resolveAttack(atk, s?.st ?? 10, g.weapon.rated_st);
                            const ranged = isRanged(atk.range) || isRanged(atk.name);
                            return (
                              <div key={atk.id || `${g.weapon.id}-${ai}`} className="flex items-center gap-2 text-sm">
                                <span className={ranged ? "text-cyan-400" : "text-red-400"}>
                                  {ranged ? rangedIcon() : meleeIcon()}
                                </span>
                                <span className="text-zinc-300 font-medium">{atk.name || "Attack"}</span>
                                {atk.usage ? <span className="text-zinc-500 text-xs">{atk.usage}</span> : null}
                                <span className="text-red-400 font-bold ml-auto">{resolved}</span>
                                <span className="text-zinc-400 text-xs">
                                  {DAMAGE_TYPES[atk.damage_type] || atk.damage_type}
                                </span>
                                {atk.range ? (
                                  <span className="text-zinc-500 text-xs">({atk.range})</span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>

          {effects.length > 0 ? (
            <div className="mt-6 pt-4 border-t border-zinc-700/40">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Active effects
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  {effects.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {effects.map((m) => {
                  const deltas = effectDeltas(m);
                  const sign = effectSign(m);
                  const dot =
                    sign < 0 ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]" :
                    sign > 0 ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" :
                    "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-2.5 py-1.5"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                      <span className="text-zinc-200 text-sm font-medium">{m.name || "Effect"}</span>
                      {deltas.length > 0 ? (
                        <span className="flex items-center gap-1.5 ml-1">
                          {deltas.map((d) => (
                            <span key={d.key} className={`font-mono text-[10px] ${d.cls}`}>
                              {d.label} {d.value}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div>
              {sectionTitle(
                "Advantages",
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {!visibleAdvantages || visibleAdvantages.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">None</p>
              ) : (
                visibleAdvantages.map((a) => (
                  <div
                    key={a.id}
                    className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 text-sm font-medium">{a.name}</span>
                      <span className="text-emerald-400 text-xs font-semibold">+{a.cost_points}</span>
                    </div>
                    {a.effect ? <p className="text-zinc-500 text-xs mt-0.5">{a.effect}</p> : null}
                  </div>
                ))
              )}
            </div>
            <div>
              {sectionTitle(
                "Disadvantages",
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {!visibleDisadvantages || visibleDisadvantages.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">None</p>
              ) : (
                visibleDisadvantages.map((d) => (
                  <div
                    key={d.id}
                    className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 text-sm font-medium">{d.name}</span>
                      <span className="text-red-400 text-xs font-semibold">{d.cost_points}</span>
                    </div>
                    {d.effect ? <p className="text-zinc-500 text-xs mt-0.5">{d.effect}</p> : null}
                  </div>
                ))
              )}
            </div>
            <div>
              {sectionTitle(
                "Peculiarities",
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-10h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
              {!ch.peculiarities || ch.peculiarities.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">None</p>
              ) : (
                ch.peculiarities.map((p) => (
                  <div
                    key={p.id}
                    className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 text-sm font-medium">{p.name}</span>
                      <span className="text-cyan-400 text-xs font-semibold">{p.cost_points}</span>
                    </div>
                    {p.effect ? <p className="text-zinc-500 text-xs mt-0.5">{p.effect}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div>
              {sectionTitle(
                "Skills",
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              )}
              {!visibleSkills || visibleSkills.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">None</p>
              ) : (
                visibleSkills.map((sk) => {
                  const level = sk.value ?? null;
                  return (
                    <div
                      key={sk.id}
                      className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-200 text-sm font-medium">{sk.skill_name || sk.name}</span>
                        {level != null ? (
                          <span className="text-amber-400 font-bold text-sm">{level}-</span>
                        ) : (
                          <span className="text-zinc-500 text-xs">
                            {sk.predefinition_type || ""}
                            {sk.predefinition_difficulty ? " / " + sk.predefinition_difficulty : ""}
                          </span>
                        )}
                      </div>
                      {level != null ? (
                        <div className="text-xs text-zinc-500">
                          {[sk.predefinition_type, sk.predefinition_difficulty].filter(Boolean).join(" · ") ||
                            "Roll against value"}
                        </div>
                      ) : null}
                      {sk.effect ? <p className="text-zinc-500 text-xs mt-0.5">{sk.effect}</p> : null}
                    </div>
                  );
                })
              )}
            </div>

            <div>
              {sectionTitle(
                "Body & Armor",
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              )}
              {armorDiagram(ch.armors)}
              <div className="space-y-1 border-t border-zinc-700/40 pt-3">
                {visibleArmors.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic">Unarmored</p>
                ) : (
                  visibleArmors.map((a) => (
                    <div key={a.id} className="flex justify-between items-center text-xs">
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-medium">{a.name}</span>
                        <span className="text-zinc-500 uppercase tracking-wide text-[10px]">
                          {[a.status, a.locations].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <span className="text-amber-400/90 text-right">
                        DR {a.dr}
                        {a.fit ? ` · ${a.fit}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              {sectionTitle(
                "Equipment",
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
              {equipmentItems.length === 0 ? (
                <p className="text-zinc-600 text-sm italic">Nothing carried</p>
              ) : (
                equipmentItems.map((it) => (
                  <div
                    key={it.id}
                    className="bg-zinc-800/60 rounded-lg border border-zinc-700/40 px-3 py-2 mb-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 text-sm font-medium">
                        {it.name || "Unidentified item"}
                      </span>
                      {it.equipment_quantity != null ? (
                        <span className="text-zinc-500 text-xs">×{it.equipment_quantity}</span>
                      ) : null}
                    </div>
                    {it.weight_lb != null ? (
                      <span className="text-zinc-500 text-[10px] uppercase tracking-wide">
                        {it.weight_lb} lb
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
