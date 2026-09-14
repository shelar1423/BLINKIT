import { useNavigate } from 'react-router-dom';
import { Sheet } from './Sheet';
import { Button } from '../elements';
import { LEADERBOARD, rupees } from '../../data/catalog';
import { hasReached, REWARD_TIERS, useStore } from '../../store/useStore';
import { useStartRace } from '../../lib/useStartRace';
import { IconCheck, IconFlag, IconLock, IconTrophy, IconUsers, IconWhatsApp } from '../elements/Icons';

/* ============================================================
   The campaign, as one sheet.

   This replaces four routes: the campaign hub, the reward ladder, the
   leaderboard and the invite screen. None of them was a place you went to DO
   something once claiming became automatic — they were places you went to
   LOOK, and looking is what a sheet is for. The hub in particular was a second
   home screen whose job was holding links to the other three.

   It opens on `?campaign=1`, which means any screen can offer it without
   owning it, the phone's back gesture closes it, and it can be linked to.
   ============================================================ */

function Ladder() {
  const totalPoints = useStore((s) => s.totalPoints);
  const unlockedRewards = useStore((s) => s.unlockedRewards);
  const claimed = useStore((s) => s.claimedReward);

  return (
    <ol className="cmp__ladder">
      {REWARD_TIERS.map((t) => {
        const got = hasReached(t, totalPoints, unlockedRewards);
        const riding = claimed?.id === t.id;
        return (
          <li key={t.id} className={'cmp__rung' + (got ? ' is-got' : '')}>
            <span className="cmp__rungic" aria-hidden="true">
              {got ? <IconCheck size={14} /> : <IconLock size={13} />}
            </span>
            <span className="cmp__rungt">
              <b>{t.label}</b>
              <small>
                {riding
                  ? 'On your next order'
                  : got
                    ? 'Earned'
                    : `${(t.min - totalPoints).toLocaleString('en-IN')} points to go`}
              </small>
            </span>
            <span className="cmp__rungn">{t.min.toLocaleString('en-IN')}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CampaignSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const startRace = useStartRace();
  const totalPoints = useStore((s) => s.totalPoints);
  const bestScore = useStore((s) => s.bestScore);
  const racesLeft = useStore((s) => s.racesLeft);
  const referralCode = useStore((s) => s.referralCode);
  const claimed = useStore((s) => s.claimedReward);

  /* Where this score would sit among the city's, rather than a rank invented
     and stored somewhere: the board is the board, and the player is placed in
     it by the only number that decides it. */
  const rank = LEADERBOARD.filter((r) => r.points > totalPoints).length + 1;
  const top = LEADERBOARD.slice(0, 5);

  const share = async () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    const text = `Race It Home on Blinkit. Use my code ${referralCode} and we both get an extra race. ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Race It Home', text, url: link });
      else await navigator.clipboard.writeText(link);
    } catch {
      /* dismissed, or no clipboard. Nothing to report: the player closed it. */
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Race It Home">
      <div className="cmp">
        {/* What the racing has been worth so far. */}
        <div className="cmp__tally">
          <span>
            <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
            <small>Points</small>
          </span>
          <span>
            <b className="t-num">{bestScore.toLocaleString('en-IN')}</b>
            <small>Best run</small>
          </span>
          <span>
            <b className="t-num">#{rank}</b>
            <small>In your city</small>
          </span>
        </div>

        {claimed && (
          <p className="cmp__riding">
            <IconTrophy size={15} />
            {claimed.value > 0 ? `${rupees(claimed.value)} Blinkit Cash` : 'Free delivery'} is on your next order
          </p>
        )}

        <h3 className="cmp__h">Rewards</h3>
        <Ladder />

        <h3 className="cmp__h">
          <IconTrophy size={15} /> This week in your city
        </h3>
        <ol className="cmp__board">
          {top.map((r, i) => (
            <li key={r.name} className="cmp__row">
              <span className="cmp__pos">{i + 1}</span>
              <span className="grow">
                {r.name}
                <small>{r.area}</small>
              </span>
              <b className="t-num">{r.points.toLocaleString('en-IN')}</b>
            </li>
          ))}
          <li className="cmp__row is-you">
            <span className="cmp__pos">{rank}</span>
            <span className="grow">You</span>
            <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
          </li>
        </ol>

        <h3 className="cmp__h">
          <IconUsers size={15} /> Race a friend
        </h3>
        <button type="button" className="cmp__invite" onClick={share}>
          <span className="cmp__badge" aria-hidden="true">
            <IconWhatsApp size={16} />
          </span>
          <span className="grow">
            <b>Send your code</b>
            <small>
              {referralCode} · you both get an extra race
            </small>
          </span>
        </button>

        <div className="cmp__foot">
          <Button
            variant="yellow"
            block
            type="button"
            disabled={racesLeft <= 0}
            onClick={() => {
              onClose();
              startRace();
            }}
          >
            <IconFlag size={16} />
            {racesLeft > 0 ? 'Race now' : 'No races left today'}
          </Button>
          <button
            type="button"
            className="cmp__shop"
            onClick={() => {
              onClose();
              nav('/hot-wheels');
            }}
          >
            Shop Hot Wheels
          </button>
        </div>
      </div>
    </Sheet>
  );
}
