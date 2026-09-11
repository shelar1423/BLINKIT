import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { useStore } from '../store/useStore';
import { IconCheck, IconCopy, IconShare } from '../design/elements/Icons';
import { useToast } from '../App';

export default function Invite() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { referralCode, invitedCount, racesLeft, bestScore } = useStore();
  /** Held for a couple of seconds so the button itself confirms, rather than
   *  leaving the toast to be the only sign anything happened. */
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/?ref=${referralCode}`;

  async function share() {
    const data = {
      title: 'Race It Home · Blinkit × Hot Wheels',
      text: `I scored ${bestScore.toLocaleString('en-IN')} pts. Beat it?`,
      url: link,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(link);
      toast('Invite link copied');
    } catch {
      toast('Could not open the share sheet');
    }
  }

  /* The code, not the link: the button sits beside the code and that is what
     it says it copies. Sharing the link is the other control. */
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast('Code copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy the code');
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

          <div className="card invcode">
            <div className="invcode__top">
              <p className="invcode__k">Your code</p>
              <span className="chip chip--on">{invitedCount} joined</span>
            </div>
            <div className="invcode__row">
              <b className="invcode__v">{referralCode}</b>
              <button
                className={'invcode__copy' + (copied ? ' is-done' : '')}
                type="button"
                onClick={copyCode}
                aria-label={`Copy referral code ${referralCode}`}
              >
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <Button variant="flame" block type="button" onClick={share}>
              <IconShare size={16} /> Invite a friend
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
