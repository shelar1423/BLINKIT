import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { LEADERBOARD, rupees } from '../data/catalog';
import { hasReached, REWARD_TIERS, useStore, type RewardTier } from '../store/useStore';
import { useToast } from '../App';
import { IconCheck, IconChevronRight, IconLock, IconTrophy } from '../design/elements/Icons';

/** How long the claimed coupon takes to fold away and hand its space back. */
const CLOSE_MS = 420;

/* ============================================================
   Racing rewards.

   This was a points card, a decorative strip, and then four identical rows
   that differed only by the word in the button. Nothing in it told you where
   you were or what to do next, and the one reward you could actually claim
   looked exactly like the three you could not.

   Now the state changes the shape, not just the colour:

   - The points sit on the same dark stage the race result uses, so arriving
     here after a race is continuous with the screen you came from.
   - The next reward you have earned and not yet spent is a coupon, full width,
     with the claim inside it. One thing to act on.
   - Everything else is a station on a track, with the rail showing how far the
     points have carried you. A locked tier is quiet and says what it costs.
   ============================================================ */

/* Each of the four has artwork for the exact reward it names — the scooter for
   free delivery, the notes for each cash tier — rather than a generic coin or
   wallet standing in. The top tier is a partner's product, so it carries that
   partner's own mark. */
const ART: Record<string, string> = {
  start: '/icons/free-delivery.webp',
  check: '/icons/cash-25.webp',
  pit: '/icons/cash-50.webp',
  podium: '/icons/district-pass.webp',
};

/* Rewards whose art is a brand's own tile rather than a cut-out illustration.
   The others are objects sitting on a tinted disc; a tile is the mark itself
   and has to fill its slot edge to edge, or it reads as a small purple square
   floating in a green circle. */
const TILE_ART = new Set(['podium']);

export default function Rewards() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { totalPoints, unlockedRewards, claimReward, claimedReward } = useStore();

  const top = REWARD_TIERS[REWARD_TIERS.length - 1].min;
  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const isUnlocked = (t: RewardTier) => hasReached(t, totalPoints, unlockedRewards);
  /* The LOWEST tier that is earned and still unspent — the next one to take,
     not the best one available. Reaching for the top tier first meant a player
     who had cleared everything was offered the partner membership before the
     free delivery they earned at 1,000 points, and only one reward can be held
     at a time, so the three underneath it were never the thing on offer. They
     come off in the order they were won. */
  const claimable = REWARD_TIERS.find((t) => isUnlocked(t) && claimedReward?.id !== t.id);

  /* What a tier gives you, in a phrase. Money off, a partner's perk, or the
     free delivery that every tier carries. */
  const benefit = (t: (typeof REWARD_TIERS)[number]) =>
    t.value > 0 ? `${rupees(t.value)} off your next order` : t.perk ?? 'Free delivery, applied at checkout';

  const earned = REWARD_TIERS.filter((t) => isUnlocked(t)).length;

  /* Where this score puts you in the city — worked out the same way the
     Leaderboard works it out, so the number on the link matches the number on
     the page it opens. */
  const cityRank =
    [...LEADERBOARD.map((r) => r.points), totalPoints]
      .sort((a, b) => b - a)
      .indexOf(totalPoints) + 1;

  /* How far along the current leg the car sits, 0 to 1. Measured from the tier
     last cleared rather than from zero: scaled to the whole drop, a race worth
     400 points would move the car a pixel and a half. */
  const legFrom = [...REWARD_TIERS].reverse().find((t) => totalPoints >= t.min)?.min ?? 0;
  const legTo = next?.min ?? legFrom;
  const progress = legTo > legFrom ? Math.min(1, Math.max(0, (totalPoints - legFrom) / (legTo - legFrom))) : 1;

  /* It drives there rather than starting there. One rAF so the empty lane
     paints first and the transition has something to move from. */
  const [lanePos, setLanePos] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLanePos(progress));
    return () => cancelAnimationFrame(id);
  }, [progress]);

  /* Claiming used to commit the reward and jump straight to the cart, so the
     coupon vanished as a side effect of the page changing under you and you
     never saw it go.

     Now it folds away where it stands and the list rises into the space it
     leaves. The store is written only once the fold has finished: `claimable`
     is derived from it, so committing first would unmount the coupon on the
     same frame and there would be nothing left to animate. The height is
     measured rather than transitioned off `auto`, and the negative bottom
     margin cancels the grid gap the row would otherwise keep holding open. */
  const couponRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const claim = (id: string, label: string) => {
    if (closing.current) return;
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      closing.current = false;
      claimReward(id);
      toast(`${label} applied — it comes off at checkout`);
    };
    const el = couponRef.current;
    if (!el || typeof el.animate !== 'function') return commit();
    closing.current = true;
    const h = el.getBoundingClientRect().height;
    const fold = el.animate(
      [
        { height: `${h}px`, opacity: 1, marginBottom: '0px', transform: 'scale(1)' },
        { height: '0px', opacity: 0, marginBottom: '-14px', transform: 'scale(0.97)' },
      ],
      { duration: CLOSE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    );
    fold.onfinish = commit;
    fold.oncancel = commit;
    /* The reward is the point; the fold is decoration. A backgrounded tab can
       stall an animation's timeline indefinitely, and `commit` is idempotent,
       so a wall-clock backstop guarantees the claim lands either way. */
    window.setTimeout(commit, CLOSE_MS + 300);
  };

  return (
    <>
      <PageHeader
        title="Racing rewards"
        onBack={() => nav('/campaign')}
      />
      <main className="page rwpage">
        <div className="rwhero">
          <span className="rwhero__chequer" aria-hidden="true" />
          <p className="rwhero__k">Your points</p>
          <p className="rwhero__v t-num">{totalPoints.toLocaleString('en-IN')}</p>
          {/* The gap to the next reward, as a leg of track rather than a
              sentence. "2,350 more for District Pass" is a fact; a car part of
              the way down a lane with the flag at the end is the same fact in
              the campaign's own language, and it says where you are as well as
              how far is left. The lane spans the CURRENT leg — from the tier
              you last cleared to the one ahead — so the car moves a visible
              amount for every race rather than crawling across a track scaled
              to the whole drop. */}
          {next ? (
            <div className="rwlane" style={{ '--p': lanePos } as CSSProperties}>
              {/* The road clips its own surface so the driven stretch keeps a
                  rounded end. The car and the flag sit OUTSIDE it for exactly
                  that reason — inside, the clip took the car's shadow and most
                  of the flag with it. */}
              <div className="rwlane__road">
                <span className="rwlane__done" />
              </div>
              <img className="rwlane__car" src="/cars/lane-car.webp" alt="" />
              {/* What is at the end of the lane is the thing you are driving
                  towards, not a generic finish. A chequered flag says "the end
                  of a race"; the reward's own art says which reward, and the
                  label underneath then only has to carry the number. */}
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
            <p className="rwhero__s">
              <IconTrophy size={13} /> Every tier unlocked
            </p>
          )}
        </div>

        <div className="shell rwbody">
          {claimable && (
            <div className="coupon" ref={couponRef}>
              <div className="coupon__top">
                <span className={'coupon__art' + (TILE_ART.has(claimable.id) ? ' is-tile' : '')}>
                  <img src={ART[claimable.id]} alt="" />
                </span>
                <div className="grow">
                  <p className="coupon__k">Ready to claim</p>
                  <b className="coupon__v">{claimable.label}</b>
                  <span className="coupon__s">{benefit(claimable)}</span>
                </div>
              </div>
              <span className="coupon__tear" aria-hidden="true" />
              <div className="coupon__foot">
                <Button variant="primary" block type="button" onClick={() => claim(claimable.id, claimable.label)}>
                  <IconCheck size={17} /> Claim reward
                </Button>
              </div>
            </div>
          )}

          {/* The list needed naming. Four rows arriving straight off the
              coupon read as more of the coupon — the same offer, repeated —
              rather than as the record of everything this drop has given you.
              The count opposite is the one-line version of the whole list. */}
          <section className="rwlist">
            <div className="rwsec">
              <h2 className="rwsec__t">Your rewards</h2>
              <span className="rwsec__n">
                {earned} of {REWARD_TIERS.length} unlocked
              </span>
            </div>

          {/* The track. The rail fills to the points earned, so the list is
              also the progress bar rather than sitting under one. */}
          <div className="rwtrack">
            <span
              className="rwtrack__fill"
              style={{ height: `${Math.min(100, (totalPoints / top) * 100)}%` }}
              aria-hidden="true"
            />
            {REWARD_TIERS.map((t) => {
              const unlocked = isUnlocked(t);
              const claimed = claimedReward?.id === t.id;
              return (
                <div key={t.id} className={'rwstop' + (unlocked ? ' is-on' : '')}>
                  {/* A tier you have reached is done, whether or not you have
                      spent it yet — so it gets a check. It used to show a flag
                      until claimed, which put two different marks on four rows
                      that had all cleared the same bar and made an earned
                      reward look like one still in progress. */}
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
                  {claimed ? (
                    <span className="chip chip--live">Applied</span>
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
          </section>

          {/* The way across to the Leaderboard. It was a pill in the header
              bar, where it read as chrome — a control belonging to the app
              rather than a place the campaign goes — and it crowded the title
              enough to truncate the subtitle beside it.

              Here it is a destination: the same row card the hub uses, at the
              foot of the list, in the space the page was already leaving
              empty. And it carries the rank, so it is worth pressing rather
              than merely available — the two screens are the same score read
              two ways, and this is the sentence that says so. */}
          <button className="card rowcard" type="button" onClick={() => nav('/leaderboard')}>
            <img className="rowcard__art" src="/icons/leaderboard.webp" alt="" />
            <span className="grow">
              <b>Leaderboard</b>
              <small>You&rsquo;re #{cityRank} in the city this drop</small>
            </span>
            <IconChevronRight size={17} />
          </button>

          <p className="t-xs" style={{ lineHeight: 1.6 }}>
            One reward applies per order. Point values are campaign concepts, not final business rules.
          </p>
        </div>
      </main>
    </>
  );
}
