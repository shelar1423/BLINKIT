import * as THREE from 'three';
import { type GridPoint } from './occupancyGrid';

export type GroceryItemType = 'milk' | 'banana' | 'chips' | 'cola' | 'cereal' | 'blinkit_bag';

export type GroceryItem = {
  id: string;
  type: GroceryItemType;
  name: string;
  points: number;
  position: THREE.Vector3;
  collected: boolean;
  mesh: THREE.Group;
  baseY: number;
};

const GROCERY_DEFS: { type: GroceryItemType; name: string; points: number; rarity: 'common' | 'rare' | 'super' }[] = [
  { type: 'milk', name: 'Fresh Milk', points: 100, rarity: 'common' },
  { type: 'banana', name: 'Robusta Banana', points: 100, rarity: 'common' },
  { type: 'chips', name: 'Crispy Chips', points: 100, rarity: 'common' },
  { type: 'cola', name: 'Chilled Cola', points: 100, rarity: 'common' },
  { type: 'cereal', name: 'Crunchy Cereal', points: 250, rarity: 'rare' },
  { type: 'blinkit_bag', name: 'Blinkit Mystery Bag', points: 500, rarity: 'super' },
];

export class GroceryPlacer {
  readonly items: GroceryItem[] = [];
  readonly root = new THREE.Group();

  clear() {
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      this.root.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.items.length = 0;
  }

  /**
   * Spawn 5–10 grocery items in validated reachable open cells
   */
  spawnItems(
    reachableCells: GridPoint[],
    startPoint: GridPoint,
    finishPoint: GridPoint,
    surfaceY = 0,
    targetCount = 8,
  ) {
    this.clear();

    if (reachableCells.length < 5) return;

    // Filter cells: exclude those too close to start or finish
    const validCandidates = reachableCells.filter((pt) => {
      const dStart = Math.hypot(pt.x - startPoint.x, pt.z - startPoint.z);
      const dFinish = Math.hypot(pt.x - finishPoint.x, pt.z - finishPoint.z);
      return dStart > 0.25 && dFinish > 0.15; // Min distance from spawn & finish
    });

    if (validCandidates.length === 0) return;

    // Shuffle and pick spaced out positions (Poisson-like dispersion)
    const count = Math.min(Math.max(5, targetCount), Math.min(10, validCandidates.length));
    const chosenPositions: GridPoint[] = [];
    const minSpacing = 0.22; // Metres between groceries

    // Deterministic shuffle
    const pool = [...validCandidates].sort(() => Math.random() - 0.5);

    for (const pt of pool) {
      const isFarEnough = chosenPositions.every(
        (cp) => Math.hypot(cp.x - pt.x, cp.z - pt.z) >= minSpacing,
      );
      if (isFarEnough) {
        chosenPositions.push(pt);
        if (chosenPositions.length >= count) break;
      }
    }

    // Fallback if sparse
    if (chosenPositions.length < 5) {
      for (const pt of pool) {
        if (!chosenPositions.includes(pt)) {
          chosenPositions.push(pt);
          if (chosenPositions.length >= 5) break;
        }
      }
    }

    // Build 3D pickups
    chosenPositions.forEach((pt, idx) => {
      // Pick grocery type
      let def = GROCERY_DEFS[idx % GROCERY_DEFS.length];
      if (idx === chosenPositions.length - 1) {
        // Last one is always the Blinkit bag
        def = GROCERY_DEFS.find((d) => d.type === 'blinkit_bag') ?? def;
      }

      const baseY = surfaceY + 0.035; // 3.5 cm float
      const mesh = this.createGroceryMesh(def.type);
      mesh.position.set(pt.x, baseY, pt.z);

      this.root.add(mesh);

      this.items.push({
        id: `pickup_${idx}_${def.type}`,
        type: def.type,
        name: def.name,
        points: def.points,
        position: new THREE.Vector3(pt.x, baseY, pt.z),
        collected: false,
        mesh,
        baseY,
      });
    });
  }

  private createGroceryMesh(type: GroceryItemType): THREE.Group {
    const group = new THREE.Group();

    // Subtle base shadow/glow ring
    const ringGeo = new THREE.RingGeometry(0.02, 0.035, 24).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: type === 'blinkit_bag' ? 0xed1c24 : 0xf8cb46,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.03;
    group.add(ring);

    let itemMesh: THREE.Object3D;

    switch (type) {
      case 'milk': {
        // Milk carton box
        const geo = new THREE.BoxGeometry(0.035, 0.055, 0.035);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          roughness: 0.3,
          metalness: 0.1,
        });
        itemMesh = new THREE.Mesh(geo, mat);
        // Carton roof
        const roofGeo = new THREE.ConeGeometry(0.025, 0.015, 4).rotateY(Math.PI / 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 0.032;
        group.add(roof);
        break;
      }

      case 'banana': {
        // Banana cylinder curve
        const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12);
        geo.rotateZ(Math.PI / 4);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffd000,
          roughness: 0.4,
        });
        itemMesh = new THREE.Mesh(geo, mat);
        break;
      }

      case 'chips': {
        // Chips packet
        const geo = new THREE.BoxGeometry(0.045, 0.06, 0.015);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xff5500,
          roughness: 0.3,
          metalness: 0.2,
        });
        itemMesh = new THREE.Mesh(geo, mat);
        break;
      }

      case 'cola': {
        // Cola can
        const geo = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xcc0000,
          roughness: 0.2,
          metalness: 0.6,
        });
        itemMesh = new THREE.Mesh(geo, mat);
        break;
      }

      case 'cereal': {
        // Cereal box
        const geo = new THREE.BoxGeometry(0.045, 0.065, 0.025);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          roughness: 0.4,
        });
        itemMesh = new THREE.Mesh(geo, mat);
        break;
      }

      case 'blinkit_bag':
      default: {
        // Blinkit delivery bag
        const bagGeo = new THREE.BoxGeometry(0.05, 0.055, 0.038);
        const bagMat = new THREE.MeshStandardMaterial({
          color: 0xf8cb46, // Blinkit Yellow
          roughness: 0.3,
          metalness: 0.2,
        });
        itemMesh = new THREE.Mesh(bagGeo, bagMat);

        // Handle
        const handleGeo = new THREE.TorusGeometry(0.015, 0.003, 8, 16, Math.PI);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 0.03;
        group.add(handle);
        break;
      }
    }

    group.add(itemMesh);
    return group;
  }

  /**
   * Floating & rotation animation tick
   */
  update(timeSeconds: number) {
    for (const item of this.items) {
      if (item.collected) continue;
      // Gentle bobbing: 8mm amplitude
      item.mesh.position.y = item.baseY + Math.sin(timeSeconds * 3.5 + item.position.x * 5) * 0.008;
      // Gentle spin
      item.mesh.rotation.y = timeSeconds * 1.8;
    }
  }

  /**
   * Check collision with car position (returns item if collected)
   */
  checkPickup(carPos: THREE.Vector3, pickupRadius = 0.075): GroceryItem | null {
    for (const item of this.items) {
      if (item.collected) continue;
      const dx = carPos.x - item.position.x;
      const dz = carPos.z - item.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= pickupRadius) {
        item.collected = true;
        // Trigger disappear / pop
        this.animateCollection(item);
        return item;
      }
    }
    return null;
  }

  private animateCollection(item: GroceryItem) {
    let progress = 0;
    const initialScale = item.mesh.scale.clone();
    const interval = setInterval(() => {
      progress += 0.12;
      if (progress >= 1) {
        clearInterval(interval);
        this.root.remove(item.mesh);
      } else {
        const s = (1 + progress * 0.6) * (1 - progress);
        item.mesh.scale.set(initialScale.x * s, initialScale.y * (s + 0.3), initialScale.z * s);
        item.mesh.position.y += 0.01;
      }
    }, 16);
  }
}
