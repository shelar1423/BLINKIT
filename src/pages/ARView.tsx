import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../design/elements';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
import { useStartRace } from '../lib/useStartRace';
import {
  detectAR,
  startARSession,
  startCameraSession,
  canAutoStart,
  type ARHandle,
  type ARPhase,
  type ARSupport,
} from '../lib/three/arSession';
import type { RaceOutcome, RaceStats } from '../lib/three/raceEngine';
import {
  IconAR, IconArrowLeft, IconClose, IconFlag, IconInfo, IconMinus, IconPlus, IconRotate,
} from '../design/elements/Icons';
import { useToast } from '../App';
import { RaceResult } from '../design/components/RaceResult';
import { GateCue } from '../design/components/GateCue';
import { SteerCue } from '../design/components/SteerCue';
import { RaceCoach } from '../design/components/RaceCoach';
import { LaunchCount, useLaunchCount } from '../design/components/LaunchCount';
import { ARIntro, arIntroSeen, markARIntroSeen } from '../design/components/ARIntro';
import { clearARSurfaces } from '../lib/three/arSurfaces';
import { Poppers } from '../design/components/Poppers';
import { RACE_SECONDS, type BoostQuality, type JumpQuality } from '../lib/raceInteractions';
import {
  engineStart,
  engineStop,
  loadRaceAudio,
  makePowerUpWatcher,
  playPowerUp,
  stopRaceAudio,
} from '../lib/raceAudio';
import { ScorePops, useScorePops } from '../design/components/ScorePops';
import { AR_LOADER_LINES, DriftLoader, LOADER_MS, TrackRing } from '../design/components/DriftLoader';
import { createTiltSteer, initialTiltState, type TiltState, type TiltSteer } from '../lib/tiltSteer';

/** Coverage at which the surface is considered read well enough to brief on. */

export default function ARView() {
  const { id } = useParams();
  const nav = useNavigate();
  const startRace = useStartRace();
  const { toast } = useToast();
  const selectedCarId = useStore((s) => s.selectedCarId);
  const selectCar = useStore((s) => s.selectCar);
  const finishRace = useStore((s) => s.finishRace);
  const racesLeft = useStore((s) => s.racesLeft);
  const grantExtraRace = useStore((s) => s.grantExtraRace);

  const car = HERO_CARS.find((c) => c.id === (id ?? selectedCarId)) ?? HERO_CARS[0];

  const overlay = useRef<HTMLDivElement>(null);
  const handle = useRef<ARHandle | null>(null);

  const [support, setSupport] = useState<ARSupport | null>(null);
  /* One question, asked once: can this device do AR at all? Everything that
     used to branch on the three support kinds branches on this instead. */
  const arWorks = support?.kind === 'webxr' || support?.kind === 'camera';
  const arKnown = support !== null;
  const [search] = useSearchParams();
  /* "View in your space" on the product page means look at the car, not race
     it. The race entry point passes no mode and still gets the circuit. */
  const inspect = search.get('mode') === 'inspect';
  /* Set by the screens whose button already said "view in your space" — the
     choice was made there, so this screen should not ask again. */
  const autoStart = search.get('go') === '1';
  /* The first AR session on this device gets the three beats first. `?intro=1`
     brings them back for a demo; the car viewer never shows them, because
     looking at a car is not the thing that needs explaining. */
  const [intro, setIntro] = useState(() => search.get('intro') === '1' || !arIntroSeen());
  const triedAuto = useRef(false);
  const [coached, setCoached] = useState(false);
  const [phase, setPhase] = useState<ARPhase | null>(null);
  const [busy, setBusy] = useState(false);
  /* Announces each 500-point boundary once; a ref so it outlives the renders
     the score causes. */
  const powerUp = useRef(makePowerUpWatcher(500));
  const [stats, setStats] = useState<RaceStats | null>(null);
  /* Laying the circuit out can take a beat on a slow phone. Without a signal
     the button just went quiet and people pressed it again. Only shown if the
     drop actually takes longer than a frame or two — a fast placement never
     flashes a spinner. */
  const [placing, setPlacing] = useState(false);
  /** Safety net for a build that never reports back; cleared on every press. */
  const placeGuard = useRef(0);
  /* Twelve seconds pointing at the floor without placing anything means it is
     not going where they want. Rather than leave them guessing, say the thing
     that actually works — leaving and re-entering gives the camera a clean
     start, which is why the second attempt always behaved. */
  const [stuck, setStuck] = useState(false);
  /* What the briefing line says. The scan keeps refining every frame, so the
     live count ticks 126, 124, 131… while you are trying to read the sentence
     it sits in — which reads as broken rather than as live. The number is
     latched the moment the surface is read: the line is a briefing, given
     once, not a meter. Collision detection goes on using the live map. */
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  /* Set when a session has ended with nothing left to show, so the screen can
     take itself off rather than fall back to the gate underneath. */
  const [leave, setLeave] = useState(false);
  /* The clock is in bullet time — the boost approach, then the finish outro. */
  const [slowmo, setSlowmo] = useState(false);
  /* The flag has dropped and the paper is in the air. Set about two seconds
     ahead of `outcome` and never cleared: the confetti ends itself. */
  const [cheering, setCheering] = useState(false);
  /* The briefing, shown the moment the circuit is on the table. Reset on every
     placement, so re-placing a track re-explains it. */
  /* Read before finishRace writes the new best, or every run is a personal
     best by the time the result screen asks. */
  const [isBest, setIsBest] = useState(false);
  const { pops, push: pushPop } = useScorePops();
  const [lastHitMessage, setLastHitMessage] = useState<string | null>(null);

  /* The support check, with a stop on it.
   *
   * `pendingAuto` covers the screen with the loader while `support` is still
   * null, so a probe that never settles — `isSessionSupported` can sit there
   * on some Android builds, and a rejected promise resolves nothing — is a
   * loader that never ends. After four seconds the answer is taken to be no,
   * which is the answer that still leads somewhere: the 3D race. */
  useEffect(() => {
    let settled = false;
    const done = (s: ARSupport) => {
      if (settled) return;
      settled = true;
      setSupport(s);
    };
    detectAR().then(done, () => done({ kind: 'unsupported', reason: 'The AR check failed' }));
    const id = window.setTimeout(() => done({ kind: 'unsupported', reason: 'The AR check timed out' }), 4000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => () => handle.current?.end(), []);

  useEffect(() => {
    if (!leave) return;
    /* Unless the race finished: the result screen is mounted over the top and
       ends the session itself, and that end is not an exit. */
    if (outcome) {
      setLeave(false);
      return;
    }
    /* The viewer came from a product page and goes back to it; a race came
       from the campaign and goes home. */
    if (inspect) nav(-1);
    else nav('/');
  }, [leave, outcome, inspect, nav]);

  /* Close the session the moment the page goes away.

     A phone that sleeps or a browser that is closed does not unmount this
     screen: the canvas and the camera's video are on document.body, outside
     React, so they survive with the camera light still on. Coming back, the
     browser can restore an earlier screen — and the AR canvas is still there,
     drawing the circuit over a product page.

     `pagehide` covers the tab being closed or put away; `visibilitychange`
     covers the app being backgrounded, which on iOS suspends the camera
     anyway, so there is nothing to keep alive. The race cannot continue
     through either, and the session's own `onEnd` puts this screen back to
     its placement state. */
  useEffect(() => {
    const drop = () => {
      handle.current?.end();
      handle.current = null;
      clearARSurfaces();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') drop();
    };
    window.addEventListener('pagehide', drop);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', drop);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  /* Fetched and decoded while the gate is still on screen, so the first frame
     of a race is not also the first network request for its sound. */
  useEffect(() => {
    void loadRaceAudio();
    return () => stopRaceAudio();
  }, []);

  const onFinish = useCallback(
    (o: RaceOutcome) => {
      /* Explicitly, because this sets the phase directly rather than through
         onPhase — so the handler that would otherwise cut the engine never
         sees the race end. */
      engineStop();
      setIsBest(o.score > useStore.getState().bestScore);
      finishRace({ score: o.score, groceries: o.groceries, seconds: o.seconds });
      setOutcome(o);
      /* Close the session on finish. Previously only `outcome` was set, so the
         camera kept running and the whole driving overlay — track size, "Circuit
         placed!", Start race — stayed mounted underneath the result, with the
         headline colliding with the car chip. */
      handle.current?.end();
      handle.current = null;
      setPhase(null);
      setStats(null);
    },
    [finishRace],
  );

  const launch = useCallback(async (silent = false) => {
    if (!car.glb || !overlay.current) return;
    const startedAt = performance.now();
    setBusy(true);
    try {
      const start = support?.kind === 'webxr' ? startARSession : startCameraSession;
      handle.current = await start({
        glbUrl: car.glb,
        overlayRoot: overlay.current,
        trackSize: 2.4,
        mode: inspect ? 'inspect' : 'race',
        /* The engine runs while the car is driving and not before: in AR the
           gap between opening the camera and actually racing is the whole
           placement step, which can be many seconds of pointing at the floor. */
        onPhase: (p) => {
          setPhase(p);
          // the track is down (or the session moved on): the build is over
          if (p !== 'ready') setPlacing(false);
          /* Fresh briefing each time a circuit goes down: re-placing a track
             is the one moment somebody is most likely to want it again. */
          if (p === 'placed') setCoached(false);
          if (p === 'racing') engineStart();
          else engineStop();
        },
        onTick: (st) => {
          setStats(st);
          powerUp.current(st.score);
        },
        /* AR was throwing pickups away entirely — the score moved and nothing
           on screen said why. */
        onPickup: (points) => pushPop(points, 'up'),
        onGateCue: setGateCue,
        onJumpCue: (open, canLift) => {
          setJumpCue(open);
          setCanLift(canLift);
          if (!open) setLiftK(0);
        },
        onJumpLift: setLiftK,
        onPull: setPull,
        onJumpResult: (r) => {
          setJumpCue(false);
          setJumpFlash(r);
          if (r.points > 0) {
            pushPop(r.points, 'up');
            playPowerUp();
          }
          window.setTimeout(() => setJumpFlash(null), 1100);
        },
        onBoostResult: (r) => {
          setGateCue(null);
          setBoostFlash(r);
          if (r.points > 0) {
            pushPop(r.points, 'up');
            playPowerUp();
          }
          window.setTimeout(() => setBoostFlash(null), 1100);
        },
        onPenalty: (points) => pushPop(points, 'down'),
        onBulletTime: setSlowmo,
        onFinishCue: () => setCheering(true),
        onFinish,
        onError: (m) => toast(m),
        onObstacleHit: (hit) => {
          const msg =
            hit.type === 'room'
              ? 'Hit something real (-100)'
              : hit.type === 'cv_detected'
                ? '⚠️ Real Object Hit! (-100 pts)'
                : '📦 Pinned Hazard Hit! (-100 pts)';
          setLastHitMessage(msg);
          toast(msg);
          setTimeout(() => setLastHitMessage(null), 2200);
        },
        onEnd: () => {
          engineStop();
          setPhase(null);
          setStats(null);
          setPlacing(false);
          handle.current = null;
          /* However the session ended — the headset's own exit, the system
             taking the camera, a tab losing focus — there is nothing behind it
             worth showing. The gate screen is a chooser, and the flow does not
             choose any more. The result screen is the one exception: it is
             mounted over the top and ends the session itself. */
          setLeave(true);
        },
      });
    } catch (e) {
      /* A silent attempt is the automatic one. Safari will only open a camera
         from a gesture in the current document, and the tap that got us here
         happened in the previous one — so this failing is expected, not an
         error to report. The gate is already rendered underneath; letting the
         user see it is the whole fallback. */
      if (silent) return;
      const msg = e instanceof Error ? e.message : 'AR could not start';
      toast(msg.includes('denied') || msg.includes('NotAllowed') ? 'Camera permission was denied' : msg);
      setPhase(null);
      /* And then the 3D race, which is the same race. Showing the gate instead
         put a second button in front of somebody whose first one had just
         failed, with no way of knowing the other option even works. Not for
         the car viewer: "view in your space" has no 3D equivalent to fall
         through to, and its own screen is where it belongs. */
      if (!inspect) startRace({ force3d: true, skipStanding: true });
    } finally {
      /* Held to a floor of 1.8s. A session that opens in 200ms would otherwise
         flash the loader for four frames, which reads as a glitch — and the
         point of it is to cover the wait, not to measure it. */
      const elapsed = performance.now() - startedAt;
      if (elapsed < LOADER_MS) await new Promise((r) => setTimeout(r, LOADER_MS - elapsed));
      setBusy(false);
    }
  }, [car.glb, onFinish, toast, support, inspect, startRace]);

  /* Arriving with ?go=1 means the tap that got here already said "view in your
     space", so open the camera rather than showing a second button with the
     same words on it.

     Except on a first visit on iOS. Motion access is only granted from inside a
     user gesture, and an effect on mount has none — asking there does not fail
     quietly, it leaves the session with no gyro at all, so the camera never
     tilts, the reticle sits pinned to the bottom edge of the frame, and nothing
     can be aimed or tapped into place. That is exactly the "works the second
     time" symptom: by then the permission has been granted through a real tap
     and is remembered. So when the grant is not already in hand, the button
     stays and its tap carries both permissions. */
  /* No AR on this device: do not sit on a screen whose only button is
     disabled. Say so once and hand the player the 3D race, which is the same
     race. Only on the racing route — the product page's inspect view has its
     own way back. */
  useEffect(() => {
    if (!arKnown || arWorks || inspect) return;
    toast('This device does not support AR. Playing in 3D instead.');
    selectCar(car.id);
    /* force3d, and it has to be. startRace picks AR whenever the device
       claims to support it, so bailing out of AR without saying so sends the
       player straight back into AR and round again. */
    startRace({ force3d: true, skipStanding: true });
  }, [arKnown, arWorks, inspect, toast, selectCar, car.id, nav]);

  useEffect(() => {
    if (!autoStart || triedAuto.current) return;
    if (intro && !inspect) return;
    if (!arWorks) return;
    if (!car.glb || !overlay.current || handle.current) return;
    if (!canAutoStart()) return;
    triedAuto.current = true;
    void launch(true);
  }, [autoStart, arWorks, car.glb, intro, inspect, launch]);

  useEffect(() => {
    if (phase !== 'ready') {
      setStuck(false);
      return;
    }
    const t = window.setTimeout(() => setStuck(true), 12000);
    return () => window.clearTimeout(t);
  }, [phase]);

  /* ---------- driving while racing in AR ---------- */
  /* Tilt steering, same module the 3D race uses. In AR it matters more: you are
     already holding the phone up at the scene, so reaching for on-screen pads
     means taking a hand off the thing you are aiming. Motion permission is
     already granted by this point — the camera session requests it during
     launch — so there is no second prompt here. */
  const tilt = useRef<TiltSteer | null>(null);
  const [, setTiltState] = useState<TiltState>(() => initialTiltState());

  useEffect(() => {
    if (phase !== 'racing') return;
    const t = createTiltSteer({
      onSteer: (v) => handle.current?.setSteerLane(v),
      onStateChange: setTiltState,
    });
    tilt.current = t;
    // the AR launch flow has already raised the iOS motion prompt
    void t.enable().then((st) => {
      if (st === 'active') t.start();
    });
    return () => {
      t.stop();
      tilt.current = null;
    };
  }, [phase]);

  /* The briefing holds the scene. Without this the car idles behind the
     overlay and a tap on the dim reaches the canvas underneath, which starts
     the race while the player is still reading how to drive it. */
  useEffect(() => {
    handle.current?.setHeld(phase === 'placed' && !coached && !inspect);
  }, [phase, coached, inspect]);

  /* The car drives itself. With the on-screen pads gone nothing ever calls
     setThrottle, so the engine stays in the self-driving mode the 3D race
     uses — the only input is the tilt, plus the lift or swipe for jumps. */

  /* The steering guide stops the race while it plays. It appears a second
     after the launch and takes about four and a half seconds; the car stands
     still for exactly that, so the guide is read instead of raced through. */
  const holdForCue = useCallback((held: boolean) => {
    const e = handle.current?.engine;
    if (!e) return;
    if (held) {
      e.pause();
      /* And the engine note with it. A car standing still under a guide while
         it is still revving is the one thing that gives the pause away as a
         bug rather than a beat. It fades rather than cutting, and fades back
         in on the far side, so the hold reads as the race taking a breath. */
      engineStop();
    } else {
      e.resume();
      engineStart();
    }
  }, []);

  const press = useCallback((dir: number) => handle.current?.setSteer(dir), []);
  const release = useCallback(() => handle.current?.setSteer(0), []);

  /* Keyboard stays for testing on a laptop: arrows steer, up or space jumps. */
  useEffect(() => {
    if (phase !== 'racing') return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') press(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') press(1);
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') handle.current?.jumpNow();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) release();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
    };
  }, [phase, press, release]);

  /* How far the launcher is drawn back, 0..1 — reported by the scene.

     This used to be driven by a lever pinned to the left of the screen, with
     its own pointer capture, its own travel constant and its own tap-to-launch
     shortcut. The lever lives in the track now, so the overlay has nothing to
     drive: it only paints what the real one is doing. The refs that fixed the
     old widget's launch-inside-a-setState bug went with it, since there is no
     longer a React handler in the path at all. */
  const [pull, setPull] = useState(0);

  /* The start line, same as the 3D race: 3, 2, 1, GO off the sled being drawn
     back, and GO fires the launcher whether or not the thumb has left it. */
  const count = useLaunchCount({
    pull,
    launched: phase === 'racing',
    onGo: (power) => handle.current?.launch(power),
    onArm: (on) => handle.current?.startLine(on),
  });


  /* The gate being approached, and the verdict once it is behind us. */
  const [gateCue, setGateCue] = useState<{ index: number; k: number; canLift: boolean } | null>(null);
  const [boostFlash, setBoostFlash] = useState<{ index: number; quality: BoostQuality; points: number } | null>(null);
  const [jumpCue, setJumpCue] = useState(false);
  const jumpSwipeFrom = useRef<number | null>(null);
  const [jumpFlash, setJumpFlash] = useState<{ quality: JumpQuality; points: number } | null>(null);

  /* What to tell them to do.
     This used to guess from the device KIND, which was wrong: a phone that has
     a camera but no motion permission reports `camera` and cannot detect a
     lift at all — so the cue said "Lift the phone", the tilt was invisible to
     us, and every jump came back "No lift" with nothing to explain why. The
     session now reports whether pitch is actually arriving, and the cue only
     asks for a lift when a lift can be seen. */
  const [canLift, setCanLift] = useState(false);
  /* The tilt, as it happens. Without this the gesture is invisible until it
     either works or does not, and "No lift" with nothing else on screen is
     indistinguishable from a broken control — which is exactly how it read. */
  const [liftK, setLiftK] = useState(0);
  /* Both, when the phone can report pitch — naming only the tilt left anyone
     whose gyro was quiet with no stated way to jump at all. */
  const jumpHow = canLift ? 'Lift phone or swipe up' : 'Swipe up';

  /* A lift is also a swipe, and the swipe is the WHOLE screen.

     It used to be the cue band only — a strip at 22% of the height, which is
     a hard target with a thumb already on the drive controls, and the only
     target at all on a phone whose gyro never reports. Between a tilt that
     may not arrive and a 40-pixel band that has to be hit mid-corner, there
     were devices where the jump could not be made at all.

     The cue keeps its own handler; `manual()` ignores a second call inside
     one window, so the overlap is harmless. */
  useEffect(() => {
    if (phase !== 'racing' || !jumpCue) return;
    let from: number | null = null;
    const down = (e: PointerEvent) => {
      from = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (from === null) return;
      if (from - e.clientY > 42) {
        from = null;
        handle.current?.jumpNow();
      }
    };
    const up = () => {
      from = null;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [phase, jumpCue]);


  const tier = outcome ? tierFor(outcome.score) : null;

  /* The 3D race's HUD, from the moment the circuit is on the table. Before
     that the phase is still about finding a surface, which the chip bar and
     the placement hints are for.

     Never in inspect mode. "View in your space" has no score and no clock, so
     a POINTS and TIME LEFT bar over a car you are only looking at was reading
     out a race that was not being run. */
  const raceHud = !inspect && (phase === 'placed' || phase === 'racing');
  const arLeft = stats?.timeLeft ?? RACE_SECONDS;
  const arMM = Math.floor(arLeft / 60);
  const arSS = String(Math.floor(arLeft % 60)).padStart(2, '0');
  const arLow = arLeft <= 10;

  const statusCard = () => {
    if (!support) return { cls: '', title: 'Checking device…', body: 'Seeing whether this phone can do AR.' };
    if (arWorks)
      return {
        cls: 'is-ok',
        title: 'AR ready',
        body: inspect
          ? 'Opens your camera and stands the car in front of you at true 1:64 scale.'
          : 'Opens your camera and drops the Hot Wheels circuit where you point.',
      };
    if (support.kind === 'insecure')
      return { cls: 'is-bad', title: 'Needs HTTPS', body: 'Browsers require HTTPS for camera and AR.' };
    return {
      cls: 'is-bad',
      title: 'This device does not support AR',
      body: inspect ? 'Use the 3D viewer on the product page instead.' : 'Taking you to the 3D race. It is the same race.',
    };
  };
  const s = statusCard();
  /* Arriving with ?go=1, the camera is about to open on its own. Cover the
     moment before it does — the support check still running, the launch not yet
     called — with the same loader, so the intro screen never flashes up
     between the car picker and the race. */
  const pendingAuto =
    autoStart && !triedAuto.current && !phase && !outcome && !(intro && !inspect) &&
    (support === null || (arWorks && !!car.glb && canAutoStart()));

  return (
    <>
      {/* The wait, with something in it. Sits above everything, including the
          AR overlay, because it is covering the moment that overlay appears. */}
      {(busy || pendingAuto) && <DriftLoader lines={inspect ? ['Getting your car ready', 'Opening your camera'] : AR_LOADER_LINES} />}

      {/* the DOM overlay lives outside the page so WebXR & Camera mode can adopt it */}
      {/* `outcome` forces idle as well as `phase`. Relying on phase alone left
          the driving overlay stacked over the result when teardown and render
          raced each other — and .arov sits above .result in the stack. */}
      {/* `is-xr` is not cosmetic. In a WebXR session Chrome takes this element
          fullscreen as the dom-overlay root, and puts its own "drag from the
          top to exit full screen" toast across the bottom of the screen —
          straight over Place track here. The bottom column moves up above it,
          and only there: on iOS this is an ordinary fixed overlay with nothing
          sitting under it. */}
      <div
        className={
          'arov' +
          (phase && !outcome ? '' : ' is-idle') +
          (support?.kind === 'webxr' ? ' is-xr' : '')
        }
        ref={overlay}
      >
        {phase && !outcome && (
          <>
            {/* Inside the overlay, not beside it: in a WebXR session the DOM
                overlay root is the only DOM the headset composites, so a
                vignette rendered anywhere else would simply not exist. */}
            {slowmo && <div className="btime" aria-hidden="true" />}
            {/* From the moment the circuit is down, the AR race wears the 3D
                race's HUD — the same two cards, the same clock, the same
                progress bar. They were a row of chips before: a car name, an
                apple count, "5,400 pts", "32s". Two screens of one game
                reporting the same two numbers two different ways.

                The car name and the grocery count are gone with the chips.
                Neither is something you read mid-race, and every pickup
                already announces itself as a number lifting off the car. */}
            {raceHud ? (
              <>
                <div className="hud__top">
                  {/* The delivery screen's own round back button, in the
                      corner it puts it in. */}
                  <button
                    className="hud__back"
                    type="button"
                    /* Out of the race, not out of the session. Ending the
                       session alone left the player on the gate screen
                       underneath, which is a screen asking them to choose
                       what to open — and the app does not ask that any more:
                       a phone that can do AR gets AR, one that cannot gets
                       the 3D race. */
                    onClick={() => {
                      handle.current?.end();
                      nav('/');
                    }}
                    aria-label="Leave race"
                  >
                    <IconArrowLeft size={18} />
                  </button>
                  <div className="hud__c">
                    <b className="t-num">{(stats?.score ?? 0).toLocaleString('en-IN')}</b>
                    <span>POINTS</span>
                  </div>
                  <div className={'hud__c' + (arLow ? ' is-low' : '')}>
                    <b className="t-num">{arMM}:{arSS}</b>
                    <span>TIME LEFT</span>
                  </div>
                </div>
              </>
            ) : (
            <div className="arov__bar">
              <span className="arov__chip arov__chip--name">
                <IconAR size={14} /> {car.name.replace('Hot Wheels ', '')}
              </span>
              <button
                className="arov__chip arov__x"
                type="button"
                onClick={() => handle.current?.end()}
                aria-label="Exit AR"
              >
                <IconClose size={15} />
              </button>
            </div>
            )}

            {phase === 'ready' && stuck && (
              <p className="arov__help">
                Not dropping where you want it?
                <small>Close this, press Race in your space again, and it picks up your camera cleanly.</small>
              </p>
            )}

            {phase === 'racing' && <ScorePops pops={pops} />}
            {/* How to steer, a second into the race. AR has no pads: tilt only. */}
            {phase === 'racing' && <SteerCue mode="tilt" onHold={holdForCue} />}

            {/* While the track is being built after "Place track here": the
                campaign's track loader in the middle of the camera view, so a
                slow build reads as working rather than stuck. */}
            {phase === 'ready' && placing && (
              <div className="arov__building" role="status" aria-live="polite">
                <TrackRing className="trackload trackload--ar" />
                <p>{inspect ? 'Placing your car…' : 'Building your track…'}</p>
              </div>
            )}

            {/* The gate's timing gauge. There is no crosshair any more: the
                hoop hangs above the road and the car goes under it unless it
                jumps, so the gate asks WHEN rather than WHERE. */}
            {phase === 'racing' && gateCue && (
              <GateCue k={gateCue.k} canLift={gateCue.canLift} />
            )}
            {/* The lift cue. Its own band above the reticle's place, and a
                swipe target of its own — on a phone that cannot report pitch
                the whole cue IS the control, so it has to be touchable. */}
            {phase === 'racing' && jumpCue && (
              <div
                className={'arjump' + (liftK >= 1 ? ' is-lifted' : '')}
                style={{ '--lift': liftK } as CSSProperties}
                onPointerDown={(e) => {
                  jumpSwipeFrom.current = e.clientY;
                }}
                onPointerMove={(e) => {
                  if (jumpSwipeFrom.current === null) return;
                  if (jumpSwipeFrom.current - e.clientY > 42) {
                    jumpSwipeFrom.current = null;
                    handle.current?.jumpNow();
                  }
                }}
                onPointerUp={() => {
                  jumpSwipeFrom.current = null;
                }}
              >
                {/* Three chevrons running upward. The instruction is a
                    movement, so the cue has to show the movement — "lift" on
                    its own gives no clue how far, how fast, or in which
                    direction the phone is supposed to go. */}
                <span className="arjump__arrows" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className="arjump__k">Jump ahead</span>
                <b>{liftK >= 1 ? 'Ready!' : jumpHow}</b>
                {canLift && <span className="arjump__bar" aria-hidden="true"><i /></span>}
              </div>
            )}
            {phase === 'racing' && jumpFlash && (
              <p className={'arboost__verdict is-' + jumpFlash.quality} aria-live="polite">
                {jumpFlash.quality === 'perfect'
                  ? 'Perfect jump'
                  : jumpFlash.quality === 'good'
                    ? 'Jump'
                    : 'No lift'}
                {jumpFlash.points > 0 && <b>+{jumpFlash.points}</b>}
              </p>
            )}

            {phase === 'racing' && boostFlash && (
              <p className={'arboost__verdict is-' + boostFlash.quality} aria-live="polite">
                {boostFlash.quality === 'perfect'
                  ? 'Perfect boost'
                  : boostFlash.quality === 'good'
                    ? 'Boost'
                    : 'Missed the gate'}
                {boostFlash.points > 0 && <b>+{boostFlash.points}</b>}
              </p>
            )}

            {/* One column anchored to the bottom, rather than three bands
                positioned by hand-tuned `bottom` offsets. Those were fine
                until a phase showed two action buttons instead of one: the
                stack grew upward past the hint sitting above it and the two
                overlapped. A column cannot collide with itself. */}
            <div className="arov__bottom">
            {/* Track size controls when placed */}
            {/* Race: once the track is down, the lever is the only thing on
                screen. Size, move and hint are kept for the car viewer. */}
            {phase === 'placed' && inspect && (
              <div className="arov__size">
                <button type="button" onClick={() => handle.current?.nudgeScale(1 / 1.25)} aria-label="Smaller">
                  <IconMinus size={16} />
                </button>
                <span>{inspect ? 'CAR SIZE' : 'TRACK SIZE'}</span>
                <button type="button" onClick={() => handle.current?.nudgeScale(1.25)} aria-label="Bigger">
                  <IconPlus size={16} />
                </button>
              </div>
            )}

            {/* Placement guidance. There is no surface to scan any more — the
                track goes where you point, so the only instruction is where to
                point. */}
            {phase === 'ready' && (
              <p className="arov__hint">
                {placing ? 'Building your track…' : inspect ? 'Point at a table or floor' : 'Point at the floor'}
                <small>
                  {placing
                    ? 'A moment, laying the circuit down'
                    : inspect
                      ? `Then press Place ${car.name.replace('Hot Wheels ', '')} here`
                      : 'Then press Place track here'}
                </small>
              </p>
            )}
            {phase === 'placed' && inspect && (
              <p className="arov__hint">
                {inspect ? `${car.name.replace('Hot Wheels ', '')} in your space` : 'Your track is ready'}
                <small>
                  {inspect
                    ? 'Drag to turn it · Pinch to zoom · Twist to spin'
                    : pull > 0.02
                      ? `Launcher drawn ${Math.round(pull * 100)}% · let go to fire`
                      : 'Drag the red lever back · Pinch to resize · Drag elsewhere to move'}
                </small>
              </p>
            )}
            {/* Only the things that go wrong get a line now. The standing
                advice — hold GO, arrows steer, groceries add points — was
                permanent text on a camera feed, and it is all in the briefing
                the race opens with. */}
            {phase === 'racing' && lastHitMessage && (
              <p className="arov__hint">
                <span style={{ color: '#ff5252', fontWeight: 700 }}>{lastHitMessage}</span>
              </p>
            )}

            {/* No on-screen driving controls: the car drives itself and the
                phone's tilt steers it, so the camera view stays clear. */}

            {/* Action buttons */}
            <div className="arov__acts">
              {phase === 'ready' && (
                <Button
                  variant="hwBlue"
                  block
                  type="button"
                  disabled={placing}
                  onClick={() => {
                    /* Busy from the press until the scene reports the track is
                       down (the phase leaves 'ready'). This used to clear itself
                       after 60ms — before its own 250ms spinner delay — so the
                       loader never appeared and a slow build looked stuck. The
                       loader fades in after 250ms (CSS), so a fast drop still
                       reads as instant; the timeout is only a safety net. */
                    setPlacing(true);
                    handle.current?.placeNow();
                    window.clearTimeout(placeGuard.current);
                    placeGuard.current = window.setTimeout(() => setPlacing(false), 20000);
                  }}
                >
                  {placing ? 'Placing…' : inspect ? 'Place car here' : 'Place track here'}
                </Button>
              )}
              {phase === 'placed' && inspect && (
                <>
                  <Button variant="ghostDark" block type="button" onClick={() => handle.current?.reset()}>
                    <IconRotate size={15} /> Reposition track
                  </Button>
                </>
              )}
            </div>
            </div>

            {/* Both of these used to sit outside .arov, on the reasoning that
                WebXR was not a path any phone in this campaign takes. Android
                takes it. In a dom-overlay session this element is the ONLY DOM
                the browser composites over the camera, so a briefing and a
                countdown rendered beside it simply do not exist: the track
                went down with nothing explaining it, and the lever fired with
                no 3, 2, 1 in front of it. */}
            {count !== null && !inspect && <LaunchCount step={count} />}

            {phase === 'placed' && !coached && !inspect && (
              <RaceCoach mode="ar" onDone={() => setCoached(true)} />
            )}
          </>
        )}
      </div>

      <PageHeader title={inspect ? 'View in your space' : 'Race in your space'} subtitle={car.name} onBack={() => nav(-1)} />
      <main className="page">
        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 12 }}>
          <img
            src="/campaign/banner-ar.webp"
            alt="A Hot Wheels car placed on a table in AR"
            /* 2.4:1, the shape the supplied banner is drawn at — the old 4:3
               crop cut its top and bottom off. */
            style={{ width: '100%', aspectRatio: '2.4 / 1', objectFit: 'cover', borderRadius: 'var(--r-lg)' }}
          />

          <div className={'arstat ' + s.cls}>
            <span className="arstat__d" />
            <div>
              <b>{s.title}</b>
              <span>{s.body}</span>
            </div>
          </div>

          <Button variant="hwBlue" size="lg" block
            type="button"
            disabled={!arWorks || busy}
            onClick={() => launch()}
          >
            <IconAR size={17} />
            {busy
              ? 'Starting camera…'
              : inspect
              ? 'View in your space'
              : support?.kind === 'camera'
              ? 'Open Camera Race'
              : 'Race in your space'}
          </Button>

          {inspect ? (
            <Button variant="outline" block type="button" onClick={() => nav(-1)}>
              Back to product
            </Button>
          ) : (
            <Button variant="outline" block
              type="button"
              onClick={() => {
                selectCar(car.id);
                startRace({ force3d: true, skipStanding: true });
              }}
            >
              <IconFlag size={16} />
              Play 3D Browser Race instead
            </Button>
          )}

          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--mut)' }}>
                <IconInfo size={16} />
              </span>
              <b style={{ fontSize: 'var(--f-md)' }}>{inspect ? 'How it works' : 'How to Play in AR'}</b>
            </div>
            <ul className="howto">
              {inspect ? (
                <>
                  <li><b>Open camera</b>: Works directly in Safari on iPhone, or Chrome on Android.</li>
                  <li><b>Scan</b>: Point at a table or floor. A dotted grid spreads across the surface once it is found.</li>
                  <li><b>Place</b>: Tap &apos;Place car here&apos; to stand it on that spot.</li>
                  <li><b>Look</b>: Pinch to resize, drag to move, and walk around it. It renders at true 1:64 scale, about 7 cm long.</li>
                </>
              ) : (
                <>
                  <li><b>Open Camera</b>: Works directly in Safari on iPhone (or Chrome on Android).</li>
                  <li><b>Drop Track</b>: Point at the floor and press &apos;Place track here&apos;. The ring is always in the middle of the screen.</li>
                  <li><b>Inspect</b>: Once a car is placed, drag to turn it and pinch to zoom in on it.</li>
                  <li><b>Adjust</b>: Pinch to resize the circuit, drag to reposition.</li>
                  <li><b>Score</b>: Groceries on the track add points, debris takes them away.</li>
                  <li><b>Drive</b>: The car drives itself. Tilt the phone to steer. No thumbs on the screen.</li>
                </>
              )}
            </ul>
          </div>

          <p className="t-xs" style={{ lineHeight: 1.6, color: 'var(--mut)' }}>
            {inspect
              ? 'The real die-cast model, rendered at true 1:64 scale: about 7 cm long, the size it is in the box.'
              : 'Rendered with high-detail 3D Hot Wheels scale model, road asphalt textures, and interactive chase camera tracking.'}
          </p>
        </div>
      </main>

      {/* Outside .arov, which goes visibility:hidden the moment the result
          arrives — and the paper is still in the air for a second after it. */}
      {/* Before anything else, including the loader: this is the screen the
          camera opens behind. */}
      {intro && !inspect && !outcome && (
        <ARIntro
          onDone={() => {
            markARIntroSeen();
            setIntro(false);
            /* Opened from THIS press, not from an effect watching `intro`.

               iOS only hands out motion access from inside the user gesture
               that asked for it, and an effect firing after a state change is
               a new task with no gesture behind it — so the motion prompt was
               silently denied while the camera prompt (which Safari is looser
               about) still appeared. That is the whole "it asks for the camera
               and then the track will not move" bug: the session opened with
               no gyro at all. Calling launch here keeps the chain intact,
               because nothing is awaited before the permission is asked for. */
            triedAuto.current = true;
            void launch();
          }}
        />
      )}

      {cheering && <Poppers />}

      {/* Results screen */}
      {outcome && (
        <RaceResult
          outcome={outcome}
          car={car}
          tier={tier}
          isBest={isBest}
          bestScore={useStore.getState().bestScore}
          totalPoints={useStore.getState().totalPoints}
          inviteUrl={`${window.location.origin}/?ref=${useStore.getState().referralCode}`}
          racesLeft={racesLeft}
          toast={toast}
          onRaceAgain={() => {
            setOutcome(null);
            void launch();
          }}
          onInvited={grantExtraRace}
          onShop={() => nav('/hot-wheels')}
          onRewards={() => nav('?rewards=1')}
          onExit={() => nav('/hot-wheels')}
          exitLabel="Shop cars"
        />
      )}
    </>
  );
}
