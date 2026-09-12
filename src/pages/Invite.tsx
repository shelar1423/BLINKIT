import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { useStore } from '../store/useStore';
import { IconCheck, IconCopy, IconFlag, IconShare, IconUsers, IconWhatsApp } from '../design/elements/Icons';
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

  /* WhatsApp is where an invite like this actually travels in India, so it is
     a destination of its own rather than one option inside a share sheet two
     taps away. wa.me with no number opens the contact picker. */
  function whatsapp() {
    const text = `Race It Home on Blinkit — use my code ${referralCode} and we both get an extra race. ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
        <div className="heroart">
          <img src="/campaign/banner-invite.webp" alt="" />
        </div>

        <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 12 }}>
          <h2 className="t-h2">Invite a friend, get +1 race</h2>

          {/* "how it works first". The deal came before the explanation only in
              the sense that a paragraph of prose sat above the code — which
              asked you to hold three sequential facts in your head to work out
              what the code was for. Three steps, in order, and the paragraph
              goes because it was saying the same thing the long way round. */}
          <div className="hiw">
            <p className="hiw__t">How it works</p>
            <ol className="hiw__steps">
              <li>
                <span className="hiw__n">1</span>
                <IconShare size={19} />
                <b>Invite a friend</b>
                <small>Share your code</small>
              </li>
              <li>
                <span className="hiw__n">2</span>
                <IconUsers size={19} />
                <b>They race</b>
                <small>They finish one race</small>
              </li>
              <li>
                <span className="hiw__n">3</span>
                <IconFlag size={19} />
                <b>You get +1 race</b>
                <small>Same day, one more</small>
              </li>
            </ol>
          </div>

          <div className="card invcode">
            <div className="invcode__top">
              <p className="invcode__k">Your invite code</p>
              <span className="chip chip--on">{invitedCount} joined</span>
            </div>
            {/* Code and WhatsApp share a line: the code is the thing you send
                and WhatsApp is where you send it, so they belong together
                rather than stacked as two unrelated controls. */}
            <div className="invcode__row">
              <button
                className={'invcode__code' + (copied ? ' is-done' : '')}
                type="button"
                onClick={copyCode}
                aria-label={`Copy referral code ${referralCode}`}
              >
                <b className="invcode__v">{referralCode}</b>
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
              </button>
              <button className="invcode__wa" type="button" onClick={whatsapp}>
                <IconWhatsApp size={17} />
                <span>Invite via WhatsApp</span>
              </button>
            </div>
            <Button variant="outline" block type="button" onClick={share}>
              <IconShare size={16} /> More ways to invite
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
