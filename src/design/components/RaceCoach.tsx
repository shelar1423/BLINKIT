
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

export function RaceCoach({
  mode,
  tilt,
}: {
  mode: 'ar' | '3d';
  /** Offered here rather than as its own strip over the race. */
  tilt?: { offer: boolean; onEnable: () => void };
}) {
  const ar = mode === 'ar';
  const steps = [
    /* One word each. Three sentences do not fit across a phone, and they do
       not need to: the drawing beside each word is the instruction, and the
       word is only there to say which drawing you are looking at. */
    { glyph: <GlyphPull />, title: 'Pull' },
    { glyph: <GlyphLift mode={mode} />, title: ar ? 'Tilt to jump' : 'Swipe to jump' },
    { glyph: <GlyphSteer mode={mode} />, title: ar ? 'Tilt to steer' : 'Hold to steer' },
  ];

  return (
    /* A strip over the launcher, not a door in front of it.
     *
     * This used to be a dialog with a dim behind it and a "Got it" button: a
     * screen you had to dismiss before every race, carrying three lines you
     * had read the first time. The gestures are worth showing and the pause is
     * not, so they sit beside the car instead and leave the moment the lever
     * moves. Nothing here takes pointer events; the launcher is live behind
     * it from the first frame. */
    <div className="coachbar" role="note" aria-label="How to race">
      <ol className="coachbar__steps">
        {steps.map((s) => (
          <li key={s.title} className="coachbar__step">
            <span className="coachbar__glyph">{s.glyph}</span>
            <span className="coachbar__t">{s.title}</span>
          </li>
        ))}
      </ol>
      {tilt?.offer && (
        <button type="button" className="coachbar__alt" onClick={tilt.onEnable}>
          Steer by tilting instead
        </button>
      )}
    </div>
  );
}
