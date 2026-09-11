import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { rupees } from '../data/catalog';
import { REWARD_TIERS, useStore } from '../store/useStore';
import { useToast } from '../App';
import { IconCheck, IconFlag, IconLock, IconTrophy } from '../design/elements/Icons';

/* ============================================================
   Racing rewards.

   This was a points card, a decorative strip, and then four identical rows
   that differed only by the word in the button. Nothing in it told you where
   you were or what to do next, and the one reward you could actually claim
   looked exactly like the three you could not.

   Now the state changes the shape, not just the colour:

   - The points sit on the same dark stage the race result uses, so arriving
     here after a race is continuous with the screen you came from.
   - The best reward you have earned and not yet spent is a coupon, full width,
     with the claim inside it. One thing to act on.
   - Everything else is a station on a track, with the rail showing how far the
     points have carried you. A locked tier is quiet and says what it costs.
   ============================================================ */

const ART: Record<string, string> = {
  start: '/rewards/25-02-free-delivery-badge.webp',
  check: '/rewards/25-01-gold-coin.webp',
  pit: '/rewards/25-03-wallet-reward-token.webp',
  podium: '/rewards/25-06-premium-membership-icon.webp',
};

export default function Rewards() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { totalPoints, unlockedRewards, claimReward, claimedReward } = useStore();

  const top = REWARD_TIERS[REWARD_TIERS.length - 1].min;
  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const isUnlocked = (id: string, min: number) => unlockedRewards.includes(id) || totalPoints >= min;
  /* The highest tier that is earned and still unspent: the one thing on this
     page that is worth pressing. */
  const claimable = [...REWARD_TIERS].reverse().find((t) => isUnlocked(t.id, t.min) && claimedReward?.id !== t.id);

  const claim = (id: string, label: string) => {
    claimReward(id);
    toast(`${label} applied to your cart`);
    nav('/cart');
  };

  return (
    <>
      <PageHeader title="Racing rewards" subtitle="Points convert to Blinkit Cash at checkout" onBack={() => nav('/campaign')} />
      <main className="page rwpage">
        <div className="rwhero">
          <span className="rwhero__chequer" aria-hidden="true" />
          <p className="rwhero__k">Your points</p>
          <p className="rwhero__v t-num">{totalPoints.toLocaleString('en-IN')}</p>
          <p className="rwhero__s">
            {next ? (
              <>
                <b>{(next.min - totalPoints).toLocaleString('en-IN')}</b> more for {next.label}
              </>
            ) : (
              <>
                <IconTrophy size={13} /> Every tier unlocked
              </>
            )}
          </p>
        </div>

        <div className="shell rwbody">
          {claimable && (
            <div className="coupon">
              <div className="coupon__top">
                <span className="coupon__art">
                  <img src={ART[claimable.id]} alt="" />
                </span>
                <div className="grow">
                  <p className="coupon__k">Ready to claim</p>
                  <b className="coupon__v">{claimable.label}</b>
                  <span className="coupon__s">
                    {claimable.value > 0
                      ? `${rupees(claimable.value)} off your next order`
                      : 'Free delivery, applied at checkout'}
                  </span>
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

          {/* The track. The rail fills to the points earned, so the list is
              also the progress bar rather than sitting under one. */}
          <div className="rwtrack">
            <span
              className="rwtrack__fill"
              style={{ height: `${Math.min(100, (totalPoints / top) * 100)}%` }}
              aria-hidden="true"
            />
            {REWARD_TIERS.map((t) => {
              const unlocked = isUnlocked(t.id, t.min);
              const claimed = claimedReward?.id === t.id;
              return (
                <div key={t.id} className={'rwstop' + (unlocked ? ' is-on' : '')}>
                  <span className="rwstop__pin" aria-hidden="true">
                    {claimed ? <IconCheck size={12} /> : unlocked ? <IconFlag size={12} /> : <IconLock size={11} />}
                  </span>
                  <span className="rwstop__art">
                    <img src={ART[t.id]} alt="" loading="lazy" />
                  </span>
                  <div className="grow">
                    <b className="rwstop__t">{t.label}</b>
                    <span className="rwstop__s">
                      {t.min.toLocaleString('en-IN')} pts{t.value > 0 ? ` · ${rupees(t.value)} off` : ''}
                    </span>
                  </div>
                  {claimed ? (
                    <span className="chip chip--live">APPLIED</span>
                  ) : unlocked ? (
                    <span className="chip chip--on">EARNED</span>
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

          <p className="t-xs" style={{ lineHeight: 1.6 }}>
            One reward applies per order. Point values are campaign concepts, not final business rules.
          </p>
        </div>
      </main>
    </>
  );
}
