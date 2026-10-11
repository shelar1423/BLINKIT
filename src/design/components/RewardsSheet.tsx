import { Sheet } from './Sheet';
import { FINAL_PRIZE, REWARD_TIERS, useStore } from '../../store/useStore';
import { useDrop } from '../../data/useDrop';
import { useRacerDeal } from '../../lib/racerDeal';
import { useLeft } from './RacerDealChrome';
import { IconCheck, IconLock } from '../elements/Icons';
import './racerDeal.css';

/* ============================================================
   Rewards, as one system.

   Points climb a single discount ladder on Hot Wheels: 5%, 10%, 15%, 20%.
   The step reached is the racer price, on every car, for 24 hours. The sheet
   says three things, in this order:

   1. what is on right now, and until when;
   2. the ladder, with the player's step marked and the gap to the next;
   3. the city leaderboard's own prize, settled once when the drop closes.

   It used to stack a cash ladder (free delivery, ₹25, ₹50, District Pass)
   under a discount card: two reward systems that answered the same question
   differently. There is one now.

   It opens on `?rewards=1`, so any screen can offer it without owning it.
   ============================================================ */

function Now() {
  const deal = useRacerDeal();
  const left = useLeft(deal?.until);
  const points = useStore((s) => s.totalPoints);
  const first = REWARD_TIERS[0];

  if (deal) {
    return (
      <div className="rrw__now">
        <b className="rtk t-num">{deal.pct}% OFF</b>
        <div className="grow">
          <b className="rrw__t">On every Hot Wheels car</b>
          <p className="rrw__s">
            Ends in <b className="t-num">{left}</b>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rrw__now is-off">
      <b className="rtk t-num">{first.pct}% OFF</b>
      <div className="grow">
        <b className="rrw__t">{points >= first.min ? 'Race again to turn it on' : 'Unlocks at 1,000 pts'}</b>
        <p className="rrw__s">On every Hot Wheels car, for 24 hours</p>
      </div>
    </div>
  );
}

function Ladder() {
  const points = useStore((s) => s.totalPoints);
  const deal = useRacerDeal();
  const reached = REWARD_TIERS.filter((t) => points >= t.min);
  const step = reached[reached.length - 1];
  const top = REWARD_TIERS[REWARD_TIERS.length - 1].min;

  return (
    <section className="rlad">
      <div className="seccount">
        <h2 className="seccount__t">Discount ladder</h2>
        <span className="seccount__n t-num">{points.toLocaleString('en-IN')} pts</span>
      </div>
      <div className="rwtrack">
        <span className="rwtrack__fill" style={{ height: `${Math.min(100, (points / top) * 100)}%` }} aria-hidden="true" />
        {REWARD_TIERS.map((t) => {
          const on = points >= t.min;
          const current = t === step;
          return (
            <div key={t.id} className={'rwstop' + (on ? ' is-on' : '') + (current ? ' is-now' : '')}>
              <span className="rwstop__pin" aria-hidden="true">
                {on ? <IconCheck size={12} /> : <IconLock size={11} />}
              </span>
              <b className={'rtk rtk--art t-num' + (on ? '' : ' is-locked')}>{t.pct}% OFF</b>
              {/* The ticket says the percentage; the row only owes the price of it. */}
              <div className="grow">
                <b className="rwstop__t t-num">{t.min.toLocaleString('en-IN')} pts</b>
              </div>
              {current ? (
                <span className="chip chip--live">{deal ? 'Active' : 'Reached'}</span>
              ) : on ? (
                <span className="rwstop__done">Passed</span>
              ) : (
                <span className="rwstop__gap t-num">
                  {(t.min - points).toLocaleString('en-IN')}
                  <small>to go</small>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The leaderboard's prize. The drop runs three days, so the board is settled
 * once, when it closes: whoever is top 3 in their city then wins. Until then it
 * only reports where you stand and how long is left.
 */
function Finale() {
  const { status } = useDrop();
  const over = !status.remaining;
  return (
    <div className="rwk">
      <img src="/icons/leaderboard.webp" alt="" />
      <div className="grow">
        {/* An invitation, not a status report: what to do, then when it counts. */}
        <b>{over ? 'Final leaderboard is in' : `Finish top ${FINAL_PRIZE.top} to win a District Pass`}</b>
        <span>{over ? 'Top 3 in each city win a District Pass' : `Final leaderboard when the drop ends · ${status.remaining}`}</span>
      </div>
    </div>
  );
}

export function RewardsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Rewards">
      <div className="cmp rrw">
        <Now />
        <Ladder />
        <Finale />
      </div>
    </Sheet>
  );
}
