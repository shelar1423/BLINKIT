import { useEffect, useState } from 'react';
import { HERO_CARS, rupees, type Product } from '../../data/catalog';
import { REWARD_TIERS, type RewardTier } from '../../store/useStore';
import type { RaceOutcome } from '../../lib/three/raceEngine';
import { shareScore } from '../../lib/shareCard';
import { IconBasket, IconBolt, IconClose, IconFlag, IconShare } from '../elements/Icons';

/* ============================================================
   The screen you land on when the race ends.

   Built on Blinkit's own reward screen, which is the right reference because
   this IS one of those: you played something and won Blinkit credit. That
   screen is four things and no more — a sunburst ground, the score at a size
   nothing else competes with, the prize as a perforated ticket, and one dark
   button. The goods the prize is good for sit underneath, tilted, running off
   both edges so the screen feels fuller than its frame.

   What it is NOT is a stack of equal-weight panels. This used to be a stage,
   then a three-cell stat strip, then a coupon, then four buttons — five blocks
   of similar size and volume, so the score, the thing you came for, carried no
   more weight than the leaderboard link. The stats still matter, but they are
   a caption under the number now, not a third of the page.
   ============================================================ */

/** The prize, phrased for a ticket: a headline you can read across the room. */
function prize(tier: RewardTier) {
  if (tier.freeDelivery && tier.value === 0) {
    return { head: 'FREE', sub: 'DELIVERY', fine: 'Applied automatically on your next Blinkit order' };
  }
  if (tier.id === 'podium') {
    return { head: 'GOLD', sub: '1 MONTH FREE', fine: 'Zomato Gold, plus free delivery on Blinkit for a month' };
  }
  return {
    head: `${rupees(tier.value)} OFF`,
    sub: 'BLINKIT CASH',
    fine: `Credited as Blinkit Cash and usable on any order above ${rupees(tier.value * 2)}`,
  };
}

export type RaceResultProps = {
  /** The sharer's referral link, so a share is also an invite. */
  inviteUrl: string;
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
  outcome, car, tier, isBest, totalPoints, racesLeft, inviteUrl,
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
  const won = tier ? prize(tier) : null;

  /* The cars the credit is for, the way the reference lines up the ice creams
     its coupon is good on. The one just raced leads. */
  const goods = [car, ...HERO_CARS.filter((p) => p.id !== car.id)].slice(0, 3);

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
      inviteUrl,
    );
    setSharing(false);
    if (how === 'copied') toast('Score copied to share');
    if (how === 'link') toast('Shared');
  };

  return (
    <div className="rwd">
      <div className="rwd__bar">
        <button className="rwd__ic" type="button" aria-label={exitLabel} onClick={onExit}>
          <IconClose size={19} />
        </button>
        <span className="grow" />
        <button className="rwd__ic" type="button" aria-label="Share score" onClick={share} disabled={sharing}>
          <IconShare size={18} />
        </button>
      </div>

      <p className="rwd__kick">Your score</p>
      <p className="rwd__score t-num">{shown.toLocaleString('en-IN')}</p>

      {/* The run itself, as a caption under the number rather than a third
          panel competing with it. */}
      <p className="rwd__stats">
        <span><IconBasket size={14} />{outcome.groceries} groceries</span>
        <i aria-hidden="true" />
        <span><IconBolt size={14} />{outcome.seconds}s</span>
        <i aria-hidden="true" />
        <span><IconFlag size={14} />{outcome.finished ? '2 / 2 laps' : 'DNF'}</span>
      </p>
      {isBest && outcome.score > 0 && <p className="rwd__pb">New personal best</p>}

      <div className="rwd__ticket">
        {won ? (
          <>
            <p className="rwd__won">You won</p>
            <p className="rwd__amt">{won.head}</p>
            <p className="rwd__upto">{won.sub}</p>
            <span className="rwd__perf" aria-hidden="true" />
            <p className="rwd__fine">{won.fine}</p>
          </>
        ) : (
          <>
            <p className="rwd__won">Next reward</p>
            <p className="rwd__amt rwd__amt--sm">{next ? next.label : 'All unlocked'}</p>
            <p className="rwd__upto">
              {next ? `${(next.min - totalPoints).toLocaleString('en-IN')} POINTS TO GO` : 'EVERY TIER CLEARED'}
            </p>
            <span className="rwd__perf" aria-hidden="true" />
            <p className="rwd__fine">
              {next
                ? 'Keep racing — every run adds to the same total.'
                : 'Every reward in this drop is yours.'}
            </p>
          </>
        )}
      </div>

      <div className="rwd__goods" aria-hidden="true">
        {goods.map((p) => (
          <img key={p.id} src={p.image} alt="" />
        ))}
      </div>

      <div className="rwd__foot">
        {tier ? (
          <button className="rwd__cta" type="button" onClick={() => onClaim(tier)}>
            Redeem Offer
          </button>
        ) : (
          <button className="rwd__cta" type="button" disabled={racesLeft <= 0} onClick={onRaceAgain}>
            {racesLeft > 0 ? `Race again · ${racesLeft} left` : 'No races left today'}
          </button>
        )}
        {/* Quiet, because the screen is allowed exactly one loud thing. */}
        <div className="rwd__minor">
          {tier && racesLeft > 0 && (
            <button type="button" onClick={onRaceAgain}>Race again</button>
          )}
          <button type="button" onClick={onLeaderboard}>Leaderboard</button>
          <button type="button" onClick={onExit}>{exitLabel}</button>
        </div>
      </div>
    </div>
  );
}
