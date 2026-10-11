import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CARS, LEADERBOARD, type Product } from '../data/catalog';

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
  /** Percentage off every Hot Wheels car at this step. */
  pct: number;
};

/* One reward system: points climb a discount ladder on Hot Wheels. Each step
   is a percentage off every car, active for 24 hours from the race that
   reached it. (It replaced a cash ladder of free delivery, ₹25 and ₹50
   Blinkit Cash and a District Pass: two reward systems on one sheet, and
   cash that had nothing to do with the cars the race was selling.) */
export const REWARD_TIERS: RewardTier[] = [
  { id: 'start', min: 1000, label: '5% off', value: 0, freeDelivery: false, pct: 5 },
  { id: 'check', min: 2500, label: '10% off', value: 0, freeDelivery: false, pct: 10 },
  { id: 'pit', min: 5000, label: '15% off', value: 0, freeDelivery: false, pct: 15 },
  { id: 'podium', min: 8000, label: '20% off', value: 0, freeDelivery: false, pct: 20 },
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

/* ------------------------------------------------------------------
   The racer price.

   Points set it, not rank. Total points climb the ladder above, and the step
   reached is a percentage off every Hot Wheels car for 24 hours. A live rank
   moves every time anyone races, so a price tied to it would change under the
   player mid-basket and could not be budgeted; points only ever go up, and
   only the player moves them.

   - Reaching a higher step starts a fresh 24 hours at the new percentage.
   - Racing again on the same step does not extend it: the clock is a reason
     to buy, not to grind.
   - Once it runs out, the next race brings it back at whatever step the
     points are on.
   The city leaderboard stays as the competition, settled once, when the
   three-day drop closes (see FINAL_PRIZE), so the board can move all it likes
   while it runs.
   ------------------------------------------------------------------ */
export type RacerLock = { pct: number; until: number };
export const RACER_LOCK_MS = 24 * 60 * 60 * 1000;
export const rankFor = (points: number) => LEADERBOARD.filter((r) => r.points > points).length + 1;
/** The step a points total has reached, as a percentage; 0 below the first. */
export const racerPctFor = (points: number) =>
  [...REWARD_TIERS].reverse().find((t) => points >= t.min)?.pct ?? 0;
/** What a racer price takes off one unit of a car, in whole rupees. */
export const racerOff = (price: number, pct: number) => Math.round((price * pct) / 100);
export const lockActive = (l: RacerLock | null | undefined, now = Date.now()): l is RacerLock => Boolean(l && l.until > now);
/** The leaderboard's own prize: settled when the drop closes, never mid-race. */
export const FINAL_PRIZE = { top: 3, label: 'District Pass, 1 month' };

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
  /**
   * The bill exactly as it stood when the order was placed.
   *
   * Kept rather than recomputed, because by the time anyone looks at it the
   * cart it came from is empty — and because a bill is a record of what was
   * charged, not a sum that should be free to change its mind later. Optional
   * only for orders persisted before this existed.
   */
  bill?: Totals;
};

/**
 * Testing switch: races never run out, but the counter still shows the real
 * daily allowance so every screen reads exactly as it would in production.
 *
 * OFF. Three a day is the rule the campaign is built on — it is what makes an
 * invite worth sending, and with this on the result screen could never reach
 * the state where it asks for one. Set it back to true only to demo the race
 * itself back to back.
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
  /** The racer-price percentage behind rewardValue, or 0 when it is cash. */
  racerPct: number;
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
  /* An active racer price comes off every car, per unit, exactly as the cards
     showed it. One reward per order: while it is on, it stands in for the
     ladder's cash; the ladder's free delivery still applies. */
  racer: { pct: number } | null = null,
): Totals {
  const items = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const mrp = lines.reduce((a, l) => a + (l.product.mrp ?? l.product.price) * l.qty, 0);
  const racerPctOn = racer?.pct ?? 0;
  const rewardValue = racerPctOn
    ? lines.reduce((a, l) => a + racerOff(l.product.price, racerPctOn) * l.qty, 0)
    : claimed?.value ?? 0;
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
    items, mrp, savings, delivery, handling, rewardValue, toPay, racerPct: racerPctOn,
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
  /** The racer price from the last race, until it runs out or is spent. */
  racerLock: RacerLock | null;
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
  /* `Totals`, not a hand-written copy of it. The inline type here had drifted
     — no tip, no donation, no free-delivery progress — so every caller saw a
     narrower bill than the one computeTotals actually returns. */
  totals: () => Totals;

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

/* ------------------------------------------------------------------
   Preview seed, for the reward-states comparison page only.

   `?seed=1` runs the store from memory instead of localStorage, starting from
   the state named in the URL, so several phones on one page can each show a
   different cart and reward without overwriting one another:
     pts=3240           total points
     reward=check|pit|start|none   which ladder tier is riding on the next order
     lock=0             no racer price;  left=5  hours left on it (0 = ran out)
     cart=muscle:2,retro:1         cart lines
   Without `seed`, this returns null and nothing changes.
   ------------------------------------------------------------------ */
function previewStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('seed') !== '1') return null;
  const tier = REWARD_TIERS.find((t) => t.id === q.get('reward'));
  const cart: Record<string, number> = {};
  for (const part of (q.get('cart') ?? '').split(',').filter(Boolean)) {
    const [id, n] = part.split(':');
    cart[id] = Number(n) || 1;
  }
  const state = {
    totalPoints: Number(q.get('pts') ?? 3240),
    bestScore: Number(q.get('pts') ?? 3240),
    cart,
    claimedReward: tier ? { id: tier.id, value: tier.value, freeDelivery: tier.freeDelivery } : null,
    /* lock=0 for none; left=hours remaining (0 = already ran out). */
    racerLock:
      q.get('lock') === '0'
        ? null
        : (() => {
            const pct = racerPctFor(Number(q.get('pts') ?? 3240));
            return pct ? { pct, until: Date.now() + Number(q.get('left') ?? 24) * 3600 * 1000 - 60 * 1000 } : null;
          })(),
  };
  const mem = new Map<string, string>([['blinkit-hw-v1', JSON.stringify({ state, version: 0 })]]);
  return {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => void mem.delete(k),
    setItem: (k, v) => void mem.set(k, v),
  };
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
      racerLock: null,
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

      totals: () => {
        const l = get().racerLock;
        return computeTotals(linesFromCart(get().cart), get().claimedReward, 0, 0, lockActive(l) ? l : null);
      },

      selectCar: (id) => set({ selectedCarId: id }),

      finishRace: (r) => {
        const tier = tierFor(r.score);
        const result: RaceResult = { ...r, rewardId: tier?.id ?? null, at: Date.now() };
        set((s) => {
          /* The racer price: the rank after this race sets it, and it is
             locked for 24 hours from now. A better one still running is not
             replaced by a smaller one. */
          const now = Date.now();
          const pct = racerPctFor(s.totalPoints + r.score);
          const running = lockActive(s.racerLock, now) ? s.racerLock : null;
          /* A higher step starts a fresh 24 hours; the same step keeps its clock;
             nothing running and a step reached starts one. */
          const racerLock =
            pct === 0 ? running : running && running.pct >= pct ? running : { pct, until: now + RACER_LOCK_MS };
          return {
          racerLock,
          /* UNLIMITED_RACES keeps the daily limit visible in the UI — it still
             reads "3 of 3 races left today" — while never actually running out,
             so the build can be demoed and tested back to back. Flip it to
             false to restore the real three-a-day rule. */
          racesLeft: UNLIMITED_RACES ? s.racesLeft : Math.max(0, s.racesLeft - 1),
          totalPoints: s.totalPoints + r.score,
          bestScore: Math.max(s.bestScore, r.score),
          lastResult: result,
          unlockedRewards: tier && !s.unlockedRewards.includes(tier.id) ? [...s.unlockedRewards, tier.id] : s.unlockedRewards,
          /* Won IS claimed.
           *
           * A tier used to be unlocked here and then held, waiting for the
           * player to find the rewards screen and press a button to actually
           * have it. So the result screen showed a ticket reading "₹25 Off"
           * that was not yet worth anything, and the one thing standing
           * between a race and a basket was a step whose only job was to say
           * yes to something already earned.
           *
           * It is applied on the spot. Nothing is overwritten: only one reward
           * rides on an order at a time, so a better one replaces a smaller
           * one that has not been spent, and a smaller one does not displace a
           * better one already waiting. */
          /* No cash reward any more: the ladder pays out as the racer price. */
          claimedReward: null,
          mysteryUnlocked: s.mysteryUnlocked || s.totalPoints + r.score >= MYSTERY_UNLOCK_POINTS,
          };
        });
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
          bill: t,
        };
        /* A racer price is spent by the order it came off; the ladder's
           reward is spent only when it was the one applied. */
        set((s) => ({
          order,
          cart: {},
          claimedReward: t.racerPct ? s.claimedReward : null,
          racerLock: t.racerPct ? null : s.racerLock,
          totalPoints: s.totalPoints + 250,
        }));
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
          racerLock: null,
          mysteryUnlocked: false,
          invitedCount: 0,
          order: null,
          saved: [],
          viewed: [],
        }),
    }),
    {
      name: 'blinkit-hw-v1',
      storage: createJSONStorage(() => previewStorage() ?? localStorage),
      // guard against corrupt/stale localStorage
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const safe: Partial<State> = {};
        if (p.cart && typeof p.cart === 'object') safe.cart = p.cart;
        if (Array.isArray(p.saved)) safe.saved = p.saved.filter((x) => typeof x === 'string');
        /* While races are unlimited, a stored zero from an earlier build would
           still lock the player out — so the count is taken fresh. */
        if (!UNLIMITED_RACES && typeof p.racesLeft === 'number' && p.racesLeft >= 0) safe.racesLeft = p.racesLeft;
        if (typeof p.totalPoints === 'number' && p.totalPoints >= 0) safe.totalPoints = p.totalPoints;
        if (typeof p.bestScore === 'number') safe.bestScore = p.bestScore;
        if (Array.isArray(p.unlockedRewards)) safe.unlockedRewards = p.unlockedRewards;
        if (typeof p.selectedCarId === 'string' && CARS.some((c) => c.id === p.selectedCarId)) safe.selectedCarId = p.selectedCarId;
        if (typeof p.mysteryUnlocked === 'boolean') safe.mysteryUnlocked = p.mysteryUnlocked;
        if (typeof p.referralCode === 'string') safe.referralCode = p.referralCode;
        if (typeof p.invitedCount === 'number') safe.invitedCount = p.invitedCount;
        if (typeof p.soundOn === 'boolean') safe.soundOn = p.soundOn;
        if (p.claimedReward && typeof p.claimedReward === 'object') safe.claimedReward = p.claimedReward;
        if (p.racerLock && typeof p.racerLock === 'object' && typeof p.racerLock.until === 'number') safe.racerLock = p.racerLock;
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
  const lock = useStore((s) => s.racerLock);
  const tip = useStore((s) => s.tip);
  const donation = useStore((s) => s.donation);
  return useMemo(
    () => computeTotals(linesFromCart(cart), claimed, tip, donation, lockActive(lock) ? lock : null),
    [cart, claimed, lock, tip, donation],
  );
}

export function useCartCount() {
  const cart = useStore((s) => s.cart);
  return useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
}
