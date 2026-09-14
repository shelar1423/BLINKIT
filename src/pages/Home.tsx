import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStartRace } from '../lib/useStartRace';
import { AppHeader, SectionHeader } from '../design/components/Chrome';
import { ProductCard } from '../design/components/ProductCard';
import { CATEGORIES, HERO_CARS, SHOP_CARS } from '../data/catalog';
import { useDrop } from '../data/useDrop';
import { FlipClock } from '../design/components/FlipClock';
import { Button } from '../design/elements';
import { IconChevronRight, IconFlag, IconHeart } from '../design/elements/Icons';
import { useToast } from '../App';
import { DriftLoader, LOADER_MS } from '../design/components/DriftLoader';
import { preloadCar } from '../lib/three/modelLoader';

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
 * Each tile is a finished card cut-out — title and product drawn in — so the
 * title here is only the image's accessible name.
 */
const SHOP_TILES = [
  { id: 'diecast', title: 'Die-Cast Cars', image: '/campaign/card-diecast.webp', to: '/hot-wheels' },
  { id: 'track', title: 'Track Sets', image: '/campaign/card-track.webp', to: '/hot-wheels' },
  { id: 'trucks', title: 'Trucks', image: '/campaign/card-trucks.webp', to: '/hot-wheels' },
];

export default function Home() {
  const nav = useNavigate();
  const { toast } = useToast();
  const startRace = useStartRace();
  const { status: drop, parts } = useDrop();
  /* The storefront's Race now gets the same hold as the ones deeper in. It is
     the first press of the campaign, so it is the one that most wants to feel
     like the start of something rather than a page change. */
  const [launching, setLaunching] = useState(false);

  /* Warm the car the loader will show. Cold, the GLB takes about two seconds to
     arrive — most of the three-second hold — so the drift only started as the
     hold was ending and the ring span empty. Fetching it while the user is
     still reading the home screen means the car is there from the first frame. */
  useEffect(() => {
    const url = HERO_CARS[0]?.glb;
    if (url) preloadCar(url);
  }, []);

  return (
    <>
      {launching && <DriftLoader />}

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
          {/* The co-brand lockup and the drop dates used to sit here. Both are
              gone: Blinkit's own festive takeovers give this band to ONE piece
              of lettering and nothing else — Ganesh Chaturthi carries no
              partner mark and no date — and the two of them were splitting the
              attention the campaign name is supposed to have all of. The dates
              still run in the countdown directly below. */}

          {/* Every one of these storefronts sets the campaign name as its own
              piece of lettering — script for Hug Day and Karwa Chauth, a
              glowing lockup for Ice Cream and Harry Potter. Ours is a lockup.

              And ours arrives the way the campaign is about arriving: streaks
              come through from the right, the name lands with them and takes
              the hit, and the chrome catches the light once. The whole thing
              is the `RACE IT HOME — logo animation` rig from the Figma file,
              played at the band's scale — speed lines, shake, impact flash,
              two flame glows and a masked shine sweep. It plays on every load
              because it is the first frame of the campaign, and it is over
              inside two seconds because the countdown underneath it has to be
              the thing still moving afterwards. */}
          <h2 className="ctake__t">
            {/* Six streaks, at the rig's own spacing and lengths. They bleed
                the full width of the band rather than the width of the
                lettering: in the rig they start off the right edge of a
                1920-wide frame, so they are the band crossing, not a
                decoration attached to the logo. */}
            <span className="ctake__lines" aria-hidden="true">
              <i className="ctake__ln ctake__ln--1" />
              <i className="ctake__ln ctake__ln--2" />
              <i className="ctake__ln ctake__ln--3" />
              <i className="ctake__ln ctake__ln--4" />
              <i className="ctake__ln ctake__ln--5" />
              <i className="ctake__ln ctake__ln--6" />
            </span>
            <span className="ctake__flash" aria-hidden="true" />
            <span className="ctake__rig">
              <span className="ctake__glow ctake__glow--l" aria-hidden="true" />
              <span className="ctake__glow ctake__glow--r" aria-hidden="true" />
              <img src="/campaign/race-it-home-wordmark.webp" alt="Race It Home" />
              {/* The rig masks its highlight to the wordmark's own paths, so
                  the light travels through the letters and not across the box
                  they sit in. The artwork is RGBA with a transparent ground,
                  which is what lets the same image serve as its own mask. */}
              <span className="ctake__shine" aria-hidden="true" />
            </span>
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
            {/* The hub, not the starting grid. Race now from the storefront is an
                invitation into the campaign — your points, your Blinkit Cash,
                your best run — and the race itself is one press further in.
                Jumping straight to the grid skipped everything the campaign is
                keeping score of. */}
            <Button
              variant="hwTrack"
              className="mystery__go"
              disabled={launching}
              onClick={() => {
                setLaunching(true);
                window.setTimeout(() => startRace(), LOADER_MS);
              }}
            >
              <IconFlag className="mystery__flag" size={20} aria-hidden="true" />
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
                {/* The card is the artwork: title, product and the peg-hook
                    outline are all drawn into the image. */}
                <img className="ctile__im" src={t.image} alt={t.title} loading="lazy" />
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
          <h2 className="dpicks__t">
            Drop Picks
            <img src="/brand/drop-flag.png" alt="" />
          </h2>
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
          {/* The break is written, not left to the measure. It falls in the
              right place at this size on a 390pt phone and would fall
              somewhere else on a narrower one or a wider one, and "India's
              last / minute app" is the line, not a lucky wrap. */}
          <p className="bfoot__line">
            <span>India&rsquo;s last</span>
            <span>
              minute app
              <IconHeart className="bfoot__heart" size={52} />
            </span>
          </p>
          <hr className="bfoot__rule" />
          <p className="bfoot__mark">blinkit</p>
        </footer>
      </main>

    </>
  );
}
