import { useEffect, useRef, useState } from 'react';
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
/** Must match .cartpill__th's leave animation. */
const LEAVE_MS = 260;

/**
 * The strip of item thumbnails on the cart pill.
 *
 * The cart is keyed by product id and objects keep insertion order, so the
 * order items were added is already there to read — the last three are the
 * three the pill shows, newest on the right. A thumbnail pushed off the left
 * has to outlive the state change that removed it, or it would vanish on the
 * same frame the new one arrives instead of being seen to leave, so departures
 * are held for the length of their animation and rendered alongside.
 */
function useThumbStrip(ids: string[]) {
  const keep = ids.slice(-MAX_THUMBS);
  const [shown, setShown] = useState(keep);
  const [leaving, setLeaving] = useState<string[]>([]);
  const sig = keep.join(',');

  useEffect(() => {
    setShown((prev) => {
      const gone = prev.filter((id) => !keep.includes(id));
      if (gone.length) {
        setLeaving(gone);
        window.setTimeout(() => setLeaving([]), LEAVE_MS);
      }
      return keep;
    });
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

  /* The pill's first appearance is its own move: it rises from below the
     screen as a single circle and unfurls into the bar. Every add after that
     is just a thumbnail dropping into a bar that is already there, so the
     open only plays on the transition from an empty cart. */
  const [opening, setOpening] = useState(false);
  const wasEmpty = useRef(true);
  useEffect(() => {
    if (wasEmpty.current && count > 0) {
      setOpening(true);
      const t = window.setTimeout(() => setOpening(false), 760);
      wasEmpty.current = false;
      return () => window.clearTimeout(t);
    }
    if (count === 0) wasEmpty.current = true;
  }, [count]);

  return (
    <div className="bnav-wrap">
      {count > 0 && !onCart && (
        <div className="cartbar">
          <button
            className={'cartpill' + (opening ? ' is-opening' : '')}
            type="button"
            onClick={() => nav('/cart')}
          >
            <span className="cartpill__thumbs">
              {leaving.map((id) => (
                <img key={id} className="cartpill__th is-out" src={productById(id)?.image} alt="" />
              ))}
              {shown.map((id) => (
                <img key={id} className="cartpill__th" src={productById(id)?.image} alt="" />
              ))}
            </span>
            <span className="cartpill__txt">
              <b>View cart</b>
              <small>
                {count} Item{count > 1 ? 's' : ''}
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
