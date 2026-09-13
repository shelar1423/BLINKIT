import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { useStore } from '../store/useStore';
import { IconCheck, IconCopy, IconShare, IconWhatsApp } from '../design/elements/Icons';
import { useToast } from '../App';

/** Invites that count. Five is the cap the badge counts towards. */
const INVITE_GOAL = 5;

export default function Invite() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { referralCode, invitedCount, bestScore } = useStore();
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
    const text = `Race It Home on Blinkit. Use my code ${referralCode} and we both get an extra race. ${link}`;
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
      <PageHeader title="Race your friends" onBack={() => nav('/campaign')} />
      <main className="page">
        <div className="heroart">
          <img src="/campaign/banner-invite.webp" alt="" />
        </div>

        <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 12 }}>
          <h2 className="seccount__t">Invite a friend, get +1 race</h2>

          {/* "how it works first". The deal came before the explanation only in
              the sense that a paragraph of prose sat above the code — which
              asked you to hold three sequential facts in your head to work out
              what the code was for. Three steps, in order, and the paragraph
              goes because it was saying the same thing the long way round. */}
          <div className="card hiw">
            <p className="hiw__t">How it works</p>
            <ol className="hiw__steps">
              <li>
                <img src="/icons/step-invite.webp" alt="" />
                <b>Invite a friend</b>
                <small>Share your code</small>
              </li>
              <li>
                <img src="/icons/step-race.webp" alt="" />
                <b>They race</b>
                <small>They finish one race</small>
              </li>
              <li>
                <img src="/icons/step-unlock.webp" alt="" />
                <b>You get +1 race</b>
                <small>Extra chance</small>
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

          {/* Who has actually joined. The page asked you to invite people and
              then never mentioned them again — the count lived as a chip on
              the code card, which made it a property of the code rather than a
              list of the friends it brought in. */}
          <section className="frlist">
            <div className="seccount">
              <h2 className="seccount__t">Your invited friends</h2>
              <span className="seccount__n">
                {invitedCount}/{INVITE_GOAL} joined
              </span>
            </div>
            {invitedCount === 0 ? (
              <div className="nofr">
                <img src="/icons/race-a-friend.webp" alt="" />
                <b>No friends yet</b>
                <small>
                  Invite your friends and see them here.
                  <br />
                  The more, the merrier!
                </small>
              </div>
            ) : (
              <div className="nofr nofr--some">
                {/* Slots rather than invented names: the campaign knows how
                    many joined, not who they are. */}
                <div className="nofr__slots" aria-hidden="true">
                  {Array.from({ length: INVITE_GOAL }).map((_, i) => (
                    <span key={i} className={i < invitedCount ? 'is-on' : ''}>
                      {i < invitedCount ? <IconCheck size={15} /> : null}
                    </span>
                  ))}
                </div>
                <b>
                  {invitedCount} of {INVITE_GOAL} joined
                </b>
                <small>Each one unlocked an extra race for you.</small>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
