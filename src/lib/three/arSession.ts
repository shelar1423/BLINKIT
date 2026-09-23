import * as THREE from 'three';
import { tagARSurface } from './arSurfaces';
import { color } from '../../design/constants';
import { chase, circuitPlan, RaceEngine, type RaceStats, type RaceOutcome, BRANDED } from './raceEngine';
import { RACE_SECONDS, jumpPoints, raceInteraction, type BoostQuality, type JumpQuality } from '../raceInteractions';
import { cameraPitchDeg, makeDeviceAim, makeJumpInput, makeLeverDrag } from './raceInput';

/** Scratch for the aim ray; one per frame would be litter. */
import { loadCar } from './modelLoader';
import { starfieldTexture } from './starfield';
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

/**
 * How wide the circuit lands, in metres.
 *
 * 2.4 was a circuit you could not see all of while you were aiming at it. The
 * placement plan is drawn at the size the track really arrives, on the floor,
 * at whatever distance you are pointing — and the camera is 65 degrees
 * vertical on a portrait phone, so a natural aim about forty degrees down sees
 * a patch of floor roughly 1.2m across. A 2.4m plan was twice the width of the
 * frame it had to be read in, and the two road edges simply ran off both
 * sides.
 *
 * Nothing about the race changes with this. The chase camera and the launcher
 * shot are both placed in track units and scaled by the same factor, so the
 * road fills exactly as much of the screen as it did; what shrinks is the
 * circuit's footprint against the real room, which is the one thing that was
 * wrong.
 */
export const TRACK_M = 1.6;

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
  /** Draw the sled back, 0..1 of its travel — the pull, shown in the world. */
  setLaunchPull: (k: number) => void;
  /** Freeze the placed scene while the briefing is over it: the car stops
   *  idling and nothing behind the overlay can start the race. */
  setHeld: (on: boolean) => void;
  /** While true, letting the lever go banks the pull instead of launching:
   *  the car leaves on the start line's GO. */
  startLine: (on: boolean) => void;
  /** Swipe-up / key fallback for the jump. */
  jumpNow: () => void;
  setSteer: (v: number) => void;
  /** Tilt's way in: the value is a lane across the road, not a speed across
   *  it. See RaceEngine.setSteerLane. */
  setSteerLane: (v: number) => void;
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
  /**
   * The run-up to a boost gate, or null between them.
   *
   * `k` reaches 1 on the beat — the instant the phone should come up. The
   * overlay draws a gauge from it; there is nothing to aim at any more.
   */
  onGateCue?: (c: { index: number; k: number; canLift: boolean } | null) => void;
  /** What the gate was worth once the car was through it. */
  onBoostResult?: (r: { index: number; quality: BoostQuality; points: number }) => void;
  /** The lift window is open, or has closed. */
  /**
   * The lift window opened or closed. `canLift` says whether this device can
   * actually SEE a lift — without a gyro the camera pose never pitches, so the
   * gesture is undetectable and telling someone to lift their phone is telling
   * them to do something that cannot work.
   */
  onJumpCue?: (open: boolean, canLift: boolean) => void;
  /** How far the tilt has come toward counting, 0..1 — so it can be SEEN. */
  onJumpLift?: (k: number) => void;
  /** How far the in-scene launcher lever is drawn, 0..1. */
  onPull?: (k: number) => void;
  onJumpResult?: (r: { quality: JumpQuality; points: number }) => void;
  onObstacleCountChange?: (count: number) => void;
  onProximityAlert?: (alert: boolean) => void;
  /** Surface mapping progress while the circuit sits on the table. */
  onScan?: (s: { coverage: number; hazards: number }) => void;
  /** The clock has dropped into bullet time, or come back out. */
  onBulletTime?: (on: boolean) => void;
  /** The race is over; the result follows about two seconds later. */
  onFinishCue?: (o: { finished: boolean }) => void;
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

/**
 * @param k the circuit's size as a fraction of the 2.4m it was composed
 *          against, so the plaque keeps its place in the shot at any track
 *          size rather than growing relative to the track as that shrinks.
 */
function create3DStartBanner(k = 1) {
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
    if (logo && BRANDED) {
      const lw = Math.min(210, inner * 0.24);
      const lh = (logo.height / logo.width) * lw;
      ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh);
    }

    /* "TAP SCREEN TO RACE" is gone. It told you to do something the Start race
       button already does, and it was the tallest thing on the banner — which
       is why placing a track close to you pushed the lap count off the top of
       the frame. What is left is the one thing you cannot read anywhere else. */
    ctx.fillStyle = '#FFC400';
    ctx.font = `800 ${fitText(ctx, `TWO LAPS · ${RACE_SECONDS} SECONDS`, inner, 46, 800)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(`TWO LAPS · ${RACE_SECONDS} SECONDS`, W / 2, 232);

    tex.needsUpdate = true;
  };

  paint();

  /* The mark loads async; the banner is drawn once without it and repainted
     when it arrives, so a slow decode never leaves the sprite blank. */
  const logo = new Image();
  logo.onload = () => paint(logo);
  if (BRANDED) logo.src = '/brand/hot-wheels-logo.webp';

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.3 * k, 1.3 * k * (H / W), 1);
  /* Lower than it was. At 1.2m above the track it sat above the top of the
     frame whenever the circuit was dropped close to you — which is exactly
     when you most want to read it. 0.62m keeps it clear of the car and inside
     the picture at every placement distance. */
  sprite.position.set(0, 0.62 * k, 0);
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

/**
 * The last gate, out of the room.
 *
 * AR cannot film the final hoop from the side the way the 3D race does — the
 * phone IS the camera. So for that one moment the room goes: a white flash
 * covers the cut, the galaxy from the 3D race closes in around the track, and
 * a second flash brings the room back as the car lands. `k` is the engine's
 * finalMoment, 0..1, and both flashes fall out of it — they peak as it passes
 * the middle, once on the way in and once on the way out.
 *
 * Built for both sessions. The camera session also fades its video and moves
 * the camera; under WebXR the room is the system's, so the sky simply covers
 * it and the view stays the player's own.
 */
function makeGalaxyMoment(scene: THREE.Scene, camera: THREE.Camera, radius: number) {
  const tex = starfieldTexture();
  tex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({
    /* depth-tested, so the track (drawn first, opaque) stays in front of it;
       renderOrder puts it before the grocery sprites in the transparent pass */
    map: tex, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const skyGeo = new THREE.SphereGeometry(radius, 48, 24);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.visible = false;
  scene.add(sky);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false,
  });
  const flashGeo = new THREE.PlaneGeometry(4, 4);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(0, 0, -0.2);
  flash.renderOrder = 10;
  flash.frustumCulled = false;
  flash.visible = false;
  camera.add(flash);
  if (!camera.parent) scene.add(camera);

  const at = new THREE.Vector3();
  return {
    update(k: number, eye: THREE.Object3D) {
      const on = k > 0.001;
      sky.visible = on;
      flash.visible = on && k < 0.999;
      if (!on) return;
      eye.getWorldPosition(at);
      sky.position.copy(at);
      /* A fade, not a flash: the sky simply comes up over the room on an
         ease-in-out as k rises, and goes back the same way. */
      const e = k * k * (3 - 2 * k);
      skyMat.opacity = e;
      flashMat.opacity = 0;
    },
    dispose() {
      scene.remove(sky);
      camera.remove(flash);
      skyGeo.dispose();
      skyMat.dispose();
      tex.dispose();
      flashGeo.dispose();
      flashMat.dispose();
    },
  };
}

function makeEngine(
  opts: Opts,
  onDone: () => void,
  /** The gate's lift window. Same watcher as the ramp's, a separate instance. */
  gateLift: ReturnType<typeof makeJumpInput>,
  jump: ReturnType<typeof makeJumpInput>,
  canLift: () => boolean,
  /** Nose-up angle of the PHONE, or null where that cannot be known. */
  pitchDeg: () => number | null,
  /** Take the current pose as the rest position for a fresh gesture. */
  recentre: () => void,
  /** Whether this session can move its own camera for the last gate's side shot. */
  cinematic = false,
) {
  const engine: RaceEngine = new RaceEngine({
    /* The AR session is the caller that has the aim, the lift and the cues. */
    interactions: true,
    cinematicCamera: cinematic,
    laps: 2,
    duration: RACE_SECONDS,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onPenalty: opts.onPenalty,
    onGateCue: (index, k) => {
      if (!gateLift.isOpen) {
        /* Rest pose captured at the moment the gate appears: the gesture is
           "tilt up from where you are holding it", not "hold it at some
           angle". Nobody races with the phone at a known pitch. */
        recentre();
        gateLift.arm();
      }
      opts.onGateCue?.({ index, k, canLift: canLift() });
    },
    onGateResult: ({ index, quality }) => {
      gateLift.close();
      opts.onGateCue?.(null);
      opts.onBoostResult?.({
        index,
        quality,
        points: quality === 'perfect' ? raceInteraction.scoreBoostPerfect
          : quality === 'good' ? raceInteraction.scoreBoostGood : 0,
      });
    },
    onJumpArm: () => {
      recentre();
      jump.arm();
      opts.onJumpCue?.(true, canLift());
      window.setTimeout(() => {
        if (jump.isOpen) opts.onJumpCue?.(false, canLift());
      }, raceInteraction.jumpWindowMs);
    },
    onJumpTakeoff: () => {
      const quality = jump.resolve();
      const points = jumpPoints(quality);
      engine.awardJump(points);
      opts.onJumpCue?.(false, canLift());
      opts.onJumpResult?.({ quality, points });
      /* And the engine wants to know: a miss rolls off the lip instead of
         flying. */
      return quality !== 'miss';
    },
    onBulletTime: opts.onBulletTime,
    onFinishCue: opts.onFinishCue,
    onFinish: (o) => {
      onDone();
      opts.onFinish(o);
    },
  });
  engine.setPresentation('ar');
  return {
    engine,
    /**
     * Call every frame while racing. Watches the phone for the two lifts.
     *
     * The gate's window is read first and, once it has fired, closed — so one
     * movement of the phone can never be counted by both windows on a frame
     * where a gate closes and the ramp arms.
     */
    tickLift() {
      const p = pitchDeg();
      if (gateLift.isOpen) {
        if (p !== null) gateLift.feed(p);
        opts.onJumpLift?.(gateLift.progress);
        /* On the INSTANT it crosses, not on a resolve at the end of a window:
           the whole mechanic is when the phone came up, and a judgement
           deferred to the gate would be judging where the car got to. */
        if (gateLift.lifted) engine.liftGate();
        return;
      }
      if (jump.isOpen) {
        if (p !== null) jump.feed(p);
        opts.onJumpLift?.(jump.progress);
      }
    },
    /** Swipe-up or key, for where pitch is not available. */
    jumpNow() {
      if (gateLift.isOpen && engine.liftGate()) return;
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
  /* The launcher lever, when there is one. It gets first refusal on every
     touch: a finger that lands on the lever is pulling it, not sliding the
     track underneath it. Without that the same drag did both. */
  lever?: { grab(x: number, y: number): boolean; move(y: number): void; release(): void },
) {
  let pts: Record<number, { x: number; y: number }> = {};
  let base = { dist: 0, ang: 0, size: 0, rot: 0 };
  /** The pointer currently holding the lever, if any. */
  let leverId: number | null = null;
  const two = () => Object.values(pts);

  const onDown = (e: PointerEvent) => {
    if (get().phase !== 'placed') return;
    if (leverId === null && lever?.grab(e.clientX, e.clientY)) {
      leverId = e.pointerId;
      return;
    }
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
    if (leverId === e.pointerId) {
      lever?.move(e.clientY);
      return;
    }
    if (get().phase !== 'placed' || !pts[e.pointerId]) return;
    const prev = pts[e.pointerId];
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    const p = two();
    if (p.length === 2 && base.dist > 0) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      setSize(base.size * (d / base.dist));
      /* A pinch is two fingers converging, and two fingers almost never stay
         on a perfect line: every zoom carried a few degrees of twist with it,
         which swung the whole shot round the track. Past the dead zone the
         turn is deliberate, and it starts from zero there so the track does
         not jump the moment it is crossed. */
      const a = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      const twist = a - base.ang;
      const TWIST_DEAD = 0.14;
      if (Math.abs(twist) > TWIST_DEAD) {
        anchor.rotation.y = base.rot - (twist - Math.sign(twist) * TWIST_DEAD);
      }
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
        /* Slide the circuit across its own plane, relative to where you look.
           `fwd x up` already points to screen RIGHT for a camera looking down
           -Z; negating it sent the track the opposite way to the finger. */
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        anchor.position.addScaledVector(right, dx * 0.9).addScaledVector(fwd, -dy * 0.9);
        /* And it stays in front of the shot. The camera holds still now, so a
           long drag used to carry the whole circuit off the side of the frame
           — or behind the lens, where it simply vanished. Held between 45cm
           and 4m ahead, and within 1.6m either side of the lane. */
        const rel = anchor.position.clone().sub(camera.position);
        const ahead = Math.max(0.45, Math.min(4, rel.dot(fwd)));
        const side = Math.max(-1.6, Math.min(1.6, rel.dot(right)));
        const y = anchor.position.y;
        anchor.position.copy(camera.position).addScaledVector(fwd, ahead).addScaledVector(right, side);
        anchor.position.y = y;
      }
    }
  };
  const onUp = (e: PointerEvent) => {
    if (leverId === e.pointerId) {
      leverId = null;
      lever?.release();
      return;
    }
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
    !!(e.target as HTMLElement | null)?.closest('button,a,input,.arov__size,.arlaunch');
  const guard = (fn: (e: PointerEvent) => void) => (e: PointerEvent) => {
    if (fromControl(e)) return;
    fn(e);
  };
  const dOn = guard(onDown);
  /* The MOVE guard has to let a pull through.

     `fromControl` tests whatever is under the pointer, and during a drag that
     changes: sweep the finger down across the size stepper or a button and
     every move from there on was dropped, so the pull stalled halfway with
     the lever stuck wherever the finger happened to cross. A gesture that has
     already taken hold of the lever owns the pointer until it is released. */
  const mOn = (e: PointerEvent) => {
    if (leverId === e.pointerId) {
      onMove(e);
      return;
    }
    if (fromControl(e)) return;
    onMove(e);
  };

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
    setSteerLane: (v: number) => engine.setSteerLane(v),
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
  tagARSurface(renderer.domElement);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 40);
  lights(scene);

  const reticle = makeReticle(opts.mode === 'inspect' ? 0 : (opts.trackSize ?? TRACK_M));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const anchor = new THREE.Group();
  anchor.visible = false;
  scene.add(anchor);
  /* Galaxy for the last gate. Under WebXR the view stays the player's own. */
  const moment = makeGalaxyMoment(scene, camera, 20);

  let phase: ARPhase = 'searching';
  const setPhase = (p: ARPhase) => {
    phase = p;
    opts.onPhase(p);
  };

  const inspect = opts.mode === 'inspect';
  /* The briefing overlay holds the scene. The car idles behind it otherwise,
     and a tap on the dim reaches the canvas and starts the race under it. */
  let held = false;
  /** The launcher drag, once it exists: `launch` has to be able to let go of
   *  it, and it is built further down. */
  let lever: { cancel(): void } | null = null;
  /* The start line's count, while it is running: the car leaves on GO and not
     before, so letting the lever go early banks the pull instead of spending
     it. */
  let startLine = false;
  let heldPower: number | null = null;
  const leverFire = (power: number) => {
    if (startLine) {
      heldPower = power;
      lever?.cancel();
      engine.setStartLights(2);
      return;
    }
    launch(power);
  };

  const gateLift = makeJumpInput();
  const jumpInput = makeJumpInput();
  const race = makeEngine(
    opts,
    () => setPhase('placed'),
    gateLift,
    jumpInput,
    () => true,
    () => cameraPitchDeg(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera),
    () => {},
  );
  const engine = race.engine;
  /* In inspect mode the car is shown at true 1:64 scale — a real Hot Wheels
     car is about 7.4 cm long — so what lands on the table is the size of the
     thing in the box. The circuit's 2.4 m footprint is meaningless here. */
  /* See the note in the camera session: 1:64 is 7.4cm and reads as a thumbnail
     at arm's length. Opens larger; pinch still rules. */
  let sizeM = inspect ? 0.19 : (opts.trackSize ?? TRACK_M);
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

  const startBanner = create3DStartBanner(sizeM / 2.4);
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
  const fpTarget: { pos: THREE.Vector3; look: THREE.Vector3; up: THREE.Vector3; snap?: boolean } = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0),
  };
  const fpCamPos = new THREE.Vector3();
  const fpCamLook = new THREE.Vector3();
  let fpInited = false;
  /* The launcher framing, shared with the 3D race and the camera session.
     Used once, at placement — see `place`. */
  const lnTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const UP_Y = new THREE.Vector3(0, 1, 0);

  function startRace() {
    if (inspect || held || phase !== 'placed') return;
    startBanner.visible = false;
    setPhase('racing');
    engine.start();
  }

  /* The lights are the launcher's feedback: red the moment you take hold of
     the sled, amber as you draw it back past halfway, green on release. They
     are not a countdown — nothing is being timed — they are the gantry
     answering the hand on the launcher. */
  function armLaunch(drawn: boolean) {
    if (inspect || held || phase !== 'placed') return;
    engine.setStartLights(drawn ? 2 : 1);
  }

  function launch(power: number) {
    if (inspect || held || phase !== 'placed') return;
    startLine = false;
    if (heldPower !== null) {
      power = heldPower;
      heldPower = null;
    }
    /* However this fired — the lever let go, or the start line's count
       reaching GO while it is still held — the drag stops here. A drag still
       live after the launch keeps pulling the racing car back onto the sled,
       and takes the chase camera into the road with it. */
    lever?.cancel();
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
    /* Stand the player at the launcher.

       The 3D race and the camera session both open on the same shot — down
       the launch straight, from just behind the sled — by moving the CAMERA
       to it. Under WebXR the camera IS the phone and cannot be moved, so the
       circuit moves instead: it is turned to run away along the way the phone
       is facing, then shifted so the point that shot is taken from lands
       exactly on the phone.

       Without this Android dropped the circuit on the floor and left the
       player standing over a lever a few centimetres long, off in the corner
       of a track they were looking down at. The track was placed and nothing
       else ever happened, which is precisely how it read. It is also what the
       racing branch below already does with the chase camera, so the race no
       longer jumps at the moment it starts. */
    if (!inspect) {
      const scale = engine.root.scale.x || (sizeM / engine.trackExtent);
      engine.launcherCameraTarget(lnTarget);
      const dir = lnTarget.look.clone().sub(lnTarget.pos).setY(0);
      /* The shot's own bearing inside the track, taken back out of the yaw:
         what has to face the way the phone faces is the SHOT, not the
         circuit's own axis. */
      anchor.rotation.y -= Math.atan2(dir.x, dir.z);
      const eye = new THREE.Vector3();
      (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(eye);
      anchor.position
        .copy(eye)
        .addScaledVector(
          lnTarget.pos.clone().multiplyScalar(scale).applyAxisAngle(UP_Y, anchor.rotation.y),
          -1,
        );
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
    moment.dispose();
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
    /* hit-test is OPTIONAL: asked for so "View in your space" can stand the car
       on a real detected surface, never required, so a device without it still
       gets a session (see `aimAtSurface`). */
    optionalFeatures: ['local-floor', 'light-estimation', 'hit-test'],
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

  const localSpace = await session.requestReferenceSpace('local');
  hitSource = null;
  /* Surface detection for the car viewer. The race does not use it — its
     circuit goes where you point — but a car stood in your room should sit ON
     the table or floor you are looking at, and stay there as you walk round
     it. WebXR tracks the room either way; the hit test is what finds the
     surface. Silently absent where the device cannot do it. */
  if (inspect) {
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      hitSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
    } catch {
      hitSource = null;
    }
  }
  /* Ready from the first frame. There is nothing to search for any more, so
     there is no 'searching' phase to sit in and no way to be stuck in it. */
  setPhase('ready');

  session.addEventListener('select', () => {
    if (phase === 'ready') place();
    /* And nothing else. A tap used to start the race from `placed`, which on
       Android meant the first touch anywhere — including the one that grabs
       the lever — sent the car off with no pull behind it and no count in
       front of it. The launcher is the only way into a race here, exactly as
       it is in the camera session and the 3D race. */
  });
  session.addEventListener('end', cleanup);
  opts.overlayRoot.addEventListener('beforexrselect', blockSelect);

  // Screen tap handler (works even if DOM overlay is suppressed like in WebXR Viewer)
  let detachTapPlace: (() => void) | null = () => {
  };

  detachGestures = adjustGestures(
    opts.overlayRoot, anchor, renderer.xr.getCamera(), () => ({ phase, size: sizeM }), setSize, inspect,
    /* In headset AR the camera IS the phone, so there is no launcher framing
       to move to — you look at the lever yourself. The drag is identical. */
    (lever = makeLeverDrag(
      engine, renderer.xr.getCamera(), () => !inspect && !held && phase === 'placed', armLaunch, leverFire,
      (k) => opts.onPull?.(k), renderer.domElement,
    )),
  );

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
    /* The plan is the one part of the reticle that must NOT hold a constant
       apparent size: its whole job is to outline the ground the circuit will
       really take, and the circuit arrives at sizeM whatever the distance. It
       sits inside the reticle for its position and rotation alone, so it
       cancels the k it would otherwise inherit.

       This is what made the track look enormous on Android before it was even
       placed. k runs to 2.4, so a 2.4m circuit was being outlined at nearly
       six metres across, and the two road edges ran clean off both sides of
       the screen. The camera session has always cancelled it; this path never
       did. */
    const bp = reticle.getObjectByName('blueprint');
    if (bp) bp.scale.setScalar(sizeM / k);
    reticle.visible = true;
  }

  /** The reticle on the surface the phone is looking at, from this frame's hit
   *  test. False when there is no hit source or nothing was found this frame,
   *  and the fixed-distance aim takes over — so the reticle never vanishes
   *  while a surface is being found. `place` reads the reticle, so placing
   *  drops the car exactly where the surface was detected. */
  function aimAtSurface(frame?: XRFrame): boolean {
    if (!hitSource || !frame) return false;
    const pose = frame.getHitTestResults(hitSource)[0]?.getPose(localSpace);
    if (!pose) return false;
    const cam = renderer.xr.getCamera();
    cam.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const m = pose.transform.matrix;
    _target.set(m[12], m[13], m[14]);
    reticle.matrix.compose(
      _target,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(_fwd.x, _fwd.z), 0)),
      new THREE.Vector3(1, 1, 1),
    );
    const bp = reticle.getObjectByName('blueprint');
    if (bp) bp.scale.setScalar(sizeM);
    reticle.visible = true;
    return true;
  }

  renderer.setAnimationLoop((now, frame) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (phase === 'ready') {
      if (!aimAtSurface(frame)) aimReticle();

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
      race.tickLift();

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
        fpCamPos.lerp(fpTarget.pos, chase(5, dt));
        fpCamLook.lerp(fpTarget.look, chase(6.5, dt));
      }

      // Convert fp camera position from track-local to world:
      // anchorWorldPos + fpCamPos * anchorScale = desired world position
      // We want that to equal camWorldPos, so:
      // anchorWorldPos = camWorldPos - fpCamPos * anchorScale
      anchor.position.copy(camWorldPos).addScaledVector(fpCamPos, -scale);
    }
    moment.update(phase === 'racing' ? engine.finalMoment : 0, renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);

    /* The launcher's own animation — the chevrons over the lever. The engine
       is not ticked until the lever goes, so this is the only thing keeping
       the launch view alive. */
    if (phase === 'placed' && !held) engine.tickIdle(dt);

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
    setHeld: (on: boolean) => { held = on; },
    startLine: (on: boolean) => {
      startLine = on;
      if (!on) heldPower = null;
    },
    setLaunchPull: (k) => engine.setLaunchPull(k),
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

  /* Both, or neither.
     Without the gyro this session is a camera feed with a track pinned to the
     middle of it: the reticle cannot be aimed, the circuit cannot be put
     anywhere, and the placement screen is a dead end that looks like it
     works. Refusing here sends the player back to the gate screen with a
     button that can ask again, which is the only way back — iOS will not
     re-prompt for motion once it has been answered in a session. */
  if (!gyro) {
    throw new Error('Motion access is needed to aim the camera. Allow Motion & Orientation and try again.');
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
  tagARSurface(video);
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
  tagARSurface(renderer.domElement);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 60);
  lights(scene);

  const reticle = makeReticle(opts.mode === 'inspect' ? 0 : (opts.trackSize ?? TRACK_M));
  scene.add(reticle);

  const anchor = new THREE.Group();
  anchor.visible = false;
  scene.add(anchor);
  /* Galaxy for the last gate; this session also films it from the side. */
  const moment = makeGalaxyMoment(scene, camera, 30);

  let phase: ARPhase = 'ready';
  const setPhase = (p: ARPhase) => {
    phase = p;
    opts.onPhase(p);
  };

  const inspect = opts.mode === 'inspect';
  /* The briefing overlay holds the scene. The car idles behind it otherwise,
     and a tap on the dim reaches the canvas and starts the race under it. */
  let held = false;
  /** The launcher drag, once it exists: `launch` has to be able to let go of
   *  it, and it is built further down. */
  let lever: { cancel(): void } | null = null;
  /* The start line's count, while it is running: the car leaves on GO and not
     before, so letting the lever go early banks the pull instead of spending
     it. */
  let startLine = false;
  let heldPower: number | null = null;
  const leverFire = (power: number) => {
    if (startLine) {
      heldPower = power;
      lever?.cancel();
      engine.setStartLights(2);
      return;
    }
    launch(power);
  };
  const ground = inspect ? GROUND_INSPECT : GROUND;
  const gateLift = makeJumpInput();
  const jumpInput = makeJumpInput();
  /* The phone, read straight off the orientation event rather than off the
     render camera — which, during the race, is the chase camera and knows
     nothing about how the phone is being held. Both lifts are measured from
     it: the camera's own pitch is the game's framing, not the player's wrist,
     which is why every lift used to come back "No lift". */
  const deviceAim = makeDeviceAim();
  const race = makeEngine(
    opts,
    () => setPhase('placed'),
    gateLift,
    jumpInput,
    () => deviceAim.live,
    () => (deviceAim.live ? deviceAim.pitchDeg : null),
    () => {
      deviceAim.recentre();
    },
    /* This session draws the camera feed itself, so it can let go of the room
       for the last gate and film it from the side, as the 3D race does. */
    true,
  );
  const engine = race.engine;
  /* True 1:64 is 7.4cm, and at the half-metre this places at that is a
     thumbnail you cannot see the details of — which is the whole point of
     standing it in front of you. It opens at about 2.5x life size instead;
     pinch still takes it anywhere from 3cm to 1.2m. */
  let sizeM = inspect ? 0.19 : (opts.trackSize ?? TRACK_M);
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
  const startBanner = create3DStartBanner(sizeM / 2.4);
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
    /* Kept as raw degrees as well as a quaternion: the quaternion is for
       framing the scene before the race, these are the gesture input during
       it, and the two are wanted at different moments. */
    deviceAim.feed(e.alpha, e.beta ?? 0);
    const d = THREE.MathUtils.degToRad;
    euler.set(d(e.beta ?? 0), d(e.alpha), -d(e.gamma ?? 0), 'YXZ');
    q.setFromEuler(euler);
    q.multiply(q1);
    q.multiply(q0.setFromAxisAngle(zee, -d(screenAngle())));
  };
  /* Listen unconditionally, whatever `requestPermission` said.
     The permission call is not the same question as "are events arriving".
     Browsers that have no permission API simply deliver events; ones that do
     can report `denied` and still deliver nothing, in which case listening
     costs nothing. Gating on the reply meant a single denied — or flaky —
     permission call silently disabled the gyro for the whole session, so the
     phone could be tilted all it liked and the lift was never seen. What
     decides now is whether an event actually turns up. */
  window.addEventListener('deviceorientation', onOrient, true);
  void gyro;

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
    /* A fresh drop re-composes the shot; see shotFixed. */
    shotFixed = false;
    gyroRefSet = false;
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
    if (inspect || held || phase !== 'placed') return;
    startBanner.visible = false;
    setPhase('racing');
    engine.start();
  }

  /* The lights are the launcher's feedback: red the moment you take hold of
     the sled, amber as you draw it back past halfway, green on release. They
     are not a countdown — nothing is being timed — they are the gantry
     answering the hand on the launcher. */
  function armLaunch(drawn: boolean) {
    if (inspect || held || phase !== 'placed') return;
    engine.setStartLights(drawn ? 2 : 1);
  }

  function launch(power: number) {
    if (inspect || held || phase !== 'placed') return;
    startLine = false;
    if (heldPower !== null) {
      power = heldPower;
      heldPower = null;
    }
    /* However this fired — the lever let go, or the start line's count
       reaching GO while it is still held — the drag stops here. A drag still
       live after the launch keeps pulling the racing car back onto the sled,
       and takes the chase camera into the road with it. */
    lever?.cancel();
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

  /* Not in inspect mode.
   *
   * "View in your space" is for looking at the car, and there is no race in
   * it — but the engine behind it is the same one, so its launcher still
   * existed off-screen with a live hit test around it. `grab` accepts the
   * lever, the whole launcher body, or anything within GRAB_SLOP_PX of where
   * the lever projects, and in inspect mode that invisible zone sat right
   * over the car you were being invited to tap and turn. Touching your own
   * car started a race you were not in.
   *
   * The fix belongs HERE, in what viewing mode is allowed to reach, not in
   * how the launcher reads a press — the race's launcher behaves exactly as
   * it always has. */
  const leverDrag = makeLeverDrag(
    engine, camera, () => !inspect && !held && phase === 'placed', armLaunch, leverFire,
    (k) => opts.onPull?.(k), renderer.domElement,
  );
  lever = leverDrag;
  const detachGestures = adjustGestures(
    opts.overlayRoot, anchor, camera, () => ({ phase, size: sizeM }), setSize, inspect, leverDrag,
  );

  /* The launcher framing, shared with the 3D race.

     `engine.launcherCameraTarget` is the SAME call `raceScene` makes — one
     definition of where the shot stands, so the two races cannot drift apart.
     AR simply never called it, which is the whole reason 3D zoomed to the
     launcher and AR did not. */
  const lnTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  /* Where the AR camera stands when the circuit lands, in track units along
     the launch axis, measured from the 3D race's own camera spot — which is
     the shot this is meant to be: 26 units behind the line and 16 up, looking
     8 past it. Standing closer (20 back, 4 up) put the lens inside the sled,
     with the co-brand plate filling half the frame. Forward 0 and 16 up IS
     that shot; the numbers stay here because they are the whole framing. */
  const AR_CAM_FWD = 0;
  const AR_CAM_Y = 16;
  const AR_LOOK_FWD = 34;
  const AR_LOOK_Y = 0.8;

  const camHome = new THREE.Vector3(0, 0, 0);
  const lookM = new THREE.Matrix4();
  const qBase = new THREE.Quaternion();
  const qDelta = new THREE.Quaternion();
  const qWant = new THREE.Quaternion();
  const gyroRef = new THREE.Quaternion();
  /* The launcher shot, composed once when the track lands and then HELD.
     It used to be re-derived every frame from the launcher's world position,
     so moving or resizing the circuit dragged the camera with it: a pinch
     swung the shot round and a slide sent the room sideways. The shot is a
     place you stand, not something that follows the track — so once it has
     settled it stops chasing, and a gesture moves the circuit in front of a
     camera that stays put. */
  let shotFixed = false;
  const shotPos = new THREE.Vector3();
  const shotQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  let gyroRefSet = false;

  // FPP chase-cam state for camera mode
  const fpTarget: { pos: THREE.Vector3; look: THREE.Vector3; up: THREE.Vector3; snap?: boolean } = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0),
  };
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
    moment.dispose();
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
    /* The phone's pose drives the camera for every phase except the race.

       It briefly did not during `placed`, so the launcher could be framed
       cinematically — and that broke the one promise AR makes. The video
       behind the scene still turned with the phone while the render camera
       did not, so the circuit slid around with the handset instead of staying
       on the table it had just been placed on. A pretty shot of the launcher
       is not worth a track that will not stay put. */
    /* `placed` composes its own orientation below — the framing plus the turn
       the phone has made since — so it is excluded here rather than fought. */
    if (haveOrientation && phase !== 'racing' && phase !== 'placed') camera.quaternion.copy(q);
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
    /* Placed: stand where the 3D race stands.

       Position AND orientation, taken from the same target — moving the camera
       to the launcher without looking at it gets you the right spot still
       pointing at the floor, which is where the phone was aimed a moment
       earlier to place the track.

       The framing is the BASE orientation and the phone turns you away from
       it. Taking rotation outright is what unstuck the circuit from the floor
       before: the video behind the scene keeps turning with the phone while
       the render camera does not, so the track slides around with the handset.
       Here the pose at the moment the track landed is kept, and every frame
       after applies the turn SINCE then on top of the shot. Hold the phone
       still and you are looking down the lane; turn it thirty degrees and you
       turn thirty degrees. */
    if (phase === 'placed' && !inspect) {
      if (!held) engine.tickIdle(dt);
      if (!shotFixed) {
        /* The AR shot, composed from the launcher's own axis rather than
           borrowed from the 3D race: low and square behind the sled, looking
           straight up the lane. The race's shot stands 26 units back and 16
           up, which is a view OF the circuit; in a room that reads as a toy
           on the far side of the table. */
        engine.launcherCameraTarget(lnTarget);
        const tanL = lnTarget.look.clone().sub(lnTarget.pos).setY(0).normalize();
        const camL = lnTarget.pos.clone().addScaledVector(tanL, AR_CAM_FWD);
        camL.y = AR_CAM_Y;
        const lookL = lnTarget.pos.clone().addScaledVector(tanL, AR_LOOK_FWD);
        lookL.y = AR_LOOK_Y;
        const wp = engine.root.localToWorld(camL);
        const wl = engine.root.localToWorld(lookL);
        /* Snapped, not eased. An eased move that gets frozen part-way is a
           different shot every time — high and off to one side if the phone
           happened to be far from where the circuit landed. */
        camera.position.copy(wp);
        lookM.lookAt(camera.position, wl, UP);
        qBase.setFromRotationMatrix(lookM);
        shotFixed = true;
        shotPos.copy(camera.position);
        shotQ.copy(qBase);
      } else {
        camera.position.copy(shotPos);
        qBase.copy(shotQ);
      }
      if (haveOrientation) {
        if (!gyroRefSet) {
          gyroRef.copy(q);
          gyroRefSet = true;
        }
        qDelta.copy(gyroRef).invert().multiply(q);
        qWant.copy(qBase).multiply(qDelta);
      } else {
        qWant.copy(qBase);
      }
      camera.quaternion.slerp(qWant, chase(4, dt));
    } else if (phase !== 'racing') {
      /* Back to the player's own eye, or the placement reticle would be cast
         from wherever the last launcher view left the camera. */
      gyroRefSet = false;
      camera.position.lerp(camHome, chase(3.5, dt));
    }

    if (phase === 'racing') {
      engine.update(dt);
      race.tickLift();

      // FPP chase camera: override gyro and set camera directly behind the car
      engine.cameraTarget(fpTarget);

      // Convert from track-local coords to world coords through the anchor
      /* Through the track's own matrix, not scale-and-offset: that ignored the
         anchor's rotation, so a circuit the player had turned was chased from
         the angle it would have had unturned. */
      const worldFPPos = engine.root.localToWorld(fpTarget.pos.clone());
      const worldFPLook = engine.root.localToWorld(fpTarget.look.clone());

      if (!fpInited || fpTarget.snap) {
        fpCamPos.copy(worldFPPos);
        fpCamLook.copy(worldFPLook);
        fpInited = true;
        camera.up.copy(fpTarget.up);
      } else {
        fpCamPos.lerp(worldFPPos, chase(5, dt));
        fpCamLook.lerp(worldFPLook, chase(6.5, dt));
        camera.up.lerp(fpTarget.up, chase(6, dt)).normalize();
      }

      camera.position.copy(fpCamPos);
      camera.lookAt(fpCamLook);
    }
    {
      const k = phase === 'racing' ? engine.finalMoment : 0;
      moment.update(k, camera);
      // the room itself goes, behind the sky
      const vis = String(1 - k * k * (3 - 2 * k));
      if (video.style.opacity !== vis) video.style.opacity = vis;
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
      shotFixed = false;
      // undo the chase cam: orientation alone drives the camera outside a race
      camera.position.set(0, 0, 0);
      fpInited = false;
      setPhase('ready');
    },
    startRace,
    launch,
    armLaunch,
    setHeld: (on: boolean) => { held = on; },
    startLine: (on: boolean) => {
      startLine = on;
      if (!on) heldPower = null;
    },
    setLaunchPull: (k) => engine.setLaunchPull(k),
    jumpNow: () => race.jumpNow(),
    nudgeScale: (f) => setSize(sizeM * f),
    setSize,
    getSize: () => sizeM,
    end: cleanup,
  };
}
