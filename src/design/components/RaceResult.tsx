import { useEffect, useState, type CSSProperties } from 'react';
import { LEADERBOARD, rupees, type Product } from '../../data/catalog';
import { REWARD_TIERS, type RewardTier } from '../../store/useStore';
import type { RaceOutcome } from '../../lib/three/raceEngine';
import { shareScore } from '../../lib/shareCard';
import { Button } from '../elements';
import { IconClose, IconFlag, IconShare } from '../elements/Icons';

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
      fine: `${tier.perk}, plus free delivery on Blinkit for a month. Yours now.`,
      line: 'District Pass',
      pass: true,
    };
  }
  if (tier.freeDelivery && tier.value === 0) {
    return { head: 'Free', sub: 'Delivery', line: 'free delivery', fine: 'Already on your order. It comes off at checkout.' };
  }
  return {
    head: `${rupees(tier.value)} Off`,
    sub: 'Blinkit Cash',
    /* Named for the sentence it lands in: "Your ₹25 Off is here" is not a
       thing anybody says. */
    line: `${rupees(tier.value)} Blinkit Cash`,
    fine: `In your Blinkit Cash now. It comes off at checkout on any order above ${rupees(tier.value * 2)}.`,
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
  /** The best ever, as it stood BEFORE this run was recorded. */
  bestScore: number;
  totalPoints: number;
  racesLeft: number;
  onRaceAgain: () => void;
  /** Where the reward gets spent. */
  onShop: () => void;
  onRewards: () => void;
  onExit: () => void;
  exitLabel: string;
  toast: (m: string) => void;
};

/** A single-colour icon from the scorecard design (public/rewards/scorecard),
 *  used as a mask so it takes the colour of the text around it. */
const figIcon = (name: 'crown' | 'racetrack' | 'stopwatch' | 'package') =>
  ({ '--src': `url(/rewards/scorecard/${name}.svg)` }) as CSSProperties;

/** The share hint shows once per device: the first result screen only. */
const SHARE_TIP_KEY = 'rih-share-tip-seen';
const SHARE_TIP_MS = 4000;

export function RaceResult({
  outcome, car, tier, isBest, bestScore, totalPoints, racesLeft, inviteUrl,
  onRaceAgain, onShop, onRewards, onExit, exitLabel, toast,
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
  /* Where this total sits on the board, worked out from the board itself. */
  const myRank = LEADERBOARD.filter((r) => r.points > totalPoints).length + 1;
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

      {/* ---- the score, on one plaque ----
          Score, personal best and the run's own figures were three separate
          things stacked down the screen. They are one card now with a tab on
          its top edge, which is what makes it read as a scoreboard rather than
          as a headline followed by some numbers. */}
      <div className="rwd__plaque">
        {/* The design file's scorecard: a yellow ribbon over a chamfered blue
            panel, the points in heavy italic, a personal-best pill, and the
            run's figures under a rule with the file's own icons. */}
        <span className="rwd__tab">
          <i className="rwd__chk" aria-hidden="true" />
          Your points
          <i className="rwd__chk" aria-hidden="true" />
        </span>
        <p className="rwd__score t-num">{shown.toLocaleString('en-IN')}</p>
        {isBest && outcome.score > 0 ? (
          <p className="rwd__pb">
            <i className="rwd__sic rwd__sic--crown" style={figIcon('crown')} aria-hidden="true" />
            New personal best!
          </p>
        ) : (
          <p className="rwd__best">
            Your best <b className="t-num">{Math.max(bestScore, outcome.score).toLocaleString('en-IN')}</b>
          </p>
        )}

        <div className="rwd__stub">
          <div className="rwd__stat">
            <i className="rwd__sic" style={figIcon('racetrack')} aria-hidden="true" />
            <b className="t-num">{outcome.finished ? '2/2' : 'DNF'}</b>
            <span>Laps</span>
          </div>
          <div className="rwd__stat">
            <i className="rwd__sic" style={figIcon('stopwatch')} aria-hidden="true" />
            <b className="t-num">{outcome.seconds}s</b>
            <span>Time</span>
          </div>
          <div className="rwd__stat">
            <i className="rwd__sic" style={figIcon('package')} aria-hidden="true" />
            <b className="t-num">{outcome.groceries}</b>
            <span>Items</span>
          </div>
        </div>
      </div>

      {/* ---- the reward, as two lines on the ground ----
          It was a whole coupon card with its own perforation and stub. The
          reward is already on the order, so the card was a picture of a thing
          that had already happened; what is left to say is what it is and
          where to look at it. */}
      {won ? (
        <p className="rwd__cpn">
          Your{' '}
          <b className={'pass' in won ? 'is-pass' : undefined}>{won.line}</b>{' '}
          is here.
          <button type="button" className="rwd__check" onClick={onRewards}>
            Check your reward
          </button>
        </p>
      ) : (
        <p className="rwd__cpn">
          {next ? 'No rewards yet.' : 'Every tier cleared.'}
          <button type="button" className="rwd__check" onClick={onRewards}>
            {next ? 'See what is next' : 'See your rewards'}
          </button>
        </p>
      )}

      {/* ---- who is ahead ----
          The board was a screen you left this one to reach, then a section in
          a sheet. On the result screen it is the only thing that answers the
          question the score just raised.

          The rows are the leaderboard screen's own: rank, initial, name,
          points, in .lrow. Rebuilding them here would have been a second
          leaderboard free to drift from the first. */}
      <div className="rwd__top">
        <img className="rwd__topim" src="/icons/leaderboard.webp" alt="" />
        <p className="rwd__toph">Top racers</p>
        <div className="rwd__board">
          {LEADERBOARD.slice(0, 3).map((r, i) => (
            <div className="lrow" key={r.name}>
              <span className="lrow__r t-num">{i + 1}</span>
              <span className="lrow__a" aria-hidden="true">{r.name.charAt(0)}</span>
              <span className="grow">
                <b>{r.name}</b>
              </span>
              <span className="lrow__p t-num">{r.points.toLocaleString('en-IN')}</span>
            </div>
          ))}
          <div className="lrow is-me">
            <span className="lrow__r t-num">{myRank}</span>
            <span className="lrow__a" aria-hidden="true">Y</span>
            <span className="grow">
              <b>You</b>
            </span>
            <span className="lrow__p t-num">{totalPoints.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Two, side by side, and nothing underneath. Race again and Shop now
          are the only two things anyone does from here; Rewards, Leaderboard
          and Done were a row of exits under the one button that mattered, and
          the reward link now lives on the ticket where the reward is. */}
      <div className="rwd__foot rwd__foot--pair">
        <Button variant="yellow" size="lg" type="button" disabled={racesLeft <= 0} onClick={onRaceAgain}>
          <IconFlag size={16} />
          {racesLeft > 0 ? 'Race again' : 'No races'}
        </Button>
        <Button variant="primary" size="lg" type="button" onClick={onShop}>
          Shop now
        </Button>
      </div>
    </div>
  );
}
