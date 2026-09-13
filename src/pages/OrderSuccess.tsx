import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { ARRIVE_U, DeliveryMap, DONE_U } from '../design/components/DeliveryMap';
import { rupees } from '../data/catalog';
import { ADDRESSES } from '../data/addresses';
import { useStore } from '../store/useStore';
import {
  IconCallOutline,
  IconChatBubble,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconExpand,
  IconHeart,
  IconBag,
  IconLike,
  IconMicSolid,
  IconMotorcycle,
  IconPhoneCall,
  IconPin,
  IconShieldCheck,
} from '../design/elements/Icons';
import { useToast } from '../App';

/* ============================================================
   Order tracking.

   Blinkit's tracking screen is one green bar carrying the ETA, a live map, and
   then a stack of cards in a fixed order: who has your order, how to reach
   them, where it is going, and what is in it. Each card leads with a grey
   circular icon, so the stack scans as a list of subjects rather than a wall of
   headings.

   The map is the campaign's own, drawn in the design file and animated there —
   see DeliveryMap. The ETA on the green bar is not a separate countdown: it is
   read from the same position on the timeline that puts the car on the road,
   so the number and the picture can never disagree.
   ============================================================ */

/** Real seconds the six-second design timeline is stretched across. */
const TRIP_S = 108;
/** What the ETA reads at the start of the trip. */
const TRIP_MIN = 7;

const PARTNER = 'Sangram';
const ACCOUNT = { name: 'Aarav Mehta', first: 'Aarav', phone: '9620964510' };

/** Blinkit prints the last five digits as X, and so does this. */
const mask = (p: string) => p.slice(0, 5) + 'XXXXX';

/* The instructions Blinkit offers as taps rather than typing. A delivery note
   is written one-handed at a door, so a set of choices beats a text field. */
const NOTES = ['Leave at the door', 'Do not ring the bell', 'Call on arrival', 'Guard will collect'];

export default function OrderSuccess() {
  const nav = useNavigate();
  const { toast } = useToast();
  const order = useStore((s) => s.order);
  const addressId = useStore((s) => s.addressId);
  const address = ADDRESSES.find((a) => a.id === addressId) ?? ADDRESSES[0];

  /** Position on the design timeline, 0..1. Everything on this screen reads it. */
  const [u, setU] = useState(0);
  const [mapOpen, setMapOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  /* Timed from when the order was actually placed, not from when this screen
     mounted, so leaving and coming back picks the trip up where it really is
     instead of restarting the delivery. */
  const placedAt = order?.placedAt ?? 0;
  useEffect(() => {
    if (!placedAt) return;
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - placedAt) / 1000 / TRIP_S);
      setU(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [placedAt]);

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

  /* How far along the drive itself is, which is not the same as how far along
     the timeline is — the car arrives before the animation ends, and the beat
     after that is the handover. */
  const drive = Math.min(1, u / ARRIVE_U);
  const done = u >= DONE_U;
  const minsLeft = Math.max(1, Math.ceil((1 - drive) * TRIP_MIN));

  const said = done
    ? 'I have handed over your order. Thanks for ordering!'
    : drive > 0.88
      ? 'I am at your location, please collect your order'
      : drive > 0.45
        ? 'I am on my way to your location'
        : 'I have picked up your order, and I am on the way';

  const items = order.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <main className="page trk">
      {/* ---- the green bar ---- */}
      <header className="trk__top">
        <button className="trk__back" type="button" aria-label="Back" onClick={() => nav('/')}>
          <IconChevronLeft size={22} />
        </button>
        <p className="trk__k">{done ? 'Order delivered' : 'Order is on the way'}</p>
        <h1 className="trk__eta">
          {done ? 'Enjoy your Hot Wheels' : `Arriving in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}`}
        </h1>
      </header>

      {mapOpen ? (
        <DeliveryMap
          u={u}
          onCollapse={() => setMapOpen(false)}
          onShare={() => toast('Location sharing is out of scope for this prototype')}
          label={done ? 'Your order has arrived' : `${PARTNER} is ${minsLeft} minutes away`}
        />
      ) : (
        <button type="button" className="trk__showmap" onClick={() => setMapOpen(true)}>
          <IconExpand size={17} />
          Show live map
        </button>
      )}

      <div className="trk__body">
        {/* ---- who has the order ---- */}
        <section className="trkc trkc--partner">
          <div className="trkc__who">
            <img className="trkc__face" src="/track/rider.png" alt="" />
            <h2 className="trkc__name">
              I&rsquo;m {PARTNER}, your delivery partner
            </h2>
            <button
              className="trkc__call"
              type="button"
              aria-label={`Call ${PARTNER}`}
              onClick={() => toast('Calling is out of scope for this prototype')}
            >
              <IconPhoneCall size={20} />
            </button>
          </div>

          <p className="trkc__said">{said}</p>

          <button className="trkc__row trkc__row--sep" type="button" onClick={() => toast('Safety details are out of scope for this prototype')}>
            <span className="trkc__shield">
              <IconShieldCheck size={20} />
            </span>
            <span className="grow">
              <b>Your Blinkit store is 1.6 km away.</b>
              <br />
              Learn about delivery partner safety
            </span>
            <IconChevronRight size={18} />
          </button>
        </section>

        {/* ---- delivery instructions ---- */}
        <section className="trkc">
          <button
            className="trkc__hd"
            type="button"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((v) => !v)}
          >
            <span className="trkc__ic"><IconMicSolid size={21} /></span>
            <span className="trkc__t">
              <b>Add delivery instructions</b>
              <small>{note ?? 'Help your delivery partner reach you faster'}</small>
            </span>
            <span className={'trkc__caret' + (notesOpen ? ' is-open' : '')}>
              <IconChevronDown size={20} />
            </span>
          </button>
          {notesOpen && (
            <div className="trkc__notes">
              {NOTES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={'trkc__note' + (note === n ? ' is-on' : '')}
                  onClick={() => {
                    const next = note === n ? null : n;
                    setNote(next);
                    if (next) toast(`${PARTNER} will ${next[0].toLowerCase() + next.slice(1)}`);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---- where it is going ---- */}
        <section className="trkc">
          <div className="trkc__hd">
            <span className="trkc__ic"><IconMotorcycle size={21} /></span>
            <span className="trkc__t">
              <b>Your delivery details</b>
              <small>Details of your current order</small>
            </span>
          </div>

          <p className="trkc__by">
            <i aria-hidden="true">🛍️</i>
            Order placed by {ACCOUNT.name}, {mask(ACCOUNT.phone)}
          </p>

          <div className="trkc__row">
            <span className="trkc__ic trkc__ic--sm"><IconPin size={19} /></span>
            <span className="grow">
              <b className="trkc__at">Delivery at {address.label}</b>
              <span className="trkc__line">{address.line}</span>
              <button type="button" className="trkc__change" onClick={() => toast('The address is locked once the order is on the way')}>
                Change address <IconChevronRight size={13} />
              </button>
            </span>
          </div>

          <div className="trkc__row">
            <span className="trkc__ic trkc__ic--sm"><IconCallOutline size={18} /></span>
            <span className="grow trkc__at">
              {ACCOUNT.first}, {mask(address.phone)}
            </span>
          </div>
        </section>

        {/* ---- help ---- */}
        <button className="trkc trkc__hd trkc--link" type="button" onClick={() => toast('Chat is out of scope for this prototype')}>
          <span className="trkc__ic"><IconChatBubble size={21} /></span>
          <span className="trkc__t">
            <b>Need help?</b>
            <small>Chat with us about any issue related to your order</small>
          </span>
          <IconChevronRight size={18} />
        </button>

        {/* ---- what is in it ----
            The thumbnails are the order's own products, which is the whole
            point of the screen for this campaign: what is on its way is a
            Hot Wheels car, and it should be recognisable at a glance. */}
        <section className="trkc">
          <div className="trkc__hd">
            <span className="trkc__ic"><IconBag size={21} /></span>
            <span className="trkc__t">
              <b>Order summary</b>
              <small className="trkc__oid">
                Order id - #{order.id}
                <button
                  type="button"
                  aria-label="Copy order id"
                  onClick={() => {
                    navigator.clipboard?.writeText(order.id).catch(() => {});
                    toast('Order id copied');
                  }}
                >
                  <IconCopy size={14} />
                </button>
              </small>
            </span>
          </div>

          <div className="trkc__thumbs">
            {order.lines.map((l) => (
              <span className="trkc__thumb" key={l.id}>
                <img src={l.image} alt={l.name} />
                {l.qty > 1 && <i>×{l.qty}</i>}
              </span>
            ))}
          </div>

          {summaryOpen && (
            <div className="trkc__lines">
              {order.lines.map((l) => (
                <div className="trkc__ln" key={l.id}>
                  <span className="grow">
                    {l.name}
                    <small>Qty {l.qty}</small>
                  </span>
                  <b>{rupees(l.price * l.qty)}</b>
                </div>
              ))}
              <div className="trkc__ln trkc__ln--tot">
                <span className="grow">Paid for {items} item{items > 1 ? 's' : ''}</span>
                <b>{rupees(order.total)}</b>
              </div>
              {order.savings > 0 && (
                <div className="trkc__ln trkc__ln--save">
                  <span className="grow">You saved</span>
                  <b>{rupees(order.savings)}</b>
                </div>
              )}
            </div>
          )}

          <button className="trkc__foot" type="button" onClick={() => setSummaryOpen((v) => !v)}>
            {summaryOpen ? 'Hide order summary' : 'View order summary'}
          </button>
        </section>

        {/* ---- the campaign's own payoff, in the tracking screen's idiom ---- */}
        <button className="trkc trkc__hd trkc--link" type="button" onClick={() => nav('/campaign')}>
          <span className="trkc__ic trkc__ic--pts">+250</span>
          <span className="trkc__t">
            <b>You earned 250 campaign points</b>
            <small>Buying a drop car adds to your race total</small>
          </span>
          <IconChevronRight size={18} />
        </button>

        {/* ---- rate ---- */}
        <section className="trkc">
          <div className="trkc__hd">
            <span className="trkc__ic"><IconLike size={21} /></span>
            <span className="trkc__t">
              <b>Do you like our services?</b>
              <small>
                Do rate us on the Play Store if you are enjoying our service. You can rate again if you have already
                rated us.
              </small>
            </span>
          </div>
          <div className="trkc__split">
            <button type="button" onClick={() => toast('Maybe later it is')}>Maybe later</button>
            <button type="button" onClick={() => toast('Thanks! Ratings are out of scope for this prototype')}>
              Rate Blinkit
            </button>
          </div>
        </section>

        {/* Blinkit closes every scroll with this, tracking included. */}
        <footer className="bfoot">
          <p className="bfoot__line">
            <span>India&rsquo;s last minute</span>
            <span>
              app
              <IconHeart className="bfoot__heart" size={52} />
            </span>
          </p>
          <hr className="bfoot__rule" />
          <p className="bfoot__mark">blinkit</p>
        </footer>
      </div>
    </main>
  );
}
