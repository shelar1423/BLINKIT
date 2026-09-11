/* ============================================================
   Constants — spacing, radius and type scale.

   Mirrors the custom properties in tokens.css so layout values are
   reachable from TypeScript (inline styles, canvas, three.js) without
   re-typing magic numbers.
   ============================================================ */

/** Blinkit is rounder than most Indian q-commerce. */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

export const space = {
  gutter: 12,
  gutterWide: 20,
} as const;

/** Mobile-first type scale; tokens.css steps these up at 768px. */
export const fontSize = {
  '2xs': 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 17,
  '2xl': 20,
} as const;

export const chrome = {
  /** Blinkit's own --header__height--mobile. */
  headerHeight: 68,
  navHeight: 56,
} as const;
