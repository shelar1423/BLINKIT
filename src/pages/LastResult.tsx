import { Navigate, useNavigate } from 'react-router-dom';
import { RaceResult } from '../design/components/RaceResult';
import { CARS, HERO_CARS } from '../data/catalog';
import { tierFor, useStore } from '../store/useStore';
import { useStartRace } from '../lib/useStartRace';
import { useToast } from '../App';

/* ============================================================
   Where you stand, on the way back in.

   The first race a player ever asks for starts immediately — there is nothing
   to tell them yet, and a screen in front of it would be a screen about
   nothing. On a later visit there is: a best, a total, a reward already
   sitting on their next order. Dropping straight back into a countdown throws
   all of that away and asks them to earn it again without ever having been
   shown it.

   So the first Race of a RETURN visit lands here — their last run, with the
   reward it won and the board they are on — and the race is one press away on
   the same screen they would have landed on anyway when it ended. Once per
   visit: see `standingShown` in useStartRace. Every Race after this one in the
   same session goes straight to the line.

   Nothing is written here. It is the result screen reading the result the
   store already kept.
   ============================================================ */

export default function LastResult() {
  const nav = useNavigate();
  const { toast } = useToast();
  const startRace = useStartRace();

  const last = useStore((s) => s.lastResult);
  const bestScore = useStore((s) => s.bestScore);
  const totalPoints = useStore((s) => s.totalPoints);
  const racesLeft = useStore((s) => s.racesLeft);
  const grantExtraRace = useStore((s) => s.grantExtraRace);
  const selectedCarId = useStore((s) => s.selectedCarId);

  /* Straight past it for anyone who has never finished a race. The gate in
     useStartRace already checks, so this is only reachable by typing the URL
     — but a result screen with no result would render a zero as if it were
     something the player had done. */
  if (!last) return <Navigate to="/" replace />;

  const car = CARS.find((c) => c.id === selectedCarId) ?? HERO_CARS[0];

  return (
    <RaceResult
      outcome={{
        score: last.score,
        groceries: last.groceries,
        seconds: last.seconds,
        /* The store does not keep whether the flag was crossed, and this is a
           run that is over and recorded either way. */
        finished: true,
      }}
      car={car}
      tier={tierFor(last.score)}
      /* Looking back at a run, not finishing one: the "new personal best" pill
         belongs to the moment it happened. */
      isBest={false}
      bestScore={bestScore}
      totalPoints={totalPoints}
      racesLeft={racesLeft}
      inviteUrl={`${window.location.origin}/?ref=RACE`}
      onRaceAgain={() => startRace({ skipStanding: true })}
      onInvited={grantExtraRace}
      onShop={() => nav('/hot-wheels')}
      onRewards={() => nav('?rewards=1')}
      onExit={() => nav('/')}
      exitLabel="Close"
      toast={toast}
    />
  );
}
