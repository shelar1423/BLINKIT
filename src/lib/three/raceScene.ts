import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RaceEngine, type EngineOpts, type RaceStats, type RaceOutcome } from './raceEngine';
import { loadCar } from './modelLoader';

export type RaceHandle = {
  engine: RaceEngine;
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
  onFinish: (o: RaceOutcome) => void;
  onProgress?: (pct: number, mb: number) => void;
  duration?: number;
  laps?: number;
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

  const engineOpts: EngineOpts = {
    duration: opts.duration ?? 45,
    laps: opts.laps ?? 2,
    onTick: opts.onTick,
    onPickup: opts.onPickup,
    onFinish: opts.onFinish,
  };
  const engine = new RaceEngine(engineOpts);
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
  let last = performance.now();

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    engine.update(dt);
    engine.cameraTarget(target);

    // critically damped-ish follow so the camera never jitters
    camPos.lerp(target.pos, Math.min(1, dt * 6.5));
    camLook.lerp(target.look, Math.min(1, dt * 8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);
  });

  return {
    engine,
    start: () => engine.start(),
    pause: () => engine.pause(),
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
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
