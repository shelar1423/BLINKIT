import * as THREE from 'three';
import { color } from '../../../design/constants';
import { loadCar } from '../modelLoader';
import { OccupancyGrid, CellType, type GridPoint } from './occupancyGrid';
import { GroceryPlacer } from './groceryPlacer';
import { SpatialPhysics, type CollisionEvent } from './spatialPhysics';
import { rallyAudio } from './audioEffects';
import { haptic } from '../../haptics';

export type RallyPhase =
  | 'detecting'
  | 'scanning'
  | 'ready'
  | 'placed'
  | 'countdown'
  | 'racing'
  | 'finished';

export type RallyStats = {
  score: number;
  groceries: number;
  totalGroceries: number;
  timeLeft: number;
  speedKph: number;
  collisions: number;
  combo: number;
  comboMultiplier: number;
};

export type RallyOutcome = {
  score: number;
  groceries: number;
  totalGroceries: number;
  seconds: number;
  collisions: number;
  maxCombo: number;
  finished: boolean;
  rewardRupees: number;
};

export type RallyDebugStats = {
  mode: string;
  meshCount: number;
  triangleCount: number;
  planeCount: number;
  colliderCount: number;
  gridCells: number;
  fps: number;
};

export type RoomRallyHandle = {
  end: () => void;
  placeNow: () => void;
  reset: () => void;
  startCountdown: () => void;
  setSteer: (v: number) => void;
  setThrottle: (v: number) => void;
  setBrake: (v: number) => void;
  setDrift: (on: boolean) => void;
  horn: () => void;
  toggleDebug: () => void;
};

export type RallySessionOpts = {
  glbUrl: string;
  overlayRoot: HTMLElement;
  debugMode?: boolean;
  durationSeconds?: number;
  onPhase: (p: RallyPhase) => void;
  onTick: (s: RallyStats) => void;
  onPickup: (points: number, name: string, combo: number) => void;
  onCollision: (e: CollisionEvent) => void;
  onFinish: (o: RallyOutcome) => void;
  onDebugStats?: (stats: RallyDebugStats) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
};

export async function startRoomRallySession(opts: RallySessionOpts): Promise<RoomRallyHandle> {
  const xrNav = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xrNav) {
    throw new Error('WebXR is not available in this browser.');
  }

  // 1. WebXR Session Request with resilient feature fallbacks
  let session: XRSession;
  const baseFeatures: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: [
      'mesh-detection',
      'depth-sensing',
      'plane-detection',
      'anchors',
      'dom-overlay',
      'local-floor',
    ],
  };

  try {
    session = await xrNav.requestSession('immersive-ar', {
      ...baseFeatures,
      domOverlay: { root: opts.overlayRoot },
    } as XRSessionInit);
  } catch {
    try {
      session = await xrNav.requestSession('immersive-ar', baseFeatures);
    } catch (err) {
      throw new Error(`Failed to start immersive AR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Three.js WebXR Renderer & Scene setup
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:60;pointer-events:none;';
  document.body.appendChild(renderer.domElement);

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 25);

  // Soft natural lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x332244, 2.2);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(1, 3, 1.5);
  scene.add(hemiLight, dirLight);

  // 3. Subsystems: Physics, Grid, Pickups
  const physics = new SpatialPhysics();
  const grid = new OccupancyGrid({ extentX: 3.2, extentZ: 3.2, cellSize: 0.05 });
  const groceryPlacer = new GroceryPlacer();
  scene.add(groceryPlacer.root);

  // Hot Wheels car model container
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

  // Start & Finish Markers
  const startMarker = createStartMarker();
  const finishMarker = createFinishMarker();
  startMarker.visible = false;
  finishMarker.visible = false;
  scene.add(startMarker, finishMarker);

  // Reticle for surface placement
  const reticle = createPlacementReticle();
  scene.add(reticle);

  // 4. Debug visualizer objects
  let debugMode = opts.debugMode ?? false;
  const debugGroup = new THREE.Group();
  debugGroup.visible = debugMode;
  scene.add(debugGroup);

  const debugGridMesh = createDebugGridMesh(grid);
  debugGroup.add(debugGridMesh);

  const debugPathLine = createDebugPathLine();
  debugGroup.add(debugPathLine);

  // 5. Game State
  let phase: RallyPhase = 'detecting';
  let score = 0;
  let groceriesCollected = 0;
  let totalGroceriesCount = 8;
  let timeLeft = opts.durationSeconds ?? 45;
  let collisionsCount = 0;
  let combo = 0;
  let maxCombo = 0;

  const startPoint: GridPoint = { x: 0, z: 0 };
  const finishPoint: GridPoint = { x: 0, z: -1.0 };
  let surfaceDetected = false;
  let surfaceY = -0.4;

  // Car input
  const input = { steer: 0, throttle: 0, brake: 0, drift: false };

  // Set physics collision listener
  physics.onCollision = (e) => {
    collisionsCount++;
    combo = 0;
    opts.onCollision(e);
  };

  // 6. WebXR Reference Space & Hit-Test
  await renderer.xr.setSession(session);
  const refSpace = await session.requestReferenceSpace('local');
  const viewerSpace = await session.requestReferenceSpace('viewer');
  let hitTestSource: XRHitTestSource | null = null;
  try {
    hitTestSource = await session.requestHitTestSource?.({ space: viewerSpace }) ?? null;
  } catch {}

  let scanPointsCount = 0;
  let lastThrottleMeshTime = 0;
  let fpsFrames = 0;
  let fpsLastTime = performance.now();
  let currentFps = 60;

  // 7. XR Animation Frame callback
  const onXRFrame = (time: DOMHighResTimeStamp, frame: XRFrame) => {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
      fpsFrames = 0;
      fpsLastTime = now;
    }

    const dt = 1 / Math.max(currentFps, 30);

    // Phase: Detecting & Surface scanning
    if (phase === 'detecting' || phase === 'scanning') {
      let foundHit = false;
      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(refSpace);
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
            reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);

            surfaceDetected = true;
            surfaceY = reticle.position.y;
            physics.surfaceY = surfaceY;
            foundHit = true;
            scanPointsCount++;
            if (scanPointsCount > 20 && phase === 'scanning') {
              setPhase('ready');
            }
          }
        }
      }

      if (!foundHit && !surfaceDetected) {
        // Floating reticle in front of camera
        const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
        const camPos = new THREE.Vector3();
        const camQuat = new THREE.Quaternion();
        xrCam.getWorldPosition(camPos);
        xrCam.getWorldQuaternion(camQuat);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat).setY(0).normalize();
        if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
        reticle.position.set(camPos.x + fwd.x * 0.85, camPos.y - 0.45, camPos.z + fwd.z * 0.85);
        reticle.quaternion.set(0, 0, 0, 1);
        reticle.scale.set(1, 1, 1);
        reticle.visible = true;
      }
    }

    // Process Detected XRPlanes (surface boundary containment)
    const detectedPlanes = (frame as unknown as { detectedPlanes?: Set<XRPlane> }).detectedPlanes;
    if (detectedPlanes && detectedPlanes.size > 0) {
      for (const plane of detectedPlanes) {
        if (plane.orientation === 'horizontal') {
          const planePose = frame.getPose(plane.planeSpace, refSpace);
          if (planePose) {
            const planeMatrix = new THREE.Matrix4().fromArray(planePose.transform.matrix);
            const poly = plane.polygon.map((p) => new THREE.Vector3(p.x, 0, p.z));
            physics.surfacePolygon = poly.map((p) => p.clone().applyMatrix4(planeMatrix));
            grid.applyPlaneBoundary(poly, planeMatrix);
          }
        }
      }
    }

    // Process Detected XRMeshes (Real-world geometry collision)
    const detectedMeshes = (frame as unknown as { detectedMeshes?: Set<XRMesh> }).detectedMeshes;
    if (detectedMeshes && detectedMeshes.size > 0) {
      const nowMs = performance.now();
      const shouldUpdateMeshes = nowMs - lastThrottleMeshTime > 300;

      for (const mesh of detectedMeshes) {
        const meshPose = frame.getPose(mesh.meshSpace, refSpace);
        if (meshPose) {
          const transform = new THREE.Matrix4().fromArray(meshPose.transform.matrix);
          const positions = mesh.vertices;
          const indices = mesh.indices;
          const lastChanged = mesh.lastChangedTime || nowMs;

          if (shouldUpdateMeshes) {
            physics.updateXRMeshCollider(
              (mesh as unknown as { id?: string }).id || `mesh_${mesh.lastChangedTime}`,
              positions,
              indices,
              transform,
              lastChanged,
            );
            grid.markObstaclesFromGeometry(positions, indices, transform, surfaceY);
          }
        }
      }

      if (shouldUpdateMeshes) {
        lastThrottleMeshTime = nowMs;
        grid.dilateObstacles();
        if (debugMode) {
          updateDebugGridVisuals(debugGridMesh, grid, surfaceY);
        }
      }
    }

    // Phase: Racing loop
    if (phase === 'racing') {
      physics.step(dt, input, grid);

      carRoot.position.copy(physics.position);
      carRoot.quaternion.copy(physics.quaternion);

      // Grocery pickups
      const collected = groceryPlacer.checkPickup(physics.position);
      if (collected) {
        groceriesCollected++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        const comboMultiplier = combo >= 5 ? 1.5 : combo >= 3 ? 1.25 : 1.0;
        const awardedPoints = Math.round(collected.points * comboMultiplier);
        score += awardedPoints;

        rallyAudio.playPickup(combo);
        opts.onPickup(awardedPoints, collected.name, combo);

        {
          haptic(20);
        }
      }

      // Check finish line
      const distToFinish = Math.hypot(
        physics.position.x - finishPoint.x,
        physics.position.z - finishPoint.z,
      );
      if (distToFinish < 0.14 && groceriesCollected >= 2) {
        rallyAudio.playFinish();
        setPhase('finished');
        const bonus = Math.round(timeLeft * 25);
        score += bonus;
        finishRace(true);
        return;
      }

      // Countdown race timer
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

    // Floating grocery animations
    groceryPlacer.update(time * 0.001);

    // Debug stats
    if (debugMode && opts.onDebugStats) {
      opts.onDebugStats({
        mode: detectedMeshes?.size ? 'Full Spatial (Mesh)' : 'Surface AR',
        meshCount: detectedMeshes?.size || 0,
        triangleCount: physics.getTriangleCount(),
        planeCount: detectedPlanes?.size || 0,
        colliderCount: physics.getColliderCount(),
        gridCells: grid.cols * grid.rows,
        fps: currentFps,
      });
    }

    // Render frame
    renderer.render(scene, camera);
  };

  // Continuous animation loop
  renderer.setAnimationLoop((time, frame) => {
    if (frame) {
      onXRFrame(time, frame);
    } else {
      renderer.render(scene, camera);
    }
  });

  function setPhase(next: RallyPhase) {
    phase = next;
    opts.onPhase(next);
  }

  // Start with scanning immediately
  setPhase('scanning');

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

  // Handle Placement
  function placeNow() {
    if (phase !== 'ready' && phase !== 'scanning' && phase !== 'detecting') return;

    const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    xrCam.getWorldPosition(camPos);
    xrCam.getWorldQuaternion(camQuat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat).setY(0).normalize();
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);

    if (reticle.visible && surfaceDetected) {
      surfaceY = reticle.position.y;
      startPoint.x = reticle.position.x;
      startPoint.z = reticle.position.z;
    } else {
      surfaceY = camPos.y - 0.45;
      startPoint.x = camPos.x + fwd.x * 0.85;
      startPoint.z = camPos.z + fwd.z * 0.85;
    }

    reticle.visible = false;
    physics.surfaceY = surfaceY;

    // Place Finish ~1.0m ahead along forward vector
    finishPoint.x = startPoint.x + fwd.x * 0.95;
    finishPoint.z = startPoint.z + fwd.z * 0.95;

    // Align start and finish markers
    startMarker.position.set(startPoint.x, surfaceY + 0.002, startPoint.z);
    startMarker.visible = true;

    finishMarker.position.set(finishPoint.x, surfaceY + 0.002, finishPoint.z);
    finishMarker.visible = true;

    // Reset car onto start
    physics.reset(new THREE.Vector3(startPoint.x, surfaceY + physics.carHeight * 0.5, startPoint.z), 0);
    carRoot.position.copy(physics.position);
    carRoot.visible = true;

    // Run A* Path Validation & Flood Fill
    const reachableCells = grid.getReachableFreeCells(startPoint);
    const { path } = grid.findPath(startPoint, finishPoint);

    if (debugMode) {
      updateDebugPathLine(debugPathLine, path, surfaceY);
    }

    // Procedural Grocery Placement
    const spawnList = reachableCells.length >= 5 ? reachableCells : [
      { x: startPoint.x + fwd.x * 0.25 + 0.15, z: startPoint.z + fwd.z * 0.25 },
      { x: startPoint.x + fwd.x * 0.45 - 0.15, z: startPoint.z + fwd.z * 0.45 },
      { x: startPoint.x + fwd.x * 0.65 + 0.12, z: startPoint.z + fwd.z * 0.65 },
      { x: startPoint.x + fwd.x * 0.82 - 0.1, z: startPoint.z + fwd.z * 0.82 },
      { x: startPoint.x + fwd.x * 0.95, z: startPoint.z + fwd.z * 0.95 },
    ];
    groceryPlacer.spawnItems(spawnList, startPoint, finishPoint, surfaceY, 8);
    totalGroceriesCount = groceryPlacer.items.length;

    setPhase('placed');
  }

  // Tap anywhere on screen to place
  const onScreenTap = (e: MouseEvent | TouchEvent) => {
    if ((e.target as HTMLElement)?.closest('button, a, input')) return;
    if (phase === 'scanning' || phase === 'ready' || phase === 'detecting') {
      placeNow();
    }
  };
  window.addEventListener('pointerup', onScreenTap);

  session.addEventListener('select', () => {
    if (phase === 'scanning' || phase === 'ready' || phase === 'detecting') {
      placeNow();
    }
  });

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
    renderer.setAnimationLoop(null);
    rallyAudio.stopEngine();
    window.removeEventListener('pointerup', onScreenTap);
    try {
      session.end();
    } catch {}
    renderer.dispose();
    renderer.domElement.remove();
    opts.onEnd();
  }

  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    rallyAudio.stopEngine();
    window.removeEventListener('pointerup', onScreenTap);
    renderer.dispose();
    renderer.domElement.remove();
    opts.onEnd();
  });

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
    toggleDebug: () => {
      debugMode = !debugMode;
      debugGroup.visible = debugMode;
    },
  };
}

/* ============================================================
   Helper Visualizers & Markers
   ============================================================ */

function createPlacementReticle() {
  const g = new THREE.Group();
  g.visible = true;

  const ringGeo = new THREE.RingGeometry(0.06, 0.08, 36).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color.yellow.int,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);

  const dotGeo = new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);

  g.add(ring, dot);
  return g;
}

function createStartMarker() {
  const g = new THREE.Group();
  const baseGeo = new THREE.PlaneGeometry(0.12, 0.16).rotateX(-Math.PI / 2);
  const baseMat = new THREE.MeshBasicMaterial({
    color: color.yellow.int,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);

  const lineGeo = new THREE.PlaneGeometry(0.12, 0.02).rotateX(-Math.PI / 2);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.y = 0.001;

  g.add(base, line);
  return g;
}

function createFinishMarker() {
  const g = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);

  const beaconGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 16);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.4,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 0.125;

  g.add(ring, beacon);
  return g;
}

function createDebugGridMesh(grid: OccupancyGrid): THREE.InstancedMesh {
  const cellGeo = new THREE.PlaneGeometry(grid.cellSize * 0.9, grid.cellSize * 0.9).rotateX(-Math.PI / 2);
  const cellMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  const total = grid.cols * grid.rows;
  const mesh = new THREE.InstancedMesh(cellGeo, cellMat, total);
  mesh.count = 0;
  return mesh;
}

function updateDebugGridVisuals(mesh: THREE.InstancedMesh, grid: OccupancyGrid, surfaceY: number) {
  let count = 0;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const type = grid.getCell(c, r);
      if (type !== CellType.FREE) {
        const wp = grid.gridToWorld(c, r);
        dummy.position.set(wp.x, surfaceY + 0.002, wp.z);
        dummy.updateMatrix();

        mesh.setMatrixAt(count, dummy.matrix);

        if (type === CellType.BLOCKED) color.setHex(0xff0000);
        else if (type === CellType.DILATED) color.setHex(0xffaa00);
        else if (type === CellType.EDGE_UNSAFE) color.setHex(0x555555);

        mesh.setColorAt(count, color);
        count++;
      }
    }
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function createDebugPathLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

function updateDebugPathLine(line: THREE.Line, path: GridPoint[], surfaceY: number) {
  const points = path.map((p) => new THREE.Vector3(p.x, surfaceY + 0.005, p.z));
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}
