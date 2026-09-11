import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { useStore, MAX_RACE_ATTEMPTS } from '../store/useStore';
import { DROP_DATES } from '../data/drop';
import { useDrop } from '../data/useDrop';
import { Countdown } from '../design/components/Countdown';
import { Sheet } from '../design/components/Sheet';
import { IconChevronRight, IconFlag, IconTicket, IconTrophy } from '../design/elements/Icons';
import { useToast } from '../App';

export default function Home() {
  const nav = useNavigate();
  const { toast } = useToast();
  const racesLeft = useStore((s) => s.racesLeft);
  const { status: drop, parts } = useDrop();
  const [details, setDetails] = useState(false);

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

          {/* The campaign name is still artwork, the way Blinkit sets a campaign
              lockup — but at a third of the height it was. It was a billboard
              taking 18% of the fold and pushing the actual shop off screen. */}
          <h2 className="ctake__t">
            <img src="/campaign/race-it-home-wordmark.webp" alt="Race It Home" />
          </h2>

          {/* The countdown is the headline now. A limited drop's one job is to
              say how long you have, and that was a small grey line. */}
          <Countdown
            parts={parts}
            lead={drop.phase === 'ended' ? 'Drop ended' : drop.lead}
            note={`Limited drop · ${DROP_DATES} · Tap for details`}
            onClick={() => setDetails(true)}
          />

          {/* Quick entries, set as Blinkit sets category tiles: small, flat,
              label under the mark. They were 132px cards carrying glossy
              renders, which is neither Blinkit's language nor worth a third of
              the screen. */}
          <div className="ctake__tiles">
            <button className="ctile" type="button" onClick={() => nav('/hot-wheels')}>
              <span className="ctile__ic ctile__ic--drop"><IconTicket size={20} /></span>
              <b>The Drop</b>
              <small>From &#8377;179</small>
            </button>
            <button className="ctile" type="button" onClick={() => nav('/rewards')}>
              <span className="ctile__ic ctile__ic--rew"><IconTrophy size={20} /></span>
              <b>Rewards</b>
              <small>Up to &#8377;75 back</small>
            </button>
            <button className="ctile" type="button" onClick={() => nav('/leaderboard')}>
              <span className="ctile__ic ctile__ic--lead"><IconFlag size={20} /></span>
              <b>Leaderboard</b>
              <small>{drop.phase === 'live' ? 'Live now' : 'Opens 12 Nov'}</small>
            </button>
          </div>

          {/* The activation strip — the thing you came to do. Slimmer, and the
              car is the real die-cast render, which is product photography
              rather than illustration. */}
          <button className="cact" type="button" onClick={() => nav('/race')}>
            <span className="cact__art">
              <img src="/cars/hollowback-diecast.webp" alt="" loading="lazy" />
            </span>
            <span className="cact__c">
              <b>Challenge your friends</b>
              <small>{racesLeft} of {MAX_RACE_ATTEMPTS} races left today</small>
            </span>
            <span className="cact__cta">Race now</span>
          </button>

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

      {/* Tapping the countdown opens the detail rather than pushing a route —
          this is something you read once and dismiss, which is exactly what
          Blinkit uses a sheet for. */}
      <Sheet open={details} onClose={() => setDetails(false)} title="Race It Home">
        <p className="t-sm" style={{ lineHeight: 1.6, color: 'var(--mut)' }}>
          A limited Hot Wheels drop, live {DROP_DATES}. Race the car you buy, collect
          groceries on the way home, and climb the city leaderboard.
        </p>
        <div className="dropfacts">
          <div>
            <span>{drop.phase === 'ended' ? 'Status' : drop.lead}</span>
            <b>{drop.phase === 'ended' ? 'Ended' : drop.remaining}</b>
          </div>
          <div>
            <span>Dates</span>
            <b>{DROP_DATES}</b>
          </div>
          <div>
            <span>Races today</span>
            <b>{racesLeft} of {MAX_RACE_ATTEMPTS}</b>
          </div>
        </div>
        <button className="card rowcard" type="button" onClick={() => { setDetails(false); nav('/rewards'); }}>
          <span className="rowcard__ic"><IconTrophy size={18} /></span>
          <span className="grow"><b>Rewards</b><small>Four tiers, up to &#8377;75 back</small></span>
          <IconChevronRight size={18} />
        </button>
        <button className="card rowcard" type="button" onClick={() => { setDetails(false); nav('/leaderboard'); }}>
          <span className="rowcard__ic"><IconFlag size={18} /></span>
          <span className="grow"><b>Leaderboard</b><small>See where you sit in the city</small></span>
          <IconChevronRight size={18} />
        </button>
        <p className="t-xs" style={{ lineHeight: 1.6, marginTop: 10 }}>
          Buying is independent of the game — you never need to race to own a car.
        </p>
      </Sheet>
    </>
  );
}
