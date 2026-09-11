import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { rupees } from '../../data/catalog';
import { useCartCount, useStore, useTotals } from '../../store/useStore';
import { IconBag, IconGrid, IconHouse, IconPrint, IconScooter } from '../elements/Icons';

/**
 * Blinkit's real bottom navigation: a floating white pill that rides above the
 * content rather than a flat docked bar. Tabs are Home · Order Again ·
 * Categories · Print, and the active one gets a yellow lozenge behind its icon.
 *
 * It is permanent product chrome — a campaign never adds a tab to it, so Race
 * It Home lives in the category rail and the home takeover instead.
 */
export function BottomNav() {
  const count = useCartCount();
  const totals = useTotals();
  const lines = useStore((s) => s.cart);
  const nav = useNavigate();
  const loc = useLocation();

  const firstId = Object.keys(lines)[0];
  const freeDelivery = totals.items > 0 && totals.delivery === 0;
  const onCart = loc.pathname === '/cart' || loc.pathname === '/checkout';

  return (
    <>
      {count > 0 && !onCart && (
        <div className="floatbar">
          <div className="freepill">
            <span className="freepill__ic">
              <IconScooter size={17} />
            </span>
            <span className="grow">
              {freeDelivery ? (
                <b className="freepill__t">Free delivery unlocked</b>
              ) : (
                <>
                  <b className="freepill__t">
                    Add {rupees(totals.freeDeliveryShortfall)} more for free delivery
                  </b>
                  <span className="freepill__bar" aria-hidden="true">
                    <i style={{ width: `${totals.freeDeliveryProgress * 100}%` }} />
                  </span>
                </>
              )}
            </span>
          </div>
          <button className="cartpill" type="button" onClick={() => nav('/cart')}>
            {firstId && <img src={`/cars/${cartThumb(firstId)}`} alt="" />}
            <span>
              <b>Cart</b>
              <small>
                {count} item{count > 1 ? 's' : ''}
              </small>
            </span>
          </button>
        </div>
      )}

      <div className="bnav-wrap">
        <nav className="bnav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => 'bnav__i' + (isActive ? ' is-on' : '')}>
            {({ isActive }) => (
              <>
                <span className={'bnav__ic' + (isActive ? ' is-on' : '')}>
                  <IconHouse size={21} />
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
              <IconBag size={21} />
            </span>
            <span className="bnav__l">Order Again</span>
          </span>

          <NavLink to="/hot-wheels" className={({ isActive }) => 'bnav__i' + (isActive ? ' is-on' : '')}>
            {({ isActive }) => (
              <>
                <span className={'bnav__ic' + (isActive ? ' is-on' : '')}>
                  <IconGrid size={21} />
                </span>
                <span className="bnav__l">Categories</span>
              </>
            )}
          </NavLink>

          <span className="bnav__i is-inert" aria-disabled="true">
            <span className="bnav__ic">
              <IconPrint size={21} />
            </span>
            <span className="bnav__l">Print</span>
          </span>
        </nav>

        {/* Blinkit floats a partner shortcut beside the bar (District today).
            The Hot Wheels takeover puts the race there — one tap from anywhere,
            without touching the permanent tabs. */}
        <button className="bnav__fab" type="button" onClick={() => nav('/race')} aria-label="Race It Home">
          <img className="bnav__fab-mark" src="/brand/hot-wheels.svg" alt="" />
        </button>
      </div>
    </>
  );
}

/** Cart thumbnails come from the catalogue image path. */
function cartThumb(id: string) {
  const map: Record<string, string> = {
    ballistik: 'ballistik-diecast.webp',
    battlespec: 'battlespec-diecast.webp',
    jackhammer: 'jackhammer-diecast.webp',
    hollowback: 'hollowback-diecast.webp',
    kitt: 'kitt-diecast.webp',
    muscle: '09-02-muscle-car-orange.webp',
    retro: '09-05-retro-racing-car-yellow.webp',
    supercar: '09-07-supercar-purple.webp',
    pickup: '09-09-performance-pickup-blue.webp',
    proto: '09-10-race-prototype-red.webp',
    metallic: '09-11-rare-metallic-edition.webp',
    premium: '09-12-premium-limited-racer.webp',
    featured: '10-featured-limited-drop-car.webp',
    mystery: '23-rare-car-reveal.webp',
  };
  return map[id] ?? 'ballistik-diecast.webp';
}
