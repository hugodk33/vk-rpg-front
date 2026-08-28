import type { RGroup } from "./itemIdentity";
import { GROUP_UI } from "./itemIdentity";

/* ============================================================
   ItemGlyph — a single stroke mark per item type, used across
   the Armory Exhibit (item detail) and the inventory list so a
   type looks the same everywhere. Tint comes from GROUP_UI so
   it always matches the Character-page palette.
   ============================================================ */

export default function ItemGlyph({ group, size = 40 }: { group: RGroup; size?: number }) {
  const stroke = GROUP_UI[group].hex;
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  let mark: React.ReactNode;
  switch (group) {
    case "sword":
      mark = (
        <>
          <path {...common} d="M20 5 L27 12 L25 14 L24 13 L21 16 L18 18 L12 12 L14 9 L17 8 L16 7 L20 5 Z" />
          <path {...common} d="M18 18 L14 22 M22 20 L26 16" />
          <path {...common} d="M11 15 L8 18 L7 16 L10 13" />
        </>
      );
      break;
    case "axe":
      mark = (
        <>
          <path {...common} d="M24 5 L28 9 L26 11 L24 10 L20 14 L17 11 L21 7 L22 9 L24 7 L24 5 Z" />
          <path {...common} d="M19 13 L8 25 L5 24 L17 12" />
        </>
      );
      break;
    case "club":
      mark = (
        <>
          <path {...common} d="M16 6 L16 24" />
          <path {...common} d="M16 16 L12 13 M16 20 L21 17 M16 24 L12 27" />
          <path {...common} d="M12 6 L20 6" />
        </>
      );
      break;
    case "knife":
      mark = (
        <>
          <path {...common} d="M23 4 L30 11 L28 13 L25 11 L20 16 L17 14 L19 10 L23 9 L23 4 Z" />
          <path {...common} d="M19 12 L11 21 M15 17 L5 27 M8 24 L2 30" />
        </>
      );
      break;
    case "gun":
      mark = (
        <>
          <path {...common} d="M3 15 L13 15 L16 10 L21 10 L22 13 L28 13 L28 15 L30 15 L30 18 L27 18 L27 20 L23 20 L23 18 L16 18 L14 21 L7 21 L7 18 L3 18 Z" />
          <path {...common} d="M17 7 L19 7 M15 22 L20 22 M7 24 L10 26 L12 24" />
        </>
      );
      break;
    case "bow":
      mark = (
        <>
          <path {...common} d="M5 8 C 14 26, 18 26, 27 8" />
          <path {...common} d="M6 8 L26 8" />
          <path {...common} d="M16 20 L16 26 M14 26 L18 26" />
        </>
      );
      break;
    case "armor":
      mark = (
        <>
          <path {...common} d="M10 5 L16 5 L22 5 C 23 10, 24 13, 22 17 C 20 21, 23 24, 25 25 L 25 27 C 21 26, 17 25, 16 22 C 15 25, 11 26, 7 27 L 7 25 C 9 24, 12 21, 10 17 C 8 13, 9 10, 10 5 Z" />
          <path {...common} d="M16 5 L16 22" />
          <path {...common} d="M16 9 L11 13 M16 9 L21 13" />
        </>
      );
      break;
    case "shield":
      mark = (
        <>
          <path {...common} d="M5 8 L16 4 L27 8 L27 17 C 27 24, 21 28, 16 28 C 11 28, 5 24, 5 17 Z" />
          <path {...common} d="M6 11 L16 8 L26 11" />
          <path {...common} d="M16 8 L16 26" />
        </>
      );
      break;
    case "potion":
      mark = (
        <>
          <path {...common} d="M13 3 L19 3 M14 3 L14 9 M18 3 L18 9" />
          <path {...common} d="M12 8 L20 8 L20 11 C 20 16, 24 18, 24 23 C 24 27, 21 29, 16 29 C 11 29, 8 27, 8 23 C 8 18, 12 16, 12 11 Z" />
          <path {...common} d="M11 20 L16 16 L21 20" />
        </>
      );
      break;
    default:
      mark = (
        <>
          <path {...common} d="M6 24 L6 8 L20 8 L26 14 L26 24 Z" />
          <path {...common} d="M20 8 L20 14 L26 14" />
          <path {...common} d="M9 18 L23 18 M9 21 L23 21" />
        </>
      );
  }

  return (
    <svg viewBox="0 0 32 32" style={{ width: size, height: size }} aria-hidden="true">
      {mark}
    </svg>
  );
}
