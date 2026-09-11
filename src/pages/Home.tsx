import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { DROP_DATES } from '../data/drop';
import { useDrop } from '../data/useDrop';
import { FlipClock } from '../design/components/FlipClock';
import { Button } from '../design/elements';
import { IconChevronRight, IconFlag } from '../design/elements/Icons';
import { useToast } from '../App';

/**
 * The length of Hot Wheels track across the top of the campaign band, with the
 * car that runs it once on arrival.
 *
 * Off for now: it drew a hard line between the app header and the campaign,
 * and the band is meant to read as one surface running down from the header.
 * Everything it needs is still here — the markup below, .ctake__trackwrap /
 * .ctake__track / .ctake__runner and the runby keyframes in base.css — so this
 * is a one-word change to bring back.
 */
const SHOW_TRACK_DIVIDER = false;

export default function Home() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { status: drop, parts } = useDrop();

  return (
    <>
      <AppHeader onSearch={() => nav('/hot-wheels')} />
      <main className="page">
        {/* --- campaign takeover: the header's flame red runs straight into this
             block, exactly how Blinkit carries a festival theme down the page,
             and the scalloped edge hands back to the white product feed. --- */}
        <section className={'ctake' + (SHOW_TRACK_DIVIDER ? '' : ' ctake--flat')} aria-label="Hot Wheels x Blinkit campaign">
          {SHOW_TRACK_DIVIDER && (
            <span className="ctake__trackwrap" aria-hidden="true">
              <img className="ctake__track" src="/campaign/track-divider.webp" alt="" />
              {/* One pass, on arrival. A car looping forever would become wallpaper
                  and compete with the content underneath; a single run reads as a
                  flourish and then gets out of the way. */}
              <img className="ctake__runner" src="/cars/hollowback-diecast.webp" alt="" />
            </span>
          )}

          {/* Texture. These storefronts hang string lights, stars, diyas and
              gift boxes off the band — decoration is most of what makes them
              read as an occasion. Ours is a racing one, sitting behind
              everything at low opacity: texture, not content.
              The chequered-flag element that used to sit beside it is gone —
              it is a glossy 3D render, it was only ever tolerable because the
              tile grid covered it, and against the open band it read as a
              smudge rather than as decoration. */}
          <img className="ctake__streaks" src="/decor/26-03-speed-line-streaks-element.webp" alt="" aria-hidden="true" />

          {/* Lockup left, drop window right — the shape the festive storefronts
              use for their title row. It also gets the dates out from under the
              flaps, where they were reading as a third unit of the countdown,
              and buys back the height the wordmark now spends. */}
          <div className="ctake__top">
            <span className="ctake__mast">
              <img className="ctake__hw" src="/brand/hot-wheels.svg" alt="Hot Wheels" />
              <span className="ctake__x">&times;</span>
              <BlinkitMark className="ctake__bm bmark--on-dark" />
            </span>
            <span className="ctake__when">{DROP_DATES}</span>
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

          {/* The four tiles are replaced by the thing the campaign is actually
              selling: the car nobody has seen yet. The plate is feathered to
              transparent on every edge so it melts into the band's gradient
              rather than sitting on it as a rectangle.
              Everything the tiles linked to still has a home — the sheet this
              opens carries The Drop, Rewards, Leaderboard and the race, so
              nothing was orphaned by taking the grid away. */}
          <div className="mystery">
            {/* The plate itself opens the detail. It is a separate control from
                the CTA below because a button cannot contain a button. */}
            <button className="mystery__plate" type="button" onClick={() => nav('/hot-wheels')} aria-label="Shop the Hot Wheels drop">
              <img className="mystery__im" src="/campaign/mystery-banner.webp" alt="" />
            </button>

            {/* No card. On the reference storefront the CTA is a bare pill
                sitting straight on the campaign ground — boxing it put a
                second surface between the artwork and the one thing to do. */}
            <Button variant="light" className="mystery__go" onClick={() => nav('/race')}>
              <IconFlag size={17} />
              Race now
            </Button>

            {/* What the cloth is hiding and when it comes off. This was a
                points counter against the unlock threshold, which made the
                reveal sound like a personal score to grind rather than a
                campaign moment everyone shares on the last day. */}
            <p className="mystery__prog">Revealed on the final day of the drop</p>
          </div>

          {/* The way back into the catalogue, closing the band the way the
              reference storefronts do. */}
          <button className="cshop" type="button" onClick={() => nav('/hot-wheels')}>
            <span>Shop all Hot Wheels cars &amp; track sets</span>
            <IconChevronRight size={16} />
          </button>

          <span className="ctake__edge" aria-hidden="true" />
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
