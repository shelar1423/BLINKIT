import { useNavigate, useSearchParams } from 'react-router-dom';
import { RaceResult } from '../design/components/RaceResult';
import { SHOP_CARS } from '../data/catalog';
import { REWARD_TIERS, tierFor } from '../store/useStore';
import { useToast } from '../App';

/* ============================================================
   The result screen, without the race.

   Deliberately unlinked, like /diag. Checking one line of copy or one button
   on this screen otherwise costs a full race, and the tier it lands on is
   whatever the driving happened to earn, so the one case you want to look at
   is the one you cannot ask for.

   /preview/result?score=3000 renders it at that score, which fixes the tier:
     under 1000 — nothing won
     1000 — Free Delivery
     2500 — ₹25 Blinkit Cash
     5000 — ₹50 Blinkit Cash
     8000 — District Pass
   `?car=` picks the car by id, `?best=` sets the highest score to sit against,
  `?races=0` shows the screen with the day's races spent.
   Everything else is plausible filler, and nothing here is written to the
   store: opening this cannot touch a real score or a real reward.
   ============================================================ */

export default function ResultPreview() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const score = Number(params.get('score') ?? 3000);
  const best = Number(params.get('best') ?? Math.round(score * 1.2));
  const car = SHOP_CARS.find((c) => c.id === params.get('car')) ?? SHOP_CARS[0];
  /* `?races=0` is the spent state, where Race again becomes the invite. */
  const races = Number(params.get('races') ?? 2);

  const set = (s: number) => {
    const next: Record<string, string> = { score: String(s) };
    if (params.get('car')) next.car = params.get('car')!;
    if (params.get('best')) next.best = params.get('best')!;
    if (params.get('races')) next.races = params.get('races')!;
    setParams(next);
  };

  return (
    <div className="rprevhost">
      <RaceResult
        outcome={{ score, groceries: Math.round(score / 150), seconds: 31.4, finished: true }}
        car={car}
        tier={tierFor(score)}
        isBest={score >= best}
        bestScore={best}
        totalPoints={score}
        racesLeft={races}
        inviteUrl={`${window.location.origin}/?ref=PREVIEW`}
        onRaceAgain={() => toast('Preview only')}
        onInvited={() => toast('Preview only')}
        onShop={() => nav('/hot-wheels')}
        onRewards={() => nav('?rewards=1')}
        onExit={() => nav('/')}
        exitLabel="Close preview"
        toast={toast}
      />

      {/* The tier switcher, floated over the top. Not part of the screen being
          previewed: it is the thing that makes previewing it useful. */}
      <div className="rprev">
        {[0, ...REWARD_TIERS.map((t) => t.min)].map((s) => (
          <button key={s} type="button" className={'rprev__b' + (score === s ? ' is-on' : '')} onClick={() => set(s)}>
            {s === 0 ? 'none' : s.toLocaleString('en-IN')}
          </button>
        ))}
      </div>
    </div>
  );
}
