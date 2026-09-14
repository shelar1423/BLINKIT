import { useEffect, useRef, useState } from 'react';
import { animate, stagger, type AnimationPlaybackControls } from 'motion';
import { Button } from '../elements';

/* ============================================================
   The first time somebody opens AR.

   Everything else in this app is a screen you have seen before somewhere: a
   list, a cart, a checkout. This one asks the player to hold a phone up at
   their own floor and believe a Hot Wheels track is going to land on it, and
   until the camera opens there is nothing on screen that explains why. A line
   of copy on the gate screen was doing that job, and a sentence describing a
   movement is a sentence you have to picture.

   So: one beat at a time, full screen, in the order the next thirty seconds
   will actually happen in. Find the floor, drop the track, pull the launcher.
   Three beats, and then the camera.

   ---- what it is made of ----

   The drawings were flat shapes first — a rounded rect for a phone, another
   for a car — and they were selling something they did not look like. This is
   the one screen whose whole job is to make a player believe a Hot Wheels
   circuit is about to be in their living room, and a diagram of a rectangle
   cannot do that.

   Two of the three beats are now THE GAME: frames captured off the running
   race, the circuit exactly as it lands with the launcher at the line, and the
   car away among the groceries. Nothing here promises anything the next thirty
   seconds does not deliver, which a marketing render cannot claim.

   The first beat is still the campaign's AR render, and has to be: finding a
   surface only exists with a camera behind it, and there is no frame of that
   to capture off a desktop. Swapping in a phone screenshot is a one-line
   change — see SHOTS below.

   Over each frame, the INTERFACE, animated: the scan brackets and their sweep,
   the reticle landing, the chevrons running away up the road. The frame
   carries the promise; the overlay carries the instruction.

   ---- and why a motion library ----

   Each beat is a SEQUENCE: the card settles, and THEN the brackets take hold,
   and THEN the sweep runs. In CSS that means hand-computing every keyframe
   percentage against every other animation's duration, so nothing can be
   retimed without redoing all of it — and the landings come out linear, which
   is what makes a thing look like a picture moving rather than an object
   arriving. Motion (motion.dev, the successor to Framer Motion) gives a
   timeline where each step is placed relative to the last, and real springs,
   so the reticle lands with a settle. Its `animate` is WAAPI-backed, tree
   shakes to a few kB, and rides in the lazily loaded AR chunk rather than in
   the first paint.

   It plays itself through rather than asking for a press between each one, and
   Continue is live from the first frame, so nobody who has done this before
   has to sit through it. It is on EVERY session while this is being tested:
   see ALWAYS_SHOW. With that off it plays once per device, and `?intro=1`
   brings it back.
   ============================================================ */

const SEEN_KEY = 'rih-ar-intro-seen';
/**
 * Testing switch: the intro plays on every AR session rather than once per
 * device. Set to false for the real behaviour, where a player who has already
 * been shown how this works is not shown again.
 */
const ALWAYS_SHOW = true;
/** How long each beat holds before the next one takes over. */
const BEAT_MS = 3600;

export function arIntroSeen() {
  if (ALWAYS_SHOW) return false;
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    /* storage blocked: treat it as unseen, and it simply shows every time */
    return false;
  }
}

export function markARIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* nothing to remember it with; harmless */
  }
}

/** The four corner brackets an AR viewfinder puts around what it is reading. */
function Brackets() {
  return (
    <svg className="arin__ov" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path data-p="br" className="arin__br" d="M8 24 L8 8 L24 8" />
      <path data-p="br" className="arin__br" d="M76 8 L92 8 L92 24" />
      <path data-p="br" className="arin__br" d="M92 76 L92 92 L76 92" />
      <path data-p="br" className="arin__br" d="M24 92 L8 92 L8 76" />
    </svg>
  );
}

const BEATS = [
  {
    /* The only one not captured from the game. See the note at the top. */
    src: '/campaign/13-ar-surface-detection-illustration.webp',
    alt: 'A phone held over a table, finding the surface',
    title: 'Find your floor',
    body: 'Hold the phone up and look down at a clear patch of floor',
    /* The viewfinder reading the room, and the sweep that says it is reading. */
    overlay: (
      <>
        <Brackets />
        <span data-p="sweep" className="arin__sweep" />
      </>
    ),
  },
  {
    src: '/howto/shot-track.jpg',
    alt: 'The Hot Wheels circuit as it lands, with the launcher at the line',
    title: 'Drop the track',
    body: 'One press puts the whole circuit in the room with you',
    /* The reticle landing where the press went, and the ring it sends out. */
    overlay: (
      <svg className="arin__ov" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse data-p="ripple" className="arin__ripple" cx="50" cy="74" rx="32" ry="11" />
        <ellipse data-p="reticle" className="arin__reticle" cx="50" cy="74" rx="32" ry="11" />
      </svg>
    ),
  },
  {
    src: '/howto/shot-race.jpg',
    alt: 'The car away down the circuit, groceries waiting on the road',
    title: 'Pull the launcher',
    body: 'Drag the red lever back, let go, and the car is away',
    /* Chevrons running away up the road: the track telling you which way. */
    overlay: (
      <svg className="arin__ov" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path data-p="chev" className="arin__chev" d="M36 74 L50 66 L64 74" />
        <path data-p="chev" className="arin__chev" d="M38 62 L50 55 L62 62" />
        <path data-p="chev" className="arin__chev" d="M40 51 L50 45 L60 51" />
      </svg>
    ),
  },
];

/** A spring with weight in it: things land and settle rather than easing to a halt. */
const LAND = { type: 'spring', stiffness: 240, damping: 18 } as const;

/**
 * The three timelines.
 *
 * Each is a Motion sequence: every step says when it starts relative to the
 * one before it, so a beat can be retimed by changing one number instead of
 * recomputing a column of keyframe percentages.
 */
function timeline(beat: number, root: HTMLElement): AnimationPlaybackControls | null {
  const all = <T extends Element = Element>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);

  const shot = one('[data-p="shot"]');
  if (!shot) return null;

  /* The photograph drifts in, every beat. Slow, and always the same, because
     it is the ground the overlay is read against and not the point of it. */
  const entrance: [Element, Record<string, unknown>, Record<string, unknown>][] = [
    [shot, { opacity: [0, 1], scale: [1.12, 1.02] }, { duration: 1.1, ease: [0.16, 0.84, 0.36, 1] }],
  ];

  if (beat === 0) {
    const br = all('[data-p="br"]');
    const sweep = one('[data-p="sweep"]');
    if (!sweep) return null;
    return animate(
      [
        ...entrance,
        /* the viewfinder takes hold, one corner at a time */
        [br, { opacity: [0, 1], scale: [0.86, 1] }, { duration: 0.5, delay: stagger(0.07), at: '-0.75', ...LAND }],
        /* and reads the surface, top to bottom */
        [sweep, { opacity: [0, 1, 1, 0], top: ['6%', '90%'] }, { duration: 1.5, ease: 'easeInOut', at: '-0.2' }],
        [sweep, { opacity: [0, 1, 1, 0], top: ['6%', '90%'] }, { duration: 1.5, ease: 'easeInOut', at: '+0.25' }],
      ],
      { repeat: Infinity, repeatDelay: 0.3 },
    );
  }

  if (beat === 1) {
    const reticle = one('[data-p="reticle"]');
    const ripple = one('[data-p="ripple"]');
    if (!reticle || !ripple) return null;
    return animate(
      [
        ...entrance,
        /* the ring lands, with a settle */
        [reticle, { opacity: [0, 1], scale: [0.45, 1] }, { duration: 0.8, at: '-0.6', ...LAND }],
        /* and what the landing sends out across the surface */
        [ripple, { opacity: [0.85, 0], scale: [0.9, 1.9] }, { duration: 1.1, at: '-0.45', ease: 'easeOut' }],
        [ripple, { opacity: [0.7, 0], scale: [0.9, 1.9] }, { duration: 1.1, at: '+0.35', ease: 'easeOut' }],
      ],
      { repeat: Infinity, repeatDelay: 0.4 },
    );
  }

  const chev = all('[data-p="chev"]');
  return animate(
    [
      ...entrance,
      /* the road's own arrows, running away from the car: the direction of
         travel, stated by the track rather than by a label */
      [chev, { opacity: [0, 1, 0], y: [8, -6] }, { duration: 1.1, delay: stagger(0.16), at: '-0.8', ease: 'easeOut' }],
      [chev, { opacity: [0, 1, 0], y: [8, -6] }, { duration: 1.1, delay: stagger(0.16), at: '+0.05', ease: 'easeOut' }],
    ],
    { repeat: Infinity, repeatDelay: 0.2 },
  );
}

export function ARIntro({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (beat >= BEATS.length - 1) return;
    const id = window.setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
    return () => window.clearTimeout(id);
  }, [beat]);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const run = timeline(beat, root);
    return () => run?.stop();
  }, [beat]);

  /* The next render, fetched while this one is being read. Three full-bleed
     photographs that each arrive on a blank card is the one way this screen
     could feel slower than the paragraph it replaced. */
  useEffect(() => {
    BEATS.forEach((b) => {
      const img = new Image();
      img.src = b.src;
    });
  }, []);

  const b = BEATS[beat];

  return (
    <div className="arin" role="dialog" aria-label="How AR works">
      <p className="arin__kick">Race in your space</p>

      {/* Keyed on the beat so each card is mounted fresh and its timeline
          starts from the first frame rather than picking up mid-loop. */}
      <div key={beat} ref={stage} className="arin__stage">
        <img data-p="shot" className="arin__shot" src={b.src} alt={b.alt} />
        {b.overlay}
      </div>

      <div key={`t${beat}`} className="arin__say">
        <b>{b.title}</b>
        <small>{b.body}</small>
      </div>

      <div className="arin__dots" aria-hidden="true">
        {BEATS.map((s, i) => (
          <i key={s.title} className={i === beat ? 'is-on' : undefined} />
        ))}
      </div>

      <Button variant="hwBlue" size="lg" block type="button" onClick={onDone}>
        Continue
      </Button>
    </div>
  );
}
