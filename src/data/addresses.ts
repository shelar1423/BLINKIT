/* ============================================================
   Saved delivery addresses.

   Data, not UI: the address sheet is a list, and a list needs a list. These
   are the entries the checkout picks between, shaped the way Blinkit's own
   sheet shows them — a label, the flattened one-line address it prints under
   that label, a phone number, and how far it is from where the phone thinks
   you are.

   `distanceKm` is null for the address you are standing in. That is not a
   missing value: the real sheet shows "You're here" in place of a distance for
   exactly one entry, so the absence IS the state.
   ============================================================ */

export type Address = {
  id: string;
  /** Hostel, Home, Work, or a person's name when it is somebody else's. */
  label: string;
  /** The kind of pin drawn beside it. */
  kind: 'pin' | 'home' | 'people';
  line: string;
  phone: string;
  /** Distance from the current location, or null when this IS it. */
  distanceKm: number | null;
};

export const ADDRESSES: Address[] = [
  {
    id: 'hostel',
    label: 'Hostel',
    kind: 'pin',
    line: '#307, Mi Casa Premium Stay, Rahinj Nagar, Near MIT ADT, Loni Kalbhor, Pune, Maharashtra, Loni Kalbhor, India',
    phone: '9620964510',
    distanceKm: null,
  },
  {
    id: 'kirti',
    label: 'Kirti Gupta',
    kind: 'people',
    line: 'R-103, Fourth Floor, Star Heights Apartments, Loni Kalbhor, Pune, Maharashtra , Kadamwak Wasti, India',
    phone: '9636046132',
    distanceKm: 1.32,
  },
  {
    id: 'other',
    label: 'Other',
    kind: 'pin',
    line: 'Sambhaji Nagar, 202, Radhakrishna Apartment, Near Angel High School, Loni Kalbhor, India',
    phone: '9620964510',
    distanceKm: 2.04,
  },
  {
    id: 'home',
    label: 'Home',
    kind: 'home',
    line: 'Sabari PG for ladies, Thanisandra Main Road, Bengaluru, Karnataka, India',
    phone: '9620964510',
    distanceKm: 842,
  },
];

/* ============================================================
   Payment methods.

   Grouped exactly as the real sheet groups them, because the grouping is the
   information: "Recommended" is the three you actually use, "Cards" is where
   the one that cannot be used sits with its reason, and the rest are the long
   tail. A flat list of nine would say none of that.
   ============================================================ */

export type PayMethod = {
  id: string;
  label: string;
  /** The brand mark, drawn rather than fetched. */
  mark: string;
  /** A row that opens something, versus one with an ADD affordance. */
  action: 'open' | 'add';
  /** Present when the method exists but cannot be used on this order. */
  disabledReason?: string;
};

export type PayGroup = { title: string; methods: PayMethod[] };

export const PAY_GROUPS: PayGroup[] = [
  {
    title: 'Recommended',
    methods: [
      { id: 'gpay', label: 'Google Pay UPI', mark: 'gpay', action: 'open' },
      { id: 'cred', label: 'CRED UPI', mark: 'cred', action: 'open' },
      { id: 'paytm', label: 'Paytm UPI', mark: 'paytm', action: 'open' },
    ],
  },
  {
    title: 'Cards',
    methods: [
      { id: 'card', label: 'Add credit or debit cards', mark: 'card', action: 'add' },
      {
        id: 'pluxee',
        label: 'Pluxee',
        mark: 'pluxee',
        action: 'open',
        disabledReason: 'This payment method is not applicable on orders containing non-food items',
      },
    ],
  },
  {
    title: 'Pay by any UPI app',
    methods: [
      { id: 'bhim', label: 'BHIM UPI', mark: 'bhim', action: 'open' },
      { id: 'amazon', label: 'Amazon Pay UPI', mark: 'amazon', action: 'open' },
      { id: 'newupi', label: 'Add new UPI ID', mark: 'upi', action: 'add' },
    ],
  },
  {
    title: 'Wallets',
    methods: [
      { id: 'blinkit-money', label: 'Blinkit Money', mark: 'blinkit', action: 'open' },
      { id: 'mobikwik', label: 'Mobikwik', mark: 'mobikwik', action: 'open' },
    ],
  },
];

export function findMethod(id: string) {
  for (const g of PAY_GROUPS) {
    const m = g.methods.find((x) => x.id === id);
    if (m) return m;
  }
  return PAY_GROUPS[2].methods[0];
}
