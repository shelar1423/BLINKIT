import * as THREE from 'three';
import { OccupancyGrid, CellType } from './occupancyGrid';
import { rallyAudio } from './audioEffects';

export type CollisionEvent = {
  intensity: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
};

export type CarInput = {
  steer: number; // -1 (left) to 1 (right)
  throttle: number; // 0 to 1 (auto-speed if 0, GO boost if 1)
  brake: number; // 0 to 1
  drift: boolean;
};

export type MeshColliderData = {
  id: string;
  positions: Float32Array;
  indices: Uint32Array | Uint16Array | null;
  transform: THREE.Matrix4;
  lastChangedTime: number;
  boundingBox: THREE.Box3;
};

export class SpatialPhysics {
  // Vehicle transform
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  readonly quaternion = new THREE.Quaternion();

  // Vehicle dimensions (Hot Wheels 1:64 scale)
  readonly carWidth = 0.045; // ~4.5 cm
  readonly carLength = 0.085; // ~8.5 cm
  readonly carHeight = 0.028; // ~2.8 cm
  readonly collisionRadius = 0.038;

  // Driving parameters
  private readonly maxSpeed = 0.95; // m/s (~3.4 km/h, perfect for tabletop scale)
  private readonly cruiseSpeed = 0.55; // Auto-acceleration cruising speed
  private readonly reverseMaxSpeed = 0.35;
  private readonly accel = 1.4;
  private readonly brakeDecel = 2.8;
  private readonly steerSpeed = 3.6; // radians/sec
  private readonly friction = 1.2;

  heading = 0; // Yaw angle in radians
  speed = 0;
  isFlipped = false;
  private flipTime = 0;
  private lastCollisionTime = 0;

  // Real-world static geometry colliders
  private readonly meshColliders = new Map<string, MeshColliderData>();

  // Surface reference
  surfaceY = 0;
  surfacePolygon: THREE.Vector3[] = [];

  // Collision callback
  onCollision?: (e: CollisionEvent) => void;

  constructor() {
    this.reset(new THREE.Vector3(0, 0, 0), 0);
  }

  reset(pos: THREE.Vector3, heading = 0) {
    this.position.copy(pos);
    this.heading = heading;
    this.speed = 0;
    this.velocity.set(0, 0, 0);
    this.rotation.set(0, heading, 0);
    this.quaternion.setFromEuler(this.rotation);
    this.isFlipped = false;
    this.flipTime = 0;
  }

  /**
   * Queue or update an XRMesh geometry collider.
   * Throttled using lastChangedTime to avoid rebuilding physics colliders every frame.
   */
  updateXRMeshCollider(
    meshId: string,
    positions: Float32Array,
    indices: Uint32Array | Uint16Array | null,
    transform: THREE.Matrix4,
    lastChangedTime: number,
  ) {
    const existing = this.meshColliders.get(meshId);
    if (existing && existing.lastChangedTime >= lastChangedTime) {
      return; // No change
    }

    // Compute local bounding box
    const box = new THREE.Box3();
    const count = positions.length / 3;
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i += 6) {
      v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      v.applyMatrix4(transform);
      box.expandByPoint(v);
    }

    this.meshColliders.set(meshId, {
      id: meshId,
      positions,
      indices,
      transform,
      lastChangedTime,
      boundingBox: box,
    });
  }

  removeXRMeshCollider(meshId: string) {
    this.meshColliders.delete(meshId);
  }

  clearAllColliders() {
    this.meshColliders.clear();
  }

  getColliderCount(): number {
    return this.meshColliders.size;
  }

  getTriangleCount(): number {
    let sum = 0;
    for (const c of this.meshColliders.values()) {
      sum += c.indices ? c.indices.length / 3 : c.positions.length / 9;
    }
    return Math.round(sum);
  }

  /**
   * Physics step (called on requestVideoFrameCallback / XR animation frame)
   */
  step(dt: number, input: CarInput, grid?: OccupancyGrid) {
    // Clamp dt to avoid physics tunnelling on lag spikes
    const delta = Math.min(dt, 0.05);

    // Auto-recovery if flipped or upside down
    if (this.isFlipped) {
      this.flipTime += delta;
      if (this.flipTime > 0.8) {
        this.recoverUpright(grid);
      }
      return;
    }

    // 1. Steering
    const driftMult = input.drift ? 1.45 : 1.0;
    const steerDir = -input.steer; // Negative is right in Three.js standard coordinates
    const movingForward = this.speed >= -0.05;
    const effectiveSteer = steerDir * (movingForward ? 1 : -1);

    // Steering is more responsive at speed, but still works at low speed
    const steerAmount = effectiveSteer * this.steerSpeed * driftMult * (0.4 + Math.min(Math.abs(this.speed), 1) * 0.6);
    this.heading += steerAmount * delta;

    // 2. Throttle & Auto-cruise
    let targetSpeed = this.cruiseSpeed;
    if (input.throttle > 0.1) {
      targetSpeed = this.cruiseSpeed + (this.maxSpeed - this.cruiseSpeed) * input.throttle;
    } else if (input.brake > 0.1) {
      targetSpeed = 0;
    }

    if (input.brake > 0.1) {
      // Braking
      if (this.speed > 0.05) {
        this.speed = Math.max(0, this.speed - this.brakeDecel * delta);
      } else {
        // Reverse if held at full stop
        this.speed = Math.max(-this.reverseMaxSpeed, this.speed - this.accel * 0.8 * delta);
      }
    } else {
      // Accelerating towards target
      if (this.speed < targetSpeed) {
        this.speed = Math.min(targetSpeed, this.speed + this.accel * delta);
      } else if (this.speed > targetSpeed) {
        this.speed = Math.max(targetSpeed, this.speed - this.friction * delta);
      }
    }

    // 3. Movement vector
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    const prevX = this.position.x;
    const prevZ = this.position.z;

    const nextX = prevX + forwardX * this.speed * delta;
    const nextZ = prevZ + forwardZ * this.speed * delta;

    // 4. Collision Detection with Real-World Geometry & Table Boundaries
    const colResult = this.resolveCollisions(nextX, nextZ, prevX, prevZ, grid);

    if (colResult.collided) {
      this.position.x = colResult.resolvedX;
      this.position.z = colResult.resolvedZ;

      // Deflect velocity and apply speed penalty
      this.speed = Math.max(0, this.speed * 0.35); // Slow down sharply

      const now = performance.now();
      if (now - this.lastCollisionTime > 250) {
        this.lastCollisionTime = now;

        // Trigger subtle haptics
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([30, 40]);
        }

        // Web Audio bump sound
        rallyAudio.playCollision(Math.min(colResult.intensity, 1.2));

        if (this.onCollision) {
          this.onCollision({
            intensity: colResult.intensity,
            position: this.position.clone(),
            normal: colResult.normal,
          });
        }
      }
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    // Surface clamping (Hot Wheels car hugs the detected table/floor)
    this.position.y = this.surfaceY + this.carHeight * 0.5;

    // Update orientation
    this.rotation.set(0, this.heading, 0);
    this.quaternion.setFromEuler(this.rotation);

    // Audio pitch modulation
    rallyAudio.updateEngine(Math.abs(this.speed) / this.maxSpeed);
  }

  /**
   * Collision resolution against:
   * - Static XRMesh obstacle colliders (bottles, laptops, walls)
   * - Occupancy grid blocked & dilated cells
   * - Surface polygon boundaries (prevent driving off table edge)
   */
  private resolveCollisions(
    nextX: number,
    nextZ: number,
    prevX: number,
    prevZ: number,
    grid?: OccupancyGrid,
  ): {
    collided: boolean;
    resolvedX: number;
    resolvedZ: number;
    intensity: number;
    normal: THREE.Vector3;
  } {
    const normal = new THREE.Vector3(0, 0, 0);
    let collided = false;
    let resolvedX = nextX;
    let resolvedZ = nextZ;
    let intensity = 1.0;

    // 1. Table / Playable Surface Boundary Containment
    if (this.surfacePolygon.length >= 3) {
      const isInside = this.pointInPoly(resolvedX, resolvedZ, this.surfacePolygon);
      if (!isInside) {
        collided = true;
        // Keep inside boundary: push back toward previous safe position
        const toPrevX = prevX - nextX;
        const toPrevZ = prevZ - nextZ;
        const dist = Math.hypot(toPrevX, toPrevZ);
        if (dist > 0.0001) {
          normal.set(toPrevX / dist, 0, toPrevZ / dist);
        } else {
          normal.set(0, 0, 1);
        }
        resolvedX = prevX;
        resolvedZ = prevZ;
        intensity = 0.8;
        return { collided, resolvedX, resolvedZ, intensity, normal };
      }
    }

    // 2. Occupancy Grid Obstacle Check
    if (grid) {
      const targetCell = grid.worldToGrid(resolvedX, resolvedZ);
      if (targetCell) {
        const cellType = grid.getCell(targetCell.col, targetCell.row);
        if (cellType === CellType.BLOCKED || cellType === CellType.DILATED || cellType === CellType.EDGE_UNSAFE) {
          collided = true;
          // Calculate normal from cell center to vehicle
          const cellWorld = grid.gridToWorld(targetCell.col, targetCell.row);
          const dx = prevX - cellWorld.x;
          const dz = prevZ - cellWorld.z;
          const len = Math.hypot(dx, dz) || 1;
          normal.set(dx / len, 0, dz / len);

          // Stop at previous position
          resolvedX = prevX;
          resolvedZ = prevZ;
          intensity = 1.0;
          return { collided, resolvedX, resolvedZ, intensity, normal };
        }
      }
    }

    // 3. Real Mesh Obstacle Bounding Box & Height Intersection
    const carBox = new THREE.Box3(
      new THREE.Vector3(
        resolvedX - this.collisionRadius,
        this.surfaceY + 0.015,
        resolvedZ - this.collisionRadius,
      ),
      new THREE.Vector3(
        resolvedX + this.collisionRadius,
        this.surfaceY + this.carHeight + 0.05,
        resolvedZ + this.collisionRadius,
      ),
    );

    for (const collider of this.meshColliders.values()) {
      if (!collider.boundingBox.intersectsBox(carBox)) {
        continue;
      }

      // Check detailed vertices of the intersecting mesh
      const v = new THREE.Vector3();
      const count = collider.positions.length / 3;
      const step = Math.max(1, Math.floor(count / 150)); // Fast sampled check for performance

      for (let i = 0; i < count; i += step) {
        v.set(
          collider.positions[i * 3],
          collider.positions[i * 3 + 1],
          collider.positions[i * 3 + 2],
        );
        v.applyMatrix4(collider.transform);

        const relY = v.y - this.surfaceY;
        // Obstacle height band: 1.5 cm to 45 cm above table
        if (relY >= 0.015 && relY <= 0.45) {
          const dx = resolvedX - v.x;
          const dz = resolvedZ - v.z;
          const dist = Math.hypot(dx, dz);

          if (dist < this.collisionRadius) {
            collided = true;
            const pushDist = (this.collisionRadius - dist) + 0.005;
            const nx = (dx / (dist || 1));
            const nz = (dz / (dist || 1));
            normal.set(nx, 0, nz);

            resolvedX = prevX + nx * pushDist;
            resolvedZ = prevZ + nz * pushDist;
            intensity = 1.2;
            break;
          }
        }
      }

      if (collided) break;
    }

    return { collided, resolvedX, resolvedZ, intensity, normal };
  }

  private pointInPoly(x: number, z: number, poly: THREE.Vector3[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z;
      const xj = poly[j].x, zj = poly[j].z;
      const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private recoverUpright(grid?: OccupancyGrid) {
    this.isFlipped = false;
    this.flipTime = 0;
    this.speed = 0;
    this.velocity.set(0, 0, 0);

    // If current position is blocked or outside bounds, find nearest free cell
    if (grid) {
      const g = grid.worldToGrid(this.position.x, this.position.z);
      if (g && grid.getCell(g.col, g.row) !== CellType.FREE) {
        const safe = grid.findNearestFreeCell(g.col, g.row);
        if (safe) {
          const wp = grid.gridToWorld(safe.col, safe.row);
          this.position.x = wp.x;
          this.position.z = wp.z;
        }
      }
    }

    this.position.y = this.surfaceY + this.carHeight * 0.5;
    this.rotation.set(0, this.heading, 0);
    this.quaternion.setFromEuler(this.rotation);
  }
}
