/* ============================================================
   Location glyphs — shared kind icons + tints + labels.
   Used by the atlas card grid, the RegionMap, and the survey plate.
   ============================================================ */

"use client";

export const KIND_LABELS: Record<string, string> = {
  world: "World",
  continent: "Continent",
  nation: "Nation",
  region: "Region",
  biome: "Biome",
  province: "Province",
  city: "City",
  district: "District",
  locale: "Locale",
  site: "Site",
  battlemap: "Battle Map",
  point: "Point",
};

export const KIND_TINT: Record<string, string> = {
  world: "text-sky-400",
  continent: "text-emerald-400",
  nation: "text-amber-400",
  region: "text-teal-400",
  biome: "text-lime-400",
  province: "text-cyan-400",
  city: "text-orange-400",
  district: "text-yellow-400",
  locale: "text-rose-400",
  site: "text-violet-400",
  battlemap: "text-red-400",
  point: "text-zinc-400",
};

export function KindGlyph({
  kind,
  className,
}: {
  kind?: string;
  className?: string;
}) {
  const svgProps = {
    className,
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };
  switch (kind) {
    case "world":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 5.5c2.2 2 3.2 4 3.2 6.5S14.2 16.5 12 18.5M12 5.5c-2.2 2-3.2 4-3.2 6.5s1 4.5 3.2 6.5M5.5 12h13" />
          <ellipse cx="12" cy="12" rx="10.5" ry="3.4" transform="rotate(-22 12 12)" />
        </svg>
      );
    case "continent":
      return (
        <svg {...svgProps}>
          <path d="M12 3.5c-4.2 0-7.5 2.9-7.5 6.2 0 3.8 3.1 5.9 3.1 9.3h8.8c0-3.4 3.1-5.5 3.1-9.3 0-3.3-3.3-6.2-7.5-6.2z" />
          <path d="M9 19c1.5-.8 4.5-.8 6 0" />
        </svg>
      );
    case "nation":
      return (
        <svg {...svgProps}>
          <path d="M6 3.5v17" />
          <path d="M6 5h11l-2.6 3.5L17 12H6" />
        </svg>
      );
    case "region":
      return (
        <svg {...svgProps}>
          <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
          <path d="M9 4v13M15 6.5v13" />
        </svg>
      );
    case "biome":
      return (
        <svg {...svgProps}>
          <path d="M20 4C11 4 4 11 4 20c9 0 16-7 16-16z" />
          <path d="M4 20C8 15 12 11 17 7.5" />
        </svg>
      );
    case "province":
      return (
        <svg {...svgProps}>
          <path d="M4 5.5h16v13H4z" />
          <path d="M4 12h16M12 5.5v13" />
          <path d="M8 5.5v13M16 5.5v13" />
        </svg>
      );
    case "city":
      return (
        <svg {...svgProps}>
          <path d="M4 20.5V11l4-3 4 3v9.5" />
          <path d="M12 20.5V14l4-3 4 3v6.5" />
          <path d="M4 20.5h16" />
          <path d="M7 20.5v-3M10 20.5v-3" />
        </svg>
      );
    case "district":
      return (
        <svg {...svgProps}>
          <path d="M5 20.5V7l5-2v15.5" />
          <path d="M10 20.5V5l9 3v12.5" />
          <path d="M3.5 20.5h17" />
          <path d="M12.5 10.5h.01M15.5 10.5h.01M12.5 14h.01M15.5 14h.01" />
        </svg>
      );
    case "site":
      return (
        <svg {...svgProps}>
          <path d="M12 4.5L3.5 20h17L12 4.5z" />
          <path d="M12 4.5v15.5M9 20l3-6 3 6" />
        </svg>
      );
    case "battlemap":
      return (
        <svg {...svgProps}>
          <path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3z" />
          <path d="M12 12l7.5-4.7M12 12l-7.5-4.7M12 12v9" />
        </svg>
      );
    case "point":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="2.6" />
          <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
        </svg>
      );
    case "locale":
    default:
      return (
        <svg {...svgProps}>
          <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <circle cx="12" cy="11" r="2.6" />
        </svg>
      );
  }
}
