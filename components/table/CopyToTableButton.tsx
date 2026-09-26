"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";

type CopyTarget = { id: string; title?: string; current?: boolean };

export default function CopyToTableButton({
  copyHref,
  tableId,
  className,
  label,
  title,
}: {
  copyHref: string;
  tableId?: string;
  className?: string;
  label?: string;
  title?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tables, setTables] = useState<CopyTarget[]>([]);
  const [copying, setCopying] = useState(false);

  async function openPicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setPickerOpen(true);
    try {
      const list = await api<CopyTarget[]>("/game-tables");
      const current = tableId ? list.find((tbl) => tbl.id === tableId) : undefined;
      const others = list.filter((tbl) => tbl.id !== tableId);
      const selfRow: CopyTarget | null = tableId
        ? { id: tableId, title: current?.title, current: true }
        : null;
      setTables([...(selfRow ? [selfRow] : []), ...others]);
    } catch {
      setTables(tableId ? [{ id: tableId, current: true }] : []);
    }
  }

  async function handleCopy(targetId: string) {
    if (copying) return;
    setCopying(true);
    try {
      await submitJson(copyHref, "POST", { tableId: targetId });
      setPickerOpen(false);
      router.refresh();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : t("ra.fail"));
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        title={title ?? t("ra.copyTitle")}
        className={
          className ??
          "text-[11px] text-sky-300/90 hover:text-sky-200 px-2 py-1 rounded border border-zinc-700/60 hover:border-sky-500/50 transition-colors cursor-pointer"
        }
      >
        {label ?? t("ra.copy")}
      </button>

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-zinc-900 border border-zinc-700/60 rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">{t("ra.copyToTable")}</h3>
            <p className="text-[11px] text-zinc-500 mb-3">{t("ra.copyToHint")}</p>
            {tables.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">{t("ra.noTables")}</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {tables.map((tbl) => (
                  <button
                    key={tbl.id}
                    type="button"
                    disabled={copying}
                    onClick={() => handleCopy(tbl.id)}
                    className="w-full text-left text-xs text-zinc-200 hover:text-white bg-zinc-800/70 hover:bg-zinc-700/70 border border-zinc-700/50 rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
                  >
                    {copying
                      ? "..."
                      : (tbl.title || tbl.id.slice(0, 8)) + (tbl.current ? ` — ${t("ra.thisTable")}` : "")}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-3 w-full text-[11px] text-zinc-400 border border-zinc-700/60 rounded-lg px-3 py-1.5 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {t("ra.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}