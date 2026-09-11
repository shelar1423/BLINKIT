/* ============================================================
   Constants — colour.

   The "Constants" level of Blinkit's own design-library structure
   (Constants -> Elements -> Components), adapted from React Native to web.

   This is the single source for every brand colour. Before it existed the
   palette was duplicated: once as CSS custom properties for the DOM, and again
   as 18 loose literals inside the three.js scenes — brand yellow alone appeared
   eight times as `0xf8cb46`. Changing a brand colour meant finding all of them.

   Each token carries both representations, because the two renderers want
   different types: the DOM wants `#RRGGBB` (or the CSS variable, so a theme can
   still override it at runtime), three.js wants a packed integer.

   `npm run check:tokens` asserts these stay in step with tokens.css.
   ============================================================ */

/** A colour, in every form the app's two renderers need. */
export type Token = {
  /** `#RRGGBB` — DOM styles, canvas 2d, SVG. */
  hex: string;
  /** Packed 24-bit integer — three.js materials and lights. */
  int: number;
  /** `var(--name)` — prefer this in CSS so runtime theming still works. */
  css: string;
};

const t = (name: string, hex: string): Token => ({
  hex,
  int: parseInt(hex.slice(1), 16),
  css: `var(--${name})`,
});

export const color = {
  /* --- brand: yellow is the ground, green is the action --- */
  yellow: t('yellow', '#F8CB46'),
  yellowDk: t('yellow-dk', '#F3C117'),
  yellowLt: t('yellow-lt', '#FCDF82'),
  yellowTint: t('yellow-tint', '#FEFAEC'),

  green: t('green', '#0C831F'),
  greenDk: t('green-dk', '#0A6B19'),
  green2: t('green-2', '#318616'),
  greenTint: t('green-tint', '#ECFFEC'),

  /* --- neutrals --- */
  ink: t('ink', '#1F1F1F'),
  ink2: t('ink-2', '#363636'),
  mut: t('mut', '#666666'),
  mut2: t('mut-2', '#828282'),
  line: t('line', '#E8E8E8'),
  line2: t('line-2', '#DDDDDD'),
  surface: t('surface', '#FFFFFF'),
  surface2: t('surface-2', '#F7F7F7'),
  appbase: t('appbase', '#F5F8FA'),

  /* --- campaign (Hot Wheels) ---
     Hot Wheels yellow (#FFC400) is deliberately absent: it collides with
     Blinkit's own #F8CB46. The campaign leads with flame red instead. */
  hwR: t('hw-r', '#ED1C24'),
  hwRDk: t('hw-r-dk', '#C2121A'),
  hwRTint: t('hw-r-tint', '#FFF0F0'),
  hwO: t('hw-o', '#FF6A00'),
  hwB: t('hw-b', '#0B5FD0'),

  /* --- dark surfaces: the race and AR viewports only --- */
  tk1: t('tk-1', '#131A26'),
  tk2: t('tk-2', '#080B12'),
  tkMut: t('tk-mut', '#9AA6BC'),
} as const;

/* ------------------------------------------------------------
   Scene colours — used only by the 3D race and AR, so they are
   not CSS custom properties, but they belong to the same palette.
   ------------------------------------------------------------ */
export const scene = {
  /** Moulded orange track plastic, edge -> centre. */
  trackEdge: '#7A2600',
  trackMid: '#C44A00',
  trackCore: '#E05F06',
  /** Raised side rails. */
  rail: 0x8f2d00,
  /** Tumbling debris that replaced the traffic cones. */
  debris: 0x8a7460,
  /** Asteroid field drifting around the circuit. */
  asteroid: 0x6b5a4a,
  /** Deep space behind everything. */
  space: '#05070C',
} as const;

export type ColorName = keyof typeof color;
