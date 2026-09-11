import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { Sheet } from '../design/components/Sheet';
import { dropStatus } from '../data/drop';
import { ProductCard } from '../design/components/ProductCard';
import { HERO_CARS, MYSTERY_CAR, REVEALED_CAR, SHOP_CARS, type Product } from '../data/catalog';
import { useStore } from '../store/useStore';
import { IconCheck, IconChevronDown, IconFlag } from '../design/elements/Icons';

/* ============================================================
   The drop, as a Blinkit category page.

   Blinkit's category listing is a sticky rail of picture-led groups down the
   left with the grid beside it, and a row of controls above the grid. This was
   a bare two-column grid, which is the same products with none of the way in.

   Every control here does something. A "Filters" chip that opens nothing is
   worse than no chip, so the rail filters, the sort sheet sorts, and the
   toggle is a real predicate — nothing is drawn just to match the reference.
   ============================================================ */

type Group = {
  id: string;
  label: string;
  match: (p: Product) => boolean;
};

const GROUPS: Group[] = [
  { id: 'all', label: 'All cars', match: () => true },
  {
    id: 'playable',
    label: 'Race ready',
    match: (p) => Boolean(p.glb),
  },
  {
    id: 'new',
    label: 'New drop',
    match: (p) => p.badge === 'NEW DROP',
  },
  {
    id: 'limited',
    label: 'Limited',
    match: (p) => p.badge === 'LIMITED',
  },
  {
    id: 'collector',
    label: 'Collector',
    match: (p) => /Collector|Premium/i.test(p.series),
  },
];

type SortId = 'featured' | 'priceAsc' | 'priceDesc' | 'rating';
const SORTS: { id: SortId; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'priceAsc', label: 'Price — low to high' },
  { id: 'priceDesc', label: 'Price — high to low' },
  { id: 'rating', label: 'Customer rating' },
];

export default function HotWheels() {
  const nav = useNavigate();
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const mystery = mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR;
  const all = useMemo(() => [...HERO_CARS, ...SHOP_CARS, mystery], [mystery]);

  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<SortId>('featured');
  const [sortOpen, setSortOpen] = useState(false);

  /* Each group needs a thumbnail the eye can tell apart. Taking the first
     match per group independently gave four groups the same green car, because
     it is the first product and it matches most of them. Assigning in one pass
     with a used-set means every rail tile shows a different car. */
  const arts = useMemo(() => {
    const used = new Set<string>();
    const out: Record<string, string | undefined> = {};
    for (const g of GROUPS) {
      const matches = all.filter(g.match);
      const fresh = matches.find((p) => p.image && !used.has(p.image));
      const pick = fresh ?? matches[0];
      if (pick?.image) used.add(pick.image);
      out[g.id] = pick?.image;
    }
    return out;
  }, [all]);

  const shown = useMemo(() => {
    const g = GROUPS.find((x) => x.id === group) ?? GROUPS[0];
    const list = all.filter(g.match);
    /* Sorting a copy: `all` is memoised off the catalogue, and sorting in
       place would quietly reorder it for every other screen that reads it. */
    const out = [...list];
    if (sort === 'priceAsc') out.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') out.sort((a, b) => b.price - a.price);
    if (sort === 'rating') out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return out;
  }, [all, group, sort]);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? 'Featured';

  return (
    <>
      <PageHeader
        title="Hot Wheels"
        subtitle={`Limited Drop · ${all.length} products · ${dropStatus().label.toLowerCase()}`}
        onBack={() => nav('/')}
      />

      <main className="page catpage">
        {/* Picture-led groups, sticky beside the grid. */}
        <nav className="catrail" aria-label="Car categories">
          {GROUPS.map((g) => {
            const count = all.filter(g.match).length;
            if (!count) return null;
            const art = arts[g.id];
            return (
              <button
                key={g.id}
                type="button"
                className={'catrail__i' + (group === g.id ? ' is-on' : '')}
                aria-current={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                <span className="catrail__im">{art && <img src={art} alt="" loading="lazy" />}</span>
                <small>{g.label}</small>
              </button>
            );
          })}
        </nav>

        <div className="catmain">
          <div className="catbar">
            <button className="catchip" type="button" onClick={() => setSortOpen(true)}>
              Sort: <b>{sortLabel.replace(/ —.*/, '')}</b>
              <IconChevronDown size={14} />
            </button>
            <span className="catbar__n">{shown.length} items</span>
          </div>

          <div className="card catrace">
            <span style={{ color: 'var(--hw-r)' }}>
              <IconFlag size={20} />
            </span>
            <div className="grow">
              <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Race to reveal the rare car</p>
              <p className="t-xs">Five cars have full 3D and AR. Everything else buys normally.</p>
            </div>
            <Button variant="flame" size="sm" onClick={() => nav('/race')}>
              Race
            </Button>
          </div>

          {shown.length === 0 ? (
            <p className="t-sm catempty">Nothing in this group yet.</p>
          ) : (
            <div className="catgrid">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {SORTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={'sortrow' + (sort === o.id ? ' is-on' : '')}
            onClick={() => {
              setSort(o.id);
              setSortOpen(false);
            }}
          >
            <span className="grow">{o.label}</span>
            {sort === o.id && <IconCheck size={17} />}
          </button>
        ))}
      </Sheet>
    </>
  );
}
