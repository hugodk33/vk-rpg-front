"use client";

import { useMemo, useState } from "react";
import { inputCls } from "./formStyles";

export interface SearchModalItem {
  id: string;
  name: string;
  description?: string;
  meta?: string;
}

interface SearchModalProps {
  title: string;
  items: SearchModalItem[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
}

export default function SearchModal({ title, items, isSelected, onToggle, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false) ||
        (i.meta?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-6 pb-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className={inputCls}
          />
        </div>
        <div className="px-2 pb-6 overflow-y-auto scroll-thin space-y-1">
          {filtered.length === 0 ? (
            <p className="text-zinc-600 text-sm px-4 py-2">No results.</p>
          ) : (
            filtered.map((i) => {
              const selected = isSelected(i.id);
              return (
                <label
                  key={i.id}
                  className={`flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/30 cursor-pointer ${
                    selected ? "bg-zinc-700/40 border border-amber-500/30" : "border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => onToggle(i.id, e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 bg-zinc-900"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200 truncate">{i.name || "Unnamed"}</div>
                    {i.meta ? <div className="text-xs text-zinc-500 truncate">{i.meta}</div> : null}
                    {i.description ? <div className="text-xs text-zinc-500 truncate">{i.description}</div> : null}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
