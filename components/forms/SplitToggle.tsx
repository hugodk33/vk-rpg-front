"use client";

export default function SplitToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
        active
          ? "bg-amber-600/20 border-amber-500/40 text-amber-300"
          : "bg-zinc-700 hover:bg-zinc-600 border-transparent text-zinc-300"
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
      Split
    </button>
  );
}
