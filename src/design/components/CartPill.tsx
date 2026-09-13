import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productById } from '../../data/catalog';
import { useCartCount, useStore } from '../../store/useStore';
import { IconChevronRight } from '../elements/Icons';

/**
 * Blinkit's "View cart" bar: a stadium carrying a shingled stack of the items
 * you have added, the count, and a darker disc for the chevron.
 *
 * It lives here rather than inside the bottom nav because it appears on two
 * surfaces that have nothing else in common — floating over the storefront's
 * nav, and inside the product sheet above its action bar. One copy of the
 * motion means the bar a shopper meets on the home screen is the same object
 * they meet on a product page, arriving the same way.
 *
 * The caller decides where it sits; this owns only what it does.
 */
/** Thumbnails the pill shows at once. The fourth add drops the oldest. */
const MAX_THUMBS = 3;
/** Must outlast .cartpill__th's leave animation and the bubble that follows (70ms + 460ms). */
const LEAVE_MS = 580;

/* Shapes traced off a screen recording of the real app, frame by frame at
   60fps, by tracking the green pill's bounding box — then deliberately slowed.
   The measured original is brisk: it is a grocery app optimising for a shopper
   who adds twenty things in a row, and at that speed the bar is information
   rather than an event. This is a campaign piece where the bar arriving is
   worth watching, so every duration is carried about a third longer and the
   settle runs on a quintic ease-out, which spends most of its time decelerating
   instead of arriving and stopping. The proportions between the phases, and
   the overshoot, are still the measured ones — only the clock is different.

   Opening: the circle rises for ~130ms, then the bar unfurls over ~370ms —
   and it overshoots, reaching 608px before settling back to 568, a little
   over 7% past its resting width, with the peak halfway through the unfurl.
   Closing is not the same move reversed: the furl is ~185ms, half the
   opening, and runs straight to the circle with no overshoot at all before
   the circle drops away. */
const OPEN_MS = 660;
const OPEN_RISE = 0.26;
const OPEN_PEAK = 0.63;
const OPEN_OVERSHOOT = 1.07;
const CLOSE_MS = 430;
const CLOSE_FURL = 0.55;
/** The diameter of the circle the bar unfurls from and furls back into. */
const SEED_PX = 60;
/** How far below its resting place the circle starts and ends. */
const DROP_PX = 150;

/** Left edge of slot i: 44px wide with 24px of overlap, so each is 20px on. */
const SLOT_PX = 20;

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';

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


export function CartPill() {
  const count = useCartCount();
  const lines = useStore((s) => s.cart);
  const nav = useNavigate();
  /* The cart and checkout ARE the cart; a shortcut to it there is noise. */
  const loc = useLocation();
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

  /* A thumbnail joining or leaving changes the bar's width through CSS now —
     the strip's width and its reserved margin transition together (see
     .cartpill__thumbs) — so there is no width tween here to fight it. */

  if (!mounted) return null;

  return (
    <div className="cartbar">

          <button
            className="cartpill"
            ref={pill}
            type="button"
            style={{ ['--n' as string]: Math.max(1, view.thumbs.length) }}
            onClick={() => nav('/cart')}
          >
            <span className="cartpill__thumbs">
              {view.thumbs.map((id, i) => (
                <img
                  key={id}
                  className="cartpill__th"
                  style={{ left: i * SLOT_PX }}
                  src={productById(id)?.image}
                  alt=""
                  decoding="sync"
                />
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
                      <i className="bub-fill" />
                      <i className="bub-ring" />
                      <i className="bub-arcs" />
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
  );
}
