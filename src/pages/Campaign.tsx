import { useNavigate } from 'react-router-dom';
import { PageHeader, SectionHeader } from '../design/components/Chrome';
import { rupees } from '../data/catalog';
import { MAX_RACE_ATTEMPTS, REWARD_TIERS, useStore } from '../store/useStore';
import { IconChevronRight, IconFlag, IconInfo } from '../design/elements/Icons';
import { useToast } from '../App';

export default function Campaign() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { racesLeft, totalPoints, bestScore, unlockedRewards } = useStore();

  const next = REWARD_TIERS.find((t) => totalPoints < t.min);
  const cashEarned = REWARD_TIERS.filter((t) => unlockedRewards.includes(t.id)).reduce((a, t) => a + t.value, 0);

  return (
    <>
      <PageHeader
        title="Race It Home"
        onBack={() => nav('/')}
        /* Annotated on the target but with nowhere to go yet: the step
           illustrations for the explainer are still to come, so the pill is
           built and says so rather than opening an empty sheet. */
        right={
          <button className="hdrpill" type="button" onClick={() => toast('The how-it-works walkthrough is coming')}>
            <IconInfo size={14} />
            <span>How it works</span>
          </button>
        }
      />
      <main className="page">
        {/* The hero is a card inset in the page rather than a full-bleed strip
            under the header, and it carries the campaign's one call to action.
            "CTA missing" was the note: the storefront hands you straight to
            Race now, and landing here — one step further in — used to present
            the hub with nothing to press until you had scrolled past the
            stats. */}
        <div className="hub">
          <img className="hub__im" src="/campaign/banner-hub.webp" alt="" />
          <div className="hub__c">
            <span className="hub__t">Race It Home</span>
            <span className="hub__s">Race. Collect. Win.</span>
            <button
              className="hub__go"
              type="button"
              disabled={racesLeft <= 0}
              onClick={() => nav('/race')}
            >
              <IconFlag size={15} />
              <span>{racesLeft > 0 ? 'Race Now' : 'No races left'}</span>
              <IconChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="stats">
            <div>
              <img className="stats__ic" src="/icons/total-points.webp" alt="" />
              <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
              <span>Total Points</span>
            </div>
            <div>
              <img className="stats__ic" src="/icons/blinkit-cash.webp" alt="" />
              <b className="t-num">{rupees(cashEarned)}</b>
              <span>Blinkit Cash</span>
            </div>
            <div>
              <img className="stats__ic" src="/icons/best-race.webp" alt="" />
              <b className="t-num">{bestScore.toLocaleString('en-IN')}</b>
              <span>Best Race</span>
            </div>
          </div>
        </div>

        {/* The races you have left, set large — "text big" was the note, and at
            13px the one number on this page that changes daily was reading
            smaller than the stats above it that mostly do not.

            The full-width Race Now that used to close this card is gone: the
            hero now carries it, and two buttons for the one action two taps
            apart read as two different actions. What takes its place is the
            way to earn another race, which used to appear only once you had
            none left — by which point it is advice rather than an option. */}
        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="card rcount">
            <p className="rcount__t">
              {racesLeft} of {MAX_RACE_ATTEMPTS} races left today
            </p>
            <p className="rcount__s">Resets at midnight.</p>
            {/* Three lengths of Hot Wheels track rather than three grey bars.
                They were reading as a battery gauge on a page about racing,
                and the app already owns the orange track with the chequered
                panel — the same length of it that runs across the storefront.
                A race you have spent greys out; the ones left are lit. */}
            <div className="pips" aria-hidden="true">
              {Array.from({ length: Math.max(MAX_RACE_ATTEMPTS, racesLeft) }).map((_, i) => (
                <i key={i} className={i < racesLeft ? 'on' : ''} />
              ))}
            </div>
            {/* The way to earn a fourth, as a row across the foot of the card
                rather than a chip wedged beside the count. Boxed at 116px the
                label needed three lines and the chip ended up taller than the
                number it sat next to; full width it gets one line, a real
                touch target, and room to say what you actually get. */}
            <button className="rcount__go" type="button" onClick={() => nav('/invite')}>
              {/* The two helmets, not a lightning bolt. The bolt was standing
                  for "instant", which is Blinkit's idea and not this one — the
                  thing on offer here is a second person to race. */}
              <img className="rcount__gi" src="/icons/race-a-friend.webp" alt="" />
              <span className="grow">Invite a friend</span>
              <b>+1 race</b>
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* "add delivery icon in full focus". The reward at the end of all this
            is a Blinkit delivery, and the card that said so was a line of 13px
            type over a hairline bar — the smallest thing on a page whose whole
            argument is that racing gets you groceries faster. The truck is now
            the size of the promise, and the label splits: what it is set large,
            what it costs you underneath.

            It renders whatever the score is. Gated on there being a tier still
            ahead of you, it vanished the moment you cleared the last one —
            which is exactly when a player has most earned the sight of it, and
            it left a hole between the races count and the section below. Past
            the top tier the card stops counting and states what you have. */}
        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="nrw">
            <img className="nrw__im" src="/icons/delivery-truck.webp" alt="" />
            <div className="nrw__c">
              <p className="nrw__k">{next ? 'Next reward' : 'All rewards unlocked'}</p>
              {/* Every tier carries free delivery, so that is what the truck
                  is standing for once they are all cleared. */}
              <p className="nrw__t">{next ? next.label : 'Free Delivery'}</p>
              <p className="nrw__s">
                {next
                  ? `Collect ${next.min.toLocaleString('en-IN')} points`
                  : 'On every Blinkit order this drop'}
              </p>
              <div className="nrw__row">
                <div className="bar">
                  <i style={{ width: next ? `${Math.min(100, (totalPoints / next.min) * 100)}%` : '100%' }} />
                </div>
                <span className="nrw__n t-num">
                  {next
                    ? `${totalPoints.toLocaleString('en-IN')} / ${next.min.toLocaleString('en-IN')}`
                    : `${totalPoints.toLocaleString('en-IN')} pts`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* "title missing". Two cards arriving straight off a progress bar read
            as a continuation of the reward you are chasing; they are not — they
            are the other two things the campaign does.

            Two, not three: Race a friend went, because the row above it now
            carries exactly that action and a page should not offer the same
            door twice. And they are square tiles rather than list rows for the
            same reason the storefront's are — posters for two places worth
            going, with room for the art to be the thing you recognise, instead
            of two more lines of 14px type with a thumbnail on the left. */}
        <SectionHeader title="More ways to play" />
        <div className="mtiles">
          <button className="mtile" type="button" onClick={() => nav('/rewards')}>
            <span className="mtile__t">Rewards</span>
            <span className="mtile__s">
              {unlockedRewards.length} of {REWARD_TIERS.length} tiers unlocked
            </span>
            <img className="mtile__im" src="/icons/rewards.webp" alt="" />
          </button>
          <button className="mtile" type="button" onClick={() => nav('/leaderboard')}>
            <span className="mtile__t">Leaderboard</span>
            <span className="mtile__s">See where you sit in the city</span>
            <img className="mtile__im" src="/icons/leaderboard.webp" alt="" />
          </button>
        </div>

      </main>
    </>
  );
}
