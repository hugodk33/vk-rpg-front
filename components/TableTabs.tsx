import Link from "next/link";

interface TableTabsProps {
  tableId: string;
  role?: "narrator" | "player";
  active?: "overview" | "sessions" | "timeline" | "character";
  characterUrl?: string;
  characterHref?: string;
}

const dropdownLink =
  "block px-4 py-2 text-zinc-300 hover:text-amber-400 hover:bg-zinc-700/50 text-sm";

function tabClass(active: boolean): string {
  return `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
    active
      ? "text-zinc-200 border-amber-500"
      : "text-zinc-400 hover:text-zinc-200 border-transparent"
  }`;
}

export default function TableTabs({ tableId, role = "narrator", active, characterUrl, characterHref }: TableTabsProps) {
  const prefix = role === "player" ? "/player" : "";

  const dashboardHref = role === "player" ? "/player" : "/narrator";

  return (
    <>
      <a href={dashboardHref} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Tables
      </a>
    <div className="flex gap-1 border-b border-zinc-700/50 mb-6">
      <div className="relative flex items-center">
        <Link href={`${prefix}/table/${tableId}`} className={tabClass(active === "overview")}>
          Table
        </Link>
        <details className="relative self-stretch flex items-center">
          <summary className="px-1 text-zinc-400 hover:text-zinc-200 cursor-pointer list-none flex items-center">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute top-full right-0 mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
            <Link href={`${prefix}/table/${tableId}/items`} className={dropdownLink}>Items</Link>
            <Link href={`${prefix}/table/${tableId}/advantages`} className={dropdownLink}>Advantages</Link>
            <Link href={`${prefix}/table/${tableId}/disadvantages`} className={dropdownLink}>Disadvantages</Link>
            <Link href={`${prefix}/table/${tableId}/skills`} className={dropdownLink}>Skills</Link>
            <Link href={`${prefix}/table/${tableId}/characters`} className={dropdownLink}>Characters</Link>
            <Link href={`${prefix}/table/${tableId}/locations`} className={dropdownLink}>Locations</Link>
          </div>
        </details>
      </div>
      <Link href={`${prefix}/table/${tableId}/sessions`} className={tabClass(active === "sessions")}>
        Sessions
      </Link>
      <Link href={`${prefix}/table/${tableId}/scenes`} className={tabClass(active === "timeline")}>
        Timeline
      </Link>
      {active === "character" && characterHref ? (
        <Link href={characterHref} className={tabClass(true)}>
          Character
        </Link>
      ) : null}
      {role === "player" && characterUrl && active !== "character" ? (
        <Link
          href={characterUrl}
          className="px-4 py-2.5 text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent"
        >
          Character
        </Link>
      ) : null}
    </div>
    </>
  );
}
