"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface InfoRow {
  label: string;
  value?: string | number | null;
}

interface InfoTooltipProps {
  rows: InfoRow[];
  children: ReactNode;
}

export default function InfoTooltip({ rows, children }: InfoTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const visible = rows.filter((r) => r.value != null && r.value !== "");
  const show = visible.length > 0;

  const open = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = r.bottom + 8;
    const left = r.left;
    setPos({ top, left });
  };

  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const tip = tipRef.current;
    const el = wrapRef.current;
    if (!tip || !el) return;
    const tr = tip.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
    let left = r.left;
    if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
    if (top !== pos.top || left !== pos.left) setPos({ top, left });
  }, [pos]);

  return (
    <div ref={wrapRef} className="relative" onMouseEnter={show ? open : undefined} onMouseLeave={show ? close : undefined}>
      {children}
      {show && pos
        ? createPortal(
            <div
              ref={tipRef}
              className="fixed z-50 w-80 max-h-[70vh] overflow-y-auto scroll-thin rounded-xl bg-zinc-900 border border-zinc-700/60 shadow-2xl p-3 text-left"
              style={{ top: pos.top, left: pos.left }}
            >
              {visible.map((r) => (
                <div key={r.label} className="text-xs mb-1.5 last:mb-0">
                  <span className="font-semibold text-green-500 uppercase tracking-wider text-[10px]">{r.label}</span>
                  <div className="text-zinc-300 whitespace-pre-wrap break-words">{r.value}</div>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
