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
  carName: string;
  carImage: string;
  reward?: string;
};

const W = 1080;
const H = 1350; // 4:5, the aspect messaging apps crop least

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

export async function renderShareCard(d: ShareCard): Promise<Blob | null> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return null;

  // ground: the campaign's pit-lane navy
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#122343');
  g.addColorStop(0.55, '#0C1730');
  g.addColorStop(1, '#070E1E');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // chequered flag band across the top
  const sq = 30;
  for (let x = 0; x < W / sq; x++) {
    for (let y = 0; y < 2; y++) {
      c.fillStyle = (x + y) % 2 ? '#FFFFFF' : '#101828';
      c.fillRect(x * sq, y * sq, sq, sq);
    }
  }

  c.textAlign = 'center';

  c.fillStyle = '#FF5A3C';
  c.font = '800 34px system-ui, sans-serif';
  c.letterSpacing = '6px';
  c.fillText('HOT WHEELS × BLINKIT', W / 2, 150);
  c.letterSpacing = '0px';

  /* The car is fitted into a fixed band rather than scaled off its width. The
     catalogue shots are square, so sizing by width alone made a 760px-tall car
     that ran straight through the score beneath it. */
  const BAND = { top: 195, h: 520, w: 720 };
  const car = await load(d.carImage);
  if (car) {
    const k = Math.min(BAND.w / car.width, BAND.h / car.height);
    const cw = car.width * k;
    const ch = car.height * k;
    const cx = (W - cw) / 2;
    const cy = BAND.top + (BAND.h - ch) / 2;
    const glow = c.createRadialGradient(W / 2, BAND.top + BAND.h / 2, 10, W / 2, BAND.top + BAND.h / 2, BAND.w / 2);
    glow.addColorStop(0, 'rgba(90,160,255,0.34)');
    glow.addColorStop(1, 'rgba(90,160,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, BAND.top - 30, W, BAND.h + 60);
    c.drawImage(car, cx, cy, cw, ch);
  }

  // the score, which is the whole point of the card
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.font = '700 30px system-ui, sans-serif';
  c.letterSpacing = '8px';
  c.fillText('FINAL SCORE', W / 2, 790);
  c.letterSpacing = '0px';

  c.fillStyle = '#FFC400';
  c.font = '800 190px system-ui, sans-serif';
  c.fillText(d.score.toLocaleString('en-IN'), W / 2, 950);

  c.fillStyle = '#FFFFFF';
  c.font = '700 40px system-ui, sans-serif';
  c.fillText(d.carName, W / 2, 1020);

  // two stats, side by side on pills
  const pill = (x: number, label: string, value: string) => {
    c.fillStyle = 'rgba(255,255,255,0.08)';
    rounded(c, x, 1075, 420, 110, 26);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.font = '800 52px system-ui, sans-serif';
    c.fillText(value, x + 210, 1132);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '700 24px system-ui, sans-serif';
    c.fillText(label, x + 210, 1166);
  };
  pill(90, 'GROCERIES', String(d.groceries));
  pill(570, 'SECONDS', String(d.seconds));

  c.fillStyle = d.reward ? '#39D353' : 'rgba(255,255,255,0.5)';
  c.font = '700 30px system-ui, sans-serif';
  c.fillText(d.reward ? `Unlocked: ${d.reward}` : 'Race It Home · beat this', W / 2, 1265);

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
    `I scored ${d.score.toLocaleString('en-IN')} in Race It Home · Hot Wheels × Blinkit. ` +
    `Beat it. You get a free race for joining: ${url}`;

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
