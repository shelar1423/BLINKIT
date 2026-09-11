/* ============================================================
   Flick to shift — a sequential gearbox worked by moving the phone.

   The phone is already the steering wheel. This makes it the shifter too:
   a short sharp flick away from you takes the next gear up, a flick back
   takes one down, exactly like a sequential lever or a paddle.

   Why the phone and not the face: reading a blink needs the front camera, and
   iOS Safari will only run one camera at a time — asking for the front one
   stops the rear one, which is the AR view the race is played in. Motion is
   the one human input that genuinely runs alongside a live camera on iPhone.

   Three things make this more than reading `acceleration`:

   1. `DeviceMotionEvent` has its own iOS permission gate, separate from the
      one `tiltSteer` already asks for — granting orientation does not grant
      motion, so it has to be requested too.
   2. Steering is itself constant motion. A threshold low enough to catch a
      flick also catches an enthusiastic corner, so a shift has to be a sharp
      jerk — high acceleration over a short window — not just a large one.
   3. A single flick rings the sensor for a few hundred milliseconds and would
      register as four shifts. Each detection locks the input out until the
      signal has settled back down.
   ============================================================ */

export type ShiftState = 'unsupported' | 'needs-permission' | 'active' | 'denied' | 'no-signal';

type Opts = {
  onShift: (dir: 1 | -1) => void;
  onStateChange?: (s: ShiftState) => void;
  /** m/s^2 of jerk that counts as a deliberate flick. */
  threshold?: number;
};

type PermissionCapableCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

function needsPermission(): boolean {
  const C = window.DeviceMotionEvent as PermissionCapableCtor | undefined;
  return typeof C?.requestPermission === 'function';
}

export function shiftSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

function isHandheld(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia('(pointer: coarse)').matches;
}

export function initialShiftState(): ShiftState {
  if (!shiftSupported()) return 'unsupported';
  if (needsPermission()) return (isHandheld() ? 'needs-permission' : 'unsupported');
  return isHandheld() ? 'active' : 'unsupported';
}

export function createFlickShifter(opts: Opts) {
  const THRESH = opts.threshold ?? 11;
  /** Below this the flick is considered over and the next one can register. */
  const RELEASE = THRESH * 0.45;
  const set = (s: ShiftState) => {
    if (s !== state) {
      state = s;
      opts.onStateChange?.(s);
    }
  };

  let state: ShiftState = initialShiftState();
  let armed = true;
  let gotSample = false;
  let probe: number | undefined;
  let running = false;

  /* The phone is held in landscape, so the axis that points away from the
     player along the line of sight is the device's Z when flat and its Y when
     upright. Taking the larger of the two means the gesture works however the
     player happens to be holding it, without a calibration step. */
  const onMotion = (e: DeviceMotionEvent) => {
    gotSample = true;
    const a = e.acceleration;
    if (!a) return;
    const y = a.y ?? 0;
    const z = a.z ?? 0;
    const dominant = Math.abs(y) >= Math.abs(z) ? y : z;
    const mag = Math.abs(dominant);

    if (armed && mag >= THRESH) {
      armed = false;
      /* Push away = upshift, pull back = downshift. The sign of the dominant
         axis already encodes which way the phone went. */
      opts.onShift(dominant > 0 ? 1 : -1);
      return;
    }
    if (!armed && mag <= RELEASE) armed = true;
  };

  return {
    get state() {
      return state;
    },

    async enable(): Promise<ShiftState> {
      if (state === 'active') return state;
      if (!shiftSupported()) {
        set('unsupported');
        return state;
      }
      const C = window.DeviceMotionEvent as PermissionCapableCtor;
      if (typeof C.requestPermission === 'function') {
        try {
          const res = await C.requestPermission();
          set(res === 'granted' ? 'active' : 'denied');
        } catch {
          // Thrown when the call is not inside a user gesture.
          set('denied');
        }
      } else {
        set('active');
      }
      return state;
    },

    start() {
      if (state !== 'active' || running) return;
      running = true;
      gotSample = false;
      armed = true;
      window.addEventListener('devicemotion', onMotion);
      /* Desktop Chrome exposes DeviceMotionEvent and never fires it. Prove the
         sensor is real before the HUD promises the player a gearbox they
         cannot work. */
      probe = window.setTimeout(() => {
        if (!gotSample) set('no-signal');
      }, 800);
    },

    stop() {
      running = false;
      window.clearTimeout(probe);
      window.removeEventListener('devicemotion', onMotion);
    },
  };
}

export type FlickShifter = ReturnType<typeof createFlickShifter>;
