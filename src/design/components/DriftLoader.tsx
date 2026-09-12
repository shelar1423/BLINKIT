import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadCar } from '../../lib/three/modelLoader';
import './driftloader.css';

/**
 * The wait before a race or an AR session.
 *
 * Starting a camera or an XR session takes a second or two of real work, and
 * what used to fill it was the word "Starting camera…" on a button. A spinner
 * says only that something is happening; this says what — it is your car, on
 * the same burnout ring the AR reticle uses, sliding around it while the thing
 * you asked for gets ready.
 *
 * Deliberately cheap: one light, no shadows, no environment map, a 200px
 * canvas. It runs at the exact moment the device is busiest, so it must not be
 * competing for the GPU with the session it is waiting on.
 */
/**
 * How long the loader is held for, at minimum.
 *
 * Three seconds is longer than most of these waits actually are, which is the
 * point: the drift is the moment, not a progress report. One constant so the
 * three routes into a race cannot drift apart.
 */
export const LOADER_MS = 3000;

/* Measured off public/decor/tire-mark.webp rather than eyeballed: on a 512px
   texture the ink peaks at 0.707 of the half-width and falls to half that
   density between 0.656 and 0.941. On a 5.9 plane that puts the band's centre
   line at 2.09 and its outer edge at 2.78 — the car belongs on the first, and
   the camera has to contain the second. At 1.62 the car was riding well inside
   the band, on clean ground. */
const RING_PLANE = 5.9;
const INK_MID = (RING_PLANE / 2) * 0.707;
const INK_OUTER = (RING_PLANE / 2) * 0.941;
/** How much of the frame the burnout may fill, in NDC. The rest is breathing room. */
const FIT = 0.95;
/** Long enough to read as a car at phone size, short enough to sit in the band. */
const CAR_LEN = 1.55;

export function DriftLoader({
  glbUrl,
  label = 'Getting your car ready',
}: {
  glbUrl?: string;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    scene.add(key);

    /* The same burnout the AR reticle stands on, so the wait and the thing it
       leads to are visibly the same world. */
    const tex = new THREE.TextureLoader().load('/decor/tire-mark.webp');
    tex.colorSpace = THREE.SRGBColorSpace;
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(RING_PLANE, RING_PLANE).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    scene.add(ring);

    /* Frame the mark rather than guess a camera distance.
       The previous camera sat at a hand-picked 7.4 with the aspect left at the
       constructor's 1, so it was only ever correct for one canvas shape, and not
       even for that one: at 8.3m from a 5.9m plane through a 34° lens the near
       corners of the mark fall outside the frustum, which is the clipping you
       see at the left and right edges. This walks the camera back along a fixed
       look direction until the whole outer edge of the burnout projects inside
       the frame, so it is right at any width the stage is given. */
    const look = new THREE.Vector3(0, 0.25, 0);
    const dir = new THREE.Vector3(0, 3.8, 7.4).normalize();
    const probe = new THREE.Vector3();
    const frame = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      camera.aspect = w / h;
      let d = 8;
      for (let i = 0; i < 32; i++) {
        camera.position.copy(look).addScaledVector(dir, d);
        camera.lookAt(look);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        let worst = 0;
        for (let a = 0; a < 64; a++) {
          const th = (a / 64) * Math.PI * 2;
          probe.set(Math.cos(th) * INK_OUTER, 0, Math.sin(th) * INK_OUTER).project(camera);
          worst = Math.max(worst, Math.abs(probe.x), Math.abs(probe.y));
        }
        if (Math.abs(worst - FIT) < 0.004) break;
        d *= worst / FIT;
      }
      renderer.setSize(w, h, false);
    };
    frame();

    const pivot = new THREE.Group();
    scene.add(pivot);

    let car: THREE.Group | null = null;
    let disposed = false;
    if (glbUrl) {
      void loadCar(glbUrl, CAR_LEN).then((c) => {
        if (disposed) return;
        car = c;
        /* Inside the burnout band, not straddling its outer edge.
           The car was also simply too big for the circle: at 1.7 long against a
           ring 2.95 in radius it spanned more than half the radius, so wherever
           it sat it overhung one edge of the mark and read as cut off. A car
           doing donuts is small inside its own burnout — 1.25 long, riding the
           band rather than straddling it. Lifted clear of the plane too, so it
           sits ON the mark rather than half sunk through it. */
        c.position.set(INK_MID, 0.03, 0);
        c.rotation.y = -Math.PI / 2 - 0.55;
        pivot.add(c);
      });
    }

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      pivot.rotation.y = -t * 2.1;
      ring.rotation.z = t * 0.12;
      if (car) {
        // the tail swings a little through the slide rather than tracking rigidly
        car.rotation.y = -Math.PI / 2 - 0.55 + Math.sin(t * 4.2) * 0.07;
        car.position.y = 0.03 + Math.abs(Math.sin(t * 6)) * 0.02;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      if (!el.clientWidth) return;
      frame();
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.setAnimationLoop(null);
      /* Only tear down what this component made.
         loadCar hands back a SkeletonUtils clone that SHARES geometry and
         materials with a prototype held in the module-level cache, so walking
         the scene and disposing everything reachable frees the car for every
         future consumer — the race and the AR session included. In StrictMode
         the first mount unmounts straight away, which disposed the car before
         the second mount could draw it, and the ring came up empty. The car is
         detached; the ring is ours and is disposed properly. */
      if (car) pivot.remove(car);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [glbUrl]);

  return (
    <div className="driftload" role="status" aria-live="polite">
      {/* The lockup, because the ground above the ring was a large empty
          gradient and this is the one moment the campaign has the whole screen. */}
      <span className="driftload__mast">
        <img src="/brand/hot-wheels.svg" alt="Hot Wheels" />
        <i aria-hidden="true">&times;</i>
        <b>blink<em>it</em></b>
      </span>
      <div className="driftload__stage" ref={host} />
      <p className="driftload__t">{label}</p>
      <span className="driftload__bar" aria-hidden="true">
        <i />
      </span>
    </div>
  );
}
