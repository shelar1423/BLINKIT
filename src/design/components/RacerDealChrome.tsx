import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markPopSeen, popSeen, useRacerDeal } from '../../lib/racerDeal';
import { useStore } from '../../store/useStore';
import { IconClock, IconClose } from '../elements/Icons';
import './racerDeal.css';

/* The leaderboard's own podium art: the reward comes from where you finished. */
const ART = '/icons/leaderboard.webp';

/** `?still=1` keeps a note up on the comparison page instead of closing itself. */
const useStill = () => new URLSearchParams(useLocation().search).get('still') === '1';

/** Time left on the lock, the way a quick-commerce timer reads it: "23h 41m". */
export function useLeft(until: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!until) return '';
  const m = Math.max(0, Math.floor((until - now) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** The blue line under the yellow ticket: what the discount is and where it came from. */
export function RacerLine({ className = '', short = false }: { className?: string; short?: boolean }) {
  const deal = useRacerDeal();
  if (!deal) return null;
  /* Two lines, turning over a whole line at a time the way Blinkit turns its
     "Lowest in 30 days": what the discount is, then where it came from. A
     listing card is about 120px wide; "the" is what pushes the rank over. */
  const lines = [`${deal.pct}% off · Race reward`, short ? `#${deal.rank} on city leaderboard` : `#${deal.rank} on the city leaderboard`];
  return (
    <p className={'rline ' + className}>
      <span className="rline__track">
        <span>{lines[0]}</span>
        <span>{lines[1]}</span>
        {/* The first line again, so the turn back to it is seamless. */}
        <span aria-hidden="true">{lines[0]}</span>
      </span>
    </p>
  );
}

/**
 * How long the race reward lasts, said once for the whole listing rather than
 * on every card: one slim strip above the grid, the way Blinkit shows a deal's
 * end time.
 */
export function RacerTimer() {
  const deal = useRacerDeal();
  const left = useLeft(deal?.until);
  if (!deal) return null;
  return (
    <div className="rtimer" role="status">
      <IconClock size={14} />
      <span>
        Race reward ends in <b className="t-num">{left}</b>
      </span>
    </div>
  );
}

/**
 * The listing's note: a slim bar shaped like Blinkit's cart pill, the first
 * time the listing opens after a race. Not when the cart already has items,
 * because the cart pill owns that spot; the tickets say it there.
 */
export function RacerBar() {
  const deal = useRacerDeal();
  const cartCount = useStore((s) => Object.values(s.cart).reduce((a, b) => a + b, 0));
  const still = useStill();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!deal || popSeen(deal.id)) return;
    if (cartCount > 0) {
      markPopSeen(deal.id);
      return;
    }
    /* Marked seen when it actually appears, so a cancelled timer never eats it. */
    const t = window.setTimeout(() => {
      markPopSeen(deal.id);
      setOpen(true);
    }, 400);
    return () => window.clearTimeout(t);
    /* Decided once, on arrival: adding to the cart later must not re-run it. */
  }, [deal?.id]);

  /* It steps aside on its own, and the moment the cart pill needs the spot. */
  useEffect(() => {
    if (!open) return;
    if (cartCount > 0) return setOpen(false);
    if (still) return;
    const t = window.setTimeout(() => setOpen(false), 8000);
    return () => window.clearTimeout(t);
  }, [open, cartCount, still]);

  if (!deal || !open) return null;
  return (
    <div className="rsnack" role="status">
      <span className="rsnack__art">
        <img src={ART} alt="" />
      </span>
      <span className="rsnack__txt">
        <b>{deal.pct}% off on Hot Wheels</b>
        <span>Race reward applied</span>
      </span>
      <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
        <IconClose size={14} />
      </button>
    </div>
  );
}

/**
 * The home screen's note, for the player who left the result screen without
 * tapping Shop now. Once per reward; its button goes to the listing, which
 * then stays quiet because this has already said it.
 */
export function RacerSheet() {
  const deal = useRacerDeal();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!deal || popSeen(deal.id)) return;
    const t = window.setTimeout(() => {
      markPopSeen(deal.id);
      setOpen(true);
    }, 500);
    return () => window.clearTimeout(t);
  }, [deal?.id]);

  if (!deal || !open) return null;
  return (
    <div className="rpop" role="dialog" aria-label="Race reward">
      <div className="rpop__scrim" onClick={() => setOpen(false)} />
      <div className="rpop__card">
        <i className="rpop__flag" aria-hidden="true" />
        <button className="rpop__x" type="button" aria-label="Close" onClick={() => setOpen(false)}>
          <IconClose size={14} />
        </button>
        <img className="rpop__art" src={ART} alt="" />
        {/* One sentence, read top to bottom: you earned / 10% OFF / on Hot Wheels for 24 hours. */}
        <p className="rpop__k">You earned</p>
        <p className="rpop__demo">
          <b className="rtk t-num">{deal.pct}% OFF</b>
        </p>
        <p className="rpop__s">on Hot Wheels for 24 hours</p>
        <button
          className="rpop__go"
          type="button"
          onClick={() => {
            setOpen(false);
            nav('/hot-wheels');
          }}
        >
          Shop now
        </button>
      </div>
    </div>
  );
}
