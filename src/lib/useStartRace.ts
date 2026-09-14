import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_CARS } from '../data/catalog';
import { preloadCar } from './three/modelLoader';
import { useStore } from '../store/useStore';
import { useARSupport } from './useARSupport';

/* ============================================================
   One way into a race.

   There used to be three screens between wanting to race and racing: the
   campaign hub, then a car picker, then a choice of AR or 3D. None of the
   three asked anything the app could not answer itself.

   - The car: every car drives identically, so picking one changed the
     paintwork and nothing else. It is the car you raced last, or the drop car
     the first time, and it can be changed from inside the race.
   - The mode: `useARSupport` already knows whether this phone can do it. A
     screen asking the player to confirm what the device just told us is a
     screen that exists to be dismissed.

   So this is the whole lobby, as a function. Anything that offers a race calls
   it, which also means there is exactly one place to change how a race starts.
   ============================================================ */

export function useStartRace() {
  const nav = useNavigate();
  const selectedCarId = useStore((s) => s.selectedCarId);
  /* null while the check is still running, and treated as yes: a phone that
     can do AR should not be sent to the 3D race because the answer arrived a
     frame late. */
  const arOk = useARSupport() !== false;

  const car = HERO_CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];

  return useCallback(
    (opts?: { force3d?: boolean }) => {
      /* Warmed here rather than on a lobby screen that no longer exists, so
         the download overlaps the loader instead of the countdown. */
      if (car.glb) preloadCar(car.glb);
      if (arOk && !opts?.force3d) nav(`/ar/${car.id}?go=1`);
      else nav('/race/play');
    },
    [arOk, car.glb, car.id, nav],
  );
}
