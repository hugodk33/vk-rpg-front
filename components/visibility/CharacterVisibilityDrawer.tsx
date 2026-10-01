"use client";

/* ============================================================
   CharacterVisibilityDrawer — fixed bottom-right toggle that
   slides a VisibilityPanel in, locked to the character being
   viewed. Used by the narrator from a character sheet.
   ============================================================ */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { seatActorQuery } from "@/lib/seat";
import { useTranslation } from "@/lib/i18n";
import type {
  Advantage,
  Disadvantage,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableLocations,
  GameTableScenes,
  GameTableSkills,
  Item,
  Location,
  SkillItem,
  TableCharacter,
} from "@/lib/types";
import VisibilityPanel from "@/components/visibility/VisibilityPanel";

interface DrawerData {
  characters: TableCharacter[];
  items: Item[];
  locations: Location[];
  skills: SkillItem[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  scenes: GameTableScenes | null;
}

export default function CharacterVisibilityDrawer({
  tableId,
  targetId,
}: {
  tableId?: string;
  targetId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DrawerData | null>(null);

  useEffect(() => {
    if (!open || !tableId) return;
    let cancelled = false;
    Promise.all([
      api<GameTableCharacters>(`/game-table-characters/${tableId}`),
      api<GameTableItems>(`/game-table-items/${tableId}`),
      api<GameTableLocations>(`/game-table-locations/${tableId}${seatActorQuery()}`),
      api<GameTableSkills>(`/game-table-skills/${tableId}`),
      api<GameTableAdvantages>(`/game-table-advantages/${tableId}`),
      api<GameTableDisadvantages>(`/game-table-disadvantages/${tableId}`),
      api<GameTableScenes>(`/game-table-scenes/${tableId}`),
    ])
      .then(([chars, items, locations, skills, advs, dis, scenes]) => {
        if (cancelled) return;
        setData({
          characters: chars?.characters ?? [],
          items: items?.items ?? [],
          locations: locations?.locations ?? [],
          skills: skills?.skills ?? [],
          advantages: advs?.advantages ?? [],
          disadvantages: dis?.disadvantages ?? [],
          scenes: scenes ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setData({
          characters: [],
          items: [],
          locations: [],
          skills: [],
          advantages: [],
          disadvantages: [],
          scenes: null,
        });
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
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900/95 text-sm text-zinc-200 hover:text-green-400 hover:border-green-700/50 shadow-xl backdrop-blur transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
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
        {t("vs.cvd.visibility")}
      </button>

      {open ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-green-500">
                {t("vs.cvd.visibility")}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t("vs.cvd.subtitle")}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
              aria-label={t("vs.cvd.close")}
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
                locations={data.locations}
                skills={data.skills}
                advantages={data.advantages}
                disadvantages={data.disadvantages}
                scenes={data.scenes}
                targetId={targetId}
                perspective={
                  data.characters.find((c) => c.id === targetId)?.isNpc
                    ? "world"
                    : "players"
                }
              />
            ) : (
              <p className="text-sm text-zinc-500 animate-pulse">
                {t("vs.cvd.loading")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}