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

/* ============================================================
   Tracking screen.

   Nine icons taken from the campaign file's own icon sheet rather than drawn
   here, so the shapes on the tracking cards are the ones the design specifies.
   They are authored on a 48 grid, unlike everything above, which is why they
   carry their own wrapper instead of reusing S and F.
   ============================================================ */

const T = ({ size = 20, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** griddy-icons:chat-bubble-text — "Need help?" */
export const IconChatBubble = (p: P) => (
  <T {...p}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.54 43.4C13.85 43.53 14.18 43.59 14.5 43.59L14.51 43.58C15.15 43.58 15.79 43.33 16.27 42.85L23.12 36H38.5C39.9579 35.9974 41.3553 35.417 42.3862 34.3862C43.417 33.3553 43.9974 31.9579 44 30.5V11.5C43.9974 10.0421 43.417 8.64471 42.3862 7.61383C41.3553 6.58295 39.9579 6.00264 38.5 6H9.5C8.04212 6.00264 6.64471 6.58295 5.61383 7.61383C4.58295 8.64471 4.00264 10.0421 4 11.5V30.5C4.00264 31.9579 4.58295 33.3553 5.61383 34.3862C6.64471 35.417 8.04212 35.9974 9.5 36H12V41.09C12 42.11 12.6 43.01 13.54 43.4ZM7 11.5C7 10.12 8.12 9 9.5 9H38.5C39.88 9 41 10.12 41 11.5V30.5C41 31.88 39.88 33 38.5 33H21.88L15 39.88V33H9.5C8.12 33 7 31.88 7 30.5V11.5ZM35 16H13V19H35V16ZM27 23H13V26H27V23Z"
      fill="currentColor"
    />
  </T>
);

/** lsicon:motorcycle-outline — "Your delivery details" */
export const IconMotorcycle = (p: P) => (
  <T {...p}>
    <path
      d="M27 10.5H36C36.7956 10.5 37.5587 10.8161 38.1213 11.3787C38.6839 11.9413 39 12.7044 39 13.5C39 14.2956 38.6839 15.0587 38.1213 15.6213C37.5587 16.1839 36.7956 16.5 36 16.5H30M31.5 16.5L33 27L28.5 34.5H4.5V31.5C4.5 29.9087 5.13214 28.3826 6.25736 27.2574C7.38258 26.1321 8.9087 25.5 10.5 25.5H19.5M22.5 34.5L18 16.5H9M16.5 36C16.5 37.1935 16.0259 38.3381 15.182 39.182C14.3381 40.0259 13.1935 40.5 12 40.5C10.8065 40.5 9.66193 40.0259 8.81802 39.182C7.97411 38.3381 7.5 37.1935 7.5 36M43.5 36C43.5 37.1935 43.0259 38.3381 42.182 39.182C41.3381 40.0259 40.1935 40.5 39 40.5C37.8065 40.5 36.6619 40.0259 35.818 39.182C34.9741 38.3381 34.5 37.1935 34.5 36C34.5 34.8065 34.9741 33.6619 35.818 32.818C36.6619 31.9741 37.8065 31.5 39 31.5C40.1935 31.5 41.3381 31.9741 42.182 32.818C43.0259 33.6619 43.5 34.8065 43.5 36Z"
      stroke="currentColor"
      strokeWidth="3"
    />
  </T>
);

/** codicon:mic — "Add delivery instructions" */
export const IconMicSolid = (p: P) => (
  <T {...p}>
    <path
      d="M24 33C28.962 33 33 28.962 33 24V12C33 7.038 28.962 3 24 3C19.038 3 15 7.038 15 12V24C15 28.962 19.038 33 24 33ZM18 12C18 8.691 20.691 6 24 6C27.309 6 30 8.691 30 12V24C30 27.309 27.309 30 24 30C20.691 30 18 27.309 18 24V12ZM39 22.5V24C39 31.755 33.06 38.082 25.5 38.844V43.5C25.5 43.8978 25.342 44.2794 25.0607 44.5607C24.7794 44.842 24.3978 45 24 45C23.6022 45 23.2206 44.842 22.9393 44.5607C22.658 44.2794 22.5 43.8978 22.5 43.5V38.85C14.94 38.079 9 31.752 9 23.994V22.494C9 22.0962 9.15804 21.7146 9.43934 21.4333C9.72064 21.152 10.1022 20.994 10.5 20.994C10.8978 20.994 11.2794 21.152 11.5607 21.4333C11.842 21.7146 12 22.0962 12 22.494V24C12 30.621 17.382 36 24 36C30.618 36 36 30.621 36 24V22.5C36 22.1022 36.158 21.7206 36.4393 21.4393C36.7206 21.158 37.1022 21 37.5 21C37.8978 21 38.2794 21.158 38.5607 21.4393C38.842 21.7206 39 22.1022 39 22.5Z"
      fill="currentColor"
    />
  </T>
);

/** iconamoon:like-light — "Do you like our services?" */
export const IconLike = (p: P) => (
  <T {...p}>
    <g transform="translate(6.5 6.5)">
      <path
        d="M23.5 13.502L22.02 13.256C21.9843 13.4709 21.9958 13.691 22.0537 13.9009C22.1116 14.1109 22.2146 14.3058 22.3555 14.4719C22.4963 14.6381 22.6716 14.7716 22.8693 14.8631C23.067 14.9546 23.2822 15.002 23.5 15.002V13.502ZM1.5 13.502V12.002C1.10218 12.002 0.720644 12.16 0.43934 12.4413C0.158035 12.7226 0 13.1042 0 13.502H1.5ZM5.5 35.002H28.22V32.002H5.5V35.002ZM30.62 12.002H23.5V15.002H30.62V12.002ZM24.98 13.748L26.592 4.078L23.632 3.584L22.02 13.256L24.98 13.748ZM23.14 0.00199986H22.712V3.002H23.138L23.14 0.00199986ZM16.47 3.342L11.44 10.888L13.936 12.552L18.966 5.006L16.47 3.342ZM9.36 12.002H1.5V15.002H9.36V12.002ZM0 13.502V29.502H3V13.502H0ZM33.614 30.582L36.014 18.582L33.074 17.992L30.674 29.992L33.614 30.582ZM11.44 10.888C11.2118 11.2306 10.9025 11.5095 10.5397 11.7038C10.1768 11.8982 9.77162 11.9999 9.36 12V15C11.2 15 12.916 14.082 13.936 12.552L11.44 10.888ZM26.592 4.078C26.6753 3.57674 26.6485 3.06134 26.5134 2.57149C26.3783 2.08163 26.1382 1.62707 25.8097 1.23938C25.4812 0.851696 25.0722 0.540188 24.6112 0.326505C24.1502 0.112822 23.6481 0.00208859 23.14 0.00199986L23.138 3.002C23.2105 3.00218 23.2841 3.01812 23.3498 3.04872C23.4155 3.07932 23.4738 3.12384 23.5206 3.1792C23.5674 3.23457 23.6016 3.29945 23.6209 3.36934C23.6401 3.43924 23.6439 3.51249 23.632 3.584L26.592 4.078ZM30.62 15C32.2 15 33.38 16.444 33.072 17.99L36.014 18.58C36.1732 17.7822 36.1533 16.957 35.956 16.1678C35.7586 15.3785 35.3887 14.6429 34.8727 14.0139C34.3568 13.3849 33.7077 12.8782 32.9723 12.5303C32.2369 12.1824 31.4335 12.002 30.62 12.002V15ZM28.22 35.002C29.4914 35.0022 30.7236 34.56 31.7071 33.7542C32.6905 32.9483 33.3643 31.8267 33.614 30.58L30.674 29.99C30.5606 30.5572 30.2541 31.0675 29.8066 31.4341C29.3591 31.8006 28.7984 32.0026 28.22 32.002V35.002ZM22.712 0.00199986C21.4773 0.00208955 20.2618 0.30499 19.1732 0.88764C18.0847 1.47029 17.1568 2.31267 16.472 3.34L18.966 5.006C19.3771 4.38932 19.9341 3.88172 20.5876 3.53211C21.2411 3.18251 21.9709 3.00172 22.712 3.002V0.00199986ZM5.5 32.002C4.12 32.002 3 30.882 3 29.502H0C0 30.9607 0.579462 32.3596 1.61091 33.3911C2.64236 34.4225 4.04131 35.002 5.5 35.002V32.002Z"
        fill="currentColor"
      />
      <path d="M9.5 13.502V33.502" stroke="currentColor" strokeWidth="3" />
    </g>
  </T>
);

/** boxicons:check-shield-filled — the store-distance row. */
export const IconShieldCheck = (p: P) => (
  <T {...p}>
    <path
      d="M40.84 12.22L24.9 4.22C24.34 3.94 23.66 3.94 23.1 4.22L7.16 12.22C6.54 12.52 6.14 13.12 6.06 13.8C6.04 14.02 4.14 35.34 23.16 43.82C23.4171 43.9384 23.6969 43.9998 23.98 43.9998C24.2631 43.9998 24.5429 43.9384 24.8 43.82C43.82 35.32 41.94 14 41.9 13.8C41.8681 13.4643 41.7501 13.1424 41.5574 12.8656C41.3647 12.5888 41.1038 12.3665 40.8 12.22H40.84ZM22 30.84L16.58 25.42L19.4 22.6L21.98 25.18L28.56 18.6L31.38 21.42L21.96 30.84H22Z"
      fill="currentColor"
    />
  </T>
);

/** bxs:phone-call — calling the partner. */
export const IconPhoneCall = (p: P) => (
  <T {...p}>
    <path d="M40 21.998H44C44 11.738 36.254 4 25.98 4V8C34.104 8 40 13.886 40 21.998Z" fill="currentColor" />
    <path
      d="M26 16C30.206 16 32 17.794 32 22H36C36 15.55 32.45 12 26 12V16ZM32.844 26.886C32.4599 26.5362 31.9548 26.3496 31.4356 26.3657C30.9164 26.3817 30.4237 26.5992 30.062 26.972L25.276 31.894C24.124 31.674 21.808 30.952 19.424 28.574C17.04 26.188 16.318 23.866 16.104 22.722L21.022 17.934C21.3948 17.5723 21.6123 17.0796 21.6283 16.5604C21.6444 16.0412 21.4578 15.5361 21.108 15.152L13.718 7.026C13.3681 6.64071 12.8818 6.40701 12.3623 6.37452C11.8429 6.34203 11.3312 6.51332 10.936 6.852L6.596 10.574C6.25022 10.921 6.04384 11.3829 6.016 11.872C5.986 12.372 5.414 24.216 14.598 33.404C22.61 41.414 32.646 42 35.41 42C35.814 42 36.062 41.988 36.128 41.984C36.6167 41.9551 37.0778 41.7481 37.424 41.402L41.144 37.06C41.4829 36.6651 41.6546 36.1535 41.6224 35.6341C41.5903 35.1147 41.357 34.6282 40.972 34.278L32.844 26.886Z"
      fill="currentColor"
    />
  </T>
);

/** famicons:call-outline — the recipient's number. */
export const IconCallOutline = (p: P) => (
  <T {...p}>
    <path
      d="M42.2813 35.0625C40.7925 33.5625 37.1869 31.3734 35.4375 30.4913C33.1594 29.3438 32.9719 29.25 31.1813 30.5803C29.9869 31.4681 29.1928 32.2613 27.795 31.9631C26.3972 31.665 23.3597 29.9841 20.7 27.3328C18.0403 24.6816 16.2619 21.5559 15.9628 20.1628C15.6637 18.7697 16.47 17.985 17.3494 16.7878C18.5887 15.1003 18.495 14.8191 17.4356 12.5409C16.6097 10.7691 14.3569 7.19719 12.8512 5.71594C11.2406 4.125 11.2406 4.40625 10.2028 4.8375C9.35788 5.19292 8.5473 5.62504 7.78125 6.12844C6.28125 7.125 5.44875 7.95281 4.86656 9.19688C4.28437 10.4409 4.02281 13.3575 7.02938 18.8194C10.0359 24.2813 12.1453 27.0741 16.5112 31.4278C20.8772 35.7816 24.2344 38.1225 29.1422 40.875C35.2134 44.2753 37.5422 43.6125 38.79 43.0313C40.0378 42.45 40.8694 41.625 41.8678 40.125C42.3725 39.3602 42.8056 38.5506 43.1616 37.7063C43.5938 36.6722 43.875 36.6722 42.2813 35.0625Z"
      stroke="currentColor"
      strokeWidth="3"
      strokeMiterlimit="10"
    />
  </T>
);

/** fluent:share-ios-24-regular — "Share current location". */
export const IconShareUp = (p: P) => (
  <T {...p}>
    <path
      d="M25.06 4.44C24.7787 4.1591 24.3975 4.00132 24 4.00132C23.6025 4.00132 23.2213 4.1591 22.94 4.44L12.44 14.94C12.175 15.2243 12.0308 15.6004 12.0377 15.989C12.0445 16.3776 12.2019 16.7484 12.4768 17.0232C12.7516 17.2981 13.1224 17.4555 13.511 17.4624C13.8996 17.4692 14.2757 17.325 14.56 17.06L22.5 9.12V30.5C22.5 30.8978 22.658 31.2794 22.9393 31.5607C23.2206 31.842 23.6022 32 24 32C24.3978 32 24.7794 31.842 25.0607 31.5607C25.342 31.2794 25.5 30.8978 25.5 30.5V9.12L33.44 17.06C33.5773 17.2074 33.7429 17.3256 33.9269 17.4076C34.1109 17.4895 34.3096 17.5336 34.511 17.5372C34.7124 17.5407 34.9124 17.5037 35.0992 17.4282C35.286 17.3528 35.4556 17.2405 35.5981 17.0981C35.7405 16.9556 35.8528 16.786 35.9282 16.5992C36.0037 16.4124 36.0407 16.2124 36.0372 16.011C36.0336 15.8096 35.9895 15.6109 35.9076 15.4269C35.8256 15.2429 35.7074 15.0773 35.56 14.94L25.06 4.44ZM7.5 22C7.89782 22 8.27936 22.158 8.56066 22.4393C8.84196 22.7206 9 23.1022 9 23.5V35.5C9 37.432 10.568 39 12.5 39H35.5C36.4283 39 37.3185 38.6312 37.9749 37.9749C38.6312 37.3185 39 36.4283 39 35.5V23.5C39 23.1022 39.158 22.7206 39.4393 22.4393C39.7206 22.158 40.1022 22 40.5 22C40.8978 22 41.2794 22.158 41.5607 22.4393C41.842 22.7206 42 23.1022 42 23.5V35.5C42 37.2239 41.3152 38.8772 40.0962 40.0962C38.8772 41.3152 37.2239 42 35.5 42H12.5C10.7761 42 9.12279 41.3152 7.90381 40.0962C6.68482 38.8772 6 37.2239 6 35.5V23.5C6 23.1022 6.15804 22.7206 6.43934 22.4393C6.72064 22.158 7.10218 22 7.5 22Z"
      fill="currentColor"
    />
  </T>
);

/** streamline:arrow-shrink-diagonal-1 — collapsing the map. */
export const IconShrinkDiagonal = (p: P) => (
  <T {...p}>
    <path
      d="M13 35L21.4615 26.5385M21.4615 33.3077V26.5385H14.6923M35 13L26.5385 21.4615M26.5385 14.6923V21.4615H33.3077"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </T>
);

/* ---- three more categories on the home rail ----
   Taken from the campaign file's icon sheet, like the tracking set above, and
   redrawn onto the 24 grid the rail's own icons use so they sit at the same
   optical weight as Beauty and Gifting rather than arriving heavier. */

/** hugeicons:lamp — Decor. */
export const IconLamp = (p: P) => (
  /* Fitted to the rail's own optical size. Drawn at 48 it filled almost the
     whole 24 box, where Beauty and Gifting sit about 17.6 tall, so it arrived
     heavier than its neighbours. Scaled about its own centre, with the stroke
     scaled back up so it does not thin out as the glyph shrinks. */
  <S {...p} strokeWidth={p.strokeWidth ?? 2.14}>
    <g transform="translate(12 12) scale(0.84) translate(-11.95 -12.7)">
    <path d="M12 13.5v6.7" strokeLinecap="round" />
    <path
      d="M12 1.9c1.8 0 2.7 0 3.5.3.42.17.81.41 1.16.71.65.55 1.07 1.35 1.92 2.95l.88 1.66c1.54 2.9 2.31 4.35 1.68 5.42-.64 1.07-2.26 1.07-5.52 1.07H8.38c-3.26 0-4.89 0-5.52-1.07-.64-1.07.13-2.52 1.67-5.42l.88-1.66c.85-1.6 1.28-2.4 1.93-2.95.35-.3.74-.54 1.16-.71.78-.32 1.68-.32 3.5-.32Z"
      strokeLinecap="round"
    />
    <path d="M9.86 21.6c.3-.5.44-.75.66-.94.22-.19.49-.33.79-.41.29-.08.62-.08 1.29-.08s1 0 1.29.08c.3.08.57.22.79.41.22.19.37.44.66.94.36.6.53.89.5 1.13a.86.86 0 0 1-.38.61c-.24.13-.64.13-1.43.13h-2.86c-.79 0-1.19 0-1.43-.13a.86.86 0 0 1-.38-.61c-.03-.24.14-.54.5-1.13Z" />
    </g>
  </S>
);

/** hugeicons:baby-bottle — Kids. */
export const IconBabyBottle = (p: P) => (
  <S {...p} strokeWidth={p.strokeWidth ?? 2.25}>
    <g transform="translate(12 12) scale(0.8) translate(-13 -11.65)">
    <path
      d="M20.9 10.3s1.1 2.8 1.1 6.4c0 1.3-.14 2.5-.32 3.5-.23 1.25-.35 1.87-.96 2.38-.62.51-1.35.51-2.82.51H8.1c-1.47 0-2.2 0-2.82-.51-.62-.51-.73-1.13-.96-2.38-.22-1.15-.32-2.32-.32-3.5 0-3.6 1.1-6.4 1.1-6.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18.3 14.2h2.8M18.3 18.6h2.8" strokeLinecap="round" />
    <path
      d="M4.1 10.3h15.8c.16-.9-.09-2.65-2.26-3.34-.52-.16-1.12-.47-1.4-.98a2.1 2.1 0 0 1 .02-1.98c.31-.6.4-1.27.24-1.9a2.44 2.44 0 0 0-1.7-1.76 2.5 2.5 0 0 0-.8-.1c-.19 0-.38.04-.56.1a2.44 2.44 0 0 0-1.7 1.76c-.15.63-.06 1.3.25 1.9.36.68.25 1.3.01 1.75-.26.5-.84.94-1.38 1.11-1.5.48-2.53 1.61-2.24 3.2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    </g>
  </S>
);

/** carbon:flight-international — Imported. */
export const IconFlightIntl = (p: P) => (
  <F {...p}>
    <g transform="translate(12 12) scale(0.835) translate(-12 -12.4)">
    <path d="M12 21c-.17 0-.34-.01-.5-.03-1.54-2.47-2.4-5.31-2.48-8.22h13.44c.02-.25.04-.5.04-.75 0-2.08-.62-4.11-1.77-5.83a10.5 10.5 0 0 0-4.71-3.87 10.5 10.5 0 0 0-6.07-.6 10.5 10.5 0 0 0-5.38 2.87 10.5 10.5 0 0 0-2.87 5.38 10.5 10.5 0 0 0 .6 6.07 10.5 10.5 0 0 0 3.87 4.71A10.5 10.5 0 0 0 12 22.5V21Zm8.96-9.75h-4.49c-.08-2.76-.79-5.46-2.07-7.91a9 9 0 0 1 6.56 7.91Zm-8.46-8.22c1.54 2.47 2.4 5.31 2.47 8.22H9.02c.08-2.91.94-5.75 2.48-8.22a9 9 0 0 1 1.01 0M9.59 3.34a17.7 17.7 0 0 0-2.06 7.91H3.04a9 9 0 0 1 6.55-7.91M3.04 12.75h4.49c.08 2.76.79 5.46 2.07 7.91a9 9 0 0 1-6.56-7.91Z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.75 18.75 22.5 20.25v-1.5l-3.75-1.88V15a.75.75 0 0 0-1.5 0v1.87L13.5 18.75v1.5l3.75-1.5v2.63l-1.5 1.12v.75l2.25-.75 2.25.75v-.75l-1.5-1.12v-2.63Z"
    />
    </g>
  </F>
);
