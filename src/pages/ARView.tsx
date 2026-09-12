import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../design/elements';
import type React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
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
  IconAR, IconBrake, IconChevronLeft, IconChevronRight, IconClose,
  IconDrift, IconFlag, IconHorn, IconInfo, IconMinus, IconPlus, IconRotate,
} from '../design/elements/Icons';
import { horn as playHorn, primeAudio } from '../lib/horn';
import { useToast } from '../App';
import { RaceResult } from '../design/components/RaceResult';
import { ScorePops, useScorePops } from '../design/components/ScorePops';
import { DriftLoader } from '../design/components/DriftLoader';
import { createTiltSteer, initialTiltState, type TiltState, type TiltSteer } from '../lib/tiltSteer';

/** Coverage at which the surface is considered read well enough to brief on. */

export default function ARView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const selectedCarId = useStore((s) => s.selectedCarId);
  const selectCar = useStore((s) => s.selectCar);
  const finishRace = useStore((s) => s.finishRace);
  const claimReward = useStore((s) => s.claimReward);
  const racesLeft = useStore((s) => s.racesLeft);

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
  const triedAuto = useRef(false);
  const [phase, setPhase] = useState<ARPhase | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<RaceStats | null>(null);
  /* Laying the circuit out can take a beat on a slow phone. Without a signal
     the button just went quiet and people pressed it again. Only shown if the
     drop actually takes longer than a frame or two — a fast placement never
     flashes a spinner. */
  const [placing, setPlacing] = useState(false);
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
  /* Read before finishRace writes the new best, or every run is a personal
     best by the time the result screen asks. */
  const [isBest, setIsBest] = useState(false);
  const { pops, push: pushPop } = useScorePops();
  const [lastHitMessage, setLastHitMessage] = useState<string | null>(null);

  useEffect(() => {
    detectAR().then(setSupport);
  }, []);

  useEffect(() => () => handle.current?.end(), []);

  const onFinish = useCallback(
    (o: RaceOutcome) => {
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
        onPhase: setPhase,
        onTick: setStats,
        /* AR was throwing pickups away entirely — the score moved and nothing
           on screen said why. */
        onPickup: (points) => pushPop(points, 'up'),
        onPenalty: (points) => pushPop(points, 'down'),
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
          setPhase(null);
          setStats(null);
          setPlacing(false);
          handle.current = null;
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
    } finally {
      /* Held to a floor of 1.8s. A session that opens in 200ms would otherwise
         flash the loader for four frames, which reads as a glitch — and the
         point of it is to cover the wait, not to measure it. */
      const elapsed = performance.now() - startedAt;
      if (elapsed < 1800) await new Promise((r) => setTimeout(r, 1800 - elapsed));
      setBusy(false);
    }
  }, [car.glb, onFinish, toast, support, inspect]);

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
    nav('/race', { replace: true });
  }, [arKnown, arWorks, inspect, toast, selectCar, car.id, nav]);

  useEffect(() => {
    if (!autoStart || triedAuto.current) return;
    if (!arWorks) return;
    if (!car.glb || !overlay.current || handle.current) return;
    if (!canAutoStart()) return;
    triedAuto.current = true;
    void launch(true);
  }, [autoStart, arWorks, car.glb, launch]);

  useEffect(() => {
    if (phase !== 'ready') {
      setStuck(false);
      return;
    }
    const t = window.setTimeout(() => setStuck(true), 12000);
    return () => window.clearTimeout(t);
  }, [phase]);

  /* ---------- driving while racing in AR ---------- */
  const [drift, setDrift] = useState(false);
  /* Tilt steering, same module the 3D race uses. In AR it matters more: you are
     already holding the phone up at the scene, so reaching for on-screen pads
     means taking a hand off the thing you are aiming. Motion permission is
     already granted by this point — the camera session requests it during
     launch — so there is no second prompt here. */
  const tilt = useRef<TiltSteer | null>(null);
  const [tiltState, setTiltState] = useState<TiltState>(() => initialTiltState());
  const tiltDriving = tiltState === 'active';

  useEffect(() => {
    if (phase !== 'racing') return;
    const t = createTiltSteer({
      onSteer: (v) => handle.current?.setSteer(v),
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

  const press = useCallback((dir: number) => handle.current?.setSteer(dir), []);
  const release = useCallback(() => handle.current?.setSteer(0), []);
  const gas = useCallback((on: boolean) => handle.current?.setThrottle(on ? 1 : 0), []);
  const brake = useCallback((on: boolean) => handle.current?.setBrake(on ? 1 : 0), []);
  const slide = useCallback((on: boolean) => {
    setDrift(on);
    handle.current?.setDrift(on);
  }, []);
  const hornNow = useCallback(() => {
    primeAudio();
    playHorn();
  }, []);

  const hold = useCallback(
    (set: (on: boolean) => void) => ({
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        set(false);
      },
      onPointerCancel: () => set(false),
    }),
    [],
  );

  useEffect(() => {
    if (phase !== 'racing') return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') press(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') press(1);
      if (e.key === 'ArrowUp' || e.key === 'w') gas(true);
      if (e.key === 'ArrowDown' || e.key === 's') brake(true);
      if (e.key === ' ') slide(true);
      if (e.key === 'h') hornNow();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) release();
      if (e.key === 'ArrowUp' || e.key === 'w') gas(false);
      if (e.key === 'ArrowDown' || e.key === 's') brake(false);
      if (e.key === ' ') slide(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
    };
  }, [phase, press, release, gas, brake, slide, hornNow]);

  const tier = outcome ? tierFor(outcome.score) : null;

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
      body: inspect ? 'Use the 3D viewer on the product page instead.' : 'Taking you to the 3D race — it is the same race.',
    };
  };
  const s = statusCard();

  return (
    <>
      {/* The wait, with something in it. Sits above everything, including the
          AR overlay, because it is covering the moment that overlay appears. */}
      {busy && <DriftLoader glbUrl={car.glb} label={inspect ? 'Getting your car ready' : 'Building your track'} />}

      {/* the DOM overlay lives outside the page so WebXR & Camera mode can adopt it */}
      {/* `outcome` forces idle as well as `phase`. Relying on phase alone left
          the driving overlay stacked over the result when teardown and render
          raced each other — and .arov sits above .result in the stack. */}
      <div className={'arov' + (phase && !outcome ? '' : ' is-idle')} ref={overlay}>
        {phase && !outcome && (
          <>
            <div className="arov__bar">
              <span className="arov__chip arov__chip--name">
                <IconAR size={14} /> {car.name.replace('Hot Wheels ', '')}
              </span>
              {phase === 'racing' && stats && (
                <>
                  <span className="arov__chip t-num">
                    🍏 {stats.groceries}
                  </span>
                  <span className="arov__chip t-num">
                    {stats.score.toLocaleString('en-IN')} pts
                  </span>
                  <span className="arov__chip t-num" style={{ color: stats.timeLeft <= 10 ? '#ff4d4f' : '#fff' }}>
                    ⏱ {Math.ceil(stats.timeLeft)}s
                  </span>
                </>
              )}
              <button
                className="arov__chip arov__x"
                type="button"
                onClick={() => handle.current?.end()}
                aria-label="Exit AR"
              >
                <IconClose size={15} />
              </button>
            </div>

            {phase === 'ready' && stuck && (
              <p className="arov__help">
                Not dropping where you want it?
                <small>Close this, press Race in your space again, and it picks up your camera cleanly.</small>
              </p>
            )}

            {phase === 'racing' && <ScorePops pops={pops} />}

            {/* One column anchored to the bottom, rather than three bands
                positioned by hand-tuned `bottom` offsets. Those were fine
                until a phase showed two action buttons instead of one: the
                stack grew upward past the hint sitting above it and the two
                overlapped. A column cannot collide with itself. */}
            <div className="arov__bottom">
            {/* Track size controls when placed */}
            {phase === 'placed' && (
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
                    ? 'A moment — laying the circuit down'
                    : inspect
                      ? `Then press Place ${car.name.replace('Hot Wheels ', '')} here`
                      : 'Then press Place track here'}
                </small>
              </p>
            )}
            {phase === 'placed' && (
              <p className="arov__hint">
                {inspect ? `${car.name.replace('Hot Wheels ', '')} in your space` : 'Your track is ready'}
                <small>
                  {inspect
                    ? 'Drag to turn it · Pinch to zoom · Twist to spin'
                    : 'Pinch to resize · Drag to move · Then start the race'}
                </small>
              </p>
            )}
            {phase === 'racing' && stats && (
              <p className="arov__hint">
                {lastHitMessage ? (
                  <span style={{ color: '#ff5252', fontWeight: 700 }}>{lastHitMessage}</span>
                ) : (
                  <small>
                    Hold GO · Arrows steer · <strong>Groceries add points, debris takes them</strong>
                  </small>
                )}
              </p>
            )}

            {/* In-race driving controls */}
            {phase === 'racing' && (
              <div className={'arov__drive' + (tiltDriving ? ' is-tilt' : '')}>
                <div className="arov__steer">
                  <button
                    type="button"
                    className="arov__pad"
                    aria-label="Steer left"
                    {...hold((on) => (on ? press(-1) : release()))}
                  >
                    <IconChevronLeft size={26} />
                  </button>
                  <button
                    type="button"
                    className="arov__pad"
                    aria-label="Steer right"
                    {...hold((on) => (on ? press(1) : release()))}
                  >
                    <IconChevronRight size={26} />
                  </button>
                </div>
                <div className="arov__drivec">
                  <button
                    type="button"
                    className="arov__pad arov__pad--sm"
                    aria-label="Horn"
                    onClick={hornNow}
                  >
                    <IconHorn size={22} />
                  </button>
                  <button
                    type="button"
                    className={'arov__pad arov__pad--sm' + (drift ? ' is-on' : '')}
                    aria-label="Drift"
                    aria-pressed={drift}
                    {...hold(slide)}
                  >
                    <IconDrift size={22} />
                  </button>
                  <button
                    type="button"
                    className="arov__pad arov__pad--sm"
                    aria-label="Brake"
                    {...hold(brake)}
                  >
                    <IconBrake size={22} />
                  </button>
                  <button
                    type="button"
                    className="arov__pad arov__pad--gas"
                    aria-label="Accelerate"
                    {...hold(gas)}
                  >
                    GO
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="arov__acts">
              {phase === 'ready' && (
                <Button
                  variant="hwBlue"
                  block
                  type="button"
                  disabled={placing}
                  onClick={() => {
                    /* The spinner only appears if the drop is still going after
                       250ms. Anything faster than that reads as instant and a
                       flash of "loading" would be noise. */
                    const slow = window.setTimeout(() => setPlacing(true), 250);
                    handle.current?.placeNow();
                    window.setTimeout(() => {
                      window.clearTimeout(slow);
                      setPlacing(false);
                    }, 60);
                  }}
                >
                  {placing ? 'Placing…' : inspect ? 'Place car here' : 'Place track here'}
                </Button>
              )}
              {phase === 'placed' && (
                <>
                  {!inspect && (
                    <Button variant="hwBlue" block type="button" onClick={() => handle.current?.startRace()}>
                      Start race
                    </Button>
                  )}
                  <Button variant="ghostDark" block type="button" onClick={() => handle.current?.reset()}>
                    <IconRotate size={15} /> Reposition track
                  </Button>
                </>
              )}
            </div>
            </div>

          </>
        )}
      </div>

      <PageHeader title={inspect ? 'View in your space' : 'Race in your space'} subtitle={car.name} onBack={() => nav(-1)} />
      <main className="page">
        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 12 }}>
          <img
            src="/campaign/14-ar-toy-car-placement.webp"
            alt="A Hot Wheels car placed on a table in AR"
            style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', objectPosition: '50% 62%', borderRadius: 'var(--r-lg)' }}
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
                nav('/race');
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
                  <li><b>Drive</b>: Hold GO and tilt the phone to steer. No thumbs on the screen.</li>
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

      {/* Results screen */}
      {outcome && (
        <RaceResult
          outcome={outcome}
          car={car}
          tier={tier}
          isBest={isBest}
          totalPoints={useStore.getState().totalPoints}
          inviteUrl={`${window.location.origin}/?ref=${useStore.getState().referralCode}`}
          racesLeft={racesLeft}
          toast={toast}
          onClaim={(t) => {
            claimReward(t.id);
            toast(`${t.label} applied to your cart`);
            nav('/cart');
          }}
          onRaceAgain={() => {
            setOutcome(null);
            void launch();
          }}
          onLeaderboard={() => nav('/leaderboard')}
          onExit={() => nav('/hot-wheels')}
          exitLabel="Shop cars"
        />
      )}
    </>
  );
}
