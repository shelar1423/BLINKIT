import * as THREE from 'three';

/* ============================================================
   Room scan — turn the surface you are pointing at into the track.

   The race already had a bumper sensor: one point, 30 cm ahead of the car,
   sampled twelve times a second. It could tell you that you had just hit
   something, which is not the same as the room mattering. You crashed into a
   mug you had never been shown, and it read as a bug rather than as your desk.

   This builds a map instead of a probe. While the circuit is sitting on the
   surface and before anyone has pressed go, every frame projects a grid of
   points on the ground plane back into the camera image and asks a much
   simpler question of each one: does this patch look like the surface, or like
   something standing on it. Answers accumulate, so a cell has to look wrong
   repeatedly, from the slightly different angles you get just by holding a
   phone, before it is called an obstacle. Then it is drawn, so the layout is
   something you can see and drive around rather than discover by crashing.

   Two things this deliberately does not do:

   - It does not pretend to be depth. There is no SLAM and no parallax here,
     only a hunch about texture, so it finds "something is there", never what
     or how tall.
   - It does not use an absolute threshold. A patch of carpet in a dark room
     has more edge energy than a white desk in daylight, so a fixed number
     classifies the lighting rather than the furniture. Every frame is scored
     against its own median instead.
   ============================================================ */

/** Cells per side. 24x24 over a 2.4 m circuit is a 10 cm cell — about a mug. */
const CELLS = 24;
/** Half-width of the luminance patch sampled per cell. */
const PATCH = 2;
/** How fast a cell's opinion moves. Lower needs more agreement to flip. */
const RATE = 0.16;
/** Confidence above which a cell counts as blocked. */
const BLOCKED_AT = 0.45;
/** Observations before a cell is allowed an opinion at all. */
const MIN_SEEN = 3;
/** A cell must be this much noisier than the frame's median to look occupied. */
const RELATIVE = 1.9;
const FLOOR = 5;

export class RoomScan {
  private readonly conf = new Float32Array(CELLS * CELLS);
  private readonly seen = new Uint16Array(CELLS * CELLS);
  private centre = new THREE.Vector3();
  private span = 2.4;
  private lum: Float32Array | null = null;
  /** Scratch, reused every pass so a 10 Hz scan allocates nothing. */
  private readonly p = new THREE.Vector3();
  private readonly energies: number[] = [];
  private readonly idx: number[] = [];

  /** Centre the grid on the placed circuit. Resets everything already learnt. */
  setArea(centre: THREE.Vector3, span: number) {
    this.centre.copy(centre);
    this.span = span;
    this.reset();
  }

  reset() {
    this.conf.fill(0);
    this.seen.fill(0);
  }

  get cellSize() {
    return this.span / CELLS;
  }

  /** 0..1 — how much of the grid has been looked at enough to trust. */
  get coverage() {
    let n = 0;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] >= MIN_SEEN) n++;
    return n / this.seen.length;
  }

  get blockedCount() {
    let n = 0;
    for (let i = 0; i < this.conf.length; i++) {
      if (this.seen[i] >= MIN_SEEN && this.conf[i] > BLOCKED_AT) n++;
    }
    return n;
  }

  /** World centre of cell i, written into `out`. */
  cellCentre(i: number, out: THREE.Vector3) {
    const cx = i % CELLS;
    const cz = (i / CELLS) | 0;
    const s = this.cellSize;
    return out.set(
      this.centre.x + (cx - CELLS / 2 + 0.5) * s,
      this.centre.y,
      this.centre.z + (cz - CELLS / 2 + 0.5) * s,
    );
  }

  forEachBlocked(cb: (i: number) => void) {
    for (let i = 0; i < this.conf.length; i++) {
      if (this.seen[i] >= MIN_SEEN && this.conf[i] > BLOCKED_AT) cb(i);
    }
  }

  /** Is this world point standing on something? */
  isBlockedWorld(x: number, z: number): boolean {
    const s = this.cellSize;
    const cx = Math.floor((x - this.centre.x) / s + CELLS / 2);
    const cz = Math.floor((z - this.centre.z) / s + CELLS / 2);
    if (cx < 0 || cx >= CELLS || cz < 0 || cz >= CELLS) return false;
    const i = cz * CELLS + cx;
    return this.seen[i] >= MIN_SEEN && this.conf[i] > BLOCKED_AT;
  }

  /**
   * One sampling pass over the whole grid.
   *
   * The camera frame is pulled down to the small canvas once and read once —
   * a getImageData per cell would be 576 round trips to the GPU per pass and
   * would cost more than the race.
   */
  sample(video: HTMLVideoElement, ctx: CanvasRenderingContext2D, camera: THREE.PerspectiveCamera) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (video.readyState < 2) return;

    try {
      ctx.drawImage(video, 0, 0, W, H);
    } catch {
      return; // frame not decodable yet
    }
    const data = ctx.getImageData(0, 0, W, H).data;

    if (!this.lum || this.lum.length !== W * H) this.lum = new Float32Array(W * H);
    const lum = this.lum;
    for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
      lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    this.energies.length = 0;
    this.idx.length = 0;

    for (let i = 0; i < CELLS * CELLS; i++) {
      this.cellCentre(i, this.p).project(camera);
      // Behind the camera, or too near the frame edge for a full patch.
      if (this.p.z > 1) continue;
      const sx = Math.round(((this.p.x + 1) / 2) * W);
      const sy = Math.round(((-this.p.y + 1) / 2) * H);
      if (sx < PATCH || sx >= W - PATCH || sy < PATCH || sy >= H - PATCH) continue;

      let sum = 0;
      let n = 0;
      for (let dy = -PATCH; dy <= PATCH; dy++) {
        for (let dx = -PATCH; dx <= PATCH; dx++) {
          sum += lum[(sy + dy) * W + (sx + dx)];
          n++;
        }
      }
      const mean = sum / n;
      let dev = 0;
      for (let dy = -PATCH; dy <= PATCH; dy++) {
        for (let dx = -PATCH; dx <= PATCH; dx++) {
          dev += Math.abs(lum[(sy + dy) * W + (sx + dx)] - mean);
        }
      }
      this.energies.push(dev / n);
      this.idx.push(i);
    }

    if (this.energies.length < 8) return;

    /* Score every cell against this frame's own median, so the classifier
       measures how unlike the rest of the surface a patch is rather than how
       bright the room happens to be. */
    const sorted = this.energies.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const cut = median * RELATIVE + FLOOR;

    for (let k = 0; k < this.idx.length; k++) {
      const i = this.idx[k];
      const occupied = this.energies[k] > cut;
      if (this.seen[i] < 0xffff) this.seen[i] += 1;
      this.conf[i] = Math.max(-1, Math.min(1, this.conf[i] + (occupied ? RATE : -RATE)));
    }
  }
}

export const SCAN_CELLS = CELLS;

/* ------------------------------------------------------------
   Drawing what was found.

   A scan the player cannot see is just an unexplained crash, so every cell the
   map calls occupied gets a marker standing on it. One InstancedMesh carries
   all of them: the count changes every pass while the scan settles, and
   rebuilding a few hundred meshes ten times a second would cost more than the
   race does.
   ------------------------------------------------------------ */

const MAX_MARKERS = SCAN_CELLS * SCAN_CELLS;

export class RoomHazards {
  readonly root = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly ring: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();

  constructor(private readonly scan: RoomScan, blockColor: number, ringColor: number) {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.mesh = new THREE.InstancedMesh(
      box,
      new THREE.MeshStandardMaterial({ color: blockColor, roughness: 0.75, metalness: 0.05 }),
      MAX_MARKERS,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

    const ringGeo = new THREE.RingGeometry(0.38, 0.5, 12).rotateX(-Math.PI / 2);
    this.ring = new THREE.InstancedMesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
      MAX_MARKERS,
    );
    this.ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ring.count = 0;

    this.root.add(this.mesh, this.ring);
  }

  /** Rebuild the instance list from the map's current opinion. */
  refresh(height = 0.06) {
    const s = this.scan.cellSize;
    let n = 0;
    this.scan.forEachBlocked((i) => {
      this.scan.cellCentre(i, this.v);
      this.m.makeScale(s * 0.78, height, s * 0.78).setPosition(this.v.x, this.v.y + 0.001, this.v.z);
      this.mesh.setMatrixAt(n, this.m);
      this.m.makeScale(s, 1, s).setPosition(this.v.x, this.v.y + 0.0015, this.v.z);
      this.ring.setMatrixAt(n, this.m);
      n++;
    });
    this.mesh.count = n;
    this.ring.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ring.instanceMatrix.needsUpdate = true;
  }

  set visible(v: boolean) {
    this.root.visible = v;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
