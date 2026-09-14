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
  /* Both bands are measured against the engine, not guessed — the gauge IS
     the window, so what it shows has to be the window's real width or it is
     lying about what a lift costs. Swept at 0.025 of k:

       scores at all   k 0.78 .. 1.22   (the car clears the hoop)
       scores perfect  k 0.93 .. 1.06   (and lands the beat)

     Outside the wider band the car clips the ring, which is why past it the
     gauge says late rather than merely dimming. Re-swept every time the run-up
     changes length: the tolerances are fixed in seconds, so a shorter run-up
     makes each of them a LARGER fraction of the gauge, and bands left at their
     old numbers would quietly start lying. */
  const now = k >= 0.93 && k <= 1.06;
  const near = !now && k >= 0.78 && k <= 1.22;
  const late = k > 1.22;

  /* Clamped at the bottom so an overdue ring keeps shrinking past the target
     instead of stopping on it and reading as still-good. */
  const scale = Math.max(0.34, 1 + (1 - Math.min(k, 1.6)) * SPREAD);

  return (
    <div
      className={'gatecue' + (late ? ' is-late' : now ? ' is-now' : near ? ' is-near' : '')}
      aria-hidden="true"
    >
      {/* Three chevrons climbing upward, above the rings: the instruction is a
          movement — bring the phone up — so the cue shows which way. */}
      {!late && (
        <span className="gatecue__up">
          <i /><i /><i />
        </span>
      )}
      <span className="gatecue__target" />
      <span className="gatecue__closing" style={{ transform: `scale(${scale.toFixed(3)})` }} />
      <span className="gatecue__k">
        {late ? 'Too late' : now ? 'LIFT' : canLift ? 'Tilt up as the rings meet' : 'Swipe up as the rings meet'}
      </span>
    </div>
  );
}
