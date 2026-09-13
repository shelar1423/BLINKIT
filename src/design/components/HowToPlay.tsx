import type { ReactNode } from 'react';

/* The three things you do, in the order you do them. */
const HOW_TO: { t: string; icon: string; c: ReactNode }[] = [
  { t: 'point', icon: '/howto/point.svg', c: <>Point your camera at a table or floor</> },
  { t: 'tilt', icon: '/howto/tilt.svg', c: <>Tilt to steer</> },
  { t: 'grab', icon: '/howto/grab.svg', c: <>Grab groceries on the way</> },
];

/** How to play. Opened from the campaign hub's "How it works" pill. */
export function HowToPlay() {
  return (
    <div className="howcard">
      <div className="howcard__hd">
        <h2>How to play</h2>
        <b>Two laps &middot; 45 seconds</b>
      </div>
      {/* The card is WHITE, and that is load-bearing: the supplied icons are
          opaque PNGs with a white ground baked in. */}
      <div className="howgrid">
        {HOW_TO.map((h, i) => (
          <div key={h.t}>
            <span className="howgrid__n">{i + 1}</span>
            <img src={h.icon} alt="" />
            <span className="howgrid__c">{h.c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
