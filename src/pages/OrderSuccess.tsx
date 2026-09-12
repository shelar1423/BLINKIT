import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { DELIVERY_ADDRESS, rupees } from '../data/catalog';
import { useStore } from '../store/useStore';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCollapse,
  IconExpand,
  IconPhone,
  IconShield,
} from '../design/elements/Icons';
import { useToast } from '../App';

/* ============================================================
   Order tracking.

   Blinkit's tracking screen is one green header carrying the ETA, a live map,
   and then a stack of cards led by the person actually bringing the order. The
   old screen here was a static hero image and a horizontal progress bar, which
   says the order exists but not where it is or who has it.

   The map is drawn, not embedded. A real map needs a keyed provider, and
   putting someone else's watermark on a hand-drawn one would be passing it off
   as theirs. So this is our own: roads, the route, the rider travelling it, and
   the destination — the information the screen is actually for.
   ============================================================ */

/** Whole trip, in seconds. Short enough to watch the rider finish. */
const TRIP = 96;
const PARTNER = 'Shekhar';

/** The route the rider takes. Also the shape of the drawn road under it. */
const ROUTE = 'M40 148 C 66 148, 74 126, 96 112 S 138 96, 176 88 S 244 78, 286 46';

export default function OrderSuccess() {
  const nav = useNavigate();
  const { toast } = useToast();
  const order = useStore((s) => s.order);

  /** 0..1 along the route. Drives the marker, the ETA and the status copy. */
  const [t, setT] = useState(0.06);
  const [big, setBig] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const path = useRef<SVGPathElement>(null);
  const [pos, setPos] = useState({ x: 40, y: 148, a: 0 });

  useEffect(() => {
    if (!order) return;
    const started = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, 0.06 + (now - started) / 1000 / TRIP);
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [order]);

  /* Ride the marker along the real path rather than tweening between two
     points: the route bends, and a straight interpolation would cut corners
     across the roads it is meant to follow. */
  useEffect(() => {
    const p = path.current;
    if (!p) return;
    const len = p.getTotalLength();
    const at = p.getPointAtLength(len * t);
    // a point just ahead gives the heading, so the rider leans into the turns
    const nx = p.getPointAtLength(Math.min(len, len * t + 1));
    setPos({ x: at.x, y: at.y, a: (Math.atan2(nx.y - at.y, nx.x - at.x) * 180) / Math.PI });
  }, [t]);

  const minsLeft = Math.max(1, Math.ceil(((1 - t) * TRIP) / 60));
  const arrived = t >= 1;

  const TIPS = useMemo(() => [20, 30, 50], []);

  if (!order) {
    return (
      <main className="page">
        <div className="empty">
          <p>No recent order.</p>
          <Button variant="dark" type="button" onClick={() => nav('/')}>
            Back to home
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="page trk">
      {/* ---- the green bar: where the order is, and when it lands ---- */}
      <header className="trk__top">
        <button className="trk__back" type="button" aria-label="Back" onClick={() => nav('/')}>
          <IconChevronLeft size={22} />
        </button>
        <p className="trk__k">{arrived ? 'Order delivered' : 'Order is on the way'}</p>
        <h1 className="trk__eta">
          {arrived ? 'Enjoy your Hot Wheels' : `Arriving in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}`}
        </h1>
      </header>

      {/* ---- the map ---- */}
      <div className={'trk__mapwrap' + (big ? ' is-big' : '')}>
        <svg className="trk__map" viewBox="0 0 320 180" role="img" aria-label={`Rider ${PARTNER} on the way to you`}>
          <rect x="0" y="0" width="320" height="180" fill="#E9ECF0" />
          {/* blocks, so the empty ground reads as a neighbourhood */}
          <g fill="#DFE3E8">
            <rect x="12" y="16" width="70" height="46" rx="4" />
            <rect x="104" y="10" width="58" height="38" rx="4" />
            <rect x="196" y="92" width="72" height="52" rx="4" />
            <rect x="18" y="96" width="46" height="40" rx="4" />
            <rect x="118" y="128" width="62" height="42" rx="4" />
          </g>
          {/* roads */}
          <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
            <path d="M0 78 H320" strokeWidth="13" />
            <path d="M92 0 V180" strokeWidth="11" />
            <path d="M0 150 H320" strokeWidth="9" />
            <path d="M232 0 V180" strokeWidth="9" />
          </g>
          {/* the route, with the travelled part solid and the rest faded */}
          <path ref={path} d={ROUTE} fill="none" stroke="#B9C6DA" strokeWidth="5" strokeLinecap="round" />
          <path
            d={ROUTE}
            fill="none"
            stroke="#2B6DF6"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - t}
          />
          {/* destination */}
          <g transform="translate(286 46)">
            <circle r="11" fill="#fff" />
            <circle r="7.5" fill="none" stroke="#1F1F1F" strokeWidth="2" />
            <circle r="2.6" fill="#1F1F1F" />
          </g>
          {/* the rider */}
          <g transform={`translate(${pos.x} ${pos.y})`}>
            <circle r="14" fill="#fff" opacity="0.9" />
            <circle r="11" fill="var(--green)" />
            <g transform={`rotate(${pos.a})`}>
              <path d="M-4.5 1.5h6l2.5-3.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="-4.5" cy="2.5" r="2.4" fill="none" stroke="#fff" strokeWidth="1.6" />
              <circle cx="4.5" cy="2.5" r="2.4" fill="none" stroke="#fff" strokeWidth="1.6" />
            </g>
          </g>
        </svg>
        <button
          className="trk__zoom"
          type="button"
          aria-label={big ? 'Shrink map' : 'Expand map'}
          onClick={() => setBig((v) => !v)}
        >
          {big ? <IconCollapse size={17} /> : <IconExpand size={17} />}
        </button>
      </div>

      <div className="trk__body">
        {/* ---- the person bringing it ---- */}
        <section className="card trk__partner">
          <div className="trk__who">
            <span className="trk__face" aria-hidden="true">
              {/* Drawn rather than an asset: there is no photo of a delivery
                  partner in this project, and borrowing an unrelated reward
                  illustration for a person is worse than a plain avatar. */}
              <svg viewBox="0 0 48 48" width="46" height="46">
                <circle cx="24" cy="24" r="24" fill="#FFE0B2" />
                <circle cx="24" cy="19" r="8" fill="#8D5524" />
                <path d="M8 44c2-9 8-13 16-13s14 4 16 13z" fill="#C62828" />
                <path d="M16 15a8 8 0 0 1 16 0z" fill="#C62828" />
              </svg>
            </span>
            <h2 className="trk__name">
              I&rsquo;m {PARTNER}, your delivery partner
            </h2>
            <button
              className="trk__call"
              type="button"
              aria-label={`Call ${PARTNER}`}
              onClick={() => toast('Calling is out of scope for this prototype')}
            >
              <IconPhone size={19} />
            </button>
          </div>

          <p className="trk__said">
            {arrived
              ? 'I have handed over your order. Thanks for ordering!'
              : 'I have picked up your order, and I am on the way to your location'}
          </p>

          {/* ---- tip ---- */}
          <div className="trk__tip">
            <div className="grow">
              <b className="trk__tipt">Delivering happiness at your doorstep!</b>
              <span className="trk__tips">Thank them by leaving a tip</span>
            </div>
            <img className="trk__tipart" src="/decor/26-08-grocery-pickup-sparkle.webp" alt="" />
          </div>

          <div className="trk__chips">
            {TIPS.map((v) => (
              <button
                key={v}
                type="button"
                className={'tipchip' + (tip === v ? ' is-on' : '')}
                aria-pressed={tip === v}
                onClick={() => {
                  setTip(tip === v ? null : v);
                  if (tip !== v) toast(`${rupees(v)} tip added for ${PARTNER}`);
                }}
              >
                <b>{rupees(v)}</b>
                {v === 30 && <small>MOST TIPPED</small>}
              </button>
            ))}
            <button
              type="button"
              className={'tipchip' + (tip === 0 ? ' is-on' : '')}
              onClick={() => {
                setTip(0);
                toast('Custom tips are out of scope for this prototype');
              }}
            >
              <b>Other</b>
            </button>
          </div>

          <button className="trk__safety" type="button" onClick={() => toast('Safety details are out of scope for this prototype')}>
            <span className="trk__shield">
              <IconShield size={18} />
            </span>
            <span className="grow">
              <b>Your Blinkit store is only 0.5 km away</b>
              <small>Learn about delivery partner safety</small>
            </span>
            <IconChevronRight size={17} />
          </button>
        </section>

        {/* ---- what is coming ---- */}
        <section className="card trk__items">
          <p className="trk__cardh">
            {order.lines.length} item{order.lines.length > 1 ? 's' : ''} in this order
          </p>
          {order.lines.map((l) => (
            <div className="cline" key={l.id}>
              <span className="cline__im">
                <img src={l.image} alt="" />
              </span>
              <div className="grow">
                <p className="cline__t">{l.name}</p>
                <p className="cline__u">Qty {l.qty}</p>
              </div>
              <span className="cline__p">{rupees(l.price * l.qty)}</span>
            </div>
          ))}
          <div className="bill">
            <div className="bill__r">
              <span>Paid</span>
              <b>{rupees(order.total)}</b>
            </div>
            {tip ? (
              <div className="bill__r">
                <span>Tip for {PARTNER}</span>
                <b style={{ color: 'var(--green)' }}>{rupees(tip)}</b>
              </div>
            ) : null}
            {order.savings > 0 && (
              <div className="bill__r">
                <span>You saved</span>
                <b style={{ color: 'var(--green)' }}>{rupees(order.savings)}</b>
              </div>
            )}
          </div>
        </section>

        <section className="card trk__addr">
          <p className="trk__cardh">Delivering to {DELIVERY_ADDRESS.label}</p>
          <p className="t-sm">{DELIVERY_ADDRESS.line}</p>
        </section>

        <button className="card rowcard" type="button" onClick={() => nav('/campaign')}>
          <span className="rowcard__ic rowcard__ic--pts">+250</span>
          <span className="grow">
            <b>You earned 250 campaign points</b>
            <small>Buying a drop car adds to your race total</small>
          </span>
          <IconChevronRight size={17} />
        </button>

        <Button variant="outline" block type="button" onClick={() => nav('/')}>
          Continue shopping
        </Button>
      </div>
    </main>
  );
}
