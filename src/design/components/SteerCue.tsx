import { useEffect, useState } from 'react';

/* ============================================================
   How to steer, shown once as the race gets going.

   A second after the car leaves the line — long enough that the launch has
   landed, soon enough that the first corner has not — an animated guide plays
   for a few seconds and then leaves on its own:

     tilt   a phone rocking left and right, the arrow on that side lighting as
            it leans, captioned "Tilt left to go left" / "Tilt right to go right"
     press  a ring pulsing over each steering pad in turn, captioned
            "Press left to go left" / "Press right to go right"

   Pure CSS animation and pointer-events: none, so it never takes a touch from
   the race it is explaining.
   ============================================================ */

const DELAY_MS = 1000;
const SHOW_MS = 4200;
const FADE_MS = 300;

export function SteerCue({ mode }: { mode: 'tilt' | 'press' }) {
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

  if (stage === 'wait' || stage === 'gone') return null;

  const cls = 'stcue stcue--' + mode + (stage === 'out' ? ' is-out' : '');

  if (mode === 'tilt') {
    return (
      <div className={cls} role="status" aria-label="Tilt your phone left or right to steer">
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
      <span className="stcue__ring stcue__ring--l" aria-hidden="true" />
      <span className="stcue__ring stcue__ring--r" aria-hidden="true" />
      <p className="stcue__cap stcue__cap--press" aria-hidden="true">
        <span className="stcue__say stcue__say--l">Press left to go left</span>
        <span className="stcue__say stcue__say--r">Press right to go right</span>
      </p>
    </div>
  );
}
