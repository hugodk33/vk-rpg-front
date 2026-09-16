import type { LucideIcon } from "lucide-react";
import {
  Axe,
  Backpack,
  Banana,
  BicepsFlexed,
  Bomb,
  BookOpen,
  Castle,
  Cherry,
  ChessKnight,
  Coins,
  Crosshair,
  Flame,
  FlaskConical,
  Gem,
  Hammer,
  HandMetal,
  HardHat,
  KeyRound,
  Package,
  Pickaxe,
  Pill,
  Pizza,
  ScrollText,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Sword,
  Swords,
  Syringe,
  Target,
  Tent,
  Warehouse,
  Wind,
  Zap,
} from "lucide-react";

/* ============================================================
   Item icon resolver.
   One source of truth for how an item reads on the table:
     · an explicit `image_url` (upload) wins over everything;
     · an explicit `icon_key` (curated override) pins the icon;
     · otherwise the icon is derived from kind/category/name.
   When the narrator uploads icons later, only `image_url`
   needs to be populated — the card markup does not change.
   ============================================================ */

export interface ItemIconSource {
  kind?: string | null;
  category?: string | null;
  name?: string | null;
  icon_key?: string | null;
  image_url?: string | null;
}

interface IconDef {
  icon: LucideIcon;
  tone: string;
  match: RegExp;
}

const WEAPON_ICONS: IconDef[] = [
  { icon: Shield, tone: "text-orange-300", match: /shield|buckler/ },
  { icon: Sparkles, tone: "text-sky-300", match: /staff|wand|rod|scepter|quarterstaff/ },
  { icon: Crosshair, tone: "text-lime-300", match: /bow|crossbow|sling|archery|quiver/ },
  { icon: Target, tone: "text-zinc-100", match: /gun|pistol|rifle|revolver|shotgun|musket|carbine|smg|blunderbuss/ },
  { icon: Swords, tone: "text-emerald-300", match: /spear|pike|polearm|lance|javelin|halberd|glaive|trident|ranseur/ },
  { icon: Axe, tone: "text-red-300", match: /axe|hatchet|tomahawk|cleaver/ },
  { icon: Hammer, tone: "text-rose-300", match: /hammer|mace|maul|flail|morningstar/ },
  { icon: Pickaxe, tone: "text-teal-300", match: /pick|pickaxe|mattock/ },
  { icon: Sword, tone: "text-violet-300", match: /sword|rapier|saber|sabre|katana|scimitar|falchion|broadsword|shortsword|longsword|greatsword|dagger|knife|blade|dirk|bayonet|kukri/ },
];

const ARMOR_ICONS: IconDef[] = [
  { icon: HardHat, tone: "text-sky-300", match: /helmet|helm|head|skull|face|neck|gorget/ },
  { icon: Shirt, tone: "text-emerald-300", match: /robe|cloth|tunic|garb|shirt|suit|clothing|vest|garment|dress|gown|tabard|surcoat|cloak/ },
  { icon: HandMetal, tone: "text-emerald-300", match: /gauntlet|glove|hand|wrist|finger/ },
  { icon: ShieldCheck, tone: "text-cyan-300", match: /armor|armour|plate|mail|cuirass|breastplate|bracer|vambrace|pauldron|greave|torso|chest|body/ },
];

const EQUIP_ICONS: IconDef[] = [
  { icon: FlaskConical, tone: "text-lime-300", match: /potion|elixir|flask|vial|philter|brew|alchem/ },
  { icon: BookOpen, tone: "text-amber-300", match: /book|tome|spellbook|grimoire|manual|journal|diary|codex/ },
  { icon: ScrollText, tone: "text-cyan-300", match: /scroll|map|parchment|letter|note|document|missive/ },
  { icon: Gem, tone: "text-fuchsia-300", match: /gem|jewel|crystal|diamond|ruby|sapphire|emerald|necklace|ring|amulet/ },
  { icon: KeyRound, tone: "text-yellow-300", match: /key|lockpick|lock|padlock/ },
  { icon: Sparkles, tone: "text-sky-300", match: /enchant|focus|charm|trinket|relic|artifact|blessed/ },
  { icon: Pill, tone: "text-rose-300", match: /pill|tablet|capsule|medicine/ },
  { icon: Syringe, tone: "text-emerald-300", match: /syringe|inject|poison/ },
  { icon: Bomb, tone: "text-orange-300", match: /bomb|grenade|explosive/ },
  { icon: Flame, tone: "text-orange-400", match: /torch|lamp|lantern|fire|flame|candle/ },
  { icon: Tent, tone: "text-zinc-200", match: /tent|shelter|canopy|camp/ },
  { icon: Coins, tone: "text-yellow-300", match: /coin|gold|silver|money|purse|treasure/ },
  { icon: Banana, tone: "text-yellow-300", match: /banana/ },
  { icon: Cherry, tone: "text-rose-300", match: /cherry/ },
  { icon: Pizza, tone: "text-orange-300", match: /pizza|food|meal|ration|bread|loaf|snack/ },
  { icon: Backpack, tone: "text-amber-400", match: /backpack|pack|sack|bag|satchel|haversack/ },
  { icon: ShoppingBag, tone: "text-amber-300", match: /basket|market|shop/ },
  { icon: Warehouse, tone: "text-zinc-300", match: /crate|barrel|chest|container|box/ },
  { icon: Castle, tone: "text-amber-300", match: /castle|stronghold|gate/ },
  { icon: ChessKnight, tone: "text-zinc-200", match: /knight|chess|warhorse|figurine/ },
  { icon: Snowflake, tone: "text-sky-300", match: /ice|frost|snow|cold/ },
  { icon: Wind, tone: "text-cyan-300", match: /wind|feather|wing/ },
  { icon: Zap, tone: "text-yellow-300", match: /lightning|zap|electric|storm/ },
  { icon: BicepsFlexed, tone: "text-red-300", match: /weight|whetstone|grind|training/ },
];

const ALL_DEFS: IconDef[] = [...WEAPON_ICONS, ...ARMOR_ICONS, ...EQUIP_ICONS];

export interface ResolvedItemIcon {
  Icon: LucideIcon;
  tone: string;
}

function iconWithKey(name?: string | null): ResolvedItemIcon | null {
  if (!name) return null;
  const def = ALL_DEFS.find((d) => {
    const n = (d.icon.displayName ?? "").toLowerCase();
    return n === name.toLowerCase();
  });
  return def ? { Icon: def.icon, tone: def.tone } : null;
}

export function resolveItemIcon(item: ItemIconSource): ResolvedItemIcon {
  const pinned = iconWithKey(item.icon_key);
  if (pinned) return pinned;

  const hay = [item.kind, item.category, item.name].filter(Boolean).join(" ").toLowerCase();
  const def = ALL_DEFS.find((d) => d.match.test(hay));
  if (def) return { Icon: def.icon, tone: def.tone };

  switch (item.kind) {
    case "shield":
      return { Icon: Shield, tone: "text-orange-300" };
    case "weapon":
      return { Icon: Sword, tone: "text-violet-300" };
    case "armor":
      return /cloth|robe|garb|garment/.test(hay)
        ? { Icon: Shirt, tone: "text-emerald-300" }
        : { Icon: ShieldCheck, tone: "text-cyan-300" };
    case "equipment":
      return { Icon: Package, tone: "text-zinc-400" };
    default:
      return { Icon: Package, tone: "text-zinc-500" };
  }
}

interface ItemIconProps {
  item: ItemIconSource;
  /** Size + any explicit color override for the SVG (e.g. "w-8 h-8"). */
  className?: string;
  /** Class for the image variant — when the narrator uploads art later. */
  imgClassName?: string;
  alt?: string;
}

export default function ItemIcon({
  item,
  className = "w-8 h-8",
  imgClassName,
  alt,
}: ItemIconProps) {
  if (item.image_url) {
    return (
      <span className="inline-flex items-center justify-center overflow-hidden rounded-lg">
        <img
          src={item.image_url}
          alt={alt ?? item.name ?? "Item"}
          className={imgClassName ?? "w-full h-full object-cover"}
        />
      </span>
    );
  }
  const { Icon, tone } = resolveItemIcon(item);
  return <Icon aria-hidden strokeWidth={1.6} className={`${className} ${tone}`} />;
}