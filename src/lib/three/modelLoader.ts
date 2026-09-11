import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();

/** Cache of normalized prototypes, keyed by url. Cloned per use. */
const cache = new Map<string, THREE.Group>();
const inflight = new Map<string, Promise<THREE.Group>>();

export type LoadProgress = (pct: number, loadedMB: number) => void;

/**
 * Normalize an arbitrary GLB so it is predictable in every scene:
 *  - longest horizontal axis becomes the car's length, aligned to -Z (forward)
 *  - uniformly scaled so that length === targetLength
 *  - centred on X/Z
 *  - lowest point sits exactly on y = 0 (wheels on the ground)
 *
 * Returns a fresh Group whose origin is the contact point with the ground.
 */
export function normalizeModel(source: THREE.Object3D, targetLength: number): THREE.Group {
  const inner = source;
  inner.updateWorldMatrix(true, true);

  // 1. measure raw
  let box = new THREE.Box3().setFromObject(inner);
  let size = box.getSize(new THREE.Vector3());

  // Guard against degenerate / empty geometry
  if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z) || size.length() === 0) {
    size = new THREE.Vector3(1, 1, 1);
  }

  // 2. orient: the longer horizontal axis is the vehicle's length -> map it to Z
  const spin = new THREE.Group();
  spin.add(inner);
  if (size.x > size.z) spin.rotation.y = Math.PI / 2;
  spin.updateWorldMatrix(true, true);

  // 3. re-measure after rotation
  box = new THREE.Box3().setFromObject(spin);
  size = box.getSize(new THREE.Vector3());
  const length = Math.max(size.z, 1e-6);

  // 4. uniform scale so the car is exactly targetLength long
  const scaleGroup = new THREE.Group();
  scaleGroup.add(spin);
  const s = targetLength / length;
  scaleGroup.scale.setScalar(s);
  scaleGroup.updateWorldMatrix(true, true);

  // 5. centre X/Z and drop onto the ground plane
  const finalBox = new THREE.Box3().setFromObject(scaleGroup);
  const centre = finalBox.getCenter(new THREE.Vector3());
  scaleGroup.position.x -= centre.x;
  scaleGroup.position.z -= centre.z;
  scaleGroup.position.y -= finalBox.min.y;

  const root = new THREE.Group();
  root.add(scaleGroup);
  root.userData.normalizedLength = targetLength;
  return root;
}

/** Measured size of a normalized model, for camera framing. */
export function measure(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  return { size, centre, box };
}

/**
 * Load a GLB, normalize it, cache the prototype and hand back a clone.
 * targetLength is in world units (metres for AR, arbitrary for the game).
 */
export function loadCar(url: string, targetLength: number, onProgress?: LoadProgress): Promise<THREE.Group> {
  const key = url;

  const finish = (proto: THREE.Group) => {
    // These GLBs are rigged (SkinnedMesh + bones). Object3D.clone() copies the
    // meshes but leaves them bound to the ORIGINAL skeleton, which renders the
    // car as a collapsed sliver. SkeletonUtils.clone() rebuilds the bone graph
    // and rebinds each SkinnedMesh to its own copy.
    const clone = cloneSkinned(proto) as THREE.Group;
    const base = proto.userData.normalizedLength as number;
    clone.scale.setScalar(targetLength / base);
    clone.userData.normalizedLength = targetLength;
    return clone;
  };

  if (cache.has(key)) return Promise.resolve(finish(cache.get(key)!));

  if (!inflight.has(key)) {
    const p = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const scene = gltf.scene ?? gltf.scenes[0];
          if (!scene) return reject(new Error('GLB contained no scene'));
          scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.frustumCulled = false;
              m.castShadow = false;
              m.receiveShadow = false;
            }
          });
          // Normalize to 1 unit long; callers rescale from there.
          const proto = normalizeModel(scene, 1);
          cache.set(key, proto);
          resolve(proto);
        },
        (ev) => {
          if (!onProgress) return;
          const mb = ev.loaded / 1048576;
          onProgress(ev.lengthComputable ? Math.round((ev.loaded / ev.total) * 100) : -1, mb);
        },
        (err) => reject(err instanceof Error ? err : new Error('Failed to load model')),
      );
    });
    inflight.set(key, p);
    p.catch(() => inflight.delete(key));
  }

  return inflight.get(key)!.then(finish);
}

/** Warm the cache without blocking. */
export function preloadCar(url: string) {
  if (!cache.has(url) && !inflight.has(url)) loadCar(url, 1).catch(() => {});
}

/** Free GPU memory for a subtree that is no longer displayed. */
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[];
    const kill = (mm: THREE.Material) => {
      for (const k of Object.keys(mm) as (keyof THREE.Material)[]) {
        const v = mm[k] as unknown;
        if (v && typeof v === 'object' && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      mm.dispose();
    };
    if (Array.isArray(mat)) mat.forEach(kill);
    else if (mat) kill(mat);
  });
}

/** Cached prototypes are shared; only call when tearing the whole app down. */
export function clearModelCache() {
  cache.forEach((g) => disposeObject(g));
  cache.clear();
  inflight.clear();
}
