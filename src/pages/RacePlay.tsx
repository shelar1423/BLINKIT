import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_CARS, rupees } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
import { createRaceScene, type RaceHandle } from '../lib/three/raceScene';
import type { RaceOutcome, RaceStats } from '../lib/three/raceEngine';
import { IconChevronLeft, IconChevronRight, IconClose, IconDrift, IconHorn, IconRotate } from '../components/Icons';
import { horn as playHorn, primeAudio } from '../lib/horn';
import { createTiltSteer, initialTiltState, type TiltState, type TiltSteer } from '../lib/tiltSteer';
import { useToast } from '../App';

const REWARD_ART: Record<string, string> = {
  start: '/rewards/25-02-free-delivery-badge.webp',
  check: '/rewards/25-01-gold-coin.webp',
  pit: '/rewards/25-03-wallet-reward-token.webp',
  podium: '/rewards/25-06-premium-membership-icon.webp',
};

export default function RacePlay() {
  const nav = useNavigate();
  const { toast } = useToast();
  const selectedCarId = useStore((s) => s.selectedCarId);
  const racesLeft = useStore((s) => s.racesLeft);
  const finishRace = useStore((s) => s.finishRace);
  const claimReward = useStore((s) => s.claimReward);
  const car = HERO_CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];

  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<RaceHandle | null>(null);
  const popId = useRef(0);
  const tilt = useRef<TiltSteer | null>(null);
  const [tiltState, setTiltState] = useState<TiltState>(() => initialTiltState());

  const [pct, setPct] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [stats, setStats] = useState<RaceStats>({
    score: 0, groceries: 0, timeLeft: 45, lap: 1, laps: 2, progress: 0, speedKph: 0,
  });
  const [pops, setPops] = useState<{ id: number; text: string }[]>([]);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);

  // guard: no attempts left
  useEffect(() => {
    if (racesLeft <= 0) {
      toast('No races left today');
      nav('/invite', { replace: true });
    }
  }, [racesLeft, nav, toast]);

  const onPickup = useCallback((points: number) => {
    const id = ++popId.current;
    setPops((p) => [...p.slice(-3), { id, text: `+${points}` }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 700);
  }, []);

  const onFinish = useCallback(
    (o: RaceOutcome) => {
      finishRace({ score: o.score, groceries: o.groceries, seconds: o.seconds });
      setOutcome(o);
    },
    [finishRace],
  );

  useEffect(() => {
    if (!host.current || !car.glb) return;
    const h = createRaceScene(host.current, {
      glbUrl: car.glb,
      duration: 45,
      laps: 2,
      onProgress: (p) => setPct(p < 0 ? 0 : p),
      onReady: () => setLoaded(true),
      onError: (m) => setErr(m),
      onTick: setStats,
      onPickup,
      onFinish,
    });
    handle.current = h;
    return () => {
      h.dispose();
      handle.current = null;
    };
  }, [car.glb, onPickup, onFinish]);

  // 3 · 2 · 1 · GO, then start
  useEffect(() => {
    if (!loaded || err) return;
    let n = 3;
    setCount(n);
    const t = window.setInterval(() => {
      n -= 1;
      if (n > 0) setCount(n);
      else if (n === 0) setCount(0);
      else {
        window.clearInterval(t);
        setCount(null);
        handle.current?.start();
      }
    }, 700);
    return () => window.clearInterval(t);
  }, [loaded, err]);

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
    const down = (e: PointerEvent) => {
      holding = true;
      steerTo(e.clientX);
    };
    const move = (e: PointerEvent) => {
      if (holding) steerTo(e.clientX);
    };
    const up = () => {
      holding = false;
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
      if (e.key === ' ') handle.current?.engine.boost();
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
          <button className="btn btn--outline" type="button" onClick={() => nav('/race')}>
            Back
          </button>
        </div>
      )}

      {!loaded && !err && (
        <div className="loadbox loadbox--dark" style={{ position: 'absolute', inset: 0 }}>
          <span className="spin spin--dark" />
          <p>Getting your car ready… {pct > 0 ? `${pct}%` : ''}</p>
        </div>
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

          {pops.map((p) => (
            <span key={p.id} className="hud__pop">{p.text}</span>
          ))}

          {!tiltDriving && (
            <div className="steer__pads" aria-hidden="true">
              <span className="steer__pad"><IconChevronLeft size={22} /></span>
              <span className="steer__pad"><IconChevronRight size={22} /></span>
            </div>
          )}

          {/* iOS gates motion access behind a gesture, so it has to be asked for
              here rather than silently on mount. */}
          {tiltState === 'needs-permission' && (
            <div className="tiltask" onPointerDown={(e) => e.stopPropagation()}>
              <p className="tiltask__t">Steer by tilting your phone</p>
              <p className="tiltask__s">Needs access to motion sensors.</p>
              <button className="btn btn--flame btn--sm" type="button" onClick={enableTilt}>
                Enable tilt steering
              </button>
            </div>
          )}
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
            </button>
          </div>
          <p className="steer__hint">
            {tiltDriving ? 'Tilt your phone to steer' : 'Hold either side to steer'} · handbrake to drift · {stats.groceries} collected
          </p>
        </div>
      )}

      {count !== null && (
        <div className="cdown">
          <b>{count === 0 ? 'GO' : count}</b>
        </div>
      )}

      {outcome && (
        <div className="result">
          <img className="result__hero" src="/campaign/08-race-complete-illustration.webp" alt="" />
          <h1 className="result__t">{outcome.finished ? 'Race complete' : "Time's up"}</h1>
          <div className="result__g">
            <div>
              <b className="t-num">{outcome.score.toLocaleString('en-IN')}</b>
              <span>POINTS</span>
            </div>
            <div>
              <b className="t-num">{outcome.groceries}</b>
              <span>GROCERIES</span>
            </div>
            <div>
              <b className="t-num">{outcome.seconds}s</b>
              <span>TIME</span>
            </div>
          </div>

          {tier ? (
            <div className="result__rw">
              <img src={REWARD_ART[tier.id]} alt="" />
              <div className="grow">
                <b>{tier.label}</b>
                <span>{tier.value > 0 ? `${rupees(tier.value)} off your next order` : 'Applied at checkout'}</span>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--tk-mut)', fontSize: 'var(--f-sm)' }}>
              You need 1,000 points for a reward. Closest yet: {outcome.score.toLocaleString('en-IN')}.
            </p>
          )}

          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            {tier && (
              <button
                className="btn btn--primary btn--lg btn--block"
                type="button"
                onClick={() => {
                  claimReward(tier.id);
                  toast(`${tier.label} applied to your cart`);
                  nav('/cart');
                }}
              >
                Claim reward
              </button>
            )}
            <button
              className="btn btn--ghostDark btn--block"
              type="button"
              disabled={useStore.getState().racesLeft <= 0}
              onClick={() => window.location.reload()}
            >
              Race again ({useStore.getState().racesLeft} left)
            </button>
            <button className="btn btn--ghostDark btn--block" type="button" onClick={() => nav('/leaderboard')}>
              Leaderboard
            </button>
            <button className="btn btn--ghostDark btn--block" type="button" onClick={() => nav('/campaign')}>
              Back to campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
