/* ============================================================
   A manual gearbox.

   The race had one speed model: hold the throttle, reach 26, stay there. The
   player's only real input was steering, which is why the AR race felt like a
   3D race with a camera behind it — nothing about the moment you were in
   mattered.

   This puts a decision on a clock. Each gear pulls hard over a narrow band and
   runs out of breath at the top; the engine only makes real power near the
   redline; and the shift itself has a window. Catch the window and you get a
   burst. Grab it early and the engine bogs. Sit on the limiter and you stop
   accelerating altogether while the noise tells you exactly how much time you
   are wasting.

   No three.js and no DOM in here on purpose: the shift logic is the part worth
   being sure about, so it stays testable and independent of how a shift is
   triggered — a flick of the phone, a button, a blink.
   ============================================================ */

/** Speed (engine units) at which each gear hits the redline. 6th is the car's top. */
const GEAR_TOP = [5.2, 9.4, 13.6, 18.0, 22.0, 26.0];

export const GEARS = GEAR_TOP.length;

/** Mechanical advantage, derived so 1st pulls ~5x as hard as 6th. */
const RATIO = GEAR_TOP.map((t) => GEAR_TOP[GEARS - 1] / t);

/** Where the shift light comes on, as a fraction of the redline. */
export const SHIFT_FROM = 0.86;
/** Below this the engine is off-cam and an upshift will bog it. */
const BOG_BELOW = 0.62;

/** Peak torque sits at 78% of the redline, so the sweet spot is just under it. */
function torque(rpmN: number) {
  return 0.55 + 0.85 * Math.exp(-((rpmN - 0.78) ** 2) / 0.1);
}

export type ShiftQuality = 'perfect' | 'good' | 'early' | 'missed';

export type ShiftResult = {
  quality: ShiftQuality;
  gear: number;
  /** Multiplier applied to speed — a reward or a penalty. */
  speedScale: number;
  /** Seconds of boost earned. 0 for anything but a clean shift. */
  boost: number;
  points: number;
  message: string;
};

export class Gearbox {
  /** 0-based. Gear 1 is index 0. */
  private g = 0;
  /** Counts up while the limiter is active, for the HUD and the sound. */
  private limiterFor = 0;
  private perfect = 0;

  reset() {
    this.g = 0;
    this.limiterFor = 0;
    this.perfect = 0;
  }

  get gear() {
    return this.g + 1;
  }

  get perfectShifts() {
    return this.perfect;
  }

  /** 0..1.05. Above 1 is the rev limiter. */
  rpm(speed: number) {
    return Math.min(1.05, Math.max(0, speed) / GEAR_TOP[this.g]);
  }

  /** True while the shift light should be lit. */
  inWindow(speed: number) {
    const r = this.rpm(speed);
    return r >= SHIFT_FROM && this.g < GEARS - 1;
  }

  /** True once the engine is against the limiter and going nowhere. */
  onLimiter(speed: number) {
    return this.rpm(speed) >= 1 && this.g < GEARS - 1;
  }

  /**
   * Acceleration multiplier for the current gear and revs. Collapses on the
   * limiter — the car simply will not pull past the top of a gear, which is
   * what makes shifting compulsory rather than decorative.
   */
  pull(speed: number) {
    const r = this.rpm(speed);
    if (r >= 1) return RATIO[this.g] * 0.08;
    return RATIO[this.g] * torque(r);
  }

  /** The car cannot exceed the current gear's top, boost or not. */
  ceiling() {
    return GEAR_TOP[this.g];
  }

  update(dt: number, speed: number) {
    this.limiterFor = this.onLimiter(speed) ? this.limiterFor + dt : 0;
  }

  get limiterHeld() {
    return this.limiterFor;
  }

  /** Returns null when there is no gear left to take. */
  up(speed: number): ShiftResult | null {
    if (this.g >= GEARS - 1) return null;
    const r = this.rpm(speed);
    this.g += 1;

    if (r >= SHIFT_FROM) {
      this.perfect += 1;
      return {
        quality: 'perfect',
        gear: this.gear,
        speedScale: 1.06,
        boost: 0.9,
        points: 150,
        message: 'Perfect shift',
      };
    }
    if (r >= BOG_BELOW) {
      return { quality: 'good', gear: this.gear, speedScale: 1, boost: 0, points: 40, message: 'Shifted' };
    }
    /* Short-shifted into a gear with no revs to pull it. The car does not
       stall, it just goes soft — you feel it, and the tachometer shows why. */
    return {
      quality: 'early',
      gear: this.gear,
      speedScale: 0.9,
      boost: 0,
      points: 0,
      message: 'Bogged down',
    };
  }

  down(): ShiftResult | null {
    if (this.g <= 0) return null;
    this.g -= 1;
    return { quality: 'good', gear: this.gear, speedScale: 1, boost: 0, points: 0, message: 'Down' };
  }
}
