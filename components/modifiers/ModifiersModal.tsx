"use client";

/* ============================================================
   ModifiersModal — a button on an entity's own screen that opens
   its modifiers in a dialog.

   The panel itself already lived inside the edit forms
   (AdvantageForm, DisadvantageForm, SkillForm). On the individual
   screen there is no form to host it, and inlining a second copy
   would bury a control the narrator reaches for often, so the button
   keeps the screen clean and the panel in one place.

   Plain fixed overlay rather than <dialog>: the panel inside has its
   own scroll area and the native dialog's focus/`::backdrop`
   handling fights the panel's own layout. Escape and a backdrop
   click both close; the trigger keeps focus so the keyboard path
   back out works.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import EntityModifiers, { type OwnerField } from "./EntityModifiers";

export default function ModifiersModal({
  ownerField,
  ownerId,
  tableId,
}: {
  ownerField: OwnerField;
  ownerId: string;
  tableId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    /* The panel scrolls; the page behind must not. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
      >
        <span aria-hidden className="font-mono text-sm leading-none text-green-300">
          ◐
        </span>
        {t("mdl.modifiers")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/80 p-4 sm:p-8">
          <button
            type="button"
            aria-label={t("mdl.close")}
            onClick={close}
            className="fixed inset-0 -z-10 cursor-default focus:outline-none"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("mdl.modifiers")}
            className="relative w-full max-w-2xl rounded-xl border border-zinc-700/60 bg-zinc-900/95 shadow-2xl backdrop-blur"
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-green-500">
                {t("mdl.modifiers")}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={t("mdl.close")}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </header>

            <div className="p-5">
              {/* The panel ships its own card; inside the dialog that would
                  be a box inside a box, so the frame is dropped here. */}
              <EntityModifiers
                ownerField={ownerField}
                ownerId={ownerId}
                tableId={tableId}
                bare
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}