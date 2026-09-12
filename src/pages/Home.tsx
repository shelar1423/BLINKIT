import { useNavigate } from 'react-router-dom';
import { AppHeader, BlinkitMark, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CARS, CATEGORIES, HERO_CARS, SHOP_CARS, rupees } from '../data/catalog';
import { DROP_DATES } from '../data/drop';
import { useDrop } from '../data/useDrop';
import { FlipClock } from '../design/components/FlipClock';
import { Button } from '../design/elements';
import { IconChevronRight, IconFlag, IconHeart } from '../design/elements/Icons';
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

/**
 * The three ways into the catalogue that sit on the campaign band.
 *
 * Every number on these badges is computed from the catalogue rather than
 * typed, so a tile cannot promise something the listing then contradicts. The
 * reference artwork said "from Rs 149" and "up to 25% off"; the real figures
 * are Rs 179 and 29%, and those are what show.
 */
const SHOP_TILES = (() => {
  const cars = CARS.filter((c) => !c.mystery);
  const cheapest = Math.min(...cars.map((c) => c.price));
  const deepest = Math.max(
    ...cars.map((c) => (c.mrp ? Math.round(((c.mrp - c.price) / c.mrp) * 100) : 0)),
  );
  // the one truck we actually sell
  const truck = cars.find((c) => c.id === 'pickup');
  return [
    {
      id: 'diecast',
      title: 'Die-Cast Cars',
      lead: 'Starting at',
      value: rupees(cheapest),
      image: '/cars/09-02-muscle-car-orange.webp',
      to: '/hot-wheels',
    },
    {
      id: 'track',
      title: 'Track Sets',
      lead: 'Up to',
      value: `${deepest}% OFF`,
      image: '/campaign/tile-tracksets.webp',
      to: '/hot-wheels',
    },
    {
      id: 'trucks',
      title: 'Toy Trucks',
      lead: 'Starting at',
      value: rupees(truck?.price ?? cheapest),
      image: '/cars/09-09-performance-pickup-blue.webp',
      to: '/hot-wheels',
    },
  ];
})();

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

          {/* The band's ground is the campaign artwork itself — the Hot Wheels
              city with the track running through it — rather than an abstract
              streak at low opacity. It is masked away towards the bottom so
              the blue it fades into is the same blue the tiles sit on. */}
          <img className="ctake__bg" src="/campaign/hero-bg.webp" alt="" aria-hidden="true" />

          {/* The artwork itself opens the listing. It sits first among the
              lifted children, so everything after it — the countdown, Race now,
              the tiles — paints over it and keeps its own taps; this only
              catches the parts of the band nothing else is using. A button
              cannot contain a button, which is why it is a sibling rather than
              a wrapper. */}
          <button
            className="ctake__tap"
            type="button"
            aria-label="Shop all Hot Wheels"
            onClick={() => nav('/hot-wheels')}
          />

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

          {/* The concealed car is gone: the band now shows the campaign's own
              artwork instead of a cloth over something withheld, so there is
              nothing left for a reveal plate to conceal. */}
          <div className="mystery">
            <Button variant="light" className="mystery__go" onClick={() => nav('/race')}>
              <IconFlag size={17} />
              Race now
            </Button>
          </div>

          {/* Three ways into the catalogue, on the band's own ground. This
              replaced the full-bleed strip that used to close the band, which
              read as a stray nav bar rather than as a way in. Title and art
              only: a one-line description under each was three more lines of
              grey type competing with the campaign above them. */}
          <div className="cshelf">
            {SHOP_TILES.map((t) => (
              <button
                key={t.id}
                className={'ctile ctile--' + t.id}
                type="button"
                onClick={() => nav(t.to)}
              >
                <span className="ctile__flag">
                  <b>{t.lead}</b>
                  <i>{t.value}</i>
                </span>
                <span className="ctile__t">{t.title}</span>
                <img className="ctile__im" src={t.image} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          {/* Back under the tiles, where it was before they replaced it. The
              tiles are three ways into three parts of the catalogue; this is
              the way into all of it, and removing it left no route to the full
              listing from the band at all. */}
          <button className="cshop" type="button" onClick={() => nav('/hot-wheels')}>
            <span>View all Hot Wheels</span>
            <IconChevronRight size={16} />
          </button>

        </section>

        {/* Drop Picks are the campaign's own shelf, so they stay inside the
            campaign's ground and the chequered edge closes AFTER them. Sitting
            on plain white below the band, the strip above them read as a stray
            nav bar and the shelf read as an unrelated section that happened to
            contain cars. */}
        <section className="dpicks">
          <SectionHeader
            title="Drop Picks"
            subtitle="Delivered in 8 minutes, like everything else"
          />
          <div className="prail">
            {HERO_CARS.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <span className="ctake__edge" aria-hidden="true" />
        </section>

        {/* No action on this one: the grid already IS every category, so a
            "See all" leads nowhere. The real app titles the block by what is in
            it rather than by what you do with it. */}
        <SectionHeader title="Grocery & Kitchen" />
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

        <SectionHeader title="More from the drop" />
        <div className="prail">
          {SHOP_CARS.slice(0, 6).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {/* Blinkit closes every feed with this: the line set huge and ghosted,
            a rule, then the wordmark. It is the end-of-scroll marker, which is
            why it is the thing that belongs here rather than a disclaimer. */}
        <footer className="bfoot">
          <p className="bfoot__line">
            India&rsquo;s last minute app
            <IconHeart className="bfoot__heart" size={44} />
          </p>
          <hr className="bfoot__rule" />
          <p className="bfoot__mark">blinkit</p>
        </footer>
      </main>

    </>
  );
}
