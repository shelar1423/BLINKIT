import { useEffect, useState } from 'react';
import { rupees, type Product } from '../../data/catalog';
import { REWARD_TIERS, type RewardTier } from '../../store/useStore';
import type { RaceOutcome } from '../../lib/three/raceEngine';
import { shareScore } from '../../lib/shareCard';
import { Button } from '../elements';
import { IconBasket, IconChevronRight, IconClock, IconClose, IconFlag, IconShare } from '../elements/Icons';

/* ============================================================
   The screen you land on when the race ends.

   A Hot Wheels blue ground, the score at a size nothing else competes with,
   the prize as a ticket with the run's stats in its stub, and one yellow
   button.
   ============================================================ */

/** The prize, phrased for a ticket: a headline you can read across the room. */
function prize(tier: RewardTier) {
  /* Named perks are tested first. Every tier carries free delivery, and
     District Pass has no cash value, so the `freeDelivery && !value` branch
     below would otherwise swallow it and announce the top reward of the drop
     as "FREE DELIVERY". */
  if (tier.perk) {
    /* The one prize that is not Blinkit's. District is its own brand with its
       own colour, so the headline wears that instead of the action green every
       other tier is paid in. */
    return {
      head: 'District Pass',
      sub: '1 Month',
      fine: `${tier.perk}, plus free delivery on Blinkit for a month`,
      pass: true,
    };
  }
  if (tier.freeDelivery && tier.value === 0) {
    return { head: 'Free', sub: 'Delivery', fine: 'Applied automatically on your next Blinkit order' };
  }
  return {
    head: `${rupees(tier.value)} Off`,
    sub: 'Blinkit Cash',
    fine: `Added to your Blinkit Cash wallet. Use it on any order above ${rupees(tier.value * 2)}`,
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
  onRaceAgain: () => void;
  onRewards: () => void;
  /** Opens the product page of the car that was raced. */
  onViewCar: () => void;
  onLeaderboard: () => void;
  onExit: () => void;
  exitLabel: string;
  toast: (m: string) => void;
};

/** The share hint shows once per device: the first result screen only. */
const SHARE_TIP_KEY = 'rih-share-tip-seen';
const SHARE_TIP_MS = 4000;

export function RaceResult({
  outcome, car, tier, isBest, totalPoints, racesLeft, inviteUrl,
  onRaceAgain, onRewards, onViewCar, onLeaderboard, onExit, exitLabel, toast,
}: RaceResultProps) {
  /* The number counts up. A score that is simply present reads as a fact; one
     that arrives reads as something you earned. */
  const [shown, setShown] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [tip, setTip] = useState(false);

  /* A speech bubble off the share button, the first time this screen appears:
     sharing is how you earn another race, and nothing else here says so. It
     arrives after the screen has settled and leaves on its own. */
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SHARE_TIP_KEY) === '1';
      localStorage.setItem(SHARE_TIP_KEY, '1');
    } catch {
      /* storage blocked: show it */
    }
    if (seen) return;
    const on = window.setTimeout(() => setTip(true), 900);
    const off = window.setTimeout(() => setTip(false), 900 + SHARE_TIP_MS);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, []);

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
  const shortName = car.name.replace('Hot Wheels ', '').replace(' Die Cast Car', '');
  /* Blinkit Cash applies on orders above twice its value. */
  const cashOff = tier && tier.value > 0 && car.price > tier.value * 2 ? tier.value : 0;
  const won = tier ? prize(tier) : null;

  const share = async () => {
    setSharing(true);
    const how = await shareScore(
      {
        score: outcome.score,
        groceries: outcome.groceries,
        seconds: outcome.seconds,
        finished: outcome.finished,
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
        <span className="rwd__sharewrap">
          <button
            className="rwd__ic"
            type="button"
            aria-label="Share score"
            onClick={() => {
              setTip(false);
              void share();
            }}
            disabled={sharing}
          >
            <IconShare size={18} />
          </button>
          {tip && (
            <span className="rwd__tip" role="status">
              Challenge a friend, <b>get +1 race</b>
            </span>
          )}
        </span>
      </div>

      <p className="rwd__kick">Your score</p>
      <p className="rwd__score t-num">{shown.toLocaleString('en-IN')}</p>

      {/* Always in the flow, even when there is nothing to boast about.
          Rendered only on a personal best, it took its height with it when it
          went — so the ticket, the stub and everything under them sat higher on
          any run that was not a best, including every run that won nothing. The
          screen has one layout, and the pill is either in it or invisible in
          it. */}
      <p
        className={'rwd__pb' + (isBest && outcome.score > 0 ? '' : ' is-ghost')}
        aria-hidden={!(isBest && outcome.score > 0)}
      >
        New Personal Best
      </p>

      <div className="rwd__ticket">
        <div className="rwd__card">
          <div className="rwd__body">
            {won ? (
              <>
                <p className="rwd__won">You Won</p>
                <p className={'rwd__amt' + ('pass' in won ? ' rwd__amt--pass' : '')}>{won.head}</p>
                <p className="rwd__upto">
                  {won.sub === 'Blinkit Cash' ? (
                    <span className="rwd__brand">
                      Blink<em>it</em> Cash
                    </span>
                  ) : (
                    won.sub
                  )}
                </p>
                <p className="rwd__fine">{won.fine}</p>
              </>
            ) : (
              <>
                {/* Nothing was won, and this half of the ticket says only that.
                    It used to lead with the NEXT tier's name, set big in the
                    green a prize is written in, which reads as free delivery
                    you already have. There is no prize to name here, so it
                    names none. */}
                <p className="rwd__amt rwd__amt--none">
                  {next ? 'No rewards yet' : 'Every tier cleared'}
                </p>
                <p className="rwd__fine">
                  {next
                    ? 'Keep racing, every run adds to the same total.'
                    : 'Every reward in this drop is yours.'}
                </p>
              </>
            )}
          </div>
          {/* The run itself, in the ticket's stub. The cash is already in the
              wallet, so there is no code to show here. */}
          <div className="rwd__stub">
            <div className="rwd__stat">
              <IconBasket size={20} />
              <b className="t-num">{outcome.groceries}</b>
              <span>Groceries</span>
            </div>
            <div className="rwd__stat">
              <IconClock size={20} />
              <b className="t-num">{outcome.seconds}s</b>
              <span>Time</span>
            </div>
            <div className="rwd__stat">
              <IconFlag size={20} />
              <b className="t-num">{outcome.finished ? '2/2' : 'DNF'}</b>
              <span>Laps</span>
            </div>
          </div>
        </div>
      </div>

      {/* The car you raced, with what it costs once the cash just won is
          taken off. Quiet on purpose: a row, not a banner. */}
      <button className="rwd__own" type="button" onClick={onViewCar}>
        <img className="rwd__ownim" src={car.image} alt="" />
        <span className="rwd__ownt">
          <b>Take the {shortName} home</b>
          {cashOff > 0 ? (
            <span>
              {rupees(car.price)} · <em>{rupees(car.price - cashOff)} with your cash</em>
            </span>
          ) : (
            <span>{rupees(car.price)} · delivered in minutes</span>
          )}
        </span>
        <IconChevronRight size={16} />
      </button>

      <div className="rwd__foot">
        <Button variant="yellow" size="lg" block type="button" disabled={racesLeft <= 0} onClick={onRaceAgain}>
          <IconFlag size={17} />
          {racesLeft > 0 ? 'Race again' : 'No races left today'}
        </Button>
        {/* Quiet, because the screen is allowed exactly one loud thing. The
            reward is claimed from Rewards. */}
        <div className="rwd__minor">
          <button type="button" onClick={onRewards}>Rewards</button>
          <button type="button" onClick={onLeaderboard}>Leaderboard</button>
          <button type="button" onClick={onExit}>{exitLabel}</button>
        </div>
      </div>
    </div>
  );
}
