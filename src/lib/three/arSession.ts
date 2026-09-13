import * as THREE from 'three';
import { color } from '../../design/constants';
import { circuitPlan, RaceEngine, type RaceStats, type RaceOutcome } from './raceEngine';
import { boostPoints, jumpPoints, raceInteraction, type BoostQuality, type JumpQuality } from '../raceInteractions';
import { cameraPitchDeg, makeBoostAim, makeJumpInput } from './raceInput';

/** Scratch for the aim ray; one per frame would be litter. */
const aimFrom = new THREE.Vector3();
const aimDir = new THREE.Vector3();
import { loadCar } from './modelLoader';
import { primeAudio, skid } from '../horn';

/* ============================================================
   Two ways to get the circuit onto your desk.

   1. startARSession  — real WebXR immersive-ar: surface detection
      via hit-test, content anchored in the `local` space.
   2. startCameraSession — live camera passthrough plus device
      orientation (3DOF). Not surface tracked, and the UI says so,
      but it works on iOS Safari where WebXR does not exist.

   Both hand back the same ARHandle, so the UI does not branch.
   ============================================================ */

export type ARPhase = 'searching' | 'ready' | 'placed' | 'racing';

export type ARSupport =
  | { kind: 'webxr' }
  | { kind: 'camera'; reason: string }
  | { kind: 'insecure' }
  | { kind: 'unsupported'; reason: string };

function hasCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function detectAR(): Promise<ARSupport> {
  if (typeof window === 'undefined') return { kind: 'unsupported', reason: 'No browser context' };
  if (!window.isSecureContext) return { kind: 'insecure' };
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  const noXr = 'This browser has no WebXR surface tracking.';
  if (!xr || typeof xr.isSessionSupported !== 'function') {
    return hasCamera() ? { kind: 'camera', reason: noXr } : { kind: 'unsupported', reason: noXr };
  }
  try {
    const ok = await xr.isSessionSupported('immersive-ar');
    if (ok) return { kind: 'webxr' };
    return hasCamera() ? { kind: 'camera', reason: noXr } : { kind: 'unsupported', reason: noXr };
  } catch {
    return hasCamera() ? { kind: 'camera', reason: noXr } : { kind: 'unsupported', reason: noXr };
  }
}

export type ARHandle = {
  end: () => void;
  placeNow: () => void;
  reset: () => void;
  startRace: () => void;
  /** Release the launcher. `power` 0..1 is how far the sled was pulled back. */
  launch: (power: number) => void;
  /** Hold the start lights while the launcher is being drawn back. */
  armLaunch: (drawn: boolean) => void;
  /** Swipe-up / key fallback for the jump. */
  jumpNow: () => void;
  setSteer: (v: number) => void;
  setThrottle: (v: number) => void;
  setBrake: (v: number) => void;
  setDrift: (on: boolean) => void;
  /** multiply the placed circuit's size (pinch) */
  nudgeScale: (factor: number) => void;
  /** absolute size in metres across */
  setSize: (metres: number) => void;
  getSize: () => number;
  engine: RaceEngine | null;
  pinObstacleAtTap?: (clientX: number, clientY: number) => void;
  clearObstacles?: () => void;
  getPinnedCount?: () => number;
  isProximityAlert?: () => boolean;
};

type Opts = {
  glbUrl: string;
  overlayRoot: HTMLElement;
  /** metres — footprint of the placed circuit */
  trackSize?: number;
  /**
   * 'inspect' places the car alone — no circuit, no engine, no race. This is
   * what "View in your space" on the product page means: look at the model on
   * your table, move it, scale it. Launching a race from a product page was
   * simply the wrong destination.
   */
  mode?: 'race' | 'inspect';
  onPhase: (p: ARPhase) => void;
  onTick: (s: RaceStats) => void;
  onPickup: (points: number, name: string) => void;
  onPenalty?: (points: number) => void;
  onFinish: (o: RaceOutcome) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
  onObstacleHit?: (info: { type: string; pointsLost: number }) => void;
  /** Aim state for the boost gate the car is approaching, or null between them. */
  onBoostAim?: (a: { index: number; errorDeg: number; quality: BoostQuality; locked: boolean } | null) => void;
  /** What the gate was worth once the car was through it. */
  onBoostResult?: (r: { index: number; quality: BoostQuality; points: number }) => void;
  /** The lift window is open, or has closed. */
  onJumpCue?: (open: boolean) => void;
  onJumpResult?: (r: { quality: JumpQuality; points: number }) => void;
  onObstacleCountChange?: (count: number) => void;
  onProximityAlert?: (alert: boolean) => void;
  /** Surface mapping progress while the circuit sits on the table. */
  onScan?: (s: { coverage: number; hazards: number }) => void;
};

/* ---------- shared scene furniture ---------- */

/**
 * Placement reticle: a real burnout mark, textured rather than drawn.
 *
 * This was 15 meshes of hand-built tread — a scuff disc plus fourteen little
 * tread blocks — which read as exactly what it was: geometry pretending to be
 * rubber. One photographic ring on a single plane replaces all of it, and looks
 * like rubber because it is a photograph of rubber.
 *
 * The texture is pure black on transparent, so it can be tinted and faded from
 * code: dimmed while the surface is only provisional, full once tracking locks.
 */
/**
 * The circuit, drawn as a plan on the surface you are pointing at.
 *
 * The reticle says "a track goes here"; this says WHICH track and HOW BIG,
 * before you commit to it — the two road edges at their true width, the
 * centreline dashed like an axis, and the footprint it will occupy boxed out
 * on the floor. Built from the engine's own curve at `trackSizeM` across, so
 * what is outlined is what arrives.
 *
 * Lines rather than a ghosted copy of the real track: a solid preview reads as
 * the thing already placed, and people stop looking for the button that places
 * it. A plan reads as a proposal.
 */
/**
 * A ribbon of real geometry along a path.
 *
 * Not `LineLoop`. WebGL ignores `LineBasicMaterial.linewidth` — every line is
 * one DEVICE pixel however wide you ask for it — so a plan drawn with lines is
 * a set of hairlines over a live camera feed, which at 3x DPR is a third of a
 * CSS pixel and reads as nothing at all. Width has to be geometry to exist.
 */
function ribbon(pts: THREE.Vector3[], width: number, y: number, hex: number, opacity: number, closed = true) {
  const half = width / 2;
  const n = pts.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const t = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    /* The normal at each point, from the chord through its neighbours. An
       open path has no neighbours past its ends, so those fall back to the
       one segment they do have — otherwise the first and last points take
       their direction from the wrap and the ribbon folds back on itself. */
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    t.subVectors(next, prev).normalize();
    const nx = -t.z;
    const nz = t.x;
    pos.push(pts[i].x + nx * half, y, pts[i].z + nz * half);
    pos.push(pts[i].x - nx * half, y, pts[i].z - nz * half);
  }
  // one quad per segment; an open path has one fewer segment than it has points
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = i * 2;
    const b = a + 1;
    const c = (((i + 1) % n) * 2);
    const d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
}

/** The road surface itself, filled between the two edges. */
function roadBand(left: THREE.Vector3[], right: THREE.Vector3[], y: number, hex: number, opacity: number) {
  const n = left.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    pos.push(left[i].x, y, left[i].z);
    pos.push(right[i].x, y, right[i].z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = ((i + 1) % n) * 2;
    const d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
}

/**
 * The circuit, drawn as a plan on the surface you are pointing at.
 *
 * The reticle says "a track goes here"; this says WHICH track and HOW BIG,
 * before you commit to it. Built from the engine's own curve at `trackSizeM`
 * across, so what is outlined is what arrives.
 *
 * Every part of it is a mesh with a width in metres. Drawn as lines it was
 * geometrically perfect and completely invisible.
 */
function makeBlueprint(trackSizeM: number) {
  const g = new THREE.Group();
  g.name = 'blueprint';
  const plan = circuitPlan();

  // widths in metres, converted to the plan's normalised unit
  const w = (metres: number) => metres / trackSizeM;

  /* The road as a translucent band, so the circuit reads as a shape at a
     glance rather than as two thin curves you have to join up yourself. */
  g.add(roadBand(plan.left, plan.right, 0.0025, color.hwO.int, 0.22));
  // its edges, bright, at a width that survives a camera feed
  g.add(ribbon(plan.left, w(0.016), 0.004, color.hwO.int, 0.95));
  g.add(ribbon(plan.right, w(0.016), 0.004, color.hwO.int, 0.95));
  // the axis, in blueprint blue
  g.add(ribbon(plan.centre, w(0.006), 0.0045, 0x7CC4FF, 0.75));

  /* The ground it will take up, as four corner brackets rather than a closed
     rectangle: a full box competes with the track lines inside it, and the
     corners alone are enough to read the extent. */
  const { w: fw, d: fd, cx, cz } = plan.footprint;
  const hw = fw / 2;
  const hd = fd / 2;
  const arm = Math.min(hw, hd) * 0.3;
  const bw = w(0.014);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const corner = new THREE.Vector3(cx + sx * hw, 0, cz + sz * hd);
    g.add(ribbon(
      [corner.clone().setZ(corner.z - sz * arm), corner.clone(), corner.clone().setX(corner.x - sx * arm)],
      bw, 0.0035, 0xffffff, 0.8, false,
    ));
  }

  g.scale.setScalar(trackSizeM);
  return g;
}

function makeReticle(trackSizeM = 0) {
  const g = new THREE.Group();

  const tex = new THREE.TextureLoader().load('/decor/tire-mark.webp');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const burnout = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.46).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  burnout.name = 'burnout';
  burnout.position.y = 0.0006;
  burnout.renderOrder = -1;

  // hot ring — the reticle still has to read as a target, not just a stain
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.135, 0.152, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: color.hwO.int, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  ring.position.y = 0.002;

  // pulse that says the surface is locked
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.168, 0.182, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: color.yellow.int, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  pulseRing.name = 'pulseRing';
  pulseRing.position.y = 0.002;

  // four chequered ticks, the start-line motif
  const tickGeo = new THREE.PlaneGeometry(0.03, 0.012).rotateX(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const tick = new THREE.Mesh(
      tickGeo,
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color.ink.int, side: THREE.DoubleSide }),
    );
    tick.position.set(Math.cos(ang) * 0.166, 0.0025, Math.sin(ang) * 0.166);
    tick.rotation.y = -ang;
    g.add(tick);
  }

  /* Dotted scan grid: a square lattice spread across the surface, densest at
     the centre and thinning toward the edge, so the surface visibly reads as
     detected rather than merely having a ring drawn on it. */
  const pts: number[] = [];
  const cols: number[] = [];
  const c0 = new THREE.Color(color.yellow.hex);
  const STEP = 0.055;
  const SPAN = 9;
  for (let x = -SPAN; x <= SPAN; x++) {
    for (let z = -SPAN; z <= SPAN; z++) {
      const d = Math.hypot(x, z);
      if (d > SPAN) continue;
      pts.push(x * STEP, 0, z * STEP);
      // fade out toward the rim so the grid has no hard edge
      const k = Math.max(0.12, 1 - (d / SPAN) ** 1.6);
      cols.push(c0.r * k, c0.g * k, c0.b * k);
    }
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  ptsGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const gridPoints = new THREE.Points(
    ptsGeo,
    new THREE.PointsMaterial({ vertexColors: true, size: 0.0115, transparent: true, opacity: 0.85 }),
  );
  gridPoints.name = 'gridPoints';

  g.add(burnout, ring, pulseRing, gridPoints);
  /* Inside the reticle, so it inherits the surface's position and rotation and
     disappears with it the moment the track is placed — no second object to
     keep in sync with the hit test. Inspect mode passes 0: it stands a car in
     your room, and a circuit plan under it would be a promise of the wrong
     thing. */
  if (trackSizeM > 0) g.add(makeBlueprint(trackSizeM));
  return g;
}

/** Shrink until it fits. Text drawn wider than its own box is the whole bug
 *  this replaces: "TAP SCREEN TO RACE" at a fixed 42px ran past the rounded
 *  rectangle behind it and the final E was cut in half. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number, start: number, weight = 800) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= max) break;
    size -= 2;
  } while (size > 12);
  return size;
}

function create3DStartBanner() {
  /* 2x the old resolution: this sprite is held close to the lens in AR, and at
     512px the type was visibly soft. */
  const W = 1024;
  const H = 320;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  /** Everything except the logotype, which arrives later. */
  const paint = (logo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H);

    const PAD = 14;
    const r = 40;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, r);
    ctx.clip();

    /* Pit-lane navy, not the purple this used to be — purple is not in the
       campaign's palette anywhere, and over camera video a dark ground is what
       keeps white type legible whatever the room is. */
    const g = ctx.createLinearGradient(0, PAD, 0, H - PAD);
    g.addColorStop(0, 'rgba(20, 38, 70, 0.94)');
    g.addColorStop(1, 'rgba(8, 16, 34, 0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // chequered flag along the top, drawn rather than typed as an emoji
    const sq = 22;
    for (let x = 0; x < W / sq; x++) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#FFFFFF' : '#101828';
        ctx.fillRect(x * sq, PAD + y * sq, sq, sq);
      }
    }
    ctx.restore();

    ctx.lineWidth = 7;
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, r);
    ctx.stroke();

    const inner = W - PAD * 2 - 56;
    ctx.textAlign = 'center';

    /* Three bands down the sprite, each clear of the next: the logotype from
       70, the headline's cap-height starting around 165, the sub-line at 270.
       Sized so the mark cannot land on top of the words under it. */
    if (logo) {
      const lw = Math.min(210, inner * 0.24);
      const lh = (logo.height / logo.width) * lw;
      ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh);
    }

    /* "TAP SCREEN TO RACE" is gone. It told you to do something the Start race
       button already does, and it was the tallest thing on the banner — which
       is why placing a track close to you pushed the lap count off the top of
       the frame. What is left is the one thing you cannot read anywhere else. */
    ctx.fillStyle = '#FFC400';
    ctx.font = `800 ${fitText(ctx, 'TWO LAPS · 45 SECONDS', inner, 46, 800)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('TWO LAPS · 45 SECONDS', W / 2, 232);

    tex.needsUpdate = true;
  };

  paint();

  /* The mark loads async; the banner is drawn once without it and repainted
     when it arrives, so a slow decode never leaves the sprite blank. */
  const logo = new Image();
  logo.onload = () => paint(logo);
  logo.src = '/brand/hot-wheels.svg';

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.3, 1.3 * (H / W), 1);
  /* Lower than it was. At 1.2m above the track it sat above the top of the
     frame whenever the circuit was dropped close to you — which is exactly
     when you most want to read it. 0.62m keeps it clear of the car and inside
     the picture at every placement distance. */
  sprite.position.set(0, 0.62, 0);
  sprite.name = 'startBanner';
  sprite.visible = false;
  return sprite;
}

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.9));
  const dir = new THREE.DirectionalLight(0xffffff, 2.1);
  dir.position.set(1, 3, 1.4);
  scene.add(dir);
}

function makeEngine(
  opts: Opts,
  onDone: () => void,
  aim: ReturnType<typeof makeBoostAim>,
  jump: ReturnType<typeof makeJumpInput>,
) {
  const engine: RaceEngine = new RaceEngine({
    /* The AR session is the caller that has the aim, the lift and the cues. */
    interactions: true,
    laps: 2,
    duration: 45,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onPenalty: opts.onPenalty,
    onBoostArm: (i, world) => aim.arm(i, world),
    onBoostCross: (i) => {
      /* Judged on the last aim sampled before the car reached the gate, so a
         phone whipped away on the line does not undo a held lock. */
      const quality = aim.resolve();
      const points = boostPoints(quality);
      engine.awardBoost(points, quality !== 'miss');
      engine.setBoostGlow(i, 0);
      aim.clear();
      opts.onBoostResult?.({ index: i, quality, points });
      opts.onBoostAim?.(null);
    },
    onJumpArm: () => {
      jump.arm();
      opts.onJumpCue?.(true);
      window.setTimeout(() => {
        if (jump.isOpen) opts.onJumpCue?.(false);
      }, raceInteraction.jumpWindowMs);
    },
    onJumpTakeoff: () => {
      const quality = jump.resolve();
      const points = jumpPoints(quality);
      engine.awardJump(points);
      opts.onJumpCue?.(false);
      opts.onJumpResult?.({ quality, points });
    },
    onFinish: (o) => {
      onDone();
      opts.onFinish(o);
    },
  });
  engine.setPresentation('ar');
  return {
    engine,
    /** Call every frame while racing; drives the reticle, the glow and the lift. */
    tickAim(camera: THREE.Camera, dtMs: number) {
      if (jump.isOpen) jump.feed(cameraPitchDeg(camera));
      camera.getWorldPosition(aimFrom);
      camera.getWorldDirection(aimDir);
      const a = aim.sample(aimFrom, aimDir, dtMs);
      if (!a) return;
      engine.setBoostGlow(a.index, a.locked ? 1 : a.quality === 'good' ? 0.5 : 0.1);
      opts.onBoostAim?.(a);
    },
    /** Swipe-up or key, for where pitch is not available. */
    jumpNow() {
      jump.manual();
    },
  };
}

/** Wire drag-to-move / pinch-to-size / twist-to-turn onto the DOM overlay. */
/**
 * Touch handling for a placed object.
 *
 * Two fingers always mean the same thing: pinch to resize, twist to turn.
 * One finger depends on what is placed. A circuit is a thing you position, so
 * dragging slides it across the floor. A car is a thing you LOOK at, so
 * dragging spins it and tips it — placing it and never being able to see the
 * other side was the whole complaint about inspect mode.
 */

/**
 * Where the ring goes: on the floor, and inside the frame.
 *
 * Two things were wrong in turn. First it was cast onto the floor with no
 * regard for what the camera can see — held level, that put the point 1.6m out
 * and 1.2m down, which is 37 degrees below centre when the edge of the frame is
 * 25 to 35. It was not "at the bottom of the screen", it was off it. Then I
 * moved it onto the view ray, which is always centred but floats in mid-air and
 * does not lie on anything.
 *
 * This does both. The ray is cast at the floor, so the ring lies flat and moves
 * where you point it — tilt down and it comes towards you. The distance is then
 * clamped so the point can never fall outside the frame: when the phone is
 * level the nearest floor you can actually SEE is about three metres out, so
 * that is where it sits, still on the floor and still in view.
 */
function floorAim(
  cam: THREE.Camera,
  eye: THREE.Vector3,
  fwd: THREE.Vector3,
  drop: number,
  out: THREE.Vector3,
): { dist: number; depression: number } {
  // vertical half-FOV straight from the projection, so this is right for a
  // phone camera and for an XR view without assuming either
  const p11 = cam.projectionMatrix.elements[5];
  const halfFovY = p11 > 0 ? Math.atan(1 / p11) : 0.52;

  /* How far below the centre of the frame the ring may sit. The upper bound
     keeps it clear of the bottom edge; the lower bound keeps it off the
     horizon, where a flat disc thins towards a line. */
  const near = drop / Math.tan(halfFovY * 0.70);
  const far = drop / Math.tan(halfFovY * 0.32);

  /* When the ray does reach the floor, that intersection is BY DEFINITION on
     the view ray and so at the centre of the frame — it needs no minimum
     distance, and forcing one is what pinned the ring at 3.1m however far down
     you pointed. Only the two degenerate cases are clamped: a ray that never
     meets the floor (phone level or tilted up) falls back to the nearest floor
     the frame can see, and a nearly-level ray whose intersection is tens of
     metres out is pulled in to somewhere you could plausibly race. */
  const t = fwd.y < -0.02 ? drop / -fwd.y : Number.POSITIVE_INFINITY;
  const dist = Number.isFinite(t) ? Math.min(t, far) : near;

  const flat = out.set(fwd.x, 0, fwd.z);
  if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
  flat.normalize();
  // horizontal run to the point, given it is `drop` below the eye
  const run = Math.sqrt(Math.max(0, dist * dist - drop * drop));
  out.copy(flat).multiplyScalar(run).add(eye);
  out.y = eye.y - drop;
  return { dist, depression: Math.atan(drop / Math.max(0.01, run)) };
}

function adjustGestures(
  _ov: HTMLElement,
  anchor: THREE.Object3D,
  camera: THREE.Camera,
  get: () => { phase: ARPhase; size: number },
  setSize: (m: number) => void,
  orbit = false,
) {
  let pts: Record<number, { x: number; y: number }> = {};
  let base = { dist: 0, ang: 0, size: 0, rot: 0 };
  const two = () => Object.values(pts);

  const onDown = (e: PointerEvent) => {
    if (get().phase !== 'placed') return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    const p = two();
    if (p.length === 2) {
      base = {
        dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
        ang: Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x),
        size: get().size,
        rot: anchor.rotation.y,
      };
    }
  };
  const onMove = (e: PointerEvent) => {
    if (get().phase !== 'placed' || !pts[e.pointerId]) return;
    const prev = pts[e.pointerId];
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    const p = two();
    if (p.length === 2 && base.dist > 0) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      setSize(base.size * (d / base.dist));
      const a = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      anchor.rotation.y = base.rot - (a - base.ang);
    } else if (p.length === 1) {
      const dx = (e.clientX - prev.x) / window.innerWidth;
      const dy = (e.clientY - prev.y) / window.innerHeight;
      if (orbit) {
        /* Spin on the spot, and tip far enough to see the roof and the
           chassis — clamped short of the point where a die-cast car would be
           standing on its nose. */
        anchor.rotation.y -= dx * 6.2;
        anchor.rotation.x = Math.max(-0.62, Math.min(0.62, anchor.rotation.x + dy * 3.4));
      } else {
        // slide the circuit across its own plane, relative to where you look
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize().negate();
        anchor.position.addScaledVector(right, dx * 1.6).addScaledVector(fwd, -dy * 1.6);
      }
    }
  };
  const onUp = (e: PointerEvent) => {
    delete pts[e.pointerId];
    base.dist = 0;
  };

  /* These have to live on window, not on the overlay root.
     `.arov` is pointer-events:none so that taps fall through to the scene, which
     means it is never a hit target and never receives a pointer event — these
     listeners were silently dead there, so pinch-to-resize and drag-to-move
     never fired. Only the chips and buttons inside it, which re-enable
     pointer-events, ever worked. Guard against the controls so a tap on a
     button is not also read as a drag. */
  const fromControl = (e: PointerEvent) =>
    /* `.arlaunch` is a div, not a button — it has to be, because it handles
       its own pointer capture for the pull. Without it in this list the
       gesture layer read a launcher pull as a drag-to-move on the track and
       the car never left the line. */
    !!(e.target as HTMLElement | null)?.closest('button,a,input,.arov__drive,.arov__size,.arlaunch');
  const guard = (fn: (e: PointerEvent) => void) => (e: PointerEvent) => {
    if (fromControl(e)) return;
    fn(e);
  };
  const dOn = guard(onDown);
  const mOn = guard(onMove);

  window.addEventListener('pointerdown', dOn);
  window.addEventListener('pointermove', mOn);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  return () => {
    window.removeEventListener('pointerdown', dOn);
    window.removeEventListener('pointermove', mOn);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    pts = {};
  };
}

/** Controls shared by both sessions, so the UI never has to branch. */
function driveApi(engine: RaceEngine) {
  let drifting = false;
  return {
    setSteer: (v: number) => engine.setSteer(v),
    setThrottle: (v: number) => engine.setThrottle(v),
    setBrake: (v: number) => engine.setBrake(v),
    setDrift: (on: boolean) => {
      if (on && !drifting) skid();
      drifting = on;
      engine.setDrift(on);
    },
  };
}

/* ============================================================
   1. Real WebXR
   ============================================================ */

export async function startARSession(opts: Opts): Promise<ARHandle> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr!;
  primeAudio();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Match the 3D race: Neutral holds the orange track's hue, where ACES rolls
  // it off toward pale terracotta.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.xr.enabled = true;
  // MUST match the space the hit-test poses are read in. three.js defaults to
  // 'local-floor'; leaving it there while resolving poses against 'local' put
  // the reticle a whole floor-height away from the surface being pointed at,
  // so the track was placed somewhere the camera was not looking.
  renderer.xr.setReferenceSpaceType('local');
  /* touch-action is the whole reason pinch and drag did nothing: without it the
     browser claims a two-finger gesture as a page zoom and a one-finger drag as
     a scroll, and our pointer handlers never see a clean stream. */
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:60;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 40);
  lights(scene);

  const reticle = makeReticle(opts.mode === 'inspect' ? 0 : (opts.trackSize ?? 2.4));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const anchor = new THREE.Group();
  anchor.visible = false;
  scene.add(anchor);

  let phase: ARPhase = 'searching';
  const setPhase = (p: ARPhase) => {
    phase = p;
    opts.onPhase(p);
  };

  const inspect = opts.mode === 'inspect';

  const boostAim = makeBoostAim();
  const jumpInput = makeJumpInput();
  const race = makeEngine(opts, () => setPhase('placed'), boostAim, jumpInput);
  const engine = race.engine;
  /* In inspect mode the car is shown at true 1:64 scale — a real Hot Wheels
     car is about 7.4 cm long — so what lands on the table is the size of the
     thing in the box. The circuit's 2.4 m footprint is meaningless here. */
  /* See the note in the camera session: 1:64 is 7.4cm and reads as a thumbnail
     at arm's length. Opens larger; pinch still rules. */
  let sizeM = inspect ? 0.19 : (opts.trackSize ?? 2.4);
  const inspectRoot = new THREE.Group();

  const applySize = () =>
    inspect
      ? inspectRoot.scale.setScalar(sizeM / 4.2)
      : engine.root.scale.setScalar(sizeM / engine.trackExtent);
  const setSize = (m: number) => {
    sizeM = inspect ? Math.max(0.03, Math.min(1.2, m)) : Math.max(0.25, Math.min(4, m));
    applySize();
  };
  applySize();

  const startBanner = create3DStartBanner();
  if (inspect) {
    anchor.add(inspectRoot);
  } else {
    anchor.add(engine.root);
    anchor.add(startBanner);
  }

  loadCar(opts.glbUrl, 4.2)
    .then((c) => {
      if (!inspect) {
        engine.setCar(c);
        return;
      }
      inspectRoot.add(c);
    })
    .catch(() => opts.onError('The car model failed to load for AR.'));

  // Vision & Real-World Obstacle Collision System

  function pinObstacleAtTap(clientX: number, clientY: number) {
    const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, xrCam);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -anchor.position.y);
    const intersection = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, intersection)) {
    }
  }

  let session: XRSession | null = null;
  let hitSource: XRHitTestSource | null = null;
  let transientHitSource: XRTransientInputHitTestSource | null = null;
  let last = performance.now();
  let detachGestures: (() => void) | null = null;

  // FPP chase-cam state: smooth follow targets
  const fpTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const fpCamPos = new THREE.Vector3();
  const fpCamLook = new THREE.Vector3();
  let fpInited = false;

  function startRace() {
    if (phase !== 'placed') return;
    startBanner.visible = false;
    setPhase('racing');
    engine.start();
  }

  /* The lights are the launcher's feedback: red the moment you take hold of
     the sled, amber as you draw it back past halfway, green on release. They
     are not a countdown — nothing is being timed — they are the gantry
     answering the hand on the launcher. */
  function armLaunch(drawn: boolean) {
    if (phase !== 'placed') return;
    engine.setStartLights(drawn ? 2 : 1);
  }

  function launch(power: number) {
    if (phase !== 'placed') return;
    engine.setStartLights(3);
    startBanner.visible = false;
    setPhase('racing');
    engine.launch(power);
  }

  /** Drop the circuit onto the detected surface, flat on the floor */
  function place() {
    if (phase === 'racing' || phase === 'placed') return;
    if (reticle.visible) {
      anchor.position.setFromMatrixPosition(reticle.matrix);
      const e = new THREE.Euler().setFromRotationMatrix(reticle.matrix, 'YXZ');
      anchor.rotation.set(0, e.y, 0);
    } else {
      const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      xrCam.getWorldPosition(pos);
      xrCam.getWorldQuaternion(quat);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).setY(0).normalize();
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      // Drop to floor level in front of user
      anchor.position.copy(pos).addScaledVector(fwd, 1.35).setY(pos.y - 1.25);
      anchor.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0);
    }
    anchor.visible = true;
    reticle.visible = false;
    startBanner.visible = true;
    /* Red on the gantry the moment the circuit lands: the track is down and
       held, waiting for the launcher. */
    if (!inspect) engine.setStartLights(1);
    setPhase('placed');
  }

  function cleanup() {
    renderer.setAnimationLoop(null);
    detachGestures?.();
    detachTapPlace?.();
    opts.overlayRoot.removeEventListener('beforexrselect', blockSelect);
    try {
      hitSource?.cancel?.();
    } catch {
      /* already gone with the session */
    }
    try {
      transientHitSource?.cancel?.();
    } catch {
      /* already gone with the session */
    }
    hitSource = null;
    transientHitSource = null;
    engine.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    opts.onEnd();
  }

  // A tap on a button in the DOM overlay must not ALSO count as a world tap.
  const blockSelect = (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest('button,a,input')) e.preventDefault();
  };

  // dom-overlay carries the whole in-session UI. Ask for it up front, and only
  // fall back to a session without it if the device refuses outright.
  /* No required features at all.
     'hit-test' used to be required, and that is what made Android refuse the
     session outright — a device that cannot do surface detection could not
     start AR at any quality. The track no longer needs a detected surface: it
     goes where you are pointing, so there is nothing to require. */
  const base: XRSessionInit = {
    optionalFeatures: ['local-floor', 'light-estimation'],
  };
  try {
    session = await xr.requestSession('immersive-ar', {
      ...base,
      requiredFeatures: ['dom-overlay'],
      domOverlay: { root: opts.overlayRoot },
    });
  } catch {
    try {
      session = await xr.requestSession('immersive-ar', base);
    } catch (e) {
      renderer.dispose();
      renderer.domElement.remove();
      throw e instanceof Error ? e : new Error('AR session was refused');
    }
  }

  await renderer.xr.setSession(session);

  await session.requestReferenceSpace('local');
  hitSource = null;
  /* Ready from the first frame. There is nothing to search for any more, so
     there is no 'searching' phase to sit in and no way to be stuck in it. */
  setPhase('ready');

  session.addEventListener('select', () => {
    if (phase === 'ready') place();
    else if (phase === 'placed') startRace();
  });
  session.addEventListener('end', cleanup);
  opts.overlayRoot.addEventListener('beforexrselect', blockSelect);

  // Screen tap handler (works even if DOM overlay is suppressed like in WebXR Viewer)
  let detachTapPlace: (() => void) | null = () => {
  };

  detachGestures = adjustGestures(opts.overlayRoot, anchor, renderer.xr.getCamera(), () => ({ phase, size: sizeM }), setSize, inspect);

  /* ---- where the track goes ----
     Straight down the middle of the view, at a fixed distance. That is the
     whole placement model now.

     It used to project the camera ray onto an assumed floor 1.2m below the
     phone, which is why the ring kept appearing at the bottom of the screen:
     hold the phone level and that intersection is far away and far down, so
     the ring sat near the bottom edge — or off it. Putting the target ON the
     view ray means it lands at the centre of the screen by construction, at
     every phone angle, from the first frame. You aim by pointing, which is
     what people were trying to do anyway. */
  /** How far the floor is below a held phone. */
  const DROP = inspect ? 0.5 : 1.2;
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();
  const _target = new THREE.Vector3();

  function aimReticle() {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    cam.getWorldPosition(_p);
    cam.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const { dist } = floorAim(cam, _p, _fwd, DROP, _target);
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    // constant apparent size, so a close placement does not fill the view
    const k = Math.max(0.4, Math.min(2.4, dist / 1.6));
    reticle.matrix.compose(
      _target,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(k, k, k),
    );
    reticle.visible = true;
  }

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (phase === 'ready') {
      aimReticle();

      const pulse = reticle.getObjectByName('pulseRing') as THREE.Mesh;
      if (pulse) {
        const s = 1 + Math.sin(now * 0.007) * 0.22;
        pulse.scale.set(s, s, s);
      }
      const gp = reticle.getObjectByName('gridPoints') as THREE.Points;
      if (gp) {
        gp.rotation.y = now * 0.0012;
      }
      // a slow counter-rotation stops the burnout reading as a flat decal
      const bo = reticle.getObjectByName('burnout');
      if (bo) bo.rotation.y = -now * 0.00035;

    }

    if (phase === 'racing') {
      engine.update(dt);
      /* After the engine, so a gate armed on this frame is aimed at on this
         frame rather than one behind. */
      race.tickAim(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera, dt * 1000);

      // Vision & Pinned Obstacle Collision Check
      const localCarPos = new THREE.Vector3();
      const localCarFwd = new THREE.Vector3();
      engine.getCarWorldPosition(localCarPos);
      engine.getCarWorldDirection(localCarFwd);

      const scale = engine.root.scale.x || (sizeM / engine.trackExtent);

      // FPP chase camera: compute where the camera SHOULD be (in track-local
      // coords) then shift the whole anchor so that point aligns with the
      // real XR camera position. This makes the player feel like they are
      // sitting right behind the car.
      engine.cameraTarget(fpTarget);
      const xrCam = renderer.xr.getCamera();
      const camWorldPos = new THREE.Vector3();
      xrCam.getWorldPosition(camWorldPos);

      // Smooth the target to avoid jitter
      if (!fpInited) {
        fpCamPos.copy(fpTarget.pos);
        fpCamLook.copy(fpTarget.look);
        fpInited = true;
      } else {
        fpCamPos.lerp(fpTarget.pos, Math.min(1, dt * 7));
        fpCamLook.lerp(fpTarget.look, Math.min(1, dt * 9));
      }

      // Convert fp camera position from track-local to world:
      // anchorWorldPos + fpCamPos * anchorScale = desired world position
      // We want that to equal camWorldPos, so:
      // anchorWorldPos = camWorldPos - fpCamPos * anchorScale
      anchor.position.copy(camWorldPos).addScaledVector(fpCamPos, -scale);
    }

    renderer.render(scene, camera);
  });

  return {
    engine,
    ...driveApi(engine),
    placeNow: place,
    pinObstacleAtTap,
    clearObstacles() {},
    getPinnedCount: () => 0,
    isProximityAlert: () => false,
    reset() {
      anchor.visible = false;
      setPhase('ready');
    },
    startRace,
    launch,
    armLaunch,
    jumpNow: () => race.jumpNow(),
    nudgeScale: (f) => setSize(sizeM * f),
    setSize,
    getSize: () => sizeM,
    end() {
      try {
        session?.end();
      } catch {
        cleanup();
      }
    },
  };
}

/* ============================================================
   2. Camera mode — an honest fallback, never described as AR.
   Real camera passthrough plus device-orientation (3DOF) so the
   car holds its bearing as you look around. It is NOT surface
   tracked: walking will not produce parallax, and the UI says so.
   ============================================================ */

/** Where a granted iOS motion permission is remembered. */
export const MOTION_OK = 'hw-motion-granted';

/**
 * Can the camera be opened without a tap?
 *
 * Only on iOS is this ever false: `DeviceOrientationEvent.requestPermission`
 * must be called from inside a user gesture, and an auto-start has none. Asking
 * anyway does not merely fail quietly — it leaves the session with no gyro at
 * all, so the camera never tilts and the placement reticle sits pinned to the
 * bottom edge of the frame where it cannot be aimed. Better to show the button
 * and let the tap carry the permission.
 */
export function canAutoStart(): boolean {
  const DOE = window.DeviceOrientationEvent as (typeof window.DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;
  if (!DOE || typeof DOE.requestPermission !== 'function') return true;
  try {
    return localStorage.getItem(MOTION_OK) === '1';
  } catch {
    return false;
  }
}

export async function startCameraSession(opts: Omit<Opts, 'trackSize'> & { trackSize?: number }): Promise<ARHandle> {
  /* Assumed surface height below the phone. 0.34 m was far too shallow: with no
     depth sensing the reticle is placed along the view ray at GROUND / fwd.y, so
     a short drop put it right against the lens and it filled the screen. A phone
     held at chest height sees a table ~0.7 m down and a floor ~1.3 m down. */
  const GROUND = -0.95;
  /** Tabletop rather than floor when you are just standing a car on a surface:
   *  "View in your space" is used pointed at a desk, roughly 40 cm below a held
   *  phone, so assuming a 95 cm floor drop threw the aim well past the table. */
  const GROUND_INSPECT = -0.42;
  /** Where the reticle sits when the phone is level or pointing up. */
  /** Reticle is scaled by distance so its on-screen size stays constant. */
  const RETICLE_REF = 1.2;
  primeAudio();

  // iOS gates motion behind a prompt that must be raised from inside the user
  // gesture. Awaiting getUserMedia first breaks that chain and the prompt is
  // silently denied, so ask for orientation BEFORE touching the camera.
  let gyro = false;
  const DOE = window.DeviceOrientationEvent as (typeof window.DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;
  try {
    if (DOE && typeof DOE.requestPermission === 'function') {
      gyro = (await DOE.requestPermission()) === 'granted';
      /* Remembered so the screen can tell whether opening the camera without a
         tap is safe. iOS only hands out motion access from inside a user
         gesture, and once granted it stays granted for the origin. */
      if (gyro) {
        try {
          localStorage.setItem(MOTION_OK, '1');
        } catch {
          /* private mode */
        }
      }
    } else {
      gyro = !!DOE;
    }
  } catch {
    gyro = false;
  }

  /* Rear camera: the point of placing the circuit is that it sits on your real
     surface, which only the rear camera can show. */
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:55;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';
  document.body.appendChild(video);
  await video.play().catch(() => {});

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  /* The style MUST be written before setSize, and setSize must not write its
     own. cssText replaces the entire inline style, so doing it the other way
     round silently deleted the width/height setSize had just set. A canvas
     with no CSS size falls back to its intrinsic size — the drawing buffer,
     which is innerWidth x devicePixelRatio — so on a 2x phone the canvas was
     drawn at twice the viewport, pinned to the top-left by inset:0. The centre
     of the render then sat exactly on the bottom-right corner of the screen,
     which is where the placement reticle kept appearing. Nothing was wrong
     with the aim maths; half the frame was simply off-screen. Scrolling made
     it snap back only because that fired resize, which called setSize again. */
  // see the note on the XR canvas above: without touch-action the browser
  // takes the pinch as a page zoom and the drag as a scroll
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:56;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 60);
  lights(scene);

  const reticle = makeReticle(opts.mode === 'inspect' ? 0 : (opts.trackSize ?? 2.4));
  scene.add(reticle);

  const anchor = new THREE.Group();
  anchor.visible = false;
  scene.add(anchor);

  let phase: ARPhase = 'ready';
  const setPhase = (p: ARPhase) => {
    phase = p;
    opts.onPhase(p);
  };

  const inspect = opts.mode === 'inspect';
  const ground = inspect ? GROUND_INSPECT : GROUND;
  const boostAim = makeBoostAim();
  const jumpInput = makeJumpInput();
  const race = makeEngine(opts, () => setPhase('placed'), boostAim, jumpInput);
  const engine = race.engine;
  /* True 1:64 is 7.4cm, and at the half-metre this places at that is a
     thumbnail you cannot see the details of — which is the whole point of
     standing it in front of you. It opens at about 2.5x life size instead;
     pinch still takes it anywhere from 3cm to 1.2m. */
  let sizeM = inspect ? 0.19 : (opts.trackSize ?? 2.4);
  const inspectRoot = new THREE.Group();
  const applySize = () =>
    inspect
      ? inspectRoot.scale.setScalar(sizeM / 4.2)
      : engine.root.scale.setScalar(sizeM / engine.trackExtent);
  const setSize = (m: number) => {
    sizeM = inspect ? Math.max(0.03, Math.min(1.2, m)) : Math.max(0.25, Math.min(4, m));
    applySize();
    /* A resized circuit covers different ground, so what was mapped no longer
       describes it. Re-centre and start again rather than leaving hazards
       standing where the track no longer is. */
    if (!inspect && phase === 'placed') {
    }
  };
  applySize();
  const startBanner = create3DStartBanner();
  if (inspect) {
    anchor.add(inspectRoot);
  } else {
    anchor.add(engine.root);
    anchor.add(startBanner);
  }
  setPhase('ready');

  /* Surface map. The circuit is dropped on a real table, so the real things on
     that table are what the car has to get around. Sampling runs while the
     circuit is sitting there being sized, which is exactly when the player is
     already moving the phone over the surface. */
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = 160;
  scanCanvas.height = 120;

  // Vision Obstacle Collision System (real-time camera video frame edge sampling)

  function pinObstacleAtTap(clientX: number, clientY: number) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground);
    const intersection = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, intersection)) {
    }
  }

  loadCar(opts.glbUrl, 4.2)
    .then((c) => {
      if (!inspect) {
        engine.setCar(c);
        return;
      }
      inspectRoot.add(c);
    })
    .catch(() => opts.onError('The car model failed to load.'));

  // ---- device orientation -> camera quaternion (3DOF) ----
  const q = new THREE.Quaternion();
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
  let haveOrientation = false;

  const screenAngle = () =>
    typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : (window.orientation as number) || 0;

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.alpha == null) return;
    haveOrientation = true;
    const d = THREE.MathUtils.degToRad;
    euler.set(d(e.beta ?? 0), d(e.alpha), -d(e.gamma ?? 0), 'YXZ');
    q.setFromEuler(euler);
    q.multiply(q1);
    q.multiply(q0.setFromAxisAngle(zee, -d(screenAngle())));
  };
  if (gyro) window.addEventListener('deviceorientation', onOrient, true);

  // Where the phone points, meeting the assumed surface plane. Null when the
  // phone is level or pointing up — used for the reticle only.
  const fwd = new THREE.Vector3();
  const hit = new THREE.Vector3();
  /** How far down the view ray the track lands. Same model as the WebXR path:
   *  the target sits ON the ray, so it is always at the centre of the picture
   *  whatever angle the phone is held at.
   *
   *  What this replaces cast the ray onto an assumed ground plane, which is why
   *  the ring kept arriving at the bottom of the screen — hold the phone level
   *  and that intersection is far away and far down. It also depended on the
   *  gyro, so on a first run where motion permission had not been granted it
   *  fell back to a guessed tilt and could still miss. Pointing is now the
   *  whole interaction, and it cannot miss. */
  /** How far the surface is below the phone: a floor for a circuit, a table for
   *  a car you are standing in front of you. */
  const DROP = inspect ? 0.5 : 1.2;

  function aim(): { point: THREE.Vector3; dist: number; provisional: boolean } {
    if (haveOrientation) {
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    } else {
      /* No gyro yet. An identity camera looks dead level, and floorAim clamps
         that to the nearest floor the frame can actually see — so there is
         something aimable from the first frame without guessing a tilt. */
      fwd.set(0, 0, -1);
    }
    const { dist } = floorAim(camera, camera.position, fwd, DROP, hit);
    return { point: hit, dist, provisional: false };
  }

  /** Placement here can NEVER fail. If the phone is not pointed at the
   *  notional ground plane we drop the circuit a fixed distance ahead
   *  instead of returning and leaving the button looking broken. */
  function place() {
    if (phase === 'racing') return;
    // aim() always resolves now, so there is no no-surface branch to fall back
    // to — a provisional aim is still a perfectly good place to drop the track.
    anchor.position.copy(aim().point);
    anchor.rotation.y = 0;
    anchor.visible = true;
    reticle.visible = false;
    startBanner.visible = true;
    if (!inspect) {
    }
    /* Red on the gantry the moment the circuit lands: the track is down and
       held, waiting for the launcher. */
    if (!inspect) engine.setStartLights(1);
    setPhase('placed');
  }

  /** Place using screen-space tap coordinates: raycast from the tap point
   *  through the camera to the ground plane, placing the track there. */
  function startRace() {
    if (phase !== 'placed') return;
    startBanner.visible = false;
    setPhase('racing');
    engine.start();
  }

  /* The lights are the launcher's feedback: red the moment you take hold of
     the sled, amber as you draw it back past halfway, green on release. They
     are not a countdown — nothing is being timed — they are the gantry
     answering the hand on the launcher. */
  function armLaunch(drawn: boolean) {
    if (phase !== 'placed') return;
    engine.setStartLights(drawn ? 2 : 1);
  }

  function launch(power: number) {
    if (phase !== 'placed') return;
    engine.setStartLights(3);
    startBanner.visible = false;
    setPhase('racing');
    engine.launch(power);
  }

  // DOM-level tap-to-place & tap-to-start
  /* Tap-to-place is gone deliberately. A tap anywhere competed with drag and
     pinch on the same surface, so ordinary handling misfired placements, and a
     stray tap during the race pinned an obstacle you did not ask for. Placement
     is now only ever the explicit button. */

  const detachGestures = adjustGestures(opts.overlayRoot, anchor, camera, () => ({ phase, size: sizeM }), setSize, inspect);

  // FPP chase-cam state for camera mode
  const fpTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const fpCamPos = new THREE.Vector3();
  const fpCamLook = new THREE.Vector3();
  let fpInited = false;

  function cleanup() {
    renderer.setAnimationLoop(null);
    window.removeEventListener('deviceorientation', onOrient, true);
    window.removeEventListener('resize', onResize);
    detachGestures();
    stream.getTracks().forEach((t) => t.stop());
    video.pause();
    video.srcObject = null;
    video.remove();
    engine.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    opts.onEnd();
  }

  const onResize = () => {
    // updateStyle false: the canvas is sized by CSS (100% of a fixed inset:0
    // box), so the renderer only owns the drawing buffer.
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (haveOrientation && phase !== 'racing') camera.quaternion.copy(q);
    if (phase === 'ready' || phase === 'searching') {
      const a = aim();
      reticle.visible = true;
      reticle.position.copy(a.point);
      /* Flat on the floor, turned to face the way you are looking. It cannot
         be seen edge-on any more because floorAim will not let the point rise
         above a minimum depression below the centre of the frame — which is
         what the line on screen was: a horizontal disc at eye level. */
      reticle.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0);
      // constant apparent size: scale with distance
      reticle.scale.setScalar(a.dist / RETICLE_REF);
      /* The plan is the one part of the reticle that must NOT hold a constant
         apparent size — its whole job is to show the footprint the circuit
         will really take, and the circuit is placed at sizeM whatever the
         distance. So it cancels the reticle's scaling and keeps its own,
         inheriting only the position and rotation it is parented for. */
      const bp = reticle.getObjectByName('blueprint');
      if (bp) bp.scale.setScalar(sizeM / (reticle.scale.x || 1));
      const bo0 = reticle.getObjectByName('burnout') as THREE.Mesh | undefined;
      if (bo0) {
        const m = bo0.material as THREE.MeshBasicMaterial;
        m.opacity = 0.88;
      }
      if (phase !== 'ready') setPhase('ready');
      const pulse = reticle.getObjectByName('pulseRing') as THREE.Mesh;
      if (pulse) {
        const s = 1 + Math.sin(now * 0.007) * 0.22;
        pulse.scale.set(s, s, s);
      }
      const gp = reticle.getObjectByName('gridPoints') as THREE.Points;
      if (gp) {
        gp.rotation.y = now * 0.0012;
      }
      // a slow counter-rotation stops the burnout reading as a flat decal
      const bo = reticle.getObjectByName('burnout');
      if (bo) bo.rotation.y = -now * 0.00035;
    }
    if (phase === 'racing') {
      engine.update(dt);
      race.tickAim(camera, dt * 1000);


      const scale = engine.root.scale.x || (sizeM / engine.trackExtent);

      // FPP chase camera: override gyro and set camera directly behind the car
      engine.cameraTarget(fpTarget);

      // Convert from track-local coords to world coords through the anchor
      const worldFPPos = fpTarget.pos.clone().multiplyScalar(scale).add(anchor.position);
      const worldFPLook = fpTarget.look.clone().multiplyScalar(scale).add(anchor.position);

      if (!fpInited) {
        fpCamPos.copy(worldFPPos);
        fpCamLook.copy(worldFPLook);
        fpInited = true;
      } else {
        fpCamPos.lerp(worldFPPos, Math.min(1, dt * 7));
        fpCamLook.lerp(worldFPLook, Math.min(1, dt * 9));
      }

      camera.position.copy(fpCamPos);
      camera.lookAt(fpCamLook);
    }
    renderer.render(scene, camera);
  });

  return {
    engine,
    ...driveApi(engine),
    placeNow: place,
    pinObstacleAtTap,
    clearObstacles() {},
    getPinnedCount: () => 0,
    isProximityAlert: () => false,
    reset() {
      anchor.visible = false;
      // undo the chase cam: orientation alone drives the camera outside a race
      camera.position.set(0, 0, 0);
      fpInited = false;
      setPhase('ready');
    },
    startRace,
    launch,
    armLaunch,
    jumpNow: () => race.jumpNow(),
    nudgeScale: (f) => setSize(sizeM * f),
    setSize,
    getSize: () => sizeM,
    end: cleanup,
  };
}
