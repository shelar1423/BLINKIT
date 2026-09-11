import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { LEADERBOARD } from '../data/catalog';
import { useStore } from '../store/useStore';

const TABS = ['Friends', 'City', 'All racers'];

export default function Leaderboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState(1);
  const { totalPoints, racesLeft } = useStore();

  const rows = [...LEADERBOARD, { name: 'You', area: 'Koramangala', points: totalPoints, me: true }]
    .sort((a, b) => b.points - a.points)
    .slice(0, tab === 0 ? 5 : 9);

  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Resets when the drop ends on 14 Nov" onBack={() => nav('/campaign')} />
      <main className="page">
        <img src="/campaign/18-leaderboard-hero.webp" alt="" style={{ width: '100%', display: 'block' }} />

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
          <Button variant="flame" block type="button" disabled={racesLeft <= 0} onClick={() => nav('/race')}>
            {racesLeft > 0 ? `Race again · ${racesLeft} left` : 'No races left today'}
          </Button>
          <Button variant="outline" block type="button" onClick={() => nav('/invite')}>
            Invite a friend to unlock +1 race
          </Button>
        </div>
      </main>
    </>
  );
}
