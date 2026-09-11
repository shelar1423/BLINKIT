/* ============================================================
   Car horn + a couple of race stingers, synthesised with
   WebAudio. No audio files to download, and no autoplay
   problem: the context is created on the first user gesture
   and resumed on every later one.
   ============================================================ */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // iOS suspends the context whenever the page loses focus
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once from a click/tap so iOS unlocks audio for the session. */
export function primeAudio() {
  audio();
}

type ToneOpts = { freq: number; type?: OscillatorType; gain?: number; start?: number; dur: number; slideTo?: number };

function tone({ freq, type = 'sawtooth', gain = 0.2, start = 0, dur, slideTo }: ToneOpts) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  // quick attack, smooth tail — a hard stop clicks
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Two-tone road-car horn. */
export function horn() {
  tone({ freq: 440, gain: 0.17, dur: 0.42 });
  tone({ freq: 554.4, gain: 0.14, dur: 0.42 });
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
}

/** Rising chirp when the handbrake comes on. */
export function skid() {
  tone({ freq: 900, type: 'square', gain: 0.05, dur: 0.26, slideTo: 320 });
}

/** Short, bright note for a grocery pickup. */
export function chime(big = false) {
  tone({ freq: big ? 784 : 659.25, type: 'triangle', gain: 0.12, dur: 0.16 });
  if (big) tone({ freq: 1046.5, type: 'triangle', gain: 0.1, start: 0.09, dur: 0.18 });
}
