/* ============================================================
   The image that goes out with a shared score.

   A share that carries only a URL arrives in WhatsApp as a line of grey text.
   The Web Share API takes files, so what gets sent is a rendered result card:
   the car, the score, the branding. It is the difference between "here is a
   link" and "look what I scored".

   Drawn on a canvas rather than shipped as a template, because the score, the
   car and the reward are all different every time.
   ============================================================ */

export type ShareCard = {
  score: number;
  groceries: number;
  seconds: number;
  /** false when the race ended on the clock rather than on lap two */
  finished?: boolean;
  carName: string;
  carImage: string;
  reward?: string;
};

/**
 * The platform the car stands on, as an image. Null draws the placeholder
 * platform, which matches the one on the result screen. Set this when the
 * artwork lands and the card picks it up.
 */
export const PLATFORM_IMAGE: string | null = null;

const W = 1080;
const H = 1350; // 4:5, the aspect messaging apps crop least
const FONT = "'Blinkit Sans', system-ui, sans-serif";

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Load an image for the canvas, or resolve null rather than reject. */
function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

/** The same platform the result screen draws in CSS: lit top face, blue drum. */
function drawPlatform(c: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number) {
  const faceH = h * 0.6;
  // drum shadow
  c.save();
  c.shadowColor = 'rgba(0,20,60,0.45)';
  c.shadowBlur = 50;
  c.shadowOffsetY = 30;
  const drum = c.createLinearGradient(0, top, 0, top + h);
  drum.addColorStop(0, '#0A4FA8');
  drum.addColorStop(1, '#052A5E');
  c.fillStyle = drum;
  c.beginPath();
  c.ellipse(cx, top + faceH / 2, w / 2, faceH / 2, 0, Math.PI, 0);
  c.lineTo(cx + w / 2, top + h - faceH / 2);
  c.ellipse(cx, top + h - faceH / 2, w / 2, faceH / 2, 0, 0, Math.PI);
  c.closePath();
  c.fill();
  c.restore();
  // top face
  const face = c.createRadialGradient(cx, top + faceH * 0.45, 0, cx, top + faceH * 0.45, w * 0.55);
  face.addColorStop(0, '#FFFFFF');
  face.addColorStop(0.55, '#E3EEFF');
  face.addColorStop(1, '#A9C6F2');
  c.fillStyle = face;
  c.beginPath();
  c.ellipse(cx, top + faceH / 2, w / 2, faceH / 2, 0, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 9;
  c.strokeStyle = '#FFE01B';
  c.beginPath();
  c.ellipse(cx, top + faceH / 2, w / 2 - 4.5, faceH / 2 - 4.5, 0, 0, Math.PI * 2);
  c.stroke();
}

/**
 * The shared image: the result screen as a picture — blue ground, the score,
 * the car on its platform, the run's stats, and the challenge.
 */
export async function renderShareCard(d: ShareCard): Promise<Blob | null> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return null;

  // Canvas text does not wait for web fonts; without this the first share
  // after a cold load draws in the fallback face.
  try {
    await Promise.all([document.fonts.load(`900 100px ${FONT}`), document.fonts.load(`700 40px ${FONT}`)]);
  } catch {
    /* fall back to system-ui */
  }

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0077D9');
  g.addColorStop(0.45, '#0062B8');
  g.addColorStop(1, '#003F7D');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  c.textAlign = 'center';
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.font = `800 30px ${FONT}`;
  c.letterSpacing = '6px';
  c.fillText('HOT WHEELS × BLINKIT', W / 2, 96);
  c.letterSpacing = '0px';

  c.fillStyle = '#FFFFFF';
  c.font = `700 52px ${FONT}`;
  c.fillText('Your score', W / 2, 196);
  c.font = `900 230px ${FONT}`;
  c.letterSpacing = '-8px';
  c.fillText(d.score.toLocaleString('en-IN'), W / 2, 410);
  c.letterSpacing = '0px';

  // the car on its platform
  const PW = 640;
  const PH = 256;
  const PTOP = 800;
  const plat = PLATFORM_IMAGE ? await load(PLATFORM_IMAGE) : null;
  if (plat) {
    const ph = (plat.height / plat.width) * PW;
    c.drawImage(plat, (W - PW) / 2, PTOP, PW, ph);
  } else {
    drawPlatform(c, W / 2, PTOP, PW, PH);
  }
  const car = await load(d.carImage);
  if (car) {
    // the shots carry empty ground above and below the car; crop to 1.6:1,
    // as the screen does, so the wheels land on the top face
    const sw = car.width;
    const sh = sw / 1.6;
    const sy = (car.height - sh) / 2;
    const cw = PW * 0.96;
    const ch = cw / 1.6;
    c.save();
    c.shadowColor = 'rgba(0,20,60,0.3)';
    c.shadowBlur = 16;
    c.shadowOffsetY = 12;
    c.drawImage(car, 0, sy, sw, sh, (W - cw) / 2, PTOP + PH * 0.58 - ch, cw, ch);
    c.restore();
  }

  // the run: three stats on a band
  const BY = 1110;
  c.fillStyle = 'rgba(255,255,255,0.12)';
  rounded(c, 90, BY, W - 180, 124, 28);
  c.fill();
  const stats: [string, string][] = [
    [String(d.groceries), 'GROCERIES'],
    [`${d.seconds}s`, 'TIME'],
    [d.finished === false ? 'DNF' : '2/2', 'LAPS'],
  ];
  const colW = (W - 180) / 3;
  stats.forEach(([v, l], i) => {
    const x = 90 + colW * i + colW / 2;
    if (i) {
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fillRect(90 + colW * i, BY + 26, 2, 72);
    }
    c.fillStyle = '#FFFFFF';
    c.font = `800 52px ${FONT}`;
    c.fillText(v, x, BY + 66);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.font = `700 22px ${FONT}`;
    c.letterSpacing = '3px';
    c.fillText(l, x, BY + 100);
    c.letterSpacing = '0px';
  });

  // the challenge
  c.fillStyle = '#FFE01B';
  rounded(c, (W - 520) / 2, 1266, 520, 60, 16);
  c.fill();
  c.fillStyle = '#1F1F1F';
  c.font = `800 32px ${FONT}`;
  c.fillText('Can you beat this?', W / 2, 1307);

  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}

/**
 * Share the score with the card attached.
 *
 * Returns what actually happened, because the three outcomes need different
 * things said about them: the file went, only the link went, or the link was
 * copied because there is no share sheet at all.
 */
export async function shareScore(d: ShareCard, url: string): Promise<'file' | 'link' | 'copied' | 'cancelled'> {
  /* The link goes in the TEXT, not only in `url`. Every platform that accepts a
     file drops the separate url field, so a share with the card attached was
     arriving with no way to actually come and play — which is the entire point
     of sending it. Passing `url` as well is still worth it on the link-only
     path, where it previews properly. */
  const text =
    `I scored ${d.score.toLocaleString('en-IN')} in Race It Home on Blinkit. Beat my score! ` +
    `Race here and we both get a free race: ${url}`;

  try {
    const blob = await renderShareCard(d);
    if (blob && navigator.share) {
      const file = new File([blob], 'race-it-home.png', { type: 'image/png' });
      /* canShare must be asked about the actual file: a browser can have
         navigator.share and still refuse attachments. */
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'Race It Home' });
        return 'file';
      }
    }
    if (navigator.share) {
      await navigator.share({ text, url, title: 'Race It Home' });
      return 'link';
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch (e) {
    // the user dismissing the sheet is not a failure
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return 'copied';
    } catch {
      return 'cancelled';
    }
  }
}
