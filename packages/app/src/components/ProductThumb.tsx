import { Shirt, Apple, Smartphone, Sparkles, Home, Package, type LucideIcon } from "lucide-react";

/**
 * A small set of category keyword -> icon mappings, used purely for a
 * visual cue in product grids/tables since the app has no product
 * photography. Falls back to a generic package icon for anything
 * unrecognized — this is decorative, not a classification system.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  apparel: Shirt,
  clothing: Shirt,
  fashion: Shirt,
  grocery: Apple,
  food: Apple,
  beverage: Apple,
  electronics: Smartphone,
  mobile: Smartphone,
  beauty: Sparkles,
  cosmetic: Sparkles,
  home: Home,
  living: Home,
  furniture: Home,
};

const PALETTE = ["#d1fae5", "#dbeafe", "#fef3c7", "#fce7f3", "#ede9fe", "#fee2e2", "#e0f2fe", "#fef9c3"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function iconForCategory(categoryName: string | null): LucideIcon {
  if (!categoryName) return Package;
  const key = categoryName.trim().toLowerCase();
  for (const [needle, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(needle)) return Icon;
  }
  return Package;
}

interface ProductThumbProps {
  name: string;
  categoryName: string | null;
  size?: number;
}

export default function ProductThumb({ name, categoryName, size = 36 }: ProductThumbProps) {
  const Icon = iconForCategory(categoryName);
  const color = PALETTE[hashString(name) % PALETTE.length];
  return (
    <span className="product-thumb" style={{ width: size, height: size, background: color }} aria-hidden="true">
      <Icon size={Math.round(size * 0.55)} strokeWidth={1.75} />
    </span>
  );
}
