/* ============================================================
   Tilt steering — steer the car by tilting the phone.

   Four things make this more than reading `gamma`:

   1. iOS 13+ gates DeviceOrientation behind a permission call that must run
      inside a user gesture, so support and permission are separate states.
   2. Nobody holds a phone flat. Neutral has to be calibrated from however the
      player is actually holding it at the moment the race starts, not assumed
      to be zero, or the car pulls to one side the whole race.
   3. gamma is the left/right axis only in portrait. In landscape the axes swap
      and one of them inverts, so the screen angle has to be folded in.
   4. The signal is noisy and gamma flips sign near vertical, so it needs a
      dead zone, clamping and smoothing before it touches the engine.
   5. `'DeviceOrientationEvent' in window` is TRUE in desktop Chrome — the API
      exists and simply never fires. Feature-detection alone would hand the
      wheel to a sensor that does not exist and leave the car undriveable, so
      the listener has to prove itself by actually delivering an event.
   ============================================================ */

export type TiltState = 'unsupported' | 'needs-permission' | 'active' | 'denied' | 'no-signal';

type Opts = {
  /** Degrees of tilt from neutral for full lock. */
  fullLockDeg?: number;
  /** Degrees either side of neutral that count as straight. */
  deadZoneDeg?: number;
  /** 0..1 — lower is smoother and laggier. */
  smoothing?: number;
  onSteer: (v: number) => void;
  onStateChange?: (s: TiltState) => void;
};

type PermissionCapableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** iOS 13+ exposes requestPermission; everyone else just works. */
function needsPermission(): boolean {
  const C = window.DeviceOrientationEvent as PermissionCapableCtor | undefined;
  return typeof C?.requestPermission === 'function';
}

export function tiltSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/** A device you can physically tilt: touch-capable with no hover pointer. */
function isHandheld(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia('(pointer: coarse)').matches;
}

export function initialTiltState(): TiltState {
  if (!tiltSupported()) return 'unsupported';
  // Some desktop builds expose requestPermission even with no motion sensor.
  // Prompting there would put "Enable tilt steering" in front of someone who
  // cannot tilt anything, so a permission prompt is gated on a handheld.
  if (needsPermission()) return isHandheld() ? 'needs-permission' : 'unsupported';
  return 'active';
}

export function createTiltSteer(opts: Opts) {
  /* Wider travel and a bigger dead zone than a flat phone needs: in AR the
     phone is held up at arm's length, and a steady hand there still shakes a
     few degrees — which at 22° full lock was a car twitching across lanes. */
  const fullLock = opts.fullLockDeg ?? 28;
  const dead = opts.deadZoneDeg ?? 4;
  const smooth = opts.smoothing ?? 0.1;

  let state: TiltState = initialTiltState();
  let neutral: number | null = null;
  let smoothed = 0;
  let lastAt = 0;
  let lastOut = 0;
  let running = false;
  /** Samples collected right after start, averaged into the neutral point. */
  let calibration: number[] | null = null;
  let sawEvent = false;
  let probe: number | undefined;

  const setState = (s: TiltState) => {
    if (s === state) return;
    state = s;
    opts.onStateChange?.(s);
  };

  /**
   * The device's left/right axis in the *screen's* frame. In portrait that is
   * gamma; rotate the screen and beta takes over, with the sign following the
   * direction of rotation.
   */
  /* How far the phone's left-right axis is tipped from level, in degrees.

     Raw gamma is only that when the phone is near flat. Held up in front of
     you — which is how an AR race is played, and more so while tilting up for
     a jump — gamma races towards ±90 and flips sign as the phone passes
     upright, so the car jerked from lock to lock on a steady hand. The
     device's x axis measured against gravity is the same angle flat, the right
     angle upright, and has no flip anywhere in between. */
  function portraitRoll(beta: number, gamma: number) {
    const r = Math.PI / 180;
    const x = Math.sin(gamma * r) * Math.cos(beta * r);
    return Math.asin(Math.max(-1, Math.min(1, x))) / r;
  }

  function lateralAngle(e: DeviceOrientationEvent): number | null {
    const { beta, gamma } = e;
    if (beta == null || gamma == null) return null;
    const angle = (typeof screen !== 'undefined' && screen.orientation?.angle) || 0;
    switch (angle) {
      case 90:
        return -beta;
      case 270:
      case -90:
        return beta;
      case 180:
        return -portraitRoll(beta, gamma);
      default:
        return portraitRoll(beta, gamma);
    }
  }

  const onOrient = (e: DeviceOrientationEvent) => {
    if (!running) return;
    const raw = lateralAngle(e);
    if (raw == null) return;
    if (!sawEvent) {
      sawEvent = true;
      window.clearTimeout(probe);
    }

    // collect a short burst at the start and average it into neutral
    if (calibration) {
      calibration.push(raw);
      if (calibration.length >= 8) {
        neutral = calibration.reduce((a, b) => a + b, 0) / calibration.length;
        calibration = null;
      }
      return;
    }
    if (neutral == null) {
      neutral = raw;
      return;
    }

    let delta = raw - neutral;
    // gamma wraps at +/-90; treat an implausible jump as a wrap, not a turn
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const sign = Math.sign(delta);
    const mag = Math.max(0, Math.abs(delta) - dead);
    const lin = Math.min(1, mag / (fullLock - dead));
    // a soft start: small tilts nudge, a committed tilt still reaches full lock
    const target = sign * lin * (0.45 + 0.55 * lin);

    /* Smoothed on the clock, not per event: sensors fire at 30, 60 or 100Hz
       depending on the phone, and a fixed share per event made the same
       tilt feel sluggish on one and twitchy on another. */
    const now = performance.now();
    const dtMs = lastAt ? Math.min(100, now - lastAt) : 16;
    lastAt = now;
    const k = 1 - Math.pow(1 - smooth, dtMs / 16.7);
    smoothed += (target - smoothed) * k;
    /* Quantised to 1/50ths: sub-percent sensor noise re-sent every event kept
       the car creeping, which reads as drift rather than control. */
    const out = Math.abs(smoothed) < 0.03 ? 0 : Math.round(smoothed * 50) / 50;
    if (out !== lastOut) {
      lastOut = out;
      opts.onSteer(out);
    }
  };

  return {
    get state() {
      return state;
    },

    /** Must be called from inside a user gesture on iOS. */
    async enable(): Promise<TiltState> {
      if (!tiltSupported()) {
        setState('unsupported');
        return state;
      }
      if (needsPermission()) {
        try {
          const C = window.DeviceOrientationEvent as PermissionCapableCtor;
          const res = await C.requestPermission!();
          if (res !== 'granted') {
            setState('denied');
            return state;
          }
        } catch {
          setState('denied');
          return state;
        }
      }
      setState('active');
      return state;
    },

    start() {
      if (state !== 'active') return;
      running = true;
      calibration = [];
      neutral = null;
      smoothed = 0;
      sawEvent = false;
      window.addEventListener('deviceorientation', onOrient);
      // Prove the sensor is real. Desktop browsers expose the event and never
      // fire it; without this the car would be left with no working control.
      window.clearTimeout(probe);
      probe = window.setTimeout(() => {
        if (sawEvent) return;
        running = false;
        window.removeEventListener('deviceorientation', onOrient);
        setState('no-signal');
      }, 800);
    },

    /** Re-zero to however the phone is being held right now. */
    recalibrate() {
      calibration = [];
      neutral = null;
      smoothed = 0;
    },

    stop() {
      running = false;
      window.clearTimeout(probe);
      window.removeEventListener('deviceorientation', onOrient);
      opts.onSteer(0);
    },
  };
}

export type TiltSteer = ReturnType<typeof createTiltSteer>;
