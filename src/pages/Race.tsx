import { useEffect, type CSSProperties } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS } from '../data/catalog';
import { MAX_RACE_ATTEMPTS, useStore } from '../store/useStore';
import { preloadCar } from '../lib/three/modelLoader';
import { IconAR, IconCheck, IconFlag } from '../design/elements/Icons';
import { useARSupport } from '../lib/useARSupport';

/** Race preparation: pick the car, then choose 3D or AR. */
/* The three things you do, in the order you do them. */
const HOW_TO: { t: string; icon: string; c: React.ReactNode }[] = [
  { t: 'point', icon: '/howto/point.png', c: <>Point your camera at a table or floor</> },
  { t: 'tilt', icon: '/howto/tilt.png', c: <>Hold <b>GO</b> and tilt to steer</> },
  { t: 'grab', icon: '/howto/grab.png', c: <>Grab groceries on the way. Each bag is worth 500.</> },
];

/* A word and a colour for each car.

   The colours are sampled off the product shots rather than picked — the most
   saturated pixel in each, brightened enough to hold a 2px outline on white:
   #315710, #032A8E, #CB9E4A, #B2001D. K.I.T.T. sampled #691723, which is its
   scanner light rather than its paint; the car is black, so it wears graphite
   and Hollowback keeps the red.

   The WORDS are character, not statistics. Every car drives identically —
   `raceInteraction` is explicit that two players on the same line must score
   the same, and per-car handling is the one change that would break it. */
const CAR_TRAIT: Record<string, { trait: string; accent: string }> = {
  ballistik: { trait: 'Speed', accent: '#5FA31E' },
  battlespec: { trait: 'Control', accent: '#2757C9' },
  jackhammer: { trait: 'Grip', accent: '#C08A2A' },
  hollowback: { trait: 'Drift', accent: '#CF1027' },
  kitt: { trait: 'Balance', accent: '#2E3138' },
};

export default function Race() {
  const nav = useNavigate();
  const { selectedCarId, selectCar, racesLeft, bestScore } = useStore();
  const car = HERO_CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];
  /* null while the check runs — treated as yes, so the AR button does not
     appear a frame late on a device that has it. */
  const arOk = useARSupport() !== false;

  // warm the chosen model so the countdown isn't spent downloading
  useEffect(() => {
    if (car.glb) preloadCar(car.glb);
  }, [car.glb]);

  return (
    <>
      <PageHeader title="Race It Home" subtitle={`${racesLeft} of ${MAX_RACE_ATTEMPTS} races left`} onBack={() => nav('/campaign')} />
      <main className="page">
        {/* How it works comes first. You cannot choose between five cars for a
            game you have not been told how to play — the explainer is the
            thing that makes the picker mean something, so it goes above it. */}
        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="howcard">
            <div className="howcard__hd">
              <h2>How to play</h2>
              <b>Two laps &middot; 45 seconds</b>
            </div>
            {/* Three peers you scan, not a list you read. The card is WHITE,
                and that is load-bearing rather than a taste: the supplied icons
                are opaque PNGs with a white ground baked in, so on any tinted
                card each one sits in a visible white square. */}
            <div className="howgrid">
              {HOW_TO.map((h, i) => (
                <div key={h.t}>
                  <span className="howgrid__n">{i + 1}</span>
                  <img src={h.icon} alt="" />
                  <span className="howgrid__c">{h.c}</span>
                </div>
              ))}
            </div>
            {bestScore > 0 && (
              <p className="howcard__best">
                Your best so far: <b className="t-num">{bestScore.toLocaleString('en-IN')} pts</b>
              </p>
            )}
          </div>
        </div>

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
              style={{ '--car': CAR_TRAIT[c.id]?.accent } as CSSProperties}
            >
              <span className="carpick__im">
                <img src={c.image} alt="" loading="lazy" />
                {c.id === car.id && (
                  <span className="carpick__tick">
                    <IconCheck size={13} />
                  </span>
                )}
              </span>
              {/* Name only. You are picking a car to drive, not to buy — a price
                  here turned the starting grid into a second shelf. */}
              <span className="carpick__n">{c.name.replace('Hot Wheels ', '').replace(' Die Cast Car', '')}</span>
              <span className="carpick__trait">{CAR_TRAIT[c.id]?.trait}</span>
            </button>
          ))}
        </div>

        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
          {/* Only offered where it works. On a device with no AR this used to
              be the primary button and it led to a dead screen. */}
          {arOk && (
            <Button variant="hwBlue" size="lg" block
              type="button"
              disabled={racesLeft <= 0}
              onClick={() => nav(`/ar/${car.id}?go=1`)}
            >
              <IconAR size={17} />
              {racesLeft > 0 ? 'Race in your space' : 'No races left today'}
            </Button>
          )}
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
