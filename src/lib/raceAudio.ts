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

function bus(): GainNode | null {
  const ac = raceAudioContext();
  if (!ac) return null;
  if (!master || master.context !== ac) {
    master = ac.createGain();
    master.gain.value = 1;
    master.connect(ac.destination);
  }
  return master;
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
}
