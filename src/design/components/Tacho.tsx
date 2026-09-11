import { color } from '../constants';

/* ============================================================
   Tachometer.

   The gearbox is only a mechanic if the player can see the moment coming.
   The needle sweep, the shift light and the limiter all have to be legible at
   a glance, over a live camera feed, while steering — so this is a coarse
   segmented arc rather than a fine dial: you read the colour, not the number.
   ============================================================ */

const SEGMENTS = 24;
/** Fraction of the sweep after which the shift light arms. Matches SHIFT_FROM. */
const WINDOW_AT = 0.86;

const R = 46;
const CX = 56;
const CY = 54;
/** A 240-degree sweep, opening downward, like a real instrument. */
const START = 150;
const SWEEP = 240;

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius };
}

export type TachoProps = {
  /** 0..1.05 */
  rpm: number;
  gear: number;
  shiftNow: boolean;
  onLimiter: boolean;
  speedKph: number;
};

export function Tacho({ rpm, gear, shiftNow, onLimiter, speedKph }: TachoProps) {
  const filled = Math.round(Math.min(1, rpm) * SEGMENTS);

  return (
    <div className={'tacho' + (shiftNow ? ' is-shift' : '') + (onLimiter ? ' is-limit' : '')}>
      <svg viewBox="0 0 112 84" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const frac = i / (SEGMENTS - 1);
          const a = START + frac * SWEEP;
          const p1 = polar(a, R - 11);
          const p2 = polar(a, R);
          const isRed = frac >= WINDOW_AT;
          const on = i < filled;
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              strokeWidth={5}
              strokeLinecap="round"
              stroke={on ? (isRed ? color.hwR.hex : color.yellow.hex) : 'rgba(255,255,255,0.18)'}
            />
          );
        })}
      </svg>
      <b className="tacho__gear t-num">{gear}</b>
      <span className="tacho__kph t-num">{speedKph}</span>
      <span className="tacho__unit">KM/H</span>
    </div>
  );
}
