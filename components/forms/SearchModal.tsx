"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inputCls } from "./formStyles";
import InfoTooltip from "./InfoTooltip";

export interface SearchModalItem {
  id: string;
  name: string;
  description?: string;
  meta?: string;
}

export interface SearchFilter {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface SearchModalProps {
  title: string;
  onSearch: (query: string, filters: Record<string, string>) => Promise<SearchModalItem[]>;
  isSelected: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
  filters?: SearchFilter[];
}

export default function SearchModal({ title, onSearch, isSelected, onToggle, onClose, filters = [] }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [filtersState, setFiltersState] = useState<Record<string, string>>({});
  const [results, setResults] = useState<SearchModalItem[]>([]);
  const [loading, setLoading] = useState(false);

  const searchRef = useRef(onSearch);
  useEffect(() => { searchRef.current = onSearch; });

  const runSearch = useCallback(async (q: string, flt: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await searchRef.current(q, flt);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await searchRef.current("", {});
        if (active) setResults(res);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query, filtersState);
  }

  function handleFilterChange(key: string, value: string) {
    const next = { ...filtersState, [key]: value };
    setFiltersState(next);
    runSearch(query, next);
  }

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
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className={inputCls}
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              Search
            </button>
          </form>
          {filters.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.map((f) => (
                <select
                  key={f.key}
                  value={filtersState[f.key] ?? ""}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                  className={`${inputCls} !w-auto !px-3 !py-1.5 text-sm`}
                >
                  <option value="">{f.label}: All</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ) : null}
        </div>
        <div className="px-2 pb-6 overflow-y-auto scroll-thin space-y-1">
          {loading ? (
            <p className="text-zinc-600 text-sm px-4 py-2">Loading...</p>
          ) : results.length === 0 ? (
            <p className="text-zinc-600 text-sm px-4 py-2">No results.</p>
          ) : (
            results.map((i) => {
              const selected = isSelected(i.id);
              return (
                <InfoTooltip
                  key={i.id}
                  rows={[
                    { label: "Meta", value: i.meta },
                    { label: "Description", value: i.description },
                  ]}
                >
                  <label
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
                </InfoTooltip>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
