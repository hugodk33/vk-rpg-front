"use client";

/* ============================================================
   DiceMystery — dice-shaped chips that drop from above the tray,
   spinning as they fall, and settle before their faces are told.
   The verdict stays hidden until the last die lands (onReveal).

   Each roll is keyed by `burn`: bump it to make the dice fall
   again. Offsets are hashed from the key, so the same roll always
   falls the same way and chip positions never jump mid-animation.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface DiceMysteryProps {
  burn: number;
  count: number;
  die: number;
  faces: readonly number[];
  onReveal?: () => void;
  chipClass?: string;
  faceClass?: string;
  glowColor?: string;
  size?: number;
}

export default function DiceMystery({
  burn,
  count,
  die,
  faces,
  onReveal,
  chipClass = "border-zinc-600 bg-zinc-800/70",
  faceClass = "text-zinc-100",
  glowColor = "rgba(52,211,153,0.35)",
  size = 48,
}: DiceMysteryProps) {
  const [landed, setLanded] = useState<{ key: number; count: number }>({ key: burn, count: 0 });

  const mark = useCallback(() => {
    setLanded((prev) => {
      const count = prev.key === burn ? prev.count + 1 : 1;
      return { key: burn, count };
    });
  }, [burn]);

  const allLanded = faces.length > 0 && landed.key === burn && landed.count >= count;

  useEffect(() => {
    if (!allLanded) return;
    onReveal?.();
  }, [allLanded, onReveal]);

  const chips = Array.from({ length: Math.max(0, count) }, (_, i) => i);

  return (
    <div className="flex flex-wrap items-end gap-2" aria-hidden>
      {chips.map((i) => (
        <FallingDie
          key={`${burn}-${i}`}
          face={faces[i] ?? null}
          seed={`${burn}-${i}`}
          index={i}
          onLanded={mark}
          chipClass={chipClass}
          faceClass={faceClass}
          glowColor={glowColor}
          size={size}
        />
      ))}
    </div>
  );
}

interface FallingDieProps {
  face: number | null;
  seed: string;
  index: number;
  onLanded: () => void;
  chipClass: string;
  faceClass: string;
  glowColor: string;
  size: number;
}

function FallingDie({
  face,
  seed,
  index,
  onLanded,
  chipClass,
  faceClass,
  glowColor,
  size,
}: FallingDieProps) {
  const [started, setStarted] = useState(false);
  const [landed, setLanded] = useState(false);

  const spawnDelay = 40 + index * 70 + Math.round(hash(seed + "s") * 130);
  const fallDur = 540 + Math.round(hash(seed + "d") * 240);

  const xOff = (hash(seed + "x") - 0.5) * 46;
  const spin = -300 + hash(seed + "r") * 600;

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), spawnDelay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (!started) return;
    const landAt = fallDur + 80;
    const t = setTimeout(() => {
      setLanded(true);
      onLanded();
    }, landAt);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, seed, onLanded]);

  return (
    <span className="relative inline-flex flex-col items-center" style={{ width: size }}>
      {/* landing shadow */}
      <span
        className="pointer-events-none absolute left-1/2 top-full -z-10 block h-2.5 w-3/5 rounded-full blur-[3px] transition-all duration-300"
        style={{
          backgroundColor: "rgba(0,0,0,0.65)",
          transform: started ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.3)",
          opacity: started ? 1 : 0,
          transitionProperty: "transform, opacity",
          transitionDuration: "300ms",
          transitionDelay: started ? `${fallDur}ms` : "0ms",
        }}
      />
      {/* the chip */}
      <span
        className={`flex items-center justify-center rounded-lg border-2 font-mono font-bold ${chipClass}`}
        style={{
          width: size,
          height: size,
          transform: started ? "translate(0,0) rotate(0deg)" : `translate(${xOff}px,-76px) rotate(${spin}deg)`,
          opacity: started ? 1 : 0,
          transitionProperty: "transform, opacity, box-shadow",
          transitionDuration: started ? `${fallDur}ms, 200ms, ${fallDur}ms` : "200ms",
          transitionTimingFunction: "cubic-bezier(.22,1,.36,1), ease, cubic-bezier(.22,1,.36,1)",
          transitionDelay: started ? "0ms, 0ms, 0ms" : "0ms",
          boxShadow: landed ? `0 6px 18px ${glowColor}` : `0 4px 10px rgba(0,0,0,0.45)`,
        }}
      >
        <span
          className={`transition-opacity duration-200 ${faceClass}`}
          style={{
            opacity: started && landed && face != null ? 1 : 0,
            transitionDelay: started && landed ? "120ms" : "0ms",
          }}
        >
          {face ?? "·"}
        </span>
      </span>
    </span>
  );
}