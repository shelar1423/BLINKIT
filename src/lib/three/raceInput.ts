import * as THREE from 'three';
import { boostBand, raceInteraction, type BoostQuality, type JumpQuality } from '../raceInteractions';

/* ============================================================
   The input side of the three skill moments, shared by both races.

   It lives apart from either session because the AR race and the 3D race score
   the same gates with the same windows and must keep doing so — two copies of
   a scoring rule is two rules, and the leaderboard mixes both.

   What differs between them is only where the aim DIRECTION comes from: the
   phone's own pose in AR, a dragged offset from the chase camera in 3D. Both
   hand a unit vector to the same judge.
   ============================================================ */

/**
 * Aiming at a boost gate.
 *
 * The measurement is the angle between where the phone is pointed and the
 * flame — not a screen-space distance, which would make the gate easier the
 * further away it is and easier again on a wider phone. Degrees are degrees on
 * every device, which is what makes the leaderboard mean anything.
 *
 * A perfect boost needs the aim HELD inside the cone, not flicked through it:
 * without the hold, sweeping the phone across the gate scores the same as
 * aiming at it.
 */
const jumpFwd = new THREE.Vector3();

export function makeBoostAim() {
  let index = -1;
  let world: THREE.Vector3 | null = null;
  let lockedFor = 0;
  /* The best band reached anywhere in the approach, not the band at the
     instant of crossing. At the gate the flame is directly overhead and the
     angle to it swings through ninety degrees in a frame — judging there
     scored a held, well-aimed approach as a miss. */
  let best: BoostQuality = 'miss';
  const toTarget = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  return {
    arm(i: number, p: THREE.Vector3) {
      index = i;
      world = p;
      lockedFor = 0;
      best = 'miss';
    },
    clear() {
      index = -1;
      world = null;
      lockedFor = 0;
      best = 'miss';
    },
    get active() {
      return index >= 0 && !!world;
    },
    /** Returns the live aim, or null when no gate is armed. */
    /**
     * `aimDir` is where the player is pointing and `from` is where they are
     * pointing from — the phone's own pose in AR, the chase camera plus a
     * dragged offset in 3D. The judge never learns which, which is the point:
     * the same cone in degrees for both.
     */
    sample(from: THREE.Vector3, aimDir: THREE.Vector3, dtMs: number) {
      if (index < 0 || !world) return null;
      fwd.copy(aimDir).normalize();
      toTarget.copy(world).sub(from).normalize();
      const errorDeg = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, fwd.dot(toTarget)))));
      const band = boostBand(errorDeg);
      lockedFor = band === 'perfect' ? lockedFor + dtMs : 0;
      if (band === 'perfect' || (band === 'good' && best === 'miss')) best = band;
      return {
        index,
        errorDeg,
        quality: band,
        locked: lockedFor >= raceInteraction.boostLockMs,
      };
    },
    /* A perfect band that was never HELD is a good boost, not a perfect one —
       the player did point at it, they just swept through. */
    resolve(): BoostQuality {
      if (index < 0 || !world) return 'miss';
      if (lockedFor >= raceInteraction.boostLockMs) return 'perfect';
      return best === 'miss' ? 'miss' : 'good';
    },
  };
}

/**
 * The lift.
 *
 * Pitch is read off the CAMERA rather than from a DeviceOrientationEvent, so
 * one implementation covers WebXR — where there is no orientation event, only
 * a head pose — and the camera fallback, where the pose is derived from one.
 * It is the same physical gesture either way: the top of the phone comes up.
 *
 * The brief is firm that this must not try to measure vertical displacement.
 * Browser IMUs cannot do centimetres, and a jump that fails on sensor noise is
 * a race lost to hardware. A pitch delta is something a phone can actually
 * report.
 */
export function makeJumpInput() {
  let open = false;
  let liftAt = 0;
  let base: number | null = null;

  return {
    get isOpen() {
      return open;
    },
    arm() {
      open = true;
      liftAt = 0;
      base = null;
    },
    /** Camera pitch in degrees, positive = nose up. */
    feed(pitchDeg: number) {
      if (!open || liftAt) return;
      // first sample after arming is the baseline, whatever the phone was at
      if (base === null) base = pitchDeg;
      if (pitchDeg - base >= raceInteraction.jumpPitchDeg) liftAt = performance.now();
    },
    /** Swipe or key, for devices that cannot report pitch. */
    manual() {
      if (open && !liftAt) liftAt = performance.now();
    },
    /* Lifting AS the ramp arrives is the skill; lifting the moment the cue
       appears is merely obeying it. */
    resolve(): JumpQuality {
      open = false;
      if (!liftAt) return 'miss';
      const since = performance.now() - liftAt;
      liftAt = 0;
      return since <= raceInteraction.jumpPerfectMs ? 'perfect' : 'good';
    },
  };
}


/** Nose-up angle of a camera, in degrees — the lift gesture, measured. */
export function cameraPitchDeg(camera: THREE.Camera) {
  camera.getWorldDirection(jumpFwd);
  return THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, -jumpFwd.y))));
}

/**
 * A direction the player steers by dragging, for races with no phone pose.
 *
 * The 3D race has a chase camera the player does not control, so the aim is an
 * offset FROM it rather than the camera itself: drag right and the aim swings
 * right of wherever the car is pointed. Measured in radians of yaw and pitch
 * so it lands in the same angular judge the phone's pose does — the gate is
 * the same width in degrees whichever race you are playing.
 */
export function makeDragAim() {
  const MAX = THREE.MathUtils.degToRad(34);
  /** Radians of aim per pixel dragged. Tuned so a thumb-sweep covers the cone. */
  const PER_PX = THREE.MathUtils.degToRad(0.11);
  let yaw = 0;
  let pitch = 0;
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  return {
    nudge(dxPx: number, dyPx: number) {
      yaw = Math.max(-MAX, Math.min(MAX, yaw - dxPx * PER_PX));
      pitch = Math.max(-MAX, Math.min(MAX, pitch - dyPx * PER_PX));
    },
    /** Drifts back to centre, so a gate missed does not leave the aim skewed. */
    settle(dt: number) {
      const k = Math.min(1, dt * 1.6);
      yaw -= yaw * k;
      pitch -= pitch * k;
    },
    reset() {
      yaw = 0;
      pitch = 0;
    },
    direction(camera: THREE.Camera) {
      camera.getWorldDirection(dir);
      e.set(pitch, yaw, 0, 'YXZ');
      q.setFromEuler(e);
      return dir.applyQuaternion(q).normalize();
    },
    get offset() {
      return { yaw, pitch };
    },
  };
}
