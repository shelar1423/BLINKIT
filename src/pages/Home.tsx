import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../components/blinkit/Chrome';
import { ProductCard } from '../components/blinkit/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { useStore, MAX_RACE_ATTEMPTS } from '../store/useStore';
import { IconFlag } from '../components/Icons';
import { useToast } from '../App';

export default function Home() {
  const nav = useNavigate();
  const { toast } = useToast();
  const racesLeft = useStore((s) => s.racesLeft);

  return (
    <>
      <AppHeader onSearch={() => nav('/hot-wheels')} />
      <main className="page">
        {/* --- campaign takeover: the header's flame red runs straight into this
             block, exactly how Blinkit carries a festival theme down the page,
             and the scalloped edge hands back to the white product feed. --- */}
        <section className="ctake" aria-label="Hot Wheels x Blinkit campaign">
          <span className="ctake__flag" aria-hidden="true" />
          <div className="ctake__mast">
            <img className="ctake__hw" src="/brand/hot-wheels.svg" alt="Hot Wheels" />
            <span className="ctake__x">&times;</span>
            <BlinkitMark className="ctake__bm bmark--on-dark" />
          </div>
          <p className="ctake__kick">LIMITED DROP &middot; 12&ndash;14 NOV</p>
          <h2 className="ctake__t">Race It Home</h2>

          <div className="ctake__grid">
            <button className="ctile ctile--tall" type="button" onClick={() => nav('/race')}>
              <span className="ctile__l">Race It Home</span>
              <span className="ctile__s">Play the track</span>
              <img src="/campaign/02-race-shortcut-card.webp" alt="" loading="lazy" />
            </button>
            <button className="ctile" type="button" onClick={() => nav('/hot-wheels')}>
              <span className="ctile__l">The Drop</span>
              <img src="/campaign/03-drops-shortcut-card.webp" alt="" loading="lazy" />
            </button>
            <button className="ctile" type="button" onClick={() => nav('/rewards')}>
              <span className="ctile__l">Rewards</span>
              <img src="/campaign/04-rewards-shortcut-card.webp" alt="" loading="lazy" />
            </button>
            <button className="ctile" type="button" onClick={() => nav('/leaderboard')}>
              <span className="ctile__l">Leaderboard</span>
              <img src="/campaign/21-friend-challenge-card.webp" alt="" loading="lazy" />
            </button>
            <button className="ctile" type="button" onClick={() => nav('/invite')}>
              <span className="ctile__l">Race a friend</span>
              <img src="/campaign/05-invite-friend-shortcut-card.webp" alt="" loading="lazy" />
            </button>
          </div>

          <span className="ctake__scallop" aria-hidden="true" />
        </section>

        <div className="shell" style={{ paddingTop: 14 }}>
          <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div className="row">
              <span style={{ color: 'var(--hw-r)' }}>
                <IconFlag size={18} />
              </span>
              <div className="grow">
                <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>
                  {racesLeft} of {MAX_RACE_ATTEMPTS} races left today
                </p>
                <p className="t-xs">Collect groceries on the track and turn points into Blinkit Cash.</p>
              </div>
            </div>
            <div className="pips" aria-hidden="true">
              {Array.from({ length: MAX_RACE_ATTEMPTS }).map((_, i) => (
                <i key={i} className={i < racesLeft ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>

        <SectionHeader
          title="Drop Picks"
          subtitle="Delivered in 8 minutes, like everything else"
          action="See all"
          onAction={() => nav('/hot-wheels')}
        />
        <div className="prail">
          {HERO_CARS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <SectionHeader title="Shop by category" action="See all" onAction={() => toast('Categories are out of scope for this build')} />
        <div className="cats-grid">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="cat" type="button" onClick={() => toast('Only the Hot Wheels category is built out')}>
              <span className="cat__im">
                <img src={c.image} alt="" loading="lazy" />
              </span>
              <span className="cat__l">{c.label}</span>
            </button>
          ))}
        </div>

        <SectionHeader title="More from the drop" action="See all" onAction={() => nav('/hot-wheels')} />
        <div className="prail">
          {SHOP_CARS.slice(0, 6).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <p className="shell t-xs" style={{ padding: '20px var(--gut) 28px', lineHeight: 1.6 }}>
          Independent Blinkit &times; Hot Wheels campaign concept. Not affiliated with or endorsed by Blinkit or Mattel.
          Prices, drop times, points and rewards are illustrative.
        </p>
      </main>
    </>
  );
}
