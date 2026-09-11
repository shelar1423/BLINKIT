import * as THREE from 'three';
import { color } from '../../design/constants';
import { RaceEngine, type RaceStats, type RaceOutcome } from './raceEngine';
import { loadCar } from './modelLoader';
import { primeAudio, skid } from '../horn';
import { VisionObstacleSystem } from './visionObstacles';

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
  onFinish: (o: RaceOutcome) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
  onObstacleHit?: (info: { type: string; pointsLost: number }) => void;
  onObstacleCountChange?: (count: number) => void;
  onProximityAlert?: (alert: boolean) => void;
};

/* ---------- shared scene furniture ---------- */

/**
 * Placement reticle, drawn as a tyre mark rather than a generic radar target.
 *
 * The old one used a cyan (#00ffcc) pulse that belonged to no palette in this
 * build. A scuffed tyre print reads instantly as "the car goes here", and it is
 * the campaign's own language — rubber on the ground.
 */
function makeReticle() {
  const g = new THREE.Group();

  // scorched rubber patch the tread sits on
  const scuff = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 44).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x120d0a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  scuff.position.y = 0.0005;

  // two tyre tracks, treads laid across them
  const treadMat = new THREE.MeshBasicMaterial({ color: 0x1a1513, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const treadGeo = new THREE.PlaneGeometry(0.052, 0.014).rotateX(-Math.PI / 2);
  for (const lane of [-0.055, 0.055]) {
    for (let i = -3; i <= 3; i++) {
      const t = new THREE.Mesh(treadGeo, treadMat);
      t.position.set(lane, 0.0015, i * 0.026);
      g.add(t);
    }
  }

  // hot ring — the reticle still has to read as a target
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.135, 0.155, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: color.hwO.int, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  ring.position.y = 0.002;

  // the pulse that says the surface is locked — flame orange, not cyan
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.185, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: color.yellow.int, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  pulseRing.name = 'pulseRing';
  pulseRing.position.y = 0.002;

  // four chequered ticks around the ring, the start-line motif
  const tickGeo = new THREE.PlaneGeometry(0.03, 0.012).rotateX(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const tick = new THREE.Mesh(
      tickGeo,
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color.ink.int, side: THREE.DoubleSide }),
    );
    tick.position.set(Math.cos(ang) * 0.168, 0.0025, Math.sin(ang) * 0.168);
    tick.rotation.y = -ang;
    g.add(tick);
  }

  // surface dots, so a scanning surface still reads as scanned
  const pts: number[] = [];
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      const d = Math.hypot(x, z);
      if (d <= 4.2 && d >= 2.4) pts.push(x * 0.062, 0, z * 0.062);
    }
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const gridPoints = new THREE.Points(
    ptsGeo,
    new THREE.PointsMaterial({ color: color.yellow.int, size: 0.011, transparent: true, opacity: 0.7 }),
  );
  gridPoints.name = 'gridPoints';

  g.add(scuff, ring, pulseRing, gridPoints);
  return g;
}

function create3DStartBanner() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(149, 14, 219, 0.92)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 140, 24);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏁 TAP SCREEN TO RACE', 256, 72);

  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Hot Wheels Circuit · GO!', 256, 120);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.44, 1);
  sprite.position.set(0, 1.2, 0);
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
    onFinish: (o) => {
      onDone();
      opts.onFinish(o);
    },
  });
  engine.setPresentation('ar');
  return engine;
}

/** Wire drag-to-move / pinch-to-size / twist-to-turn onto the DOM overlay. */
function adjustGestures(
  ov: HTMLElement,
  anchor: THREE.Object3D,
  camera: THREE.Camera,
  get: () => { phase: ARPhase; size: number },
  setSize: (m: number) => void,
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
      // slide the circuit across its own plane, relative to where you look
      const dx = (e.clientX - prev.x) / window.innerWidth;
      const dy = (e.clientY - prev.y) / window.innerHeight;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize().negate();
      anchor.position.addScaledVector(right, dx * 1.6).addScaledVector(fwd, -dy * 1.6);
    }
  };
  const onUp = (e: PointerEvent) => {
    delete pts[e.pointerId];
    base.dist = 0;
  };

  ov.addEventListener('pointerdown', onDown);
  ov.addEventListener('pointermove', onMove);
  ov.addEventListener('pointerup', onUp);
  ov.addEventListener('pointercancel', onUp);
  return () => {
    ov.removeEventListener('pointerdown', onDown);
    ov.removeEventListener('pointermove', onMove);
    ov.removeEventListener('pointerup', onUp);
    ov.removeEventListener('pointercancel', onUp);
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
  renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:60';
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
    .then((c) => (inspect ? inspectRoot.add(c) : engine.setCar(c)))
    .catch(() => opts.onError('The car model failed to load for AR.'));

  // Vision & Real-World Obstacle Collision System
  const vision = new VisionObstacleSystem(scene, camera);
  vision.onHit = (hit) => {
    engine.applyObstacleBounce(100);
    opts.onObstacleHit?.({ type: hit.type, pointsLost: 100 });
  };

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
      vision.pinObstacleAt(intersection);
      opts.onObstacleCountChange?.(vision.getPinnedCount());
    }
  }

  let session: XRSession | null = null;
  let hitSource: XRHitTestSource | null = null;
  let transientHitSource: XRTransientInputHitTestSource | null = null;
  let localSpace: XRReferenceSpace | null = null;
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
    vision.dispose();
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
  const base: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['local-floor', 'light-estimation'],
  };
  try {
    session = await xr.requestSession('immersive-ar', {
      ...base,
      requiredFeatures: [...base.requiredFeatures!, 'dom-overlay'],
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

  const viewerSpace = await session.requestReferenceSpace('viewer');
  localSpace = await session.requestReferenceSpace('local');
  try {
    hitSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
  } catch {
    hitSource = null;
  }
  // Announce the phase as soon as the session is live. Without this the UI
  // stayed hidden until the first hit-test resolved, so on a surface the
  // device could not read there was no visible way to place anything.
  setPhase(hitSource ? 'searching' : 'ready');

  if (!hitSource) {
    // Without hit-test there is no reticle, but the fallback placement still
    // gives the player a working circuit rather than a dead screen.
    opts.onError('Surface detection is unavailable — you can still place the track in front of you.');
  }

  session.addEventListener('select', () => {
    if (phase === 'ready' || phase === 'searching') place();
    else if (phase === 'placed') startRace();
  });
  session.addEventListener('end', cleanup);
  opts.overlayRoot.addEventListener('beforexrselect', blockSelect);

  // Screen tap handler (works even if DOM overlay is suppressed like in WebXR Viewer)
  const onTapPlace = (e: PointerEvent) => {
    // Ignore clicks on HTML controls if visible
    if ((e.target as HTMLElement | null)?.closest('button,a,input,.arov__drive,.arov__size')) return;
    if (phase === 'ready' || phase === 'searching') {
      place();
    } else if (phase === 'placed') {
      startRace();
    } else if (phase === 'racing') {
      // Screen tap while racing pins a real-world obstacle!
      pinObstacleAtTap(e.clientX, e.clientY);
    }
  };
  opts.overlayRoot.addEventListener('pointerup', onTapPlace);
  window.addEventListener('pointerup', onTapPlace);
  let detachTapPlace: (() => void) | null = () => {
    opts.overlayRoot.removeEventListener('pointerup', onTapPlace);
    window.removeEventListener('pointerup', onTapPlace);
  };

  // Request transient input hit-test for tap-position placement
  try {
    transientHitSource = (await session.requestHitTestSourceForTransientInput?.({
      profile: 'generic-touchscreen',
      offsetRay: new XRRay(),
    })) ?? null;
  } catch {
    transientHitSource = null;
  }

  detachGestures = adjustGestures(opts.overlayRoot, anchor, renderer.xr.getCamera(), () => ({ phase, size: sizeM }), setSize);

  /* ---- provisional placement ----
     Assumed floor height below the headset/phone when no plane is tracked yet.
     1.2 m is about table height from a held phone and reads sensibly either way. */
  const ASSUMED_DROP = 1.2;
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();
  let reticleProvisional = false;

  function setReticleProvisional(on: boolean) {
    if (on === reticleProvisional) return;
    reticleProvisional = on;
    reticle.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'opacity' in m) {
        (m as THREE.Material & { opacity: number }).transparent = true;
        (m as THREE.Material & { opacity: number }).opacity *= on ? 0.55 : 1 / 0.55;
      }
    });
  }

  /** Put the reticle where the camera is looking, on the assumed floor. */
  function provisionalReticle() {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    cam.getWorldPosition(_p);
    cam.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    // how far along the view ray the assumed floor sits; clamp so a level or
    // upward gaze still puts the reticle a sensible distance ahead
    const t = _fwd.y < -0.05 ? Math.min(ASSUMED_DROP / -_fwd.y, 3.2) : 1.6;
    const target = _p.clone().addScaledVector(_fwd, t);
    target.y = _p.y - ASSUMED_DROP;
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    reticle.matrix.compose(
      target,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    reticle.visible = true;
    setReticleProvisional(true);
  }

  renderer.setAnimationLoop((now, frame) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (frame && hitSource && localSpace && (phase === 'searching' || phase === 'ready')) {
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits.length ? hits[0].getPose(localSpace) : null;
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        setReticleProvisional(false);
        if (phase !== 'ready') setPhase('ready');
      } else {
        /* No surface found yet. Rather than hide the reticle — which forced you
           to tilt the phone down and hunt for it before anything appeared —
           show a provisional one where the camera is already looking, on an
           assumed floor plane. It is dimmed to say "not locked yet", and the
           moment real tracking arrives the branch above snaps it to the true
           surface. Something is always aimable from the first frame. */
        provisionalReticle();
        if (phase !== 'searching') setPhase('searching');
      }

      const pulse = reticle.getObjectByName('pulseRing') as THREE.Mesh;
      if (pulse) {
        const s = 1 + Math.sin(now * 0.007) * 0.22;
        pulse.scale.set(s, s, s);
      }
      const gp = reticle.getObjectByName('gridPoints') as THREE.Points;
      if (gp) {
        gp.rotation.y = now * 0.0012;
      }

      // Also check transient (tap-position) hit-test results to update
      // reticle to where the user last tapped
      if (frame && transientHitSource && localSpace) {
        const transientResults = frame.getHitTestResultsForTransientInput(transientHitSource);
        for (const tr of transientResults) {
          if (tr.results.length > 0) {
            const tPose = tr.results[0].getPose(localSpace);
            if (tPose) {
              reticle.visible = true;
              reticle.matrix.fromArray(tPose.transform.matrix);
              if (phase !== 'ready') setPhase('ready');
            }
          }
        }
      }
    }

    if (phase === 'racing') {
      engine.update(dt);

      // Vision & Pinned Obstacle Collision Check
      const localCarPos = new THREE.Vector3();
      const localCarFwd = new THREE.Vector3();
      engine.getCarWorldPosition(localCarPos);
      engine.getCarWorldDirection(localCarFwd);

      const scale = engine.root.scale.x || (sizeM / engine.trackExtent);
      const worldCarPos = localCarPos.clone().multiplyScalar(scale).add(anchor.position);
      const worldCarFwd = localCarFwd.clone().normalize();

      const collided = vision.update(dt, worldCarPos, worldCarFwd, engine.getSpeed() / 20);
      if (collided) {
        engine.applyObstacleBounce(100);
      }
      opts.onProximityAlert?.(vision.proximityAlert);

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
    clearObstacles() {
      vision.clearPinnedObstacles();
      opts.onObstacleCountChange?.(0);
    },
    getPinnedCount: () => vision.getPinnedCount(),
    isProximityAlert: () => vision.proximityAlert,
    reset() {
      anchor.visible = false;
      setPhase(hitSource ? 'searching' : 'ready');
    },
    startRace() {
      if (phase !== 'placed') return;
      setPhase('racing');
      engine.start();
    },
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

export async function startCameraSession(opts: Omit<Opts, 'trackSize'> & { trackSize?: number }): Promise<ARHandle> {
  const GROUND = -0.34; // assumed surface height below the phone, in metres
  primeAudio();

  // iOS gates motion behind a prompt that must be raised from inside the user
  // gesture. Awaiting getUserMedia first breaks that chain and the prompt is
  // silently denied, so ask for orientation BEFORE touching the camera.
  let gyro = false;
  const DOE = window.DeviceOrientationEvent as (typeof window.DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;
  try {
    if (DOE && typeof DOE.requestPermission === 'function') gyro = (await DOE.requestPermission()) === 'granted';
    else gyro = !!DOE;
  } catch {
    gyro = false;
  }

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
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:56';
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

  // Vision Obstacle Collision System (real-time camera video frame edge sampling)
  const vision = new VisionObstacleSystem(scene, camera);
  vision.setVideoSource(video);
  vision.onHit = (hit) => {
    engine.applyObstacleBounce(100);
    opts.onObstacleHit?.({ type: hit.type, pointsLost: 100 });
  };

  function pinObstacleAtTap(clientX: number, clientY: number) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND);
    const intersection = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, intersection)) {
      vision.pinObstacleAt(intersection);
      opts.onObstacleCountChange?.(vision.getPinnedCount());
    }
  }

  loadCar(opts.glbUrl, 4.2)
    .then((c) => (inspect ? inspectRoot.add(c) : engine.setCar(c)))
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
  function aim(): THREE.Vector3 | null {
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (fwd.y > -0.08) return null;
    const t = GROUND / fwd.y;
    if (t < 0.25 || t > 3.5) return null;
    return hit.copy(fwd).multiplyScalar(t);
  }

  /** Placement here can NEVER fail. If the phone is not pointed at the
   *  notional ground plane we drop the circuit a fixed distance ahead
   *  instead of returning and leaving the button looking broken. */
  function place() {
    if (phase === 'racing') return;
    const aimed = aim();
    if (aimed) {
      anchor.position.copy(aimed);
    } else {
      const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
      if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
      ahead.normalize();
      anchor.position.copy(ahead).multiplyScalar(1.1).setY(GROUND);
    }
    anchor.rotation.y = 0;
    anchor.visible = true;
    reticle.visible = false;
    startBanner.visible = true;
    setPhase('placed');
  }

  /** Place using screen-space tap coordinates: raycast from the tap point
   *  through the camera to the ground plane, placing the track there. */
  function placeAtTap(clientX: number, clientY: number) {
    if (phase === 'racing') return;
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND);
    const intersection = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, intersection)) {
      anchor.position.copy(intersection);
    } else {
      // Fallback: place in front
      const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
      if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
      ahead.normalize();
      anchor.position.copy(ahead).multiplyScalar(1.1).setY(GROUND);
    }
    anchor.rotation.y = 0;
    anchor.visible = true;
    reticle.visible = false;
    startBanner.visible = true;
    setPhase('placed');
  }

  function startRace() {
    if (phase !== 'placed') return;
    startBanner.visible = false;
    setPhase('racing');
    engine.start();
  }

  // DOM-level tap-to-place & tap-to-start
  const onTapPlace = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button,a,input,.arov__drive,.arov__size')) return;
    if (phase === 'ready' || phase === 'searching') {
      placeAtTap(e.clientX, e.clientY);
    } else if (phase === 'placed') {
      startRace();
    } else if (phase === 'racing') {
      // Tap screen during race to pin an obstacle on desk!
      pinObstacleAtTap(e.clientX, e.clientY);
    }
  };
  opts.overlayRoot.addEventListener('pointerup', onTapPlace);

  const detachGestures = adjustGestures(opts.overlayRoot, anchor, camera, () => ({ phase, size: sizeM }), setSize);

  // FPP chase-cam state for camera mode
  const fpTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const fpCamPos = new THREE.Vector3();
  const fpCamLook = new THREE.Vector3();
  let fpInited = false;

  function cleanup() {
    renderer.setAnimationLoop(null);
    window.removeEventListener('deviceorientation', onOrient, true);
    window.removeEventListener('resize', onResize);
    opts.overlayRoot.removeEventListener('pointerup', onTapPlace);
    detachGestures();
    vision.dispose();
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
    renderer.setSize(window.innerWidth, window.innerHeight);
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
      const p = aim();
      reticle.visible = !!p;
      if (p) reticle.position.copy(p);
      const pulse = reticle.getObjectByName('pulseRing') as THREE.Mesh;
      if (pulse) {
        const s = 1 + Math.sin(now * 0.007) * 0.22;
        pulse.scale.set(s, s, s);
      }
      const gp = reticle.getObjectByName('gridPoints') as THREE.Points;
      if (gp) {
        gp.rotation.y = now * 0.0012;
      }
    }
    if (phase === 'racing') {
      engine.update(dt);

      // Vision Obstacle Check (real-time camera video edge/contrast bumper sensor + pinned obstacles)
      const localCarPos = new THREE.Vector3();
      const localCarFwd = new THREE.Vector3();
      engine.getCarWorldPosition(localCarPos);
      engine.getCarWorldDirection(localCarFwd);

      const scale = engine.root.scale.x || (sizeM / engine.trackExtent);
      const worldCarPos = localCarPos.clone().multiplyScalar(scale).add(anchor.position);
      const worldCarFwd = localCarFwd.clone().normalize();

      const collided = vision.update(dt, worldCarPos, worldCarFwd, engine.getSpeed() / 20);
      if (collided) {
        engine.applyObstacleBounce(100);
      }
      opts.onProximityAlert?.(vision.proximityAlert);

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
    clearObstacles() {
      vision.clearPinnedObstacles();
      opts.onObstacleCountChange?.(0);
    },
    getPinnedCount: () => vision.getPinnedCount(),
    isProximityAlert: () => vision.proximityAlert,
    reset() {
      anchor.visible = false;
      setPhase('ready');
    },
    startRace() {
      if (phase !== 'placed') return;
      setPhase('racing');
      engine.start();
    },
    nudgeScale: (f) => setSize(sizeM * f),
    setSize,
    getSize: () => sizeM,
    end: cleanup,
  };
}
