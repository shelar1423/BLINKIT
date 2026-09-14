import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate, useParams } from 'react-router-dom';
import { AGE_RATING, BADGE_TONE, CARS, ETA_MINS, productById, rupees, type Product as ProductT } from '../data/catalog';
import { useStore } from '../store/useStore';
import { useStartRace } from '../lib/useStartRace';
import { createProductViewer, type ViewerHandle } from '../lib/three/productViewer';
import {
  IconAR,
  IconChevronDown,
  IconClock,
  IconChevronRight,
  IconClose,
  IconCube,
  IconFlag,
  IconHeart,
  IconRotate,
  IconSearch,
  IconShare,
  IconStock,
} from '../design/elements/Icons';
import { ProductCard, Stars, Stepper } from '../design/components/ProductCard';
import { CartPill } from '../design/components/CartPill';
import { SectionHeader } from '../design/components/Chrome';
import { Sheet } from '../design/components/Sheet';
import { TrackRing } from '../design/components/DriftLoader';
import { useToast } from '../App';
import { useARSupport } from '../lib/useARSupport';

/** Blinkit's PDP opens as a sheet: dismiss chevron left, utilities right, no title. */
function SheetHeader({
  onClose,
  onShare,
  saved,
  onSave,
  title,
  solid,
}: {
  onClose: () => void;
  onShare: () => void;
  saved?: boolean;
  onSave?: () => void;
  title?: string;
  /** Scrolled: the header takes a ground of its own and names the product. */
  solid?: boolean;
}) {
  return (
    <header className={'shdr' + (solid ? ' is-solid' : '')}>
      <button className="shdr__ic" type="button" aria-label="Close" onClick={onClose}>
        <IconChevronDown size={22} />
      </button>
      {/* At the top the photo carries the page and the name is in the card
          below; once that has scrolled away the header has to say what you are
          looking at, which is what the real sheet does. */}
      <span className="shdr__t">{title}</span>
      <span className="grow" />
      <button
        className={'shdr__ic' + (saved ? ' is-on' : '')}
        type="button"
        aria-pressed={saved}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        onClick={onSave}
      >
        <IconHeart size={20} />
      </button>
      <button className="shdr__ic" type="button" aria-label="Search">
        <IconSearch size={20} />
      </button>
      <button className="shdr__ic" type="button" aria-label="Share" onClick={onShare}>
        <IconShare size={20} />
      </button>
    </header>
  );
}

/**
 * The sheet behind the current one.
 *
 * Blinkit's PDP is a deck, not a page: the next product is already there, a
 * sliver of it showing down the right edge, and you flick sideways to reach it
 * rather than going back to the list and in again. This is that sliver — a
 * real panel with the next product on it, so the drag reveals the product
 * rather than an empty white card that fills in after you let go.
 */
function PeekSheet({ product, side }: { product: ProductT; side: 'next' | 'prev' }) {
  const off = product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <div className={`pdppeek pdppeek--${side}`} aria-hidden="true">
      {/* Deliberately the real sheet's markup, not a summary of it. This panel
          was a car photo over a name and a price, which meant the moment a
          swipe started you were looking at a stripped-down placeholder that
          snapped into the full page on landing — the "glitch". Blinkit shows
          the actual next page travelling in, so this mirrors the sheet: same
          header, same stage, same chips, same card, same bar. */}
      <header className="shdr">
        <span className="shdr__ic"><IconChevronDown size={22} /></span>
        <span className="grow" />
        <span className="shdr__ic"><IconHeart size={20} /></span>
        <span className="shdr__ic"><IconSearch size={20} /></span>
        <span className="shdr__ic"><IconShare size={20} /></span>
      </header>

      <div className="pdppeek__scroll">
        <div className="pdp__stage">
          <img src={product.image} alt="" />
        </div>

        <div className="pdp__herofoot">
        <div className="pdp__pager">
          <span className="pdp__dot is-on" />
          {product.glb && <span className="pdp__dot" />}
        </div>

        <div className="pdp__chips">
          <div className="chipbox">
            <span>Age Group</span>
            <b>{product.age ?? AGE_RATING}</b>
          </div>
          <div className="chipbox">
            <span>Material</span>
            <b>Diecast</b>
          </div>
          <div className="chipbox">
            <span>Scale</span>
            <b>1:64</b>
          </div>
          <span className="chipbox chipbox--cta">View details</span>
        </div>
        </div>

        <section className="card pdp__info">
          <div className="pdp__meta">
            <span className="pdp__eta">
              <IconClock size={13} />
              {ETA_MINS} mins
            </span>
            {product.rating && (
              <>
                <i className="pdp__sep" />
                <span className="pdp__rate">
                  <Stars value={product.rating} size={13} />
                  <span>{product.ratings?.toLocaleString('en-IN')}</span>
                </span>
              </>
            )}
            <span className="pdp__tags">
              <span className="tag tag--blue">Limited Drop</span>
            </span>
          </div>
          <h2 className="pdp__name">{product.name}</h2>
          <p className="pdp__unit">{product.unit}</p>
          <div className="pdp__price">
            <b>{rupees(product.price)}</b>
            {product.mrp && (
              <span className="pdp__mrp">
                MRP <s>{rupees(product.mrp)}</s>
              </span>
            )}
          </div>
        </section>

        <div className="card rowcard rowcard--static">
          <span className="rowcard__brand">
            <img src="/brand/hot-wheels-logo.webp" alt="" />
          </span>
          <span className="grow">
            <b>Hot Wheels</b>
            <small>Explore all products</small>
          </span>
          <IconChevronRight size={18} />
        </div>
      </div>

      <div className="actionbar">
        <div className="ab__price">
          <p className="ab__unit">{product.unit}</p>
          <p className="ab__amt">
            <b className="t-num">{rupees(product.price)}</b>
            {product.mrp && (
              <span className="pdp__mrp">
                MRP <s>{rupees(product.mrp)}</s>
              </span>
            )}
          </p>
          <p className="ab__tax">Inclusive of all taxes</p>
        </div>
        <span className="btn btn--primary btn--lg grow">Add to Cart</span>
      </div>
      {off > 0 ? null : null}
    </div>
  );
}

/** Past this fraction of the width, letting go commits to the neighbour. */
const COMMIT = 0.26;
/** Movement before the gesture decides whether it is a scroll or a flick. */
const SLOP = 6;
/* How much one axis has to lead the other before the gesture commits to it.
   A real sideways flick on a phone is never level — it arcs, and by 10px of
   travel it has usually drifted as far down as it has gone across. Comparing
   the two deltas outright therefore sent most honest swipes to the scroller.
   Horizontal only has to be within about 50 degrees of level to win; vertical
   has to clearly lead, so an actual scroll is never stolen. */
const X_BIAS = 0.8;
const Y_BIAS = 1.6;
/* Matches .pdpdeck.is-gliding. ~180ms of deceleration is what the recording
   shows once the finger leaves. */
const GLIDE_MS = 190;

export default function Product() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const startRace = useStartRace();
  const { toast } = useToast();
  /* null while the check is in flight — treated as yes, so the AR route never
     flickers in after a frame of saying 3D. */
  const arOk = useARSupport() !== false;
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const selectCar = useStore((s) => s.selectCar);
  const add = useStore((s) => s.add);
  const setQty = useStore((s) => s.setQty);
  const qty = useStore((s) => s.cart[id] ?? 0);
  const saved = useStore((s) => s.saved.includes(id));
  const toggleSaved = useStore((s) => s.toggleSaved);
  const markViewed = useStore((s) => s.markViewed);
  const product = productById(id, mysteryUnlocked);

  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle | null>(null);
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** 0 = interactive 3D, 1 = studio photo. Only shown when both genuinely exist. */
  const [view, setView] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(true);

  /* ---- the deck ---------------------------------------------------- */
  const deck = useMemo(() => CARS.filter((c) => !c.mystery), []);
  /* The deck has ends. Wrapping it meant the first car showed a sliver of the
     last one on its left, which says there is something behind you when there
     is not — and the real deck simply has no sliver on that side. A car at
     either end gives its edge back to the sheet. */
  const at = Math.max(0, deck.findIndex((c) => c.id === id));
  const next = at < deck.length - 1 ? deck[at + 1] : null;
  const prev = at > 0 ? deck[at - 1] : null;

  /* The drag is driven straight onto the DOM rather than through state. A
     setState per pointermove is a React render per frame of a gesture that is
     only ever moving one transform, and it showed: the sheet stepped across
     instead of sliding. State is only used for the resting/gliding flags.

     The offset is written ONCE, as a custom property on the root, and both the
     sheet and the peek layer read it. They were being written as two separate
     inline transforms, which is two chances to disagree — and they did: a frame
     where the peek layer had moved and the sheet had not slid the neighbouring
     car across the current one. One writer and two readers cannot desync. */
  const dx = useRef(0);
  const [gliding, setGliding] = useState(false);
  const grab = useRef<{ x: number; y: number; axis: 'undecided' | 'x' | 'y' } | null>(null);

  /* Written straight through, not scheduled on a frame.
     rAF batching is for work that must not run twice in a frame — but this is
     one custom-property assignment, and the style recalc it triggers happens
     once at frame time however many times the value was overwritten. So the
     batching bought nothing and cost two real things: a frame of latency on
     every drag, and a hard dependency on rAF running at all. It does not in a
     backgrounded or hidden document, where the offset would then be read as
     stale while the gesture itself carried on. */
  const paint = useCallback(() => {
    document.documentElement.style.setProperty('--pdp-dx', `${dx.current}px`);
  }, []);

  const setDx = useCallback(
    (v: number) => {
      dx.current = v;
      paint();
    },
    [paint],
  );

  /* One page of travel: the sheet's own width plus the backdrop showing beside
     it. It used to be the viewport width, which is neither — the sheet is
     narrower than the screen and the gap is real, so the deck landed a little
     under a page short and the neighbour arrived already slightly off its
     mark. Measured rather than computed from tokens so it stays right at any
     column width. */
  /* The sheet gives up its inset once you leave the top.
     Traced off a screen recording: the gutters walk outward and are gone by
     120ms, the sheet's top edge goes from 62.7pt to the very top of the
     screen, and the neighbours go with them — scrolled, a product page is the
     whole screen. Coming back up it re-insets in about 70ms. A little
     hysteresis so a one-pixel jitter at the top cannot flap it. */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const read = () => {
      const y = window.scrollY;
      setWide((w) => (w ? y > 4 : y > 14));
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    return () => window.removeEventListener('scroll', read);
  }, [id]);

  const deckEl = useRef<HTMLDivElement>(null);
  const step = useCallback(() => {
    const el = deckEl.current;
    const gap =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pdp-gap')) || 0;
    return (el ? el.getBoundingClientRect().width : window.innerWidth) + gap;
  }, []);

  /** Slide the deck out and land on `to`. */
  const go = useCallback(
    (to: string, dir: -1 | 1) => {
      setGliding(true);
      setDx(dir * -step());
      window.setTimeout(() => {
        nav(`/hot-wheels/${to}`, { replace: true });
      }, GLIDE_MS);
    },
    [nav, setDx, step],
  );

  /* A new product means a new sheet: drop the drag, stop gliding, and start at
     the top rather than wherever the previous product was scrolled to. */
  /* Recorded on arrival, and read BEFORE this effect runs, so the chip reflects
     whether you had opened this car on an earlier visit rather than lighting up
     the instant you land on it. */
  useEffect(() => {
    markViewed(id);
  }, [id, markViewed]);

  useEffect(() => {
    setGliding(false);
    dx.current = 0;
    paint();
    setView(0);
    setDetailsOpen(false);
    window.scrollTo(0, 0);

    /* Land instantly. The glide that brought us here leaves a transition in
       flight, and without this the new sheet animates in from wherever the old
       one was sent — so for a beat you are looking at the product you just
       swiped away, sitting off-centre. Suppressed for one frame, which is all
       the reset needs. */
    const root = document.documentElement;
    root.classList.add('pdp-snap');
    const id2 = window.setTimeout(() => root.classList.remove('pdp-snap'), 60);
    return () => {
      window.clearTimeout(id2);
      root.classList.remove('pdp-snap');
    };
  }, [id, paint]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--pdp-dx');
    },
    [],
  );

  /* Places inside the sheet that own a horizontal gesture of their own. The 3D
     viewer binds its own pointer handlers to rotate the model, and the chip row
     and the recommendation rail are both scrollers — a drag that starts in any
     of them was driving that control AND sliding the whole deck at the same
     time, which is what made the swipe feel like it was fighting back. */
  const OWNS_GESTURE = '.pdp__stage, .pdp__chips, .prail, .actionbar';

  const onDown = (e: React.PointerEvent) => {
    if (gliding || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as Element | null)?.closest?.(OWNS_GESTURE)) return;
    grab.current = { x: e.clientX, y: e.clientY, axis: 'undecided' };
  };

  const onMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (g.axis === 'undecided') {
      const ax = Math.abs(ddx);
      const ay = Math.abs(ddy);
      if (ax < SLOP && ay < SLOP) return;
      /* Committed for the rest of the gesture. Re-deciding mid-drag makes the
         page snatch sideways halfway through a scroll. Staying undecided while
         neither axis leads is deliberate: the alternative is committing on the
         first pixel of an arc, which is what made a sideways flick scroll. */
      if (ax >= ay * X_BIAS) g.axis = 'x';
      else if (ay > ax * Y_BIAS) g.axis = 'y';
      else return;
    }
    if (g.axis !== 'x') return;
    setDx(ddx);
  };

  const onUp = () => {
    const g = grab.current;
    grab.current = null;
    if (!g || g.axis !== 'x') return;
    const far = step() * COMMIT;
    const at = dx.current;
    if (at < -far && next) go(next.id, 1);
    else if (at > far && prev) go(prev.id, -1);
    else {
      setGliding(true);
      setDx(0);
      window.setTimeout(() => setGliding(false), GLIDE_MS);
    }
  };

  useEffect(() => {
    if (!product?.glb || !host.current) return;
    setReady(false);
    setErr(null);
    setPct(0);
    const v = createProductViewer(host.current, product.glb, {
      onProgress: (p) => setPct(p < 0 ? 0 : p),
      onReady: () => setReady(true),
      onError: (m) => setErr(m),
    });
    viewer.current = v;
    return () => {
      v.dispose();
      viewer.current = null;
    };
  }, [product?.glb]);

  if (!product) {
    return (
      <>
        <SheetHeader onClose={() => nav('/hot-wheels')} onShare={() => {}} />
        <main className="page">
          <div className="empty">
            <p>We couldn&rsquo;t find that product.</p>
            <Button variant="dark" type="button" onClick={() => nav('/hot-wheels')}>
              Back to Hot Wheels
            </Button>
          </div>
        </main>
      </>
    );
  }

  const has3D = Boolean(product.glb);
  const alsoLike = CARS.filter((c) => c.id !== product.id && !c.mystery).slice(0, 6);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const cartControl = (
    <>
      {qty === 0 ? (
        <Button variant="primary" size="lg" className="grow"
          type="button"
          /* No toast. The cart bar rising into the sheet says the same
             thing in the same place, and the two used to overlap. */
          onClick={() => add(product.id)}
        >
          Add to cart
        </Button>
      ) : (
        /* One control, not two. Adding swaps what is inside the box; it
           does not shrink the box and stand a second button next to it.
           Measured off the recording: the control is 33.8% of the sheet's
           width both before and after, so the stepper simply inherits the
           slot the button was occupying. There is no "Go to Cart" here —
           the cart bar above already is that. */
        <Stepper
          qty={qty}
          size="lg"
          className="grow"
          label="Quantity"
          onDec={() => setQty(product.id, qty - 1)}
          onInc={() => setQty(product.id, qty + 1)}
        />
      )}
    </>
  );

  return (
    <>
      {/* The neighbours ride in a fixed layer pinned to the app column, so the
          right-hand sliver stays put while the current sheet scrolls. */}
      <div className={'pdpstack' + (wide ? ' is-wide' : '')}>
        {/* The window stays put; only the track inside it moves. Translating
            the window itself dragged its own clip rect along, so the arriving
            sheet was cut off at exactly the edge it was travelling towards. */}
        <div className={'pdpstack__track' + (gliding ? ' is-gliding' : '')}>
          {prev && <PeekSheet product={prev} side="prev" />}
          {next && <PeekSheet product={next} side="next" />}
        </div>
      </div>
      {next && (
        <button
          className="pdpstack__tap"
          type="button"
          aria-label={`Next product: ${next.name}`}
          onClick={() => go(next.id, 1)}
        />
      )}

      <div
        ref={deckEl}
        className={'pdpdeck' + (wide ? ' is-wide' : '') + (gliding ? ' is-gliding' : '') + (prev ? '' : ' pdpdeck--first') + (next ? '' : ' pdpdeck--last')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <SheetHeader
          onClose={() => nav(-1)}
          onShare={share}
          saved={saved}
          onSave={() => toggleSaved(product.id)}
          title={product.name}
          solid={wide}
        />

        <main className="page page--flush pdp">
          {/* White, with the car standing on its own soft shadow — the same
              studio treatment Blinkit gives every product, rather than a lit
              set that only suits the five rendered cars. */}
          <div className="pdp__stage">
            {has3D && view === 0 ? (
              <>
                <div className="pdp__3d" ref={host} />
                {!ready && !err && (
                  <div className="loadbox" style={{ position: 'absolute', inset: 0 }}>
                    <TrackRing className="trackload trackload--sm" />
                    <p>Getting your car ready… {pct > 0 ? `${pct}%` : ''}</p>
                  </div>
                )}
                {err && (
                  <div className="loadbox" style={{ position: 'absolute', inset: 0 }}>
                    <p>{err}</p>
                    <img src={product.image} alt={product.name} style={{ maxWidth: '70%' }} />
                  </div>
                )}
                <span className="pdp__flag">
                  <IconCube size={11} /> 3D &amp; AR
                </span>
                <div className="pdp__tools">
                  <button className="pdp__tool" type="button" aria-label="Reset view" onClick={() => viewer.current?.reset()}>
                    <IconRotate size={17} />
                  </button>
                </div>
                {ready && <p className="pdp__hint">DRAG TO ROTATE · PINCH TO ZOOM</p>}
              </>
            ) : (
              <img src={product.image} alt={product.name} />
            )}
          </div>

          <div className="pdp__herofoot">
          {/* Two real views — the interactive model and the studio shot. No filler
              dots: a car without a GLB has one image and gets no pager. */}
          {has3D && (
            <div className="pdp__pager" role="tablist" aria-label="Product views">
              {['3D model', 'Photo'].map((label, i) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={view === i}
                  aria-label={label}
                  className={'pdp__dot' + (view === i ? ' is-on' : '')}
                  type="button"
                  onClick={() => setView(i)}
                />
              ))}
            </div>
          )}

          {/* Three items, not four. "Assembly Required: No" is true of every
              die-cast we sell, and carrying it pushed the row 30px wider than
              the sheet — which put View details 18px PAST the corner with no
              gutter at all. The real PDP shows two facts and the link. */}
          {/* Its own row under the image rather than a pill floating over the
              corner of the photograph. It is the one thing this product does
              that no other listing does, and parked on the artwork it read as
              a watermark — half on the car, competing with the reset control
              opposite it, and clipped by the stage on a short screen. */}
          {has3D && (
            <button
              className="pdp__arrow"
              type="button"
              onClick={() => {
                if (!arOk) {
                  toast('This device does not support AR. Showing the 3D view.');
                  viewer.current?.reset();
                  return;
                }
                selectCar(product.id);
                nav(`/ar/${product.id}?mode=inspect&go=1`);
              }}
            >
              <span className="pdp__arrow-ic">{arOk ? <IconAR size={17} /> : <IconCube size={17} />}</span>
              <span className="grow">
                <b>{arOk ? 'View in your space' : 'View in 3D'}</b>
                <small>{arOk ? 'Stand it on your desk at true scale' : 'Spin it and zoom in'}</small>
              </span>
              <IconChevronRight size={17} />
            </button>
          )}

          <div className="pdp__chips">
            <div className="chipbox">
              <span>Age Group</span>
              <b>{product.age ?? AGE_RATING}</b>
            </div>
            <div className="chipbox">
              <span>Material</span>
              <b>Diecast</b>
            </div>
            <div className="chipbox">
              <span>Scale</span>
              <b>1:64</b>
            </div>
            <button
              className="chipbox chipbox--cta"
              type="button"
              onClick={() => setDetailsOpen(true)}
            >
              View details
            </button>
          </div>
          </div>

          {/* Blinkit leads the card with how fast it lands and how it is rated —
              the two facts that decide the purchase — then the name, the pack
              and the price. The drop tags moved onto the stage: on the real PDP
              this first row is the ETA and the stars, nothing else. */}
          <section className="card pdp__info">
            <div className="pdp__meta">
              <span className="pdp__eta">
                <IconClock size={13} />
                {ETA_MINS} mins
              </span>
              {product.rating && (
                <>
                  <i className="pdp__sep" aria-hidden="true" />
                  <span className="pdp__rate">
                    <Stars value={product.rating} size={13} />
                    <span>{product.ratings?.toLocaleString('en-IN')}</span>
                  </span>
                </>
              )}
              {/* The campaign's own flags. The real PDP leaves the right of this
                  row empty, so they cost no extra line. */}
              <span className="pdp__tags">
                <span className="tag tag--blue">Limited Drop</span>
                {product.badge && <span className={`tag tag--${BADGE_TONE[product.badge]}`}>{product.badge}</span>}
              </span>
            </div>

            <h1 className="pdp__name">{product.name}</h1>

            <p className="pdp__unit">
              {product.unit}
              {product.stock ? (
                <>
                  <i className="pdp__sep" aria-hidden="true" />
                  <span className="pdp__stock">
                    <IconStock size={13} />
                    {product.stock} left
                  </span>
                </>
              ) : null}
            </p>

            <div className="pdp__price">
              <b>{rupees(product.price)}</b>
              {product.mrp && (
                <span className="pdp__mrp">
                  MRP <s>{rupees(product.mrp)}</s>
                </span>
              )}
            </div>
          </section>

          <button className="card rowcard" type="button" onClick={() => nav('/hot-wheels')}>
            <span className="rowcard__brand">
              <img src="/brand/hot-wheels-logo.webp" alt="" />
            </span>
            <span className="grow">
              <b>Hot Wheels</b>
              <small>Explore all products</small>
            </span>
            <IconChevronRight size={18} />
          </button>

          {has3D && (
            <button
              className="card rowcard"
              type="button"
              onClick={() => {
                selectCar(product.id);
                startRace();
              }}
            >
              <span className="rowcard__ic rowcard__ic--flame">
                <IconFlag size={21} />
              </span>
              <span className="grow">
                <b>Race this car</b>
                <small>Win rewards</small>
              </span>
              <IconChevronRight size={18} />
            </button>
          )}

          {/* Bare icon, single line. On the real PDP the policy rows carry the
              glyph on the card itself — the tinted tile is for a brand or an
              action, and putting one here made a footnote look like a feature. */}
          <button
            className="card rowcard rowcard--policy"
            type="button"
            onClick={() => toast('Replacement details are out of scope for this prototype')}
          >
            <span className="rowcard__glyph">
              <img src="/brand/replacement.svg" alt="" width={26} height={26} />
            </span>
            <span className="grow">
              <b>72 hours only replacement</b>
            </span>
            <IconChevronRight size={18} />
          </button>

          {/* Inside a white card, like every other block on this page. The card
              panels are tinted, and this page's ground is the same tint — on
              the bare page they had nothing to read against. */}
          <section className="card pdptop">
            <SectionHeader title="Similar products" />
            <div className="prail">
              {alsoLike.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </main>

        {/* The bar and the cart shortcut are ONE sticky block inside the sheet,
            stacked. Both belong to this product's frame, not to the screen —
            on the real PDP they stop at the sheet's edges, and the shortcut
            arrives here exactly as it does on the storefront. */}
        <div className="pdpfoot">
          <CartPill />
          <div className="actionbar">
          {/* The price block reads the same as the card's, plus the tax line
              the real PDP keeps down here rather than in the card. */}
          <div className="ab__price">
            <p className="ab__unit">{product.unit}</p>
            <p className="ab__amt">
              <b className="t-num">{rupees(product.price)}</b>
              {product.mrp && (
                <span className="pdp__mrp">
                  MRP <s>{rupees(product.mrp)}</s>
                </span>
              )}
            </p>
            <p className="ab__tax">Inclusive of all taxes</p>
          </div>
          {cartControl}
          </div>
        </div>
      </div>
      {/* View details opens the full spec as a sheet over the product, the
          way the real PDP does, rather than a block further down the page. */}
      <Sheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Product details"
        panelClass="sheet__panel--pdd"
        float={
          <button type="button" className="pdd__x" aria-label="Close" onClick={() => setDetailsOpen(false)}>
            <IconClose size={19} />
          </button>
        }
        header={
          <div className="pdd__head">
            <img className="pdd__thumb" src={product.image} alt="" />
            <h2>{product.name}</h2>
          </div>
        }
        footer={
          <div className="actionbar pdd__foot">
            <div className="ab__price">
              <p className="ab__unit">{product.unit.split(' · ')[0]}</p>
              <p className="ab__amt"><b className="t-num">{rupees(product.price)}</b></p>
              <p className="ab__tax">Inclusive of all taxes</p>
            </div>
            {cartControl}
          </div>
        }
      >
        <div className="pdd">
          <p className="pdd__k">Highlights</p>
          <div className="pdd__chips">
            {[
              ['Age Group', product.age ?? AGE_RATING],
              ['BPA Free', 'No'],
              ['Assembly Required', 'No'],
              ['Material', 'Diecast'],
            ].map(([k, v]) => (
              <div key={k} className="chipbox">
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>

          <p className="pdd__k">All details</p>
          {[
            {
              title: 'Key Information',
              open: keyOpen,
              toggle: () => setKeyOpen((v) => !v),
              rows: [
                ['BPA Free', 'No'],
                ['Age Group', product.age ?? AGE_RATING],
                ['Assembly Required', 'No'],
                ['Series', product.series],
                ['Scale', '1:64 die-cast'],
                ['Mechanism', 'Push & Go'],
                ['Playable in 3D & AR', product.glb ? 'Yes' : 'No'],
              ],
            },
            {
              title: 'Info',
              open: infoOpen,
              toggle: () => setInfoOpen((v) => !v),
              rows: [
                ['Seller', 'Mattel Toys India'],
                ['Country of Origin', 'India'],
                ['Marketed by', 'Mattel Toys (India) Pvt. Ltd.'],
              ],
            },
          ].map((g) => (
            <div key={g.title} className="pdd__acc">
              <button type="button" className="pdd__acch" aria-expanded={g.open} onClick={g.toggle}>
                <span className="grow">{g.title}</span>
                <span className={'pdd__chev' + (g.open ? ' is-open' : '')}>
                  <IconChevronDown size={18} />
                </span>
              </button>
              {g.open && (
                <dl className="pdd__list">
                  {g.rows.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
