import * as THREE from 'three';

/**
 * Galaxy backdrop as a 2:1 equirectangular canvas texture — stars plus amber and
 * cyan nebula. Warm/cool only: no violet, so the skybox stays inside the
 * campaign palette rather than reintroducing the colour we spent the rebrand
 * removing.
 */
export function starfieldTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const x = c.getContext('2d')!;
  x.fillStyle = '#04060B';
  x.fillRect(0, 0, 2048, 1024);

  const cloud = (cx: number, cy: number, r: number, col: string, a: number) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col.replace('ALPHA', String(a)));
    g.addColorStop(0.55, col.replace('ALPHA', String(a * 0.35)));
    g.addColorStop(1, col.replace('ALPHA', '0'));
    x.fillStyle = g;
    x.fillRect(0, 0, 2048, 1024);
  };
  cloud(520, 430, 620, 'rgba(255,140,40,ALPHA)', 0.26);
  cloud(1380, 560, 540, 'rgba(30,120,225,ALPHA)', 0.24);
  cloud(980, 260, 420, 'rgba(255,90,25,ALPHA)', 0.14);
  cloud(1750, 300, 380, 'rgba(90,190,255,ALPHA)', 0.14);
  cloud(240, 760, 360, 'rgba(255,190,80,ALPHA)', 0.10);

  // star field, mostly faint with a few bright ones
  for (let i = 0; i < 5200; i++) {
    const a = Math.pow(Math.random(), 2.2);
    x.fillStyle = `rgba(255,255,255,${a})`;
    x.fillRect(Math.random() * 2048, Math.random() * 1024, a > 0.85 ? 2 : 1, a > 0.85 ? 2 : 1);
  }
  // a handful of warm giants
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * 2048;
    const py = Math.random() * 1024;
    const g = x.createRadialGradient(px, py, 0, px, py, 7);
    g.addColorStop(0, 'rgba(255,236,200,0.95)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(px - 8, py - 8, 16, 16);
  }

  return new THREE.CanvasTexture(c);
}
