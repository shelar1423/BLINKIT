import * as THREE from 'three';
import { starfieldTexture } from './starfield';
import { RACE_SECONDS } from '../raceInteractions';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { jumpPoints, raceInteraction, type BoostQuality, type JumpQuality } from '../raceInteractions';
import { makeJumpInput, makeLeverDrag } from './raceInput';
import { RaceEngine, chase, type EngineOpts, type RaceStats, type RaceOutcome } from './raceEngine';
import { loadCar } from './modelLoader';

export type RaceHandle = {
  engine: RaceEngine;
  /** Swipe-up or key: the lift, for a race with no phone to lift. Serves both
   *  the ramp and the boost gates — same gesture, whichever window is open. */
  jumpNow: () => void;
  /** Fire the launcher without touching the lever — the keyboard's way in. */
  launch: (power: number) => void;
  start: () => void;
  /** Freeze the launch view while the briefing is over it. */
  setHeld: (on: boolean) => void;
  /** While true, letting the lever go banks the pull instead of launching:
   *  the car leaves on the start line's GO. */
  startLine: (on: boolean) => void;
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
  /** The run-up to a gate: `k` reaches 1 on the beat. Null once it is over. */
  onGateCue?: (c: { index: number; k: number } | null) => void;
  onBoostResult?: (r: { index: number; quality: BoostQuality; points: number }) => void;
  onJumpCue?: (open: boolean) => void;
  onJumpResult?: (r: { quality: JumpQuality; points: number }) => void;
  /** How far the launcher lever is drawn, 0..1, while it is being pulled. */
  onPull?: (k: number) => void;
  /** The lever was released and the car is away. */
  onLaunched?: () => void;
  /** The clock has dropped into bullet time, or come back out. */
  onBulletTime?: (on: boolean) => void;
  /** The race is over; the result follows about two seconds later. */
  onFinishCue?: (o: { finished: boolean }) => void;
};


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

  /* Two lift windows, never open at once: the ramp's and the gate's. They are
     the same gesture — here a swipe or a key, in AR the phone itself — so the
     one that is open takes it and the other never sees it. */
  const jumpInput = makeJumpInput();
  const gateLift = makeJumpInput();

  const engineOpts: EngineOpts = {
    interactions: true,
    /* Only here. The AR paths share this engine but not its camera — theirs is
       the phone, and they move the track under it instead. */
    cinematicCamera: true,
    duration: opts.duration ?? RACE_SECONDS,
    laps: opts.laps ?? 2,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onPenalty: opts.onPenalty,
    onGateCue: (index, k) => {
      if (!gateLift.isOpen) gateLift.arm();
      opts.onGateCue?.({ index, k });
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
      /* And the engine wants to know: a miss rolls off the lip instead of
         flying. */
      return quality !== 'miss';
    },
    onBulletTime: opts.onBulletTime,
    onFinishCue: opts.onFinishCue,
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

  const target: { pos: THREE.Vector3; look: THREE.Vector3; up: THREE.Vector3; snap?: boolean } = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0),
  };
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
  /* The briefing holds the launcher: nothing animates behind the overlay and
     a press on the dim cannot take hold of the lever underneath it. */
  let held = false;
  const lnTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

  /* The start line's count, while it is running. The car leaves on GO and not
     before: the count is the whole point of the count. */
  let startLine = false;
  /** The pull the player let go on, kept until GO can spend it. */
  let heldPower: number | null = null;

  const fireLauncher = (power: number) => {
    if (!launching || held) return;
    launching = false;
    /* However this fired — the lever let go, or the start line's count
       reaching GO while it is still held — the drag stops here. A drag still
       live after the launch keeps pulling the racing car back onto the sled. */
    leverDrag.cancel();
    engine.setStartLights(3);
    engine.launch(power);
    opts.onLaunched?.();
  };

  /**
   * What the LEVER does when it is let go.
   *
   * With a count running, letting go early is not a start: the car waits for
   * GO like everybody else, and the pull is banked until then. Without one,
   * this is the launch it always was.
   */
  const leverFire = (power: number) => {
    if (startLine) {
      heldPower = power;
      leverDrag.cancel();
      engine.setStartLights(2);
      return;
    }
    fireLauncher(power);
  };

  const leverDrag = makeLeverDrag(
    engine,
    camera,
    () => launching,
    (drawn) => engine.setStartLights(drawn ? 2 : 1),
    leverFire,
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
    if (!launching || held || leverId !== null || onControl(e)) return;
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
      /* The simulation is NOT ticked: no clock, no pickups, nothing moving
         until the lever is let go. Only the launcher framing — and `tickIdle`,
         which drives the chevrons standing over the lever and nothing else. */
      if (!held) engine.tickIdle(dt);
      engine.launcherCameraTarget(lnTarget);
      camPos.lerp(lnTarget.pos, chase(4, dt));
      camLook.lerp(lnTarget.look, chase(5, dt));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      renderer.render(scene, camera);
      return;
    }

    engine.update(dt);
    engine.cameraTarget(target);

    // critically damped-ish follow so the camera never jitters — except in
    // the driver's seat on the loop, which has to be exactly where the car is
    if (target.snap) {
      camPos.copy(target.pos);
      camLook.copy(target.look);
      camera.up.copy(target.up);
    } else {
      camPos.lerp(target.pos, chase(5, dt));
      camLook.lerp(target.look, chase(6.5, dt));
      camera.up.lerp(target.up, chase(6, dt)).normalize();
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);
  });

  return {
    engine,
    /* The gate's window first. Both are the same gesture and only one can be
       open at a time, but asking in a fixed order means a swipe can never be
       counted twice on the frame a gate closes and the ramp arms. */
    jumpNow: () => {
      if (gateLift.isOpen && engine.liftGate()) return;
      jumpInput.manual();
    },
    /* Kept for the fallback path. It clears the launcher on the way through,
       so a race started this way does not leave one standing on the track. */
    start: () => {
      launching = false;
      engine.start();
    },
    /* The count's own way in, and the keyboard's. It fires whatever the start
       line is doing, spending the pull the player let go on if they let go
       early. */
    launch: (power: number) => {
      startLine = false;
      const p = heldPower ?? power;
      heldPower = null;
      fireLauncher(p);
    },
    startLine: (on: boolean) => {
      startLine = on;
      if (!on) heldPower = null;
    },
    setHeld: (on: boolean) => { held = on; },
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
