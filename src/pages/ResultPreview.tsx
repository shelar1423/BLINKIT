import { useNavigate, useSearchParams } from 'react-router-dom';
import { RaceResult } from '../design/components/RaceResult';
import { SHOP_CARS } from '../data/catalog';
import { REWARD_TIERS, tierFor } from '../store/useStore';
import { useToast } from '../App';

/* ============================================================
   The result screen, without the race.

   Deliberately unlinked, like /diag. Checking one word of copy or one colour
   on this screen otherwise costs a full forty-five second run, and the tier it
   lands on is whatever the driving happened to earn — so the one case you want
   to look at is the one you cannot ask for.

   /preview/result?score=3000 renders it at that score, which fixes the tier.
     under 1000 — nothing won
     1000 — Free Delivery
     2500 — ₹25 Blinkit Cash
     5000 — ₹50 Blinkit Cash
     8000 — District Pass
   `?car=` picks the car by id; everything else is plausible filler.
   ============================================================ */

export default function ResultPreview() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const score = Number(params.get('score') ?? 3000);
  const car = SHOP_CARS.find((c) => c.id === params.get('car')) ?? SHOP_CARS[0];
  const tier = tierFor(score);

  return (
    <>
      <RaceResult
        outcome={{ score, groceries: Math.round(score / 150), seconds: 31.4, finished: true }}
        car={car}
        tier={tier}
        isBest
        totalPoints={score}
        racesLeft={2}
        inviteUrl={`${window.location.origin}/?ref=PREVIEW`}
        onRaceAgain={() => toast('Preview only')}
        onRewards={() => nav('/rewards')}
        onViewCar={() => nav(`/hot-wheels/${car.id}`)}
        onLeaderboard={() => nav('/leaderboard')}
        onExit={() => nav('/')}
        exitLabel="Close preview"
        toast={toast}
      />

      {/* The tier switcher, floated over the top. Not part of the screen being
          previewed — it is the thing that makes previewing it useful. */}
      <div className="rprev">
        {[0, ...REWARD_TIERS.map((t) => t.min)].map((s) => (
          <button
            key={s}
            type="button"
            className={'rprev__b' + (score === s ? ' is-on' : '')}
            onClick={() => setParams({ score: String(s), ...(params.get('car') ? { car: params.get('car')! } : {}) })}
          >
            {s === 0 ? 'none' : s.toLocaleString('en-IN')}
          </button>
        ))}
      </div>
    </>
  );
}
