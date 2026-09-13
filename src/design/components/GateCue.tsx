/* ============================================================
   The boost gate's timing gauge.

   The gate used to be an aim: a crosshair, and a cone in degrees to hold it
   inside. It is a jump now — the hoop hangs above the road and the car drives
   under it unless it leaves the ground — so the only thing the screen has to
   say is WHEN.

   A ring closing onto a fixed target ring. When the two meet, lift. That
   reading is immediate and needs no legend, which matters because the whole
   window is about three seconds long and none of it can be spent working out
   what the gauge means.

   Drawn from `k`, which the engine reports every frame of the run-up and which
   reaches exactly 1 on the ideal takeoff. Past 1 the window is closing, and
   the gauge says so by going red and carrying on shrinking rather than by
   vanishing — a lift that was late has to be legible AS late, or the player
   learns nothing from missing.
   ============================================================ */

/** How much bigger than the target the closing ring starts. */
const SPREAD = 1.7;

export function GateCue({ k, canLift }: { k: number; canLift: boolean }) {
  /* Both bands are measured, not guessed, and both are a fraction of the
     run-up — the gauge IS the window, so what it shows has to be the window's
     real width or it is lying about what a lift costs.

     `now` is gatePerfectSec (0.055s) over the 0.95s run-up: k 0.942 to 1.058.
     `near` is the span that actually carries the car through the hoop, swept
     against the engine: k 0.80 to 1.18. Outside that the car clips the ring,
     which is why past it the gauge says late rather than merely dimming. */
  const now = k >= 0.942 && k <= 1.058;
  const near = !now && k >= 0.8 && k <= 1.18;
  const late = k > 1.18;

  /* Clamped at the bottom so an overdue ring keeps shrinking past the target
     instead of stopping on it and reading as still-good. */
  const scale = Math.max(0.34, 1 + (1 - Math.min(k, 1.6)) * SPREAD);

  return (
    <div
      className={'gatecue' + (late ? ' is-late' : now ? ' is-now' : near ? ' is-near' : '')}
      aria-hidden="true"
    >
      <span className="gatecue__target" />
      <span className="gatecue__closing" style={{ transform: `scale(${scale.toFixed(3)})` }} />
      <span className="gatecue__k">
        {late ? 'Too late' : now ? 'LIFT' : canLift ? 'Tilt up as the rings meet' : 'Swipe up as the rings meet'}
      </span>
    </div>
  );
}
