import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate, useParams } from 'react-router-dom';
import { AGE_RATING, BADGE_TONE, CARS, ETA_MINS, productById, rupees, type Product as ProductT } from '../data/catalog';
import { useStore } from '../store/useStore';
import { createProductViewer, type ViewerHandle } from '../lib/three/productViewer';
import {
  IconAR,
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconCube,
  IconFlag,
  IconHeart,
  IconMinus,
  IconPlus,
  IconReplace,
  IconRotate,
  IconSearch,
  IconShare,
  IconStar,
} from '../design/elements/Icons';
import { ProductCard } from '../design/components/ProductCard';
import { SectionHeader } from '../design/components/Chrome';
import { useToast } from '../App';

/** Blinkit's PDP opens as a sheet: dismiss chevron left, utilities right, no title. */
function SheetHeader({
  onClose,
  onShare,
  saved,
  onSave,
}: {
  onClose: () => void;
  onShare: () => void;
  saved?: boolean;
  onSave?: () => void;
}) {
  return (
    <header className="shdr">
      <button className="shdr__ic" type="button" aria-label="Close" onClick={onClose}>
        <IconChevronDown size={22} />
      </button>
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
  return (
    <div className={`pdppeek pdppeek--${side}`} aria-hidden="true">
      <div className="pdppeek__stage">
        <img src={product.image} alt="" />
      </div>
      <div className="pdppeek__body">
        <p className="pdppeek__nm">{product.name}</p>
        <p className="pdppeek__pr">{rupees(product.price)}</p>
      </div>
    </div>
  );
}

/** Past this fraction of the width, letting go commits to the neighbour. */
const COMMIT = 0.26;
/** Movement before the gesture decides whether it is a scroll or a flick. */
const SLOP = 10;
const GLIDE_MS = 260;

export default function Product() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const selectCar = useStore((s) => s.selectCar);
  const racesLeft = useStore((s) => s.racesLeft);
  const add = useStore((s) => s.add);
  const setQty = useStore((s) => s.setQty);
  const qty = useStore((s) => s.cart[id] ?? 0);
  const saved = useStore((s) => s.saved.includes(id));
  const toggleSaved = useStore((s) => s.toggleSaved);
  const product = productById(id, mysteryUnlocked);

  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle | null>(null);
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** 0 = interactive 3D, 1 = studio photo. Only shown when both genuinely exist. */
  const [view, setView] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const specRef = useRef<HTMLDivElement>(null);

  /* ---- the deck ---------------------------------------------------- */
  const deck = useMemo(() => CARS.filter((c) => !c.mystery), []);
  const at = deck.findIndex((c) => c.id === id);
  const next = deck[at < 0 ? 0 : (at + 1) % deck.length];
  const prev = deck[at < 0 ? deck.length - 1 : (at - 1 + deck.length) % deck.length];

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
  const raf = useRef(0);
  const [gliding, setGliding] = useState(false);
  const grab = useRef<{ x: number; y: number; axis: 'undecided' | 'x' | 'y' } | null>(null);

  const paint = useCallback(() => {
    raf.current = 0;
    document.documentElement.style.setProperty('--pdp-dx', `${dx.current}px`);
  }, []);

  const setDx = useCallback(
    (v: number) => {
      dx.current = v;
      if (!raf.current) raf.current = requestAnimationFrame(paint);
    },
    [paint],
  );

  /** Slide the deck out and land on `to`. */
  const go = useCallback(
    (to: string, dir: -1 | 1) => {
      setGliding(true);
      setDx(dir * -window.innerWidth);
      window.setTimeout(() => {
        nav(`/hot-wheels/${to}`, { replace: true });
      }, GLIDE_MS);
    },
    [nav, setDx],
  );

  /* A new product means a new sheet: drop the drag, stop gliding, and start at
     the top rather than wherever the previous product was scrolled to. */
  useEffect(() => {
    setGliding(false);
    dx.current = 0;
    /* Written directly, not scheduled: a queued frame may never arrive (a
       backgrounded tab does not run rAF) and the sheet would stay parked
       off-screen. */
    paint();
    setView(0);
    setDetailsOpen(false);
    window.scrollTo(0, 0);
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
      if (Math.abs(ddx) < SLOP && Math.abs(ddy) < SLOP) return;
      /* Committed for the rest of the gesture. Re-deciding mid-drag makes the
         page snatch sideways halfway through a scroll. */
      g.axis = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (g.axis !== 'x') return;
    setDx(ddx);
  };

  const onUp = () => {
    const g = grab.current;
    grab.current = null;
    if (!g || g.axis !== 'x') return;
    const far = window.innerWidth * COMMIT;
    const at = dx.current;
    if (at < -far) go(next.id, 1);
    else if (at > far) go(prev.id, -1);
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

  const off = product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
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

  return (
    <>
      {/* The neighbours ride in a fixed layer pinned to the app column, so the
          right-hand sliver stays put while the current sheet scrolls. */}
      <div className="pdpstack">
        {/* The window stays put; only the track inside it moves. Translating
            the window itself dragged its own clip rect along, so the arriving
            sheet was cut off at exactly the edge it was travelling towards. */}
        <div className={'pdpstack__track' + (gliding ? ' is-gliding' : '')}>
          <PeekSheet product={prev} side="prev" />
          <PeekSheet product={next} side="next" />
        </div>
      </div>
      <button
        className="pdpstack__tap"
        type="button"
        aria-label={`Next product: ${next.name}`}
        onClick={() => go(next.id, 1)}
      />

      <div
        className={'pdpdeck' + (gliding ? ' is-gliding' : '')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <SheetHeader onClose={() => nav(-1)} onShare={share} saved={saved} onSave={() => toggleSaved(product.id)} />

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
                    <span className="spin" />
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
                <button
                  className="pdp__ar"
                  type="button"
                  onClick={() => {
                    selectCar(product.id);
                    nav(`/ar/${product.id}?mode=inspect&go=1`);
                  }}
                >
                  <IconAR size={16} />
                  View in your space
                </button>
                {ready && <p className="pdp__hint">DRAG TO ROTATE · PINCH TO ZOOM</p>}
              </>
            ) : (
              <img src={product.image} alt={product.name} />
            )}
          </div>

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

          <div className="pdp__chips">
            <div className="chipbox">
              <span>Age Group</span>
              <b>{product.age ?? AGE_RATING}</b>
            </div>
            <div className="chipbox">
              <span>Assembly Required</span>
              <b>No</b>
            </div>
            <div className="chipbox">
              <span>Material</span>
              <b>Diecast</b>
            </div>
            <button
              className="chipbox chipbox--cta"
              type="button"
              onClick={() => {
                setDetailsOpen(true);
                // let the block expand before scrolling to where it now ends up
                requestAnimationFrame(() =>
                  specRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                );
              }}
            >
              View details
            </button>
          </div>

          <section className="card pdp__info">
            <div className="pdp__tags">
              <span className="tag tag--blue">Limited Drop</span>
              {product.badge && <span className={`tag tag--${BADGE_TONE[product.badge]}`}>{product.badge}</span>}
              {product.rating && (
                <span className="pdp__rate">
                  <IconStar size={12} />
                  <b>{product.rating}</b>
                  <span>{product.ratings}</span>
                </span>
              )}
            </div>

            <h1 className="pdp__name">{product.name}</h1>
            <p className="pdp__unit">{product.unit}</p>

            <div className="pdp__price">
              <b>{rupees(product.price)}</b>
              {product.mrp && <s>{rupees(product.mrp)}</s>}
              {off > 0 && <span className="pdp__off">{off}% OFF</span>}
            </div>
            <p className="pdp__tax">Inclusive of all taxes</p>

            <p className="pdp__eta">
              <IconBolt size={14} />
              Delivery in {ETA_MINS} minutes
            </p>
          </section>

          <button className="card rowcard" type="button" onClick={() => nav('/hot-wheels')}>
            <span className="rowcard__brand">
              <img src="/brand/hot-wheels.svg" alt="" />
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
                nav('/race');
              }}
            >
              <span className="rowcard__ic rowcard__ic--flame">
                <IconFlag size={21} />
              </span>
              <span className="grow">
                <b>Race this car</b>
                <small>{racesLeft} races left today · win Blinkit Cash</small>
              </span>
              <IconChevronRight size={18} />
            </button>
          )}

          <div className="card rowcard rowcard--static">
            <span className="rowcard__ic">
              <IconReplace size={23} />
            </span>
            <span className="grow">
              <b>72 hours only replacement</b>
              <small>Damaged or wrong item? We&rsquo;ll swap it.</small>
            </span>
          </div>

          <div className="card pdpspec" ref={specRef}>
            <button
              className="pdpspec__h"
              type="button"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <span className="grow">Product details</span>
              <span className={'pdpspec__chev' + (detailsOpen ? ' is-open' : '')}>
                <IconChevronDown size={18} />
              </span>
            </button>
            {detailsOpen && (
              <dl className="pdpspec__list">
                {[
                  ['Scale', '1:64 die-cast'],
                  ['Series', product.series],
                  ['Unit', product.unit],
                  ['Age group', product.age ?? AGE_RATING],
                  ['Assembly required', 'No'],
                  ['Material', 'Diecast'],
                  ['Playable in 3D & AR', product.glb ? 'Yes' : 'No'],
                  ['Seller', 'Mattel Toys India'],
                  ['Country of origin', 'India'],
                  ['Marketed by', 'Mattel Toys (India) Pvt. Ltd.'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Inside a white card, like every other block on this page. The card
              panels are tinted, and this page's ground is the same tint — on
              the bare page they had nothing to read against. */}
          <section className="card pdptop">
            <SectionHeader title="Top products in this category" action="See all" onAction={() => nav('/hot-wheels')} />
            <div className="prail">
              {alsoLike.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </main>

        <div className="actionbar">
          <div>
            <p className="t-xs">{product.unit}</p>
            <b style={{ fontSize: 'var(--f-lg)', fontWeight: 800 }} className="t-num">
              {rupees(product.price)}
            </b>
          </div>
          {qty === 0 ? (
            <Button variant="primary" size="lg" className="grow"
              type="button"
              onClick={() => {
                add(product.id);
                toast('Added to cart');
              }}
            >
              Add to Cart
            </Button>
          ) : (
            <div className="row grow" style={{ gap: 10 }}>
              <div className="stepper stepper--lg" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label="Decrease quantity">
                  <IconMinus size={15} />
                </button>
                <span className="stepper__q">{qty}</span>
                <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label="Increase quantity">
                  <IconPlus size={15} />
                </button>
              </div>
              <Button variant="primary" size="lg" className="grow" type="button" onClick={() => nav('/cart')}>
                Go to Cart
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
