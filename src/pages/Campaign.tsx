import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { DROP_DATES } from '../data/drop';
import { ProductCard } from '../design/components/ProductCard';
import { HERO_CARS, MYSTERY_CAR, REVEALED_CAR, rupees } from '../data/catalog';
import { MAX_RACE_ATTEMPTS, REWARD_TIERS, useStore } from '../store/useStore';
import { IconChevronRight } from '../design/elements/Icons';

export default function Campaign() {
  const nav = useNavigate();
  const { racesLeft, totalPoints, bestScore, unlockedRewards, mysteryUnlocked } = useStore();

  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const cashEarned = REWARD_TIERS.filter((t) => unlockedRewards.includes(t.id)).reduce((a, t) => a + t.value, 0);

  return (
    <>
      <PageHeader title="Race It Home" subtitle={`Hot Wheels × Blinkit · ${DROP_DATES}`} onBack={() => nav('/')} />
      <main className="page">
        <div className="hub">
          <img className="hub__im" src="/campaign/06-campaign-hub-hero.webp" alt="" />
          <div className="hub__c">
            <span className="hub__k">LIMITED DROP</span>
            <span className="hub__t">Race It Home</span>
            <span className="hub__s">Race. Collect. Win.</span>
          </div>
        </div>

        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="stats">
            <div>
              <img className="stats__ic" src="/icons/total-points.webp" alt="" />
              <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
              <span>TOTAL POINTS</span>
            </div>
            <div>
              <img className="stats__ic" src="/icons/blinkit-cash.webp" alt="" />
              <b className="t-num">{rupees(cashEarned)}</b>
              <span>BLINKIT CASH</span>
            </div>
            <div>
              <img className="stats__ic" src="/icons/best-race.webp" alt="" />
              <b className="t-num">{bestScore.toLocaleString('en-IN')}</b>
              <span>BEST RACE</span>
            </div>
          </div>
        </div>

        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div className="row">
              <div className="grow">
                <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>
                  {racesLeft} of {MAX_RACE_ATTEMPTS} races left today
                </p>
                <p className="t-xs">Resets at midnight. Invite a friend to unlock one more.</p>
              </div>
            </div>
            <div className="pips" aria-hidden="true">
              {Array.from({ length: Math.max(MAX_RACE_ATTEMPTS, racesLeft) }).map((_, i) => (
                <i key={i} className={i < racesLeft ? 'on' : ''} />
              ))}
            </div>
            {/* The same control as the storefront's Race now — track orange, no
                flag. Two different-looking buttons for the one action, two taps
                apart, read as two different actions. */}
            <Button variant="hwTrack" block
              type="button"
              disabled={racesLeft <= 0}
              onClick={() => nav('/race')}
            >
              {racesLeft > 0 ? 'Race Now' : 'No races left'}
            </Button>
            {racesLeft <= 0 && (
              <Button variant="outline" block type="button" onClick={() => nav('/invite')}>
                Unlock another race
              </Button>
            )}
          </div>
        </div>

        {next && (
          <div className="shell" style={{ paddingTop: 12 }}>
            <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Next reward · {next.label}</span>
                <span className="t-xs t-num">
                  {totalPoints.toLocaleString('en-IN')} / {next.min.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.min(100, (totalPoints / next.min) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
          <button className="card rowcard" type="button" onClick={() => nav('/rewards')}>
            <img className="rowcard__art" src="/icons/rewards.webp" alt="" />
            <span className="grow">
              <b>Rewards</b>
              <small>{unlockedRewards.length} of {REWARD_TIERS.length} tiers unlocked</small>
            </span>
            <IconChevronRight size={17} />
          </button>
          <button className="card rowcard" type="button" onClick={() => nav('/leaderboard')}>
            <img className="rowcard__art" src="/icons/leaderboard.webp" alt="" />
            <span className="grow">
              <b>Leaderboard</b>
              <small>See where you sit in the city</small>
            </span>
            <IconChevronRight size={17} />
          </button>
          <button className="card rowcard" type="button" onClick={() => nav('/invite')}>
            <img className="rowcard__art" src="/icons/race-a-friend.webp" alt="" />
            <span className="grow">
              <b>Race a friend</b>
              <small>Invite someone to unlock +1 race</small>
            </span>
            <IconChevronRight size={17} />
          </button>
        </div>

        <div className="sec">
          <div>
            <h2 className="sec__t">Cars you can race</h2>
            <p className="sec__s">Each one has full 3D and AR</p>
          </div>
        </div>
        <div className="prail">
          {HERO_CARS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          <ProductCard product={mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR} />
        </div>
      </main>
    </>
  );
}
