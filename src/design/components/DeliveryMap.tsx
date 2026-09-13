import { IconShareUp, IconShrinkDiagonal } from '../elements/Icons';

/* ============================================================
   The live delivery map.

   Every number below is the campaign file's own animation, read straight off
   the design rather than approximated: the car's path is the keyframed track
   the designer drew, the store pin's bob, the flame's flicker, and the pop the
   house makes when the car reaches it. Nothing here was eyeballed.

   The one thing that IS changed is the clock. The design loops in six seconds,
   which is right for a canvas and wrong for a delivery — an order that arrives
   every six seconds is a screensaver. So the same timeline is stretched over
   the whole trip and the page reads its position from the same `u` that moves
   the car, which is what keeps "Arriving in N minutes" honest: the number and
   the picture cannot disagree, because they are the same value.
   ============================================================ */

export const MAP_W = 740;
export const MAP_H = 414;

/** Where on the design's timeline the car reaches the door. */
export const ARRIVE_U = 0.8258;
/** ...and where the handover has finished and the burst has played out. */
export const DONE_U = 0.9;

type Track = { t: number[]; v: number[] };

/**
 * Position on a keyframe track.
 *
 * Every track in this file was authored with linear easing between stops, so
 * a straight lerp reproduces it exactly; there is no curve to approximate.
 */
function sample(tr: Track, u: number) {
  const { t, v } = tr;
  if (u <= t[0]) return v[0];
  const last = t.length - 1;
  if (u >= t[last]) return v[last];
  let i = 1;
  while (i < last && t[i] < u) i++;
  const span = t[i] - t[i - 1];
  const k = span > 0 ? (u - t[i - 1]) / span : 0;
  return v[i - 1] + (v[i] - v[i - 1]) * k;
}

/* ---- the car rig: 62 stops of travel, 51 of heading ---- */
const RIG_X: Track = {
  t: [0, 0.1113, 0.1235, 0.1355, 0.1477, 0.1598, 0.1718, 0.184, 0.1962, 0.2082, 0.2203, 0.2325, 0.2445, 0.2567, 0.2687, 0.2808, 0.293, 0.305, 0.3172, 0.3293, 0.3413, 0.3535, 0.3657, 0.3777, 0.3898, 0.402, 0.414, 0.4262, 0.4383, 0.4503, 0.4625, 0.4747, 0.4867, 0.4988, 0.511, 0.523, 0.5352, 0.5473, 0.5593, 0.5715, 0.5837, 0.5957, 0.6078, 0.62, 0.632, 0.6442, 0.6563, 0.6683, 0.6805, 0.6925, 0.7047, 0.7168, 0.7288, 0.741, 0.7532, 0.7652, 0.7773, 0.7895, 0.8015, 0.8137, 0.8258, 1],
  v: [-13.12, -13.12, -17.67, -22.31, -27.03, -32.2, -39.97, -47.65, -54.84, -62.16, -69.61, -77.18, -84.88, -93.77, -101.24, -106.66, -112.17, -117.75, -123.51, -129.7, -136.37, -143.22, -150.16, -157.2, -165.08, -175.93, -185.57, -195.27, -205.1, -215.05, -226.38, -234.74, -241.59, -248.36, -255.04, -261.6, -268.04, -274.38, -280.64, -286.81, -294.48, -304.41, -312.97, -321.4, -329.7, -337.87, -345.92, -354.92, -362.46, -367.82, -373.08, -378.25, -383.33, -388.32, -393.21, -397.98, -402.64, -407.21, -411.69, -416.09, -420.4, -420.4],
};
const RIG_Y: Track = {
  t: RIG_X.t,
  v: [18.34, 18.34, 24.7, 31.18, 37.79, 44.22, 46.68, 43.06, 38.12, 33.09, 27.97, 22.77, 17.49, 14.94, 20.64, 28.79, 37.07, 45.48, 53.96, 62.31, 70.5, 78.72, 87.06, 95.52, 103.32, 103.05, 96.86, 90.47, 84, 77.44, 75.04, 83.47, 93.23, 102.85, 112.36, 121.76, 131.05, 140.24, 149.29, 158.23, 165.38, 163.25, 157.34, 151.5, 145.75, 140.08, 134.51, 131.76, 137.09, 144.74, 152.27, 159.68, 166.97, 174.13, 181.18, 188.13, 194.96, 201.68, 208.27, 214.73, 221.07, 221.07],
};
const RIG_ROT: Track = {
  t: [0, 0.1355, 0.1477, 0.1598, 0.1718, 0.184, 0.1962, 0.2325, 0.2445, 0.2567, 0.2687, 0.2808, 0.293, 0.305, 0.3172, 0.3293, 0.3413, 0.3535, 0.3657, 0.3777, 0.3898, 0.402, 0.414, 0.4383, 0.4503, 0.4625, 0.4747, 0.4867, 0.4988, 0.511, 0.523, 0.5352, 0.5473, 0.5593, 0.5715, 0.5837, 0.5957, 0.6078, 0.6442, 0.6563, 0.6683, 0.6805, 0.6925, 0.7288, 0.741, 0.7532, 0.7652, 0.7773, 0.7894, 0.7895, 1],
  v: [125.58, 125.58, 126.07, 142.42, 185.67, 212.24, 214.49, 214.49, 209.48, 169.58, 128.65, 123.61, 123.61, 123.66, 125.26, 127.94, 129.7, 129.78, 129.78, 130.07, 153.93, 203.6, 213.37, 213.37, 209.59, 160.62, 125.62, 125.09, 125.09, 125.03, 124.82, 124.65, 124.63, 124.63, 126.49, 163.04, 209.25, 214.72, 214.72, 210.08, 171.01, 130.56, 124.9, 124.9, 124.81, 124.59, 124.36, 124.24, 124.24, 124.23, 124.23],
};
const RIG_OP: Track = { t: [0, 0.0333, 0.075, 0.85, 0.9, 1], v: [0, 0, 1, 1, 0, 0] };

/* ---- the house, and the burst it makes when the car lands ---- */
const HOME_S: Track = { t: [0, 0.8417, 0.87, 0.925, 1], v: [1, 1, 1.2, 1, 1] };
const BURST_O: Track = { t: [0, 0.8333, 0.8633, 0.9583, 1], v: [0, 0, 0.95, 0, 0] };
const BURST_S: Track = { t: [0, 0.8333, 0.9583, 1], v: [0.4, 0.4, 1.35, 1.35] };

export function DeliveryMap({
  u,
  onCollapse,
  onShare,
  label,
}: {
  /** Position on the design's timeline, 0..1. */
  u: number;
  onCollapse: () => void;
  onShare: () => void;
  label: string;
}) {
  const x = sample(RIG_X, u);
  const y = sample(RIG_Y, u);
  const rot = sample(RIG_ROT, u);
  const op = sample(RIG_OP, u);
  const home = sample(HOME_S, u);
  const burstO = sample(BURST_O, u);
  const burstS = sample(BURST_S, u);

  return (
    <div className="trkmap">
      <svg className="trkmap__svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={label}>
        <image href="/track/map-base.svg" x="0" y="0" width={MAP_W} height={MAP_H} />

        <g className="trkmap__store">
          <image href="/track/store-pin.svg" x="551.21" y="43.72" width="62" height="64.48" />
        </g>

        <g className="trkmap__burst" style={{ opacity: burstO, transform: `scale(${burstS})` }}>
          <image href="/track/burst.svg" x="109.74" y="248.52" width="92" height="96.734" />
        </g>

        <g className="trkmap__home" style={{ transform: `scale(${home})` }}>
          <image href="/track/home-pin.svg" x="141.26" y="283.06" width="29" height="40" />
        </g>

        {/* The rig is a single body: the flame is welded behind the car, so it
            turns with it and fades with it rather than being aimed separately. */}
        <g className="trkmap__rig" style={{ opacity: op, transform: `translate(${x}px, ${y}px) rotate(${rot}deg)` }}>
          <g className="trkmap__flame">
            <image href="/track/flame.svg" x="539.49" y="86.99" width="22.4902" height="11.216" />
          </g>
          <image href="/track/car.svg" x="553.51" y="75.35" width="67" height="36" />
        </g>
      </svg>

      <button type="button" className="trkmap__zoom" aria-label="Hide map" onClick={onCollapse}>
        <IconShrinkDiagonal size={20} />
      </button>

      <button type="button" className="trkmap__share" onClick={onShare}>
        <IconShareUp size={15} />
        Share current location
      </button>
    </div>
  );
}
