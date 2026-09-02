import Link from "next/link";

/* ============================================================
   Table navigation — primary tab bar.
   "Table" opens the resource group (items, advantages, skills...);
   Sessions / Timeline are linear tabs. Active state in amber,
   visible focus, compact mono labels.
   ============================================================ */

interface TableTabsProps {
  tableId: string;
  role?: "narrator" | "player";
  active?: "overview" | "sessions" | "timeline" | "character";
  characterUrl?: string;
  characterHref?: string;
  hideBreadcrumb?: boolean;
}

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const ICONS = {
  overview: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  bag: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
  adv: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  dis: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M9.05 7.4a3 3 0 000 9.2M14.95 7.4a3 3 0 010 9.2M12 2a10 10 0 100 20 10 10 0 000-20z",
  skills: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  chars: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  loc: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
  sessions: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  timeline: "M12 6V4m0 16v-2m0-4V8M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4 12H2m20 0h-2m-1.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41M12 16a4 4 0 100-8 4 4 0 000 8z",
  character: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 16a3.001 3.001 0 00-2.83-2M15 11a2 2 0 11-4 0 2 2 0 014 0z",
};

const RESOURCES = [
  { href: "/items", label: "Items", icon: "bag" },
  { href: "/advantages", label: "Advantages", icon: "adv" },
  { href: "/disadvantages", label: "Disadvantages", icon: "dis" },
  { href: "/skills", label: "Skills", icon: "skills" },
  { href: "/characters", label: "Characters", icon: "chars" },
  { href: "/locations", label: "Locations", icon: "loc" },
] as const;

function tabActive(active: boolean): string {
  return `relative inline-flex items-center gap-1.5 px-3 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded-md ${
    active
      ? "text-amber-400"
      : "text-zinc-400 hover:text-zinc-100"
  }`;
}

export default function TableTabs({ tableId, role = "narrator", active, characterUrl, characterHref, hideBreadcrumb }: TableTabsProps) {
  const prefix = role === "player" ? "/player" : "";
  const dashboardHref = role === "player" ? "/player" : "/narrator";

  return (
    <>
      {!hideBreadcrumb ? (
        <a
          href={dashboardHref}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200 transition-colors mb-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Tables
        </a>
      ) : null}

      <nav aria-label="Table navigation" className="flex gap-0.5 border-b border-zinc-800 mb-6">
        {/* Table — resource group (narrator only; players see only their characters) */}
        {role !== "player" ? (
        <details className="group relative">
          <summary
            className="list-none cursor-pointer select-none inline-flex items-center gap-1.5 px-3 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Table resources"
          >
            {icon(ICONS.overview, "w-4 h-4")}
            <span className={active === "overview" ? "text-amber-400" : ""}>Table</span>
            <svg className="w-3.5 h-3.5 text-zinc-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
            {/* indicador ativo */}
            {active === "overview" ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-500" /> : null}
          </summary>

          <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-zinc-700/60 bg-zinc-900/95 backdrop-blur shadow-2xl py-1.5 z-50">
            {/* Overview */}
            <Link
              href={`${prefix}/table/${tableId}`}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700/50 hover:text-amber-300 rounded transition-colors"
            >
              {icon(ICONS.overview, "w-4 h-4 text-zinc-500")}
              Overview
            </Link>
            <div className="my-1.5 h-px bg-zinc-700/50" />
            {RESOURCES.map((r) => (
              <Link
                key={r.href}
                href={`${prefix}/table/${tableId}${r.href}`}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-amber-300 rounded transition-colors"
              >
                {icon(ICONS[r.icon], "w-4 h-4 text-zinc-500")}
                {r.label}
              </Link>
            ))}
          </div>
        </details>
        ) : null}

        <Link href={`${prefix}/table/${tableId}/sessions`} className={`${tabActive(active === "sessions")} ${active === "sessions" ? "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-500 after:content-['']" : ""}`}>
          {icon(ICONS.sessions, "w-4 h-4")} Sessions
        </Link>

        <Link href={`${prefix}/table/${tableId}/scenes`} className={`${tabActive(active === "timeline")} ${active === "timeline" ? "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-500 after:content-['']" : ""}`}>
          {icon(ICONS.timeline, "w-4 h-4")} Timeline
        </Link>

        {active === "character" && characterHref ? (
          <Link href={characterHref} className={`${tabActive(true)} after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-500 after:content-['']`}>
            {icon(ICONS.character, "w-4 h-4")} Character
          </Link>
        ) : null}

        {role === "player" && characterUrl && active !== "character" ? (
          <Link href={characterUrl} className={tabActive(false)}>
            {icon(ICONS.character, "w-4 h-4")} Character
          </Link>
        ) : null}
      </nav>
    </>
  );
}
