import { useEffect } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS, rupees } from '../data/catalog';
import { MAX_RACE_ATTEMPTS, useStore } from '../store/useStore';
import { preloadCar } from '../lib/three/modelLoader';
import { IconAR, IconCheck, IconFlag } from '../design/elements/Icons';

/** Race preparation: pick the car, then choose 3D or AR. */
export default function Race() {
  const nav = useNavigate();
  const { selectedCarId, selectCar, racesLeft, bestScore } = useStore();
  const car = HERO_CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];

  // warm the chosen model so the countdown isn't spent downloading
  useEffect(() => {
    if (car.glb) preloadCar(car.glb);
  }, [car.glb]);

  return (
    <>
      <PageHeader title="Race It Home" subtitle={`${racesLeft} of ${MAX_RACE_ATTEMPTS} races left`} onBack={() => nav('/campaign')} />
      <main className="page">
        <div className="sec">
          <div>
            <h2 className="sec__t">Choose your car</h2>
            <p className="sec__s">All five load the real die-cast model</p>
          </div>
        </div>

        <div className="carpick">
          {HERO_CARS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={'carpick__i' + (c.id === car.id ? ' is-on' : '')}
              onClick={() => selectCar(c.id)}
              aria-pressed={c.id === car.id}
            >
              <span className="carpick__im">
                <img src={c.image} alt="" loading="lazy" />
                {c.id === car.id && (
                  <span className="carpick__tick">
                    <IconCheck size={13} />
                  </span>
                )}
              </span>
              <span className="carpick__n">{c.name.replace('Hot Wheels ', '')}</span>
              <span className="carpick__p">{rupees(c.price)}</span>
            </button>
          ))}
        </div>

        <div className="shell" style={{ paddingTop: 8 }}>
          <div className="card" style={{ padding: 12 }}>
            <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>How it works</p>
            <ul className="howto">
              <li>Your camera opens and you place the track on a real surface.</li>
              <li>Hold GO for the throttle, the arrows to steer, the brake to slow.</li>
              <li>Hold the handbrake through a corner to drift — more slide, less speed.</li>
              <li>Collect groceries for points. The Blinkit bag is worth 500.</li>
              <li>Two laps, 45 seconds. Whichever comes first ends the race.</li>
            </ul>
            {bestScore > 0 && (
              <p className="t-xs" style={{ marginTop: 8 }}>
                Your best so far: <b className="t-num">{bestScore.toLocaleString('en-IN')} pts</b>
              </p>
            )}
          </div>
        </div>

        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
          <Button variant="flame" size="lg" block
            type="button"
            disabled={racesLeft <= 0}
            onClick={() => nav(`/ar/${car.id}`)}
          >
            <IconAR size={17} />
            {racesLeft > 0 ? 'Race in your space' : 'No races left today'}
          </Button>
          <Button variant="outline" block
            type="button"
            disabled={racesLeft <= 0}
            onClick={() => nav('/race/play')}
          >
            <IconFlag size={16} />
            Play in 3D instead
          </Button>
          {racesLeft <= 0 && (
            <Button variant="outline" block type="button" onClick={() => nav('/invite')}>
              Invite a friend to unlock +1 race
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
