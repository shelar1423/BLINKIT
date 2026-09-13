import * as THREE from 'three';
import { color, scene } from '../../design/constants';
import { PICKUPS } from '../../data/catalog';
import { haptic } from '../haptics';
import { setAudioTimeScale } from '../raceAudio';
import { gateBand, raceInteraction, type BoostQuality } from '../raceInteractions';

/* ============================================================
   Race It Home — arcade race engine.

   The track is a closed loop curve. The car's state is
   (t, lateral) where t is normalised progress along the curve
   and lateral is the offset across the road. That makes
   collision, lap counting and AR scaling exact and cheap:
   everything is 2D maths on the curve, no physics engine.

   The same engine drives both the 3D race and the AR race —
   AR just parents `root` to the anchor and scales it down.
   ============================================================ */

export type RaceStats = {
  score: number;
  groceries: number;
  timeLeft: number;
  lap: number;
  laps: number;
  progress: number; // 0..1 of the whole race
  speedKph: number;
};

export type RaceOutcome = {
  score: number;
  groceries: number;
  seconds: number;
  finished: boolean; // true = crossed the line, false = ran out of time
};

export type EngineOpts = {
  /**
   * Build and run the three AR skill moments — launcher gantry, boost gates,
   * ramp.
   *
   * Off by default, and deliberately not inferred from `setPresentation`:
   * these need a caller that has wired `onBoostArm`/`onJumpArm` and has some
   * way for the player to aim and to lift. Built without that, the gates
   * promise a boost that can never be scored and the ramp throws the car into
   * the air with no cue and no reason — which is exactly what the 3D race did
   * for one commit.
   */
  interactions?: boolean;
  laps?: number;
  duration?: number; // seconds
  onTick?: (s: RaceStats) => void;
  onPickup?: (points: number, name: string) => void;
  /**
   * A boost gate's run-up, every frame of it.
   *
   * `k` runs 0 to 1 and reaches 1 on the beat — the instant the player should
   * lift. Past 1 the window is closing; it stops being reported once the gate
   * has been judged. This is what the timing gauge on the overlay is drawn
   * from, and it is the only thing the overlay needs to know.
   */
  onGateCue?: (index: number, k: number) => void;
  /** The ramp is coming; the lift window is open from here. */
  onJumpArm?: () => void;
  /** Wheels have left the ramp. */
  onJumpTakeoff?: () => void;
  /** Back on the road. */
  onJumpLand?: () => void;
  /**
   * The lift was taken, or the gate went by without one.
   *
   * `errSec` is signed simulated seconds off the beat — positive is early —
   * and is `null` when nobody lifted at all.
   */
  onGateResult?: (r: { index: number; quality: BoostQuality; errSec: number | null }) => void;
  /** Points taken off for hitting something. Reported from the one place that
   *  deducts them, so every caller that bounces the car gets it for free. */
  onPenalty?: (points: number) => void;
  /** The car hit a barrier hard enough to count as a crash, and what it cost. */
  onCrash?: (pointsLost: number) => void;
  /**
   * The clock has dropped into bullet time, or come back out of it.
   *
   * A boolean rather than the scale itself, and fired only when it flips: the
   * callers are React pages, and a number arriving sixty times a second is
   * sixty renders a second for an effect that has two states.
   */
  onBulletTime?: (on: boolean) => void;
  /**
   * The race is over and the outro has started. `onFinish` follows about two
   * seconds later, with the same verdict.
   *
   * Split in two so the celebration can begin while the car is still rolling.
   * With one callback the result screen was the first thing that said the race
   * had ended, and it said so by replacing the race mid-frame.
   */
  onFinishCue?: (o: { finished: boolean }) => void;
  onFinish?: (o: RaceOutcome) => void;
};

/* ---- bullet time ----

   The approach to a boost gate is the one moment in the race that asks for aim
   rather than reflex, and at 26 m/s the gate is on you before a phone can be
   brought round. Slowing the world is the arcade answer, and it costs the
   leaderboard nothing: the gates sit at fixed points of the lap, everyone
   passes four of them, and the race is still exactly `duration` SIMULATED
   seconds long. What changes is how much real time those seconds take.

   0.3 turns the 0.9s warning into three real seconds, which is the window the
   brief asks for. */
const SLOW_BOOST = 0.3;
/** The lap is done. Slower still, because nothing is being aimed at any more. */
const SLOW_FINISH = 0.22;
/** Real seconds between the last corner and the result screen. */
const FINISH_OUTRO = 1.9;

/**
 * The fraction to move toward a target this frame, for an exponential chase.
 *
 * Every one of these used to be written `chase(rate, dt)`, which is the
 * first term of this expansion and is wrong in exactly the way that matters on
 * a phone: it is LINEAR in dt, so a frame that takes twice as long moves twice
 * as far, and a stutter makes the camera lunge. The exponential form converges
 * on the same place at the same speed whatever the frame rate did, so a run of
 * uneven frames reads as uneven frames rather than as the camera shaking.
 *
 * `rate` is per second; higher is tighter. The numbers at the call sites are
 * unchanged and mean the same thing — at 60fps the two forms differ by about a
 * tenth of a step, and they only diverge when the frame rate does.
 */
export function chase(rate: number, dt: number) {
  return 1 - Math.exp(-rate * dt);
}

const ROAD_W = 9;

/* ---- cornering ----

   Sideways acceleration at full lock, and the drag that stands in for tyre
   scrub. Their ratio is the top speed across the road: 26 / 3.1 is about 8.4
   units a second, a shade more authority than the old velocity-based steering
   gave, because the driver now has the corner to fight as well as the line. */
const STEER_ACCEL = 26;
const LATERAL_DRAG = 3.1;
/**
 * How much of the real centripetal demand the corner actually applies.
 *
 * All of it is unplayable — see the note at the call site. This is tuned so
 * that a corner taken with no input runs the car into the barrier, and a
 * corner taken with input is comfortably holdable.
 */
const CORNER_PULL = 0.22;
/** Lateral speed into a barrier that counts as a crash rather than a scrape. */
const CRASH_SPEED = 3.2;
/**
 * Seconds of unbroken barrier contact that also counts as a crash.
 *
 * Measured: a car given no steering does not slam into the wall, it CREEPS
 * there — it arrives at 0.15 to 0.8 units a second and then rides it round the
 * whole corner. Judging crashes on impact speed alone, the one thing the
 * player most needs told about ("you did not take that corner") was the one
 * thing that never triggered. Ploughing along a wall is a crash.
 */
const WALL_GRIND_SEC = 0.4;
const CRASH_PENALTY = 150;

/* The ramp, in one place: the mesh is built from these and so is the climb the
   car makes up it, so the car cannot ride a slope the wedge does not have. */
const RAMP_LEN = 13;
const RAMP_RISE = 2.6;
const RAMP_ANGLE = Math.atan2(RAMP_RISE, RAMP_LEN);

/** How far the launcher's sled travels when drawn fully back. */
const LAUNCH_TRAVEL = 9;
/** Lever angles, radians about the cross-track axis. Rest leans toward the car. */
const LEVER_REST = -0.24;
const LEVER_PULLED = 0.98;

const LANE_LIMIT = ROAD_W / 2 - 0.9;
/**
 * Side-rail height. Measured off real Hot Wheels track, whose walls are ~6 mm
 * on a ~34 mm wide track — 17.6% of the width. 1.6 / 9 is 17.8%, so the
 * circuit carries the toy's own proportion rather than an invented one.
 */
const RAIL_H = 1.6;
/*
 * An AR-specific extra boost was built and tested at 24% of road width. It was
 * dropped: at phone-viewing height the taller wall began occluding the grocery
 * pickups on the far side of the circuit, and hiding a collectible the player is
 * meant to steer for costs more than the extra edge definition gains. The toy's
 * own 17.8% reads clearly at that distance, so AR and the 3D race share it.
 */

/**
 * The circuit: four straights joined by four corners.
 *
 * It used to be an oval with a couple of kinks, which meant the car was turning
 * for the whole lap — and every one of the new skill moments wants a moment of
 * NOT turning. You cannot hold a phone on a boost gate while fighting a
 * constant curve, and a ramp taken mid-corner lands the car sideways.
 *
 * The straights are laid down as MANY collinear points, not two. A Catmull-Rom
 * segment bends toward whatever sits on either side of it, so the segments next
 * to a corner bow however collinear their own endpoints are — with four points
 * a straight only held its middle third, measured. With eight, the bowing stays
 * in the two segments that meet the corners, where it reads as turn-in.
 *
 * Scaled to keep roughly the extent the oval had, so the road stays the same
 * fraction of the circuit and the car is the same size on the table.
 */
function buildCurve() {
  const S = 46;
  const a = 0.95; // half-width, to the outside of the left/right straights
  const b = 0.8; // half-depth, to the outside of the top/bottom straights
  const r = 0.32; // corner radius

  const pts: THREE.Vector3[] = [];
  /* A quarter turn, applied as the points are laid down.

     The layout below is written with the start straight along +x because that
     is the readable way to describe a rounded rectangle. But the AR anchor
     turns the circuit to face the player down -z, so an unrotated circuit put
     the launch straight ACROSS the view: the launcher sat off to one side and
     the first thing the car did was drive left to right. Rotating here rather
     than on `root` keeps `circuitPlan()` — the placement blueprint — honest,
     since it samples this same curve. */
  const at = (x: number, z: number) => pts.push(new THREE.Vector3(z * S, 0, -x * S));

  /** Both ends included — the straight owns its tangent points. */
  const straight = (x0: number, z0: number, x1: number, z1: number, n: number) => {
    for (let i = 0; i <= n; i++) at(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
  };
  /** Like `straight`, but stops short of its last point — for the run that
   *  closes the loop, whose end IS the first point already emitted. */
  const straightOpen = (x0: number, z0: number, x1: number, z1: number, n: number) => {
    for (let i = 0; i < n; i++) at(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
  };
  /** Interior arc points only, so the joins are not doubled up. */
  const corner = (cx: number, cz: number, from: number, to: number, n = 3) => {
    for (let i = 1; i < n; i++) {
      const th = ((from + ((to - from) * i) / n) * Math.PI) / 180;
      at(cx + r * Math.cos(th), cz + r * Math.sin(th));
    }
  };

  /* The lap starts HALFWAY along the bottom straight, not at its left end.

     The launcher stands at t=0 and is built backwards from it — sixteen units
     of bed, feet and back stop running against the direction of travel. Begun
     at the end of the straight, all of that lay in the corner behind it: the
     left side of the launcher hung off the road with nothing under it. From
     the middle there are twenty-nine units of straight behind t=0, which the
     whole launcher fits inside with room to spare.

     It also puts the start line where a start line belongs, on a straight
     rather than on the exit of a bend. */
  straight(0, -b, a - r, -b, 4);
  corner(a - r, -(b - r), -90, 0);
  // right straight, +z
  straight(a, -(b - r), a, b - r, 6);
  corner(a - r, b - r, 0, 90);
  // top straight, -x
  straight(a - r, b, -(a - r), b, 8);
  corner(-(a - r), b - r, 90, 180);
  // left straight, -z
  straight(-a, b - r, -a, -(b - r), 6);
  corner(-(a - r), -(b - r), 180, 270);
  // and back up the bottom straight to where the lap began
  straightOpen(-(a - r), -b, 0, -b, 4);

  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
}

/**
 * The circuit's plan, normalised so one unit is the footprint the placed track
 * occupies — for drawing a true preview of it before anything is built.
 *
 * It reads the SAME `buildCurve()` the track itself is built from, and divides
 * by the same extent `trackExtent` uses, so a preview drawn from this cannot
 * promise a shape or a size the placed circuit then contradicts. The origin is
 * left where the curve puts it rather than recentred on the bounding box: the
 * engine root lands on the anchor unrecentred, so the preview has to as well
 * or it would sit a few centimetres off where the track actually arrives.
 */
export function circuitPlan(samples = 180) {
  const curve = buildCurve();
  const box = new THREE.Box3().setFromPoints(curve.getSpacedPoints(96));
  const extent = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + ROAD_W;
  const centre = curve.getSpacedPoints(samples).map((p) => new THREE.Vector3(p.x / extent, 0, p.z / extent));
  /* Road edges, offset along each point's normal — two lines read as a road,
     one line reads as a wire. */
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  const half = ROAD_W / 2 / extent;
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    left.push(centre[i].clone().addScaledVector(n, half));
    right.push(centre[i].clone().addScaledVector(n, -half));
  }
  return {
    centre,
    left,
    right,
    /** the dashed ground rectangle, in the same unit */
    footprint: {
      w: (box.max.x - box.min.x + ROAD_W) / extent,
      d: (box.max.z - box.min.z + ROAD_W) / extent,
      cx: (box.max.x + box.min.x) / 2 / extent,
      cz: (box.max.z + box.min.z) / 2 / extent,
    },
  };
}

function roadMesh(curve: THREE.Curve<THREE.Vector3>, segments: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  /*
    UVs are laid out in world units so the moulding reads at its real size.
    The texture is 128x256, mapped across ROAD_W, so one tile covers ROAD_W * 2
    of track length and pixels stay square. Driving v off the segment index
    instead put ~5,400 tiles around the circuit, which mip-mapped straight to
    flat colour and cost the track all its surface detail.
  */
  const tile = ROAD_W * 2;
  const repeats = curve.getLength() / tile;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const a = p.clone().addScaledVector(right, -ROAD_W / 2);
    const b = p.clone().addScaledVector(right, ROAD_W / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, t * repeats, 1, t * repeats);
    if (i < segments) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hot Wheels track surface, painted into a repeating canvas texture (no network).
 * Orange plastic with the darker moulded side rails and the pale centre slot the
 * real toy track has — the grey asphalt never belonged in a Hot Wheels world.
 */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d')!;

  // moulded orange plastic, slightly darker toward the rails
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, scene.trackEdge);
  g.addColorStop(0.13, scene.trackMid);
  g.addColorStop(0.5, scene.trackCore);
  g.addColorStop(0.87, scene.trackMid);
  g.addColorStop(1, scene.trackEdge);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 256);

  // the pale centre slot
  x.fillStyle = 'rgba(255, 214, 150, 0.20)';
  x.fillRect(60, 0, 8, 256);

  // moulded rail highlight
  x.fillStyle = 'rgba(255, 255, 255, 0.14)';
  x.fillRect(12, 0, 3, 256);
  x.fillRect(113, 0, 3, 256);

  // rungs across the track, the way the toy track is ribbed
  x.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 256; y += 32) x.fillRect(16, y, 96, 5);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Trackside banners.
 *
 * Every real Hot Wheels set hangs boards down the side of the circuit, and
 * without them the track reads as a plain orange road in a void — there is
 * nothing at eye level to give the car scale or the corners a sense of speed.
 *
 * Landscape, not the tall pennants this replaces: a pennant can only carry
 * text turned on its side, which nobody reads at speed. These are hoardings, so
 * the Hot Wheels mark and Blinkit's wordmark sit the right way up and can
 * actually be read from the car.
 *
 * Drawn once to a canvas and shared as one texture per brand, so the whole run
 * costs two materials however many boards there are.
 */
function bannerTexture(kind: 'hw' | 'bk', onReady: () => void): THREE.CanvasTexture {
  /* Portrait, because these are hanging pennants and not hoardings — long
     drops of fabric slung from an overhead arm, the way a Hot Wheels set
     dresses the gantries above its track. The mark runs UP the banner, so the
     canvas is painted on its side and the whole thing is read rotated. */
  const W = 256;
  const H = 800;
  /* Height of the swallowtail cut out of the bottom. Transparent, so the
     material's alpha gives the flag its shape — a rectangle reads as a sign,
     a forked tail reads as cloth. */
  const TAIL = 120;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const paint = (logo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H);

    // the cloth: full width at the top, forked at the hem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H - TAIL);
    ctx.lineTo(W / 2, H - TAIL * 0.35);
    ctx.lineTo(0, H - TAIL);
    ctx.closePath();
    if (kind === 'hw') {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#C2121A');
      g.addColorStop(0.5, '#ED1C24');
      g.addColorStop(1, '#C2121A');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#E0B02E');
      g.addColorStop(0.5, '#F8CB46');
      g.addColorStop(1, '#E0B02E');
      ctx.fillStyle = g;
    }
    ctx.fill();

    // a sewn header where it takes the arm
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, 0, W, 14);

    /* Everything below is drawn rotated a quarter turn, so it reads bottom-to-
       top when the flag is hung. The banner's LENGTH becomes the type's width,
       which is the only way a wordmark fits on something this narrow. */
    ctx.save();
    ctx.translate(W / 2, (H - TAIL) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const runLen = H - TAIL;

    if (kind === 'hw') {
      if (logo) {
        /* The real mark, knocked to white — the shipped SVG is a flat #ED1C24,
           the same red as the cloth behind it. */
        const lw = runLen * 0.78;
        const lh = lw * (logo.height / logo.width);
        const t = document.createElement('canvas');
        t.width = Math.ceil(lw);
        t.height = Math.ceil(lh);
        const tc = t.getContext('2d')!;
        tc.drawImage(logo, 0, 0, lw, lh);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = '#fff';
        tc.fillRect(0, 0, lw, lh);
        ctx.drawImage(t, -lw / 2, -lh / 2);
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'italic 900 132px system-ui, -apple-system, sans-serif';
        ctx.fillText('HOT WHEELS', 0, 0);
      }
    } else {
      ctx.fillStyle = '#1F1F1F';
      ctx.font = '800 150px system-ui, -apple-system, sans-serif';
      ctx.fillText('blinkit', 0, -40);
      ctx.fillStyle = '#4A4028';
      ctx.font = '700 56px system-ui, -apple-system, sans-serif';
      ctx.fillText("India's last minute app", 0, 58);
    }
    ctx.restore();
  };

  /* onReady fires only from the image's own callbacks, never from the first
     paint.

     The first paint runs synchronously, before this function has returned —
     so the caller's `const tex = bannerTexture(...)` is still in its temporal
     dead zone, and a callback that touches `tex` threw
     "Cannot access 'tex' before initialization" right there. That exception
     escaped track construction, so the scene was never built: in AR the camera
     opened onto an empty overlay with no reticle and no place button, and the
     3D race came up blank the same way. The synchronous paint needs no
     notification anyway — it happens before the texture is created, so the
     canvas already carries it. */
  if (kind === 'hw') {
    const img = new Image();
    img.onload = () => {
      paint(img);
      onReady();
    };
    img.onerror = () => {
      paint();
      onReady();
    };
    img.src = '/brand/hot-wheels.svg';
    paint();
  } else {
    paint();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}


/**
 * The co-brand plate on the back of the launcher.
 *
 * The launcher is the one piece of the set the player holds still and looks
 * at — they are standing behind it deciding how hard to pull — so it is the
 * one piece that should say whose collaboration this is. The plate goes on
 * the back stop's rear face, which is the surface square-on to the launch
 * camera and the nearest thing to it.
 *
 * Blinkit's yellow carries the panel and Hot Wheels' red carries the mark,
 * with a chequered strip top and bottom doing the work both brands share.
 * Painted rather than imported: the shipped blinkit SVG sets its wordmark in
 * a font it expects the page to have, which an <img> drawn into a canvas does
 * not get — the same reason the track banners letter that mark by hand.
 */
function coBrandTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const CHEQ = 26;

  const paint = (logo?: HTMLImageElement) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FBD65E');
    g.addColorStop(0.5, '#F8CB46');
    g.addColorStop(1, '#E0B02E');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // chequer, top and bottom — the one motif both marks already own
    for (let i = 0; i * CHEQ < W; i++) {
      for (const [row, y] of [[0, 0], [1, H - CHEQ]] as const) {
        ctx.fillStyle = (i + row) % 2 ? '#1F1F1F' : '#FFFFFF';
        ctx.fillRect(i * CHEQ, y, CHEQ, CHEQ);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = H / 2 + 2;

    /* blinkit, lettered — left of the cross, and lettered in TWO colours.

       The real mark sets "blink" in near-black and "it" in the brand green,
       and a single-colour version of somebody's wordmark is the sort of thing
       a brand team notices first. Drawn left-aligned from a measured start
       rather than centred, because two `fillText` calls at one centred x would
       stack the halves on top of each other. */
    ctx.font = "800 92px system-ui, -apple-system, 'Figtree', sans-serif";
    const dark = 'blink';
    const green = 'it';
    const wDark = ctx.measureText(dark).width;
    const wGreen = ctx.measureText(green).width;
    const startX = W * 0.27 - (wDark + wGreen) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1F1F1F';
    ctx.fillText(dark, startX, midY);
    ctx.fillStyle = '#0C831F';
    ctx.fillText(green, startX + wDark, midY);
    ctx.textAlign = 'center';

    // the cross
    ctx.fillStyle = 'rgba(31,31,31,0.55)';
    ctx.font = '700 54px system-ui, -apple-system, sans-serif';
    ctx.fillText('\u00D7', W * 0.5, midY);

    // Hot Wheels, right of it — the real mark when it arrives
    if (logo) {
      const lw = W * 0.38;
      const lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, W * 0.555, midY - lh / 2, lw, lh);
    } else {
      ctx.fillStyle = '#ED1C24';
      ctx.font = "italic 900 62px system-ui, -apple-system, sans-serif";
      ctx.fillText('HOT WHEELS', W * 0.745, midY);
    }
  };

  /* Painted once before the texture exists, so nothing can reach `tex` while
     it is still in its temporal dead zone — the trap the banner textures
     document, which took the whole scene down with it. The logo's callback
     runs long after, when there is a texture to invalidate. */
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const img = new Image();
  img.onload = () => {
    paint(img);
    tex.needsUpdate = true;
  };
  img.src = '/brand/hot-wheels.svg';
  return tex;
}


/**
 * The Hot Wheels mark, knocked to white, for the face of the lever paddle.
 *
 * The paddle is the part the thumb actually lands on and the nearest thing to
 * the launch camera, so it carries a mark rather than a lockup — at that size
 * "blinkit × HOT WHEELS" would resolve to a yellow smudge. The two brands
 * split across the launcher instead: the partner's yellow runs down the bed,
 * the flame sits on the red part, and the full lockup stays on the back plate
 * where there is room to read it.
 *
 * White, because the shipped SVG is a flat #ED1C24 and the paddle under it is
 * the same red — the banners solve it the same way.
 */
function leverMarkTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const paint = (logo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H);
    if (logo) {
      const lw = W * 0.86;
      const lh = lw * (logo.height / logo.width);
      const t = document.createElement('canvas');
      t.width = Math.ceil(lw);
      t.height = Math.ceil(lh);
      const tc = t.getContext('2d')!;
      tc.drawImage(logo, 0, 0, lw, lh);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = '#fff';
      tc.fillRect(0, 0, lw, lh);
      ctx.drawImage(t, (W - lw) / 2, (H - lh) / 2);
    } else {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'italic 900 74px system-ui, -apple-system, sans-serif';
      ctx.fillText('HOT WHEELS', W / 2, H / 2);
    }
  };

  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    paint(img);
    tex.needsUpdate = true;
  };
  img.src = '/brand/hot-wheels.svg';
  return tex;
}

/**
 * Blinkit-yellow livery for the bed, chequered along its edges.
 *
 * Two strips flanking the spring rather than one panel under it: the coils,
 * the sled and the car sit down the centreline of the bed, so the middle is
 * the one part of that surface nothing can be painted on and still be seen.
 */
function bedLiveryTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#E0B02E');
  g.addColorStop(0.5, '#F8CB46');
  g.addColorStop(1, '#E0B02E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a chequered run down each long edge
  const SQ = 16;
  for (let i = 0; i * SQ < H; i++) {
    for (const [col, x] of [[0, 0], [1, W - SQ]] as const) {
      ctx.fillStyle = (i + col) % 2 ? '#1F1F1F' : '#FFFFFF';
      ctx.fillRect(x, i * SQ, SQ, SQ);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}


/**
 * A ring of fire, painted once and animated by turning it.
 *
 * The boost gate was a flat orange torus, which at the far end of a straight
 * is an orange circle and nothing else — and the thing the player is asked to
 * aim a phone at should look worth aiming at.
 *
 * Three passes of tongues rather than one ring of spikes. A single pass at
 * even spacing and even length is a starburst, which is exactly what the first
 * attempt produced: the read comes from lengths that vary by a factor of four,
 * from tips swept sideways so nothing is purely radial, and from layering
 * short flames over long ones so the base is dense and the tips are sparse.
 *
 * Every tip stays inside `TIP_MAX` of the centre. The first version let them
 * reach 0.64 of the canvas from the middle, against a half-width of 0.5, so
 * the longest flames were sliced off square by the edge of the bitmap — which
 * is the other half of why they looked like spokes.
 *
 * Two copies counter-rotating is what makes it move. Repainting a canvas this
 * size every frame, twice a gate, is the kind of thing that quietly costs a
 * phone its frame rate; turning a static texture costs nothing.
 */
function flameRingTexture(seed: number): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const mid = S / 2;
  /** The hoop's own radius on this canvas — flames start here. */
  const R0 = S * 0.25;
  /** Nothing may be drawn beyond this, or the bitmap crops it flat. */
  const TIP_MAX = S * 0.465;

  let n = seed * 9301 + 49297;
  const rnd = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };

  ctx.clearRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighter';

  /** One lick of flame: wide at the root, swept sideways, pointed at the tip. */
  const tongue = (a: number, len: number, wide: number, sweep: number, alpha: number) => {
    const tip = Math.min(TIP_MAX, R0 + len);
    const ta = a + sweep;
    const g = ctx.createLinearGradient(
      mid + Math.cos(a) * R0 * 0.9, mid + Math.sin(a) * R0 * 0.9,
      mid + Math.cos(ta) * tip, mid + Math.sin(ta) * tip,
    );
    g.addColorStop(0, `rgba(255, 242, 198, ${0.9 * alpha})`);
    g.addColorStop(0.22, `rgba(255, 186, 64, ${0.72 * alpha})`);
    g.addColorStop(0.55, `rgba(238, 104, 16, ${0.36 * alpha})`);
    g.addColorStop(0.82, `rgba(186, 44, 4, ${0.12 * alpha})`);
    g.addColorStop(1, 'rgba(140, 20, 0, 0)');
    ctx.fillStyle = g;

    const rootIn = R0 * 0.82;
    const midR = R0 + (tip - R0) * 0.55;
    ctx.beginPath();
    ctx.moveTo(mid + Math.cos(a - wide) * rootIn, mid + Math.sin(a - wide) * rootIn);
    ctx.quadraticCurveTo(
      mid + Math.cos(a - wide * 0.35 + sweep * 0.4) * midR,
      mid + Math.sin(a - wide * 0.35 + sweep * 0.4) * midR,
      mid + Math.cos(ta) * tip, mid + Math.sin(ta) * tip,
    );
    ctx.quadraticCurveTo(
      mid + Math.cos(a + wide * 0.35 + sweep * 0.4) * midR,
      mid + Math.sin(a + wide * 0.35 + sweep * 0.4) * midR,
      mid + Math.cos(a + wide) * rootIn, mid + Math.sin(a + wide) * rootIn,
    );
    ctx.closePath();
    ctx.fill();
  };

  /* Long and sparse, then medium, then a dense skirt of short ones. Fire is
     mostly base with a few licks reaching; the reverse looks like a sun. */
  const passes = [
    { count: 15, lo: 0.55, hi: 0.95, wide: 0.075, sweep: 0.30, alpha: 0.85 },
    { count: 26, lo: 0.28, hi: 0.58, wide: 0.090, sweep: 0.22, alpha: 0.70 },
    { count: 46, lo: 0.10, hi: 0.26, wide: 0.115, sweep: 0.14, alpha: 0.60 },
  ];
  for (const pass of passes) {
    for (let i = 0; i < pass.count; i++) {
      const a = (i / pass.count) * Math.PI * 2 + rnd() * 0.5;
      const len = R0 * (pass.lo + rnd() * (pass.hi - pass.lo));
      // sweep the same way around the ring, so the fire reads as turning
      const sweep = pass.sweep * (0.35 + rnd() * 0.65);
      tongue(a, len, pass.wide * (0.7 + rnd() * 0.6), sweep, pass.alpha);
    }
  }

  /* The hot band the tongues come off. Kept low — it sits under two additive
     layers, and at full strength the pair went solid yellow the moment the
     player aimed at it. The middle stays open so the track shows through. */
  const core = ctx.createRadialGradient(mid, mid, R0 * 0.74, mid, mid, R0 * 1.3);
  core.addColorStop(0, 'rgba(255, 196, 80, 0)');
  core.addColorStop(0.4, 'rgba(255, 206, 110, 0.20)');
  core.addColorStop(0.72, 'rgba(255, 132, 22, 0.12)');
  core.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}


/**
 * A box with its edges taken off.
 *
 * Everything the launcher is made of was a `BoxGeometry`, which has twelve
 * perfectly sharp arrises and reads as raw geometry rather than as a moulded
 * part — the closer the launch camera got, the more obvious it was. A real
 * die-cast accessory has a radius on every edge, because it came out of a
 * tool.
 *
 * An extruded rounded rectangle gets all twelve at once: the profile rounds
 * the four running edges and the bevel rounds the eight at the ends. Roughly
 * three hundred triangles a part against twelve, which for a dozen parts seen
 * this close is a trade worth making.
 */
function roundedBox(w: number, h: number, d: number, r: number, seg = 4): THREE.ExtrudeGeometry {
  // a radius can never exceed the half-thickness of the thinnest axis
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  /* The PROFILE is inset by the bevel on every side, because `bevelSize`
     grows the outline outward rather than eating into it — extruded at face
     value, a part came out 2r wider and taller than asked for, which is how a
     2.7-wide paddle measured 3.46 and hung over the edge of the road. */
  const w2 = w - rr * 2;
  const h2 = h - rr * 2;
  const x = Math.max(0.001, w2 / 2 - rr);
  const y = Math.max(0.001, h2 / 2 - rr);
  const hw = w2 / 2;
  const hh = h2 / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -hh);
  shape.lineTo(x, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -y);
  shape.lineTo(hw, y);
  shape.quadraticCurveTo(hw, hh, x, hh);
  shape.lineTo(-x, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, y);
  shape.lineTo(-hw, -y);
  shape.quadraticCurveTo(-hw, -hh, -x, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - rr * 2,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: seg,
    curveSegments: seg + 2,
  });
  /* Extrusion runs from -bevelThickness to depth+bevelThickness, so the part
     sits off-centre by half its depth until this is put right — every mesh
     built from one is positioned as though it were a centred box. */
  geo.translate(0, 0, -(d / 2 - rr));
  return geo;
}

/**
 * The raised orange side rails. Built as two vertical ribbons along the road
 * edges — the single detail that makes the circuit read as Hot Wheels track
 * rather than a road, and it costs two draw calls.
 */
function railMesh(curve: THREE.Curve<THREE.Vector3>, segments: number, side: 1 | -1, height: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  // Moulded track walls flare outward rather than standing dead vertical. The
  // lean gives the rail a lit face instead of a zero-width edge at grazing
  // angles — which is exactly the angle AR is viewed from.
  const lean = height * 0.18;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const base = p.clone().addScaledVector(right, (ROAD_W / 2) * side);
    const top = base.clone().addScaledVector(right, lean * side);
    pos.push(base.x, base.y, base.z, top.x, top.y + height, top.z);
    if (i < segments) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Deep-space plate under the circuit: near-black, with amber and cyan clouds so
 * it reads as a galaxy rather than a flat void. Warm/cool only — no violet, so
 * it stays inside the campaign palette.
 */
function nebulaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = scene.space;
  x.fillRect(0, 0, 512, 512);

  const cloud = (cx: number, cy: number, r: number, col: string, a: number) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col.replace('ALPHA', String(a)));
    g.addColorStop(1, col.replace('ALPHA', '0'));
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  };
  cloud(190, 210, 250, 'rgba(255,150,40,ALPHA)', 0.30);
  cloud(340, 330, 210, 'rgba(20,120,220,ALPHA)', 0.26);
  cloud(120, 380, 170, 'rgba(255,90,30,ALPHA)', 0.18);
  cloud(390, 140, 150, 'rgba(90,190,255,ALPHA)', 0.16);

  // stars
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.9;
    x.fillStyle = `rgba(255,255,255,${a})`;
    const r = Math.random() < 0.92 ? 1 : 2;
    x.fillRect(Math.random() * 512, Math.random() * 512, r, r);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function spriteTexture(url: string) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** What clipping a chunk of debris costs. */
const DEBRIS_PENALTY = 100;

export class RaceEngine {
  readonly root = new THREE.Group();

  private curve = buildCurve();
  private curveLen: number;
  private laps: number;
  private readonly interactions: boolean;
  private duration: number;
  private opts: EngineOpts;

  private car: THREE.Object3D | null = null;
  private carTilt = new THREE.Group();

  private t = 0;
  private lateral = 0;
  private steer = 0;
  private steerSmooth = 0;
  private speed = 0;
  private boostUntil = 0;

  /* --- manual driving. Until setThrottle/setBrake/setDrift is called the car
     drives itself, which is what the 3D race has always done. The AR race
     hands the throttle to the player. --- */
  private manual = false;
  private throttle = 0;
  private braking = 0;
  private drifting = false;
  private driftYaw = 0;
  private grip = 1;

  private score = 0;
  private groceries = 0;
  private lap = 0;
  private elapsed = 0;
  private running = false;
  private done = false;

  private pickups: {
    sprite: THREE.Sprite;
    t: number;
    lateral: number;
    points: number;
    name: string;
    alive: boolean;
    pop: number;
  }[] = [];

  private debris: {
    mesh: THREE.Mesh;
    t: number;
    lateral: number;
    spin: THREE.Vector3;
    /** >0 once hit: seconds since it shattered, drives the shard animation. */
    broken: number;
    shards: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
  }[] = [];
  private ground: THREE.Mesh | null = null;
  private propRoot = new THREE.Group();
  private arProps: { mesh: THREE.Mesh; spin: THREE.Vector3; bobPhase: number; baseY: number }[] = [];
  private scenery: THREE.InstancedMesh | null = null;
  /** widest extent of the ROAD itself, ignoring ground and scenery */
  readonly trackExtent: number;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private finishGate = new THREE.Group();
  /** The three lamps on the start gantry, in order: red, amber, green. */
  private startLamps: THREE.MeshBasicMaterial[] = [];
  /** The two gates, in lap order, with the flame each one is aimed at. */
  private boostGates: {
    t: number;
    target: THREE.Object3D;
    flame: THREE.MeshBasicMaterial;
    /** The two counter-rotating fire sheets, and the hoop they surround. */
    fire: THREE.Mesh[];
    fireMats: THREE.MeshBasicMaterial[];
    /** 0..1, how close the run-up is to the beat. Drives how it burns. */
    stoke: number;
    armed: boolean;
    /** Judged already — by a lift, or by the car going under it. */
    done: boolean;
    /** The player has acted. The gauge stops; the verdict waits for the gate. */
    lifted: boolean;
    /** Simulated seconds the lift was off the beat. Null if nobody lifted. */
    liftErr: number | null;
  }[] = [];
  /** Speed across the road, units per second. Positive is toward `right`. */
  private lateralVel = 0;
  /** Unbroken seconds against a barrier. Reset the moment the car comes off. */
  private wallTime = 0;
  /** Airborne state. `airT` counts 0..1 across the arc; -1 means on the road. */
  private airT = -1;
  /* The arc currently being flown. The ramp and the gates are the same flight
     with different numbers — the ramp leaves the road already at the lip's
     height, a gate leaves it from the floor — so the numbers live here rather
     than being read from one fixed place in `raceInteraction`. */
  private airTime: number = raceInteraction.jumpAirtime;
  private airPeak: number = raceInteraction.jumpHeight;
  private airFrom = 0;
  private jumpArmed = false;
  private jumpHeightNow = 0;
  /** 0..1 up the ramp's face; -1 when not on it. */
  private rampU = -1;
  private launcher = new THREE.Group();
  private launchSled = new THREE.Group();
  private launchLever = new THREE.Group();
  /** Invisible, generous grab volume for the lever. Raycast target. */
  private leverHit: THREE.Mesh | null = null;
  private launchCoils: THREE.Mesh[] = [];
  /** 0..1 — how far the sled is drawn back. */
  private launchPull = 0;
  /** The "pull me down" chevrons standing over the lever, top one first. */
  private leverCue: THREE.Mesh[] = [];
  /** Seconds the cue has been running. Real time — nothing is racing yet. */
  private cueT = 0;
  /** Nose angle, radians. Positive is nose up. */
  private jumpPitch = 0;
  /** Seconds of fire, for the boost gates. Never reset — it only ever turns. */
  private fireT = 0;
  /** Which gate is currently asking for a lift, or -1. */
  private armedGate = -1;
  /** A gate jump is in the air, and the clock stays down until it lands. */
  private slowThroughFlight = false;
  /* ---- the clock ----
     `timeScale` is what the simulation actually runs at; `slowTarget` is what
     it is heading for. Everything in `update` below the ramp runs on simulated
     seconds — the ramp itself has to run on real ones, or slowing down would
     also slow the act of slowing down. */
  private timeScale = 1;
  private slowTarget = 1;
  /** The last value handed to `onBulletTime`, so it only fires on the flip. */
  private slowReported = false;
  /** Real seconds since the flag dropped; -1 until it has. */
  private outroAt = -1;
  private outroCrossed = false;

  constructor(opts: EngineOpts = {}) {
    this.opts = opts;
    this.interactions = opts.interactions ?? false;
    this.laps = opts.laps ?? 2;
    this.duration = opts.duration ?? 45;
    this.curveLen = this.curve.getLength();
    const cb = new THREE.Box3().setFromPoints(this.curve.getSpacedPoints(96));
    this.trackExtent = Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z) + ROAD_W;
    this.build();
  }

  /* ---------------- scene construction ---------------- */
  private build() {
    const tex = roadTexture();
    this.disposables.push(tex);

    const roadGeo = roadMesh(this.curve, 420);
    // glossy moulded plastic, not asphalt
    const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.0 });
    // The studio IBL exists for the car's die-cast paint; left at full strength
    // it washes the track to pale peach. Damp it per-material, not scene-wide.
    roadMat.envMapIntensity = 0.22;
    // The map is already a deep orange; this scales it so a face-on key doesn't
    // push it through ACES highlight roll-off into pale peach.
    roadMat.color.setHex(0xb4b4b4);
    this.disposables.push(roadGeo, roadMat);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.y = 0.01;
    this.root.add(road);

    // raised side rails, the detail that makes it read as Hot Wheels track
    const railMat = new THREE.MeshStandardMaterial({
      color: scene.rail,
      roughness: 0.5,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    railMat.envMapIntensity = 0.3;
    this.disposables.push(railMat);
    for (const side of [1, -1] as const) {
      const rg = railMesh(this.curve, 420, side, RAIL_H);
      this.disposables.push(rg);
      const rail = new THREE.Mesh(rg, railMat);
      rail.position.y = 0.01;
      this.root.add(rail);
    }

    /* Trackside banners, alternating the two brands down both sides.
       Posted just outside the rail and turned to face the road, so they read
       from the driving camera rather than only from above. Instanced by hand
       rather than by InstancedMesh: there are 2 x BANNERS of them and they need
       two different textures, so two shared materials is the cheaper shape. */
    const BANNERS = 14;
    const bannerMats = (['hw', 'bk'] as const).map((k) => {
      const m = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
      // the Hot Wheels mark arrives a frame or two late; repaint when it does
      const tex = bannerTexture(k, () => {
        m.map = tex;
        m.needsUpdate = true;
        tex.needsUpdate = true;
      });
      m.map = tex;
      this.disposables.push(m, tex);
      return m;
    });
    /* Long hanging pennants, slung from an overhead arm.

       These were landscape boards on a post, and before that pennants with the
       post running down their middle — which split the artwork, because from
       the car you only ever see the front. Hanging them solves both: the arm
       carries the flag's top edge and the mast stands off to ONE SIDE of it,
       along the track rather than across it, so nothing crosses the cloth.

       Built in a group whose -Z is turned to face the road. That makes local X
       run along the track, which is the direction the flag's width and its arm
       both need to lie in — so the mast ends up beside the flag from the
       driver's view, never in front of it. */
    const FLAG_W = 1.2;
    const FLAG_H = 3.6;
    const ARM_Y = 5.25;
    const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H);
    const mastGeo = new THREE.CylinderGeometry(0.07, 0.09, ARM_Y + 0.3, 6);
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, FLAG_W + 0.55, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b323c, roughness: 0.7 });
    this.disposables.push(flagGeo, mastGeo, armGeo, postMat);
    const bUp = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < BANNERS; i++) {
      const t = i / BANNERS;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, bUp).normalize();
      for (const side of [1, -1] as const) {
        const at = p.clone().addScaledVector(right, (ROAD_W / 2 + 1.9) * side);

        const rig = new THREE.Group();
        rig.position.copy(at);
        // -Z toward the road, which puts local X along it
        rig.lookAt(p.x, at.y, p.z);

        const mast = new THREE.Mesh(mastGeo, postMat);
        mast.position.set((FLAG_W / 2 + 0.28) * side, (ARM_Y + 0.3) / 2, 0);
        rig.add(mast);

        const arm = new THREE.Mesh(armGeo, postMat);
        arm.position.set(0, ARM_Y, 0);
        arm.rotation.z = Math.PI / 2;
        rig.add(arm);

        const flag = new THREE.Mesh(flagGeo, bannerMats[(i + (side === 1 ? 0 : 1)) % 2]);
        // hung from the arm: its top edge sits just under it
        flag.position.set(0, ARM_Y - FLAG_H / 2 - 0.08, 0);
        rig.add(flag);

        this.root.add(rig);
      }
    }

    // Deep space under the circuit. Near-black so the track reads as floating,
    // with a faint warm core so it isn't a flat void.
    const gGeo = new THREE.CircleGeometry(150, 64);
    const gMat = new THREE.MeshBasicMaterial({ map: nebulaTexture(), transparent: true, opacity: 0.95 });
    this.disposables.push(gGeo, gMat, gMat.map!);
    const ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    this.ground = ground;
    this.root.add(ground);

    this.buildScenery();
    this.buildFinishGate();
    this.buildPickups();
    if (raceInteraction.debrisEnabled) this.buildDebris();
    this.buildArProps();

    this.root.add(this.carTilt);
  }

  /** Asteroid field drifting around the circuit, in place of the old city blocks. */
  private buildScenery() {
    const geo = new THREE.IcosahedronGeometry(1, 0);   // low-poly = reads as rock
    const mat = new THREE.MeshStandardMaterial({ color: scene.asteroid, roughness: 0.95, metalness: 0.05, flatShading: true });
    mat.envMapIntensity = 0.35;
    this.disposables.push(geo, mat);
    const N = 60;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const off = ROAD_W / 2 + 9 + ((i * 7) % 26);
      const pos = p.clone().addScaledVector(right, off * side);
      // scattered above and below the track plane so it reads as a field, not a fence
      pos.y = -7 + ((i * 13) % 22);
      const sc = 1.1 + ((i * 5) % 9) * 0.42;
      m.compose(
        pos,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 1.1, i * 0.7, i * 0.4)),
        new THREE.Vector3(sc, sc * (0.7 + ((i * 3) % 5) * 0.12), sc),
      );
      mesh.setMatrixAt(i, m);
      // warm grey-brown rock, a few lit amber by the nearby star
      col.setHSL(0.075, 0.22, 0.12 + ((i * 17) % 10) / 48);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scenery = mesh;
    this.root.add(mesh);
  }

  private buildFinishGate() {
    const up = new THREE.Vector3(0, 1, 0);
    const p = this.curve.getPointAt(0);
    const tan = this.curve.getTangentAt(0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    // chequered strip across the road
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        x.fillStyle = (i + j) % 2 ? '#ffffff' : '#141018';
        x.fillRect(i * 8, j * 8, 8, 8);
      }
    const ct = new THREE.CanvasTexture(c);
    ct.colorSpace = THREE.SRGBColorSpace;
    ct.wrapS = THREE.RepeatWrapping;
    ct.repeat.set(6, 1);
    const stripGeo = new THREE.PlaneGeometry(ROAD_W, 2.4);
    const stripMat = new THREE.MeshBasicMaterial({ map: ct, transparent: false });
    this.disposables.push(ct, stripGeo, stripMat);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.copy(p).setY(0.03);
    strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan.clone().setY(0).normalize());
    strip.rotateX(-Math.PI / 2);
    this.finishGate.add(strip);

    // two posts
    const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 6, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: color.hwO.int, roughness: 0.6 });
    this.disposables.push(postGeo, postMat);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.copy(p).addScaledVector(right, (ROAD_W / 2 + 0.4) * s).setY(3);
      this.finishGate.add(post);
    }

    /* Start lights on the left-hand post. Every Hot Wheels set has a gantry on
       the start line and the race already had posts standing there doing
       nothing — so the lights go where a real set puts them, rather than
       arriving as a fourth object beside the gate. */
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 7.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x14161C, roughness: 0.7 }),
    );
    housing.position.copy(p).addScaledVector(right, -(ROAD_W / 2 + 3.1)).setY(6.4);
    housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().setY(0).normalize());
    this.finishGate.add(housing);
    const lampGeo = new THREE.CircleGeometry(0.86, 20);
    this.disposables.push(lampGeo);
    /* Unlit is the same hue heavily darkened rather than grey: a grey lamp
       that turns red reads as a different object lighting up, a dark red one
       reads as the same bulb coming on. */
    for (const [i, hex] of [0xFF3B30, 0xFFC400, 0x22C55E].entries()) {
      const mat = new THREE.MeshBasicMaterial({ color: hex });
      mat.color.multiplyScalar(0.14);
      this.disposables.push(mat);
      const lamp = new THREE.Mesh(lampGeo, mat);
      lamp.position.set(0, 2.3 - i * 2.3, 0.75);
      housing.add(lamp);
      this.startLamps.push(mat);
    }
    this.setStartLights(0);

    this.root.add(this.finishGate);
    if (this.interactions && raceInteraction.boostEnabled) this.buildBoostGates();
    if (this.interactions && raceInteraction.jumpEnabled) this.buildRamp();
    if (this.interactions && raceInteraction.launchEnabled) this.buildLauncher();
  }

  /**
   * Which lamps are lit: 0 none, 1 red, 2 red+amber, 3 green.
   *
   * The colours are multiplied rather than swapped so a lamp is always its own
   * colour and only its brightness changes.
   */
  setStartLights(stage: 0 | 1 | 2 | 3) {
    const on = [stage >= 1 && stage < 3, stage === 2, stage === 3];
    const hexes = [0xFF3B30, 0xFFC400, 0x22C55E];
    this.startLamps.forEach((m, i) => {
      m.color.setHex(hexes[i]);
      if (!on[i]) m.color.multiplyScalar(0.14);
    });
  }

  /**
   * Two arches over the track with a flame in the middle of each.
   *
   * Track hardware, not a portal: an orange plastic arch of the same hue as
   * the rails, standing on the road it spans, with the target reading as a
   * hot ring rather than a sci-fi gate. It has to belong to a toy set that
   * also contains the car.
   */
  private buildBoostGates() {
    const up = new THREE.Vector3(0, 1, 0);
    const legGeo = new THREE.CylinderGeometry(0.5, 0.62, 11, 10);
    const legMat = new THREE.MeshStandardMaterial({ color: color.hwO.int, roughness: 0.55, metalness: 0.05 });
    const beamGeo = new THREE.BoxGeometry(ROAD_W + 3.4, 1.5, 1.5);
    /* Built from the tuning file's own numbers, not from literals that happen
       to match them — the judge measures the car against this hoop, and two
       copies of its size is two hoops. */
    const ringGeo = new THREE.TorusGeometry(
      raceInteraction.gateRingRadius, raceInteraction.gateRingTube, 10, 30,
    );
    this.disposables.push(legGeo, legMat, beamGeo, ringGeo);

    for (const [i, t] of raceInteraction.boostGates.entries()) {
      const g = new THREE.Group();
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      g.position.copy(p);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().setY(0).normalize());

      for (const sgn of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(sgn * (ROAD_W / 2 + 1.3), 5.5, 0);
        g.add(leg);
      }
      const beam = new THREE.Mesh(beamGeo, legMat);
      beam.position.y = 11.6;
      g.add(beam);

      /* The hoop: lit rather than shaded, so it reads at the far end of a
         straight where a shaded material would just be dark orange. */
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xFF6A00, transparent: true, opacity: 0.92 });
      this.disposables.push(flameMat);
      const ring = new THREE.Mesh(ringGeo, flameMat);
      ring.position.y = raceInteraction.gateRingY;
      g.add(ring);

      /* And the fire around it. Two sheets of the same painting, counter-
         rotating at different rates, which is enough to stop the eye finding
         the loop. Additive, because fire adds light to what is behind it
         rather than hiding it; depthWrite off so the two sheets and the hoop
         do not punch holes in one another. DoubleSide, because a gate is
         approached from one end of a straight and seen again from the other. */
      const fire: THREE.Mesh[] = [];
      const fireMats: THREE.MeshBasicMaterial[] = [];
      const fireGeo = new THREE.PlaneGeometry(11.6, 11.6);
      this.disposables.push(fireGeo);
      for (const layer of [0, 1]) {
        const ftex = flameRingTexture(i * 2 + layer + 1);
        const fmat = new THREE.MeshBasicMaterial({
          map: ftex,
          transparent: true,
          opacity: layer ? 0.34 : 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        this.disposables.push(ftex, fmat);
        const sheet = new THREE.Mesh(fireGeo, fmat);
        sheet.position.y = raceInteraction.gateRingY;
        sheet.position.z = layer ? 0.06 : -0.06;
        sheet.renderOrder = 3;
        g.add(sheet);
        fire.push(sheet);
        fireMats.push(fmat);
      }

      /* An empty at the ring's centre is what the aim is measured against —
         the ring itself is a torus, so its own origin is a hole. */
      const target = new THREE.Object3D();
      target.position.copy(ring.position);
      g.add(target);

      this.root.add(g);
      this.boostGates.push({ t, target, flame: flameMat, fire, fireMats, stoke: 0, armed: false, done: false, lifted: false, liftErr: null });
      void i;
      void right;
    }
  }

  /**
   * How far ahead of the gate the car has to leave the road, as a fraction of
   * the lap.
   *
   * Half an airtime's travel: the arc peaks in the middle, so a takeoff half
   * an airtime early puts the peak exactly at the gate. Derived from the
   * CURRENT speed every frame rather than fixed, because a boosted car covers
   * a third more ground in the same flight and would otherwise come down in
   * front of the hoop.
   */
  private gateIdealAhead() {
    return (this.speed * raceInteraction.gateAirtime * 0.5) / this.curveLen;
  }

  /**
   * The player lifted. Judge it, and fly the arc it earned.
   *
   * Returns false when there was nothing to lift for, so the session can pass
   * the gesture on to the ramp's own window instead — the two use the same
   * movement and must never both claim one lift.
   */
  liftGate() {
    const i = this.armedGate;
    if (i < 0) return false;
    const g = this.boostGates[i];
    if (!g || !g.armed || g.done) return false;

    const ahead = (g.t - this.t + 1) % 1;
    /* Signed simulated seconds off the beat: positive is early, negative is
       late. Converted through the car's own speed, so the number means the
       same thing whether it was travelling at 26 or boosted to 34. */
    const errSec = ((ahead - this.gateIdealAhead()) * this.curveLen) / Math.max(1, this.speed);

    /* The player has acted. The gauge stops here; the verdict does not arrive
       until the car reaches the hoop, because until then there is nothing to
       judge — the whole rule is where the car gets to. */
    g.lifted = true;
    g.liftErr = errSec;

    /* Too far out to reach the hoop at all. The lift is dropped rather than
       flown: an arc begun this late comes down beyond the gate, and a car
       that jumps for no reason a second after the ring has gone past reads as
       a bug rather than as a mistake. It still counts as the player's answer,
       so the gate is theirs to have missed. */
    if (Math.abs(errSec) > raceInteraction.gateAcceptSec) return true;

    /* Airborne from the floor — there is no ramp here, the car simply leaves
       the road. Only if it is not already flying: a lift taken during the
       ramp's own jump must not restart the arc mid-air. */
    if (this.airT < 0 && this.rampU < 0) {
      this.airT = 0;
      this.airTime = raceInteraction.gateAirtime;
      this.airPeak = raceInteraction.gateRingY;
      this.airFrom = 0;
      /* Stay slow until the wheels are back down. The gate closes on the lift,
         so without this the world snaps back to full speed at the exact
         moment the car is about to go through the hoop — which is the one
         second of the lap worth watching. */
      this.slowThroughFlight = true;
    }
    return true;
  }

  /** Score the gate, put its fire out, and stop reporting it. */
  private closeGate(i: number, quality: BoostQuality, errSec: number | null) {
    const g = this.boostGates[i];
    if (!g || g.done) return;
    g.armed = false;
    g.done = true;
    g.stoke = 0;
    this.setBoostGlow(i, 0);
    if (this.armedGate === i) this.armedGate = -1;

    const points = quality === 'perfect' ? raceInteraction.scoreBoostPerfect
      : quality === 'good' ? raceInteraction.scoreBoostGood
      : 0;
    if (points > 0) {
      this.score += points;
      this.boost();
      haptic(quality === 'perfect' ? [16, 28, 16] : 18);
    }
    this.opts.onGateResult?.({ index: i, quality, errSec });
  }

  /**
   * Every gate is fresh again at the start of a lap.
   *
   * `done` is what stops one gate being judged twice on the way past it; it
   * has to be cleared somewhere or the second lap would have no gates at all.
   */
  private rearmGates() {
    for (const g of this.boostGates) {
      g.armed = false;
      g.done = false;
      g.stoke = 0;
      g.lifted = false;
      g.liftErr = null;
    }
    this.armedGate = -1;
  }

  /** Dim or light a gate's flame — the session brightens the one being run at. */
  setBoostGlow(index: number, k: number) {
    const gate = this.boostGates[index];
    if (!gate) return;
    const v = Math.max(0, Math.min(1, k));
    /* The hoop warms; it does not become a light. Driven to full yellow at
       full opacity it swallowed the fire around it and the gate read as a
       plain yellow doughnut again — brighter, and back where this started.
       Intensity belongs to the flames; the hoop only says which gate. */
    gate.flame.opacity = 0.55 + v * 0.3;
    gate.flame.color.setHex(k > 0.99 ? 0xFFAE2A : 0xFF6A00);
    /* Aiming at a gate stokes it: the fire brightens and stands further out,
       so a locked gate looks like it is roaring rather than merely turning a
       different colour. */
    gate.fireMats.forEach((m, j) => {
      /* Two additive layers over a core gradient reach white fast. The aimed
         state adds a third of its own brightness, not half again, and the
         locked tint is a warm cream rather than a step toward white. */
      m.opacity = (j ? 0.34 : 0.5) + v * 0.22;
      m.color.setHex(k > 0.99 ? 0xFFE9B8 : 0xFFFFFF);
    });
    gate.stoke = v;
  }

  /** True while the wheels are off the road. */
  get airborne() {
    return this.airT >= 0;
  }

  /** Award a jump the session has judged. */
  awardJump(points: number) {
    this.score += points;
    if (points > 0) haptic(points >= raceInteraction.scoreJumpPerfect ? [16, 30, 16] : 20);
  }

  /** Award a boost the session has judged. */
  awardBoost(points: number, speedUp: boolean) {
    this.score += points;
    if (speedUp) this.boost();
  }

  /**
   * The ramp, on the road at the jump point.
   *
   * Visual only. The car's arc is computed, not collided — a ramp the car has
   * to physically climb is a ramp it can also clip, stub its nose on, or take
   * at the wrong angle and cartwheel off, and none of those are the jump the
   * player was asked for. The brief is explicit: a deterministic base jump the
   * input decorates rather than decides.
   */
  /**
   * The launcher: a sled on two rails with a spring behind it, at the line.
   *
   * The control used to be a red rectangle in the overlay that happened to be
   * labelled "pull" — which is a button pretending to be a launcher, and the
   * reason people pressed it. This is the launcher: it stands on the track in
   * world space with the car sitting against it, and the sled travels back
   * under the finger with the spring closing up behind it. The tension you can
   * see is the tension you are about to get.
   */
  private buildLauncher() {
    const p = this.curve.getPointAt(0);
    const tan = this.curve.getTangentAt(0);
    this.launcher.position.copy(p);
    this.launcher.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan.clone().setY(0).normalize());

    const plastic = new THREE.MeshStandardMaterial({ color: color.hwO.int, roughness: 0.5, metalness: 0.05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2A2E36, roughness: 0.72 });
    const red = new THREE.MeshStandardMaterial({ color: 0xE01B22, roughness: 0.42, metalness: 0.08 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xB9C2CC, roughness: 0.35, metalness: 0.7 });
    this.disposables.push(plastic, dark, red, steel);

    const BED = LAUNCH_TRAVEL + 7;
    const midZ = BED / 2 - 1;
    /* Half-width of the whole launcher, against a road half-width of 4.5.

       It used to be built off ROAD_W and came out 4.37 at the feet — inside
       the road by a tenth of a unit, which is to say flush with it. Nothing of
       the track showed to either side, and from the launch camera the feet,
       which stand nearly two units tall at that very edge, project past the
       road's edge and the whole thing reads as hanging in the air. A launcher
       has to sit ON something visible. Nine tenths of a unit of road down each
       side is what makes it look placed rather than floating. */
    const LW = 3.6;

    /* The bed the sled runs along, and the two guide rails standing off it.
       Local +Z runs BACK from the line, since the car's own -Z is the way it
       faces. */
    const bedGeo = roundedBox(LW * 2 - 1.0, 0.45, BED, 0.16);
    this.disposables.push(bedGeo);
    const bed = new THREE.Mesh(bedGeo, plastic);
    bed.position.set(0, 0.22, midZ);
    this.launcher.add(bed);

    /* Livery down the bed, clear of the centreline where the car, the sled and
       the spring all live. Lying flat, it is lit by the same light as the bed
       under it, so this one IS a standard material — unlike the back plate,
       which faces the player and has to hold its colour whichever way the
       track has been turned. */
    const liveryTex = bedLiveryTexture();
    const liveryMat = new THREE.MeshStandardMaterial({ map: liveryTex, roughness: 0.5 });
    const liveryGeo = new THREE.PlaneGeometry(1.0, BED - 3.6);
    this.disposables.push(liveryTex, liveryMat, liveryGeo);
    for (const sgn of [-1, 1]) {
      const strip = new THREE.Mesh(liveryGeo, liveryMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(sgn * 2.2, 0.46, midZ);
      this.launcher.add(strip);
    }

    const railGeo = roundedBox(0.6, 0.95, BED, 0.2);
    /* A Blinkit-yellow cap along the top of each rail. The rails are Hot
       Wheels orange and the track they join is the same orange, so the
       partner's colour needs a surface of its own rather than a tint of
       theirs — and the cap is the one face of the rail the launch camera
       looks straight down onto. */
    const capGeo = roundedBox(0.62, 0.16, BED, 0.065);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xF8CB46, roughness: 0.45 });
    this.disposables.push(railGeo, capGeo, capMat);
    for (const sgn of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, plastic);
      rail.position.set(sgn * (LW - 0.4), 0.5, midZ);
      this.launcher.add(rail);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(sgn * (LW - 0.4), 1.02, midZ);
      this.launcher.add(cap);
    }

    /* Buttresses. Four tapered blocks outboard of the rails, which is what
       carries the toy-set read in the concept art: the launcher is not a
       block, it is a bed propped up on moulded feet. A four-sided cylinder IS
       a truncated pyramid, so one geometry does all four. */
    const footGeo = new THREE.CylinderGeometry(0.6, 0.85, 1.9, 12);
    this.disposables.push(footGeo);
    for (const sgn of [-1, 1]) {
      for (const z of [1.4, BED - 3.2]) {
        const foot = new THREE.Mesh(footGeo, dark);
        foot.position.set(sgn * (LW - 0.85), 0.95, z);
        this.launcher.add(foot);
      }
    }

    /* The back stop the spring pushes off.

       2.2 tall, not 2.6. The co-brand plate mounted on its rear face is tipped
       back to meet the launch camera, which walks its upper half INTO the
       stop's box — and the stop, being the dark part, won the depth test and
       drew a black bar straight across the plate between the chequer and the
       wordmarks. Measured: the tipped plate crosses the stop's rear plane at
       y=2.28, so a stop that ends below that cannot occlude it. Everything
       above is now plate standing proud of the stop, which is what a sign
       bolted to the back of a launcher looks like anyway. */
    const stopGeo = roundedBox(LW * 2 - 1.0, 2.2, 1.1, 0.3);
    this.disposables.push(stopGeo);
    const stop = new THREE.Mesh(stopGeo, dark);
    stop.position.set(0, 1.1, LAUNCH_TRAVEL + 5.4);
    this.launcher.add(stop);

    /* The co-brand plate, square-on to the launch camera.

       `MeshBasicMaterial`, not standard: this is printed livery on a plastic
       part, and it has to read at the same strength whichever way the player
       has turned the track in their room. Lit, it went the colour of whatever
       the key light happened to be doing to the back of the launcher. */
    const plateTex = coBrandTexture();
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false });
    const brandGeo = new THREE.PlaneGeometry(LW * 2 - 1.5, (LW * 2 - 1.5) / 3);
    this.disposables.push(plateTex, plateMat, brandGeo);
    const brandPlate = new THREE.Mesh(brandGeo, plateMat);
    /* Just proud of the stop's rear face so it cannot z-fight with it, and
       tipped back to meet the camera. The launch view looks down at about 31
       degrees; a plate standing vertical presents almost none of itself to
       that and read as a yellow line along the bottom of the frame. */
    brandPlate.position.set(0, 2.15, LAUNCH_TRAVEL + 5.4 + 0.62);
    brandPlate.rotation.x = -0.5;
    this.launcher.add(brandPlate);

    /* The sled: a plate the car rests against, with a grip standing up behind
       it so there is something that visibly reads as the thing being pulled. */
    const plateGeo = roundedBox(LW * 2 - 1.8, 1.5, 1.2, 0.3);
    const gripGeo = roundedBox(LW * 2 - 2.8, 2.2, 0.8, 0.26);
    this.disposables.push(plateGeo, gripGeo);
    const plate = new THREE.Mesh(plateGeo, red);
    plate.position.y = 0.75;
    this.launchSled.add(plate);
    const grip = new THREE.Mesh(gripGeo, red);
    grip.position.set(0, 1.9, 0.5);
    this.launchSled.add(grip);
    this.launchSled.position.z = 3.2;
    this.launcher.add(this.launchSled);

    /* A coil spring between sled and stop. Five rings that bunch up as the
       sled comes back — a spring that does not close is a spring nobody
       believes is loaded. */
    const coilGeo = new THREE.TorusGeometry(1.5, 0.26, 8, 18);
    this.disposables.push(coilGeo);
    for (let i = 0; i < 5; i++) {
      const coil = new THREE.Mesh(coilGeo, steel);
      coil.position.y = 1.15;
      this.launcher.add(coil);
      this.launchCoils.push(coil);
    }

    /* ---- the PULL BACK lever ----

       The part the finger actually works, so it is the one part built as a
       hierarchy rather than a heap of meshes: a pivot group carrying an arm
       and a paddle, rotating about the axis across the track. Everything else
       here is scenery and never moves.

       Beside the sled it drives, and one lane off the centreline.

       Not because the lever should be off-centre — the LAUNCHER is centred in
       frame, which is what was actually wrong before, when the circuit's start
       straight ran across the view and pushed the whole thing off the left
       edge. The lever steps aside by three units because the car sits on that
       centreline: a seven-unit lever directly behind a one-unit-tall car hides
       it from every camera lower than a plan view. Three units is more than
       the two half-widths, so the car is clear at any sane angle. */
    this.launchLever.position.set(-2.3, 1.05, 4.2);
    this.launcher.add(this.launchLever);

    const armGeo = roundedBox(1.15, 4.3, 0.95, 0.3);
    const padGeo = roundedBox(2.0, 1.6, 1.6, 0.34);
    const hubGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14);
    this.disposables.push(armGeo, padGeo, hubGeo);

    const arm = new THREE.Mesh(armGeo, red);
    arm.position.y = 2.15;
    this.launchLever.add(arm);
    const pad = new THREE.Mesh(padGeo, red);
    pad.position.set(0, 4.45, -0.25);
    pad.rotation.x = -0.3;
    this.launchLever.add(pad);

    /* On the paddle's REAR face — the one turned toward the player — and
       parented to the paddle so it swings with it, because the mark is part of
       the moulding rather than a decal floating where the lever used to be.

       The top face was the obvious place and was the wrong one: the paddle
       leans about 31 degrees toward the track, and the launch camera looks
       down at about 31, so its upper face is almost exactly edge-on and the
       mark was invisible. */
    const markTex = leverMarkTexture();
    const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, toneMapped: false });
    const markGeo = new THREE.PlaneGeometry(1.6, 0.8);
    this.disposables.push(markTex, markMat, markGeo);
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.set(0, 0, 0.81);
    pad.add(mark);
    /* The hinge, shown. A lever with no visible pivot reads as a post that
       happens to lean. */
    const hub = new THREE.Mesh(hubGeo, steel);
    hub.rotation.z = Math.PI / 2;
    this.launchLever.add(hub);

    /* A generous invisible box is what the raycast actually tests against.
       The arm is about a centimetre wide on a placed track and a thumb is not
       — hit-testing the visible geometry meant a lever you could see and not
       grab. `material.visible = false` keeps it out of the render while
       leaving it in the raycast; `object.visible = false` would drop it from
       both. */
    const hitGeo = new THREE.BoxGeometry(3.8, 6.4, 3.6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.disposables.push(hitGeo, hitMat);
    this.leverHit = new THREE.Mesh(hitGeo, hitMat);
    this.leverHit.position.y = 2.6;
    this.launchLever.add(this.leverHit);

    /* ---- the cue ----

       Three chevrons standing over the lever, running downward on a loop.

       A lever nobody knows is a lever is scenery, and this one is small, red,
       and sitting in a scene full of other small red parts. The instruction is
       a DIRECTION — down — so the cue has to be a direction rather than a
       word; the same reasoning as the lift arrows on the jump.

       In the scene rather than on the overlay, so it belongs to the launcher:
       it is at the right size and the right angle in the 3D race and the AR
       one without either of them knowing it exists, and it leaves with the
       launcher when the car does. */
    const cueShape = new THREE.Shape();
    {
      const w = 0.95;
      const h = 0.8;
      const t = 0.34;
      cueShape.moveTo(-w, 0);
      cueShape.lineTo(0, -h);
      cueShape.lineTo(w, 0);
      cueShape.lineTo(w - t, 0);
      cueShape.lineTo(0, -h + t * 1.35);
      cueShape.lineTo(-w + t, 0);
      cueShape.closePath();
    }
    const cueGeo = new THREE.ShapeGeometry(cueShape);
    this.disposables.push(cueGeo);
    for (let i = 0; i < 3; i++) {
      /* One material per chevron — they fade on different phases, and opacity
         lives on the material, so a shared one would fade all three together
         and the cue would blink instead of running. */
      const m = new THREE.MeshBasicMaterial({
        color: 0xFFC400,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      this.disposables.push(m);
      const chev = new THREE.Mesh(cueGeo, m);
      /* Over the lever's rest position, not parented to it: parented, the cue
         would swing away with the arm the moment it was grabbed, which is
         exactly when it stops being needed and should simply fade. */
      chev.position.set(-2.3, 8.5 - i * 1.15, 3.4);
      chev.rotation.x = -0.5; // square-on to the launch camera, like the plate
      this.launcher.add(chev);
      this.leverCue.push(chev);
    }

    this.root.add(this.launcher);
    this.launcher.visible = true;
    this.setLaunchPull(0);
  }

  /**
   * Animate what moves before the race does.
   *
   * The engine's `update` is not ticked until the lever goes — no clock, no
   * pickups, nothing — so anything that has to live during the launch view
   * needs its own tick. Right now that is the lever cue and nothing else.
   *
   * dt in real seconds. There is no simulation to be in step with yet, so
   * there is no time scale here either.
   */
  tickIdle(dt: number) {
    if (!this.launcher.visible || !this.leverCue.length) return;
    this.cueT += dt;
    /* Gone once the lever is moving. The cue is an answer to "what do I do",
       and by then it has been answered. */
    const alive = Math.max(0, 1 - this.launchPull * 5);
    const PERIOD = 1.15;
    for (const [i, chev] of this.leverCue.entries()) {
      const phase = ((this.cueT / PERIOD) - i * 0.22) % 1;
      const k = phase < 0 ? phase + 1 : phase;
      /* Up fast, hold, out slowly — so the three read as one thing travelling
         down rather than three things blinking in turn. */
      const fade = k < 0.16 ? k / 0.16 : Math.max(0, 1 - (k - 0.16) / 0.62);
      (chev.material as THREE.MeshBasicMaterial).opacity = fade * 0.92 * alive;
      chev.position.y = 8.5 - i * 1.15 - k * 0.45;
    }
  }

  /**
   * Draw the sled back. `k` is 0..1 of full travel.
   *
   * The CAR comes back with it — it is resting against the plate — which is
   * what makes the pull read as loading a launcher rather than as sliding a
   * part around behind a car that is ignoring it. The lever swings through the
   * same `k`, so the thing under the finger and the thing being loaded are
   * visibly one mechanism.
   */
  setLaunchPull(k: number) {
    this.launchPull = Math.max(0, Math.min(1, k));
    this.launchLever.rotation.x = LEVER_REST + (LEVER_PULLED - LEVER_REST) * this.launchPull;
    if (!this.launchCoils.length) return;
    const back = this.launchPull * LAUNCH_TRAVEL;
    this.launchSled.position.z = 3.2 + back;
    const from = this.launchSled.position.z + 1.1;
    const to = LAUNCH_TRAVEL + 4.8;
    for (const [i, coil] of this.launchCoils.entries()) {
      coil.position.z = from + ((to - from) * (i + 0.5)) / this.launchCoils.length;
      // flatten as they bunch, so the spring reads as compressing
      coil.scale.z = Math.max(0.35, 1 - this.launchPull * 0.55);
    }
    this.layoutCar();
  }

  /** How far the lever is currently drawn, 0..1. */
  get pull() {
    return this.launchPull;
  }

  /**
   * True when `ray` hits the lever.
   *
   * The engine owns this rather than the session because the lever lives in
   * track-local space under `root`, and root carries the AR anchor's scale and
   * rotation — a caller testing world coordinates against local geometry gets
   * it wrong in exactly the way that is hard to see.
   */
  /** Where the lever is in the world — for a screen-space near-miss test. */
  leverWorld(out: THREE.Vector3) {
    if (this.leverHit) this.leverHit.getWorldPosition(out);
    return out;
  }

  hitLever(ray: THREE.Raycaster) {
    if (!this.leverHit || !this.launcher.visible) return false;
    return ray.intersectObject(this.leverHit, false).length > 0;
  }

  /**
   * True when `ray` hits ANY of the launcher — bed, rails, sled, spring, stop.
   *
   * Because "pull the launcher" is what people actually do: they put a thumb
   * on the machine and drag. Insisting on the lever itself made a control out
   * of the smallest part of the biggest object on screen, and a press that
   * landed on the bed an inch below it did nothing at all.
   */
  hitLauncher(ray: THREE.Raycaster) {
    if (!this.launcher.visible) return false;
    return ray.intersectObject(this.launcher, true).length > 0;
  }

  /**
   * Where the camera sits while the launcher is being drawn.
   *
   * Behind and above the back stop, off to the right so the lever on the left
   * is side-on to the viewer rather than pointing at them — a lever swinging
   * toward the camera barely moves on screen, which is the one thing this
   * framing has to show. The car, the sled and the lane ahead are all in shot.
   */
  launcherCameraTarget(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const p = this.curve.getPointAt(0);
    const tan = this.curve.getTangentAt(0).clone().setY(0).normalize();
    out.pos.copy(p).addScaledVector(tan, -(LAUNCH_TRAVEL + 17));
    /* Squarely on the track's axis, so the launch straight runs straight up
       the middle of the screen rather than off across it.

       Low enough to be a view along the track rather than a plan of it. What
       decides it is the sled grip, three units tall and three behind the car:
       clearing that needs y > 1.5 + 0.469 * the distance back, so 14 at 26.
       Sixteen has margin and still reads as standing behind the launcher. */
    out.pos.y = 16.0;
    /* Looking PAST the car rather than at it, so the lane the launch is about
       to send it down is the subject and the launcher sits in the near corner.
       Framed on the launcher itself the shot was all spring and no race. */
    out.look.copy(p).addScaledVector(tan, 8.0);
    out.look.y = 0.8;
    return out;
  }

  /** Off the track once the car has gone. */
  private hideLauncher() {
    this.launcher.visible = false;
    this.launchPull = 0;
  }

  private buildRamp() {
    const up = new THREE.Vector3(0, 1, 0);
    const t = raceInteraction.jumpAt;
    const p = this.curve.getPointAt(t);
    const tan = this.curve.getTangentAt(t);

    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().setY(0).normalize());

    /* A wedge: a box tipped up about its trailing edge, so the road rises to a
       takeoff lip rather than a block appearing in the way. */
    const len = RAMP_LEN;
    const rise = RAMP_RISE;
    const geo = new THREE.BoxGeometry(ROAD_W, 0.7, len);
    const mat = new THREE.MeshStandardMaterial({ color: color.hwO.int, roughness: 0.5, metalness: 0.05 });
    this.disposables.push(geo, mat);
    const wedge = new THREE.Mesh(geo, mat);
    wedge.rotation.x = -RAMP_ANGLE;
    wedge.position.set(0, rise / 2, len / 2);
    g.add(wedge);

    // chevrons up the face, so the takeoff reads before the car is on it
    const chevGeo = new THREE.PlaneGeometry(ROAD_W * 0.7, 0.9).rotateX(-Math.PI / 2);
    const chevMat = new THREE.MeshBasicMaterial({ color: 0xFFD400, transparent: true, opacity: 0.9 });
    this.disposables.push(chevGeo, chevMat);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(chevGeo, chevMat);
      const z = 2.5 + i * 3.4;
      c.position.set(0, (rise * z) / len + 0.42, z);
      c.rotation.x = -RAMP_ANGLE;
      g.add(c);
    }
    this.root.add(g);
    void up;
  }

  private buildPickups() {
    const COUNT = 46;
    const texCache = new Map<string, THREE.Texture>();
    for (let i = 0; i < COUNT; i++) {
      const def = PICKUPS[i % PICKUPS.length];
      let tex = texCache.get(def.image);
      if (!tex) {
        tex = spriteTexture(def.image);
        texCache.set(def.image, tex);
        this.disposables.push(tex);
      }
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      this.disposables.push(mat);
      const sprite = new THREE.Sprite(mat);
      const size = def.points >= 500 ? 2.6 : def.points >= 250 ? 2.2 : 1.9;
      sprite.scale.set(size, size, 1);
      // spread along the loop, alternating across the road
      const t = (i + 1.5) / (COUNT + 3);
      const lateral = [-2.6, 0, 2.6, -1.3, 1.3][i % 5];
      this.pickups.push({ sprite, t, lateral, points: def.points, name: def.name, alive: true, pop: 0 });
      this.root.add(sprite);
    }
    this.layoutPickups();
  }

  private layoutPickups() {
    const up = new THREE.Vector3(0, 1, 0);
    for (const p of this.pickups) {
      const pos = this.curve.getPointAt(p.t);
      const tan = this.curve.getTangentAt(p.t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      p.sprite.position.copy(pos).addScaledVector(right, p.lateral).setY(1.15);
    }
  }

  /**
   * Tumbling space debris in place of the old traffic cones. Same gameplay
   * contract — clipping one scrubs speed — but a chunk of shattered rock belongs
   * in this world and an orange cone did not.
   */
  private buildDebris() {
    const geo = new THREE.DodecahedronGeometry(0.62, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: scene.debris,
      roughness: 0.9,
      metalness: 0.12,
      flatShading: true,
    });
    mat.envMapIntensity = 0.4;
    this.disposables.push(geo, mat);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14 + 0.021;
      const lateral = i % 2 === 0 ? -3.3 : 3.3;
      const mesh = new THREE.Mesh(geo, mat);
      const pos = this.curve.getPointAt(t % 1);
      const tan = this.curve.getTangentAt(t % 1);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      mesh.position.copy(pos).addScaledVector(right, lateral).setY(0.62);
      mesh.rotation.set(i * 0.9, i * 1.3, i * 0.5);
      const s = 0.8 + ((i * 7) % 5) * 0.18;
      mesh.scale.set(s, s * 0.82, s);
      this.debris.push({
        mesh,
        t: t % 1,
        lateral,
        spin: new THREE.Vector3(0.25 + (i % 3) * 0.12, 0.4 + (i % 5) * 0.09, 0.18 + (i % 4) * 0.07),
        broken: 0,
        shards: [],
      });
      this.root.add(mesh);
    }
  }

  /**
   * Break a chunk of debris into tumbling shards. Hitting a rock and having it
   * sit there unmoved read as scenery; breaking it reads as impact, and it also
   * tells the player that piece is spent.
   */
  private shatter(c: {
    mesh: THREE.Mesh;
    broken: number;
    shards: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
  }) {
    c.broken = 0.0001;
    c.mesh.visible = false;
    const geo = new THREE.TetrahedronGeometry(0.26, 0);
    const mat = c.mesh.material as THREE.Material;
    for (let i = 0; i < 6; i++) {
      const sh = new THREE.Mesh(geo, mat);
      sh.position.copy(c.mesh.position);
      const a = (i / 6) * Math.PI * 2 + Math.random();
      sh.scale.setScalar(0.6 + Math.random() * 0.6);
      this.root.add(sh);
      c.shards.push({
        mesh: sh,
        vel: new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 3), 5 + Math.random() * 4, Math.sin(a) * (3 + Math.random() * 3)),
        spin: new THREE.Vector3(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5),
      });
    }
    this.disposables.push(geo);
  }

  /**
   * A small set of space props that read at tabletop scale.
   *
   * The main asteroid field is built for the 3D race, where the camera sits
   * inside the scene — dropped into AR it is a ring of boulders bigger than the
   * table. This is a scaled-down companion: a handful of rocks orbiting just
   * above and outside the circuit, close enough to the track to stay in frame
   * when the whole thing is 2.4 m across.
   */
  private buildArProps() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: scene.asteroid,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    mat.envMapIntensity = 0.4;
    this.disposables.push(geo, mat);

    const up = new THREE.Vector3(0, 1, 0);
    const N = 10;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.35) / N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const m = new THREE.Mesh(geo, mat);
      const sc = 1.5 + ((i * 5) % 7) * 0.55;
      m.scale.set(sc, sc * 0.8, sc);
      m.position
        .copy(p)
        .addScaledVector(right, (ROAD_W / 2 + 3.5 + ((i * 3) % 5)) * side)
        .setY(3 + ((i * 7) % 9));
      m.rotation.set(i * 1.2, i * 0.8, i * 0.5);
      this.arProps.push({
        mesh: m,
        spin: new THREE.Vector3(0.12 + (i % 3) * 0.05, 0.18 + (i % 4) * 0.04, 0.09),
        bobPhase: i * 0.7,
        baseY: m.position.y,
      });
      this.propRoot.add(m);
    }
    this.root.add(this.propRoot);
  }

  /* ---------------- public API ---------------- */

  /**
   * In AR the circuit sits on a real table, so the giant ground disc and the
   * city blocks are dropped: they dwarf the track, hide the car and cost fill
   * rate for nothing. Only track, rails, gate, pickups, debris and car are placed.
   */
  setPresentation(mode: '3d' | 'ar') {
    const show = mode === '3d';
    if (this.ground) this.ground.visible = show;
    if (this.scenery) this.scenery.visible = show;
    // the full field is for the 3D race; the compact props are for AR
    this.propRoot.visible = !show;
  }

  setCar(model: THREE.Object3D) {
    if (this.car) this.carTilt.remove(this.car);
    this.car = model;
    this.carTilt.add(model);
    // Put the car on the grid immediately. Without this it sits at the world
    // origin — the middle of the oval — until the first update() tick, so it
    // is invisible for the whole 3-2-1 countdown.
    this.layoutCar();
  }

  /** Position + orient the car on the circuit for the current (t, lateral). */
  private layoutCar() {
    const up = new THREE.Vector3(0, 1, 0);
    const pos = this.curve.getPointAt(this.t);
    const tan = this.curve.getTangentAt(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    this.carTilt.position.copy(pos).addScaledVector(right, this.lateral);
    // held back against the launcher's plate while the sled is drawn
    if (this.launchPull > 0) this.carTilt.position.addScaledVector(tan, -this.launchPull * LAUNCH_TRAVEL);
    if (this.jumpHeightNow > 0) this.carTilt.position.y += this.jumpHeightNow;
    this.carTilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan.clone().setY(0).normalize());
    // A drifting car points where it *was* going, not where it is sliding to.
    if (this.driftYaw !== 0) this.carTilt.rotateY(this.driftYaw);
    // Nose up the ramp and through the arc. Local X is the car's axle line.
    if (this.jumpPitch !== 0) this.carTilt.rotateX(this.jumpPitch);
  }

  /** -1 (full left) .. 1 (full right) */
  setSteer(v: number) {
    this.steer = Math.max(-1, Math.min(1, v));
  }

  /**
   * Hand the throttle to the player. Calling any of the manual controls
   * switches the engine out of self-driving mode for the rest of the race.
   */
  setThrottle(v: number) {
    this.manual = true;
    this.throttle = Math.max(0, Math.min(1, v));
  }

  setBrake(v: number) {
    this.manual = true;
    this.braking = Math.max(0, Math.min(1, v));
  }

  /**
   * Handbrake: less grip, much more lateral slide, visible yaw out of line.
   * Deliberately does NOT flip the engine into manual mode — the 3D race
   * drives itself, and taking the throttle away the first time the player
   * touched the handbrake would simply stop the car dead.
   */
  setDrift(on: boolean) {
    this.drifting = on;
  }

  get isDrifting() {
    return this.drifting && this.speed > 6;
  }

  get isManual() {
    return this.manual;
  }

  boost() {
    this.boostUntil = this.elapsed + 1.4;
  }

  start() {
    /* The launcher is scenery the moment the race is running, and it sits ON
       the track at t=0 — so a car that does not leave from it drives back
       through it on the next lap. `launch()` always cleared it; `start()` did
       not, which left a launcher and its lever standing in the road for the
       whole of the 3D race and for any AR start that skipped the pull. */
    this.hideLauncher();
    this.running = true;
  }

  /**
   * Launch off the line with the speed the pull earned.
   *
   * `start()` set the car running from a standstill, which is right for a
   * countdown and wrong for a launcher — pulling a sled back and letting go
   * that produces no movement is a dead control. Power 0 is a fumbled release
   * and barely moves; a full pull leaves the line already at the pace the car
   * would otherwise need a straight to reach, and trips the boost.
   */
  launch(power: number) {
    const p = Math.max(0, Math.min(1, power));
    this.hideLauncher();
    this.running = true;
    this.speed = 5 + p * 19;
    if (p > 0.85) this.boost();
  }

  pause() {
    this.running = false;
    /* The clock stops being read the moment this returns, so anything it was
       holding down has to be let go here — a race paused inside bullet time
       otherwise leaves the bus muffled with nothing left to un-muffle it. */
    setAudioTimeScale(1);
  }

  get isRunning() {
    return this.running;
  }

  getCarWorldPosition(out: THREE.Vector3) {
    return this.carTilt.getWorldPosition(out);
  }

  getCarWorldDirection(out: THREE.Vector3) {
    return this.carTilt.getWorldDirection(out);
  }

  getSpeed() {
    return this.speed;
  }

  applyObstacleBounce(penaltyPoints = DEBRIS_PENALTY) {
    // Rebound backward
    this.speed = -Math.max(6, this.speed * 0.5);
    // Deflect lateral
    this.lateral += (Math.random() > 0.5 ? 1 : -1) * 0.8;
    this.driftYaw = (Math.random() - 0.5) * 0.4;
    const before = this.score;
    this.score = Math.max(0, this.score - penaltyPoints);
    // report what was actually lost, not what was asked for: near zero the
    // deduction is clamped, and showing -100 off a score of 40 is a lie
    if (before > this.score) this.opts.onPenalty?.(before - this.score);
  }

  /**
   * Chase camera. Offsets are expressed in world units and converted to curve
   * parameters, so the framing does not change if the circuit is resized.
   * BEHIND/HEIGHT are tuned so a 4.2-unit car sits in the lower third of frame.
   */
  /**
   * Chase camera: behind the CAR along its heading, looking into the turn.
   *
   * It used to sit at a point 8.5 units back ALONG THE CURVE and look at one 6
   * units forward along it — which is fine on a circle of radius 33 and wrong
   * on a corner of radius 15, because those two points are then most of a
   * quarter-turn apart and the camera ends up looking across the chord at the
   * outside wall rather than down the road. The oval never exposed it; the new
   * corners do.
   *
   * So the position is offset from the car along the car's OWN heading, which
   * cannot be thrown by corner radius, while the look-at still runs forward
   * along the curve so the camera leads into the bend instead of staring at
   * the apex barrier.
   */
  cameraTarget(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const BEHIND = 9.5;
    const HEIGHT = 3.4;
    const AHEAD = 9.0;
    const up = new THREE.Vector3(0, 1, 0);

    const on = this.curve.getPointAt(this.t);
    const tan = this.smoothTangent(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const car = on.clone().addScaledVector(right, this.lateral);

    out.pos.copy(car).addScaledVector(tan, -BEHIND);
    // rises with the car so the jump stays in frame instead of leaving the top
    out.pos.y = HEIGHT + this.jumpHeightNow * 0.55;

    const ahead = this.curve.getPointAt((this.t + AHEAD / this.curveLen) % 1);
    out.look.copy(ahead).addScaledVector(right, this.lateral * 0.5);
    out.look.y = 0.8 + this.jumpHeightNow * 0.7;
    return out;
  }

  /**
   * First-person / close chase camera for AR mode. The camera sits tight
   * behind the car so the player sees the road from near the driver's POV.
   * The car stays visible in the lower portion of the frame.
   */
  /**
   * The heading to point a camera along, with the curve's own jitter taken out.
   *
   * `getTangentAt` is the instantaneous tangent, and a Catmull-Rom spline is
   * only C1: its CURVATURE steps at every control point. The tangent itself is
   * continuous, so nothing looks wrong in a still frame — but its rate of
   * change is not, and a camera built on it swings at a speed that jumps from
   * one frame to the next. Measured around a lap, the yaw rate was changing by
   * up to 44 deg/s between consecutive frames in the corners. That is the
   * shake.
   *
   * A chord between two points either side of the car is the same heading with
   * the steps averaged out — a low-pass filter with no state, no lag, and no
   * dependence on frame rate. 6 units either way is about a car length and a
   * half, which is short enough to still lead into a bend.
   */
  private smoothTangent(t: number) {
    const D = 6 / this.curveLen;
    const a = this.curve.getPointAt((t - D + 1) % 1);
    const b = this.curve.getPointAt((t + D) % 1);
    return b.clone().sub(a).setY(0).normalize();
  }

  /**
   * Signed curvature of the road at `t`, in radians per unit of arc length.
   *
   * Positive means the road bends toward `right`, so a car that does nothing
   * ends up to the LEFT of where the road went — which is why the corner load
   * is subtracted rather than added.
   *
   * Measured off the same smoothed headings the camera uses, for the same
   * reason: the raw tangent's rate of change steps at every control point, and
   * a corner load built on it would kick the car sideways on the steps.
   */
  private curvatureAt(t: number) {
    const d = 4 / this.curveLen;
    const h0 = this.smoothTangent((t - d + 1) % 1);
    const h1 = this.smoothTangent((t + d) % 1);
    const cross = h0.x * h1.z - h0.z * h1.x;
    const dot = Math.max(-1, Math.min(1, h0.dot(h1)));
    return Math.atan2(-cross, dot) / 8;
  }

  fpCameraTarget(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const BEHIND = 2.5;   // much closer than the 3D chase cam
    const HEIGHT = 0.9;   // just above the car roof
    const AHEAD  = 5.0;   // look-at well ahead for a sense of speed
    const up = new THREE.Vector3(0, 1, 0);
    const dAhead = AHEAD / this.curveLen;

    /* Behind the CAR along its heading, for the same reason the chase cam is —
       and off the same smoothed heading, which matters more here than there:
       this camera sits 2.5 units back rather than 9.5, and the closer the
       camera is to what it is following the larger the angle any given wobble
       becomes. The AR race is where the shake was worst, and this is why. */
    const on = this.curve.getPointAt(this.t);
    const tan = this.smoothTangent(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const car = on.clone().addScaledVector(right, this.lateral);
    out.pos.copy(car).addScaledVector(tan, -BEHIND);
    out.pos.y = HEIGHT + this.jumpHeightNow;

    const ahead = this.curve.getPointAt((this.t + dAhead) % 1);
    out.look.copy(ahead).addScaledVector(right, this.lateral * 0.55);
    out.look.y = 0.4 + this.jumpHeightNow * 0.8;
    return out;
  }

  /** Advance the simulation. dt in REAL seconds, as the frame measured it. */
  update(dtReal: number) {
    if (!this.running || this.done) return;
    dtReal = Math.min(dtReal, 0.05); // clamp after tab switches

    /* --- the clock ---

       Chased on REAL seconds. Ramping the time scale with the time scale
       applied would mean the deeper into bullet time the race went, the longer
       it took to climb back out — the effect would never let go cleanly.

       Into slow motion fast and out of it gently: the drop is the punch that
       tells you the gate is here, and the climb back is the car picking the
       speed back up. Symmetrical rates made the return read as a stutter. */
    const clockRate = this.slowTarget < this.timeScale ? 9 : 3.6;
    this.timeScale += (this.slowTarget - this.timeScale) * chase(clockRate, dtReal);
    if (Math.abs(this.timeScale - this.slowTarget) < 0.004) this.timeScale = this.slowTarget;
    setAudioTimeScale(this.timeScale);
    const slowNow = this.timeScale < 0.85;
    if (slowNow !== this.slowReported) {
      this.slowReported = slowNow;
      this.opts.onBulletTime?.(slowNow);
    }

    /* The outro, also on real seconds, and the only thing that can end it. The
       car keeps driving underneath in slow motion — the race is over, but it
       does not STOP, which is the whole point of not cutting to the result on
       the frame the line is crossed. */
    if (this.outroAt >= 0) {
      this.outroAt += dtReal;
      if (this.outroAt >= FINISH_OUTRO) return this.finish(this.outroCrossed);
    }

    const dt = dtReal * this.timeScale;
    this.elapsed += dt;

    // --- longitudinal ---
    const boosting = this.elapsed < this.boostUntil;
    const vMax = boosting ? 34 : 26;
    if (this.manual) {
      // throttle accelerates, brake bites hard, everything else is drag
      const drag = 3.2 + this.speed * 0.12 + (this.drifting ? 5.5 : 0);
      const a = this.throttle * 20 - this.braking * 30 - drag;
      this.speed = Math.max(0, Math.min(vMax, this.speed + a * dt));
    } else {
      this.speed += ((boosting ? 34 : 24) - this.speed) * chase(1.8, dt);
    }
    const prevT = this.t;
    /* Hitting debris sets a NEGATIVE speed — the car rebounds — so this has to
       wrap both ways. A bare `% 1` returns a negative for a negative operand,
       which put `t` outside 0..1 and made every position on the lap wrong
       until the car had driven forward past the seam again. */
    this.t = ((((this.t + (this.speed * dt) / this.curveLen) % 1) + 1) % 1);
    if (prevT > 0.92 && this.t < 0.08 && this.speed > 0) {
      this.lap += 1;
      this.rearmGates();
    }

    /* Events only fire while the car is going FORWARDS.

       Reversing off a chunk of debris made `prevT > this.t` true on every
       frame, which is exactly the shape of the lap-seam test the gates and the
       ramp use — so a debris hit anywhere near the ramp tripped it and the car
       climbed into the air for no reason the player could see. It also handed
       out boosts at gates the car had never reached. */
    const goingForward = this.speed > 0;

    /* Where the nose wants to be this frame. Chased rather than assigned: the
       arc's slope at the lip is far steeper than the ramp that launched the
       car, so setting it directly snapped the nose from 11 degrees to 34 in a
       single frame. It rises into the arc now, and settles back to level after
       the landing instead of dropping flat. */
    let pitchTarget = 0;

    /* The ramp. Armed the same way as the gates, and for the same reason. */
    if (this.interactions && raceInteraction.jumpEnabled && goingForward && this.airT < 0) {
      const jLead = (this.speed * raceInteraction.jumpWarnLead) / this.curveLen;
      const jAhead = (raceInteraction.jumpAt - this.t + 1) % 1;
      if (!this.jumpArmed && jAhead < jLead) {
        this.jumpArmed = true;
        this.opts.onJumpArm?.();
      }
      const crossed = prevT <= raceInteraction.jumpAt && this.t > raceInteraction.jumpAt;
      const wrapped = prevT > this.t && (raceInteraction.jumpAt > prevT || raceInteraction.jumpAt <= this.t);
      if (this.jumpArmed && (crossed || wrapped)) {
        this.jumpArmed = false;
        this.rampU = 0;
      }
    }

    /* On the ramp. The car CLIMBS it — rising along the wedge's face with its
       nose at the wedge's own angle — and only leaves the ground at the lip.
       It used to pop vertically off the road at the ramp's base, which read as
       the car bouncing rather than as the car taking a jump. */
    if (this.rampU >= 0) {
      const span = RAMP_LEN / this.curveLen;
      const along = (this.t - raceInteraction.jumpAt + 1) % 1;
      this.rampU = Math.min(1, along / span);
      this.jumpHeightNow = RAMP_RISE * this.rampU;
      pitchTarget = RAMP_ANGLE;
      if (this.rampU >= 1) {
        this.rampU = -1;
        this.airT = 0;
        this.airTime = raceInteraction.jumpAirtime;
        this.airPeak = raceInteraction.jumpHeight;
        this.airFrom = RAMP_RISE; // it leaves the road at the lip's height
        this.opts.onJumpTakeoff?.();
      }
    }

    /* Airborne. The car keeps travelling along the curve — it is the ROAD that
       drops away, not the car that leaves the track — so there is no way to
       come down anywhere but back on it. A jump you can fail off the side of
       is a jump that ends the race on a sensor reading, which the brief rules
       out. Input decides what it was worth, never whether you made it. */
    if (this.airT >= 0) {
      this.airT += dt / this.airTime;
      if (this.airT >= 1) {
        this.airT = -1;
        this.jumpHeightNow = 0;
        this.slowThroughFlight = false;
        this.opts.onJumpLand?.();
      } else {
        /* Leaves at `airFrom` and comes down to road level, so a ramp jump
           starts where the ramp ended instead of teleporting to zero — and a
           gate jump, which leaves from the floor, starts at zero because that
           is what `airFrom` is for it. The parabola on top peaks halfway
           across, which is what puts a gate lift through the middle of the
           hoop when it lands on the beat. */
        const a = this.airT;
        const h = this.airPeak;
        this.jumpHeightNow = this.airFrom * (1 - a) + h * 4 * a * (1 - a);
        /* The nose follows the arc rather than staying level: up on the way
           out, through flat at the apex, down on the way in. dy/da divided by
           the distance covered in that time IS the slope the car is on. */
        const dyda = -this.airFrom + h * 4 * (1 - 2 * a);
        const run = Math.max(1, this.speed * this.airTime);
        pitchTarget = Math.max(-0.6, Math.min(0.6, Math.atan2(dyda, run)));
      }
    }

    this.jumpPitch += (pitchTarget - this.jumpPitch) * chase(9, dt);
    if (Math.abs(this.jumpPitch) < 0.002) this.jumpPitch = 0;

    /* Boost gates. Armed by DISTANCE rather than by a fixed lead in `t`,
       because `t` per second depends on how fast the car happens to be going
       — a lead measured in curve units would give a flying car half the
       warning of a slow one, and the warning is the thing being judged.

       The gate is a hoop the car has to be IN THE AIR to pass through: at road
       level it drives under the ring with a car's height to spare. So the beat
       is not the gate, it is half an airtime before the gate — lift there and
       the top of the arc lands in the middle of the hole. */
    let gateArmed = false;
    if (this.interactions && raceInteraction.boostEnabled && goingForward) {
      const lead = (this.speed * raceInteraction.boostWarnLead) / this.curveLen;
      this.fireT += dt;
      for (let i = 0; i < this.boostGates.length; i++) {
        const g = this.boostGates[i];

        /* Turn the two sheets against each other and breathe the whole thing.
           Two incommensurable rates rather than one, so the eye never catches
           the texture repeating — one painting, turned, is what sells this as
           fire rather than as a picture of fire. */
        g.fire[0].rotation.z = this.fireT * 0.85 + i;
        g.fire[1].rotation.z = -this.fireT * 0.52 - i;
        const flick =
          1 + Math.sin(this.fireT * 12.3 + i * 2.1) * 0.035 + Math.sin(this.fireT * 6.7 + i) * 0.028;
        const sc = (1 + g.stoke * 0.12) * flick;
        g.fire[0].scale.setScalar(sc);
        g.fire[1].scale.setScalar(sc * 0.92);

        // forward distance to the gate, wrapped
        const ahead = (g.t - this.t + 1) % 1;
        if (!g.armed && !g.done && ahead < lead && this.outroAt < 0) {
          g.armed = true;
          this.armedGate = i;
        }

        if (g.armed && !g.lifted) {
          gateArmed = true;
          /* The gauge. 0 when the gate arms, 1 exactly on the beat, and past 1
             while the window is still closing — the overlay clamps what it
             draws, but the engine reports the truth so a late lift can still
             be told apart from no lift at all. */
          const ideal = this.gateIdealAhead();
          const k = (lead - ahead) / Math.max(1e-6, lead - ideal);
          g.stoke = Math.max(0, Math.min(1, k));
          this.opts.onGateCue?.(i, k);

          /* Nothing is aimed at any more, but the car still has to arrive
             where the hole is. Eased rather than snapped: the player may be
             mid-corner-exit when the gate arms, and yanking the car onto the
             centreline would read as the game taking the wheel. */
          this.lateral -= this.lateral * chase(2.2, dt);
          this.lateralVel -= this.lateralVel * chase(2.2, dt);
        } else if (g.armed) {
          /* Lifted, still short of the hoop. The clock stays down and the car
             stays lined up — the verdict is not in yet, because the verdict is
             where the car IS when it gets there. */
          gateArmed = true;
          this.lateral -= this.lateral * chase(2.2, dt);
          this.lateralVel -= this.lateralVel * chase(2.2, dt);
        }

        // crossing it: the wrapped gap jumps from nearly a lap to nearly zero
        const crossed = prevT <= g.t && this.t > g.t;
        const wrapped = prevT > this.t && (g.t > prevT || g.t <= this.t);
        if (g.armed && (crossed || wrapped)) {
          /* The moment of truth, and the only honest place to judge it: not
             where the phone was, but where the CAR was when it reached the
             hoop. Everything the player can see is in this one number. */
          this.closeGate(i, gateBand(this.jumpHeightNow, g.liftErr), g.liftErr);
        }
      }
    }

    /* One owner for the clock, set from state rather than from the events that
       changed it. Written inside `onBoostArm` instead, a gate that armed and a
       lap that ended on the same frame would each set it and the last one to
       run would win. */
    this.slowTarget =
      this.outroAt >= 0 ? SLOW_FINISH : gateArmed || this.slowThroughFlight ? SLOW_BOOST : 1;

    // --- lateral ---
    // Grip falls away while the handbrake is down, so the same steering input
    // moves the car much further across the road and swings the nose with it.
    const wantGrip = this.drifting && this.speed > 6 ? 0.32 : 1;
    this.grip += (wantGrip - this.grip) * chase(6, dt);
    this.steerSmooth += (this.steer - this.steerSmooth) * chase(9, dt);

    /* Steering is an ACCELERATION across the road, not a velocity.

       It used to be a velocity: let go of the wheel and the car stopped moving
       sideways that instant, which is what made the corners drive themselves.
       Nothing pushed the car anywhere, so the road's own shape was the only
       thing deciding where it went.

       As an acceleration, with drag standing in for tyre scrub, full lock
       settles at STEER_ACCEL / LATERAL_DRAG = about 7 units a second across
       the road — the same authority the old velocity had, so the feel of
       holding a line is unchanged. What is new is that letting go no longer
       stops anything. */
    const slide = 1 + (1 - this.grip) * 2.6;
    const bite = this.manual ? Math.min(1, 0.25 + this.speed / 18) : 1;
    let lateralAccel = this.steerSmooth * STEER_ACCEL * slide * bite;

    /* The corner load. A car pointed straight does not go round a bend, and
       this is the engine finally admitting it: the road's curvature times the
       square of the speed is the sideways acceleration the driver has to find
       from somewhere, and if they do not find it the car runs wide.

       CORNER_PULL is a fraction of the real thing and has to be. Measured, the
       tightest corner here is radius 13.9 against a road 7.2 wide, so the true
       demand at 26 units a second is 48.7 u/s^2 — unsteered, that is the
       barrier in 0.38 seconds, which is less time than a phone tilt takes to
       register. The fraction keeps the rule (corners are yours to take) while
       leaving a human long enough to take them.

       It still scales with v squared, so a boosted corner is genuinely harder
       than a slow one, which is the part of the physics worth keeping. */
    const k = this.curvatureAt(this.t);
    lateralAccel -= k * this.speed * this.speed * CORNER_PULL;

    this.lateralVel += lateralAccel * dt;
    this.lateralVel -= this.lateralVel * chase(LATERAL_DRAG, dt);
    this.lateral += this.lateralVel * dt;

    const wantYaw = -this.steerSmooth * (1 - this.grip) * 0.85;
    this.driftYaw += (wantYaw - this.driftYaw) * chase(7, dt);

    if (Math.abs(this.lateral) > LANE_LIMIT) {
      const side = Math.sign(this.lateral);
      const into = Math.abs(this.lateralVel);
      this.lateral = side * LANE_LIMIT;
      this.wallTime += dt;
      const ground = this.wallTime >= WALL_GRIND_SEC;
      if (ground) this.wallTime = 0; // one crash per stretch of wall, not per frame
      if (into > CRASH_SPEED || ground) {
        /* A hit, not a scrape. The car is thrown back off the wall, loses most
           of its speed and costs points — the brief's own "car can crash". The
           rebound is inward rather than backward: reversing out of a barrier
           strike reads as a bug, and the engine's own note on debris explains
           what a negative speed does to the lap seam. */
        this.lateralVel = -side * into * 0.3;
        this.speed *= 0.42;
        this.score = Math.max(0, this.score - CRASH_PENALTY);
        haptic([30, 40, 60]);
        /* Reported through `onCrash` and NOT through `onPenalty`, which is the
           obstacle path and carries the hit sample with it. Corners are the
           mistake a player makes most often, and a sample on every one of them
           turned the race into a percussion piece. The deduction still shows,
           the phone still buzzes, and the car still visibly ploughs the wall —
           that is enough to know what happened. */
        this.opts.onCrash?.(CRASH_PENALTY);
      } else {
        // Scrubbing the barrier costs speed. Scale by dt, otherwise the penalty
        // is applied per frame and a 120 Hz phone punishes twice as hard.
        this.lateralVel = 0;
        this.speed *= Math.pow(0.4, dt);
      }
    } else {
      this.wallTime = 0;
    }

    // --- place car ---
    this.layoutCar();
    if (this.car) this.car.rotation.z = -this.steerSmooth * 0.13; // lean into the turn

    // --- pickups: exact 2D test on (t, lateral) ---
    for (const p of this.pickups) {
      if (p.alive) {
        let dT = Math.abs(p.t - this.t);
        if (dT > 0.5) dT = 1 - dT;
        const alongMeters = dT * this.curveLen;
        if (alongMeters < 2.0 && Math.abs(p.lateral - this.lateral) < 1.7) {
          p.alive = false;
          p.pop = 0.001;
          this.score += p.points;
          this.groceries += 1;
          // short haptic tick per grocery; longer for the 500pt Blinkit bag
          {
            haptic(p.points >= 500 ? [18, 36, 18] : p.points >= 250 ? 22 : 12);
          }
          this.opts.onPickup?.(p.points, p.name);
        } else {
          p.sprite.position.y = 1.15 + Math.sin(this.elapsed * 3 + p.t * 40) * 0.12;
          p.sprite.material.rotation = Math.sin(this.elapsed * 1.4 + p.t * 20) * 0.14;
        }
      } else if (p.pop > 0) {
        // brief pop-out, then hide
        p.pop += dt;
        const k = Math.min(1, p.pop / 0.26);
        const s = (p.points >= 500 ? 2.6 : 2.0) * (1 + k * 0.7);
        p.sprite.scale.set(s, s, 1);
        p.sprite.material.opacity = 1 - k;
        p.sprite.position.y = 1.15 + k * 1.5;
        if (k >= 1) {
          p.sprite.visible = false;
          p.pop = 0;
        }
      }
    }

    // space props drift and bob, so the circuit sits inside a scene rather
    // than on an empty plane
    for (const pr of this.arProps) {
      pr.mesh.rotation.x += pr.spin.x * dt;
      pr.mesh.rotation.y += pr.spin.y * dt;
      pr.mesh.position.y = pr.baseY + Math.sin(this.elapsed * 0.7 + pr.bobPhase) * 0.6;
    }

    // debris tumbles slowly in zero gravity
    for (const c of this.debris) {
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
    }

    // --- debris: clip one and it shatters ---
    for (const c of this.debris) {
      if (c.broken > 0) {
        // shards fly out, tumble, fall under gravity and fade
        c.broken += dt;
        for (const sh of c.shards) {
          sh.vel.y -= 26 * dt;
          sh.mesh.position.addScaledVector(sh.vel, dt);
          sh.mesh.rotation.x += sh.spin.x * dt;
          sh.mesh.rotation.y += sh.spin.y * dt;
          sh.mesh.rotation.z += sh.spin.z * dt;
          const k = Math.max(0, 1 - c.broken / 1.1);
          sh.mesh.scale.setScalar(k * 0.9 + 0.1);
          if (sh.mesh.position.y < 0.05) sh.vel.y = Math.abs(sh.vel.y) * 0.32;
        }
        if (c.broken > 1.1) {
          for (const sh of c.shards) this.root.remove(sh.mesh);
          c.shards.length = 0;
        }
        continue;
      }
      let dT = Math.abs(c.t - this.t);
      if (dT > 0.5) dT = 1 - dT;
      if (dT * this.curveLen < 1.4 && Math.abs(c.lateral - this.lateral) < 1.2) {
        /* Debris costs you points, not just speed.
           This used to scrub 6% off the speed and shatter the chunk, and that
           was all — no deduction, no penalty event, so no red −100 ever
           appeared. The only thing that ever deducted was the real-world
           obstacle system, which is gone, so hitting debris had become free.
           applyObstacleBounce does the rebound AND reports what was actually
           lost, which is what feeds the score pop. */
        this.shatter(c);
        this.applyObstacleBounce(DEBRIS_PENALTY);
      }
    }

    // --- end conditions ---
    const timeLeft = Math.max(0, this.duration - this.elapsed);
    const progress = Math.min(1, (this.lap + this.t) / this.laps);
    this.opts.onTick?.({
      score: this.score,
      groceries: this.groceries,
      timeLeft,
      lap: Math.min(this.lap + 1, this.laps),
      laps: this.laps,
      progress,
      speedKph: Math.round(this.speed * 3.6),
    });

    if (this.outroAt < 0) {
      if (this.lap >= this.laps) this.beginOutro(true);
      else if (timeLeft <= 0) this.beginOutro(false);
    }
  }

  /**
   * The flag drops: the clock sinks, the throttle comes off, and the result is
   * still `FINISH_OUTRO` real seconds away.
   *
   * The race used to end on the frame the second lap completed — `onFinish`
   * fired, the page mounted the result, and the track it was covering was
   * still mid-corner behind it. Nothing marked the end except its replacement.
   */
  private beginOutro(crossed: boolean) {
    this.outroAt = 0;
    this.outroCrossed = crossed;
    this.slowTarget = SLOW_FINISH;
    this.throttle = 0;
    this.braking = 0;
    haptic([20, 50, 20, 50, 40]);
    this.opts.onFinishCue?.({ finished: crossed });
  }

  private finish(crossed: boolean) {
    if (this.done) return;
    this.done = true;
    this.running = false;
    this.opts.onFinish?.({
      score: this.score,
      groceries: this.groceries,
      seconds: Math.round(this.elapsed),
      finished: crossed,
    });
    /* After the callback, not before: the page stops the engine note inside it,
       and opening the filter first would sweep the last of that note back up
       to full brightness on the way out. */
    setAudioTimeScale(1);
  }

  dispose() {
    this.root.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) {
        im.dispose();
      }
    });
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.pickups.length = 0;
    for (const c of this.debris) for (const sh of c.shards) this.root.remove(sh.mesh);
    for (const pr of this.arProps) this.propRoot.remove(pr.mesh);
    this.arProps.length = 0;
    this.debris.length = 0;
    this.root.clear();
  }
}
