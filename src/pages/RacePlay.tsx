import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { HERO_CARS } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
import { useStartRace } from '../lib/useStartRace';
import { createRaceScene, type RaceHandle } from '../lib/three/raceScene';
import { RACE_SECONDS, type BoostQuality, type JumpQuality } from '../lib/raceInteractions';
import { DriftLoader, LOADER_MS } from '../design/components/DriftLoader';
import type { RaceOutcome, RaceStats } from '../lib/three/raceEngine';
import { IconChevronLeft, IconChevronRight, IconClose, IconDrift, IconHorn, IconMute, IconRotate, IconSound } from '../design/elements/Icons';
import { RaceResult } from '../design/components/RaceResult';
import { GateCue } from '../design/components/GateCue';
import { RaceCoach } from '../design/components/RaceCoach';
import { Poppers } from '../design/components/Poppers';
import { ScorePops, useScorePops } from '../design/components/ScorePops';
import { horn as playHorn, primeAudio } from '../lib/horn';
import {
  engineStart,
  engineStop,
  isMuted,
  loadRaceAudio,
  makePowerUpWatcher,
  setMuted,
  stopRaceAudio,
} from '../lib/raceAudio';
import { createTiltSteer, initialTiltState, type TiltState, type TiltSteer } from '../lib/tiltSteer';
import { useToast } from '../App';


export default function RacePlay() {
  const nav = useNavigate();
  const startRace = useStartRace();
  const { toast } = useToast();
  const selectedCarId = useStore((s) => s.selectedCarId);
  const racesLeft = useStore((s) => s.racesLeft);
  const finishRace = useStore((s) => s.finishRace);
  const car = HERO_CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];

  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<RaceHandle | null>(null);
  /* A ref as well as state: the pointer handlers are bound once and read this
     every move, and a captured state value would be the one from the render
     that bound them. */
  const atGate = useRef(false);
  const [gateCue, setGateCue] = useState<{ index: number; k: number } | null>(null);
  const [jumpCue, setJumpCue] = useState(false);
  const [eventFlash, setEventFlash] = useState<{ kind: 'boost' | 'jump'; quality: BoostQuality | JumpQuality; points: number } | null>(null);
  const tilt = useRef<TiltSteer | null>(null);
  const [tiltState, setTiltState] = useState<TiltState>(() => initialTiltState());

  const [pct, setPct] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const mountedAt = useRef(performance.now());
  const [err, setErr] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [stats, setStats] = useState<RaceStats>({
    score: 0, groceries: 0, timeLeft: RACE_SECONDS, lap: 1, laps: 2, progress: 0, speedKph: 0,
  });
  const { pops, push: pushPop } = useScorePops();
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  /* The clock is in bullet time. Only the vignette cares, and only about the
     flip — the engine reports it as a boolean for exactly that reason. */
  const [slowmo, setSlowmo] = useState(false);
  /* The flag has dropped and the paper is in the air. Set about two seconds
     before `outcome`, and never cleared: the confetti's own animation ends it,
     and clearing it would pull the scraps out of the sky mid-arc. */
  const [cheering, setCheering] = useState(false);
  /* Read before finishRace writes the new best, or every run is a personal
     best by the time the result screen asks. */
  const [isBest, setIsBest] = useState(false);
  /* The briefing is up until it is dismissed, and the race does not begin
     until it is: everything it explains is on the screen behind it. */

  // guard: no attempts left
  useEffect(() => {
    if (racesLeft <= 0) {
      toast('No races left today');
      nav('/invite', { replace: true });
    }
  }, [racesLeft, nav, toast]);

  const onPickup = useCallback((points: number) => pushPop(points, 'up'), [pushPop]);
  /* The only thing that deducts in this engine is hitting something, so a
     penalty and an asteroid strike are the same event. */
  /* No sample. There are twenty rocks on the circuit now and clipping one is
     an ordinary part of a lap, not an event: a hit sound on every one of them
     turned the race into percussion. The red number lifting off the car and
     the rock visibly shattering are the feedback. */
  const onPenalty = useCallback((points: number) => pushPop(points, 'down'), [pushPop]);

  /* Announces each 500-point boundary once. Held in a ref so it survives the
     re-renders the score itself causes. */
  const powerUp = useRef(makePowerUpWatcher(500));

  const onFinish = useCallback(
    (o: RaceOutcome) => {
      engineStop();
      setIsBest(o.score > useStore.getState().bestScore);
      finishRace({ score: o.score, groceries: o.groceries, seconds: o.seconds });
      setOutcome(o);
    },
    [finishRace],
  );

  useEffect(() => {
    if (!host.current || !car.glb) return;
    const h = createRaceScene(host.current, {
      onGateCue: (c) => {
        atGate.current = !!c;
        setGateCue(c);
        /* Hold the wheel straight through the gate. The car is being lined up
           on the hoop by the engine; a steering input mid-run-up fights it. */
        if (c) handle.current?.engine.setSteer(0);
      },
      onBoostResult: (r) => {
        atGate.current = false;
        setGateCue(null);
        setEventFlash({ kind: 'boost', quality: r.quality, points: r.points });
        window.setTimeout(() => setEventFlash(null), 1100);
      },
      onBulletTime: setSlowmo,
      /* The celebration starts here, not on `onFinish`. By the time the result
         screen has the score, the moment it is celebrating is two seconds
         gone. */
      onFinishCue: () => setCheering(true),
      onLaunched: () => {
        setLaunched(true);
        engineStart();
      },
      onJumpCue: setJumpCue,
      onJumpResult: (r) => {
        setJumpCue(false);
        setEventFlash({ kind: 'jump', quality: r.quality, points: r.points });
        window.setTimeout(() => setEventFlash(null), 1100);
      },
      glbUrl: car.glb,
      duration: RACE_SECONDS,
      laps: 2,
      onProgress: (p) => setPct(p < 0 ? 0 : p),
      /* Held to a floor of 1.8s. A cached model is ready inside a frame, and a
         loader that appears and vanishes in one reads as a flicker — the point
         of it is to make the entry into a race feel like a moment, not to
         measure how long the file took. */
      onReady: () => {
        const elapsed = performance.now() - mountedAt.current;
        if (elapsed >= LOADER_MS) setLoaded(true);
        else window.setTimeout(() => setLoaded(true), LOADER_MS - elapsed);
      },
      onError: (m) => setErr(m),
      onTick: (st) => {
        setStats(st);
        powerUp.current(st.score);
      },
      onPickup,
      onPenalty,
      onFinish,
    });
    handle.current = h;
    /* Fetched and decoded while the track builds, so GO is not the first time
       anything touches the network. */
    void loadRaceAudio();
    return () => {
      h.dispose();
      handle.current = null;
      /* However this screen was left — finished, quit, or navigated away from
         mid-race — the engine does not keep running behind it. */
      stopRaceAudio();
    };
  }, [car.glb, onPickup, onPenalty, onFinish]);

  /* No countdown. The race starts when the lever does.

     3-2-1-GO asked nothing of the player and left the launcher built into the
     track with no job — the same launcher the AR race is now started from. One
     way into a race, both routes. `engineStart` moves to the release, so the
     engine note lands with the car leaving the line rather than with a number
     hitting zero. */
  /* Keyboard and accessibility fallback: not every player can drag a small
     part in a 3D scene, and the lever must never be the only way in. */
  useEffect(() => {
    if (launched) return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handle.current?.launch(0.75);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [launched]);

  /* ---------- steering ---------- */
  const steerTo = useCallback((clientX: number) => {
    const w = window.innerWidth;
    const v = ((clientX - w / 2) / (w * 0.30));
    handle.current?.engine.setSteer(Math.max(-1, Math.min(1, v)));
  }, []);

  /* Tilt is the primary control. It owns the wheel whenever it is running, and
     the drag/keyboard path below is only wired up as a fallback — on a desktop,
     or where the player declined motion access. Both attached at once would
     fight over setSteer. */
  useEffect(() => {
    const t = createTiltSteer({
      onSteer: (v) => handle.current?.engine.setSteer(v),
      onStateChange: setTiltState,
    });
    tilt.current = t;
    if (t.state === 'active') t.start();
    return () => {
      t.stop();
      tilt.current = null;
    };
  }, []);

  const enableTilt = useCallback(async () => {
    const t = tilt.current;
    if (!t) return;
    const s = await t.enable();
    if (s === 'active') t.start();
  }, []);

  /* 'active' only means permitted — the sensor still has to deliver an event
     before it takes the wheel (see tiltSteer's liveness probe). */
  const tiltDriving = tiltState === 'active';

  useEffect(() => {
    if (tiltDriving) return;               // tilt owns steering; don't double-bind
    const stage = host.current?.parentElement;
    if (!stage) return;
    let holding = false;
    let swipeFrom: number | null = null;
    const down = (e: PointerEvent) => {
      holding = true;
      swipeFrom = e.clientY;
      /* Steering still works through a gate. The engine eases the car back to
         the centreline on its own so it arrives where the hole is, and taking
         the wheel away on top of that would mean the run-up to a gate is also
         the one moment of the lap the player is not driving. */
      steerTo(e.clientX);
    };
    const move = (e: PointerEvent) => {
      /* A swipe up is the lift — the gate's, if a gate is asking, otherwise
         the ramp's. Shorter while a gate is open, because the whole mechanic
         there is WHEN, and a long swipe spends most of its travel deciding
         whether it was one. */
      const swipe = atGate.current ? 26 : 46;
      if (swipeFrom !== null && swipeFrom - e.clientY > swipe) {
        swipeFrom = null;
        handle.current?.jumpNow();
      }
      if (holding) steerTo(e.clientX);
    };
    const up = () => {
      holding = false;
      swipeFrom = null;
      handle.current?.engine.setSteer(0);
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    return () => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [steerTo, tiltDriving]);

  /* Keyboard stays bound whatever is steering. Escape is the keyboard exit from
     a full-screen race, so it must not be a casualty of tilt taking the wheel. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      /* Space was a free boost, which is a cheat rather than a control. It is
         the jump now, alongside the arrow and W, per the brief's fallbacks. */
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') handle.current?.jumpNow();
      if (e.key === 'Escape') nav('/campaign');
      if (tiltDriving) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') handle.current?.engine.setSteer(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') handle.current?.engine.setSteer(1);
    };
    const keyUp = (e: KeyboardEvent) => {
      if (tiltDriving) return;
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) handle.current?.engine.setSteer(0);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
    };
  }, [nav, tiltDriving]);

  /* ---------- handbrake + horn ---------- */
  const [drift, setDrift] = useState(false);
  /* Seeded from the stored preference so the button matches what you will
     actually hear the moment the screen appears. */
  const [mute, setMute] = useState(isMuted);
  const slide = useCallback((on: boolean) => {
    setDrift(on);
    handle.current?.engine.setDrift(on);
  }, []);
  const hornNow = useCallback(() => {
    primeAudio();
    playHorn();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Shift') slide(true);
      if (e.key === 'h') hornNow();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') slide(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [slide, hornNow]);

  const tier = outcome ? tierFor(outcome.score) : null;
  const mm = Math.floor(stats.timeLeft / 60);
  const ss = Math.floor(stats.timeLeft % 60);

  return (
    <div className="stage">
      <div className="stage__canvas" ref={host} />

      {err && (
        <div className="loadbox loadbox--dark" style={{ position: 'absolute', inset: 0 }}>
          <p style={{ color: '#fff' }}>{err}</p>
          <Button variant="outline" type="button" onClick={() => startRace()}>
            Back
          </Button>
        </div>
      )}

      {/* Same hold as the AR launch, so the two routes into a race wait the
          same way — your car sliding round the burnout ring rather than a
          spinner and a percentage. */}
      {!loaded && !err && (
        <DriftLoader suffix={pct > 0 && pct < 100 ? ` · ${pct}%` : undefined} />
      )}

      {loaded && !outcome && (
        <div className="stage__ui">
          <div className="hud__top">
            <div className="hud__c">
              <b className="t-num">{stats.score.toLocaleString('en-IN')}</b>
              <span>POINTS</span>
            </div>
            <div className="hud__c">
              <b className="t-num">{mm}:{String(ss).padStart(2, '0')}</b>
              <span>TIME LEFT</span>
            </div>
            <button className="hud__x" type="button" aria-label="Leave race" onClick={() => nav('/campaign')}>
              <IconClose size={17} />
            </button>
          </div>
          <div className="hud__bar" aria-hidden="true">
            <i style={{ width: `${stats.progress * 100}%` }} />
          </div>

          <ScorePops pops={pops} />

          {/* The same cues the AR race shows, because they are the same three
              moments — only the input differs. */}
          {gateCue && <GateCue k={gateCue.k} canLift={false} />}
          {jumpCue && (
            <div className="arjump">
              <span className="arjump__k">Jump ahead</span>
              <b>Swipe up</b>
            </div>
          )}
          {eventFlash && (
            <p className={'arboost__verdict is-' + eventFlash.quality} aria-live="polite">
              {eventFlash.quality === 'miss'
                ? eventFlash.kind === 'boost'
                  ? 'Missed the ring'
                  : 'No jump'
                : eventFlash.kind === 'boost'
                  ? eventFlash.quality === 'perfect'
                    ? 'Perfect boost'
                    : 'Boost'
                  : eventFlash.quality === 'perfect'
                    ? 'Perfect jump'
                    : 'Jump'}
              {eventFlash.points > 0 && <b>+{eventFlash.points}</b>}
            </p>
          )}

          {/* Not before the car has left the line — the same reasoning as the
              hint below. They are steering affordances, there is nothing to
              steer yet, and the right-hand one sat squarely on the launcher's
              co-brand plate. */}
          {!tiltDriving && launched && (
            <div className="steer__pads" aria-hidden="true">
              <span className="steer__pad"><IconChevronLeft size={22} /></span>
              <span className="steer__pad"><IconChevronRight size={22} /></span>
            </div>
          )}

          {/* The tilt offer used to be a strip here, over the race. It is a
             line in the briefing now — the one screen that exists to explain
             the controls is the right place to offer a different one. */}
          {/* the whole stage is a steering surface, so a tap on these buttons
              must not also register as "steer hard right" */}
          <div className="steer__acts" onPointerDown={(e) => e.stopPropagation()}>
            {tiltDriving && (
              <button
                type="button"
                className="arov__pad arov__pad--sm"
                aria-label="Re-centre tilt steering"
                title="Re-centre"
                onClick={() => {
                  tilt.current?.recalibrate();
                  toast('Tilt re-centred');
                }}
              >
                <IconRotate size={20} />
              </button>
            )}
            <button type="button" className="arov__pad arov__pad--sm" aria-label="Horn" onClick={hornNow}>
              <IconHorn size={22} />
            </button>
            <button
              type="button"
              className={'arov__pad arov__pad--sm' + (mute ? ' is-on' : '')}
              aria-label={mute ? 'Unmute race audio' : 'Mute race audio'}
              aria-pressed={mute}
              onClick={() => {
                primeAudio();
                const next = !mute;
                setMuted(next);
                setMute(next);
              }}
            >
              {mute ? <IconMute size={21} /> : <IconSound size={21} />}
            </button>
            {/* Also held back until the launch. It is the lowest button in the
                column, which put it directly over the back of the launcher —
                the one part of the frame the player is being asked to look at
                and drag. */}
            {launched && <button
              type="button"
              className={'arov__pad arov__pad--sm' + (drift ? ' is-on' : '')}
              aria-label="Drift"
              aria-pressed={drift}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                slide(true);
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                slide(false);
              }}
              onPointerCancel={() => slide(false)}
            >
              <IconDrift size={22} />
            </button>}
          </div>
        </div>
      )}

      {/* The briefing, and after it nothing but the score and the clock. The
          launcher prompt used to live here — two lines pinned over the lower
          third of the frame, which is exactly where the launcher is. What it
          said is in the briefing now, and the chevrons running down over the
          lever carry the reminder without a word. */}
      {/* Until the lever moves, not until it is dismissed. */}
      {loaded && !err && !launched && !outcome && (
        <RaceCoach
          mode="3d"
          tilt={{
            offer: tiltState === 'needs-permission',
            onEnable: () => void enableTilt(),
          }}
        />
      )}

      {slowmo && !outcome && <div className="btime" aria-hidden="true" />}
      {cheering && <Poppers />}

      {outcome && (
        <RaceResult
          outcome={outcome}
          car={car}
          tier={tier}
          isBest={isBest}
          totalPoints={useStore.getState().totalPoints}
          inviteUrl={`${window.location.origin}/?ref=${useStore.getState().referralCode}`}
          racesLeft={useStore.getState().racesLeft}
          toast={toast}
          onRaceAgain={() => window.location.reload()}
          onRewards={() => nav('/rewards')}
          onViewCar={() => nav(`/hot-wheels/${car.id}`)}
          onLeaderboard={() => nav('/leaderboard')}
          onExit={() => nav('/campaign')}
          exitLabel="Campaign"
        />
      )}
    </div>
  );
}
