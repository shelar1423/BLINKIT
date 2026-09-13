import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { DELIVERY_ADDRESS } from '../../data/catalog';
import {
  IconBasket,
  IconCaretDown,
  IconChevronDown,
  IconChevronLeft,
  IconFlag,
  IconBabyBottle,
  IconImported,
  IconGift,
  IconLamp,
  IconHeadphones,
  IconLipstick,
  IconVoiceBars,
  IconRupeeWallet,
  IconStore,
  IconSearch,
  IconUser,
} from '../elements/Icons';
import './chrome.css';

/**
 * Blinkit's wordmark, set live rather than shipped as a traced logotype:
 * lowercase, heavy, tight, with the "it" in brand green.
 */
export function BlinkitMark({ className = '' }: { className?: string }) {
  return (
    <span className={'bmark ' + className} aria-label="Blinkit" role="img">
      blink<i>it</i>
    </span>
  );
}

/**
 * District's wordmark, set live rather than shipped as a traced logotype —
 * same approach as the Blinkit mark above. Lowercase, heavy, tightened, with
 * the outbound arrow that marks it as a jump to a different app.
 */
export function DistrictMark() {
  return (
    <span className="dmark" aria-label="District" role="img">
      district
      <i aria-hidden="true">&#8599;</i>
    </span>
  );
}

/** The category rail's tabs. Only Hot Wheels is built out.
 *
 *  Eight of them, which is more than fits: the rail scrolls, and a tab cut off
 *  at the right edge is what says so. */
const RAIL = [
  { id: 'all', label: 'All', Icon: IconBasket },
  { id: 'hw', label: 'Hot Wheels', Icon: IconFlag, badge: 'New', to: '/hot-wheels' },
  { id: 'elec', label: 'Electronics', Icon: IconHeadphones },
  { id: 'beauty', label: 'Beauty', Icon: IconLipstick },
  { id: 'gift', label: 'Gifting', Icon: IconGift },
  { id: 'decor', label: 'Decor', Icon: IconLamp },
  { id: 'kids', label: 'Kids', Icon: IconBabyBottle },
  { id: 'imported', label: 'Imported', Icon: IconImported },
];

/**
 * Blinkit's home header.
 *
 * On a normal day this block is brand yellow. During a campaign Blinkit themes
 * the whole thing in the campaign's colours — Ganeshotsav turns it deep maroon
 * — so the Hot Wheels takeover runs it in flame red. That is also what keeps
 * Hot Wheels legible: the campaign never has to compete with Blinkit's yellow.
 */
export function AppHeader({ onSearch }: { onSearch?: () => void }) {
  const nav = useNavigate();
  const points = useStore((s) => s.totalPoints);

  return (
    <header className="bhdr bhdr--campaign">
      <div className="bhdr__top">
        <div className="bhdr__eta">
          <p className="bhdr__kicker">Blinkit in</p>
          <div className="bhdr__minsrow">
            <span className="bhdr__mins">8 minutes</span>
            <span className="bhdr__dist">
              <IconStore size={13} /> 1.9 km away
            </span>
          </div>
          {/* The real header leads the line with the saved label in heavy caps
              and hangs the street after it — you scan for WHICH address before
              you read the address. */}
          <button className="bhdr__addr" type="button">
            <b>{DELIVERY_ADDRESS.label.toUpperCase()}</b>
            <span className="bhdr__addr-d" aria-hidden="true">-</span>
            <span className="trunc">{DELIVERY_ADDRESS.line}</span>
            <IconCaretDown size={13} />
          </button>
        </div>

        <div className="bhdr__acts">
          <button className="bhdr__wallet" type="button" onClick={() => nav('/rewards')} aria-label={`Blinkit Cash, ${points} points`}>
            <span className="bhdr__wallet-ic">
              <IconRupeeWallet size={28} />
            </span>
            <span className="bhdr__wallet-v">₹{Math.floor(points / 100)}</span>
          </button>
          <button className="bhdr__avatar" type="button" aria-label="Account">
            <IconUser size={21} />
          </button>
        </div>
      </div>

      {/* Voice is its own round button beside the field, not a mic tucked inside
          it behind a divider. It is a different destination — the assistant,
          not the search results — and the real header separates the two. */}
      <div className="bsearchrow">
        <button className="bsearch" type="button" onClick={onSearch}>
          <IconSearch size={19} />
          <span className="grow">
            Search <span className="bsearch__q">&ldquo;hot wheels&rdquo;</span>
          </span>
        </button>
        <button className="bvoice" type="button" aria-label="Search by voice" onClick={onSearch}>
          <IconVoiceBars size={19} />
        </button>
      </div>

      <nav className="crail" aria-label="Categories">
        {RAIL.map((r) =>
          r.to ? (
            <NavLink key={r.id} to={r.to} className={({ isActive }) => 'crail__i' + (isActive ? ' is-on' : '')}>
              <span className="crail__ic" aria-hidden="true">
                <r.Icon size={23} />
                {r.badge && <em className="crail__badge">{r.badge}</em>}
              </span>
              <span className="crail__l">{r.label}</span>
            </NavLink>
          ) : (
            <span key={r.id} className={'crail__i' + (r.id === 'all' ? ' is-on' : ' is-inert')} aria-disabled={r.id !== 'all'}>
              <span className="crail__ic" aria-hidden="true">
                <r.Icon size={23} />
              </span>
              <span className="crail__l">{r.label}</span>
            </span>
          ),
        )}
      </nav>
    </header>
  );
}

/**
 * Sub-page header: back chevron + title, matching Blinkit's inner screens.
 *
 * On a listing page Blinkit replaces the grey subtitle with the delivery
 * address — the one thing you might need to change before you fill a basket —
 * set as a green label and a truncated line you can tap. Pass `address` for
 * that variant; `subtitle` stays for pages where a description is the point.
 */
export function PageHeader({
  title,
  subtitle,
  address,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  address?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const nav = useNavigate();
  /* Publish the header's real height so anything sticking underneath can pin
     to it. The token it used to rely on was a guess — 68px against a header
     that is 59px here and taller again on a notched phone, where the safe-area
     inset is part of its padding. The 9px difference was a slot the category
     grid scrolled through. */
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const publish = () =>
      document.documentElement.style.setProperty('--phdr-h', `${Math.round(node.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(node);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--phdr-h');
    };
  }, []);

  return (
    <header className="phdr" ref={el}>
      <button className="phdr__back" type="button" aria-label="Go back" onClick={() => (onBack ? onBack() : nav(-1))}>
        <IconChevronLeft size={22} />
      </button>
      <div className="grow">
        <h1 className="phdr__t trunc">{title}</h1>
        {address ? (
          <button className="phdr__addr" type="button">
            <b>Delivering to {DELIVERY_ADDRESS.label}:</b>
            <span className="trunc">{DELIVERY_ADDRESS.line}</span>
            <IconChevronDown size={14} />
          </button>
        ) : (
          subtitle && <p className="phdr__s trunc">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="sec">
      <div>
        <h2 className="sec__t">{title}</h2>
        {subtitle && <p className="sec__s">{subtitle}</p>}
      </div>
      {action && (
        <button className="sec__a" type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
