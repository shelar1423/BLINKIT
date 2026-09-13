import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CARS, type Product } from '../data/catalog';

export type RewardTier = {
  id: string;
  min: number;
  label: string;
  value: number; // rupees off; 0 = no cash component
  freeDelivery: boolean;
  /* What this tier gives you when it is not money off. A partner's product is
     not Blinkit Cash and must not be counted as any: District Pass is a
     month's membership whose headline benefit is a cinema ticket, so it
     carries `value: 0` and says what it is here instead. */
  perk?: string;
};

export const REWARD_TIERS: RewardTier[] = [
  { id: 'start', min: 1000, label: 'Free Delivery', value: 0, freeDelivery: true },
  { id: 'check', min: 2500, label: '₹25 Blinkit Cash', value: 25, freeDelivery: true },
  { id: 'pit', min: 5000, label: '₹50 Blinkit Cash', value: 50, freeDelivery: true },
  { id: 'podium', min: 8000, label: 'District Pass, 1 month', value: 0, freeDelivery: true, perk: '1 free movie ticket' },
];

/**
 * Whether a score has reached a tier.
 *
 * Shared because Rewards and the Leaderboard both answer it now — the rewards
 * list, and the link between the two screens that says how many are unlocked.
 * Two copies of this rule would be two copies free to drift apart, and the
 * whole point of those links is that they agree with the page they open.
 */
export function hasReached(tier: RewardTier, totalPoints: number, unlockedRewards: string[]) {
  return unlockedRewards.includes(tier.id) || totalPoints >= tier.min;
}

export function tierFor(score: number): RewardTier | null {
  let best: RewardTier | null = null;
  for (const t of REWARD_TIERS) if (score >= t.min) best = t;
  return best;
}

export type RaceResult = {
  score: number;
  groceries: number;
  seconds: number;
  rewardId: string | null;
  at: number;
};

export type CartLine = { id: string; qty: number };

export type Order = {
  id: string;
  lines: { id: string; qty: number; price: number; name: string; image: string }[];
  total: number;
  savings: number;
  rewardValue: number;
  placedAt: number;
};

/**
 * Testing switch: races never run out, but the counter still shows the real
 * daily allowance so every screen reads exactly as it would in production.
 * Set to false to enforce the real three-a-day rule.
 */
const UNLIMITED_RACES = true;

const MAX_RACES = 3;

/** Items total that earns free delivery: anything ₹150 and above ships free. */
export const FREE_DELIVERY_MIN = 150;
/** The delivery charge below that — shown struck through as FREE above it. */
export const DELIVERY_FEE = 30;

export type Totals = {
  items: number; mrp: number; savings: number; delivery: number;
  handling: number; rewardValue: number; toPay: number;
  /** What the player chose to add on top: a tip, and a donation. */
  tip: number; donation: number;
  /** rupees still needed for free delivery; 0 once unlocked */
  freeDeliveryShortfall: number;
  freeDeliveryProgress: number; // 0..1
};

/** Pure bill maths — no store access, so it can be memoised safely. */
export function computeTotals(
  lines: { product: Product; qty: number }[],
  claimed: { value: number; freeDelivery: boolean } | null,
  /* Both are opt-in extras rather than charges, so they are arguments here
     instead of constants: nothing about the order decides them, the player
     does, and a bill that computed them itself would be deciding for them. */
  tip = 0,
  donation = 0,
): Totals {
  const items = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const mrp = lines.reduce((a, l) => a + (l.product.mrp ?? l.product.price) * l.qty, 0);
  const rewardValue = claimed?.value ?? 0;
  const freeDel = Boolean(claimed?.freeDelivery) || items >= FREE_DELIVERY_MIN;
  const delivery = items === 0 ? 0 : freeDel ? 0 : DELIVERY_FEE;
  const handling = items === 0 ? 0 : 9;
  const savings = mrp - items + (freeDel && items > 0 ? DELIVERY_FEE : 0) + rewardValue;
  /* An empty cart carries neither. They are things you add to an order, and
     there is no order to add them to. */
  const tipDue = items === 0 ? 0 : tip;
  const donationDue = items === 0 ? 0 : donation;
  const toPay = Math.max(0, items + delivery + handling - rewardValue) + tipDue + donationDue;
  const freeDeliveryShortfall = freeDel ? 0 : Math.max(0, FREE_DELIVERY_MIN - items);
  const freeDeliveryProgress = freeDel ? 1 : Math.min(1, items / FREE_DELIVERY_MIN);
  return {
    items, mrp, savings, delivery, handling, rewardValue, toPay,
    tip: tipDue, donation: donationDue, freeDeliveryShortfall, freeDeliveryProgress,
  };
}

export function linesFromCart(cart: Record<string, number>) {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const product = CARS.find((c) => c.id === id);
      return product ? { product, qty } : null;
    })
    .filter(Boolean) as { product: Product; qty: number }[];
}

type State = {
  cart: Record<string, number>;
  /** Which saved address the checkout is delivering to. */
  addressId: string;
  /** Which payment method the Place Order button will use. */
  payId: string;
  /** Rupees tipped to the rider, and donated to Feeding India. 0 is off. */
  tip: number;
  donation: number;
  selectedCarId: string;
  racesLeft: number;
  totalPoints: number;
  bestScore: number;
  lastResult: RaceResult | null;
  unlockedRewards: string[];
  claimedReward: { id: string; value: number; freeDelivery: boolean } | null;
  mysteryUnlocked: boolean;
  referralCode: string;
  invitedCount: number;
  order: Order | null;
  soundOn: boolean;
  /** Wishlisted product ids. The heart on a card has to keep its state, or it
   *  is a control that lies every time the list re-renders. */
  saved: string[];
  /** Product ids in the order they were last opened, newest first. Caps at 12 —
      it drives a chip, not a history page. */
  viewed: string[];

  setAddress: (id: string) => void;
  setPay: (id: string) => void;
  setTip: (n: number) => void;
  setDonation: (n: number) => void;
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeLine: (id: string) => void;
  clearCart: () => void;
  cartCount: () => number;
  cartLines: () => { product: Product; qty: number }[];
  totals: () => { items: number; mrp: number; savings: number; delivery: number; handling: number; rewardValue: number; toPay: number };

  selectCar: (id: string) => void;
  finishRace: (r: Omit<RaceResult, 'rewardId' | 'at'>) => RaceResult;
  claimReward: (id: string) => void;
  consumeReward: () => void;
  grantExtraRace: () => void;
  placeOrder: () => Order | null;
  toggleSound: () => void;
  toggleSaved: (id: string) => void;
  markViewed: (id: string) => void;
  resetCampaign: () => void;
};

function makeCode() {
  return 'RACE' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cart: {},
      addressId: 'hostel',
      payId: 'bhim',
      tip: 0,
      donation: 0,
      selectedCarId: CARS[0].id,
      racesLeft: MAX_RACES,
      totalPoints: 0,
      bestScore: 0,
      lastResult: null,
      unlockedRewards: [],
      claimedReward: null,
      mysteryUnlocked: false,
      referralCode: makeCode(),
      invitedCount: 0,
      order: null,
      soundOn: true,
      saved: [],
      viewed: [],

      setAddress: (id) => set({ addressId: id }),
      setPay: (id) => set({ payId: id }),
      /* Tapping the chip you already chose turns it off. A row of amounts with
         no way back is a row you can only ever tip MORE from. */
      setTip: (n) => set((st) => ({ tip: st.tip === n ? 0 : n })),
      setDonation: (n) => set((st) => ({ donation: st.donation === n ? 0 : n })),
      add: (id, qty = 1) => set((s) => ({ cart: { ...s.cart, [id]: (s.cart[id] ?? 0) + qty } })),
      setQty: (id, qty) =>
        set((s) => {
          const next = { ...s.cart };
          if (qty <= 0) delete next[id];
          else next[id] = qty;
          return { cart: next };
        }),
      removeLine: (id) =>
        set((s) => {
          const next = { ...s.cart };
          delete next[id];
          return { cart: next };
        }),
      clearCart: () => set({ cart: {} }),
      cartCount: () => Object.values(get().cart).reduce((a, b) => a + b, 0),
      cartLines: () => linesFromCart(get().cart),

      totals: () => computeTotals(linesFromCart(get().cart), get().claimedReward),

      selectCar: (id) => set({ selectedCarId: id }),

      finishRace: (r) => {
        const tier = tierFor(r.score);
        const result: RaceResult = { ...r, rewardId: tier?.id ?? null, at: Date.now() };
        set((s) => ({
          /* UNLIMITED_RACES keeps the daily limit visible in the UI — it still
             reads "3 of 3 races left today" — while never actually running out,
             so the build can be demoed and tested back to back. Flip it to
             false to restore the real three-a-day rule. */
          racesLeft: UNLIMITED_RACES ? s.racesLeft : Math.max(0, s.racesLeft - 1),
          totalPoints: s.totalPoints + r.score,
          bestScore: Math.max(s.bestScore, r.score),
          lastResult: result,
          unlockedRewards: tier && !s.unlockedRewards.includes(tier.id) ? [...s.unlockedRewards, tier.id] : s.unlockedRewards,
          mysteryUnlocked: s.mysteryUnlocked || s.totalPoints + r.score >= MYSTERY_UNLOCK_POINTS,
        }));
        return result;
      },

      claimReward: (id) => {
        const tier = REWARD_TIERS.find((t) => t.id === id);
        if (!tier) return;
        set({ claimedReward: { id: tier.id, value: tier.value, freeDelivery: tier.freeDelivery } });
      },
      consumeReward: () => set({ claimedReward: null }),
      grantExtraRace: () => set((s) => ({ racesLeft: s.racesLeft + 1, invitedCount: s.invitedCount + 1 })),

      placeOrder: () => {
        const lines = get().cartLines();
        if (!lines.length) return null;
        const t = get().totals();
        const order: Order = {
          id: 'BLK' + Math.floor(10000 + Math.random() * 89999),
          lines: lines.map((l) => ({
            id: l.product.id,
            qty: l.qty,
            price: l.product.price,
            name: l.product.name,
            image: l.product.image,
          })),
          total: t.toPay,
          savings: t.savings,
          rewardValue: t.rewardValue,
          placedAt: Date.now(),
        };
        set((s) => ({ order, cart: {}, claimedReward: null, totalPoints: s.totalPoints + 250 }));
        return order;
      },

      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      toggleSaved: (id) =>
        set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
      markViewed: (id) =>
        set((s) => (s.viewed[0] === id ? s : { viewed: [id, ...s.viewed.filter((x) => x !== id)].slice(0, 12) })),
      resetCampaign: () =>
        set({
          cart: {},
          racesLeft: MAX_RACES,
          totalPoints: 0,
          bestScore: 0,
          lastResult: null,
          unlockedRewards: [],
          claimedReward: null,
          mysteryUnlocked: false,
          invitedCount: 0,
          order: null,
          saved: [],
          viewed: [],
        }),
    }),
    {
      name: 'blinkit-hw-v1',
      storage: createJSONStorage(() => localStorage),
      // guard against corrupt/stale localStorage
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const safe: Partial<State> = {};
        if (p.cart && typeof p.cart === 'object') safe.cart = p.cart;
        if (Array.isArray(p.saved)) safe.saved = p.saved.filter((x) => typeof x === 'string');
        if (typeof p.racesLeft === 'number' && p.racesLeft >= 0) safe.racesLeft = p.racesLeft;
        if (typeof p.totalPoints === 'number' && p.totalPoints >= 0) safe.totalPoints = p.totalPoints;
        if (typeof p.bestScore === 'number') safe.bestScore = p.bestScore;
        if (Array.isArray(p.unlockedRewards)) safe.unlockedRewards = p.unlockedRewards;
        if (typeof p.selectedCarId === 'string' && CARS.some((c) => c.id === p.selectedCarId)) safe.selectedCarId = p.selectedCarId;
        if (typeof p.mysteryUnlocked === 'boolean') safe.mysteryUnlocked = p.mysteryUnlocked;
        if (typeof p.referralCode === 'string') safe.referralCode = p.referralCode;
        if (typeof p.invitedCount === 'number') safe.invitedCount = p.invitedCount;
        if (typeof p.soundOn === 'boolean') safe.soundOn = p.soundOn;
        if (p.claimedReward && typeof p.claimedReward === 'object') safe.claimedReward = p.claimedReward;
        if (p.lastResult && typeof p.lastResult === 'object') safe.lastResult = p.lastResult;
        if (p.order && typeof p.order === 'object') safe.order = p.order;
        return { ...current, ...safe };
      },
    },
  ),
);

/** Points that lift the cover on the mystery car. Exported because the home
 *  screen states this number to the player — a copy deck holding its own
 *  private "5,000" would silently start lying the day this changes. */
export const MYSTERY_UNLOCK_POINTS = 5000;

export const MAX_RACE_ATTEMPTS = MAX_RACES;


/* ============================================================
   Derived hooks.
   NEVER call store methods inside a selector — they build a new
   object each call, which breaks useSyncExternalStore's cached
   snapshot contract and sends React into an infinite loop.
   Select raw state, then memoise.
   ============================================================ */
export function useCartLines() {
  const cart = useStore((s) => s.cart);
  return useMemo(() => linesFromCart(cart), [cart]);
}

export function useTotals(): Totals {
  const cart = useStore((s) => s.cart);
  const claimed = useStore((s) => s.claimedReward);
  const tip = useStore((s) => s.tip);
  const donation = useStore((s) => s.donation);
  return useMemo(
    () => computeTotals(linesFromCart(cart), claimed, tip, donation),
    [cart, claimed, tip, donation],
  );
}

export function useCartCount() {
  const cart = useStore((s) => s.cart);
  return useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
}
