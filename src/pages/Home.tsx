import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { useStore, MAX_RACE_ATTEMPTS } from '../store/useStore';
import { DROP_DATES } from '../data/drop';
import { useDrop } from '../data/useDrop';
import { FlipClock } from '../design/components/FlipClock';
import { Sheet } from '../design/components/Sheet';
import { IconChevronRight, IconFlag, IconTrophy } from '../design/elements/Icons';
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

          {/* Texture. These storefronts hang string lights, stars, diyas and
              gift boxes off the band — decoration is most of what makes them
              read as an occasion. Ours is a racing one, and both of these sit
              behind everything at low opacity: texture, not content. */}
          <img className="ctake__streaks" src="/decor/26-03-speed-line-streaks-element.webp" alt="" aria-hidden="true" />
          <img className="ctake__flag" src="/decor/26-01-checkered-flag-element.webp" alt="" aria-hidden="true" />

          <div className="ctake__mast">
            <img className="ctake__hw" src="/brand/hot-wheels.svg" alt="Hot Wheels" />
            <span className="ctake__x">&times;</span>
            <BlinkitMark className="ctake__bm bmark--on-dark" />
          </div>

          {/* Every one of these storefronts sets the campaign name as its own
              piece of lettering — script for Hug Day and Karwa Chauth, a
              glowing lockup for Ice Cream and Harry Potter. Ours is a lockup. */}
          <h2 className="ctake__t">
            <img src="/campaign/race-it-home-wordmark.webp" alt="Race It Home" />
          </h2>

          {/* The countdown is the headline. A row of numbers that merely
              changes is a readout; a split-flap is a mechanism, and the
              seconds flap turns once a second whether or not anyone is
              watching. The hinge is set as a chequer — the one place the flag
              motif costs nothing. */}
          <FlipClock
            parts={parts}
            lead={drop.phase === 'ended' ? 'Drop ended' : drop.lead}
            note={`Limited drop · ${DROP_DATES} · Tap for details`}
            onClick={() => setDetails(true)}
          />

          {/* The sponsor strip every one of these storefronts carries — Cadbury
              and Phool on Diwali, Britannia and Jacob's Creek at Christmas,
              boAt on the GoBoult one. Small letterspaced caps between two
              hairlines, partner beneath. Hot Wheels is a Mattel brand, so that
              is what is actually powering this one; the mast above stays the
              campaign lockup rather than repeating it here.
              Set as type on purpose — swap in the official wordmark if this
              ever goes past a concept. */}
          <div className="cpower">
            <span className="cpower__l">Powered by</span>
            <span className="cpower__b">MATTEL</span>
          </div>

          {/* Four entries, two by two. The illustrations are the supplied
              Blinkit-style set recoloured to Hot Wheels — flat vector, which is
              the house language, so the plaque can be plain and let the artwork
              carry the tile. Mystery Car, Race a Friend and All Models are gone
              from here on purpose: six small tiles was clutter, and the mystery
              drop belongs behind a tap rather than sitting in the grid. */}
          <div className="ctake__cards">
            <button className="ccard" type="button" onClick={() => nav('/hot-wheels')}>
              <span className="ccard__tab">From &#8377;179</span>
              <span className="ccard__l">The Drop</span>
              <img src="/campaign/tile-drop.webp" alt="" loading="lazy" />
            </button>
            <button className="ccard" type="button" onClick={() => nav('/rewards')}>
              <span className="ccard__tab ccard__tab--flame">&#8377;75 back</span>
              <span className="ccard__l">Rewards</span>
              <img src="/campaign/tile-rewards.webp" alt="" loading="lazy" />
            </button>
            <button className="ccard" type="button" onClick={() => nav('/leaderboard')}>
              <span className="ccard__l">Leaderboard</span>
              <img src="/campaign/tile-leaderboard.webp" alt="" loading="lazy" />
            </button>
            <button className="ccard" type="button" onClick={() => nav('/race')}>
              <span className="ccard__l">Challenge Friends</span>
              <span className="ccard__s">{racesLeft} of {MAX_RACE_ATTEMPTS} races left</span>
              <img src="/campaign/tile-challenge.webp" alt="" loading="lazy" />
            </button>
          </div>

          <span className="ctake__scallop" aria-hidden="true" />
        </section>


        {/* The ornamental hand-off. Blinkit closes a campaign band with one of
            these before the feed resumes — the gold flourish above "FESTIVE
            SPECIALS" on Karwa Chauth, the plaque behind "Top Festive Finds" on
            Diwali. Drawn rather than placed: the chequered-flag asset is a
            glossy 3D render, which is not the house language and reads badly
            at full size, so this is a flat chequer between two tapering rules. */}
        <div className="cflourish" aria-hidden="true">
          <i className="cflourish__rule" />
          <span className="cflourish__chq" />
          <i className="cflourish__rule" />
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
        {/* The mystery drop lives here rather than in the grid — it is a
            teaser, and a teaser does not need a permanent tile on the home
            screen. This is the placeholder for the event page it should
            eventually open. */}
        <button className="card rowcard mystrow" type="button" onClick={() => { setDetails(false); nav('/hot-wheels'); }}>
          <span className="rowcard__ic mystrow__ic">?</span>
          <span className="grow"><b>Mystery Car</b><small>Revealed on the final day of the drop</small></span>
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
