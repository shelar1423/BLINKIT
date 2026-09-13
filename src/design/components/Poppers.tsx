import { useMemo } from 'react';

/* ============================================================
   Party poppers, fired from the bottom corners when the flag drops.

   The race used to end by being replaced: the second lap completed and the
   result screen was simply there, over a track that was still mid-corner
   behind it. This is the half-second that says "that was the end" before the
   result says "and here is what it was worth".

   Two poppers, one per bottom corner, angled inward and up. Everything is DOM
   and CSS — thirty-odd absolutely positioned scraps of colour is nothing next
   to the WebGL scene they land on top of, and the alternative (a canvas) would
   need its own loop, its own resize handling and its own teardown to draw
   confetti that does not interact with anything.

   Each scrap is two elements, which is what buys the arc: the outer one
   travels sideways at a constant rate, the inner one goes up and then comes
   down. Composed, that is a parabola, and a parabola is the difference between
   confetti and a firework.
   ============================================================ */

/* Hot Wheels flame, Blinkit green, and enough white to sparkle.

   Blinkit's yellow is deliberately not here, and it is the one colour you
   would expect to be. The last second of the fall lands over the result
   screen, whose ground is that same yellow — a sixth of the confetti would
   simply stop existing halfway down. Every colour in this list reads both on
   the dark race and on the reward screen. */
const COLORS = ['#ED1C24', '#FF6A00', '#FFFFFF', '#0B5FD0', '#0C831F', '#FF9A3D'];

const PER_SIDE = 22;

type Scrap = {
  /** How far across the screen it travels, in vw. Signed: inward is positive. */
  dx: number;
  /** Peak height above the corner, in vh. */
  rise: number;
  /** Where it comes down to, in vh below the corner — it leaves at the bottom. */
  fall: number;
  spin: number;
  dur: number;
  delay: number;
  color: string;
  w: number;
  h: number;
  round: boolean;
};

/**
 * Deterministic per index, not random.
 *
 * A popper that throws a different spray every time it fires is a popper
 * nobody can tune: the one run that looks wrong cannot be reproduced. These
 * numbers are a spread, not a surprise — the eye cannot tell the difference at
 * this speed, and the spread is the only part that matters.
 */
function spray(side: 1 | -1): Scrap[] {
  const out: Scrap[] = [];
  for (let i = 0; i < PER_SIDE; i++) {
    const k = i / (PER_SIDE - 1); // 0..1 across the fan
    /* Golden-ratio stepping, so consecutive scraps never land next to each
       other and the fan fills rather than stripes. */
    const j = (i * 0.6180339887) % 1;
    out.push({
      dx: side * (18 + k * 66 + j * 16),
      rise: 34 + j * 46,
      fall: 6 + j * 26,
      spin: side * (220 + j * 520),
      /* Long enough to outlive the engine's outro. The result screen arrives
         at 1.9s; at these durations the scraps are between the top of their
         arc and halfway down when it does, and the last of them are still
         falling a second later. Confetti that has already settled makes the
         two halves of the ending read as two separate events. */
      dur: 2.6 + j * 1.4,
      delay: k * 0.09 + j * 0.06,
      color: COLORS[i % COLORS.length],
      w: j > 0.72 ? 5 : 7,
      h: j > 0.72 ? 5 : 12,
      round: j > 0.72,
    });
  }
  return out;
}

export function Poppers() {
  const sides = useMemo(() => [spray(1), spray(-1)] as const, []);

  return (
    <div className="popr" aria-hidden="true">
      {sides.map((scraps, s) => (
        <div key={s} className={'popr__gun popr__gun--' + (s === 0 ? 'l' : 'r')}>
          {/* the flash of the charge going off, under the paper */}
          <span className="popr__flash" />
          {scraps.map((c, i) => (
            <i
              key={i}
              className="popr__x"
              style={
                {
                  '--dx': `${c.dx}vw`,
                  '--dur': `${c.dur}s`,
                  '--delay': `${c.delay}s`,
                } as React.CSSProperties
              }
            >
              <b
                className={'popr__y' + (c.round ? ' is-dot' : '')}
                style={
                  {
                    '--rise': `${-c.rise}vh`,
                    '--fall': `${c.fall}vh`,
                    '--spin': `${c.spin}deg`,
                    '--c': c.color,
                    '--w': `${c.w}px`,
                    '--h': `${c.h}px`,
                  } as React.CSSProperties
                }
              />
            </i>
          ))}
        </div>
      ))}
    </div>
  );
}
