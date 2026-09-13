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
     Positions are curve `t`, 0..1 around the lap. Two of them, far enough
     apart that the first has finished being scored before the second is
     announced, and neither sits on the start line where the launch already
     has the player's attention. */
  boostGates: [0.3, 0.7],

  /** Seconds of warning before the car reaches a gate. */
  boostWarnLead: 1.4,
  /** Angular error, in degrees, for each band. */
  boostPerfectDeg: 7,
  boostGoodDeg: 16,
  /** How long the aim must hold inside the perfect cone to count as locked. */
  boostLockMs: 240,

  scoreBoostGood: 250,
  scoreBoostPerfect: 500,

  /* ---- the jump ----
     One ramp, at a fixed point of the lap, clear of both gates so the two
     mechanics never ask for the phone at the same moment. */
  jumpAt: 0.5,
  /** Seconds of warning before the takeoff edge. */
  jumpWarnLead: 1.3,
  /** How long the lift gesture is accepted for, in ms, from the cue. */
  jumpWindowMs: 800,
  /** Degrees of upward pitch that count as a lift. */
  jumpPitchDeg: 14,
  /** A lift this early or late in the window is good rather than perfect. */
  jumpPerfectMs: 260,
  /** Seconds the car spends off the road. Fixed — the arc is not negotiable. */
  jumpAirtime: 1.05,
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
