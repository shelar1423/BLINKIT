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
          {/* Set the way Blinkit sets a campaign explainer: a labelled panel
              with the mechanic shown rather than only described, a pro tip,
              and the line that makes the point. A bulleted list under a bold
              paragraph was documentation, not a campaign. */}
          <div className="howcard">
            <p className="howcard__hd">How it works</p>
            <div className="howcard__art">
              <img src="/campaign/14-ar-toy-car-placement.webp" alt="A Hot Wheels car placed on a real table through the camera" />
              <span className="howcard__tip">
                <b>Pro tip:</b> a clear table or floor works best
              </span>
            </div>
            {/* The copy is wrapped rather than sitting loose beside the
                number: the row is a flex container, so bare text nodes and a
                <b> each become flex items and every one of them picks up the
                row gap — which is why "Hold GO and tilt" had holes punched
                through it. */}
            <ol className="howsteps">
              <li>
                <span className="howsteps__n">1</span>
                <span className="howsteps__t">Point your camera at a table or floor</span>
              </li>
              {/* Tilt is how this is actually driven now; the old copy still
                  described on-screen arrows and a handbrake as the primary
                  controls, which stopped being true when tilt steering landed. */}
              <li>
                <span className="howsteps__n">2</span>
                <span className="howsteps__t">Hold <b>GO</b> and tilt the phone to steer</span>
              </li>
              <li>
                <span className="howsteps__n">3</span>
                <span className="howsteps__t">Grab groceries on the way — the Blinkit bag is worth 500</span>
              </li>
            </ol>
            <p className="howcard__line">Two laps. 45 seconds.<br />Race it home.</p>
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
