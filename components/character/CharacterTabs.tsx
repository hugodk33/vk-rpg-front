import Link from "next/link";

/* ============================================================
   Character sheet section tabs — Sheet / Inventory / Journey.
   Moment param is preserved across tabs so a historical
   selection (mental state) stays applied everywhere.
   ============================================================ */

export type SheetTab = "sheet" | "inventory" | "journey";

export function characterTabHref(
  basePath: string,
  tab: SheetTab,
  moment?: number | null
): string {
  const p: string[] = [];
  if (moment != null) p.push(`moment=${moment}`);
  if (tab !== "sheet") p.push(`tab=${tab}`);
  return p.length ? `${basePath}?${p.join("&")}` : basePath;
}

const TABS: Array<{ id: SheetTab; label: string; icon: string }> = [
  {
    id: "sheet",
    label: "Ficha",
    icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 16a3.001 3.001 0 00-2.83-2M15 11a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    id: "inventory",
    label: "Inventário",
    icon: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
  },
  {
    id: "journey",
    label: "Jornada",
    icon: "M12 6V4m0 16v-2m0-4V8M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4 12H2m20 0h-2m-1.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41M12 16a4 4 0 100-8 4 4 0 000 8z",
  },
];

interface CharacterTabsProps {
  basePath: string;
  active?: SheetTab;
  moment?: number | null;
}

export default function CharacterTabs({
  basePath,
  active = "sheet",
  moment = null,
}: CharacterTabsProps) {
  return (
    <nav aria-label="Seções da ficha de personagem" className="flex gap-0.5 border-b border-zinc-800 mb-6">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={characterTabHref(basePath, t.id, moment)}
            aria-current={isActive ? "page" : undefined}
            className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 rounded-md ${
              isActive ? "text-green-500" : "text-zinc-400 hover:text-zinc-100"
            }${isActive ? " after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-green-700 after:content-['']" : ""}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={t.icon} />
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}