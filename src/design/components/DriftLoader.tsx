import { useEffect, useState } from 'react';
import './driftloader.css';

/**
 * The wait before a race or an AR session.
 *
 * A length of orange Hot Wheels track laying itself around a circle, starting
 * from the chequered line, then being picked back up — the same track that
 * runs across the campaign — looping for as long as the wait lasts.
 *
 * Pure SVG and CSS: it runs at the exact moment the device is busiest opening
 * a camera or loading the race, so it must not compete for the GPU.
 */

/**
 * How long the loader is held for, at minimum. One constant so the three
 * routes into a race cannot drift apart.
 */
export const LOADER_MS = 3000;

/** Ring radius in the 200-unit viewBox, and the number of chequered squares. */
const R = 76;
const CHECK_COLS = 6;

function TrackRing() {
  const sq = 22 / 3; // three rows across the 22-unit track
  return (
    <svg className="trackload" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        {/* The track is revealed by a stroke drawing round the circle, so every
            layer of it — rails, bed, highlight — lays down together. */}
        <mask id="trackload-draw" maskUnits="userSpaceOnUse">
          <circle
            className="trackload__draw"
            cx="100" cy="100" r={R}
            fill="none" stroke="#fff" strokeWidth="34"
            pathLength={100}
            transform="rotate(-90 100 100)"
          />
        </mask>
      </defs>

      {/* the groove the track is laid into */}
      <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="26" />

      <g mask="url(#trackload-draw)">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#C94F00" strokeWidth="26" />
        <circle cx="100" cy="100" r={R} fill="none" stroke="#FF7A1A" strokeWidth="20" />
        {/* the lit edge of the outer rail */}
        <circle cx="100" cy="100" r={R + 8.5} fill="none" stroke="#FFB070" strokeWidth="1.6" />
        <circle cx="100" cy="100" r={R - 8.5} fill="none" stroke="#E86400" strokeWidth="1.6" />
      </g>

      {/* The start line, at the top where the track sets off from. */}
      <g transform={`translate(${100 - (CHECK_COLS * sq) / 2} ${100 - R - 11})`}>
        {Array.from({ length: 3 }).flatMap((_, row) =>
          Array.from({ length: CHECK_COLS }).map((__, col) => (
            <rect
              key={`${row}-${col}`}
              x={col * sq} y={row * sq} width={sq + 0.05} height={sq + 0.05}
              fill={(row + col) % 2 ? '#1F1F1F' : '#FFFFFF'}
            />
          )),
        )}
      </g>
    </svg>
  );
}

/** What the loader says, one line at a time, for a race. */
export const RACE_LOADER_LINES = [
  'Getting your car ready',
  'Preparing your track',
  'Placing the groceries',
  'Warming up the engine',
];
/** The same, for a race in AR. */
export const AR_LOADER_LINES = [
  'Opening your camera',
  'Finding a flat surface',
  'Building your track',
  'Getting your car ready',
];
const LINE_MS = 1100;

export function DriftLoader({
  lines = RACE_LOADER_LINES,
  suffix,
}: {
  /** Cycled through in order, looping, while the loader is up. */
  lines?: string[];
  /** Appended to whichever line is showing, e.g. a load percentage. */
  suffix?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % lines.length), LINE_MS);
    return () => window.clearInterval(t);
  }, [lines.length]);

  return (
    <div className="driftload" role="status" aria-live="polite">
      {/* The lockup, because this is the one moment the campaign has the whole screen. */}
      <span className="driftload__mast">
        <img src="/brand/hot-wheels.svg" alt="Hot Wheels" />
        <i aria-hidden="true">&times;</i>
        <b>blink<em>it</em></b>
      </span>
      <TrackRing />
      {/* keyed, so each new line plays the fade-up */}
      <p className="driftload__t" key={i}>
        {lines[i % lines.length]}
        {suffix}
      </p>
    </div>
  );
}
