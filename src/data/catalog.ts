export type Product = {
  id: string;
  name: string;
  series: string;
  unit: string;
  price: number;
  mrp?: number;
  rating?: number;
  ratings?: number;
  image: string;
  /** Every genuine picture of this product, in order, when there is more than
   *  one. The card's pager and its swipe are driven by this — so the number of
   *  dots is always the number of real photographs, never a decoration. */
  views?: string[];
  /** runtime GLB — only the five supplied models have real 3D/AR */
  glb?: string;
  badge?: 'NEW DROP' | 'LIMITED' | 'RARE';
  mystery?: boolean;
  /** points needed to reveal a mystery product */
  revealAt?: number;
  /** scheduled drop that is not yet live */
  lockedUntil?: string;
  /**
   * Units left. Only set where stock is genuinely short: Blinkit shows the
   * counter as scarcity, so putting it on everything turns it into decoration
   * and stops meaning anything on the items where it should bite.
   */
  stock?: number;
  /** Overrides AGE_RATING for anything that is not an ordinary 1:64 die-cast. */
  age?: string;
};

/**
 * Every 1:64 die-cast in this catalogue carries the same rating, so it lives
 * here rather than being copied onto fifteen products where it would drift.
 */
export const AGE_RATING = '3+ years';

/** The store's standing promise, shown on every card the way Blinkit does. */
export const ETA_MINS = 8;

/**
 * The saved address. It appears in the home header and again under every inner
 * page title, so it is declared once — two copies drift the moment either is
 * edited, and the whole point of repeating it is that they agree.
 */
export const DELIVERY_ADDRESS = { label: 'Home', line: 'Flat 12B, Palm Grove Residency, Whitefield, Bengaluru 560066' };

/**
 * One tone per badge, declared once.
 *
 * The card badge and the PDP tag were styled separately, and the card's rule
 * was "NEW DROP is dark, everything else is red" — so LIMITED and RARE, which
 * are different claims about scarcity, arrived identical. The scale runs
 * neutral → flame → gold as the claim gets stronger.
 */
export type BadgeTone = 'new' | 'limited' | 'rare';
export const BADGE_TONE: Record<NonNullable<Product['badge']>, BadgeTone> = {
  'NEW DROP': 'new',
  LIMITED: 'limited',
  RARE: 'rare',
};

const CAR = (n: string) => `/cars/${n}.webp`;

/** The five supplied GLB models — the hero tier: 3D viewer + real AR + raceable. */
export const HERO_CARS: Product[] = [
  {
    id: 'ballistik',
    stock: 4,
    name: 'Hot Wheels Ballistik Die Cast Car',
    series: 'Unleashed 2 Series · Collector #04',
    unit: '1 pc',
    price: 179,
    rating: 4.9,
    ratings: 214,
    image: CAR('ballistik-diecast'),
    views: [CAR('ballistik-diecast'), CAR('ballistik-rear'), CAR('ballistik-top')],
    glb: '/models/ballistik.glb',
    badge: 'NEW DROP',
  },
  {
    id: 'battlespec',
    name: 'Hot Wheels Battle Spec Die Cast Car',
    series: 'Unleashed 2 Series',
    unit: '1 pc',
    price: 179,
    rating: 4.8,
    ratings: 167,
    image: CAR('battlespec-diecast'),
    views: [CAR('battlespec-diecast'), CAR('battlespec-rear'), CAR('battlespec-top')],
    glb: '/models/battlespec.glb',
  },
  {
    id: 'jackhammer',
    name: 'Hot Wheels Jack Hammer Die Cast Car',
    series: 'Unleashed 2 Series',
    unit: '1 pc',
    price: 179,
    rating: 4.7,
    ratings: 98,
    image: CAR('jackhammer-diecast'),
    views: [CAR('jackhammer-diecast'), CAR('jackhammer-rear'), CAR('jackhammer-top')],
    glb: '/models/jackhammer.glb',
  },
  {
    id: 'hollowback',
    stock: 2,
    name: 'Hot Wheels Hollowback Die Cast Car',
    series: 'Unleashed Series',
    unit: '1 pc',
    price: 179,
    rating: 4.9,
    ratings: 143,
    image: CAR('hollowback-diecast'),
    views: [CAR('hollowback-diecast'), CAR('hollowback-rear'), CAR('hollowback-top')],
    glb: '/models/hollowback.glb',
    badge: 'LIMITED',
  },
  {
    id: 'kitt',
    stock: 3,
    name: 'Hot Wheels K.I.T.T. Die Cast Car',
    series: 'Unleashed Series · Licensed',
    unit: '1 pc',
    price: 179,
    rating: 5.0,
    ratings: 302,
    image: CAR('kitt-diecast'),
    views: [CAR('kitt-diecast'), CAR('kitt-rear'), CAR('kitt-top')],
    glb: '/models/kitt.glb',
    badge: 'RARE',
  },
];

/** Ordinary catalogue products — flat photo, no 3D. Buyable without racing. */
export const SHOP_CARS: Product[] = [
  /* Real prices, as sold in India. A single basic (mainline) Hot Wheels car is
     ₹179 on Blinkit, at its MRP — so no invented discounts. The two premium-line
     cars sit in Mattel India's premium (Real Riders) range of ₹399–599. */
  { id: 'muscle', name: 'Hot Wheels Muscle Bound Die Cast Car', series: 'Worldwide Basic Series', unit: '1 pc', price: 179, rating: 4.7, ratings: 35, image: CAR('09-02-muscle-car-orange'), views: [CAR('09-02-muscle-car-orange'), CAR('muscle-c1'), CAR('muscle-c2')] },
  { id: 'retro', name: 'Hot Wheels Retro Racer Die Cast Car', series: 'Worldwide Basic Series', unit: '1 pc', price: 179, rating: 4.8, ratings: 43, image: CAR('09-05-retro-racing-car-yellow'), views: [CAR('09-05-retro-racing-car-yellow'), CAR('retro-c1'), CAR('retro-c2')] },
  { id: 'supercar', name: 'Hot Wheels Night Shifter Die Cast Car', series: 'Worldwide Basic Series', unit: '1 pc', price: 179, rating: 4.6, ratings: 61, image: CAR('09-07-supercar-purple'), views: [CAR('09-07-supercar-purple'), CAR('supercar-c1'), CAR('supercar-c2')] },
  { id: 'pickup', name: 'Hot Wheels Performance Pickup Die Cast Car', series: 'Worldwide Basic Series', unit: '1 pc', price: 179, rating: 4.6, ratings: 51, image: CAR('09-09-performance-pickup-blue'), views: [CAR('09-09-performance-pickup-blue'), CAR('pickup-c1'), CAR('pickup-c2')] },
  { id: 'proto', name: 'Hot Wheels Race Prototype Die Cast Car', series: 'Track Stars', unit: '1 pc', price: 179, rating: 4.5, ratings: 22, image: CAR('09-10-race-prototype-red'), views: [CAR('09-10-race-prototype-red'), CAR('proto-c1'), CAR('proto-c2')] },
  { id: 'metallic', stock: 2, name: 'Hot Wheels Metallic Edition Die Cast Car', series: 'Collector Series', unit: '1 pc', price: 399, rating: 4.9, ratings: 88, image: CAR('09-11-rare-metallic-edition'), views: [CAR('09-11-rare-metallic-edition'), CAR('metallic-c1'), CAR('metallic-c2')], badge: 'LIMITED' },
  { id: 'premium', stock: 1, name: 'Hot Wheels Premium Limited Racer Die Cast Car', series: 'Premium Collection', unit: '1 pc', price: 599, rating: 4.9, ratings: 46, image: CAR('09-12-premium-limited-racer'), views: [CAR('09-12-premium-limited-racer'), CAR('premium-c1'), CAR('premium-c2')], badge: 'LIMITED' },
  { id: 'featured', stock: 5, name: 'Hot Wheels Featured Drop Die Cast Car', series: 'Drop #01', unit: '1 pc', price: 179, rating: 4.8, ratings: 130, image: CAR('featured-drop-diecast'), views: [CAR('featured-drop-diecast'), CAR('featured-c1'), CAR('featured-c2')], badge: 'NEW DROP' },
];

/** Rare car gated behind an actual race score. */
export const MYSTERY_CAR: Product = {
  id: 'mystery',
  name: 'Mystery Drop Car',
  series: 'Drop #02 · concealed',
  unit: '1 pc',
  price: 399,
  image: CAR('11-mystery-drop-car'),
  mystery: true,
  revealAt: 5000,
};

export const REVEALED_CAR: Product = {
  ...MYSTERY_CAR,
  id: 'mystery',
  name: 'Hot Wheels Phantom Reveal Die Cast Car',
  series: 'Drop #02 · unlocked',
  image: CAR('23-rare-car-reveal'),
  rating: 5.0,
  ratings: 12,
  badge: 'RARE',
  mystery: false,
};

export const CARS: Product[] = [...HERO_CARS, ...SHOP_CARS, MYSTERY_CAR];

export function productById(id: string, mysteryUnlocked = false): Product | undefined {
  if (id === 'mystery') return mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR;
  return CARS.find((c) => c.id === id);
}

/** Grocery pickups used by the race — real supplied artwork. */
export type Pickup = { id: string; name: string; image: string; points: number };

export const PICKUPS: Pickup[] = [
  { id: 'banana', name: 'Banana', image: '/grocery/24-01-banana-pickup.webp', points: 100 },
  { id: 'milk', name: 'Milk', image: '/grocery/24-02-milk-carton-pickup.webp', points: 100 },
  { id: 'chips', name: 'Chips', image: '/grocery/24-03-chips-packet-pickup.webp', points: 100 },
  { id: 'cola', name: 'Cola', image: '/grocery/24-04-cola-bottle-pickup.webp', points: 100 },
  { id: 'cereal', name: 'Cereal', image: '/grocery/24-05-cereal-box-pickup.webp', points: 250 },
  { id: 'icecream', name: 'Ice cream', image: '/grocery/24-06-ice-cream-pickup.webp', points: 250 },
  { id: 'fruit', name: 'Fruit basket', image: '/grocery/24-08-fruit-basket-pickup.webp', points: 250 },
  { id: 'bag', name: 'Blinkit bag', image: '/grocery/24-07-grocery-delivery-bag-pickup.webp', points: 500 },
];

/** Blinkit's own category artwork. */
/**
 * Shop by category.
 *
 * The labels follow the art rather than the other way round: the supplied set
 * covers oil and masala, bakery, dry fruits, meat and kitchenware, which the
 * old eight did not. Keeping the old labels would have meant putting a tray of
 * chicken under a tile that said "Munchies".
 */
export const CATEGORIES = [
  { id: 'veg', label: 'Vegetables & Fruits', image: '/assets/cat-veg.webp' },
  { id: 'atta', label: 'Atta, Rice & Dal', image: '/assets/cat-atta.webp' },
  { id: 'oil', label: 'Oil, Ghee & Masala', image: '/assets/cat-oil.webp' },
  { id: 'dairy', label: 'Dairy, Bread & Eggs', image: '/assets/cat-dairy.webp' },
  { id: 'bakery', label: 'Bakery & Biscuits', image: '/assets/cat-bakery.webp' },
  { id: 'dryfruits', label: 'Dry Fruits & Cereals', image: '/assets/cat-dryfruits.webp' },
  { id: 'meat', label: 'Chicken, Meat & Fish', image: '/assets/cat-meat.webp' },
  { id: 'kitchen', label: 'Kitchenware & Appliances', image: '/assets/cat-kitchen.webp' },
];

export const LEADERBOARD = [
  { name: 'Meera K.', area: 'Indiranagar', points: 14320 },
  { name: 'Aarav S.', area: 'HSR Layout', points: 11980 },
  { name: 'Rahul M.', area: 'Koramangala', points: 10410 },
  { name: 'Sneha P.', area: 'Koramangala', points: 8900 },
  { name: 'Karan V.', area: 'BTM Layout', points: 8655 },
  { name: 'Nikhil J.', area: 'Jayanagar', points: 8180 },
  { name: 'Priya R.', area: 'Ejipura', points: 7640 },
  { name: 'Dev A.', area: 'Domlur', points: 6980 },
];

export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
