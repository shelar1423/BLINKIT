import { useEffect, useState } from 'react';
import { Button } from '../elements';

/* ============================================================
   The first time somebody opens AR.

   Everything else in this app is a screen you have seen before somewhere: a
   list, a cart, a checkout. This one asks the player to hold a phone up at
   their own floor and believe a Hot Wheels track is going to land on it, and
   until the camera opens there is nothing on screen that explains why. A line
   of copy on the gate screen was doing that job, and a sentence describing a
   movement is a sentence you have to picture.

   So: one animation at a time, full screen, in the order the next thirty
   seconds will actually happen in. Look at the floor, drop the track, pull the
   launcher. Three beats, and then the camera.

   It plays itself through rather than asking for a press between each one —
   the three together are shorter than the paragraph they replace — and
   Continue is live from the first frame, so nobody who has done this before
   has to sit through it. Once per device, and `?intro=1` brings it back for a
   demo.
   ============================================================ */

const SEEN_KEY = 'rih-ar-intro-seen';
/** How long each beat holds before the next one takes over. */
const BEAT_MS = 2800;

export function arIntroSeen() {
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

/** Look at the floor: the phone sweeps, and a ring follows where it points. */
function ArtScan() {
  return (
    <svg className="arin__art" viewBox="0 0 120 120" aria-hidden="true">
      <path className="arin__floor" d="M14 96 L106 96" />
      <g className="arin__sweep">
        <ellipse className="arin__ring" cx="72" cy="92" rx="22" ry="9" />
      </g>
      <g className="arin__tip">
        <rect className="arin__phone" x="26" y="18" width="20" height="40" rx="6" />
        <path className="arin__beam" d="M36 58 L72 88" />
      </g>
    </svg>
  );
}

/** Drop the track: a press, and the circuit lands in the ring. */
function ArtPlace() {
  return (
    <svg className="arin__art" viewBox="0 0 120 120" aria-hidden="true">
      <path className="arin__floor" d="M14 96 L106 96" />
      <ellipse className="arin__ring" cx="60" cy="92" rx="30" ry="11" />
      <g className="arin__fall">
        <rect className="arin__track" x="32" y="72" width="56" height="14" rx="7" />
        <rect className="arin__trackline" x="40" y="77" width="40" height="4" rx="2" />
      </g>
      <circle className="arin__press" cx="60" cy="34" r="11" />
    </svg>
  );
}

/** Pull the launcher: the lever goes back, and the car goes. */
function ArtStart() {
  return (
    <svg className="arin__art" viewBox="0 0 120 120" aria-hidden="true">
      <rect className="arin__deck" x="12" y="84" width="96" height="12" rx="6" />
      <g className="arin__lever">
        <rect className="arin__red" x="34" y="44" width="13" height="44" rx="6.5" />
        <rect className="arin__red" x="24" y="26" width="33" height="23" rx="11" />
      </g>
      <g className="arin__car">
        <rect className="arin__body" x="62" y="62" width="40" height="17" rx="7" />
        <circle className="arin__wheel" cx="72" cy="81" r="6" />
        <circle className="arin__wheel" cx="93" cy="81" r="6" />
      </g>
    </svg>
  );
}

const BEATS = [
  { art: <ArtScan />, title: 'Find your floor', body: 'Hold the phone up and look down at a clear patch of floor' },
  { art: <ArtPlace />, title: 'Drop the track', body: 'One press puts the whole circuit in the room with you' },
  { art: <ArtStart />, title: 'Pull the launcher', body: 'Drag the red lever back, let go, and the car is away' },
];

export function ARIntro({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (beat >= BEATS.length - 1) return;
    const id = window.setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
    return () => window.clearTimeout(id);
  }, [beat]);

  const b = BEATS[beat];

  return (
    <div className="arin" role="dialog" aria-label="How AR works">
      <p className="arin__kick">Race in your space</p>

      {/* Keyed on the beat so each drawing is mounted fresh and plays from its
          first frame rather than picking up mid-loop. */}
      <div key={beat} className="arin__stage">
        {b.art}
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
