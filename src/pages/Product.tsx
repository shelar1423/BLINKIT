import { useEffect, useRef, useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate, useParams } from 'react-router-dom';
import { CARS, productById, rupees } from '../data/catalog';
import { useStore } from '../store/useStore';
import { createProductViewer, type ViewerHandle } from '../lib/three/productViewer';
import {
  IconAR,
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconBasket,
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
  IconTicket,
} from '../design/elements/Icons';
import { ProductCard } from '../design/components/ProductCard';
import { SectionHeader } from '../design/components/Chrome';
import { useToast } from '../App';

/** Blinkit's PDP opens as a sheet: dismiss chevron left, utilities right, no title. */
function SheetHeader({ onClose, onShare }: { onClose: () => void; onShare: () => void }) {
  return (
    <header className="shdr">
      <button className="shdr__ic" type="button" aria-label="Close" onClick={onClose}>
        <IconChevronDown size={22} />
      </button>
      <span className="grow" />
      <button className="shdr__ic" type="button" aria-label="Save to wishlist">
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
      <SheetHeader onClose={() => nav(-1)} onShare={share} />

      <main className="page page--flush pdp">
        <div className={'pdp__stage' + (has3D && view === 0 ? ' pdp__stage--garage' : '')}>
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
                  nav(`/ar/${product.id}?mode=inspect`);
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
            <b>3+ years</b>
          </div>
          <div className="chipbox">
            <span>Assembly Required</span>
            <b>No</b>
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
            {product.badge && <span className="tag tag--dark">{product.badge}</span>}
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
            Delivery in 8 minutes
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
              <IconFlag size={18} />
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
            <IconReplace size={18} />
          </span>
          <span className="grow">
            <b>72 hours only replacement</b>
            <small>Damaged or wrong item? We&rsquo;ll swap it.</small>
          </span>
        </div>

        {/* Blinkit puts a trust strip on every PDP — three claims about the
            service rather than the product, directly under the buying
            decision. */}
        <div className="card pdpwhy">
          <p className="pdpwhy__h">Why shop from Blinkit?</p>
          <div className="pdpwhy__row">
            <div>
              <span className="pdpwhy__ic"><IconBolt size={19} /></span>
              <b>Superfast delivery</b>
              <small>Get it in 8 minutes</small>
            </div>
            <div>
              <span className="pdpwhy__ic"><IconTicket size={19} /></span>
              <b>Best prices &amp; offers</b>
              <small>Direct from Mattel</small>
            </div>
            <div>
              <span className="pdpwhy__ic"><IconBasket size={19} /></span>
              <b>Wide assortment</b>
              <small>The full drop, in stock</small>
            </div>
          </div>
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
                ['Age group', '3+ years'],
                ['Assembly required', 'No'],
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

        <SectionHeader title="Top products in this category" action="See all" onAction={() => nav('/hot-wheels')} />
        <div className="prail">
          {alsoLike.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <p className="shell t-xs" style={{ padding: '16px var(--gut) 20px', lineHeight: 1.6 }}>
          Part of the Race It Home drop. Buying is independent of the game — you never need to race to own a car.
        </p>
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
    </>
  );
}
