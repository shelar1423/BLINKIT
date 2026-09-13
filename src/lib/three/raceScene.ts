import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { boostPoints, jumpPoints, raceInteraction, type BoostQuality, type JumpQuality } from '../raceInteractions';
import { makeBoostAim, makeDragAim, makeJumpInput, makeLeverDrag } from './raceInput';
import { RaceEngine, type EngineOpts, type RaceStats, type RaceOutcome } from './raceEngine';
import { loadCar } from './modelLoader';

/** Scratch for the aim ray. */
const aimFrom = new THREE.Vector3();

export type RaceHandle = {
  engine: RaceEngine;
  /** Steer the boost aim — a drag, in pixels. */
  aimBy: (dxPx: number, dyPx: number) => void;
  /** Swipe-up or key: the jump, for a race with no phone to lift. */
  jumpNow: () => void;
  /** Fire the launcher without touching the lever — the keyboard's way in. */
  launch: (power: number) => void;
  start: () => void;
  pause: () => void;
  dispose: () => void;
};

type Opts = {
  glbUrl: string;
  onReady: () => void;
  onError: (msg: string) => void;
  onTick: (s: RaceStats) => void;
  onPickup: (points: number, name: string) => void;
  onPenalty?: (points: number) => void;
  onFinish: (o: RaceOutcome) => void;
  onProgress?: (pct: number, mb: number) => void;
  duration?: number;
  laps?: number;
  onBoostAim?: (a: { index: number; errorDeg: number; quality: BoostQuality; locked: boolean } | null) => void;
  onBoostResult?: (r: { index: number; quality: BoostQuality; points: number }) => void;
  onJumpCue?: (open: boolean) => void;
  onJumpResult?: (r: { quality: JumpQuality; points: number }) => void;
  /** How far the launcher lever is drawn, 0..1, while it is being pulled. */
  onPull?: (k: number) => void;
  /** The lever was released and the car is away. */
  onLaunched?: () => void;
};

/**
 * Galaxy backdrop as a 2:1 equirectangular canvas texture — stars plus amber and
 * cyan nebula. Warm/cool only: no violet, so the skybox stays inside the
 * campaign palette rather than reintroducing the colour we spent the rebrand
 * removing.
 */
function starfieldTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const x = c.getContext('2d')!;
  x.fillStyle = '#04060B';
  x.fillRect(0, 0, 2048, 1024);

  const cloud = (cx: number, cy: number, r: number, col: string, a: number) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col.replace('ALPHA', String(a)));
    g.addColorStop(0.55, col.replace('ALPHA', String(a * 0.35)));
    g.addColorStop(1, col.replace('ALPHA', '0'));
    x.fillStyle = g;
    x.fillRect(0, 0, 2048, 1024);
  };
  cloud(520, 430, 620, 'rgba(255,140,40,ALPHA)', 0.26);
  cloud(1380, 560, 540, 'rgba(30,120,225,ALPHA)', 0.24);
  cloud(980, 260, 420, 'rgba(255,90,25,ALPHA)', 0.14);
  cloud(1750, 300, 380, 'rgba(90,190,255,ALPHA)', 0.14);
  cloud(240, 760, 360, 'rgba(255,190,80,ALPHA)', 0.10);

  // star field, mostly faint with a few bright ones
  for (let i = 0; i < 5200; i++) {
    const a = Math.pow(Math.random(), 2.2);
    x.fillStyle = `rgba(255,255,255,${a})`;
    x.fillRect(Math.random() * 2048, Math.random() * 1024, a > 0.85 ? 2 : 1, a > 0.85 ? 2 : 1);
  }
  // a handful of warm giants
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * 2048;
    const py = Math.random() * 1024;
    const g = x.createRadialGradient(px, py, 0, px, py, 7);
    g.addColorStop(0, 'rgba(255,236,200,0.95)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(px - 8, py - 8, 16, 16);
  }

  return new THREE.CanvasTexture(c);
}

/** Full-screen 3D race (non-AR). Owns its own renderer + loop. */
export function createRaceScene(container: HTMLElement, opts: Opts): RaceHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // Cap DPR — this is the most effective single perf lever on phones.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES is built for film: it rolls saturated brights off toward white, which
  // turned the orange track into pale terracotta. Neutral (Khronos PBR neutral)
  // holds hue and saturation, which is what an arcade scene wants.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Galaxy skybox. Equirect canvas texture rather than six images: no network,
  // no decode cost, and it can be disposed with everything else.
  const sky = starfieldTexture();
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  scene.background = sky;
  // Fog only at the far plane, so distant asteroids fade into space rather than
  // popping out of the frustum.
  scene.fog = new THREE.Fog(0x05070c, 110, 260);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

  // image-based lighting so the die-cast paint and chrome read correctly
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  // Space is mostly dark: one star as key, a warm bounce and a cool rim. The
  // track is a large flat up-facing plane, so a strong overhead key drives it
  // straight into ACES highlight roll-off and the orange desaturates to peach.
  scene.add(new THREE.HemisphereLight(0x8fb4e8, 0x13100c, 0.30));
  const key = new THREE.DirectionalLight(0xfff0dc, 0.85);
  key.position.set(20, 40, 18);
  scene.add(key);
  const warm = new THREE.DirectionalLight(0xff8a2b, 0.45);
  warm.position.set(-24, 12, -18);
  scene.add(warm);
  const cool = new THREE.DirectionalLight(0x4aa3ff, 0.38);
  cool.position.set(6, -14, -26);
  scene.add(cool);

  /* The same judge the AR race uses. What differs is only where the aim comes
     from: there it is the phone's pose, here it is an offset the player drags
     away from a chase camera they do not otherwise control. */
  const boostAim = makeBoostAim();
  const dragAim = makeDragAim();
  const jumpInput = makeJumpInput();

  const engineOpts: EngineOpts = {
    interactions: true,
    duration: opts.duration ?? 45,
    laps: opts.laps ?? 2,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onPenalty: opts.onPenalty,
    onBoostArm: (i, world) => {
      boostAim.arm(i, world);
      dragAim.reset();
    },
    onBoostCross: (i) => {
      const quality = boostAim.resolve();
      const points = boostPoints(quality);
      engine.awardBoost(points, quality !== 'miss');
      engine.setBoostGlow(i, 0);
      boostAim.clear();
      opts.onBoostAim?.(null);
      opts.onBoostResult?.({ index: i, quality, points });
    },
    onJumpArm: () => {
      jumpInput.arm();
      opts.onJumpCue?.(true);
      window.setTimeout(() => {
        if (jumpInput.isOpen) opts.onJumpCue?.(false);
      }, raceInteraction.jumpWindowMs);
    },
    onJumpTakeoff: () => {
      const quality = jumpInput.resolve();
      const points = jumpPoints(quality);
      engine.awardJump(points);
      opts.onJumpCue?.(false);
      opts.onJumpResult?.({ quality, points });
    },
    onFinish: opts.onFinish,
  };
  const engine: RaceEngine = new RaceEngine(engineOpts);
  scene.add(engine.root);

  let disposed = false;

  loadCar(opts.glbUrl, 4.2, opts.onProgress)
    .then((car) => {
      if (disposed) return;
      engine.setCar(car);
      opts.onReady();
    })
    .catch((e: Error) => {
      if (!disposed) opts.onError(e.message || 'Could not load the car');
    });

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__race = { scene, camera, engine, renderer };
  }

  const target = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  // Frame the camera correctly for the very first painted frame, so the
  // scene never appears from the middle of the circuit.
  engine.cameraTarget(target);
  const camPos = target.pos.clone();
  const camLook = target.look.clone();
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  renderer.render(scene, camera);
  /* The race opens on the launcher, exactly as the AR one does — the same
     lever, the same judge, the same points for a full pull. It replaced a
     3-2-1 countdown, which asked nothing of the player and gave the launcher
     built into the track nothing to do. */
  let launching = true;
  const lnTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

  const fireLauncher = (power: number) => {
    if (!launching) return;
    launching = false;
    engine.setStartLights(3);
    engine.launch(power);
    opts.onLaunched?.();
  };

  const leverDrag = makeLeverDrag(
    engine,
    camera,
    () => launching,
    (drawn) => engine.setStartLights(drawn ? 2 : 1),
    fireLauncher,
    (k) => opts.onPull?.(k),
    renderer.domElement,
  );

  /* On the canvas's PARENT, not the canvas. Anything the page lays over the
     scene — a hint, a stepper, a badge — is a pointer target in front of the
     canvas, and a press that lands on one never reaches it. The stage is an
     ancestor of all of them, so it sees every press either way; presses on
     real controls are filtered out below. */
  const el = (renderer.domElement.parentElement ?? renderer.domElement) as HTMLElement;
  const onControl = (e: PointerEvent) =>
    !!(e.target as HTMLElement | null)?.closest?.('button,a,input,select,[role="button"]');
  let leverId: number | null = null;
  const onDown = (e: PointerEvent) => {
    if (!launching || leverId !== null || onControl(e)) return;
    if (leverDrag.grab(e.clientX, e.clientY)) leverId = e.pointerId;
  };
  const onMove = (e: PointerEvent) => {
    if (leverId === e.pointerId) leverDrag.move(e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    if (leverId !== e.pointerId) return;
    leverId = null;
    leverDrag.release();
  };
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let last = performance.now();

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (launching) {
      /* The engine is NOT ticked: no clock, no pickups, nothing moving until
         the lever is let go. Only the launcher framing. */
      engine.launcherCameraTarget(lnTarget);
      camPos.lerp(lnTarget.pos, Math.min(1, dt * 4));
      camLook.lerp(lnTarget.look, Math.min(1, dt * 5));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      renderer.render(scene, camera);
      return;
    }

    engine.update(dt);
    engine.cameraTarget(target);

    /* Aim, judged against the same cone in degrees as the AR race. The offset
       relaxes back to centre when nothing is armed, so a gate you gave up on
       does not leave the next one skewed. */
    if (boostAim.active) {
      camera.getWorldPosition(aimFrom);
      const a = boostAim.sample(aimFrom, dragAim.direction(camera), dt * 1000);
      if (a) {
        engine.setBoostGlow(a.index, a.locked ? 1 : a.quality === 'good' ? 0.5 : 0.1);
        opts.onBoostAim?.(a);
      }
    } else {
      dragAim.settle(dt);
    }

    // critically damped-ish follow so the camera never jitters
    camPos.lerp(target.pos, Math.min(1, dt * 6.5));
    camLook.lerp(target.look, Math.min(1, dt * 8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);
  });

  return {
    engine,
    aimBy: (dx, dy) => dragAim.nudge(dx, dy),
    jumpNow: () => jumpInput.manual(),
    /* Kept for the fallback path. It clears the launcher on the way through,
       so a race started this way does not leave one standing on the track. */
    start: () => {
      launching = false;
      engine.start();
    },
    launch: (power: number) => fireLauncher(power),
    pause: () => engine.pause(),
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      ro.disconnect();
      engine.dispose();
      sky.dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
