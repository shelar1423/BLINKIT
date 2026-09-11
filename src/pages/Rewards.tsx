import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { rupees } from '../data/catalog';
import { REWARD_TIERS, useStore } from '../store/useStore';
import { useToast } from '../App';

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
  const next = REWARD_TIERS.find((t) => totalPoints < t.min);

  return (
    <>
      <PageHeader title="Racing rewards" subtitle="Points convert to Blinkit Cash at checkout" onBack={() => nav('/campaign')} />
      <main className="page">
        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 14, display: 'grid', gap: 9 }}>
            <div>
              <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>YOUR POINTS</p>
              <b className="t-num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px' }}>
                {totalPoints.toLocaleString('en-IN')}
              </b>
            </div>
            <div className="bar"><i style={{ width: `${Math.min(100, (totalPoints / 8000) * 100)}%` }} /></div>
            <p className="t-xs">
              {next
                ? `${(next.min - totalPoints).toLocaleString('en-IN')} points to ${next.label}`
                : 'Every tier unlocked.'}
            </p>
          </div>

          <img src="/rewards/19-rewards-progression-track.webp" alt="" style={{ width: '100%', borderRadius: 'var(--r-lg)' }} />

          <div className="card" style={{ padding: '0 12px' }}>
            {REWARD_TIERS.map((t) => {
              const unlocked = unlockedRewards.includes(t.id) || totalPoints >= t.min;
              const isClaimed = claimedReward?.id === t.id;
              return (
                <div className="tier" key={t.id}>
                  <span className="tier__ic"><img src={ART[t.id]} alt="" /></span>
                  <div>
                    <p className="tier__t">{t.label}</p>
                    <p className="tier__s">{t.min.toLocaleString('en-IN')} points{t.value > 0 ? ` · ${rupees(t.value)} off` : ''}</p>
                  </div>
                  {isClaimed ? (
                    <span className="chip chip--live">APPLIED</span>
                  ) : unlocked ? (
                    <Button variant="flame" size="sm"
                      type="button"
                      onClick={() => { claimReward(t.id); toast(`${t.label} applied to your cart`); nav('/cart'); }}
                    >
                      Claim
                    </Button>
                  ) : (
                    <span className="chip chip--off">{(t.min - totalPoints).toLocaleString('en-IN')} to go</span>
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
