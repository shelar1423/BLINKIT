import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadCar, measure, disposeObject } from './modelLoader';

export type ViewerHandle = {
  dispose: () => void;
  reset: () => void;
  setAutoRotate: (on: boolean) => void;
};

type Opts = {
  onProgress?: (pct: number, mb: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

/** Soft round contact shadow, drawn once into a canvas texture. */
function contactShadow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(16,20,24,0.42)');
  g.addColorStop(0.55, 'rgba(16,20,24,0.14)');
  g.addColorStop(1, 'rgba(16,20,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Interactive 3D product viewer: drag to rotate, wheel/pinch to zoom.
 * Vanilla three.js so the render loop never touches React state.
 */
export function createProductViewer(container: HTMLElement, glbUrl: string, opts: Opts = {}): ViewerHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

  // Studio IBL without any network fetch — keeps metal/paint materials readable.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfd8e6, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2.4, 3.4, 2.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe6d0, 0.75);
  fill.position.set(-3, 1.4, -1.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  rim.position.set(-0.6, 1.8, -3.2);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const shadow = contactShadow();
  shadow.visible = false;
  pivot.add(shadow);

  let car: THREE.Group | null = null;
  let radius = 3;
  /* The stage behind the car is a photograph of a garage shot from one fixed
     camera, so this has to behave like a turntable: spin freely, but stay at
     the height the photo was taken from. Letting pitch roam lifted the car off
     the platform it is supposed to be standing on. */
  const PITCH_MIN = 0.16;
  const PITCH_MAX = 0.30;
  const PITCH_HOME = 0.22;
  let yaw = -0.7;
  let pitch = PITCH_HOME;
  let zoom = 1;
  let auto = true;
  let disposed = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinch0 = 0;
  let zoom0 = 1;

  const MIN_ZOOM = 0.78;
  const MAX_ZOOM = 1.55;

  function frame() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function place(model: THREE.Group) {
    const { size } = measure(model);
    const span = Math.max(size.x, size.y, size.z);
    radius = span * 2.5;
    camera.near = Math.max(0.01, span / 100);
    camera.far = span * 40;
    // lift the orbit target to the car's mid-height
    pivot.position.set(0, 0, 0);
    model.position.y = 0;
    const s = Math.max(size.x, size.z) * 1.5;
    shadow.scale.set(s, s, 1);
    shadow.position.y = 0.001;
    shadow.visible = true;
    camera.updateProjectionMatrix();
  }

  loadCar(glbUrl, 1, opts.onProgress)
    .then((model) => {
      if (disposed) {
        disposeObject(model);
        return;
      }
      car = model;
      pivot.add(model);
      place(model);
      opts.onReady?.();
    })
    .catch((e: Error) => {
      if (!disposed) opts.onError?.(e.message || 'Could not load this model');
    });

  // ---------- input ----------
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    auto = false;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = () => {
    dragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    auto = false;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + e.deltaY * 0.0012));
  };
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      pinch0 = dist(e.touches);
      zoom0 = zoom;
      auto = false;
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinch0) {
      e.preventDefault();
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom0 * (pinch0 / dist(e.touches))));
    }
  };
  const onTouchEnd = () => {
    pinch0 = 0;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd);

  /* Coalesced to one re-frame per animation frame, and skipped entirely when
     the box has not actually changed size.

     The sheet animates its own width when the page is scrolled — it gives up
     its side gutters and goes full-bleed — and an observer wired straight to
     `frame` re-sized the renderer, rebuilt the camera framing and forced a
     WebGL draw on EVERY frame of that transition. That is what made the widen
     stutter: not the CSS, but a 3D scene re-framing eight times inside 130ms.
     The final size is the one that matters, and this lands on it a frame
     later at most. */
  let roPending = 0;
  let lastW = -1;
  let lastH = -1;
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    /* Settled, not per frame. The product sheet animates its gutters when you
       scroll off the top, which resizes this container on every frame of the
       transition — and reallocating the WebGL drawing buffer each time made
       that transition stutter. The canvas is CSS-stretched meanwhile, so it
       still fills the box; the buffer catches up once the size stops moving. */
    window.clearTimeout(roPending);
    roPending = window.setTimeout(() => {
      roPending = 0;
      frame();
    }, 140);
  });
  ro.observe(container);
  frame();

  // ---------- loop ----------
  renderer.setAnimationLoop(() => {
    if (auto && !dragging) yaw += 0.0042;
    const r = radius * zoom;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * r,
      Math.sin(pitch) * r + (car ? measure(car).size.y * 0.45 : 0.2),
      Math.cos(yaw) * Math.cos(pitch) * r,
    );
    camera.lookAt(0, car ? measure(car).size.y * 0.42 : 0.2, 0);
    renderer.render(scene, camera);
  });

  return {
    reset() {
      yaw = -0.7;
      pitch = PITCH_HOME;
      zoom = 1;
      auto = true;
    },
    setAutoRotate(on: boolean) {
      auto = on;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      if (roPending) window.clearTimeout(roPending);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      if (car) pivot.remove(car); // prototype is cached & shared: do not dispose materials
      shadow.geometry.dispose();
      (shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      (shadow.material as THREE.Material).dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
