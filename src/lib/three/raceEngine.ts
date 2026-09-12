import * as THREE from 'three';
import { color, scene } from '../../design/constants';
import { PICKUPS } from '../../data/catalog';
import { haptic } from '../haptics';

/* ============================================================
   Race It Home — arcade race engine.

   The track is a closed loop curve. The car's state is
   (t, lateral) where t is normalised progress along the curve
   and lateral is the offset across the road. That makes
   collision, lap counting and AR scaling exact and cheap:
   everything is 2D maths on the curve, no physics engine.

   The same engine drives both the 3D race and the AR race —
   AR just parents `root` to the anchor and scales it down.
   ============================================================ */

export type RaceStats = {
  score: number;
  groceries: number;
  timeLeft: number;
  lap: number;
  laps: number;
  progress: number; // 0..1 of the whole race
  speedKph: number;
};

export type RaceOutcome = {
  score: number;
  groceries: number;
  seconds: number;
  finished: boolean; // true = crossed the line, false = ran out of time
};

export type EngineOpts = {
  laps?: number;
  duration?: number; // seconds
  onTick?: (s: RaceStats) => void;
  onPickup?: (points: number, name: string) => void;
  /** Points taken off for hitting something. Reported from the one place that
   *  deducts them, so every caller that bounces the car gets it for free. */
  onPenalty?: (points: number) => void;
  onFinish?: (o: RaceOutcome) => void;
};

const ROAD_W = 9;
const LANE_LIMIT = ROAD_W / 2 - 0.9;
/**
 * Side-rail height. Measured off real Hot Wheels track, whose walls are ~6 mm
 * on a ~34 mm wide track — 17.6% of the width. 1.6 / 9 is 17.8%, so the
 * circuit carries the toy's own proportion rather than an invented one.
 */
const RAIL_H = 1.6;
/*
 * An AR-specific extra boost was built and tested at 24% of road width. It was
 * dropped: at phone-viewing height the taller wall began occluding the grocery
 * pickups on the far side of the circuit, and hiding a collectible the player is
 * meant to steer for costs more than the extra edge definition gains. The toy's
 * own 17.8% reads clearly at that distance, so AR and the 3D race share it.
 */

/** Oval-ish circuit with a couple of kinks so it reads as a track, not a ring. */
function buildCurve() {
  const pts: THREE.Vector3[] = [];
  const R = 42;
  const shape: [number, number][] = [
    [0, -1], [0.72, -0.92], [1.02, -0.55], [1.06, 0], [0.94, 0.5],
    [0.55, 0.86], [0, 1], [-0.58, 0.9], [-1.0, 0.56], [-1.08, 0],
    [-0.98, -0.5], [-0.6, -0.9],
  ];
  for (const [x, z] of shape) pts.push(new THREE.Vector3(x * R, 0, z * R * 0.78));
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
}

function roadMesh(curve: THREE.Curve<THREE.Vector3>, segments: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  /*
    UVs are laid out in world units so the moulding reads at its real size.
    The texture is 128x256, mapped across ROAD_W, so one tile covers ROAD_W * 2
    of track length and pixels stay square. Driving v off the segment index
    instead put ~5,400 tiles around the circuit, which mip-mapped straight to
    flat colour and cost the track all its surface detail.
  */
  const tile = ROAD_W * 2;
  const repeats = curve.getLength() / tile;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const a = p.clone().addScaledVector(right, -ROAD_W / 2);
    const b = p.clone().addScaledVector(right, ROAD_W / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, t * repeats, 1, t * repeats);
    if (i < segments) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hot Wheels track surface, painted into a repeating canvas texture (no network).
 * Orange plastic with the darker moulded side rails and the pale centre slot the
 * real toy track has — the grey asphalt never belonged in a Hot Wheels world.
 */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d')!;

  // moulded orange plastic, slightly darker toward the rails
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, scene.trackEdge);
  g.addColorStop(0.13, scene.trackMid);
  g.addColorStop(0.5, scene.trackCore);
  g.addColorStop(0.87, scene.trackMid);
  g.addColorStop(1, scene.trackEdge);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 256);

  // the pale centre slot
  x.fillStyle = 'rgba(255, 214, 150, 0.20)';
  x.fillRect(60, 0, 8, 256);

  // moulded rail highlight
  x.fillStyle = 'rgba(255, 255, 255, 0.14)';
  x.fillRect(12, 0, 3, 256);
  x.fillRect(113, 0, 3, 256);

  // rungs across the track, the way the toy track is ribbed
  x.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 256; y += 32) x.fillRect(16, y, 96, 5);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Trackside banners.
 *
 * Every real Hot Wheels set hangs boards down the side of the circuit, and
 * without them the track reads as a plain orange road in a void — there is
 * nothing at eye level to give the car scale or the corners a sense of speed.
 *
 * Landscape, not the tall pennants this replaces: a pennant can only carry
 * text turned on its side, which nobody reads at speed. These are hoardings, so
 * the Hot Wheels mark and Blinkit's wordmark sit the right way up and can
 * actually be read from the car.
 *
 * Drawn once to a canvas and shared as one texture per brand, so the whole run
 * costs two materials however many boards there are.
 */
function bannerTexture(kind: 'hw' | 'bk', onReady: () => void): THREE.CanvasTexture {
  /* Portrait, because these are hanging pennants and not hoardings — long
     drops of fabric slung from an overhead arm, the way a Hot Wheels set
     dresses the gantries above its track. The mark runs UP the banner, so the
     canvas is painted on its side and the whole thing is read rotated. */
  const W = 256;
  const H = 800;
  /* Height of the swallowtail cut out of the bottom. Transparent, so the
     material's alpha gives the flag its shape — a rectangle reads as a sign,
     a forked tail reads as cloth. */
  const TAIL = 120;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const paint = (logo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H);

    // the cloth: full width at the top, forked at the hem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H - TAIL);
    ctx.lineTo(W / 2, H - TAIL * 0.35);
    ctx.lineTo(0, H - TAIL);
    ctx.closePath();
    if (kind === 'hw') {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#C2121A');
      g.addColorStop(0.5, '#ED1C24');
      g.addColorStop(1, '#C2121A');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#E0B02E');
      g.addColorStop(0.5, '#F8CB46');
      g.addColorStop(1, '#E0B02E');
      ctx.fillStyle = g;
    }
    ctx.fill();

    // a sewn header where it takes the arm
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, 0, W, 14);

    /* Everything below is drawn rotated a quarter turn, so it reads bottom-to-
       top when the flag is hung. The banner's LENGTH becomes the type's width,
       which is the only way a wordmark fits on something this narrow. */
    ctx.save();
    ctx.translate(W / 2, (H - TAIL) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const runLen = H - TAIL;

    if (kind === 'hw') {
      if (logo) {
        /* The real mark, knocked to white — the shipped SVG is a flat #ED1C24,
           the same red as the cloth behind it. */
        const lw = runLen * 0.78;
        const lh = lw * (logo.height / logo.width);
        const t = document.createElement('canvas');
        t.width = Math.ceil(lw);
        t.height = Math.ceil(lh);
        const tc = t.getContext('2d')!;
        tc.drawImage(logo, 0, 0, lw, lh);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = '#fff';
        tc.fillRect(0, 0, lw, lh);
        ctx.drawImage(t, -lw / 2, -lh / 2);
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'italic 900 132px system-ui, -apple-system, sans-serif';
        ctx.fillText('HOT WHEELS', 0, 0);
      }
    } else {
      ctx.fillStyle = '#1F1F1F';
      ctx.font = '800 150px system-ui, -apple-system, sans-serif';
      ctx.fillText('blinkit', 0, -40);
      ctx.fillStyle = '#4A4028';
      ctx.font = '700 56px system-ui, -apple-system, sans-serif';
      ctx.fillText("India's last minute app", 0, 58);
    }
    ctx.restore();
  };

  /* onReady fires only from the image's own callbacks, never from the first
     paint.

     The first paint runs synchronously, before this function has returned —
     so the caller's `const tex = bannerTexture(...)` is still in its temporal
     dead zone, and a callback that touches `tex` threw
     "Cannot access 'tex' before initialization" right there. That exception
     escaped track construction, so the scene was never built: in AR the camera
     opened onto an empty overlay with no reticle and no place button, and the
     3D race came up blank the same way. The synchronous paint needs no
     notification anyway — it happens before the texture is created, so the
     canvas already carries it. */
  if (kind === 'hw') {
    const img = new Image();
    img.onload = () => {
      paint(img);
      onReady();
    };
    img.onerror = () => {
      paint();
      onReady();
    };
    img.src = '/brand/hot-wheels.svg';
    paint();
  } else {
    paint();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The raised orange side rails. Built as two vertical ribbons along the road
 * edges — the single detail that makes the circuit read as Hot Wheels track
 * rather than a road, and it costs two draw calls.
 */
function railMesh(curve: THREE.Curve<THREE.Vector3>, segments: number, side: 1 | -1, height: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  // Moulded track walls flare outward rather than standing dead vertical. The
  // lean gives the rail a lit face instead of a zero-width edge at grazing
  // angles — which is exactly the angle AR is viewed from.
  const lean = height * 0.18;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const base = p.clone().addScaledVector(right, (ROAD_W / 2) * side);
    const top = base.clone().addScaledVector(right, lean * side);
    pos.push(base.x, base.y, base.z, top.x, top.y + height, top.z);
    if (i < segments) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Deep-space plate under the circuit: near-black, with amber and cyan clouds so
 * it reads as a galaxy rather than a flat void. Warm/cool only — no violet, so
 * it stays inside the campaign palette.
 */
function nebulaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = scene.space;
  x.fillRect(0, 0, 512, 512);

  const cloud = (cx: number, cy: number, r: number, col: string, a: number) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col.replace('ALPHA', String(a)));
    g.addColorStop(1, col.replace('ALPHA', '0'));
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  };
  cloud(190, 210, 250, 'rgba(255,150,40,ALPHA)', 0.30);
  cloud(340, 330, 210, 'rgba(20,120,220,ALPHA)', 0.26);
  cloud(120, 380, 170, 'rgba(255,90,30,ALPHA)', 0.18);
  cloud(390, 140, 150, 'rgba(90,190,255,ALPHA)', 0.16);

  // stars
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.9;
    x.fillStyle = `rgba(255,255,255,${a})`;
    const r = Math.random() < 0.92 ? 1 : 2;
    x.fillRect(Math.random() * 512, Math.random() * 512, r, r);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function spriteTexture(url: string) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** What clipping a chunk of debris costs. */
const DEBRIS_PENALTY = 100;

export class RaceEngine {
  readonly root = new THREE.Group();

  private curve = buildCurve();
  private curveLen: number;
  private laps: number;
  private duration: number;
  private opts: EngineOpts;

  private car: THREE.Object3D | null = null;
  private carTilt = new THREE.Group();

  private t = 0;
  private lateral = 0;
  private steer = 0;
  private steerSmooth = 0;
  private speed = 0;
  private boostUntil = 0;

  /* --- manual driving. Until setThrottle/setBrake/setDrift is called the car
     drives itself, which is what the 3D race has always done. The AR race
     hands the throttle to the player. --- */
  private manual = false;
  private throttle = 0;
  private braking = 0;
  private drifting = false;
  private driftYaw = 0;
  private grip = 1;

  private score = 0;
  private groceries = 0;
  private lap = 0;
  private elapsed = 0;
  private running = false;
  private done = false;

  private pickups: {
    sprite: THREE.Sprite;
    t: number;
    lateral: number;
    points: number;
    name: string;
    alive: boolean;
    pop: number;
  }[] = [];

  private debris: {
    mesh: THREE.Mesh;
    t: number;
    lateral: number;
    spin: THREE.Vector3;
    /** >0 once hit: seconds since it shattered, drives the shard animation. */
    broken: number;
    shards: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
  }[] = [];
  private ground: THREE.Mesh | null = null;
  private propRoot = new THREE.Group();
  private arProps: { mesh: THREE.Mesh; spin: THREE.Vector3; bobPhase: number; baseY: number }[] = [];
  private scenery: THREE.InstancedMesh | null = null;
  /** widest extent of the ROAD itself, ignoring ground and scenery */
  readonly trackExtent: number;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private finishGate = new THREE.Group();

  constructor(opts: EngineOpts = {}) {
    this.opts = opts;
    this.laps = opts.laps ?? 2;
    this.duration = opts.duration ?? 45;
    this.curveLen = this.curve.getLength();
    const cb = new THREE.Box3().setFromPoints(this.curve.getSpacedPoints(96));
    this.trackExtent = Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z) + ROAD_W;
    this.build();
  }

  /* ---------------- scene construction ---------------- */
  private build() {
    const tex = roadTexture();
    this.disposables.push(tex);

    const roadGeo = roadMesh(this.curve, 420);
    // glossy moulded plastic, not asphalt
    const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.0 });
    // The studio IBL exists for the car's die-cast paint; left at full strength
    // it washes the track to pale peach. Damp it per-material, not scene-wide.
    roadMat.envMapIntensity = 0.22;
    // The map is already a deep orange; this scales it so a face-on key doesn't
    // push it through ACES highlight roll-off into pale peach.
    roadMat.color.setHex(0xb4b4b4);
    this.disposables.push(roadGeo, roadMat);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.y = 0.01;
    this.root.add(road);

    // raised side rails, the detail that makes it read as Hot Wheels track
    const railMat = new THREE.MeshStandardMaterial({
      color: scene.rail,
      roughness: 0.5,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    railMat.envMapIntensity = 0.3;
    this.disposables.push(railMat);
    for (const side of [1, -1] as const) {
      const rg = railMesh(this.curve, 420, side, RAIL_H);
      this.disposables.push(rg);
      const rail = new THREE.Mesh(rg, railMat);
      rail.position.y = 0.01;
      this.root.add(rail);
    }

    /* Trackside banners, alternating the two brands down both sides.
       Posted just outside the rail and turned to face the road, so they read
       from the driving camera rather than only from above. Instanced by hand
       rather than by InstancedMesh: there are 2 x BANNERS of them and they need
       two different textures, so two shared materials is the cheaper shape. */
    const BANNERS = 14;
    const bannerMats = (['hw', 'bk'] as const).map((k) => {
      const m = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
      // the Hot Wheels mark arrives a frame or two late; repaint when it does
      const tex = bannerTexture(k, () => {
        m.map = tex;
        m.needsUpdate = true;
        tex.needsUpdate = true;
      });
      m.map = tex;
      this.disposables.push(m, tex);
      return m;
    });
    /* Long hanging pennants, slung from an overhead arm.

       These were landscape boards on a post, and before that pennants with the
       post running down their middle — which split the artwork, because from
       the car you only ever see the front. Hanging them solves both: the arm
       carries the flag's top edge and the mast stands off to ONE SIDE of it,
       along the track rather than across it, so nothing crosses the cloth.

       Built in a group whose -Z is turned to face the road. That makes local X
       run along the track, which is the direction the flag's width and its arm
       both need to lie in — so the mast ends up beside the flag from the
       driver's view, never in front of it. */
    const FLAG_W = 1.2;
    const FLAG_H = 3.6;
    const ARM_Y = 5.25;
    const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H);
    const mastGeo = new THREE.CylinderGeometry(0.07, 0.09, ARM_Y + 0.3, 6);
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, FLAG_W + 0.55, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b323c, roughness: 0.7 });
    this.disposables.push(flagGeo, mastGeo, armGeo, postMat);
    const bUp = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < BANNERS; i++) {
      const t = i / BANNERS;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, bUp).normalize();
      for (const side of [1, -1] as const) {
        const at = p.clone().addScaledVector(right, (ROAD_W / 2 + 1.9) * side);

        const rig = new THREE.Group();
        rig.position.copy(at);
        // -Z toward the road, which puts local X along it
        rig.lookAt(p.x, at.y, p.z);

        const mast = new THREE.Mesh(mastGeo, postMat);
        mast.position.set((FLAG_W / 2 + 0.28) * side, (ARM_Y + 0.3) / 2, 0);
        rig.add(mast);

        const arm = new THREE.Mesh(armGeo, postMat);
        arm.position.set(0, ARM_Y, 0);
        arm.rotation.z = Math.PI / 2;
        rig.add(arm);

        const flag = new THREE.Mesh(flagGeo, bannerMats[(i + (side === 1 ? 0 : 1)) % 2]);
        // hung from the arm: its top edge sits just under it
        flag.position.set(0, ARM_Y - FLAG_H / 2 - 0.08, 0);
        rig.add(flag);

        this.root.add(rig);
      }
    }

    // Deep space under the circuit. Near-black so the track reads as floating,
    // with a faint warm core so it isn't a flat void.
    const gGeo = new THREE.CircleGeometry(150, 64);
    const gMat = new THREE.MeshBasicMaterial({ map: nebulaTexture(), transparent: true, opacity: 0.95 });
    this.disposables.push(gGeo, gMat, gMat.map!);
    const ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    this.ground = ground;
    this.root.add(ground);

    this.buildScenery();
    this.buildFinishGate();
    this.buildPickups();
    this.buildDebris();
    this.buildArProps();

    this.root.add(this.carTilt);
  }

  /** Asteroid field drifting around the circuit, in place of the old city blocks. */
  private buildScenery() {
    const geo = new THREE.IcosahedronGeometry(1, 0);   // low-poly = reads as rock
    const mat = new THREE.MeshStandardMaterial({ color: scene.asteroid, roughness: 0.95, metalness: 0.05, flatShading: true });
    mat.envMapIntensity = 0.35;
    this.disposables.push(geo, mat);
    const N = 60;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const off = ROAD_W / 2 + 9 + ((i * 7) % 26);
      const pos = p.clone().addScaledVector(right, off * side);
      // scattered above and below the track plane so it reads as a field, not a fence
      pos.y = -7 + ((i * 13) % 22);
      const sc = 1.1 + ((i * 5) % 9) * 0.42;
      m.compose(
        pos,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 1.1, i * 0.7, i * 0.4)),
        new THREE.Vector3(sc, sc * (0.7 + ((i * 3) % 5) * 0.12), sc),
      );
      mesh.setMatrixAt(i, m);
      // warm grey-brown rock, a few lit amber by the nearby star
      col.setHSL(0.075, 0.22, 0.12 + ((i * 17) % 10) / 48);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scenery = mesh;
    this.root.add(mesh);
  }

  private buildFinishGate() {
    const up = new THREE.Vector3(0, 1, 0);
    const p = this.curve.getPointAt(0);
    const tan = this.curve.getTangentAt(0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    // chequered strip across the road
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        x.fillStyle = (i + j) % 2 ? '#ffffff' : '#141018';
        x.fillRect(i * 8, j * 8, 8, 8);
      }
    const ct = new THREE.CanvasTexture(c);
    ct.colorSpace = THREE.SRGBColorSpace;
    ct.wrapS = THREE.RepeatWrapping;
    ct.repeat.set(6, 1);
    const stripGeo = new THREE.PlaneGeometry(ROAD_W, 2.4);
    const stripMat = new THREE.MeshBasicMaterial({ map: ct, transparent: false });
    this.disposables.push(ct, stripGeo, stripMat);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.copy(p).setY(0.03);
    strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan.clone().setY(0).normalize());
    strip.rotateX(-Math.PI / 2);
    this.finishGate.add(strip);

    // two posts
    const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 6, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: color.hwO.int, roughness: 0.6 });
    this.disposables.push(postGeo, postMat);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.copy(p).addScaledVector(right, (ROAD_W / 2 + 0.4) * s).setY(3);
      this.finishGate.add(post);
    }
    this.root.add(this.finishGate);
  }

  private buildPickups() {
    const COUNT = 46;
    const texCache = new Map<string, THREE.Texture>();
    for (let i = 0; i < COUNT; i++) {
      const def = PICKUPS[i % PICKUPS.length];
      let tex = texCache.get(def.image);
      if (!tex) {
        tex = spriteTexture(def.image);
        texCache.set(def.image, tex);
        this.disposables.push(tex);
      }
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      this.disposables.push(mat);
      const sprite = new THREE.Sprite(mat);
      const size = def.points >= 500 ? 2.6 : def.points >= 250 ? 2.2 : 1.9;
      sprite.scale.set(size, size, 1);
      // spread along the loop, alternating across the road
      const t = (i + 1.5) / (COUNT + 3);
      const lateral = [-2.6, 0, 2.6, -1.3, 1.3][i % 5];
      this.pickups.push({ sprite, t, lateral, points: def.points, name: def.name, alive: true, pop: 0 });
      this.root.add(sprite);
    }
    this.layoutPickups();
  }

  private layoutPickups() {
    const up = new THREE.Vector3(0, 1, 0);
    for (const p of this.pickups) {
      const pos = this.curve.getPointAt(p.t);
      const tan = this.curve.getTangentAt(p.t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      p.sprite.position.copy(pos).addScaledVector(right, p.lateral).setY(1.15);
    }
  }

  /**
   * Tumbling space debris in place of the old traffic cones. Same gameplay
   * contract — clipping one scrubs speed — but a chunk of shattered rock belongs
   * in this world and an orange cone did not.
   */
  private buildDebris() {
    const geo = new THREE.DodecahedronGeometry(0.62, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: scene.debris,
      roughness: 0.9,
      metalness: 0.12,
      flatShading: true,
    });
    mat.envMapIntensity = 0.4;
    this.disposables.push(geo, mat);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14 + 0.021;
      const lateral = i % 2 === 0 ? -3.3 : 3.3;
      const mesh = new THREE.Mesh(geo, mat);
      const pos = this.curve.getPointAt(t % 1);
      const tan = this.curve.getTangentAt(t % 1);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      mesh.position.copy(pos).addScaledVector(right, lateral).setY(0.62);
      mesh.rotation.set(i * 0.9, i * 1.3, i * 0.5);
      const s = 0.8 + ((i * 7) % 5) * 0.18;
      mesh.scale.set(s, s * 0.82, s);
      this.debris.push({
        mesh,
        t: t % 1,
        lateral,
        spin: new THREE.Vector3(0.25 + (i % 3) * 0.12, 0.4 + (i % 5) * 0.09, 0.18 + (i % 4) * 0.07),
        broken: 0,
        shards: [],
      });
      this.root.add(mesh);
    }
  }

  /**
   * Break a chunk of debris into tumbling shards. Hitting a rock and having it
   * sit there unmoved read as scenery; breaking it reads as impact, and it also
   * tells the player that piece is spent.
   */
  private shatter(c: {
    mesh: THREE.Mesh;
    broken: number;
    shards: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
  }) {
    c.broken = 0.0001;
    c.mesh.visible = false;
    const geo = new THREE.TetrahedronGeometry(0.26, 0);
    const mat = c.mesh.material as THREE.Material;
    for (let i = 0; i < 6; i++) {
      const sh = new THREE.Mesh(geo, mat);
      sh.position.copy(c.mesh.position);
      const a = (i / 6) * Math.PI * 2 + Math.random();
      sh.scale.setScalar(0.6 + Math.random() * 0.6);
      this.root.add(sh);
      c.shards.push({
        mesh: sh,
        vel: new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 3), 5 + Math.random() * 4, Math.sin(a) * (3 + Math.random() * 3)),
        spin: new THREE.Vector3(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5),
      });
    }
    this.disposables.push(geo);
  }

  /**
   * A small set of space props that read at tabletop scale.
   *
   * The main asteroid field is built for the 3D race, where the camera sits
   * inside the scene — dropped into AR it is a ring of boulders bigger than the
   * table. This is a scaled-down companion: a handful of rocks orbiting just
   * above and outside the circuit, close enough to the track to stay in frame
   * when the whole thing is 2.4 m across.
   */
  private buildArProps() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: scene.asteroid,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    mat.envMapIntensity = 0.4;
    this.disposables.push(geo, mat);

    const up = new THREE.Vector3(0, 1, 0);
    const N = 10;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.35) / N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const m = new THREE.Mesh(geo, mat);
      const sc = 1.5 + ((i * 5) % 7) * 0.55;
      m.scale.set(sc, sc * 0.8, sc);
      m.position
        .copy(p)
        .addScaledVector(right, (ROAD_W / 2 + 3.5 + ((i * 3) % 5)) * side)
        .setY(3 + ((i * 7) % 9));
      m.rotation.set(i * 1.2, i * 0.8, i * 0.5);
      this.arProps.push({
        mesh: m,
        spin: new THREE.Vector3(0.12 + (i % 3) * 0.05, 0.18 + (i % 4) * 0.04, 0.09),
        bobPhase: i * 0.7,
        baseY: m.position.y,
      });
      this.propRoot.add(m);
    }
    this.root.add(this.propRoot);
  }

  /* ---------------- public API ---------------- */

  /**
   * In AR the circuit sits on a real table, so the giant ground disc and the
   * city blocks are dropped: they dwarf the track, hide the car and cost fill
   * rate for nothing. Only track, rails, gate, pickups, debris and car are placed.
   */
  setPresentation(mode: '3d' | 'ar') {
    const show = mode === '3d';
    if (this.ground) this.ground.visible = show;
    if (this.scenery) this.scenery.visible = show;
    // the full field is for the 3D race; the compact props are for AR
    this.propRoot.visible = !show;
  }

  setCar(model: THREE.Object3D) {
    if (this.car) this.carTilt.remove(this.car);
    this.car = model;
    this.carTilt.add(model);
    // Put the car on the grid immediately. Without this it sits at the world
    // origin — the middle of the oval — until the first update() tick, so it
    // is invisible for the whole 3-2-1 countdown.
    this.layoutCar();
  }

  /** Position + orient the car on the circuit for the current (t, lateral). */
  private layoutCar() {
    const up = new THREE.Vector3(0, 1, 0);
    const pos = this.curve.getPointAt(this.t);
    const tan = this.curve.getTangentAt(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    this.carTilt.position.copy(pos).addScaledVector(right, this.lateral);
    this.carTilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan.clone().setY(0).normalize());
    // A drifting car points where it *was* going, not where it is sliding to.
    if (this.driftYaw !== 0) this.carTilt.rotateY(this.driftYaw);
  }

  /** -1 (full left) .. 1 (full right) */
  setSteer(v: number) {
    this.steer = Math.max(-1, Math.min(1, v));
  }

  /**
   * Hand the throttle to the player. Calling any of the manual controls
   * switches the engine out of self-driving mode for the rest of the race.
   */
  setThrottle(v: number) {
    this.manual = true;
    this.throttle = Math.max(0, Math.min(1, v));
  }

  setBrake(v: number) {
    this.manual = true;
    this.braking = Math.max(0, Math.min(1, v));
  }

  /**
   * Handbrake: less grip, much more lateral slide, visible yaw out of line.
   * Deliberately does NOT flip the engine into manual mode — the 3D race
   * drives itself, and taking the throttle away the first time the player
   * touched the handbrake would simply stop the car dead.
   */
  setDrift(on: boolean) {
    this.drifting = on;
  }

  get isDrifting() {
    return this.drifting && this.speed > 6;
  }

  get isManual() {
    return this.manual;
  }

  boost() {
    this.boostUntil = this.elapsed + 1.4;
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  get isRunning() {
    return this.running;
  }

  getCarWorldPosition(out: THREE.Vector3) {
    return this.carTilt.getWorldPosition(out);
  }

  getCarWorldDirection(out: THREE.Vector3) {
    return this.carTilt.getWorldDirection(out);
  }

  getSpeed() {
    return this.speed;
  }

  applyObstacleBounce(penaltyPoints = DEBRIS_PENALTY) {
    // Rebound backward
    this.speed = -Math.max(6, this.speed * 0.5);
    // Deflect lateral
    this.lateral += (Math.random() > 0.5 ? 1 : -1) * 0.8;
    this.driftYaw = (Math.random() - 0.5) * 0.4;
    const before = this.score;
    this.score = Math.max(0, this.score - penaltyPoints);
    // report what was actually lost, not what was asked for: near zero the
    // deduction is clamped, and showing -100 off a score of 40 is a lie
    if (before > this.score) this.opts.onPenalty?.(before - this.score);
  }

  /**
   * Chase camera. Offsets are expressed in world units and converted to curve
   * parameters, so the framing does not change if the circuit is resized.
   * BEHIND/HEIGHT are tuned so a 4.2-unit car sits in the lower third of frame.
   */
  cameraTarget(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const BEHIND = 8.5;  // metres of track behind the car
    const HEIGHT = 3.0;  // camera height above the road
    const AHEAD = 6.0;   // look-at point in front of the car
    const up = new THREE.Vector3(0, 1, 0);
    const dBack = BEHIND / this.curveLen;
    const dAhead = AHEAD / this.curveLen;

    const p = this.curve.getPointAt((this.t - dBack + 1) % 1);
    const tan = this.curve.getTangentAt(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    out.pos.copy(p).addScaledVector(right, this.lateral * 0.55).setY(HEIGHT);

    const ahead = this.curve.getPointAt((this.t + dAhead) % 1);
    out.look.copy(ahead).addScaledVector(right, this.lateral * 0.7).setY(0.7);
    return out;
  }

  /**
   * First-person / close chase camera for AR mode. The camera sits tight
   * behind the car so the player sees the road from near the driver's POV.
   * The car stays visible in the lower portion of the frame.
   */
  fpCameraTarget(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const BEHIND = 2.5;   // much closer than the 3D chase cam
    const HEIGHT = 0.9;   // just above the car roof
    const AHEAD  = 5.0;   // look-at well ahead for a sense of speed
    const up = new THREE.Vector3(0, 1, 0);
    const dBack  = BEHIND / this.curveLen;
    const dAhead = AHEAD  / this.curveLen;

    const p   = this.curve.getPointAt((this.t - dBack + 1) % 1);
    const tan = this.curve.getTangentAt(this.t);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    out.pos.copy(p).addScaledVector(right, this.lateral * 0.4).setY(HEIGHT);

    const ahead = this.curve.getPointAt((this.t + dAhead) % 1);
    out.look.copy(ahead).addScaledVector(right, this.lateral * 0.55).setY(0.4);
    return out;
  }

  /** Advance the simulation. dt in seconds. */
  update(dt: number) {
    if (!this.running || this.done) return;
    dt = Math.min(dt, 0.05); // clamp after tab switches

    this.elapsed += dt;

    // --- longitudinal ---
    const boosting = this.elapsed < this.boostUntil;
    const vMax = boosting ? 34 : 26;
    if (this.manual) {
      // throttle accelerates, brake bites hard, everything else is drag
      const drag = 3.2 + this.speed * 0.12 + (this.drifting ? 5.5 : 0);
      const a = this.throttle * 20 - this.braking * 30 - drag;
      this.speed = Math.max(0, Math.min(vMax, this.speed + a * dt));
    } else {
      this.speed += ((boosting ? 34 : 24) - this.speed) * Math.min(1, dt * 1.8);
    }
    const prevT = this.t;
    this.t = (this.t + (this.speed * dt) / this.curveLen) % 1;
    if (prevT > 0.92 && this.t < 0.08) this.lap += 1;

    // --- lateral ---
    // Grip falls away while the handbrake is down, so the same steering input
    // moves the car much further across the road and swings the nose with it.
    const wantGrip = this.drifting && this.speed > 6 ? 0.32 : 1;
    this.grip += (wantGrip - this.grip) * Math.min(1, dt * 6);
    this.steerSmooth += (this.steer - this.steerSmooth) * Math.min(1, dt * 9);

    // 7 m/s at full lock takes about a second to cross half the road, which is
    // steerable. The old 15 crossed the whole road in under 0.6s — the car
    // slammed barrier to barrier and no line could be held.
    const slide = 1 + (1 - this.grip) * 2.6;
    const bite = this.manual ? Math.min(1, 0.25 + this.speed / 18) : 1;
    this.lateral += this.steerSmooth * dt * 7 * slide * bite;

    const wantYaw = -this.steerSmooth * (1 - this.grip) * 0.85;
    this.driftYaw += (wantYaw - this.driftYaw) * Math.min(1, dt * 7);
    if (Math.abs(this.lateral) > LANE_LIMIT) {
      this.lateral = Math.sign(this.lateral) * LANE_LIMIT;
      // Scrubbing the barrier costs speed. Scale by dt, otherwise the penalty
      // is applied per frame and a 120 Hz phone punishes twice as hard.
      this.speed *= Math.pow(0.4, dt);
    }

    // --- place car ---
    this.layoutCar();
    if (this.car) this.car.rotation.z = -this.steerSmooth * 0.13; // lean into the turn

    // --- pickups: exact 2D test on (t, lateral) ---
    for (const p of this.pickups) {
      if (p.alive) {
        let dT = Math.abs(p.t - this.t);
        if (dT > 0.5) dT = 1 - dT;
        const alongMeters = dT * this.curveLen;
        if (alongMeters < 2.0 && Math.abs(p.lateral - this.lateral) < 1.7) {
          p.alive = false;
          p.pop = 0.001;
          this.score += p.points;
          this.groceries += 1;
          // short haptic tick per grocery; longer for the 500pt Blinkit bag
          {
            haptic(p.points >= 500 ? [18, 36, 18] : p.points >= 250 ? 22 : 12);
          }
          this.opts.onPickup?.(p.points, p.name);
        } else {
          p.sprite.position.y = 1.15 + Math.sin(this.elapsed * 3 + p.t * 40) * 0.12;
          p.sprite.material.rotation = Math.sin(this.elapsed * 1.4 + p.t * 20) * 0.14;
        }
      } else if (p.pop > 0) {
        // brief pop-out, then hide
        p.pop += dt;
        const k = Math.min(1, p.pop / 0.26);
        const s = (p.points >= 500 ? 2.6 : 2.0) * (1 + k * 0.7);
        p.sprite.scale.set(s, s, 1);
        p.sprite.material.opacity = 1 - k;
        p.sprite.position.y = 1.15 + k * 1.5;
        if (k >= 1) {
          p.sprite.visible = false;
          p.pop = 0;
        }
      }
    }

    // space props drift and bob, so the circuit sits inside a scene rather
    // than on an empty plane
    for (const pr of this.arProps) {
      pr.mesh.rotation.x += pr.spin.x * dt;
      pr.mesh.rotation.y += pr.spin.y * dt;
      pr.mesh.position.y = pr.baseY + Math.sin(this.elapsed * 0.7 + pr.bobPhase) * 0.6;
    }

    // debris tumbles slowly in zero gravity
    for (const c of this.debris) {
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
    }

    // --- debris: clip one and it shatters ---
    for (const c of this.debris) {
      if (c.broken > 0) {
        // shards fly out, tumble, fall under gravity and fade
        c.broken += dt;
        for (const sh of c.shards) {
          sh.vel.y -= 26 * dt;
          sh.mesh.position.addScaledVector(sh.vel, dt);
          sh.mesh.rotation.x += sh.spin.x * dt;
          sh.mesh.rotation.y += sh.spin.y * dt;
          sh.mesh.rotation.z += sh.spin.z * dt;
          const k = Math.max(0, 1 - c.broken / 1.1);
          sh.mesh.scale.setScalar(k * 0.9 + 0.1);
          if (sh.mesh.position.y < 0.05) sh.vel.y = Math.abs(sh.vel.y) * 0.32;
        }
        if (c.broken > 1.1) {
          for (const sh of c.shards) this.root.remove(sh.mesh);
          c.shards.length = 0;
        }
        continue;
      }
      let dT = Math.abs(c.t - this.t);
      if (dT > 0.5) dT = 1 - dT;
      if (dT * this.curveLen < 1.4 && Math.abs(c.lateral - this.lateral) < 1.2) {
        /* Debris costs you points, not just speed.
           This used to scrub 6% off the speed and shatter the chunk, and that
           was all — no deduction, no penalty event, so no red −100 ever
           appeared. The only thing that ever deducted was the real-world
           obstacle system, which is gone, so hitting debris had become free.
           applyObstacleBounce does the rebound AND reports what was actually
           lost, which is what feeds the score pop. */
        this.shatter(c);
        this.applyObstacleBounce(DEBRIS_PENALTY);
      }
    }

    // --- end conditions ---
    const timeLeft = Math.max(0, this.duration - this.elapsed);
    const progress = Math.min(1, (this.lap + this.t) / this.laps);
    this.opts.onTick?.({
      score: this.score,
      groceries: this.groceries,
      timeLeft,
      lap: Math.min(this.lap + 1, this.laps),
      laps: this.laps,
      progress,
      speedKph: Math.round(this.speed * 3.6),
    });

    if (this.lap >= this.laps) return this.finish(true);
    if (timeLeft <= 0) return this.finish(false);
  }

  private finish(crossed: boolean) {
    if (this.done) return;
    this.done = true;
    this.running = false;
    this.opts.onFinish?.({
      score: this.score,
      groceries: this.groceries,
      seconds: Math.round(this.elapsed),
      finished: crossed,
    });
  }

  dispose() {
    this.root.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) {
        im.dispose();
      }
    });
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.pickups.length = 0;
    for (const c of this.debris) for (const sh of c.shards) this.root.remove(sh.mesh);
    for (const pr of this.arProps) this.propRoot.remove(pr.mesh);
    this.arProps.length = 0;
    this.debris.length = 0;
    this.root.clear();
  }
}
