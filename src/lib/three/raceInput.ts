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
  /** How far toward the threshold the tilt has come, 0..1. */
  let progress = 0;

  return {
    get isOpen() {
      return open;
    },
    get progress() {
      return liftAt ? 1 : progress;
    },
    arm() {
      open = true;
      liftAt = 0;
      base = null;
      progress = 0;
    },
    /** Camera pitch in degrees, positive = nose up. */
    feed(pitchDeg: number) {
      if (!open || liftAt) return;
      // first sample after arming is the baseline, whatever the phone was at
      if (base === null) base = pitchDeg;
      const d = pitchDeg - base;
      progress = Math.max(0, Math.min(1, d / raceInteraction.jumpPitchDeg));
      if (d >= raceInteraction.jumpPitchDeg) liftAt = performance.now();
    },
    /** Swipe or key, for devices that cannot report pitch. */
    manual() {
      if (open && !liftAt) {
        liftAt = performance.now();
        progress = 1;
      }
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
    /** Set the offset outright — for a gyro, which reports an angle already. */
    set(yawRad: number, pitchRad: number) {
      yaw = Math.max(-MAX, Math.min(MAX, yawRad));
      pitch = Math.max(-MAX, Math.min(MAX, pitchRad));
    },
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

/**
 * The phone itself, as an aim.
 *
 * In camera-fallback AR the renderer's camera is the CHASE camera while the
 * race runs — it has to be, or the car drives out of shot the moment you look
 * away. So the phone's pose is not the camera's pose, and reading the camera
 * to find out how the phone is being held returns the game's own framing.
 * That is why every lift came back "No lift": the number being watched could
 * not move however the phone was tilted.
 *
 * This reads the device directly and reports it as an offset from wherever the
 * phone was when the gate or the ramp armed. Relative, not absolute, because
 * nobody holds a phone at a known angle — the gesture is "tilt from here".
 */
export function makeDeviceAim() {
  let baseYaw: number | null = null;
  let basePitch: number | null = null;
  let yawDeg = 0;
  let pitchDeg = 0;
  let live = false;

  /** Shortest way round the circle: alpha wraps at 360. */
  const wrap = (d: number) => ((d + 540) % 360) - 180;

  return {
    get live() {
      return live;
    },
    get pitchDeg() {
      return pitchDeg;
    },
    get yawDeg() {
      return yawDeg;
    },
    feed(alpha: number, beta: number) {
      live = true;
      if (baseYaw === null) {
        baseYaw = alpha;
        basePitch = beta;
      }
      yawDeg = wrap(alpha - baseYaw);
      pitchDeg = beta - (basePitch as number);
    },
    /** Take the phone's current pose as the new rest position. */
    recentre() {
      baseYaw = null;
      basePitch = null;
      yawDeg = 0;
      pitchDeg = 0;
    },
  };
}

/**
 * Dragging the launcher lever that is actually in the scene.
 *
 * The pull used to be a widget pinned to the left of the screen. It worked,
 * but it asked the player to operate a picture of a lever while looking at the
 * real one — and the whole point of putting the track in the room is that the
 * thing you touch is the thing you see move.
 *
 * Down the screen is back on the launcher whatever angle the phone is held at,
 * so the gesture is measured in screen pixels rather than projected onto the
 * track. Projecting it was the first attempt: near-vertical framings made the
 * lever almost impossible to move, because the travel that reads as a long
 * pull on screen is a few millimetres in the track's own plane.
 */
export type LeverTarget = {
  hitLever(ray: THREE.Raycaster): boolean;
  hitLauncher(ray: THREE.Raycaster): boolean;
  leverWorld(out: THREE.Vector3): THREE.Vector3;
  setLaunchPull(k: number): void;
  readonly pull: number;
};

/** How far off the lever a press may land and still take hold, in CSS pixels. */
const GRAB_SLOP_PX = 70;

export function makeLeverDrag(
  engine: LeverTarget,
  camera: THREE.Camera,
  /** The drag is live only while this returns true. */
  canPull: () => boolean,
  onArm: (drawn: boolean) => void,
  onLaunch: (power: number) => void,
  onPull: (k: number) => void,
  /** The canvas the scene is drawn on. Taps are measured against THIS, not the
   *  window — see `grab`. */
  canvas?: HTMLCanvasElement,
) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const lw = new THREE.Vector3();
  let fromY = 0;
  let fromPull = 0;
  let held = false;
  /** Whether this grab ever became a drag. A press that does not is a tap. */
  let moved = false;

  return {
    grab(x: number, y: number) {
      if (!canPull()) return false;

      /* Against the CANVAS's own box, not the window's.

         This was `x / window.innerWidth`, and the canvas is sized to its
         container — which is not the window on any phone whose browser keeps a
         URL bar, and is not the window on a desktop where the scene sits in a
         panel. Every pixel of difference tilts the ray away from the finger,
         so the lever could only be grabbed by pressing some distance off it,
         and on a tall enough mismatch not at all. It worked on the machines it
         was written on, which is exactly how a bug like this survives. */
      const r = canvas
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      if (r.width < 1 || r.height < 1) return false;
      const px = x - r.left;
      const py = y - r.top;
      ndc.set((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);

      /* The lever, or the launcher it belongs to, or near enough to either.
         Three chances, because this is the only control on the screen and
         missing it is not a skill test: people press the machine, not the
         handle, and the handle is the smallest part of it. */
      let ok = engine.hitLever(ray) || engine.hitLauncher(ray);
      if (!ok) {
        engine.leverWorld(lw);
        const p = lw.clone().project(camera);
        // behind the camera projects to nonsense; only trust what is in front
        if (p.z < 1) {
          const sx = ((p.x + 1) / 2) * r.width;
          const sy = ((1 - p.y) / 2) * r.height;
          ok = Math.hypot(sx - px, sy - py) <= GRAB_SLOP_PX;
        }
      }
      if (!ok) return false;
      held = true;
      moved = false;
      fromY = y;
      fromPull = engine.pull;
      onArm(false);
      onPull(engine.pull);
      return true;
    },
    move(y: number) {
      if (!held) return;
      if (Math.abs(y - fromY) > 6) moved = true;
      const k = fromPull + (y - fromY) / raceInteraction.launchMaxPull;
      engine.setLaunchPull(k);
      onArm(engine.pull > 0.5);
      onPull(engine.pull);
    },
    release() {
      if (!held) return;
      held = false;
      const k = engine.pull;
      /* A TAP IS A LAUNCH. Pressing a thing that looks like a control and
         getting nothing is how the old screen lever read as broken; a press
         that never became a drag fires at a middling 55%, and pulling is how
         you earn more than that. A brush mid-drag still springs back. */
      if (!moved && k < 0.1) {
        onPull(0);
        onLaunch(0.55);
        return;
      }
      if (k < 0.1) {
        engine.setLaunchPull(0);
        onArm(false);
        onPull(0);
        return;
      }
      onPull(0);
      onLaunch(k);
    },
    get held() {
      return held;
    },
  };
}

