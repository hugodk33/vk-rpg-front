"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readSeat, writeSeat } from "@/lib/seat";

/* ============================================================
   SeatPicker — "who am I" for the player dashboard.
   Persists the seat (player USER) so the pill, the console and
   every player page agree on whose character is mine.
   ============================================================ */

export interface SeatOption {
  userId: string;
  username: string;
}

export default function SeatPicker({ options }: { options: SeatOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const urlSeat = params.get("seat");
  const [value, setValue] = useState(urlSeat ?? readSeat().userId ?? "");

  useEffect(() => {
    const stored = readSeat();
    if (!urlSeat && stored.userId && options.some((o) => o.userId === stored.userId)) {
      router.replace(`/player?seat=${encodeURIComponent(stored.userId)}`);
    }
  }, [urlSeat, options, router]);

  const onChange = (userId: string) => {
    setValue(userId);
    const opt = options.find((o) => o.userId === userId);
    writeSeat(opt ? { userId: opt.userId, username: opt.username } : { userId });
    router.push(userId ? `/player?seat=${encodeURIComponent(userId)}` : "/player");
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm text-zinc-400">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Playing as</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-700/60"
      >
        <option value="">— choose user —</option>
        {options.map((o) => (
          <option key={o.userId} value={o.userId}>
            {o.username}
          </option>
        ))}
      </select>
    </label>
  );
}