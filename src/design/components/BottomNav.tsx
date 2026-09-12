import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { productById } from '../../data/catalog';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCartCount, useStore } from '../../store/useStore';
import { IconChevronRight } from '../elements/Icons';
import { NavCategories, NavHome, NavOrders, NavPrint } from '../elements/NavIcons';
import { DistrictMark } from './Chrome';

/**
 * Blinkit's real bottom navigation: a floating white pill that rides above the
 * content rather than a flat docked bar. Tabs are Home · Order Again ·
 * Categories · Print, and the active one is repainted rather than highlighted:
 * the glyph itself goes two-tone and a soft lozenge sits behind the whole tab.
 *
 * It is permanent product chrome — a campaign never adds a tab to it, so Race
 * It Home lives in the category rail and the home takeover instead.
 */
/** Thumbnails the pill shows at once. The fourth add drops the oldest. */
const MAX_THUMBS = 3;
/** Must outlast .cartpill__th's leave animations and the cloud that follows. */
const LEAVE_MS = 540;

/* Timings traced off a screen recording of the real app, frame by frame at
   60fps, by tracking the green pill's bounding box.

   Opening: the circle rises for ~130ms, then the bar unfurls over ~370ms —
   and it overshoots, reaching 608px before settling back to 568, a little
   over 7% past its resting width, with the peak halfway through the unfurl.
   Closing is not the same move reversed: the furl is ~185ms, half the
   opening, and runs straight to the circle with no overshoot at all before
   the circle drops away. */
const OPEN_MS = 500;
const OPEN_RISE = 0.26;
const OPEN_PEAK = 0.63;
const OPEN_OVERSHOOT = 1.07;
const CLOSE_MS = 335;
const CLOSE_FURL = 0.55;
/** The diameter of the circle the bar unfurls from and furls back into. */
const SEED_PX = 60;
/** How far below its resting place the circle starts and ends. */
const DROP_PX = 150;
/** Reflow of the bar when a thumbnail joins or leaves an open pill. */
const RESIZE_MS = 220;

/* The cloud a removed item bursts into: angle in degrees, distance as a share
   of the throw, and the lump's own diameter. Irregular on purpose — evenly
   spaced identical dots read as a loading spinner, not a puff. */
/** Left edge of slot i: 44px wide with 24px of overlap, so each is 20px on. */
const SLOT_PX = 20;

const PUFF_BITS = [
  [-92, 1.0, 26],
  [-40, 0.92, 20],
  [14, 1.06, 24],
  [66, 0.88, 17],
  [128, 1.0, 23],
  [176, 0.94, 19],
  [230, 1.04, 25],
].map(([deg, dist, size]) => ({
  '--tx': `${(Math.cos((deg * Math.PI) / 180) * dist * 34).toFixed(1)}px`,
  '--ty': `${(Math.sin((deg * Math.PI) / 180) * dist * 34).toFixed(1)}px`,
  '--s': `${size}px`,
}));

const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The strip of item thumbnails on the cart pill.
 *
 * The cart is keyed by product id and objects keep insertion order, so the
 * order items were added is already there to read — the last three are the
 * three the pill shows, newest on the right. A thumbnail pushed off the left
 * has to outlive the state change that removed it, or it would vanish on the
 * same frame the new one arrives instead of being seen to leave, so departures
 * are held for the length of their animation and rendered alongside.
 *
 * A thumbnail can leave for two different reasons and they do not look alike.
 * Deleting the item sends it back to the shelf — in the recording it lifts up
 * out of the bar and dissolves. A fourth item arriving pushes the oldest off
 * the left instead; nothing was removed, the strip just ran out of room. The
 * cart's length is what separates them.
 */
function useThumbStrip(ids: string[]) {
  const keep = ids.slice(-MAX_THUMBS);
  const sig = keep.join(',');
  /* Derived, not state. Held as state it arrived a commit late, so the layout
     effect that measures the bar's resting width to animate towards saw it
     without its first thumbnail — 44px narrow — and the open animated to the
     wrong width and then snapped the last 44px. Only the departing set has to
     be state, because it has to outlive the render that dropped it. */
  const shown = keep;
  const [leaving, setLeaving] = useState<{ id: string; how: 'removed' | 'pushed'; slot: number }[]>(
    [],
  );
  const was = useRef(keep);
  const wasTotal = useRef(ids.length);

  useEffect(() => {
    const prev = was.current;
    const gone = prev.filter((id) => !keep.includes(id));
    const how: 'removed' | 'pushed' = ids.length < wasTotal.current ? 'removed' : 'pushed';
    was.current = keep;
    wasTotal.current = ids.length;
    if (!gone.length) return;
    /* Which slot it was sitting in, so it can leave from there instead of from
       the front of the row. Deleting the newest item has to lift the thumbnail
       on TOP of the stack; rendering every departure first made it always the
       one at the back. */
    setLeaving(gone.map((id) => ({ id, how, slot: Math.max(0, prev.indexOf(id)) })));
    const t = window.setTimeout(() => setLeaving([]), LEAVE_MS);
    return () => window.clearTimeout(t);
    // keep is rebuilt every render; sig is the value that actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { shown, leaving };
}

export function BottomNav() {
  const count = useCartCount();
  const lines = useStore((s) => s.cart);
  const nav = useNavigate();
  const loc = useLocation();

  /* Tapping the tab you are already on takes you back to the top, the way every
     tab bar on the phone behaves. NavLink alone would re-navigate to the same
     route, React Router would treat it as a no-op, and nothing would move. */
  const toTopIfHere = (path: string) => (e: React.MouseEvent) => {
    if (loc.pathname !== path) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onCart = loc.pathname === '/cart' || loc.pathname === '/checkout';

  const { shown, leaving } = useThumbStrip(Object.keys(lines));

  /* The bar's own arrival and departure, driven from JS rather than a CSS
     class, because the shape it animates is its width and the resting width
     is whatever the content happens to be. A CSS keyframe can only clip to a
     max-width it was told in advance, which can shrink the bar but can never
     carry it past its resting size — and the overshoot is the whole character
     of the real open. Measuring the laid-out width first makes the overshoot
     expressible. */
  const pill = useRef<HTMLButtonElement>(null);
  const openAnim = useRef<Animation | null>(null);
  const restW = useRef(0);

  const live = count > 0 && !onCart;
  /* The bar has to outlive the empty cart long enough to be seen leaving. */
  const [mounted, setMounted] = useState(live);
  const isOpen = useRef(false);

  /* What the closing bar shows. The cart is already empty by then, so the
     last live contents are held rather than read from a store that would
     report "0 Items" for the whole exit. */
  const held = useRef({ thumbs: shown, count });
  if (live) held.current = { thumbs: shown, count };
  const view = live ? { thumbs: shown, count } : held.current;

  useLayoutEffect(() => {
    if (live && !mounted) {
      setMounted(true);
      return;
    }
    const el = pill.current;
    if (!el) return;

    if (live && !isOpen.current) {
      isOpen.current = true;
      restW.current = el.getBoundingClientRect().width;
      if (reduceMotion()) return;
      const w = restW.current;
      el.classList.add('is-morphing');
      openAnim.current = el.animate(
        [
          { width: `${SEED_PX}px`, transform: `translateY(${DROP_PX}px)`, opacity: 0, easing: EASE_OUT, offset: 0 },
          { width: `${SEED_PX}px`, transform: 'translateY(0)', opacity: 1, easing: EASE_OUT, offset: OPEN_RISE },
          { width: `${Math.round(w * OPEN_OVERSHOOT)}px`, easing: EASE_OUT, offset: OPEN_PEAK },
          { width: `${Math.round(w)}px`, offset: 1 },
        ],
        { duration: OPEN_MS, fill: 'backwards' },
      );
      openAnim.current.onfinish = () => el.classList.remove('is-morphing');
      return;
    }

    if (!live && mounted && isOpen.current) {
      isOpen.current = false;
      if (reduceMotion()) {
        setMounted(false);
        return;
      }
      const w = el.getBoundingClientRect().width;
      el.classList.add('is-morphing');
      const out = el.animate(
        [
          { width: `${Math.round(w)}px`, transform: 'translateY(0)', opacity: 1, easing: EASE_IN, offset: 0 },
          { width: `${SEED_PX}px`, transform: 'translateY(0)', opacity: 1, easing: EASE_IN, offset: CLOSE_FURL },
          { width: `${SEED_PX}px`, transform: `translateY(${DROP_PX}px)`, opacity: 0, offset: 1 },
        ],
        { duration: CLOSE_MS, fill: 'forwards' },
      );
      out.onfinish = () => setMounted(false);
    }
  }, [live, mounted]);

  /* A thumbnail joining or leaving changes the bar's resting width, and left
     alone that is a snap. Tween from the width it had to the width it now
     has — but not while the open is still running, which is already animating
     the same property. */
  useLayoutEffect(() => {
    const el = pill.current;
    if (!el || !mounted || !isOpen.current || reduceMotion()) return;
    if (openAnim.current?.playState === 'running') return;
    const w = el.getBoundingClientRect().width;
    const was = restW.current;
    restW.current = w;
    if (!was || Math.abs(w - was) < 2) return;
    el.animate([{ width: `${Math.round(was)}px` }, { width: `${Math.round(w)}px` }], {
      duration: RESIZE_MS,
      easing: EASE_OUT,
    });
  }, [view.thumbs.join(','), view.count, mounted]);

  return (
    <div className="bnav-wrap">
      {mounted && (
        <div className="cartbar">
          <button className="cartpill" ref={pill} type="button" onClick={() => nav('/cart')}>
            <span className="cartpill__thumbs">
              {view.thumbs.map((id) => (
                <img key={id} className="cartpill__th" src={productById(id)?.image} alt="" />
              ))}
              {/* After the survivors, not before. These are out of flow, so
                  where they sit is set by `left` and not by document order —
                  but :first-child is not, and with a departure rendered first
                  the leading survivor lost its `margin-left: 0` and the whole
                  stack jumped 16px sideways. Last also means they lift over
                  their neighbours rather than under them. */}
              {leaving.map((t) => (
                <Fragment key={t.id}>
                  <img
                    className={`cartpill__th is-out is-out--${t.how}`}
                    style={{ left: t.slot * SLOT_PX }}
                    src={productById(t.id)?.image}
                    alt=""
                  />
                  {t.how === 'removed' && (
                    <i className="cartpill__puff" aria-hidden="true" style={{ left: t.slot * SLOT_PX }}>
                      {PUFF_BITS.map((bit, k) => (
                        <i key={k} style={bit as React.CSSProperties} />
                      ))}
                    </i>
                  )}
                </Fragment>
              ))}
            </span>
            <span className="cartpill__txt">
              <b>View cart</b>
              <small>
                {view.count} Item{view.count > 1 ? 's' : ''}
              </small>
            </span>
            <span className="cartpill__go" aria-hidden="true">
              <IconChevronRight size={20} />
            </span>
          </button>
        </div>
      )}

      <div className="bnav-row">
        <nav className="bnav" aria-label="Primary">
          <NavLink to="/" end onClick={toTopIfHere('/')} className={({ isActive }) => 'bnav__i' + (isActive ? ' is-on' : '')}>
            {({ isActive }) => (
              <>
                <span className="bnav__ic">
                  <NavHome size={23} active={isActive} />
                </span>
                <span className="bnav__l">Home</span>
              </>
            )}
          </NavLink>

          {/* Order Again and Print are real Blinkit surfaces this campaign build
              does not implement, so they are inert rather than routed somewhere
              misleading. */}
          <span className="bnav__i is-inert" aria-disabled="true">
            <span className="bnav__ic">
              <NavOrders size={23} />
            </span>
            <span className="bnav__l">Order Again</span>
          </span>

          <NavLink to="/hot-wheels" onClick={toTopIfHere('/hot-wheels')} className={({ isActive }) => 'bnav__i' + (isActive ? ' is-on' : '')}>
            {({ isActive }) => (
              <>
                <span className="bnav__ic">
                  <NavCategories size={23} active={isActive} />
                </span>
                <span className="bnav__l">Categories</span>
              </>
            )}
          </NavLink>

          <span className="bnav__i is-inert" aria-disabled="true">
            <span className="bnav__ic">
              <NavPrint size={23} />
            </span>
            <span className="bnav__l">Print</span>
          </span>
        </nav>

        {/* Blinkit floats District beside the bar — a jump to a separate app,
            not a tab. It stays District through the takeover: the campaign does
            not get to displace another Blinkit product from the permanent
            chrome, and the race already has its own routes in from the home
            band and the category rail.

            Inert, like Order Again and Print: District is not part of this
            build, and sending it somewhere else would be worse than it not
            moving. */}
        <span className="bnav__fab is-inert" aria-disabled="true">
          <DistrictMark />
        </span>
      </div>
    </div>
  );
}
