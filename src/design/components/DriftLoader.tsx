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
    renderer.setSize(el.clientWidth, el.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    /* Pulled back far enough that the car clears the frame at every point on
       its orbit — at 6.4 it was cropped against the left edge each lap. */
    camera.position.set(0, 4.1, 8.2);
    camera.lookAt(0, 0.25, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    scene.add(key);

    /* The same burnout the AR reticle stands on, so the wait and the thing it
       leads to are visibly the same world. */
    const tex = new THREE.TextureLoader().load('/decor/tire-mark.webp');
    tex.colorSpace = THREE.SRGBColorSpace;
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 5.9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    scene.add(ring);

    const pivot = new THREE.Group();
    scene.add(pivot);

    let car: THREE.Group | null = null;
    let disposed = false;
    if (glbUrl) {
      void loadCar(glbUrl, 1.7).then((c) => {
        if (disposed) return;
        car = c;
        // out on the ring, nose tangent to it, tail kicked out
        c.position.set(2.05, 0, 0);
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
        car.position.y = Math.abs(Math.sin(t * 6)) * 0.02;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      if (!el.clientWidth) return;
      renderer.setSize(el.clientWidth, el.clientHeight, false);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.setAnimationLoop(null);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [glbUrl]);

  return (
    <div className="driftload" role="status" aria-live="polite">
      <div className="driftload__stage" ref={host} />
      <p className="driftload__t">{label}</p>
      <span className="driftload__bar" aria-hidden="true">
        <i />
      </span>
    </div>
  );
}
