import { useNavigate, useSearchParams } from 'react-router-dom';
import { RaceResult } from '../design/components/RaceResult';
import { HERO_CARS } from '../data/catalog';
import { REWARD_TIERS } from '../store/useStore';
import type { RaceOutcome } from '../lib/three/raceEngine';
import { useToast } from '../App';
import { DriftLoader } from '../design/components/DriftLoader';

/**
 * TEMPORARY — the race result screen without racing, for design review.
 * Delete this file and its route in App.tsx when done.
 *
 *   /preview/result                 won ₹25 Blinkit Cash
 *   ?tier=start|check|pit|podium    pick the reward
 *   ?tier=none                      no reward (Race again)
 *   ?car=kitt                       which car drifts
 *   ?best=1                         show "New personal best"
 *   ?loader=1                       the race loader instead
 *   the share hint always shows here; in the app it shows once per device
 *   ?score=4750&groceries=16&seconds=29&dnf=1
 */
export default function ResultPreview() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [q] = useSearchParams();
  const tierId = q.get('tier') ?? 'check';
  const tier = tierId === 'none' ? null : REWARD_TIERS.find((t) => t.id === tierId) ?? REWARD_TIERS[1];
  const car = HERO_CARS.find((c) => c.id === q.get('car')) ?? HERO_CARS[0];
  const score = Number(q.get('score') ?? 4750);
  const outcome = {
    score,
    groceries: Number(q.get('groceries') ?? 16),
    seconds: Number(q.get('seconds') ?? 29),
    finished: !q.get('dnf'),
  } as RaceOutcome;

  if (q.get('loader')) return <DriftLoader />;

  return (
    <RaceResult
      inviteUrl={location.origin}
      outcome={outcome}
      car={car}
      tier={tier}
      isBest={!!q.get('best')}
      totalPoints={score}
      racesLeft={2}
      onRaceAgain={() => toast('Race again tapped')}
      onRewards={() => nav('/rewards')}
      onViewCar={() => nav(`/hot-wheels/${car.id}`)}
      onLeaderboard={() => nav('/leaderboard')}
      onExit={() => nav('/campaign')}
      exitLabel="Campaign"
      toast={toast}
      forceShareTip
    />
  );
}
