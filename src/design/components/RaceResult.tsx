import { useEffect, useState } from 'react';
import { Button } from '../elements';
import { rupees, type Product } from '../../data/catalog';
import { REWARD_TIERS, type RewardTier } from '../../store/useStore';
import type { RaceOutcome } from '../../lib/three/raceEngine';
import { shareScore } from '../../lib/shareCard';
import { IconBasket, IconBolt, IconCheck, IconFlag, IconShare, IconTrophy } from '../elements/Icons';

/* ============================================================
   The screen you land on when the race ends.

   It used to be a column of centred text in three weights, then three
   identical bordered boxes, then a row, then buttons — everything the same
   width, the same grey, at the same volume. Nothing in it was the point.

   The score is the point, so it gets a stage of its own: dark, chequer-edged,
   the car standing on it, the number set larger than anything else in the app.
   Everything below steps down from there — a single stat strip rather than
   three boxes, and then the one thing you can act on.

   The reward is a coupon, not a list row. You are collecting something, and a
   perforated ticket with a torn edge says that; a bordered rectangle with a
   green tint says "notification". When there is no reward yet, the same space
   shows the track to the next tier, which is the useful thing to know — it
   replaces a sentence that only told you the number you already missed.
   ============================================================ */

const REWARD_ART: Record<string, string> = {
  start: '/rewards/25-02-free-delivery-badge.webp',
  check: '/rewards/25-01-gold-coin.webp',
  pit: '/rewards/25-03-wallet-reward-token.webp',
  podium: '/rewards/25-06-premium-membership-icon.webp',
};

export type RaceResultProps = {
  outcome: RaceOutcome;
  car: Product;
  tier: RewardTier | null;
  /** Beat the previous best — captured before the store recorded this run. */
  isBest: boolean;
  totalPoints: number;
  racesLeft: number;
  onClaim: (tier: RewardTier) => void;
  onRaceAgain: () => void;
  onLeaderboard: () => void;
  onExit: () => void;
  exitLabel: string;
  toast: (m: string) => void;
};

export function RaceResult({
  outcome, car, tier, isBest, totalPoints, racesLeft,
  onClaim, onRaceAgain, onLeaderboard, onExit, exitLabel, toast,
}: RaceResultProps) {
  /* The number counts up. A score that is simply present reads as a fact; one
     that arrives reads as something you earned. */
  const [shown, setShown] = useState(0);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const target = outcome.score;
    if (target <= 0) return;
    const start = performance.now();
    const DUR = 900;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      // ease-out: fast first, settling into the final figure
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [outcome.score]);

  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const share = async () => {
    setSharing(true);
    const how = await shareScore(
      {
        score: outcome.score,
        groceries: outcome.groceries,
        seconds: outcome.seconds,
        carName: car.name.replace('Hot Wheels ', ''),
        carImage: car.image,
        reward: tier?.label,
      },
      `${window.location.origin}/`,
    );
    setSharing(false);
    if (how === 'copied') toast('Score copied to share');
    if (how === 'link') toast('Shared');
  };

  return (
    <div className="result">
      {/* ---- the stage: score, car, verdict ---- */}
      <div className="rstage">
        <span className="rstage__chequer" aria-hidden="true" />
        <p className="rstage__kick">
          {outcome.finished ? <IconFlag size={13} /> : <IconBolt size={13} />}
          {outcome.finished ? 'Race complete' : 'Time up'}
        </p>

        <img className="rstage__car" src={car.image} alt="" />

        <p className="rstage__score t-num">{shown.toLocaleString('en-IN')}</p>
        <p className="rstage__unit">points</p>

        {isBest && outcome.score > 0 && (
          <span className="rstage__pb">
            <IconTrophy size={13} /> New personal best
          </span>
        )}
      </div>

      {/* ---- one strip, not three boxes ---- */}
      <div className="rstrip">
        <div>
          <IconBasket size={17} />
          <b className="t-num">{outcome.groceries}</b>
          <span>Groceries</span>
        </div>
        <i aria-hidden="true" />
        <div>
          <IconBolt size={17} />
          <b className="t-num">{outcome.seconds}s</b>
          <span>Your time</span>
        </div>
        <i aria-hidden="true" />
        <div>
          <IconFlag size={17} />
          <b>{outcome.finished ? '2 / 2' : 'DNF'}</b>
          <span>Laps</span>
        </div>
      </div>

      {/* ---- the reward, as something to collect ---- */}
      {tier ? (
        <div className="coupon">
          <div className="coupon__top">
            <span className="coupon__art">
              <img src={REWARD_ART[tier.id]} alt="" />
            </span>
            <div className="grow">
              <p className="coupon__k">Reward unlocked</p>
              <b className="coupon__v">{tier.label}</b>
              <span className="coupon__s">
                {tier.value > 0 ? `${rupees(tier.value)} off your next order` : 'Free delivery, applied at checkout'}
              </span>
            </div>
          </div>
          <span className="coupon__tear" aria-hidden="true" />
          <div className="coupon__foot">
            <Button variant="primary" block type="button" onClick={() => onClaim(tier)}>
              <IconCheck size={17} /> Claim reward
            </Button>
          </div>
        </div>
      ) : (
        <div className="rtrack">
          <p className="rtrack__k">Next reward</p>
          <div className="rtrack__bar">
            <i style={{ width: `${Math.min(100, (totalPoints / REWARD_TIERS[REWARD_TIERS.length - 1].min) * 100)}%` }} />
            {REWARD_TIERS.map((t) => (
              <span
                key={t.id}
                className={'rtrack__pip' + (totalPoints >= t.min ? ' is-on' : '')}
                style={{ left: `${(t.min / REWARD_TIERS[REWARD_TIERS.length - 1].min) * 100}%` }}
                title={t.label}
              />
            ))}
          </div>
          <p className="rtrack__s">
            {next ? (
              <>
                <b>{(next.min - totalPoints).toLocaleString('en-IN')} points</b> to {next.label}
              </>
            ) : (
              'Every tier unlocked.'
            )}
          </p>
        </div>
      )}

      {/* ---- what to do next ---- */}
      <div className="racts">
        <Button variant="hwBlue" size="lg" block type="button" disabled={racesLeft <= 0} onClick={onRaceAgain}>
          <IconFlag size={17} />
          {racesLeft > 0 ? `Race again · ${racesLeft} left` : 'No races left today'}
        </Button>
        <Button variant="outline" block type="button" onClick={share} disabled={sharing}>
          <IconShare size={16} /> {sharing ? 'Preparing…' : 'Share your score'}
        </Button>
        <div className="racts__row">
          <Button variant="outline" type="button" onClick={onLeaderboard}>
            Leaderboard
          </Button>
          <Button variant="outline" type="button" onClick={onExit}>
            {exitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
