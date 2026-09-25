"use client";

import type { Item } from "@/lib/types";
import ItemIcon from "@/components/items/ItemIcon";
import { useTranslation } from "@/lib/i18n";
import { classify, GROUP_UI, conditionLedger, itemParticulars, qualityStyle } from "./itemIdentity";

/* ============================================================
   ItemListCard — one inventory row (shared by GM + player item
   listing). Shows the item's real type glyph, its class, its
   state (quality/condition) and a compact strip of the most
   useful per-type particulars (damage, reach, grip, DR,
   locations, armor FIT, ...). No link — callers wrap if needed.
   ============================================================ */

function SpecChip({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded bg-zinc-900/50 border border-zinc-700/40 px-2 py-0.5">
      <span className="font-mono text-[9px] tracking-widest uppercase text-zinc-500">{label}</span>
      <span className="font-mono text-[12px] font-medium" style={{ color: tint || "#e4e4e7" }}>
        {value}
      </span>
    </span>
  );
}

export default function ItemListCard({ item }: { item: Item }) {
  const { lang, t } = useTranslation();
  const group = classify(item);
  const tint = GROUP_UI[group].hex;
  const cs = conditionLedger(item.condition, lang);
  const qs = qualityStyle(item.quality, lang);
  const particulars = itemParticulars(item, lang);

  return (
    <div className="bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg p-3.5 transition-all group">
      <div className="flex items-start gap-3">
        {/* type glyph */}
        <div
          className="w-10 h-10 shrink-0 grid place-items-center rounded-full border border-dashed"
          style={{ borderColor: `${tint}66`, background: "radial-gradient(circle at 50% 40%, #27272a, #18181b)" }}
        >
          <ItemIcon item={item} className="w-6 h-6" imgClassName="w-6 h-6 object-cover rounded-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">
              {item.name || t("it.unnamed")}
            </span>
            <span className="font-mono text-[10px] text-zinc-500 shrink-0">
              {item.weight_lb != null ? `${item.weight_lb} lb` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: tint }}>
              {t(GROUP_UI[group].label)}
            </span>
            {item.category ? <span className="text-[11px] text-zinc-500">{item.category}</span> : null}
            {/* quality */}
            {item.quality ? (
              <span
                className="inline-flex items-baseline gap-0.5 rounded px-1.5 py-px border"
                style={{ borderColor: `${qs.color}66`, color: qs.color }}
              >
                <span className="font-mono text-[11px] leading-none">{qs.mark}</span>
                <span className="font-mono text-[9px] tracking-widest">{qs.label}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* particulars strip */}
      {particulars.length ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pl-[52px]">
          {particulars.map((p, i) => (
            <SpecChip key={`${p.label}-${i}`} label={p.label} value={p.value} tint={p.tint} />
          ))}
        </div>
      ) : null}

      {/* condition */}
      {cs.notches >= 0 ? (
        <div className="flex items-center gap-1.5 mt-2 pl-[52px]">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: cs.color, boxShadow: `0 0 5px ${cs.color}66` }}
          />
          <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: cs.color }}>
            {cs.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
