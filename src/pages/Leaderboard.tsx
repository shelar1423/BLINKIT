import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { LEADERBOARD } from '../data/catalog';
import { hasReached, REWARD_TIERS, useStore } from '../store/useStore';
import { IconChevronRight, IconFlag, IconUsers } from '../design/elements/Icons';

const TABS = ['Friends', 'City', 'All racers'];

type Racer = { name: string; area: string; points: number; rank: number; me?: boolean };

/* One row, so the folded-away tail renders identically to the head rather than
   as a second copy of the same markup that can drift from it. */
function Row({ r }: { r: Racer }) {
  return (
    <div className={'lrow' + (r.me ? ' is-me' : '')}>
      <span className="lrow__r t-num">{r.rank}</span>
      <span className="lrow__a" aria-hidden="true">{r.name.charAt(0)}</span>
      {/* Name only. The area under every name turned a ladder into a directory
          — rows where the thing being compared is a single number, and where
          someone else's neighbourhood changes nothing about your standing. */}
      <span className="grow">
        <b>{r.name}</b>
      </span>
      <span className="lrow__p t-num">{r.points.toLocaleString('en-IN')}</span>
    </div>
  );
}

export default function Leaderboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState(1);
  const { totalPoints, racesLeft, unlockedRewards, claimedReward } = useStore();

  /* Friends is a smaller circle than the city. */
  const pool = tab === 0 ? LEADERBOARD.slice(0, 5) : LEADERBOARD;
  const ranked: Racer[] = [...pool, { name: 'You', area: 'Koramangala', points: totalPoints, me: true }]
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  /* The board shows the top five and then you — with the run between folded
     away rather than printed out. Nine rows of names you are not and cannot
     reach pushed the only row that is yours off the screen; the five at the
     top are the board, your row is the point, and the middle is a number.

     Your row is always rendered, whichever tab is showing. It used to be a
     flat slice off the top, so on Friends — a five-name board — you were cut
     off the list entirely and the rank card above vanished with you. */
  const TOP = 5;
  const myIdx = ranked.findIndex((r) => r.me);
  const folded = Math.max(0, myIdx - TOP);
  const head = folded > 0 ? ranked.slice(0, TOP) : ranked.slice(0, Math.max(TOP, myIdx + 1));
  const tailRow = folded > 0 ? ranked[myIdx] : null;

  /* What the Rewards link has to say for itself. A reward sitting unclaimed is
     the more useful fact, so it wins over the tally when there is one. */
  const claimable = REWARD_TIERS.find(
    (t) => hasReached(t, totalPoints, unlockedRewards) && claimedReward?.id !== t.id,
  );
  const earned = REWARD_TIERS.filter((t) => hasReached(t, totalPoints, unlockedRewards)).length;

  /* Where you stand, worked out from the same sorted list the table renders so
     the card and the highlighted row can never disagree. */
  const myRank = myIdx + 1;
  const ahead = myIdx > 0 ? ranked[myIdx - 1] : null;
  const gap = ahead ? ahead.points - totalPoints : 0;
  /* Top of the board has nobody to chase, so the third stat turns around and
     reports the cushion instead of an empty gap. */
  const behind = ranked[myIdx + 1];
  const lead = behind ? totalPoints - behind.points : 0;

  return (
    <>
      <PageHeader
        title="Leaderboard"
        onBack={() => nav('/campaign')}
      />
      <main className="page">
        <div className="heroart">
          <img src="/campaign/banner-leaderboard.webp" alt="" />
        </div>

        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} type="button" className={'tabs__i' + (i === tab ? ' is-on' : '')} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>

        {/* "where you stand first, then others". Nine names sorted by points
            is a list you have to read to find yourself in, and on a board you
            enter at the bottom of, that is nine rows before the one you came
            for. Your standing is stated up front — the rank, the gap to the
            name directly above you, and what closes it — and the row itself
            stays in place below so the ladder is still a ladder. */}
        {myRank > 0 && (
          <div className="shell" style={{ paddingTop: 12 }}>
            <div className="mystand">
              {/* Three readings of one standing, set the same way: figure over
                  caption, even thirds, one rule between them. It was a lettered
                  disc, a label-over-number, a number-over-label facing the
                  other way, and then a sentence across the foot — four
                  typographic ideas and three alignments in a box that says one
                  thing. The gap is a statistic like the other two, so it is set
                  as one instead of being written out in prose. */}
              <div className="mystand__stats">
                <div>
                  <b className="t-num">#{myRank}</b>
                  <span>Your rank</span>
                </div>
                <div>
                  <b className="t-num">{totalPoints.toLocaleString('en-IN')}</b>
                  <span>Total points</span>
                </div>
                <div>
                  <b className="t-num">{(ahead ? gap : lead).toLocaleString('en-IN')}</b>
                  <span>{ahead ? `To pass #${myRank - 1}` : `Ahead of #2`}</span>
                </div>
              </div>
              {/* The action belongs to the sentence above it. It used to sit at
                  the foot of the page, nine rows below the gap it closes — so
                  the one screen in the campaign whose entire job is to make you
                  want to race again kept the button to do it off the fold. */}
              <Button variant="hwBlue" block type="button" disabled={racesLeft <= 0} onClick={() => nav('/race')}>
                <IconFlag size={17} />
                {racesLeft > 0 ? `Race again · ${racesLeft} left` : 'No races left today'}
              </Button>
            </div>
          </div>
        )}

        <div>
          {head.map((r) => (
            <Row key={r.name + r.rank} r={r} />
          ))}
          {tailRow && (
            <>
              {/* The fold, as a length of chequered flag. It needs no label:
                  the rank column jumps from 5 to 9 and says how many are
                  missing more precisely than "3 more racers" did, while the
                  chequer says it in the campaign's own language instead of a
                  table's. Decorative, so it is hidden from screen readers —
                  the numbers carry the meaning. */}
              <span className="lbreak" aria-hidden="true" />
              <Row r={tailRow} />
            </>
          )}
        </div>

        {/* Race again has moved up into the rank card, so what closes the page
            is the other way to get one — which is also the answer when the
            button up there says you have none left. */}
        <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 10 }}>
          <Button variant="outline" block type="button" onClick={() => nav('/invite')}>
            <IconUsers size={17} />
            Invite a friend to unlock +1 race
          </Button>
          {/* The other half of the score, as a destination rather than a pill
              in the header bar — the same row card the Rewards screen uses to
              point back here, so the two directions match. */}
          <button className="card rowcard" type="button" onClick={() => nav('/rewards')}>
            <img className="rowcard__art" src="/icons/rewards.webp" alt="" />
            <span className="grow">
              <b>Rewards</b>
              <small>
                {claimable
                  ? `${claimable.label} ready to claim`
                  : `${earned} of ${REWARD_TIERS.length} tiers unlocked`}
              </small>
            </span>
            <IconChevronRight size={17} />
          </button>
        </div>
      </main>
    </>
  );
}
