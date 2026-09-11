/* ============================================================
   Feasibility probes for the "Blink It" mechanic.

   Two questions decide what the blink can even be, and neither can be
   answered from a laptop:

   1. Can this phone hold the rear camera and the front camera open at the
      same time? If it can, the blink lives inside the AR race and you still
      see your room. If it cannot, the race has to be played on the front
      camera and the surface in view is whatever the phone is propped in
      front of. Documentation says iOS allows one camera and that opening the
      second stops the first, but documentation is not this handset, and the
      whole design hangs on the answer — so it gets measured rather than
      assumed.

   2. Will a face landmarker load and run here at all, and fast enough to
      catch a blink? A blink is roughly 100-150 ms, so anything under about
      15 fps will miss them entirely.

   Both are deliberately destructive of nothing: every stream is stopped
   again on the way out.
   ============================================================ */

export type DualCamResult = {
  ok: boolean;
  detail: string;
  rearFramesAfter: number;
  frontOpened: boolean;
};

/** Does the rear camera keep delivering frames once the front one opens? */
export async function probeDualCamera(): Promise<DualCamResult> {
  let rear: MediaStream | null = null;
  let front: MediaStream | null = null;
  const v = document.createElement('video');
  v.playsInline = true;
  v.muted = true;
  try {
    rear = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    v.srcObject = rear;
    await v.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    const before = v.currentTime;
    const rearTrack = rear.getVideoTracks()[0];

    try {
      front = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } } });
    } catch (e) {
      return {
        ok: false,
        frontOpened: false,
        rearFramesAfter: 0,
        detail: 'front camera refused: ' + (e instanceof Error ? e.name : 'error'),
      };
    }

    /* A track can report "live" and still have stopped delivering, so the
       test is whether the rear video's clock actually advanced while the
       front camera was open — not what the track says about itself. */
    await new Promise((r) => setTimeout(r, 900));
    const advanced = v.currentTime - before;
    const state = rearTrack.readyState;
    const muted = rearTrack.muted;
    const ok = advanced > 0.1 && state === 'live' && !muted;
    return {
      ok,
      frontOpened: true,
      rearFramesAfter: Number(advanced.toFixed(2)),
      detail: ok
        ? 'both cameras delivering'
        : `rear stalled (track ${state}${muted ? ', muted' : ''}, advanced ${advanced.toFixed(2)}s)`,
    };
  } catch (e) {
    return { ok: false, frontOpened: false, rearFramesAfter: 0, detail: e instanceof Error ? e.name : 'error' };
  } finally {
    rear?.getTracks().forEach((t) => t.stop());
    front?.getTracks().forEach((t) => t.stop());
    v.srcObject = null;
    v.remove();
  }
}

type Blendshape = { categoryName: string; score: number };
type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, t: number) => { faceBlendshapes?: { categories: Blendshape[] }[] };
  close: () => void;
};
type MediaPipeVision = {
  FilesetResolver: { forVisionTasks: (p: string) => Promise<unknown> };
  FaceLandmarker: { createFromOptions: (f: unknown, o: unknown) => Promise<Landmarker> };
};

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export type BlinkSample = {
  fps: number;
  /** 0..1 — how closed the eyes are right now. */
  blink: number;
  /** Deliberate blinks counted so far. */
  blinks: number;
  faceSeen: boolean;
};

/**
 * Load a face landmarker and report live blink scores from the front camera.
 * Returns a stop function. Everything is fetched from a CDN so nothing is
 * added to the app bundle until the mechanic is actually committed to.
 */
export async function startBlinkProbe(onSample: (s: BlinkSample) => void) {
  /* Typed structurally rather than against the package: this is a spike
     loaded from a CDN, and installing a 5 MB dependency to answer "does it
     run at all" would be paying for the thing before knowing it works. */
  const mod = (await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`)) as unknown as MediaPipeVision;
  const { FilesetResolver, FaceLandmarker } = mod;
  const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } } });
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => {});

  let raf = 0;
  let last = performance.now();
  let fps = 0;
  let blinks = 0;
  let closed = false;
  let closedAt = 0;

  /* A blink counts only if the eyes reopen. Holding them shut is not a
     blink, and the reopen edge is also what makes the gesture deliberate. */
  const CLOSE = 0.5;
  const OPEN = 0.25;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (video.readyState < 2) return;
    let blink = 0;
    let faceSeen = false;
    try {
      const res = landmarker.detectForVideo(video, now);
      const shapes = res.faceBlendshapes?.[0]?.categories;
      if (shapes) {
        faceSeen = true;
        const l = shapes.find((c: Blendshape) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
        const r = shapes.find((c: Blendshape) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
        blink = (l + r) / 2;
      }
    } catch {
      /* a dropped frame is not worth reporting */
    }
    if (!closed && blink > CLOSE) {
      closed = true;
      closedAt = now;
    } else if (closed && blink < OPEN) {
      closed = false;
      // 60-500 ms of closure is a blink; longer is a rest, shorter is noise
      const held = now - closedAt;
      if (held > 60 && held < 500) blinks += 1;
    }
    fps = fps * 0.9 + (1000 / Math.max(1, now - last)) * 0.1;
    last = now;
    onSample({ fps: Math.round(fps), blink: Number(blink.toFixed(2)), blinks, faceSeen });
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    video.remove();
    landmarker.close();
  };
}
