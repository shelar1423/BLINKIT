import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/blinkit/Chrome';
import { useStore } from '../store/useStore';
import { IconCheck, IconShare, IconUsers } from '../components/Icons';
import { useToast } from '../App';

export default function Invite() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { referralCode, invitedCount, grantExtraRace, racesLeft, bestScore } = useStore();
  const [shared, setShared] = useState(false);

  const link = `${window.location.origin}/?ref=${referralCode}`;

  async function share() {
    const data = {
      title: 'Race It Home — Blinkit × Hot Wheels',
      text: `I scored ${bestScore.toLocaleString('en-IN')} pts. Beat it?`,
      url: link,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShared(true);
        return;
      }
      await navigator.clipboard.writeText(link);
      setShared(true);
      toast('Invite link copied');
    } catch {
      toast('Could not open the share sheet');
    }
  }

  return (
    <>
      <PageHeader title="Race your friends" subtitle={`${racesLeft} races left today`} onBack={() => nav('/campaign')} />
      <main className="page">
        <img src="/campaign/20-refer-a-friend-hero.webp" alt="" style={{ width: '100%', display: 'block' }} />

        <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 12 }}>
          <div>
            <h2 className="t-h2">Invite a friend, get +1 race</h2>
            <p className="t-sm" style={{ marginTop: 4, lineHeight: 1.55 }}>
              You get three races a day. When someone you invite finishes their first race, you unlock one more.
            </p>
          </div>

          <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>YOUR CODE</p>
                <b style={{ fontSize: 'var(--f-xl)', fontWeight: 800, letterSpacing: '1px' }}>{referralCode}</b>
              </div>
              <span className="chip chip--on">{invitedCount} joined</span>
            </div>
            <button className="btn btn--flame btn--block" type="button" onClick={share}>
              <IconShare size={16} /> Invite a friend
            </button>
          </div>

          <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div className="row" style={{ gap: 9 }}>
              <span style={{ color: 'var(--hw-r)' }}><IconUsers size={18} /></span>
              <b style={{ fontSize: 'var(--f-md)' }}>Demo: simulate a friend racing</b>
            </div>
            <p className="t-xs" style={{ lineHeight: 1.55 }}>
              There is no backend in this prototype, so nothing can genuinely confirm a friend raced. This button stands
              in for that server callback so you can see the unlock happen.
            </p>
            <button
              className="btn btn--outline btn--block"
              type="button"
              disabled={!shared}
              onClick={() => { grantExtraRace(); toast('+1 race unlocked'); }}
            >
              <IconCheck size={16} /> {shared ? 'Simulate friend completing a race' : 'Share your link first'}
            </button>
          </div>

          <img src="/campaign/21-friend-challenge-card.webp" alt="" style={{ width: '100%', borderRadius: 'var(--r-lg)' }} />

          <p className="t-xs" style={{ lineHeight: 1.6 }}>
            Sharing uses your device&rsquo;s own share sheet. No contact list is read and nothing is sent on your behalf.
          </p>
        </div>
      </main>
    </>
  );
}
