import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { Sheet } from '../design/components/Sheet';
import { ProductCard } from '../design/components/ProductCard';
import { HERO_CARS, MYSTERY_CAR, REVEALED_CAR, SHOP_CARS, rupees, type Product } from '../data/catalog';
import { useStore } from '../store/useStore';
import {
  IconCaretDown,
  IconCheck,
  IconChevronDown,
  IconClose,
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

/*
 * Race ready is no longer a rail tile. It was describing the same cars the
 * drop is about — the five with a real model behind them — so the drop tile
 * covers them now and the rail is one shorter. The capability has not gone
 * anywhere: "Race ready only" is still a filter, which is the better home for
 * it, because it is a property of a car rather than a category of one.
 */
const GROUPS: Group[] = [
  { id: 'all', label: 'All cars', match: () => true },
  { id: 'new', label: 'New drop', match: (p) => Boolean(p.glb) || p.badge === 'NEW DROP' },
  { id: 'limited', label: 'Limited', match: (p) => p.badge === 'LIMITED' },
  { id: 'collector', label: 'Collector', match: (p) => /Collector|Premium/i.test(p.series) },
];

type SortId = 'featured' | 'priceAsc' | 'priceDesc' | 'rating';
const SORTS: { id: SortId; label: string }[] = [
  { id: 'featured', label: 'Relevance (default)' },
  { id: 'priceAsc', label: 'Price (low to high)' },
  { id: 'priceDesc', label: 'Price (high to low)' },
  { id: 'rating', label: 'Rating (high to low)' },
];

type Band = { id: string; label: string; match: (p: Product) => boolean };
const BANDS: Band[] = [
  { id: 'u200', label: `Below ${rupees(199)}`, match: (p) => p.price < 200 },
  { id: '200-299', label: `${rupees(200)} - ${rupees(299)}`, match: (p) => p.price >= 200 && p.price < 300 },
  { id: '300-399', label: `${rupees(300)} - ${rupees(399)}`, match: (p) => p.price >= 300 && p.price < 400 },
  { id: 'o400', label: `Above ${rupees(400)}`, match: (p) => p.price >= 400 },
];

/** Which sheet is open. One at a time, so one piece of state, not four. */
type SheetId = 'filters' | 'sort' | 'series' | null;
type ModelId = '3d' | 'regular';
const MODELS: { id: ModelId; label: string }[] = [
  { id: '3d', label: '3D' },
  { id: 'regular', label: 'Regular' },
];
type FilterTab = 'model' | 'series' | 'price';
const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'model', label: 'Model' },
  { id: 'series', label: 'Series' },
  { id: 'price', label: 'Price' },
];

export default function HotWheels() {
  const nav = useNavigate();
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const mystery = mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR;
  const all = useMemo(() => [...HERO_CARS, ...SHOP_CARS, mystery], [mystery]);

  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<SortId>('featured');
  /** Price bands, any of which may match — boxes, not radio buttons. */
  const [bands, setBands] = useState<string[]>([]);
  const [series, setSeries] = useState<string[]>([]);
  /** Model: '3d' for cars with a real model (race and AR ready), 'regular' for the rest. */
  const [models, setModels] = useState<ModelId[]>([]);
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
    const bandDefs = BANDS.filter((b) => bands.includes(b.id));
    const list = all.filter(
      (p) =>
        g.match(p) &&
        (bandDefs.length === 0 || bandDefs.some((b) => b.match(p))) &&
        (series.length === 0 || series.includes(p.series.split(' · ')[0])) &&
        (models.length === 0 || models.includes(p.glb ? '3d' : 'regular')),
    );
    /* Sorting a copy: `all` is memoised off the catalogue, and sorting in
       place would quietly reorder it for every other screen that reads it. */
    const out = [...list];
    if (sort === 'priceAsc') out.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') out.sort((a, b) => b.price - a.price);
    if (sort === 'rating') out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return out;
  }, [all, group, sort, bands, series, models]);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? 'Featured';
  const bandLabel = bands.length === 1 ? BANDS.find((b) => b.id === bands[0])?.label : `Price (${bands.length})`;
  const extraCount = models.length + series.length + bands.length;

  const clearAll = () => {
    setBands([]);
    setSeries([]);
    setModels([]);
  };

  const toggleSeries = (s: string) =>
    setSeries((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  /* The Filters sheet works on a draft and commits on Apply, as Blinkit's does:
     ticking boxes does not reshuffle the grid behind the sheet. */
  const [tab, setTab] = useState<FilterTab>('model');
  const [q, setQ] = useState('');
  const [dModels, setDModels] = useState<ModelId[]>([]);
  const [dSeries, setDSeries] = useState<string[]>([]);
  const [dBands, setDBands] = useState<string[]>([]);
  const openFilters = (at: FilterTab = 'model') => {
    setDModels(models);
    setDSeries(series);
    setDBands(bands);
    setQ('');
    setTab(at);
    setSheet('filters');
  };
  const draftDirty =
    dBands.length !== bands.length || dBands.some((b) => !bands.includes(b)) ||
    dModels.length !== models.length || dModels.some((m) => !models.includes(m)) ||
    dSeries.length !== series.length || dSeries.some((x) => !series.includes(x));
  const draftCount = dModels.length + dSeries.length + dBands.length;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const match = (label: string) => !q || label.toLowerCase().includes(q.trim().toLowerCase());
  /* Search runs across every tab, so a hit in another tab still shows. */
  const hits = {
    model: MODELS.filter((m) => match(m.label)).length,
    series: allSeries.filter(match).length,
    price: BANDS.filter((b) => match(b.label)).length,
  };

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
            {/* One pill: open the sheet on the left, and — once anything is
                applied — clear it all from the right, behind a hairline. */}
            <span className={'catchip catchip--filters' + (extraCount ? ' is-on' : '')}>
              <button type="button" className="catchip__open" onClick={() => openFilters()}>
                <IconSliders size={15} />
                Filters{extraCount ? ` (${extraCount})` : ''}
                {extraCount ? <IconCaretDown size={13} /> : <IconChevronDown size={14} />}
              </button>
              {extraCount > 0 && (
                <button type="button" className="catchip__clear" onClick={clearAll}>
                  Clear
                </button>
              )}
            </span>
            <button
              className={'catchip' + (sort !== 'featured' ? ' is-on' : '')}
              type="button"
              onClick={() => setSheet('sort')}
            >
              <IconSortArrows size={15} />
              {sort === 'featured' ? 'Sort' : sortLabel.replace(/ \(.*/, '')}
              <IconChevronDown size={14} />
            </button>
            <button className={'catchip' + (bands.length ? ' is-on' : '')} type="button" onClick={() => openFilters('price')}>
              {bands.length ? bandLabel : 'Price'}
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

      <Sheet
        open={sheet === 'sort'}
        onClose={() => setSheet(null)}
        panelClass="sheet__panel--sort"
        /* The close rides on the panel itself, so it sits just above it
           whatever height the list makes the sheet. */
        header={
          <>
            <button type="button" className="ssheet__x" aria-label="Close" onClick={() => setSheet(null)}>
              <IconClose size={19} />
            </button>
            <h2 className="ssheet__title">Sort by</h2>
          </>
        }
      >
        <div className="ssheet" role="radiogroup" aria-label="Sort by">
          {SORTS.map((o) => {
            const on = sort === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={'srow' + (on ? ' is-on' : '')}
                onClick={() => {
                  setSort(o.id);
                  setSheet(null);
                }}
              >
                <i className="srow__r" aria-hidden="true" />
                {o.label}
              </button>
            );
          })}
        </div>
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
        panelClass="sheet__panel--filters"
        float={
          <button type="button" className="fsheet__x" aria-label="Close" onClick={() => setSheet(null)}>
            <IconClose size={19} />
          </button>
        }
        header={<h2 className="fsheet__title">Filters</h2>}
        footer={
          <div className="fsheet__foot">
            <Button
              variant="outline"
              block
              disabled={draftCount === 0}
              onClick={() => {
                setDModels([]);
                setDSeries([]);
                setDBands([]);
              }}
            >
              Clear Filter
            </Button>
            <Button
              variant="primary"
              block
              disabled={!draftDirty}
              onClick={() => {
                setModels(dModels);
                setSeries(dSeries);
                setBands(dBands);
                setSheet(null);
              }}
            >
              Apply
            </Button>
          </div>
        }
      >
        <label className="fsheet__search">
          <IconSearch size={18} />
          <input type="search" placeholder="Search across filters..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        <div className="fsheet__box">
          <div className="fsheet__tabs" role="tablist">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={'fsheet__tab' + (tab === t.id ? ' is-on' : '') + (q && !hits[t.id] ? ' is-dim' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="fsheet__opts" role="tabpanel">
            {tab === 'model' &&
              MODELS.filter((m) => match(m.label)).map((m) => {
                const on = dModels.includes(m.id);
                const n = all.filter((p) => (p.glb ? '3d' : 'regular') === m.id).length;
                return (
                  <button key={m.id} type="button" className="fopt" aria-pressed={on} onClick={() => setDModels((c) => toggle(c, m.id))}>
                    <span className="grow">
                      {m.label} <em>({n})</em>
                    </span>
                    <i className={'fbox' + (on ? ' is-on' : '')} aria-hidden="true">{on && <IconCheck size={13} />}</i>
                  </button>
                );
              })}

            {tab === 'series' &&
              allSeries.filter(match).map((x) => {
                const on = dSeries.includes(x);
                return (
                  <button key={x} type="button" className="fopt" aria-pressed={on} onClick={() => setDSeries((c) => toggle(c, x))}>
                    <span className="grow">
                      {x} <em>({all.filter((p) => p.series.startsWith(x)).length})</em>
                    </span>
                    <i className={'fbox' + (on ? ' is-on' : '')} aria-hidden="true">{on && <IconCheck size={13} />}</i>
                  </button>
                );
              })}

            {tab === 'price' &&
              BANDS.filter((b) => match(b.label)).map((b) => {
                const on = dBands.includes(b.id);
                return (
                  <button key={b.id} type="button" className="fopt" aria-pressed={on} onClick={() => setDBands((c) => toggle(c, b.id))}>
                    <span className="grow">
                      {b.label} <em>({all.filter(b.match).length})</em>
                    </span>
                    <i className={'fbox' + (on ? ' is-on' : '')} aria-hidden="true">{on && <IconCheck size={13} />}</i>
                  </button>
                );
              })}

            {q && !hits[tab] && <p className="fsheet__none">No matches in {FILTER_TABS.find((t) => t.id === tab)?.label}</p>}
          </div>
        </div>
      </Sheet>
    </>
  );
}
