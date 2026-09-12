import { NavLink, useLocation } from 'react-router-dom';
import { NavCategories, NavHome, NavOrders, NavPrint } from '../elements/NavIcons';
import { CartPill } from './CartPill';
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
export function BottomNav() {
  const loc = useLocation();

  /* Tapping the tab you are already on takes you back to the top, the way every
     tab bar on the phone behaves. NavLink alone would re-navigate to the same
     route, React Router would treat it as a no-op, and nothing would move. */
  const toTopIfHere = (path: string) => (e: React.MouseEvent) => {
    if (loc.pathname !== path) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  return (
    <div className="bnav-wrap">
      <CartPill />

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
