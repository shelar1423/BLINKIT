import { Button } from '../elements';

/* ============================================================
   The briefing, shown once at the top of every race.

   This exists so that the race itself can be silent. Every instruction used to
   live on the racing screen as a floating line of text — "Pull the launcher",
   "Hold either side to steer", "Groceries add points, debris takes them" — and
   they were permanent, because there was never a moment at which the game knew
   you had read them. Stacked over a launcher that fills the lower half of the
   frame, they sat on the one object they were telling you to touch.

   So they move here, all of them, said once against the screen they refer to,
   and after this the only text in a race is the score and the clock.

   Annotated rather than listed: each note sits over the part of the frame it
   is about, with a leader down to a dot, so the mapping from instruction to
   thing is made by position instead of by the reader.
   ============================================================ */

type Note = {
  /** Where the dot goes, in viewport percent. */
  x: number;
  y: number;
  /** Which way the label sits from the dot. */
  side: 'left' | 'right';
  title: string;
  body: string;
};

function notes(mode: 'ar' | '3d'): Note[] {
  const lift = mode === 'ar' ? 'tilt the phone up' : 'swipe up';
  const steer = mode === 'ar' ? 'Tilt left and right' : 'Hold either side of the screen';
  /* Positions are the DOT's, and they are staggered down the frame on
     alternating sides — four cards of this width on a 375pt screen will
     collide if any two share a band. Measured against the narrowest phone the
     campaign targets: the widest row is 247px, so a dot at 12% still leaves
     the card inside the glass. */
  /* Deliberately unnumbered. These were 1, 2, 3 and they read down the page
     as 2, 3, 1 — because the launcher, which you use first, sits at the bottom
     of the frame, which is where its note has to point. A sequence the layout
     cannot honour is worse than no sequence: each note is independently
     actionable, and its position already says what it is about. */
  return [
    {
      x: 14, y: 13, side: 'right',
      title: 'Score and clock',
      body: 'Groceries add points. Hitting things takes them away.',
    },
    {
      x: 84, y: 36, side: 'left',
      title: 'Jump the rings',
      body: `Two fire rings hang over the track. As the closing ring meets the target, ${lift} — the car jumps through the middle and boosts.`,
    },
    {
      x: 12, y: 58, side: 'right',
      title: 'Take the corners',
      body: `${steer}. The car does not turn on its own, and a corner nobody takes ends at the barrier.`,
    },
    {
      x: 82, y: 76, side: 'left',
      title: 'Pull the launcher',
      body: 'Drag the red lever back and let go. The harder the pull, the faster you leave the line.',
    },
  ];
}

export function RaceCoach({
  mode,
  onDone,
  tilt,
}: {
  mode: 'ar' | '3d';
  onDone: () => void;
  /** Offered here rather than as its own strip over the race. */
  tilt?: { offer: boolean; onEnable: () => void };
}) {
  return (
    <div className="coach">
      <div className="coach__dim" />

      {notes(mode).map((n) => (
        <div
          key={n.title}
          className={'coach__note coach__note--' + n.side}
          /* The DOT is what sits on the coordinate, not the middle of the row.
             Anchored by the row's centre — which is what `translate(-50%)`
             does — a card's edge moves whenever its text length changes, and
             two of these ran 50px off the left of the screen. */
          style={n.side === 'right' ? { left: `${n.x}%`, top: `${n.y}%` } : { right: `${100 - n.x}%`, top: `${n.y}%` }}
        >
          <span className="coach__dot" aria-hidden="true" />
          <span className="coach__line" aria-hidden="true" />
          <span className="coach__card">
            <b>{n.title}</b>
            <small>{n.body}</small>
          </span>
        </div>
      ))}

      <div className="coach__foot">
        {tilt?.offer && (
          <button type="button" className="coach__alt" onClick={tilt.onEnable}>
            Steer by tilting instead
          </button>
        )}
        <Button variant="hwBlue" block type="button" onClick={onDone}>
          Got it — let’s race
        </Button>
      </div>
    </div>
  );
}
