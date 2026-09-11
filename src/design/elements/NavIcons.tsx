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
      d="M12 3.1 4.35 9.55a1.7 1.7 0 0 0-.6 1.3V19.4a1.7 1.7 0 0 0 1.7 1.7h13.1a1.7 1.7 0 0 0 1.7-1.7v-8.55a1.7 1.7 0 0 0-.6-1.3l-2.1-1.77V5.15h-2.55v.9z"
      fill={active ? GOLD : 'none'}
      stroke={active ? GOLD : DARK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {/* the door: a hole in the yellow when active, an outline when not */}
    <path
      d="M9.6 21.1v-4.75a2.4 2.4 0 0 1 4.8 0v4.75"
      fill={active ? DARK : 'none'}
      stroke={active ? DARK : DARK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {active && <path d="M17.55 5.15h-2.55v.9l2.55 2.15z" fill={DARK} />}
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
        d="M12 18.1c-.15 0-2.75-1.6-2.75-3.35a1.5 1.5 0 0 1 2.75-.85 1.5 1.5 0 0 1 2.75.85c0 1.75-2.6 3.35-2.75 3.35z"
        fill={GOLD}
      />
    )}
  </Svg>
);

/** Four discs. Selected, they alternate dark and gold on the diagonal. */
export const NavCategories = ({ size, active }: P) => {
  const spots: [number, number, string][] = [
    [8.5, 8.5, DARK],
    [15.5, 8.5, GOLD],
    [8.5, 15.5, GOLD],
    [15.5, 15.5, DARK],
  ];
  return (
    <Svg size={size}>
      {spots.map(([cx, cy, tone]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx} cy={cy} r="2.9"
          fill={active ? tone : 'none'}
          stroke={active ? tone : DARK}
          strokeWidth={SW}
        />
      ))}
    </Svg>
  );
};

/** Printer: paper tray on top, body below, status dot on the right. */
export const NavPrint = ({ size, active }: P) => (
  <Svg size={size}>
    <rect
      x="7.3" y="2.9" width="9.4" height="4.9" rx="1.3"
      fill={active ? DARK : 'none'} stroke={DARK} strokeWidth={SW}
    />
    <rect
      x="3.6" y="7.8" width="16.8" height="9.6" rx="2.6"
      fill={active ? GOLD : 'none'} stroke={active ? GOLD : DARK} strokeWidth={SW}
    />
    <circle cx="16.9" cy="11.4" r="1.05" fill={active ? DARK : DARK} />
    <path
      d="M8 17.4h8v3.7H8z"
      fill={active ? DARK : 'none'} stroke={DARK} strokeWidth={SW} strokeLinejoin="round"
    />
  </Svg>
);
