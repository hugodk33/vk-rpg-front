import Link from "next/link";
import CharacterJourney from "@/components/character/CharacterJourney";
import {
  characterTabHref,
  type SheetTab,
} from "@/components/character/CharacterTabs";

/* ============================================================
   Journey tab: historical moment pills + chronicle timeline.
   Moment links preserve the active tab so navigating history
   does not drop the user out of the Journey view.
   ============================================================ */

interface CharacterJourneyViewProps {
  characterId: string;
  basePath: string;
  moments: number[];
  selectedMoment: number | null;
  tab: SheetTab;
}

export default function CharacterJourneyView({
  characterId,
  basePath,
  moments,
  selectedMoment,
  tab,
}: CharacterJourneyViewProps) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
      <div className="p-4">
        {moments.length > 0 ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1">
                History
              </span>
              <Link
                href={characterTabHref(basePath, tab, null)}
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
                    href={characterTabHref(basePath, tab, m)}
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
            {selectedMoment != null ? (
              <p className="text-xs text-zinc-500 mt-2">
                Viewing character state at{" "}
                <span className="text-amber-400 font-medium">Moment {selectedMoment}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        <CharacterJourney characterId={characterId} selectedMoment={selectedMoment} />
      </div>
    </div>
  );
}