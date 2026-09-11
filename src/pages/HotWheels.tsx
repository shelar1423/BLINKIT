import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { Sheet } from '../design/components/Sheet';
import { ProductCard } from '../design/components/ProductCard';
import { HERO_CARS, MYSTERY_CAR, REVEALED_CAR, SHOP_CARS, rupees, type Product } from '../data/catalog';
import { useStore } from '../store/useStore';
import {
  IconCheck,
  IconChevronDown,
  IconSearch,
  IconShare,
  IconSliders,
  IconSortArrows,
} from '../design/elements/Icons';

/* ============================================================
   The drop, as a Blinkit category page.

   Blinkit's category listing is a sticky rail of picture-led groups down the
   left with the grid beside it, and a scrolling row of filter controls above
   the grid: Filters, Sort, and then the one or two facets that matter for the
   category. The header carries the delivery address rather than a description,
   because changing where it goes is the thing you might do before filling a
   basket.

   Every control here does something. A "Filters" chip that opens nothing is
   worse than no chip, so every chip below is a real predicate — nothing is
   drawn just to match the reference. That is also why the fourth facet is
   Series and not Brand: every product in this catalogue is Hot Wheels, so a
   brand filter would have exactly one option and could never change the grid.
   ============================================================ */

type Group = {
  id: string;
  label: string;
  match: (p: Product) => boolean;
};

const GROUPS: Group[] = [
  { id: 'all', label: 'All cars', match: () => true },
  { id: 'playable', label: 'Race ready', match: (p) => Boolean(p.glb) },
  { id: 'new', label: 'New drop', match: (p) => p.badge === 'NEW DROP' },
  { id: 'limited', label: 'Limited', match: (p) => p.badge === 'LIMITED' },
  { id: 'collector', label: 'Collector', match: (p) => /Collector|Premium/i.test(p.series) },
];

type SortId = 'featured' | 'priceAsc' | 'priceDesc' | 'rating';
const SORTS: { id: SortId; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'priceAsc', label: 'Price: low to high' },
  { id: 'priceDesc', label: 'Price: high to low' },
  { id: 'rating', label: 'Customer rating' },
];

type Band = { id: string; label: string; match: (p: Product) => boolean };
const BANDS: Band[] = [
  { id: 'u200', label: `Under ${rupees(200)}`, match: (p) => p.price < 200 },
  { id: '200-300', label: `${rupees(200)} – ${rupees(300)}`, match: (p) => p.price >= 200 && p.price < 300 },
  { id: 'o300', label: `${rupees(300)} and above`, match: (p) => p.price >= 300 },
];

/** Which sheet is open. One at a time, so one piece of state, not four. */
type SheetId = 'filters' | 'sort' | 'price' | 'series' | null;

export default function HotWheels() {
  const nav = useNavigate();
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const mystery = mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR;
  const all = useMemo(() => [...HERO_CARS, ...SHOP_CARS, mystery], [mystery]);

  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<SortId>('featured');
  const [band, setBand] = useState<string | null>(null);
  const [series, setSeries] = useState<string[]>([]);
  const [raceOnly, setRaceOnly] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);

  /** The series facet is derived from the catalogue, not typed out twice. */
  const allSeries = useMemo(() => {
    const seen = new Set<string>();
    for (const p of all) seen.add(p.series.split(' · ')[0]);
    return [...seen].sort();
  }, [all]);

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
    const bandDef = BANDS.find((b) => b.id === band);
    const list = all.filter(
      (p) =>
        g.match(p) &&
        (!bandDef || bandDef.match(p)) &&
        (series.length === 0 || series.includes(p.series.split(' · ')[0])) &&
        (!raceOnly || Boolean(p.glb)) &&
        (!inStock || p.stock == null || p.stock > 0),
    );
    /* Sorting a copy: `all` is memoised off the catalogue, and sorting in
       place would quietly reorder it for every other screen that reads it. */
    const out = [...list];
    if (sort === 'priceAsc') out.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') out.sort((a, b) => b.price - a.price);
    if (sort === 'rating') out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return out;
  }, [all, group, sort, band, series, raceOnly, inStock]);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? 'Featured';
  const bandLabel = BANDS.find((b) => b.id === band)?.label;
  const extraCount = (raceOnly ? 1 : 0) + (inStock ? 1 : 0);
  const anyFilter = extraCount > 0 || band !== null || series.length > 0;

  const clearAll = () => {
    setBand(null);
    setSeries([]);
    setRaceOnly(false);
    setInStock(false);
  };

  const toggleSeries = (s: string) =>
    setSeries((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <>
      <PageHeader
        title="Hot Wheels"
        address
        onBack={() => nav('/')}
        right={
          <div className="phdr__acts">
            <button type="button" aria-label="Share this collection">
              <IconShare size={21} />
            </button>
            <button type="button" aria-label="Search in Hot Wheels">
              <IconSearch size={21} />
            </button>
          </div>
        }
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
          {/* Blinkit's control row: text chips with a leading glyph and a
              chevron, scrolling sideways rather than wrapping. Active ones take
              the green outline so the grid's state is readable without opening
              anything. */}
          <div className="catbar" role="group" aria-label="Filter and sort">
            <button
              className={'catchip' + (extraCount ? ' is-on' : '')}
              type="button"
              onClick={() => setSheet('filters')}
            >
              <IconSliders size={15} />
              Filters{extraCount ? ` (${extraCount})` : ''}
              <IconChevronDown size={14} />
            </button>
            <button
              className={'catchip' + (sort !== 'featured' ? ' is-on' : '')}
              type="button"
              onClick={() => setSheet('sort')}
            >
              <IconSortArrows size={15} />
              {sort === 'featured' ? 'Sort' : sortLabel.replace(/:.*/, '')}
              <IconChevronDown size={14} />
            </button>
            <button className={'catchip' + (band ? ' is-on' : '')} type="button" onClick={() => setSheet('price')}>
              {band ? bandLabel : 'Price'}
              <IconChevronDown size={14} />
            </button>
            <button
              className={'catchip' + (series.length ? ' is-on' : '')}
              type="button"
              onClick={() => setSheet('series')}
            >
              {series.length ? `Series (${series.length})` : 'Series'}
              <IconChevronDown size={14} />
            </button>
            {anyFilter && (
              <button className="catchip catchip--clear" type="button" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>

          <p className="catcount">
            {shown.length} {shown.length === 1 ? 'product' : 'products'}
          </p>

          {shown.length === 0 ? (
            <p className="t-sm catempty">
              Nothing matches those filters.
              <br />
              <button className="linkbtn" type="button" onClick={clearAll}>
                Clear all filters
              </button>
            </p>
          ) : (
            <div className="catgrid">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by">
        {SORTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={'sortrow' + (sort === o.id ? ' is-on' : '')}
            onClick={() => {
              setSort(o.id);
              setSheet(null);
            }}
          >
            <span className="grow">{o.label}</span>
            {sort === o.id && <IconCheck size={17} />}
          </button>
        ))}
      </Sheet>

      <Sheet open={sheet === 'price'} onClose={() => setSheet(null)} title="Price">
        <button
          type="button"
          className={'sortrow' + (band === null ? ' is-on' : '')}
          onClick={() => {
            setBand(null);
            setSheet(null);
          }}
        >
          <span className="grow">Any price</span>
          {band === null && <IconCheck size={17} />}
        </button>
        {BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={'sortrow' + (band === b.id ? ' is-on' : '')}
            onClick={() => {
              setBand(b.id);
              setSheet(null);
            }}
          >
            <span className="grow">{b.label}</span>
            <em className="sortrow__n">{all.filter(b.match).length}</em>
            {band === b.id && <IconCheck size={17} />}
          </button>
        ))}
      </Sheet>

      <Sheet
        open={sheet === 'series'}
        onClose={() => setSheet(null)}
        title="Series"
        footer={
          <Button variant="primary" block onClick={() => setSheet(null)}>
            Show {shown.length} {shown.length === 1 ? 'product' : 'products'}
          </Button>
        }
      >
        {allSeries.map((s) => {
          const on = series.includes(s);
          return (
            <button key={s} type="button" className={'sortrow' + (on ? ' is-on' : '')} onClick={() => toggleSeries(s)}>
              <span className={'tick' + (on ? ' is-on' : '')} aria-hidden="true">
                {on && <IconCheck size={13} />}
              </span>
              <span className="grow">{s}</span>
              <em className="sortrow__n">{all.filter((p) => p.series.startsWith(s)).length}</em>
            </button>
          );
        })}
      </Sheet>

      <Sheet
        open={sheet === 'filters'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <Button variant="primary" block onClick={() => setSheet(null)}>
            Show {shown.length} {shown.length === 1 ? 'product' : 'products'}
          </Button>
        }
      >
        <button type="button" className={'sortrow' + (raceOnly ? ' is-on' : '')} onClick={() => setRaceOnly((v) => !v)}>
          <span className={'tick' + (raceOnly ? ' is-on' : '')} aria-hidden="true">
            {raceOnly && <IconCheck size={13} />}
          </span>
          <span className="grow">
            Race ready only
            <small>Has a 3D model and runs in AR</small>
          </span>
        </button>
        <button type="button" className={'sortrow' + (inStock ? ' is-on' : '')} onClick={() => setInStock((v) => !v)}>
          <span className={'tick' + (inStock ? ' is-on' : '')} aria-hidden="true">
            {inStock && <IconCheck size={13} />}
          </span>
          <span className="grow">
            In stock
            <small>Hides anything sold out of this drop</small>
          </span>
        </button>
      </Sheet>
    </>
  );
}
