import Link from "next/link";

interface NarratorTabsProps {
  active: "tables" | "kit";
}

function tabClass(active: boolean): string {
  return `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
    active
      ? "text-zinc-200 border-amber-500"
      : "text-zinc-400 hover:text-zinc-200 border-transparent"
  }`;
}

export default function NarratorTabs({ active }: NarratorTabsProps) {
  return (
    <div className="flex gap-1 border-b border-zinc-700/50 mb-6">
      <Link href="/narrator" className={tabClass(active === "tables")}>
        Tables
      </Link>
      <Link href="/narrator/kit" className={tabClass(active === "kit")}>
        GM Kit
      </Link>
    </div>
  );
}
