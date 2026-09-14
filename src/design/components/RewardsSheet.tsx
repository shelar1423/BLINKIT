import { useEffect, useState, type CSSProperties } from 'react';
import { Sheet } from './Sheet';
import { rupees } from '../../data/catalog';
import { hasReached, REWARD_TIERS, useStore, type RewardTier } from '../../store/useStore';
import { IconCheck, IconLock, IconTrophy } from '../elements/Icons';

/* ============================================================
   The rewards ladder, as a sheet.

   It replaces the rewards screen, and for a while it replaced the campaign
   hub, the leaderboard and the invite screen too. That made it a hub one
   surface lower. It is only the ladder now: it opens off "Check your reward",
   so the reward is the only thing it owes an answer about. The board lives on
   the result screen, where a score is what raises the question.

   It opens on `?rewards=1`, which means any screen can offer it without owning
   it, the phone's back gesture closes it, and it can be linked to.
   ============================================================ */

/* Each of the four has artwork for the exact reward it names: the scooter for
   free delivery, the notes for each cash tier. The top tier is a partner's
   product, so it carries that partner's own mark. */
const ART: Record<string, string> = {
  start: '/icons/free-delivery.webp',
  check: '/icons/cash-25.webp',
  pit: '/icons/cash-50.webp',
  podium: '/icons/district-pass.webp',
};
/* Rewards whose art is a brand's own tile rather than a cut-out illustration.
   The others sit on a tinted disc; a tile is the mark itself and has to fill
   its slot edge to edge or it reads as a small purple square in a circle. */
const TILE_ART = new Set(['podium']);

/**
 * The reward ladder, as the rewards screen drew it.
 *
 * The lane first: the gap to the next tier as a leg of track rather than a
 * sentence. "2,350 more for District Pass" is a fact; a car part of the way
 * down a lane with the prize at the end is the same fact in the campaign's own
 * language, and it says where you are as well as how far is left. The lane
 * spans the CURRENT leg, so the car moves a visible amount for every race
 * rather than crawling across a track scaled to the whole drop.
 *
 * Then the track itself, whose rail fills to the points earned, so the list is
 * also the progress bar rather than sitting under one.
 *
 * What is NOT here is the claim coupon. Rewards apply themselves now, so a
 * button to accept one would be a step with nothing behind it.
 */
function Ladder() {
  const totalPoints = useStore((s) => s.totalPoints);
  const unlockedRewards = useStore((s) => s.unlockedRewards);
  const claimed = useStore((s) => s.claimedReward);

  const top = REWARD_TIERS[REWARD_TIERS.length - 1].min;
  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const isUnlocked = (t: RewardTier) => hasReached(t, totalPoints, unlockedRewards);
  const earned = REWARD_TIERS.filter(isUnlocked).length;

  /* Measured from the tier last cleared rather than from zero: scaled to the
     whole drop, a race worth 400 points would move the car a pixel and a half. */
  const legFrom = [...REWARD_TIERS].reverse().find((t) => totalPoints >= t.min)?.min ?? 0;
  const legTo = next?.min ?? legFrom;
  const progress = legTo > legFrom ? Math.min(1, Math.max(0, (totalPoints - legFrom) / (legTo - legFrom))) : 1;

  /* It drives there rather than starting there. One frame so the empty lane
     paints first and the transition has something to move from. */
  const [lanePos, setLanePos] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLanePos(progress));
    return () => cancelAnimationFrame(id);
  }, [progress]);

  return (
    <>
      <div className="rwhero rwhero--sheet">
        <span className="rwhero__chequer" aria-hidden="true" />
        <p className="rwhero__k">Your points</p>
        <p className="rwhero__v t-num">{totalPoints.toLocaleString('en-IN')}</p>
        {next ? (
          <div className="rwlane" style={{ '--p': lanePos } as CSSProperties}>
            <div className="rwlane__road">
              <span className="rwlane__done" />
            </div>
            <img className="rwlane__car" src="/cars/lane-car.webp" alt="" />
            <img
              className={'rwlane__prize' + (TILE_ART.has(next.id) ? ' is-tile' : '')}
              src={ART[next.id]}
              alt=""
            />
            <p className="rwlane__l">
              <b>{(next.min - totalPoints).toLocaleString('en-IN')}</b> points to {next.label}
            </p>
          </div>
        ) : (
          <p className="rwhero__s rwhero__s--done">
            <IconTrophy size={16} /> Every tier unlocked
          </p>
        )}
      </div>

      <div className="seccount">
        <h2 className="seccount__t">Your rewards</h2>
        <span className="seccount__n">
          {earned} of {REWARD_TIERS.length} unlocked
        </span>
      </div>

      <div className="rwtrack">
        <span
          className="rwtrack__fill"
          style={{ height: `${Math.min(100, (totalPoints / top) * 100)}%` }}
          aria-hidden="true"
        />
        {REWARD_TIERS.map((t) => {
          const unlocked = isUnlocked(t);
          const riding = claimed?.id === t.id;
          return (
            <div key={t.id} className={'rwstop' + (unlocked ? ' is-on' : '')}>
              <span className="rwstop__pin" aria-hidden="true">
                {unlocked ? <IconCheck size={12} /> : <IconLock size={11} />}
              </span>
              <span className={'rwstop__art' + (TILE_ART.has(t.id) ? ' is-tile' : '')}>
                <img src={ART[t.id]} alt="" loading="lazy" />
              </span>
              <div className="grow">
                <b className="rwstop__t">{t.label}</b>
                <span className="rwstop__s">
                  {t.min.toLocaleString('en-IN')} pts
                  {t.value > 0 ? ` · ${rupees(t.value)} off` : t.perk ? ` · ${t.perk}` : ''}
                </span>
              </div>
              {riding ? (
                <span className="chip chip--live">On your order</span>
              ) : unlocked ? (
                <span className="chip chip--on">Earned</span>
              ) : (
                <span className="rwstop__gap t-num">
                  {(t.min - totalPoints).toLocaleString('en-IN')}
                  <small>to go</small>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RewardsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    /* Just the ladder.
     *
     * It carried a tally, a city board and an invite as well, which made it a
     * campaign hub in a sheet: the same collection of everything the hub
     * screen was, one surface lower. This opens off "Check your reward", so
     * the reward is the only thing it owes an answer about. The board lives on
     * the result screen where a score raises the question, and the points are
     * already at the top of the lane. */
    <Sheet open={open} onClose={onClose} title="Rewards">
      <div className="cmp">
        <Ladder />
      </div>
    </Sheet>
  );
}
