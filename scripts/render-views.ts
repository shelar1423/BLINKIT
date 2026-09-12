/**
 * Dev-only harness: renders extra product views from the GLB models.
 *
 * The catalogue ships one studio photograph per car, so the card's pager had
 * nothing to page through. Rather than repeat the same picture behind four
 * dots, these are real renders of the real model from real angles.
 *
 * Served by Vite at /render.html in dev. It is not part of the build — Vite's
 * only entry is index.html — and nothing in the app imports it.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SIZE = 640;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  // the whole point: without this the buffer is cleared before toDataURL reads it
  preserveDrawingBuffer: true,
});
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(3, 5, 4);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
const loader = new GLTFLoader();

/** yaw, pitch — the angles a listing shows a die-cast from, after the hero shot. */
const ANGLES: [number, number][] = [
  [Math.PI / 2, 0.10],        // side profile
  [Math.PI * 1.28, 0.22],     // rear three-quarter
  [-0.7, 0.85],               // top-down over the front
];

async function renderCar(glbUrl: string): Promise<string[]> {
  const gltf = await loader.loadAsync(glbUrl);
  const root = gltf.scene;

  // frame it: centre on the origin and scale to a known size
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z) || 1;
  root.position.sub(centre);
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(1 / extent);
  scene.add(holder);

  const out: string[] = [];
  for (const [yaw, pitch] of ANGLES) {
    const r = 2.55;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * r,
      Math.sin(pitch) * r,
      Math.cos(yaw) * Math.cos(pitch) * r,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    out.push(renderer.domElement.toDataURL('image/webp', 0.9));
  }
  scene.remove(holder);
  return out;
}

(window as unknown as { __renderCar: typeof renderCar }).__renderCar = renderCar;
document.getElementById('out')!.textContent = 'ready';
