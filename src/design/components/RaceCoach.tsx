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

   Each step is drawn, as a small animation of the thing itself: a lever pulled
   back, a phone rocking side to side, a bag lifting off the lane while a chunk
   of rock tumbles beside it. Motion is the right medium because every one of
   these instructions IS a motion — "tilt left" in words is a sentence you have
   to picture, and the same thing shown as a phone leaning is understood before
   you have finished the line beside it.

   The jump is not here. It has its own cue in the race, on the approach to
   every gate, which is the moment it can actually be acted on — a gesture
   explained on a briefing screen and then not needed for twenty seconds is a
   gesture that has to be explained twice.

   All three at once, all three lit. A walking spotlight was tried — one step
   demonstrated at a time with the other two sat back — and it reads as the
   briefing deciding how fast you get to read it. Three short lines are taken
   in at a glance; the race is held for the whole of it (see `setHeld` in the
   scenes), so there is no reason to ration them.
   ============================================================ */

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


/**
 * The track's two loose objects: one you want and one you do not.
 *
 * Drawn side by side rather than as two rows, because the instruction is the
 * pair — a lane with things in it, some worth hitting and some not. The bag
 * lifts and brightens as it is taken; the chunk tumbles and stays grey.
 */
function GlyphPick() {
  return (
    <svg className="cg" viewBox="0 0 48 48" aria-hidden="true">
      <path className="cg-floor" d="M4 42 L44 42" />
      {/* the grocery bag, collected */}
      <g className="cg-grab">
        <path className="cg-handle" d="M12 20 a5 5 0 0 1 10 0" />
        <rect className="cg-bag" x="8" y="20" width="18" height="17" rx="3" />
      </g>
      {/* the debris, tumbling past */}
      <g className="cg-chunk">
        <path className="cg-deck" d="M36 24 L43 28 L41 36 L33 36 L31 28 Z" />
      </g>
    </svg>
  );
}

export function RaceCoach({ mode, onDone }: { mode: 'ar' | '3d'; onDone: () => void }) {
  const ar = mode === 'ar';
  const steps = [
    { glyph: <GlyphPull />, title: 'Pull the launcher', body: 'Drag back, let go' },
    /* Steering, not corners. "Take the corners" described a moment rather than
       a control, and left the impression that the wheel is only wanted at the
       bends and that the throttle must be somebody's job in between. Neither
       is true: the car drives itself for the whole lap and steering is the
       only thing the player ever does with it, so that is what the step
       says. */
    {
      glyph: <GlyphSteer mode={mode} />,
      title: 'Steer the car',
      body: ar ? 'Tilt left or right' : 'Tap left or right',
    },
    /* What the lane is FOR. The first two steps are how the car is driven;
       this is why it is being driven anywhere, and it is the only one of the
       three that changes the score. */
    { glyph: <GlyphPick />, title: 'Collect the groceries', body: 'And avoid the debris' },
  ];

  return (
    <div className="coach" role="dialog" aria-label="How to race">
      <div className="coach__dim" />
      <div className="coach__panel">
        <p className="coach__kick">How to race</p>

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

        <p className="coach__sound-note">Turn off Silent Mode to hear game audio.</p>

        <Button variant="hwBlue" block type="button" onClick={onDone}>
          Got it, let’s race
        </Button>
      </div>
    </div>
  );
}
