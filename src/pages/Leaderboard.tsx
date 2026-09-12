import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { LEADERBOARD } from '../data/catalog';
import { useStore } from '../store/useStore';
import { IconFlag, IconUsers } from '../design/elements/Icons';

const TABS = ['Friends', 'City', 'All racers'];

export default function Leaderboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState(1);
  const { totalPoints, racesLeft } = useStore();

  const all = [...LEADERBOARD, { name: 'You', area: 'Koramangala', points: totalPoints, me: true }]
    .sort((a, b) => b.points - a.points);
  const rows = all.slice(0, tab === 0 ? 5 : 9);

  /* Your own standing, worked out against the whole board rather than the
     visible slice — you can sit outside the top nine and still have a rank. */
  const myIndex = all.findIndex((r) => 'me' in r && r.me);
  const myRank = myIndex + 1;
  const ahead = myIndex > 0 ? all[myIndex - 1] : null;
  const gap = ahead ? ahead.points - totalPoints : 0;

  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Resets when the drop ends on 14 Nov" onBack={() => nav('/campaign')} />
      <main className="page">
        <div className="heroart">
          <img src="/campaign/18-leaderboard-hero.webp" alt="" />
        </div>

        {/* Where you stand, first.

            You were row nine of a list of strangers — the one number on this
            screen that belongs to the player was the last thing on it, and on
            a longer board it would have been off the bottom entirely. The
            board is still here; it is just no longer the way you find out how
            you are doing. */}
        <div className="shell" style={{ paddingTop: 4 }}>
          <div className="myrank">
            <span className="myrank__a" aria-hidden="true">Y</span>
            <div className="grow">
              <p className="myrank__k">Your rank</p>
              <p className="myrank__r t-num">#{myRank}</p>
              <p className="myrank__s">
                {ahead
                  ? `You're ${gap.toLocaleString('en-IN')} points away from #${myRank - 1}`
                  : 'Nobody in the city is ahead of you'}
              </p>
            </div>
            <div className="myrank__pts">
              <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
              <span>Total points</span>
            </div>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} type="button" className={'tabs__i' + (i === tab ? ' is-on' : '')} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>

        <div>
          {rows.map((r, i) => (
            <div key={r.name + i} className={'lrow' + ('me' in r && r.me ? ' is-me' : '')}>
              <span className="lrow__r t-num">{i + 1}</span>
              <span className="lrow__a" aria-hidden="true">{r.name.charAt(0)}</span>
              <span className="grow">
                <b>{r.name}</b>
                <small>{r.area}</small>
              </span>
              <span className="lrow__p t-num">{r.points.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>

        <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 8 }}>
          <Button variant="hwBlue" block type="button" disabled={racesLeft <= 0} onClick={() => nav('/race')}>
            <IconFlag size={17} />
            {racesLeft > 0 ? `Race again · ${racesLeft} left` : 'No races left today'}
          </Button>
          <Button variant="outline" block type="button" onClick={() => nav('/invite')}>
            <IconUsers size={17} />
            Invite a friend to unlock +1 race
          </Button>
        </div>
      </main>
    </>
  );
}
