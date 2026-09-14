import { useEffect, useRef, useState } from 'react';

/* ============================================================
   Three, two, one, GO — counted off the launcher, not off a clock.

   The race used to begin the instant the lever was let go, which meant the
   start was whenever the player's thumb happened to finish. A start line
   wants a count: it tells you the race is about to happen, it gives the pull
   a purpose while it is being held, and it turns a drag into a moment.

   It starts when the sled is drawn back and ends on GO, and GO fires the
   launcher whether or not the thumb has left it. Letting go early still
   launches, the way it always did — the count is a promise about when, not a
   gate you have to wait for.

   The figures wear the scorecard's own face: heavy italic with the lighter
   blue set under them, which is the campaign's number treatment everywhere
   else it counts something.
   ============================================================ */

/** How long each figure holds. Four steps: 3, 2, 1, GO. */
const STEP_MS = 620;

export function useLaunchCount({
  /** 0..1 of the sled's travel. The count starts once it is really moving. */
  pull,
  /** True once the car is away: whatever happens, stop counting. */
  launched,
  /** Called on GO with the pull as it stands. */
  onGo,
}: {
  pull: number;
  launched: boolean;
  onGo: (power: number) => void;
}) {
  /* 3, 2, 1, 0 = GO. null = not counting. */
  const [step, setStep] = useState<number | null>(null);
  /* Read at GO rather than closed over, so the power is the pull as it is at
     that instant and not as it was when the count began. */
  const live = useRef(pull);
  live.current = pull;
  const go = useRef(onGo);
  go.current = onGo;

  const counting = step !== null;

  useEffect(() => {
    if (launched || counting) return;
    /* A brush against the lever is not a pull. Past a tenth of its travel the
       player is committed, and that is where the count picks it up. */
    if (pull > 0.1) setStep(3);
  }, [pull, launched, counting]);

  useEffect(() => {
    if (launched) {
      setStep(null);
      return;
    }
    if (step === null) return;
    if (step === 0) {
      /* GO holds on screen for its own beat, and the launcher goes with it. */
      go.current(Math.max(0.35, live.current));
      const id = window.setTimeout(() => setStep(null), STEP_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setStep((n) => (n === null ? null : n - 1)), STEP_MS);
    return () => window.clearTimeout(id);
  }, [step, launched]);

  return step;
}

export function LaunchCount({ step }: { step: number }) {
  return (
    <div className="lcount" role="status" aria-live="assertive">
      {/* Keyed, so every figure is a fresh element and plays its own arrival
          rather than cross-fading into the last one. */}
      <b key={step} className={'lcount__n' + (step === 0 ? ' is-go' : '')}>
        {step > 0 ? step : 'GO!'}
      </b>
    </div>
  );
}
