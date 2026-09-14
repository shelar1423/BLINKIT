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

   Everything here is the real thing. A photograph of a real room with a real
   floor in it, and, standing on that floor, the actual circuit and the actual
   car — both rendered straight out of the race engine on a transparent ground
   at the angle you would see them from over the top. Nothing promises anything
   the next thirty seconds does not deliver, which is more than a marketing
   render can say.

   All three beats are the SAME surface, which is the whole point of them: the
   floor with nothing on it and a viewfinder reading it, then that floor with
   the circuit standing on it, then that floor with the car away and running.
   The background never moves; only what is on it changes, and that change is
   the thing being explained. Three unrelated pictures cannot say it.

   Over each frame, the INTERFACE, animated: the scan brackets and their sweep,
   the reticle landing, the circuit arriving on it. The frame carries the
   promise; the overlay carries the instruction.

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
    src: '/howto/surface.webp',
    alt: 'A clear polished floor in a hallway',
    title: 'Find a surface',
    body: 'Point the phone at a clear patch of floor or a table',
    /* The viewfinder reading the room, and the sweep that says it is reading. */
    overlay: (
      <>
        <Brackets />
        <span data-p="sweep" className="arin__sweep" />
      </>
    ),
  },
  {
    src: '/howto/surface.webp',
    alt: 'The Hot Wheels circuit standing on that floor',
    title: 'Drop the track',
    body: 'One press puts the whole circuit in the room with you',
    /* The same floor, and what lands on it. The ring goes down first, then the
       circuit arrives into it. */
    overlay: (
      <>
        <svg className="arin__ov" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse data-p="ripple" className="arin__ripple" cx="50" cy="78" rx="38" ry="8" />
          <ellipse data-p="reticle" className="arin__reticle" cx="50" cy="78" rx="38" ry="8" />
        </svg>
        <img data-p="circuit" className="arin__circuit" src="/howto/circuit.webp" alt="" />
      </>
    ),
  },
  {
    src: '/howto/surface.webp',
    alt: 'The car away down the circuit, groceries waiting on the road',
    title: 'Enjoy the race',
    body: 'Collect the groceries, dodge the debris, beat the clock',
    /* The same table, and the car on it. The ROAD's own chevrons run under the
       car here rather than being drawn on: this is the race, and by now the
       track is explaining itself. */
    overlay: <img data-p="racecar" className="arin__racecar" src="/howto/race.webp" alt="" />,
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
    const circuit = one('[data-p="circuit"]');
    if (!reticle || !ripple || !circuit) return null;
    return animate(
      [
        ...entrance,
        /* the ring goes down where the press went */
        [reticle, { opacity: [0, 1], scale: [0.45, 1] }, { duration: 0.7, at: '-0.7', ...LAND }],
        [ripple, { opacity: [0.85, 0], scale: [0.9, 1.7] }, { duration: 1, at: '-0.4', ease: 'easeOut' }],
        /* and the circuit lands into it, from above, with a settle */
        [circuit, { opacity: [0, 1], y: [-38, 0], scale: [0.9, 1] }, { duration: 1, at: '-0.7', ...LAND }],
        /* off again, so the loop does not jump-cut back to an empty floor */
        [circuit, { opacity: 0, y: -22, scale: 0.94 }, { duration: 0.45, at: '+1.1' }],
        [reticle, { opacity: 0, scale: 0.6 }, { duration: 0.4, at: '-0.4' }],
      ],
      { repeat: Infinity, repeatDelay: 0.25 },
    );
  }

  const car = one('[data-p="racecar"]');
  if (!car) return null;
  return animate(
    [
      ...entrance,
      /* it arrives already moving: in from the near edge, settling into the
         frame, rather than fading up from nothing on the spot */
      [car, { opacity: [0, 1], x: [-26, 0], scale: [1.08, 1] }, { duration: 1.1, at: '-0.85', ...LAND }],
      /* and carries on, out of the far side, so the loop reads as a lap */
      [car, { opacity: [1, 1, 0], x: [0, 30], scale: [1, 0.94] }, { duration: 1.3, at: '+0.9', ease: 'easeIn' }],
    ],
    { repeat: Infinity, repeatDelay: 0.2 },
  );
}

export function ARIntro({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  /* Round and round. It used to stop on the last beat, which left whoever was
     still reading it looking at a still — and somebody who glanced away during
     the launcher had no way back to the surface but a reload. */
  useEffect(() => {
    const id = window.setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), BEAT_MS);
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
