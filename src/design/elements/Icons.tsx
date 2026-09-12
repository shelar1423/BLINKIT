type P = { size?: number; className?: string; strokeWidth?: number };

const S = ({ size = 20, className, strokeWidth = 1.8, children }: P & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const F = ({ size = 20, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const IconSearch = (p: P) => (
  <S {...p}>
    <circle cx="10.8" cy="10.8" r="6.4" />
    <path d="m20 20-4.7-4.7" />
  </S>
);

export const IconCart = (p: P) => (
  <S {...p}>
    <path d="M3 4h2.1l2.2 10.2h9.4L19 7.3H6.1" />
    <circle cx="9.5" cy="19" r="1.5" />
    <circle cx="16.5" cy="19" r="1.5" />
  </S>
);

export const IconUser = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="8.4" r="3.5" />
    <path d="M4.9 20a7.1 7.1 0 0 1 14.2 0" />
  </S>
);

export const IconHome = (p: P) => (
  <S {...p}>
    <path d="M3.6 10.4 12 3.8l8.4 6.6V20a1 1 0 0 1-1 1h-4.6v-6H9.2v6H4.6a1 1 0 0 1-1-1z" />
  </S>
);

export const IconGrid = (p: P) => (
  <S {...p}>
    <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="1.6" />
    <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="1.6" />
    <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="1.6" />
    <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="1.6" />
  </S>
);

export const IconFlag = (p: P) => (
  <S {...p}>
    <path d="M5.5 21.5V3" />
    <path d="M5.5 4.2h14v8.6h-14z" />
    <path d="M5.5 4.2h4.7v4.3H5.5zM14.8 4.2h4.7v4.3h-4.7zM10.2 8.5h4.6v4.3h-4.6z" fill="currentColor" stroke="none" />
  </S>
);

export const IconTrophy = (p: P) => (
  <S {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    <path d="M12 14v3M8.6 20h6.8l-.7-3H9.3z" />
  </S>
);

export const IconUsers = (p: P) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.6 19.4a5.4 5.4 0 0 1 10.8 0" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.6a5.4 5.4 0 0 1 2.9 4.8" />
  </S>
);

export const IconBolt = (p: P) => (
  <F {...p}>
    <path d="M13.6 2 5 13.2h5.2L9.8 22l8.8-11.4h-5.4z" />
  </F>
);

export const IconStar = (p: P) => (
  <F {...p}>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.4l6.1-.8z" />
  </F>
);

export const IconChevronRight = (p: P) => (
  <S {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </S>
);

export const IconChevronLeft = (p: P) => (
  <S {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </S>
);

export const IconChevronDown = (p: P) => (
  <S {...p}>
    <path d="m5 9.5 7 7 7-7" />
  </S>
);

export const IconClose = (p: P) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);

export const IconPlus = (p: P) => (
  <S {...p} strokeWidth={2.2}>
    <path d="M12 5.5v13M5.5 12h13" />
  </S>
);

export const IconMinus = (p: P) => (
  <S {...p} strokeWidth={2.2}>
    <path d="M5.5 12h13" />
  </S>
);

export const IconCheck = (p: P) => (
  <S {...p} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </S>
);

export const IconCube = (p: P) => (
  <S {...p}>
    <path d="m12 2.6 8 4.6v9.6l-8 4.6-8-4.6V7.2z" />
    <path d="m4 7.2 8 4.6 8-4.6M12 11.8v9.6" />
  </S>
);

export const IconAR = (p: P) => (
  <S {...p}>
    <path d="M3.5 8.5v-3a2 2 0 0 1 2-2h3M15.5 3.5h3a2 2 0 0 1 2 2v3M20.5 15.5v3a2 2 0 0 1-2 2h-3M8.5 20.5h-3a2 2 0 0 1-2-2v-3" />
    <path d="m12 8 3.6 2v4L12 16l-3.6-2v-4z" />
  </S>
);

export const IconPin = (p: P) => (
  <S {...p}>
    <path d="M12 21s6.4-6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.3" />
  </S>
);

export const IconRotate = (p: P) => (
  <S {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20.4 4.2v4.4H16" />
  </S>
);

export const IconLock = (p: P) => (
  <S {...p}>
    <rect x="4.6" y="10.5" width="14.8" height="9.4" rx="2.2" />
    <path d="M8 10.5V7.9a4 4 0 0 1 8 0v2.6" />
  </S>
);

export const IconShare = (p: P) => (
  <S {...p}>
    <path d="M12 15.4V3.8M8.2 7.6 12 3.8l3.8 3.8" />
    <path d="M5.6 12.8V19a1.6 1.6 0 0 0 1.6 1.6h9.6A1.6 1.6 0 0 0 18.4 19v-6.2" />
  </S>
);

export const IconSound = (p: P) => (
  <S {...p}>
    <path d="M4.5 9.5h3l4-3.4v11.8l-4-3.4h-3z" />
    <path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
  </S>
);

export const IconMute = (p: P) => (
  <S {...p}>
    <path d="M4.5 9.5h3l4-3.4v11.8l-4-3.4h-3z" />
    <path d="m15.5 9.8 4.2 4.4M19.7 9.8l-4.2 4.4" />
  </S>
);

export const IconTruck = (p: P) => (
  <S {...p}>
    <path d="M3 6.6h10.4v9.2H3zM13.4 9.6h3.5l3.1 3v3.2h-6.6z" />
    <circle cx="7" cy="18" r="1.7" />
    <circle cx="16.6" cy="18" r="1.7" />
  </S>
);

export const IconTicket = (p: P) => (
  <S {...p}>
    <path d="M3.5 8.2A1.7 1.7 0 0 0 5.2 6.5h13.6a1.7 1.7 0 0 0 1.7 1.7v2a2 2 0 0 0 0 3.6v2a1.7 1.7 0 0 0-1.7 1.7H5.2a1.7 1.7 0 0 0-1.7-1.7v-2a2 2 0 0 0 0-3.6z" />
    <path d="M12 9v1.5M12 13.5V15" />
  </S>
);

export const IconInfo = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.4M12 7.9v.6" />
  </S>
);

export const IconCafe = (p: P) => (
  <S {...p}>
    <path d="M5.6 8.5h11.2v5.2a5.6 5.6 0 0 1-11.2 0z" />
    <path d="M16.8 9.6h1.8a2.3 2.3 0 0 1 0 4.6h-1.8" />
    <path d="M4.6 20.2h13.2" />
  </S>
);

export const IconScooter = (p: P) => (
  <S {...p}>
    <circle cx="5.8" cy="17.2" r="2.6" />
    <circle cx="18.2" cy="17.2" r="2.6" />
    <path d="M8.4 17.2h7.2M15.6 17.2 13.2 7.6h-2.6M18.2 14.6V9.8h-2.6" />
  </S>
);

/* --- race controls --- */

/* A klaxon — bell and squeeze bulb — not a loudspeaker.
   It used to be a speaker with two arcs, which was fine alone but sits beside
   the race's mute toggle now: a speaker with one arc. Two speakers side by
   side, one meaning "parp" and one meaning "silence", are not a control pair
   anyone can read at 21px. */
export const IconHorn = (p: P) => (
  <S {...p}>
    <path d="M8 9.4 19 5.2v13.6L8 14.6Z" />
    <path d="M8 9.4H6.6a2.6 2.6 0 0 0 0 5.2H8" />
    <circle cx="4" cy="12" r="1.6" />
  </S>
);

export const IconBrake = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
  </S>
);

export const IconDrift = (p: P) => (
  <S {...p}>
    <path d="M3 17c3.5 0 5.5-2.2 7-4.6C11.6 9.8 13.6 7 17 7" />
    <path d="M14 4.5 17.5 7 14 9.5" />
    <path d="M4.5 20.5c2.6-.4 4.3-1.6 5.6-3.1M9 21.5c2.2-.5 3.7-1.6 4.9-3" />
  </S>
);

/** Blinkit Print Store — a real Blinkit surface, referenced in the tab bar. */
export const IconPrint = (p: P) => (
  <S {...p}>
    <path d="M7 9V4.2h10V9" />
    <rect x="4" y="9" width="16" height="7" rx="1.8" />
    <path d="M7 14h10v5.8H7z" />
  </S>
);

/** Voice search — the real Blinkit search field has one on the right. */
export const IconMic = (p: P) => (
  <S {...p}>
    <rect x="9" y="2.8" width="6" height="11" rx="3" />
    <path d="M5.4 11.2a6.6 6.6 0 0 0 13.2 0M12 17.8V21" />
  </S>
);

/** Wallet chip in the header. */
export const IconWallet = (p: P) => (
  <F {...p}>
    <path d="M3.2 7.6A2.6 2.6 0 0 1 5.8 5h10.9a2.6 2.6 0 0 1 2.6 2.6v.6H5.8a2.6 2.6 0 0 1-2.6-.6z" />
    <path d="M3.2 9.4h15.4A2.4 2.4 0 0 1 21 11.8v5.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4z" />
    <circle cx="16.6" cy="14.6" r="1.35" fill="#fff" />
  </F>
);

/** Order Again — the second tab in Blinkit's bottom bar. */
export const IconBag = (p: P) => (
  <S {...p}>
    <path d="M4.6 8.4h14.8l-1.1 11a1.8 1.8 0 0 1-1.8 1.6H7.5a1.8 1.8 0 0 1-1.8-1.6z" />
    <path d="M8.8 8.4V6.6a3.2 3.2 0 0 1 6.4 0v1.8" />
  </S>
);

/** Filled house for the active home tab. */
export const IconHouse = (p: P) => (
  <F {...p}>
    <path d="M11.3 2.9a1.1 1.1 0 0 1 1.4 0l8 6.6c.3.2.4.5.4.85V20a1.2 1.2 0 0 1-1.2 1.2h-4.6a.9.9 0 0 1-.9-.9v-4.2a2.4 2.4 0 0 0-4.8 0v4.2a.9.9 0 0 1-.9.9H4.1A1.2 1.2 0 0 1 2.9 20v-9.65c0-.35.15-.65.4-.85z" />
  </F>
);

/* ---- category rail: Blinkit uses monochrome line icons, not emoji ---- */

export const IconBasket = (p: P) => (
  <S {...p}>
    <path d="M3.4 9.4h17.2l-1.5 9.1a2 2 0 0 1-2 1.7H6.9a2 2 0 0 1-2-1.7z" />
    <path d="M8.4 9.4 10.6 4M15.6 9.4 13.4 4" />
  </S>
);

export const IconHeadphones = (p: P) => (
  <S {...p}>
    <path d="M4.2 15.4v-3.2a7.8 7.8 0 0 1 15.6 0v3.2" />
    <rect x="2.6" y="14.2" width="4.2" height="6.2" rx="2.1" />
    <rect x="17.2" y="14.2" width="4.2" height="6.2" rx="2.1" />
  </S>
);

export const IconLipstick = (p: P) => (
  <S {...p}>
    <path d="M9.2 9.6V5.4a1.8 1.8 0 0 1 1-1.6l2.4-1.2a.8.8 0 0 1 1.2.7v6.3" />
    <rect x="8.2" y="9.6" width="6.6" height="4" rx="1" />
    <path d="M8.8 13.6h5.4v6.2a1.4 1.4 0 0 1-1.4 1.4h-2.6a1.4 1.4 0 0 1-1.4-1.4z" />
  </S>
);

export const IconGift = (p: P) => (
  <S {...p}>
    <rect x="3.2" y="9.2" width="17.6" height="4.2" rx="1" />
    <path d="M4.8 13.4h14.4v6.2a1.4 1.4 0 0 1-1.4 1.4H6.2a1.4 1.4 0 0 1-1.4-1.4zM12 9.2V21" />
    <path d="M12 9.2S10.8 3.4 8.2 3.4a2.4 2.4 0 0 0 0 5.8zM12 9.2s1.2-5.8 3.8-5.8a2.4 2.4 0 0 1 0 5.8z" />
  </S>
);

/* ---- PDP sheet chrome, matching Blinkit's real product page ---- */

export const IconHeart = (p: P) => (
  <S {...p}>
    <path d="M12 20.3s-7.6-4.7-7.6-9.8a4.3 4.3 0 0 1 7.6-2.7 4.3 4.3 0 0 1 7.6 2.7c0 5.1-7.6 9.8-7.6 9.8z" />
  </S>
);

/**
 * Replacement policy row: a parcel inside a return loop.
 *
 * It used to be a bare cube, which says "box" and nothing about sending one
 * back. The loop is what carries the meaning, so the box shrinks to sit inside
 * it rather than filling the frame.
 */
export const IconReplace = (p: P) => (
  <S {...p} strokeWidth={1.6}>
    {/* The parcel is the subject and takes most of the box: on the real row the
        glyph reads as a BOX being sent back, not as a refresh circle that
        happens to contain something. */}
    <rect x="5.4" y="9.2" width="13.2" height="10.2" rx="1.6" />
    <path d="M5.4 12.6h13.2M12 9.2v10.2" />
    {/* The return loop rides over the top, open where the arrowhead lands,
        rather than enclosing the parcel. */}
    <path d="M4.6 6.9a8.6 8.6 0 0 1 14.6-.6" />
    <path d="M19.4 2.9v3.6h-3.6" />
  </S>
);

/* ---------- listing-page glyphs (Blinkit's PLP control row + card meta) ---------- */

/** Delivery promise on a product card. */
export const IconClock = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3 1.8" />
  </S>
);

export const IconStock = (p: P) => (
  <S {...p}>
    <rect x="3.2" y="8.4" width="17.6" height="7.2" rx="2.4" />
    <path d="M6.4 10.8h3.4v2.4H6.4z" fill="currentColor" stroke="none" />
  </S>
);

/** Filters — the slider stack. */
export const IconSliders = (p: P) => (
  <S {...p}>
    <path d="M4 8h11M18.5 8H20M4 16h3M10.5 16H20" />
    <circle cx="16.6" cy="8" r="1.9" />
    <circle cx="8.6" cy="16" r="1.9" />
  </S>
);

/** Sort — two arrows running opposite ways. */
export const IconSortArrows = (p: P) => (
  <S {...p}>
    <path d="M7.4 4.6v14.8M4.2 16.2l3.2 3.2 3.2-3.2" />
    <path d="M16.6 19.4V4.6M13.4 7.8l3.2-3.2 3.2 3.2" />
  </S>
);

/** Copy to clipboard — two stacked sheets. */
export const IconCopy = (p: P) => (
  <S {...p}>
    <rect x="9" y="9" width="11.4" height="11.4" rx="2.4" />
    <path d="M15.6 6.6V6a2.4 2.4 0 0 0-2.4-2.4H6A2.4 2.4 0 0 0 3.6 6v7.2a2.4 2.4 0 0 0 2.4 2.4h.6" />
  </S>
);


/* ---------- order tracking ---------- */

/** Call the delivery partner. */
export const IconPhone = (p: P) => (
  <S {...p}>
    <path d="M20.4 16.9v2.7a1.8 1.8 0 0 1-2 1.8 17.8 17.8 0 0 1-7.7-2.8 17.5 17.5 0 0 1-5.4-5.4A17.8 17.8 0 0 1 2.6 5.5a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.55c.11.86.32 1.7.62 2.5a1.8 1.8 0 0 1-.4 1.9l-1.15 1.15a14.4 14.4 0 0 0 5.4 5.4l1.15-1.15a1.8 1.8 0 0 1 1.9-.4c.8.3 1.64.51 2.5.62a1.8 1.8 0 0 1 1.55 1.83z" />
  </S>
);

/** Safety / verified, on the store-distance row. */
export const IconShield = (p: P) => (
  <S {...p}>
    <path d="M12 2.9 4.6 6v5.4c0 4.55 3.15 8.8 7.4 9.9 4.25-1.1 7.4-5.35 7.4-9.9V6z" />
    <path d="m8.9 11.9 2.2 2.2 4-4.3" />
  </S>
);

/** Expand the map. */
export const IconExpand = (p: P) => (
  <S {...p}>
    <path d="M9.4 3.6H3.6v5.8M14.6 20.4h5.8v-5.8M20.4 9.4V3.6h-5.8M3.6 14.6v5.8h5.8" />
  </S>
);

/** Collapse the map — the arrows point inward. */
export const IconCollapse = (p: P) => (
  <S {...p}>
    <path d="M3.6 9.4h5.8V3.6M20.4 14.6h-5.8v5.8M14.6 9.4h5.8V3.6M9.4 14.6H3.6v5.8" />
  </S>
);

/**
 * Storefront — the glyph beside the distance in Blinkit's header. It marks the
 * number as "how far the STORE is", which a scooter does not: a scooter reads
 * as the rider, and the rider is not what 1.9 km measures.
 */
export const IconStore = (p: P) => (
  <F {...p}>
    <path d="M4.1 3.6h15.8l1.5 4.1a2.6 2.6 0 0 1-4.9 1.5 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.9-1.5z" />
    <path d="M5.2 10.9v8.3c0 .7.5 1.2 1.2 1.2h11.2c.7 0 1.2-.5 1.2-1.2v-8.3a3.9 3.9 0 0 1-3.4-.8 3.9 3.9 0 0 1-4.5 0 3.9 3.9 0 0 1-4.5 0 3.9 3.9 0 0 1-1.2.8zm4.3 3.2h5v5h-5z" />
  </F>
);

/**
 * Blinkit Cash, drawn the way the header draws it: a filled wallet in the
 * brand yellow with the rupee on the flap, not a thin outline. The colours are
 * baked in rather than inherited — this one glyph is the only spot of warm
 * colour in the header, and that is what makes it findable.
 */
export const IconRupeeWallet = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
    {/* the note, standing proud of the wallet's mouth */}
    <rect x="6.6" y="2.6" width="11" height="8.4" rx="1.5" fill="#2E7D4F" />
    <path
      d="M10 5.2h4.2M10 6.9h4.2M11.6 5.2c1.3 0 2 .5 2 1.4s-.8 1.4-2.1 1.4L13.8 10"
      stroke="#fff"
      strokeWidth="0.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* the wallet body over it, so the note reads as tucked inside */}
    <rect x="3" y="7.4" width="18" height="12.8" rx="2.6" fill="#F5C63C" />
    <path d="M3 11.2h18v1.9H3z" fill="#DCA92C" />
    <rect x="13.8" y="12.2" width="7.2" height="4.2" rx="2.1" fill="#C9901F" />
    <circle cx="17.4" cy="14.3" r="1.05" fill="#FFF3D0" />
  </svg>
);

/**
 * Solid caret for the address line. The header uses a filled triangle, not a
 * stroked chevron — at 13px a 1.8px stroke reads as a different weight from
 * the heavy type it sits against.
 */
export const IconCaretDown = (p: P) => (
  <F {...p}>
    <path d="M6.4 9.2h11.2a.7.7 0 0 1 .53 1.16l-5.6 6.5a.7.7 0 0 1-1.06 0l-5.6-6.5A.7.7 0 0 1 6.4 9.2z" />
  </F>
);

/**
 * Voice search — the waveform that replaced the mic in Blinkit's header, in
 * its own button beside the field rather than inside it. Bars, not a capsule:
 * it marks the assistant, and the sparkle is part of that mark.
 */
export const IconVoiceBars = (p: P) => (
  <F {...p}>
    <rect x="3.4" y="9.4" width="2.1" height="5.2" rx="1.05" />
    <rect x="7.4" y="6.2" width="2.1" height="11.6" rx="1.05" />
    <rect x="11.4" y="3.6" width="2.1" height="16.8" rx="1.05" />
    <rect x="15.4" y="6.2" width="2.1" height="11.6" rx="1.05" />
    <rect x="19.4" y="9.4" width="2.1" height="5.2" rx="1.05" />
  </F>
);

/* WhatsApp. Filled rather than stroked, because it is a brand mark rather than
   one of the interface's own glyphs and the outline version of it reads as a
   generic chat bubble. */
export const IconWhatsApp = (p: P) => (
  <F {...p}>
    <path d="M12.04 2A9.9 9.9 0 0 0 2.13 11.9a9.8 9.8 0 0 0 1.33 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01a9.9 9.9 0 0 0 9.91-9.9A9.9 9.9 0 0 0 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 1 1 6.97 3.86Zm4.5-6.14c-.24-.12-1.45-.72-1.68-.8-.23-.09-.39-.13-.56.12-.16.24-.63.8-.78.96-.14.17-.29.19-.53.07a6.7 6.7 0 0 1-1.98-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.01-.38.11-.5.11-.11.24-.29.36-.43.12-.15.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.75-1.82-.2-.48-.4-.41-.55-.42l-.47-.01a.9.9 0 0 0-.65.3c-.22.25-.86.84-.86 2.04 0 1.2.88 2.37 1 2.53.12.17 1.72 2.63 4.17 3.69.58.25 1.04.4 1.4.51.58.19 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.16-.06-.1-.22-.17-.46-.29Z" />
  </F>
);
