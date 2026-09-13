import { useEffect, type CSSProperties } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { HERO_CARS } from '../data/catalog';
import { useStore } from '../store/useStore';
import { preloadCar } from '../lib/three/modelLoader';
import { IconAR, IconCheck, IconFlag } from '../design/elements/Icons';
import { useARSupport } from '../lib/useARSupport';

/** Race preparation: pick the car, then choose 3D or AR. */
/* A word and a colour for each car.

   The colours are sampled off the product shots rather than picked — the most
   saturated pixel in each, brightened enough to hold a 2px outline on white:
   #315710, #032A8E, #CB9E4A, #B2001D. K.I.T.T. sampled #691723, which is its
   scanner light rather than its paint; the car is black, so it wears graphite
   and Hollowback keeps the red.

   The WORDS are character, not statistics. Every car drives identically —
   `raceInteraction` is explicit that two players on the same line must score
   the same, and per-car handling is the one change that would break it. */
const CAR_TRAIT: Record<string, { accent: string }> = {
  ballistik: { accent: '#5FA31E' },
  battlespec: { accent: '#2757C9' },
  jackhammer: { accent: '#C08A2A' },
  hollowback: { accent: '#CF1027' },
  kitt: { accent: '#2E3138' },
};

export default function Race() {
  const nav = useNavigate();
  const { selectedCarId, selectCar, racesLeft } = useStore();
  /* Four cars, two by two. */
  const cars = HERO_CARS.slice(0, 4);
  const car = cars.find((c) => c.id === selectedCarId) ?? cars[0];
  /* null while the check runs — treated as yes, so the AR button does not
     appear a frame late on a device that has it. */
  const arOk = useARSupport() !== false;

  // warm the chosen model so the countdown isn't spent downloading
  useEffect(() => {
    if (car.glb) preloadCar(car.glb);
  }, [car.glb]);

  return (
    <>
      <PageHeader title="Choose your car" onBack={() => nav('/campaign')} />
      <main className="page">
        <div className="carpick">
          {cars.map((c) => (
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
              <span className="carpick__n">{c.name.replace('Hot Wheels ', '').replace(' Die Cast Car', '')}</span>
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
