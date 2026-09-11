import * as THREE from 'three';
import { color } from '../../../design/constants';
import { loadCar } from '../modelLoader';
import { OccupancyGrid, type GridPoint } from './occupancyGrid';
import { GroceryPlacer } from './groceryPlacer';
import { SpatialPhysics } from './spatialPhysics';
import { rallyAudio } from './audioEffects';
import type { RallySessionOpts, RoomRallyHandle, RallyPhase } from './roomRallySession';
import { haptic } from '../../haptics';

/**
 * Camera AR Fallback Session for iOS Safari & browsers without native WebXR.
 * Uses live rear camera passthrough + DeviceOrientationEvent (3DOF gyro)
 * to anchor the Hot Wheels Room Rally on the user's desk or floor.
 */
export async function startCameraRallySession(opts: RallySessionOpts): Promise<RoomRallyHandle> {
  const GROUND = -0.42; // Virtual surface depth below camera in metres

  // 1. iOS Motion Permission prompt
  const DOE = window.DeviceOrientationEvent as (typeof window.DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }) | undefined;

  let gyro = false;
  try {
    if (DOE && typeof DOE.requestPermission === 'function') {
      gyro = (await DOE.requestPermission()) === 'granted';
    } else {
      gyro = !!DOE;
    }
  } catch {
    gyro = false;
  }

  // 2. Camera video stream
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:55;pointer-events:none;';
  document.body.appendChild(video);
  await video.play().catch(() => {});

  // 3. WebGL Canvas & Scene
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:56;pointer-events:none;';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 30);
  camera.position.set(0, 0, 0);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x332244, 2.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(1, 3, 1.5);
  scene.add(dirLight);

  // Subsystems
  const physics = new SpatialPhysics();
  physics.surfaceY = GROUND;
  const grid = new OccupancyGrid({ extentX: 2.8, extentZ: 2.8, cellSize: 0.05 });
  const groceryPlacer = new GroceryPlacer();
  scene.add(groceryPlacer.root);

  // Car container
  const carRoot = new THREE.Group();
  carRoot.visible = false;
  scene.add(carRoot);

  loadCar(opts.glbUrl, physics.carLength)
    .then((model) => {
      carRoot.add(model);
    })
    .catch((err) => {
      opts.onError(`Car load error: ${err.message}`);
    });

  // Reticle & Markers
  const reticle = createCameraReticle();
  scene.add(reticle);

  const startMarker = createCameraStartMarker();
  const finishMarker = createCameraFinishMarker();
  startMarker.visible = false;
  finishMarker.visible = false;
  scene.add(startMarker, finishMarker);

  // Device orientation setup
  const q = new THREE.Quaternion();
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

  const screenAngle = () =>
    typeof screen !== 'undefined' && screen.orientation
      ? screen.orientation.angle
      : (window.orientation as number) || 0;

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.alpha == null) return;
    const d = THREE.MathUtils.degToRad;
    euler.set(d(e.beta ?? 0), d(e.alpha), -d(e.gamma ?? 0), 'YXZ');
    q.setFromEuler(euler);
    q.multiply(q1);
    q.multiply(q0.setFromAxisAngle(zee, -d(screenAngle())));
    camera.quaternion.copy(q);
  };
  if (gyro) window.addEventListener('deviceorientation', onOrient, true);

  // State
  let phase: RallyPhase = 'scanning';
  let score = 0;
  let groceriesCollected = 0;
  let totalGroceriesCount = 8;
  let timeLeft = opts.durationSeconds ?? 45;
  let collisionsCount = 0;
  let combo = 0;
  let maxCombo = 0;

  const startPoint: GridPoint = { x: 0, z: -0.85 };
  const finishPoint: GridPoint = { x: 0, z: -1.75 };
  const input = { steer: 0, throttle: 0, brake: 0, drift: false };

  physics.onCollision = (e) => {
    collisionsCount++;
    combo = 0;
    opts.onCollision(e);
  };

  function setPhase(next: RallyPhase) {
    phase = next;
    opts.onPhase(next);
  }

  // Aim reticle at virtual ground
  const fwd = new THREE.Vector3();
  const hit = new THREE.Vector3();
  function aimAtGround(): THREE.Vector3 | null {
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (fwd.y > -0.05) return null;
    const t = GROUND / fwd.y;
    if (t < 0.25 || t > 3.0) return null;
    return hit.copy(fwd).multiplyScalar(t);
  }

  // Placement function
  function placeNow() {
    if (phase !== 'ready' && phase !== 'scanning') return;

    const aimed = aimAtGround();
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);

    if (aimed) {
      startPoint.x = aimed.x;
      startPoint.z = aimed.z;
    } else {
      startPoint.x = fwd.x * 0.85;
      startPoint.z = fwd.z * 0.85;
    }

    reticle.visible = false;
    physics.surfaceY = GROUND;

    finishPoint.x = startPoint.x + fwd.x * 0.9;
    finishPoint.z = startPoint.z + fwd.z * 0.9;

    startMarker.position.set(startPoint.x, GROUND + 0.002, startPoint.z);
    startMarker.visible = true;

    finishMarker.position.set(finishPoint.x, GROUND + 0.002, finishPoint.z);
    finishMarker.visible = true;

    physics.reset(new THREE.Vector3(startPoint.x, GROUND + physics.carHeight * 0.5, startPoint.z), 0);
    carRoot.position.copy(physics.position);
    carRoot.visible = true;

    // Spawn groceries
    const candidateList = [
      { x: startPoint.x + fwd.x * 0.25 + 0.18, z: startPoint.z + fwd.z * 0.25 },
      { x: startPoint.x + fwd.x * 0.45 - 0.18, z: startPoint.z + fwd.z * 0.45 },
      { x: startPoint.x + fwd.x * 0.65 + 0.14, z: startPoint.z + fwd.z * 0.65 },
      { x: startPoint.x + fwd.x * 0.82 - 0.12, z: startPoint.z + fwd.z * 0.82 },
      { x: startPoint.x + fwd.x * 0.95, z: startPoint.z + fwd.z * 0.95 },
    ];
    groceryPlacer.spawnItems(candidateList, startPoint, finishPoint, GROUND, 6);
    totalGroceriesCount = groceryPlacer.items.length;

    setPhase('placed');
  }

  // Tap anywhere on screen to place
  const onScreenTap = (e: MouseEvent | TouchEvent) => {
    if ((e.target as HTMLElement)?.closest('button, a, input')) return;
    if (phase === 'scanning' || phase === 'ready') {
      placeNow();
    }
  };
  window.addEventListener('pointerup', onScreenTap);

  function finishRace(reachedHome: boolean) {
    rallyAudio.stopEngine();
    const rewardRupees = score >= 2000 ? 50 : score >= 1000 ? 25 : 10;
    opts.onFinish({
      score,
      groceries: groceriesCollected,
      totalGroceries: totalGroceriesCount,
      seconds: Math.round((opts.durationSeconds ?? 45) - timeLeft),
      collisions: collisionsCount,
      maxCombo,
      finished: reachedHome,
      rewardRupees,
    });
  }

  // Render loop
  let animId = 0;
  let lastTime = performance.now();

  const loop = () => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Reticle aiming
    if (phase === 'scanning' || phase === 'ready') {
      const aimed = aimAtGround();
      if (aimed) {
        reticle.position.copy(aimed);
        reticle.visible = true;
      } else {
        fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
        reticle.position.set(fwd.x * 0.85, GROUND, fwd.z * 0.85);
        reticle.visible = true;
      }
    }

    // Racing
    if (phase === 'racing') {
      physics.step(dt, input, grid);
      carRoot.position.copy(physics.position);
      carRoot.quaternion.copy(physics.quaternion);

      const collected = groceryPlacer.checkPickup(physics.position);
      if (collected) {
        groceriesCollected++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        const mult = combo >= 5 ? 1.5 : combo >= 3 ? 1.25 : 1.0;
        const pts = Math.round(collected.points * mult);
        score += pts;
        rallyAudio.playPickup(combo);
        opts.onPickup(pts, collected.name, combo);
        haptic(20);
      }

      const dist = Math.hypot(physics.position.x - finishPoint.x, physics.position.z - finishPoint.z);
      if (dist < 0.15 && groceriesCollected >= 2) {
        rallyAudio.playFinish();
        setPhase('finished');
        score += Math.round(timeLeft * 25);
        finishRace(true);
        return;
      }

      timeLeft = Math.max(0, timeLeft - dt);
      if (timeLeft <= 0) {
        setPhase('finished');
        finishRace(false);
        return;
      }

      opts.onTick({
        score,
        groceries: groceriesCollected,
        totalGroceries: totalGroceriesCount,
        timeLeft: Math.ceil(timeLeft),
        speedKph: Math.round(physics.speed * 3.6),
        collisions: collisionsCount,
        combo,
        comboMultiplier: combo >= 5 ? 1.5 : combo >= 3 ? 1.25 : 1.0,
      });
    }

    groceryPlacer.update(now * 0.001);
    renderer.render(scene, camera);
    animId = requestAnimationFrame(loop);
  };

  animId = requestAnimationFrame(loop);
  setPhase('scanning');

  function startCountdown() {
    if (phase !== 'placed') return;
    setPhase('countdown');
    let count = 3;
    rallyAudio.playPickup(1);
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        rallyAudio.playPickup(4 - count);
      } else {
        clearInterval(timer);
        rallyAudio.startEngine();
        setPhase('racing');
      }
    }, 1000);
  }

  function reset() {
    setPhase('scanning');
    reticle.visible = true;
    carRoot.visible = false;
    startMarker.visible = false;
    finishMarker.visible = false;
    groceryPlacer.clear();
    rallyAudio.stopEngine();
    score = 0;
    groceriesCollected = 0;
    timeLeft = opts.durationSeconds ?? 45;
    collisionsCount = 0;
    combo = 0;
  }

  function end() {
    cancelAnimationFrame(animId);
    rallyAudio.stopEngine();
    window.removeEventListener('pointerup', onScreenTap);
    if (gyro) window.removeEventListener('deviceorientation', onOrient, true);
    stream.getTracks().forEach((t) => t.stop());
    video.remove();
    renderer.dispose();
    renderer.domElement.remove();
    opts.onEnd();
  }

  return {
    end,
    placeNow,
    reset,
    startCountdown,
    setSteer: (v) => { input.steer = Math.max(-1, Math.min(1, v)); },
    setThrottle: (v) => { input.throttle = Math.max(0, Math.min(1, v)); },
    setBrake: (v) => { input.brake = Math.max(0, Math.min(1, v)); },
    setDrift: (on) => { input.drift = on; },
    horn: () => { rallyAudio.playPickup(6); },
    toggleDebug: () => {},
  };
}

function createCameraReticle() {
  const g = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.06, 0.08, 36).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: color.yellow.int, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  const dotGeo = new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  g.add(ring, dot);
  return g;
}

function createCameraStartMarker() {
  const g = new THREE.Group();
  const baseGeo = new THREE.PlaneGeometry(0.12, 0.16).rotateX(-Math.PI / 2);
  const baseMat = new THREE.MeshBasicMaterial({ color: color.yellow.int, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const base = new THREE.Mesh(baseGeo, baseMat);
  const lineGeo = new THREE.PlaneGeometry(0.12, 0.02).rotateX(-Math.PI / 2);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.y = 0.001;
  g.add(base, line);
  return g;
}

function createCameraFinishMarker() {
  const g = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  const beaconGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 16);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4 });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 0.125;
  g.add(ring, beacon);
  return g;
}
