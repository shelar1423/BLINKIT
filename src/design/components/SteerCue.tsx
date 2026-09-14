import { useEffect, useState } from 'react';

/* ============================================================
   How to steer, shown once as the race gets going.

   A second after the car leaves the line — long enough that the launch has
   landed, soon enough that the first corner has not — an animated guide plays
   one full cycle and then leaves on its own:

     tilt   a phone rocking left and right, the arrow on that side lighting as
            it leans, captioned "Tilt left to go left" / "Tilt right to go right"
     press  a ring pulsing over each steering pad in turn, captioned
            "Press left to go left" / "Press right to go right"

   The race is HELD for the whole of it. Playing a guide over a car that is
   already into the first corner asks the player to read and drive at once, and
   whichever they choose they lose the other: watch the guide and the corner is
   missed, drive the corner and the guide has gone by the time they look up.
   So the moment the guide appears the race stops dead, and it starts again the
   instant the guide has faded. `onHold` is how the page is told; both races
   pause and resume their engine on it.

   Under it, a plain black wash at low opacity — enough to take the contrast
   out of the track so the phone and its two captions are the only things on
   screen with any weight. Pure CSS animation and pointer-events: none, so it
   never takes a touch from the race it is explaining.
   ============================================================ */

const DELAY_MS = 1000;
/* Exactly one turn of the loop: left half, right half, gone. It ran for two
   cycles, which is two seconds of a race spent repeating something already
   understood — and the race is standing still for all of it. The CSS loops in
   base.css are 2s to match; changing one without the other cuts the guide off
   mid-gesture. */
const SHOW_MS = 2000;
const FADE_MS = 300;

export function SteerCue({
  mode,
  /** Called with true when the guide takes the screen, false when it has gone.
   *  The race is expected to stand still in between. */
  onHold,
}: {
  mode: 'tilt' | 'press';
  onHold?: (held: boolean) => void;
}) {
  const [stage, setStage] = useState<'wait' | 'on' | 'out' | 'gone'>('wait');

  useEffect(() => {
    const on = window.setTimeout(() => setStage('on'), DELAY_MS);
    const out = window.setTimeout(() => setStage('out'), DELAY_MS + SHOW_MS);
    const gone = window.setTimeout(() => setStage('gone'), DELAY_MS + SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(out);
      window.clearTimeout(gone);
    };
  }, []);

  /* Held from the first frame it is visible to the last. Reported from an
     effect rather than inside the timers so that unmounting mid-guide — the
     race quit, or finished early — always hands the race back. */
  const held = stage === 'on' || stage === 'out';
  useEffect(() => {
    onHold?.(held);
    return () => {
      if (held) onHold?.(false);
    };
  }, [held, onHold]);

  if (stage === 'wait' || stage === 'gone') return null;

  const cls = 'stcue stcue--' + mode + (stage === 'out' ? ' is-out' : '');

  if (mode === 'tilt') {
    return (
      <div className={cls} role="status" aria-label="Tilt your phone left or right to steer">
        <div className="stcue__dim" aria-hidden="true" />
        <div className="stcue__tilt" aria-hidden="true">
          <i className="stcue__arrow stcue__arrow--l" />
          <span className="stcue__phone" />
          <i className="stcue__arrow stcue__arrow--r" />
        </div>
        <p className="stcue__cap" aria-hidden="true">
          <span className="stcue__say stcue__say--l">Tilt left to go left</span>
          <span className="stcue__say stcue__say--r">Tilt right to go right</span>
        </p>
      </div>
    );
  }

  return (
    <div className={cls} role="status" aria-label="Press left or right to steer">
      <div className="stcue__dim" aria-hidden="true" />
      <span className="stcue__ring stcue__ring--l" aria-hidden="true" />
      <span className="stcue__ring stcue__ring--r" aria-hidden="true" />
      <p className="stcue__cap stcue__cap--press" aria-hidden="true">
        <span className="stcue__say stcue__say--l">Press left to go left</span>
        <span className="stcue__say stcue__say--r">Press right to go right</span>
      </p>
    </div>
  );
}
