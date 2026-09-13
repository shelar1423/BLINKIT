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

export const raceInteraction = {
  launchEnabled: true,
  /**
   * Debris on the track.
   *
   * OFF while the launcher, gates and ramp are being tuned: a rebound off a
   * rock is the one thing that can throw the car out of a jump or an aim run,
   * and it makes those three impossible to judge. One word to put back.
   */
  debrisEnabled: false,
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

     These moved when the lap was re-cut to begin mid-straight — which shifted
     every straight by about a tenth and left both gates sitting in corners.
     They are derived from that map, not chosen. */
  boostGates: [0.29, 0.79],

  /** Seconds of warning before the car reaches a gate. */
  boostWarnLead: 0.9,
  /** Angular error, in degrees, for each band. */
  boostPerfectDeg: 7,
  boostGoodDeg: 16,
  /** How long the aim must hold inside the perfect cone to count as locked. */
  boostLockMs: 240,

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

/** What a given angular error is worth, before the lock is considered. */
export function boostBand(errorDeg: number): BoostQuality {
  if (errorDeg <= raceInteraction.boostPerfectDeg) return 'perfect';
  if (errorDeg <= raceInteraction.boostGoodDeg) return 'good';
  return 'miss';
}

export function boostPoints(q: BoostQuality) {
  if (q === 'perfect') return raceInteraction.scoreBoostPerfect;
  if (q === 'good') return raceInteraction.scoreBoostGood;
  return 0;
}
