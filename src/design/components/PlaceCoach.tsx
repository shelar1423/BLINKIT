import { Button } from '../elements';

/* ============================================================
   The briefing BEFORE the track goes down.

   The race has had a drawn briefing for a while — three gestures, each one
   animated, because every instruction in it is a movement. Placement never
   did, and it is the part of AR nobody has done before: the player is holding
   a phone up at their own floor, and the app has been telling them in words to
   point it somewhere and press a button. "Point at the floor" is a sentence
   you have to picture. A phone tipping down until a ring lands on the floor is
   the same instruction, already understood.

   Same three-step shape as the race briefing, and deliberately so — this is
   the first of two panels a first-time player sees, and the second one should
   feel like the next page of the same thing rather than a different screen.

   Aim, drop, adjust. The fourth step, racing, is what the race briefing opens
   with the moment the track is down, so it is not repeated here.
   ============================================================ */

/** Aim: the phone tips down and a ring lands on the floor where it points. */
function GlyphAim() {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      {/* the floor */}
      <path className="cg-floor" d="M4 40 L44 40" />
      {/* where it lands, pulsing in time with the tip */}
      <g className="cg-land">
        <ellipse className="cg-ring" cx="31" cy="39" rx="8" ry="3.4" />
      </g>
      {/* the phone, edge-on, tipping down about its top corner */}
      <g className="cg-aim">
        <rect className="cg-phone" x="9" y="8" width="7" height="17" rx="2.5" />
      </g>
    </svg>
  );
}

/** Drop: a press, and the circuit lands in the ring. */
function GlyphDrop() {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <path className="cg-floor" d="M4 40 L44 40" />
      <ellipse className="cg-ring" cx="24" cy="39" rx="11" ry="4" />
      {/* the circuit, falling in and settling */}
      <g className="cg-fall">
        <rect className="cg-deck" x="13" y="31" width="22" height="6" rx="3" />
      </g>
      {/* the finger that sent it */}
      <circle className="cg-press" cx="24" cy="14" r="4.5" />
    </svg>
  );
}

/** Adjust: the circuit slides under a dragging finger. */
function GlyphShift() {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <path className="cg-arrow" d="M11 24 L5 24" />
      <path className="cg-arrow" d="M8 21 L5 24 L8 27" />
      <path className="cg-arrow" d="M37 24 L43 24" />
      <path className="cg-arrow" d="M40 21 L43 24 L40 27" />
      <g className="cg-shift">
        <ellipse className="cg-ring" cx="24" cy="31" rx="9" ry="3.4" />
        <rect className="cg-deck" x="15" y="23" width="18" height="6" rx="3" />
        <circle className="cg-dot" cx="24" cy="18" r="3.6" />
      </g>
    </svg>
  );
}

export function PlaceCoach({ onDone }: { onDone: () => void }) {
  const steps = [
    { glyph: <GlyphAim />, title: 'Point at the floor', body: 'Clear a bit of space first' },
    { glyph: <GlyphDrop />, title: 'Drop the track', body: 'Press Place track here' },
    { glyph: <GlyphShift />, title: 'Move it if you need', body: 'Drag to shift, pinch to resize' },
  ];

  return (
    <div className="coach" role="dialog" aria-label="How to place your track">
      <div className="coach__dim" />
      <div className="coach__panel">
        <p className="coach__kick">Place your track</p>

        <ol className="coach__steps">
          {steps.map((s, i) => (
            <li key={s.title} className="coach__step">
              <span className="coach__glyph">{s.glyph}</span>
              <span className="coach__txt">
                <b>
                  <i className="coach__n">{i + 1}</i>
                  {s.title}
                </b>
                <small>{s.body}</small>
              </span>
            </li>
          ))}
        </ol>

        <Button variant="hwBlue" block type="button" onClick={onDone}>
          Got it, let’s place
        </Button>
      </div>
    </div>
  );
}
