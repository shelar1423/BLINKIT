import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../design/elements';
import type React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS, rupees } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
import {
  detectAR,
  startARSession,
  startCameraSession,
  type ARHandle,
  type ARPhase,
  type ARSupport,
} from '../lib/three/arSession';
import type { RaceOutcome, RaceStats } from '../lib/three/raceEngine';
import {
  IconAR, IconBrake, IconCheck, IconChevronLeft, IconChevronRight, IconClose,
  IconDrift, IconFlag, IconHorn, IconInfo, IconMinus, IconPlus, IconRotate,
} from '../design/elements/Icons';
import { horn as playHorn, primeAudio } from '../lib/horn';
import { useToast } from '../App';
import { createTiltSteer, initialTiltState, type TiltState, type TiltSteer } from '../lib/tiltSteer';

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
  const [search] = useSearchParams();
  /* "View in your space" on the product page means look at the car, not race
     it. The race entry point passes no mode and still gets the circuit. */
  const inspect = search.get('mode') === 'inspect';
  const [phase, setPhase] = useState<ARPhase | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<RaceStats | null>(null);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  const [proximityAlert, setProximityAlert] = useState(false);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [lastHitMessage, setLastHitMessage] = useState<string | null>(null);

  useEffect(() => {
    detectAR().then(setSupport);
  }, []);

  useEffect(() => () => handle.current?.end(), []);

  const onFinish = useCallback(
    (o: RaceOutcome) => {
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

  const launch = useCallback(async () => {
    if (!car.glb || !overlay.current) return;
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
        onPickup: () => {},
        onFinish,
        onError: (m) => toast(m),
        onObstacleHit: (hit) => {
          const msg = hit.type === 'cv_detected' ? '⚠️ Real Object Hit! (-100 pts)' : '📦 Pinned Hazard Hit! (-100 pts)';
          setLastHitMessage(msg);
          toast(msg);
          setTimeout(() => setLastHitMessage(null), 2200);
        },
        onObstacleCountChange: setPinnedCount,
        onProximityAlert: setProximityAlert,
        onEnd: () => {
          setPhase(null);
          setStats(null);
          setPinnedCount(0);
          setProximityAlert(false);
          handle.current = null;
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AR could not start';
      toast(msg.includes('denied') || msg.includes('NotAllowed') ? 'Camera permission was denied' : msg);
      setPhase(null);
    } finally {
      setBusy(false);
    }
  }, [car.glb, onFinish, toast, support, inspect]);

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
    if (!support) return { cls: '', title: 'Checking device…', body: 'Detecting camera and AR support.' };
    if (support.kind === 'webxr')
      return {
        cls: 'is-ok',
        title: 'Full AR Available',
        body: 'Detects your floor or table and anchors the Hot Wheels track in your space.',
      };
    if (support.kind === 'camera')
      return {
        cls: 'is-ok',
        title: 'Camera AR + Computer Vision (iOS Safari & Chrome)',
        body: 'Real-time camera edge sensor detects physical objects (bottles, laptops, walls). Tap screen while racing to drop 3D hazard boxes on real obstacles!',
      };
    if (support.kind === 'insecure')
      return {
        cls: 'is-bad',
        title: 'Needs HTTPS',
        body: 'Browsers require HTTPS for camera and AR.',
      };
    return {
      cls: 'is-bad',
      title: 'Not supported on this browser',
      body: support.reason + ' You can play the 3D race directly.',
    };
  };
  const s = statusCard();

  return (
    <>
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
              {/* Only warn when there is something to warn about. This chip used
                  to sit there permanently reading "CV BUMPER" — internal jargon
                  for the collision sensor — eating a fifth of a crowded HUD to
                  say nothing. It now appears only on an actual proximity hit. */}
              {phase === 'racing' && proximityAlert && (
                <span className="arov__chip arov__chip--warn">Close!</span>
              )}
              {pinnedCount > 0 && (
                <button
                  className="arov__chip"
                  type="button"
                  style={{ color: '#ffca28' }}
                  onClick={() => handle.current?.clearObstacles?.()}
                  aria-label="Clear pinned obstacles"
                >
                  Clear {pinnedCount} 📦
                </button>
              )}
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

            {/* Scanning / Placement guidance */}
            {!inspect && phase === 'searching' && (
              <p className="arov__hint">
                Point at your floor or table
                <small>Tap anywhere to drop the track there</small>
              </p>
            )}
            {phase === 'ready' && (
              <p className="arov__hint">
                Surface locked! 🎯
                <small>Tap anywhere on your floor to drop the track there</small>
              </p>
            )}
            {phase === 'placed' && (
              <p className="arov__hint">
                {inspect ? `${car.name.replace('Hot Wheels ', '')} in your space` : 'Circuit placed!'}
                <small>
                  {inspect
                    ? 'Pinch to resize · Drag to move · Walk around it'
                    : "Pinch to resize · Drag to move · Tap 'Start race' to drive"}
                </small>
              </p>
            )}
            {phase === 'racing' && stats && (
              <p className="arov__hint">
                {lastHitMessage ? (
                  <span style={{ color: '#ff5252', fontWeight: 700 }}>{lastHitMessage}</span>
                ) : (
                  <small>
                    Hold GO · Arrows steer · <strong>Tap screen to drop hazard on real object</strong> ({pinnedCount} active)
                  </small>
                )}
              </p>
            )}

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
              {!inspect && (phase === 'ready' || phase === 'searching') && (
                <Button variant="flame" block type="button" onClick={() => handle.current?.placeNow()}>
                  {phase === 'ready' ? 'Place track here' : 'Place in front of me'}
                </Button>
              )}
              {phase === 'placed' && (
                <>
                  {!inspect && (
                    <Button variant="flame" block type="button" onClick={() => handle.current?.startRace()}>
                      Start race
                    </Button>
                  )}
                  <Button variant="ghostDark" block type="button" onClick={() => handle.current?.reset()}>
                    <IconRotate size={15} /> Reposition track
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <PageHeader title="Race in your space" subtitle={car.name} onBack={() => nav(-1)} />
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

          <Button variant="flame" size="lg" block
            type="button"
            disabled={!(support?.kind === 'webxr' || support?.kind === 'camera') || busy}
            onClick={launch}
          >
            <IconAR size={17} />
            {busy
              ? 'Starting AR…'
              : support?.kind === 'camera'
              ? 'Open Camera Race'
              : 'Race in your space'}
          </Button>

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

          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--mut)' }}>
                <IconInfo size={16} />
              </span>
              <b style={{ fontSize: 'var(--f-md)' }}>How to Play in AR</b>
            </div>
            <ul className="howto">
              <li><b>Open Camera</b>: Works directly in Safari on iPhone (or Chrome on Android).</li>
              <li><b>Scan Surface</b>: Point at your floor or a flat desk — an animated radar ring locks onto the surface.</li>
              <li><b>Drop Track</b>: Tap anywhere on the floor to place the track there.</li>
              <li><b>Adjust</b>: Pinch to resize the circuit, drag to reposition.</li>
              <li><b>Drive</b>: Press GO, steer left/right, handbrake to drift around corners, and collect groceries!</li>
            </ul>
          </div>

          <p className="t-xs" style={{ lineHeight: 1.6, color: 'var(--mut)' }}>
            Rendered with high-detail 3D Hot Wheels scale model, road asphalt textures, and interactive chase camera tracking.
          </p>
        </div>
      </main>

      {/* Results screen */}
      {outcome && (
        <div className="result">
          <p className="result__kick">{outcome.finished ? 'FINISHED' : 'TIME UP'}</p>
          <h1 className="result__t">{outcome.finished ? 'You raced it home' : 'So close!'}</h1>
          <div className="result__g">
            <div><b className="t-num">{outcome.score.toLocaleString('en-IN')}</b><span>POINTS</span></div>
            <div><b className="t-num">{outcome.groceries}</b><span>GROCERIES</span></div>
            <div><b className="t-num">{outcome.seconds}s</b><span>TIME</span></div>
          </div>
          {tier && (
            <div className="result__rw">
              <IconCheck size={26} />
              <div className="grow">
                <b>{tier.label}</b>
                <span>{tier.value > 0 ? `${rupees(tier.value)} off your next order` : 'Applied at checkout'}</span>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {tier && (
              <Button variant="primary" size="lg" block
                type="button"
                onClick={() => {
                  claimReward(tier.id);
                  nav('/cart');
                }}
              >
                Claim reward
              </Button>
            )}
            {!tier && (
              <Button variant="primary" size="lg" block
                type="button"
                onClick={() => {
                  setOutcome(null);
                  void launch();
                }}
                disabled={racesLeft <= 0}
              >
                Race again
              </Button>
            )}
            <div className="result__more">
              {tier && (
                <Button variant="outline"
                  type="button"
                  onClick={() => {
                    setOutcome(null);
                    void launch();
                  }}
                  disabled={racesLeft <= 0}
                >
                  Race again
                </Button>
              )}
              <Button variant="outline" type="button" onClick={() => nav('/hot-wheels')}>
                Shop the drop
              </Button>
              <Button variant="outline" type="button" onClick={() => nav('/campaign')}>
                Campaign
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
