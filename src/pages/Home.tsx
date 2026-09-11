import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { useStore, MAX_RACE_ATTEMPTS } from '../store/useStore';
import { useToast } from '../App';

/** The drop closes at the end of 14 Nov; shown as a live countdown. */
function useDropCountdown() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() + 2);
    const tick = () => {
      const ms = Math.max(0, end.getTime() - Date.now());
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, []);
  return label;
}

export default function Home() {
  const nav = useNavigate();
  const { toast } = useToast();
  const racesLeft = useStore((s) => s.racesLeft);
  const dropEndsIn = useDropCountdown();

  return (
    <>
      <AppHeader onSearch={() => nav('/hot-wheels')} />
      <main className="page">
        {/* --- campaign takeover: the header's flame red runs straight into this
             block, exactly how Blinkit carries a festival theme down the page,
             and the scalloped edge hands back to the white product feed. --- */}
        <section className="ctake" aria-label="Hot Wheels x Blinkit campaign">
          <span className="ctake__trackwrap" aria-hidden="true">
            <img className="ctake__track" src="/campaign/track-divider.webp" alt="" />
            {/* One pass, on arrival. A car looping forever would become wallpaper
                and compete with the content underneath; a single run reads as a
                flourish and then gets out of the way. */}
            <img className="ctake__runner" src="/cars/hollowback-diecast.webp" alt="" />
          </span>

          <div className="ctake__mast">
            <img className="ctake__hw" src="/brand/hot-wheels.svg" alt="Hot Wheels" />
            <span className="ctake__x">&times;</span>
            <BlinkitMark className="ctake__bm bmark--on-dark" />
          </div>

          {/* Blinkit sets the campaign name as artwork, not type — the glowing
              "ICE CREAM" lockup, the ornamental Ganesh Chaturthi masthead. */}
          <h2 className="ctake__t">
            <img src="/campaign/race-it-home-wordmark.webp" alt="Race It Home" />
          </h2>
          {/* A date in small caps is easy to scroll past. A countdown states the
              same thing as pressure, which is what a limited drop needs to say. */}
          <div className="ctake__when">
            <span className="ctake__when-pill">
              <i />
              LIMITED DROP
            </span>
            <span className="ctake__when-t">
              Ends in <b>{dropEndsIn}</b>
            </span>
            <span className="ctake__when-d">12&ndash;14 Nov</span>
          </div>

          {/* A row of offer cards, each with its hook on a tab over the top
              edge — the "Starting at ₹29" device. A campaign card carries a
              reason to tap, not just a label. */}
          <div className="ctake__cards">
            <button className="ccard" type="button" onClick={() => nav('/hot-wheels')}>
              <span className="ccard__tab">Starting at ₹179</span>
              <span className="ccard__l">The Drop</span>
              <img src="/campaign/card-drop.webp" alt="" loading="lazy" />
            </button>
            <button className="ccard" type="button" onClick={() => nav('/rewards')}>
              <span className="ccard__tab ccard__tab--flame">Up to ₹75 back</span>
              <span className="ccard__l">Rewards</span>
              <img src="/campaign/card-rewards.webp" alt="" loading="lazy" />
            </button>
            <button className="ccard" type="button" onClick={() => nav('/leaderboard')}>
              <span className="ccard__tab">Live now</span>
              <span className="ccard__l">Leaderboard</span>
              <img src="/campaign/card-leaderboard.webp" alt="" loading="lazy" />
            </button>
          </div>

          {/* The activation strip. On the ice-cream campaign this is where the
              actual mechanic lives — the thing you came to do — with its own
              lockup and a dark pill CTA. Ours is the race. */}
          <div className="cact">
            <span className="cact__art">
              <img src="/cars/hollowback-diecast.webp" alt="" loading="lazy" />
            </span>
            <span className="cact__c">
              <b>Challenge your friends!</b>
              <small>{racesLeft} of {MAX_RACE_ATTEMPTS} races left today</small>
            </span>
            <button className="cact__cta" type="button" onClick={() => nav('/race')}>
              Race now
            </button>
          </div>

          <span className="ctake__scallop" aria-hidden="true" />
        </section>


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
