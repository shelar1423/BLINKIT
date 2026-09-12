import * as THREE from 'three';
import { color } from '../../design/constants';
import { RaceEngine, type RaceStats, type RaceOutcome } from './raceEngine';
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
function makeReticle() {
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

function makeEngine(opts: Opts, onDone: () => void) {
  const engine = new RaceEngine({
    laps: 2,
    duration: 45,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onPenalty: opts.onPenalty,
    onFinish: (o) => {
      onDone();
      opts.onFinish(o);
    },
  });
  engine.setPresentation('ar');
  return engine;
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
 * Which way the placement ring faces.
 *
 * The ring is a flat disc. Left lying horizontal it is edge-on to a level
 * camera — and a disc seen exactly edge-on draws as a one-pixel LINE, which is
 * what appeared instead of a target whenever the phone was held level or the
 * gyro had not reported yet.
 *
 * So it leans with you: its face is turned to the camera at every angle. Point
 * straight down and that lands it flat on the floor, which is what it should
 * look like when you are aiming at the floor; hold the phone level and it
 * stands up to face you; in between it tips smoothly.
 *
 * The sign here matters more than it looks. Getting it backwards still reads
 * correctly at 0 and 90 degrees — and collapses to a line at exactly 45, which
 * is how a phone is held when you point it at the floor a metre ahead.
 */
function reticleTilt(fwd: THREE.Vector3): THREE.Euler {
  const yaw = Math.atan2(fwd.x, fwd.z);
  // 0 when looking level, PI/2 when looking straight down
  const down = Math.asin(Math.max(-1, Math.min(1, -fwd.y)));
  return new THREE.Euler(Math.PI / 2 - down, yaw, 0, 'YXZ');
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
    !!(e.target as HTMLElement | null)?.closest('button,a,input,.arov__drive,.arov__size');
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
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:60';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 40);
  lights(scene);

  const reticle = makeReticle();
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

  const engine = makeEngine(opts, () => setPhase('placed'));
  /* In inspect mode the car is shown at true 1:64 scale — a real Hot Wheels
     car is about 7.4 cm long — so what lands on the table is the size of the
     thing in the box. The circuit's 2.4 m footprint is meaningless here. */
  let sizeM = inspect ? 0.074 : (opts.trackSize ?? 2.4);
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
  const REACH = 1.45;
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();

  function aimReticle() {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    cam.getWorldPosition(_p);
    cam.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const target = _p.clone().addScaledVector(_fwd, REACH);
    reticle.matrix.compose(
      target,
      new THREE.Quaternion().setFromEuler(reticleTilt(_fwd)),
      new THREE.Vector3(1, 1, 1),
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
  video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:55';
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
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:56';
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 60);
  lights(scene);

  const reticle = makeReticle();
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
  const engine = makeEngine(opts, () => setPhase('placed'));
  // true 1:64 in inspect mode — a real Hot Wheels car is ~7.4 cm
  let sizeM = inspect ? 0.074 : (opts.trackSize ?? 2.4);
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
  const REACH = inspect ? 0.5 : 1.45;

  function aim(): { point: THREE.Vector3; dist: number; provisional: boolean } {
    if (haveOrientation) {
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    } else {
      fwd.set(0, 0, -1);
    }
    const eye = camera.position;
    return { point: hit.copy(fwd).multiplyScalar(REACH).add(eye), dist: REACH, provisional: false };
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
      /* Leans with the camera, so it is never seen exactly edge-on. A flat disc
         viewed edge-on draws as a line, and with no gyro the camera is dead
         level — which is how a rotating yellow LINE ended up on screen where
         the target ring should have been. */
      reticle.setRotationFromEuler(reticleTilt(fwd));
      // constant apparent size: scale with distance
      reticle.scale.setScalar(a.dist / RETICLE_REF);
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
    nudgeScale: (f) => setSize(sizeM * f),
    setSize,
    getSize: () => sizeM,
    end: cleanup,
  };
}
