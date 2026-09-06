"use client";

/* ============================================================
   CharacterVisibilityDrawer — fixed bottom-right toggle that
   slides a VisibilityPanel in, locked to the character being
   viewed. Used by the narrator from a character sheet.
   ============================================================ */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  Advantage,
  Disadvantage,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableSkills,
  Item,
  SkillItem,
  TableCharacter,
} from "@/lib/types";
import VisibilityPanel from "@/components/visibility/VisibilityPanel";

interface DrawerData {
  characters: TableCharacter[];
  items: Item[];
  skills: SkillItem[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
}

export default function CharacterVisibilityDrawer({
  tableId,
  targetId,
}: {
  tableId?: string;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DrawerData | null>(null);

  useEffect(() => {
    if (!open || !tableId) return;
    let cancelled = false;
    Promise.all([
      api<GameTableCharacters>(`/game-table-characters/${tableId}`),
      api<GameTableItems>(`/game-table-items/${tableId}`),
      api<GameTableSkills>(`/game-table-skills/${tableId}`),
      api<GameTableAdvantages>(`/game-table-advantages/${tableId}`),
      api<GameTableDisadvantages>(`/game-table-disadvantages/${tableId}`),
    ])
      .then(([chars, items, skills, advs, dis]) => {
        if (cancelled) return;
        setData({
          characters: chars?.characters ?? [],
          items: items?.items ?? [],
          skills: skills?.skills ?? [],
          advantages: advs?.advantages ?? [],
          disadvantages: dis?.disadvantages ?? [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setData({ characters: [], items: [], skills: [], advantages: [], disadvantages: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, tableId]);

  if (!tableId) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900/95 text-sm text-zinc-200 hover:text-amber-300 hover:border-amber-500/50 shadow-xl backdrop-blur transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z"
          />
        </svg>
        Visibility
      </button>

      {open ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
                Visibility
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                What observers can see of this character
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              aria-label="Close visibility drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {data ? (
              <VisibilityPanel
                characters={data.characters}
                items={data.items}
                skills={data.skills}
                advantages={data.advantages}
                disadvantages={data.disadvantages}
                targetId={targetId}
                compact
              />
            ) : (
              <p className="text-sm text-zinc-500 animate-pulse">
                Loading visibility data…
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}