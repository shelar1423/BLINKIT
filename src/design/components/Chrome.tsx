import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  IconBasket,
  IconChevronDown,
  IconChevronLeft,
  IconFlag,
  IconGift,
  IconHeadphones,
  IconLipstick,
  IconMic,
  IconScooter,
  IconSearch,
  IconUser,
  IconWallet,
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

/** The category rail's tabs. Only Hot Wheels is built out. */
const RAIL = [
  { id: 'all', label: 'All', Icon: IconBasket },
  { id: 'hw', label: 'Hot Wheels', Icon: IconFlag, badge: 'New', to: '/hot-wheels' },
  { id: 'elec', label: 'Electronics', Icon: IconHeadphones },
  { id: 'beauty', label: 'Beauty', Icon: IconLipstick },
  { id: 'gift', label: 'Gifting', Icon: IconGift },
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
              <IconScooter size={13} /> 1.4 km away
            </span>
          </div>
          <button className="bhdr__addr" type="button">
            <span className="trunc">h.no 9-1-62/2, dubaigate, Hyderabad 500008</span>
            <IconChevronDown size={15} />
          </button>
        </div>

        <div className="bhdr__acts">
          <button className="bhdr__wallet" type="button" onClick={() => nav('/rewards')} aria-label={`Blinkit Cash, ${points} points`}>
            <span className="bhdr__wallet-ic">
              <IconWallet size={19} />
            </span>
            <span className="bhdr__wallet-v">₹{Math.floor(points / 100)}</span>
          </button>
          <button className="bhdr__avatar" type="button" aria-label="Account">
            <IconUser size={21} />
          </button>
        </div>
      </div>

      <button className="bsearch" type="button" onClick={onSearch}>
        <IconSearch size={19} />
        <span className="grow">Search &ldquo;hot wheels&rdquo;</span>
        <i className="bsearch__div" aria-hidden="true" />
        <IconMic size={19} />
      </button>

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

/** Sub-page header: back chevron + title, matching Blinkit's inner screens. */
export function PageHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const nav = useNavigate();
  return (
    <header className="phdr">
      <button className="phdr__back" type="button" aria-label="Go back" onClick={() => (onBack ? onBack() : nav(-1))}>
        <IconChevronLeft size={22} />
      </button>
      <div className="grow">
        <h1 className="phdr__t trunc">{title}</h1>
        {subtitle && <p className="phdr__s trunc">{subtitle}</p>}
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
