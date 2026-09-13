import { raceAudioContext } from './horn';

/* ============================================================
   The race's three recorded sounds.

   horn.ts synthesises its tones, which is right for a horn — no file, no
   decode, no wait. These three are recordings, so they are fetched once,
   decoded once, and played from memory afterwards. Played through WebAudio
   rather than <audio> elements for two reasons: overlapping one-shots need a
   new source node per play (an <audio> element restarted mid-sound cuts the
   previous one off), and the engine loop has to be gapless, which
   AudioBufferSourceNode.loop gives and an <audio> loop does not.

   Everything here is a no-op until the buffers arrive and fails soft: a race
   with no sound is still a race, so nothing in this file may throw into the
   game loop.
   ============================================================ */

const SOURCES = {
  engine: '/audio/engine-gt40.mp3',
  hit: '/audio/hit.mp3',
  powerUp: '/audio/power-up.mp3',
} as const;

type Name = keyof typeof SOURCES;

const buffers = new Map<Name, AudioBuffer>();
let loading: Promise<void> | null = null;

/** Master gain, so the whole race can be ducked or silenced in one place. */
let master: GainNode | null = null;
/** Everything leaves through here, so bullet time can close the room down. */
let tone: BiquadFilterNode | null = null;

/* ---- bullet time ----

   The race slows on the approach to a boost gate, and the sound has to go with
   it or the slow motion reads as a dropped frame rate. Two things move:

   - `playbackRate` on the engine loop. It is an AudioParam, so it ramps rather
     than steps, and a ramped rate on a looping buffer is the one way to pitch
     a running engine down without restarting the sample.
   - A lowpass over the whole bus. Pitch alone sounds like a flat battery;
     pitch plus the top end rolling off sounds like the world thickening, which
     is what the effect is imitating.

   The rate never follows the clock all the way down — the race runs at 0.3 in
   bullet time, and an engine at 0.3x is a dying growl nobody reads as a car.
   It lands around 0.7, about six semitones, which is unmistakably slower and
   still unmistakably an engine. */
const OPEN_HZ = 18000;
const MUFFLED_HZ = 820;
/** The last scale actually applied, so a per-frame caller costs nothing. */
let toneScale = 1;
/** What a one-shot fired right now should be played at. */
let rateNow = 1;

/* Remembered across races and across visits. Somebody who turned the engine
   off once did not mean "off for this race". */
const MUTE_KEY = 'hw-race-muted';
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

function bus(): GainNode | null {
  const ac = raceAudioContext();
  if (!ac) return null;
  if (!master || master.context !== ac) {
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    /* Gain first, filter second. The mute ramp has to reach zero whatever the
       filter is doing, and a filter after the gain can only ever take away
       from it. */
    tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = OPEN_HZ;
    tone.Q.value = 0.55;
    master.connect(tone).connect(ac.destination);
    toneScale = 1;
    rateNow = 1;
  }
  return master;
}

export function isMuted() {
  return muted;
}

/**
 * Silence everything, or bring it back.
 *
 * Done on the master gain rather than by stopping the sources: the engine is a
 * loop with a fade at both ends, and tearing it down and rebuilding it on a
 * toggle would restart the sample from its opening rev every time. Muting the
 * bus leaves the race running underneath and simply stops it reaching the
 * speaker, so unmuting drops you back into the engine where it actually is.
 */
export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* a private window can refuse to remember; the toggle still works */
  }
  const ac = raceAudioContext();
  const out = bus();
  if (!ac || !out) return;
  const t = ac.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(out.gain.value, t);
  // a short ramp, because cutting a running loop to zero in one sample clicks
  out.gain.linearRampToValueAtTime(next ? 0 : 1, t + 0.08);
}

/**
 * Follow the race's clock, where 1 is full speed.
 *
 * Called every frame by the engine, so it has to be cheap when nothing has
 * changed — the early return is the whole reason this takes a raw scale rather
 * than an on/off flag. Ramped, never stepped: a `playbackRate` assigned
 * outright on a running loop is audible as a click, and a filter cutoff jumped
 * from 18 kHz to 820 Hz is audible as a thump.
 */
export function setAudioTimeScale(k: number) {
  const scale = Math.max(0.05, Math.min(1, k));
  if (Math.abs(scale - toneScale) < 0.01) return;
  toneScale = scale;
  /* 0.55 + 0.45k: full speed is 1.0 exactly, and the deepest the race ever
     goes lands at about 0.69. Kept as a stated floor rather than as the clock
     itself for the reason in the note above. */
  rateNow = 0.55 + 0.45 * scale;
  const ac = raceAudioContext();
  if (!ac || !bus()) return;
  const t = ac.currentTime;
  const glide = 0.09;
  if (engine) {
    try {
      const r = engine.src.playbackRate;
      r.cancelScheduledValues(t);
      r.setValueAtTime(r.value, t);
      r.linearRampToValueAtTime(rateNow, t + glide);
    } catch {
      /* a source already stopped has no rate left to ramp */
    }
  }
  if (tone) {
    /* Exponential in Hz, because pitch is: a linear sweep spends most of its
       time in the top two octaves, where the ear hears almost nothing move. */
    const hz = MUFFLED_HZ * Math.pow(OPEN_HZ / MUFFLED_HZ, scale);
    tone.frequency.cancelScheduledValues(t);
    tone.frequency.setValueAtTime(Math.max(40, tone.frequency.value), t);
    tone.frequency.exponentialRampToValueAtTime(hz, t + glide);
  }
}

/**
 * Fetch and decode all three. Safe to call repeatedly — the work happens once
 * and later callers await the same promise.
 */
export function loadRaceAudio(): Promise<void> {
  if (loading) return loading;
  const ac = raceAudioContext();
  if (!ac) return Promise.resolve();
  loading = Promise.all(
    (Object.keys(SOURCES) as Name[]).map(async (name) => {
      try {
        const res = await fetch(SOURCES[name]);
        if (!res.ok) return;
        buffers.set(name, await ac.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* A sound that will not load is a sound the race goes without. */
      }
    }),
  ).then(() => undefined);
  return loading;
}

/* `loop` is set BEFORE start(), not after. Changing it on a playing source
   happens to work, but it leaves the node's first moments in a state that does
   not match its intent — and nothing observing the graph can tell a loop from
   a one-shot. Configure, then start. */
function play(name: Name, gain: number, loop = false) {
  const ac = raceAudioContext();
  const out = bus();
  const buf = buffers.get(name);
  if (!ac || !out || !buf) return null;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  /* A one-shot fired during bullet time is part of the same world as the
     engine note, so it starts at the same rate. Set before start(), like
     `loop` and for the same reason. */
  src.playbackRate.value = rateNow;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(amp).connect(out);
  src.start();
  return { src, amp };
}

/** Hitting an asteroid. */
export function playHit() {
  play('hit', 0.85);
}

/** Crossing another 500 points. */
export function playPowerUp() {
  play('powerUp', 0.7);
}

let engine: { src: AudioBufferSourceNode; amp: GainNode } | null = null;

/**
 * The engine, running for as long as the car is driving.
 *
 * Faded in rather than started at full: the recording opens on the car already
 * under power, and cutting straight to that on the GO frame reads as a glitch
 * rather than as a car pulling away.
 */
export function engineStart() {
  if (engine) return;
  const ac = raceAudioContext();
  const started = play('engine', 0.0001, true);
  if (!ac || !started) return;
  started.amp.gain.exponentialRampToValueAtTime(0.55, ac.currentTime + 0.5);
  engine = started;
}

/** Fade out and stop. A hard stop on a looping sample clicks. */
export function engineStop() {
  const running = engine;
  engine = null;
  if (!running) return;
  const ac = raceAudioContext();
  if (!ac) {
    try {
      running.src.stop();
    } catch {
      /* already stopped */
    }
    return;
  }
  const t = ac.currentTime;
  try {
    running.amp.gain.cancelScheduledValues(t);
    running.amp.gain.setValueAtTime(Math.max(0.0001, running.amp.gain.value), t);
    running.amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    running.src.stop(t + 0.3);
  } catch {
    /* a source that never started cannot be stopped */
  }
}

/**
 * Fires playPowerUp once for each 500-point boundary the score has crossed.
 *
 * Driven by the score rather than by a timer, and it remembers the last
 * boundary it announced rather than testing `score % 500`: the score arrives
 * as whatever the tick happened to sample, so an exact multiple is never
 * guaranteed to be seen, and a single pickup can carry the player past a
 * boundary — or past two at once, which should still only be one sound.
 */
export function makePowerUpWatcher(step = 500) {
  let announced = 0;
  return (score: number) => {
    const reached = Math.floor(Math.max(0, score) / step);
    if (reached > announced) {
      announced = reached;
      playPowerUp();
    }
  };
}

/** Everything off — for unmount, whichever way the race ended. */
export function stopRaceAudio() {
  engineStop();
  /* The next race opens at full speed. The filter and the rate outlive any one
     race — they live on the bus and in a module — so a race abandoned mid
     bullet-time would otherwise hand the next one a muffled world. */
  toneScale = 1;
  rateNow = 1;
  const ac = raceAudioContext();
  if (ac && tone) {
    const t = ac.currentTime;
    tone.frequency.cancelScheduledValues(t);
    tone.frequency.setValueAtTime(OPEN_HZ, t);
  }
}
