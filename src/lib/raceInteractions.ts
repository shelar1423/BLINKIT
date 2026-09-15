/* ============================================================
   The three AR skill moments, and every number that tunes them.

   One place, because these are the values that get argued about — a lock
   window that feels mean, a perfect cone that feels impossible — and hunting
   them down across the engine, the session and the overlay is how they end up
   contradicting each other.

   Everything here is FIXED. None of it is derived from the room, the device,
   the frame rate or a random seed: the leaderboard is only meaningful if two
   players who drive the same line get the same score, so the gates sit at the
   same point of the lap for everybody and the windows are the same width.
   ============================================================ */

export type BoostQuality = 'perfect' | 'good' | 'miss';

/* The gate used to be an AIM: point the phone at the flame and hold it there.
   It is a JUMP now — the ring is a hoop, the car passes under it at road
   level, and getting through the middle of it means leaving the road on the
   beat. Same gesture as the ramp (the top of the phone comes up), judged on
   when rather than on where. */

/** Length of a race, in simulated seconds. */
export const RACE_SECONDS = 60;

export const raceInteraction = {
  launchEnabled: true,
  /**
   * Debris on the track.
   *
   * Back on. It was off while the launcher, gates and ramp were being tuned —
   * a rebound off a rock is the one thing that can throw the car out of a jump
   * — and with the corners driving themselves again there was nothing at all
   * asking the player to choose a line. Groceries alone are a reason to move
   * across the road; rocks are a reason not to.
   *
   * They are placed clear of the gates and the ramp, so the one thing that
   * could still ruin a jump cannot.
   */
  debrisEnabled: true,
  boostEnabled: true,
  jumpEnabled: true,

  /** Pixels of drag that count as a full launcher pull. */
  launchMaxPull: 140,

  /* ---- boost gates ----
     Positions are curve `t`, 0..1 around the lap. Both sit at the END of a
     straight, and the warning is short enough that the WHOLE aim window falls
     on that straight: measured, the circuit's straights run 0.928-1.073 (the
     start straight, which the lap now begins halfway along), 0.202-0.299,
     0.428-0.573 and 0.702-0.799. Aiming a phone while fighting a corner is
     the thing this whole layout exists to avoid.

     They moved again when the gate stopped being an aim and became a jump.
     An aim wants the gate at the END of a straight, so the whole approach is
     spent not turning. A jump wants it in the MIDDLE, because the arc has to
     take off before the hoop and land after it — and at 0.29 the straight ran
     out nine units past the gate, which put every landing in the corner.
     These are the midpoints of the second and fourth straights, measured from
     that same map. At the boosted top speed of 34 the flight spans 0.205-0.296
     and 0.705-0.796, so ramp and landing are both still on tarmac. */
  /* The first ring is back on the SECOND straight, and it has to be.

     It was moved to 0.48 to buy a few seconds after the launch, and 0.48 is on
     the third straight (0.428-0.573) — which is the jump's. The ramp starts at
     0.432 and the whole jump, climb plus flight, runs 0.136 of a lap: it owns
     that straight end to end. A ring at 0.48 therefore sat on the ramp itself,
     and a takeoff is a lift, so the car went up the slope and through the ring
     in one movement with nothing asked of the player.

     There is no third option. A ring's flight spans 0.091 of a lap at the
     boosted top speed and both ends have to be on tarmac, so it needs a
     straight almost to itself: the start straight is the second ring's, the
     fourth is the loop's, and the third is the jump's. That leaves the second
     (0.202-0.299), whose midpoint is this.

     The cost is that the first ring is early again, about 4.7s after the
     launch. The lap is simply full: launch, ring, jump, loop, ring, flag. */
  boostGates: [0.2505, 0.96],
  /* The last ring moved from the middle of the fourth straight to the end of
     the lap, ~12 units short of the finish line, so the jump is the last thing
     the race asks of you. The start straight runs 0.928-1.073 and the launcher
     that stands on it is gone once the car has launched; a takeoff at the
     beat leaves the road at ~0.914, as the last corner straightens, and lands on the line.

     Lanes, per gate per lap, in road units off the centreline. The first ring
     sits left on lap one and right on lap two, so the rings are a line to
     choose rather than a straight corridor; the last one is centred, and the
     car is steered through it for you — nobody can hold a line while tilting
     the phone up for the jump. */
  /* ---- the loop ----
     A full Hot Wheels loop-the-loop on the left straight (0.702-0.799), which
     the last ring moving to the finish left empty. The car drives right round
     it: the lap pauses at `loopAt` while the car covers the loop's length, then
     carries on. It enters on the left of the road and leaves on the right so
     the two ends of the loop don't meet. The wheel is the loop's for the whole
     way round, and for the run-in to line the car up. */
  loopEnabled: true,
  loopAt: 0.75,
  loopRadius: 6,
  /** Road units either side of the centreline the loop enters and exits at. */
  loopShift: 2.2,
  /** Units of approach over which the car is lined up with the entry. */
  loopLeadIn: 26,

  gateLanes: [
    [0, 0],
    [0, 0],
  ] as number[][],

  /**
   * Seconds of warning before the IDEAL lift, not before the gate.
   *
   * This is the run-up the gauge fills across. It is NOT the window bullet
   * time is held open for, which is the last 70% of it — the two were the same
   * number once, and the only way to give the player more warning was to give
   * them more slow motion. The gauge now appears at full speed and the clock
   * dips later.
   */
  boostWarnLead: 1.3,

  /**
   * How far into a ring's gauge the ring takes the wheel, 0..1.
   *
   * It used to take it the instant the gate armed, which is a full
   * `boostWarnLead` of travel — and both rings sit dead centre, so with two
   * rings a lap plus the loop the car spent most of a lap being driven down
   * the middle of the road by the engine. Steering that does nothing for a
   * third of every lap reads as a car that drives itself.
   *
   * The run-up belongs to the player: that is where the groceries and the
   * rocks are, and picking a line through them is the whole game. The ring
   * only lines the car up for the last stretch, which is when the phone is
   * tipping up for the lift and a line cannot be held anyway.
   */
  gateTakeover: 0.6,

  /**
   * Seconds the car spends in the air over a gate.
   *
   * The takeoff is half an airtime before the gate, so a lift on the beat puts
   * the top of the arc in the middle of the hoop.
   */
  gateAirtime: 0.8,
  /* The hoop itself. The MESH is built from these numbers and so is the
     judge, because the one thing this mechanic cannot afford is for the two to
     disagree: the whole promise is that going through the ring is what scores,
     and a scoring rule that drifts from the geometry breaks that promise
     without anything on screen admitting it. */
  gateRingY: 5.4,
  gateRingRadius: 2.9,
  gateRingTube: 0.42,
  /**
   * How far off the ring's centre the car may be and still count as through.
   *
   * The clear hole has a radius of 2.48. This is 1.6, which leaves room for
   * the car's own body — it is about 1.5 tall — so anything scored as through
   * the ring is unmistakably through it on screen, and anything scored a miss
   * is unmistakably clipping it.
   */
  gateThroughTol: 1.6,

  /* How far off the beat a lift may be for the DOUBLE score, in SIMULATED
     seconds. Only `perfect` is judged on timing; `good` is judged on the
     geometry above, because the arc is flat at the top and a tenth of a second
     either side of the beat looks identical going through the hoop. Paying
     that as a miss is the version of this that makes players furious — you saw
     yourself go through the ring and got nothing.
     Simulated, not real: the leaderboard compares two players who drove the
     same line, and the sim clock is the one thing both of them share whatever
     their frame rate did. Bullet time is what turns these into a reachable
     amount of real time — 0.055 sim is about 180ms of real reaction — rather
     than a widening of the window itself. */
  gatePerfectSec: 0.075,
  /**
   * Past this the car does not leave the road at all.
   *
   * A late lift still jumps — you have to SEE why it did not count, and a car
   * that sails over the ring behind it says that better than any label. Past
   * a third of a second of sim time there is no arc left that reaches the
   * hoop, so the lift is simply dropped and the car drives under it.
   */
  gateAcceptSec: 0.34,
  /** How early a lift may come and still be flown — held for the takeoff point. */
  gateEarlySec: 0.75,

  scoreBoostGood: 250,
  scoreBoostPerfect: 500,

  /* ---- the jump ----
     On the long straight at 0.428-0.573, placed so the climb AND the landing
     both finish before the corner: 13 units of ramp is 0.044 of the lap and
     the airtime another 0.092, which lands the car at 0.568 with the corner
     still ahead of it. A jump that comes down mid-corner lands sideways.

     The cue arms after the first gate's verdict has cleared, so the two
     mechanics never speak over each other. */
  jumpAt: 0.432,
  /** Seconds of warning before the takeoff edge. */
  jumpWarnLead: 1.0,
  /** How long the lift gesture is accepted for, in ms, from the cue. */
  jumpWindowMs: 800,
  /** Degrees of upward pitch that count as a lift. */
  jumpPitchDeg: 14,
  /** A lift this early or late in the window is good rather than perfect. */
  jumpPerfectMs: 260,
  /**
   * Seconds the car spends off the road. Fixed — the arc is not negotiable.
   *
   * 0.8, not 1.05, because airtime is distance: at the boosted top speed of 34
   * the longer hang carried the car 0.121 of a lap and it came down past the
   * end of the straight, in the corner, sideways. At 0.8 the whole jump — ramp
   * and flight — fits inside the straight even at full boost.
   */
  jumpAirtime: 0.8,
  /**
   * And the airtime of a ramp taken WITHOUT a lift: off the lip, and down.
   *
   * Short, because this is not a jump — it is the car running out of ramp.
   * Long enough to be an arc rather than a snap, which is what stops it
   * looking like the car fell through the road.
   */
  jumpDropTime: 0.34,
  /** Peak height above the road, in engine units. */
  jumpHeight: 7.5,

  scoreJumpGood: 200,
  scoreJumpPerfect: 400,
} as const;

export type JumpQuality = 'perfect' | 'good' | 'miss';

export function jumpPoints(q: JumpQuality) {
  if (q === 'perfect') return raceInteraction.scoreJumpPerfect;
  if (q === 'good') return raceInteraction.scoreJumpGood;
  return 0;
}

/**
 * What a gate was worth, judged where the car actually was when it got there.
 *
 * `height` is the car's height at the gate and `errSec` how far the lift was
 * off the beat — or null if nobody lifted. Through the hoop always pays;
 * landing the beat as well pays double.
 */
export function gateBand(height: number, errSec: number | null): BoostQuality {
  const through = Math.abs(height - raceInteraction.gateRingY) <= raceInteraction.gateThroughTol;
  if (!through) return 'miss';
  if (errSec !== null && Math.abs(errSec) <= raceInteraction.gatePerfectSec) return 'perfect';
  return 'good';
}

export function boostPoints(q: BoostQuality) {
  if (q === 'perfect') return raceInteraction.scoreBoostPerfect;
  if (q === 'good') return raceInteraction.scoreBoostGood;
  return 0;
}
