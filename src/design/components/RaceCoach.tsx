import { useEffect, useState } from 'react';
import { Button } from '../elements';

/* ============================================================
   The briefing, shown once at the top of every race.

   This was an ANNOTATED overlay first — notes pinned over the frame with
   leaders down to dots, each pointing at the thing it described. On a phone,
   in AR, it fell apart, and the reason is worth writing down: at briefing time
   the only thing on screen is the launcher. There are no fire rings yet, no
   corner, no score. Three of the four dots landed on the player's own living
   room — one on a chair, one on the edge of a table — and pointed at them with
   complete confidence.

   Annotation only works when its subject is on screen. Here it is not, so the
   briefing has to CARRY its subjects instead of pointing at them.

   Each control is drawn, as a small animation of the gesture itself: a lever
   pulled back, a phone tipping up, a phone rocking side to side. Motion is the
   right medium because every one of these instructions IS a motion — "tilt up"
   in words is a sentence you have to picture, and the same thing shown as a
   phone tipping back is understood before you have finished the line beside
   it.

   And they are shown ONE AT A TIME. All three drawings running at once is
   three moving things competing for the same glance, and a player reading the
   corner line watches the launcher out of the corner of their eye. So the
   briefing walks: the step being demonstrated is lit and its drawing is the
   only one moving, the other two sit back at a third of their weight. The
   race is held for the whole of it — see `setHeld` in the scenes — so nothing
   is happening behind this that the player is missing.
   ============================================================ */

/** How long each step holds the light before the briefing walks to the next. */
const STEP_MS = 2400;

/** The launcher: a lever drawn back, and the arrow saying which way. */
function GlyphPull() {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <rect className="cg-deck" x="4" y="35" width="40" height="6" rx="3" />
      <g className="cg-lever">
        <rect className="cg-red" x="14" y="15" width="6" height="22" rx="3" />
        <rect className="cg-red" x="9" y="7" width="16" height="11" rx="5" />
      </g>
      <path className="cg-arrow" d="M34 16 L34 30" />
      <path className="cg-arrow" d="M30 26 L34 31 L38 26" />
    </svg>
  );
}

/**
 * The gate: the hoop, and the gesture that gets you through it.
 *
 * In AR the phone is drawn EDGE-ON — a narrow bar rotating about its foot —
 * because tipping a phone away from you is a rotation in depth, and a face-on
 * phone rotating in the plane of the screen reads as turning it sideways
 * instead. In profile the same rotation is unambiguous.
 *
 * In the 3D race there is no phone to tip: the gesture is a thumb, so it is
 * drawn as one, with a trail behind it.
 */
function GlyphLift({ mode }: { mode: 'ar' | '3d' }) {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <circle className="cg-ring" cx="24" cy="13" r="9.5" />
      <path className="cg-arrow" d="M24 31 L24 21" />
      <path className="cg-arrow" d="M20 25 L24 20 L28 25" />
      {mode === 'ar' ? (
        <g className="cg-tip">
          <rect className="cg-phone" x="21" y="31" width="6" height="15" rx="2" />
        </g>
      ) : (
        <g className="cg-swipe">
          <path className="cg-trail" d="M24 46 L24 38" />
          <circle className="cg-dot" cx="24" cy="38" r="4" />
        </g>
      )}
    </svg>
  );
}

/** Steering: the phone rocks left and right. */
function GlyphSteer({ mode }: { mode: 'ar' | '3d' }) {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <path className="cg-arrow" d="M10 24 L4 24" />
      <path className="cg-arrow" d="M7 21 L4 24 L7 27" />
      <path className="cg-arrow" d="M38 24 L44 24" />
      <path className="cg-arrow" d="M41 21 L44 24 L41 27" />
      <g className="cg-rock">
        <rect className="cg-phone" x="17" y="12" width="14" height="24" rx="3" />
        {mode === '3d' && <circle className="cg-dot" cx="24" cy="30" r="3.6" />}
      </g>
    </svg>
  );
}

export function RaceCoach({ mode, onDone }: { mode: 'ar' | '3d'; onDone: () => void }) {
  const ar = mode === 'ar';
  const steps = [
    { glyph: <GlyphPull />, title: 'Pull the launcher', body: 'Drag back, let go' },
    { glyph: <GlyphLift mode={mode} />, title: 'Jump the fire rings', body: ar ? 'Tilt up on the beat' : 'Swipe up on the beat' },
    {
      glyph: <GlyphSteer mode={mode} />,
      title: 'Take the corners',
      body: ar ? 'Tilt left to go left, right to go right' : 'Hold left to go left, right to go right',
    },
  ];

  /* -1 lights every step at once, which is where a player who has asked for
     less motion starts and stays: a walking spotlight is itself an animation. */
  const [step, setStep] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? -1 : 0,
  );

  useEffect(() => {
    if (step < 0) return;
    const id = window.setInterval(() => setStep((i) => (i + 1) % 3), STEP_MS);
    return () => window.clearInterval(id);
  }, [step < 0]);

  return (
    <div className="coach" role="dialog" aria-label="How to race">
      <div className="coach__dim" />
      <div className="coach__panel">
        <p className="coach__kick">How to race</p>

        <ol className="coach__steps">
          {steps.map((s, i) => (
            <li key={s.title} className={'coach__step' + (step < 0 || step === i ? ' is-on' : '')}>
              {/* Keyed on whether it is lit, so the drawing is remounted and
                  the gesture plays from the top each time the light reaches
                  it rather than resuming wherever it was paused. */}
              <span key={step === i ? 'on' : 'off'} className="coach__glyph">
                {s.glyph}
              </span>
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
          Got it, let’s race
        </Button>
      </div>
    </div>
  );
}
