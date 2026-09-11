/* ============================================================
   Bottom-navigation icons.

   These are the one place in the app where an icon is two-tone. Blinkit's tab
   bar does not colour the whole glyph on selection — it repaints the shape:
   the house body fills yellow and keeps a dark door, the bag goes dark and
   gains a yellow heart, the four category discs alternate, the printer's body
   fills yellow under a dark lid. A single-colour icon plus a highlight behind
   it reads as a generic tab bar; this is the detail that makes it read as
   Blinkit's.

   That is why they live here rather than in Icons.tsx: everything there is one
   colour and takes `currentColor`, and these cannot be.
   ============================================================ */

type P = { size?: number; active?: boolean };

const DARK = 'var(--ink)';
const GOLD = 'var(--yellow)';
/** Outline weight, matched to the rest of the bar. */
const SW = 1.7;

const Svg = ({ size = 22, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** House with the small tab on its right roof slope. */
export const NavHome = ({ size, active }: P) => (
  <Svg size={size}>
    <path
      d="M12 2.9 4.2 9.5a1.8 1.8 0 0 0-.65 1.38V19.3a1.8 1.8 0 0 0 1.8 1.8h13.3a1.8 1.8 0 0 0 1.8-1.8v-8.42a1.8 1.8 0 0 0-.65-1.38L17.8 7.55V4.6h-2.9v.5z"
      fill={active ? GOLD : 'none'}
      stroke={active ? GOLD : DARK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {/* the door: a hole in the yellow when active, an outline when not */}
    <path
      d="M9.25 21.1v-4.95a2.75 2.75 0 0 1 5.5 0v4.95"
      fill={active ? DARK : 'none'}
      stroke={active ? DARK : DARK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {active && <path d="M17.8 4.6h-2.9v.5l2.9 2.45z" fill={DARK} />}
  </Svg>
);

/** Shopping bag; the heart appears inside it when the tab is current. */
export const NavOrders = ({ size, active }: P) => (
  <Svg size={size}>
    <rect
      x="4.3" y="8.6" width="15.4" height="12.5" rx="2.6"
      fill={active ? DARK : 'none'}
      stroke={DARK}
      strokeWidth={SW}
    />
    <path
      d="M8.7 9.5V7.4a3.3 3.3 0 0 1 6.6 0v2.1"
      fill="none" stroke={DARK} strokeWidth={SW} strokeLinecap="round"
    />
    {active && (
      <path
        d="M12 18.5c-.17 0-3.15-1.85-3.15-3.85a1.72 1.72 0 0 1 3.15-.97 1.72 1.72 0 0 1 3.15.97c0 2-2.98 3.85-3.15 3.85z"
        fill={GOLD}
      />
    )}
  </Svg>
);

/** Four discs. Selected, they alternate dark and gold on the diagonal. */
export const NavCategories = ({ size, active }: P) => {
  /* Spread far enough that the OUTER edge clears its neighbour: the stroke
     adds half its weight beyond the radius, and at the previous spacing that
     put the four discs in contact. */
  const spots: [number, number, string][] = [
    [7.9, 7.9, DARK],
    [16.1, 7.9, GOLD],
    [7.9, 16.1, GOLD],
    [16.1, 16.1, DARK],
  ];
  return (
    <Svg size={size}>
      {spots.map(([cx, cy, tone]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx} cy={cy} r={active ? 3.2 : 2.8}
          fill={active ? tone : 'none'}
          stroke={active ? tone : DARK}
          strokeWidth={SW}
        />
      ))}
    </Svg>
  );
};

/** Printer: paper lid on top, body below, status dot on the right. */
export const NavPrint = ({ size, active }: P) => (
  <Svg size={size}>
    <rect
      x="6.6" y="3.4" width="10.8" height="5.4" rx="1.6"
      fill={active ? DARK : 'none'} stroke={DARK} strokeWidth={SW}
    />
    <rect
      x="3.3" y="8.8" width="17.4" height="11.8" rx="3.2"
      fill={active ? GOLD : 'none'} stroke={active ? GOLD : DARK} strokeWidth={SW}
    />
    <circle cx="17.1" cy="13" r="1.1" fill={DARK} />
  </Svg>
);
