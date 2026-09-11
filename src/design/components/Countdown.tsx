import type { DropParts } from '../../data/drop';

/* ============================================================
   Drop countdown.

   A date in small caps is easy to scroll past, and so is a sentence — "ends in
   2d 11h" sat under the masthead as one more line of text and carried none of
   the pressure a limited drop is supposed to carry.

   Set as segments instead: the standard drop convention, where each unit gets
   its own block and the seconds move. The movement is the point. A countdown
   that does not visibly tick is a graphic saying a number, and the reader has
   no reason to believe anything is running out.

   Tabular numerals throughout, so the blocks do not jitter as digits change.
   ============================================================ */

const PAD = (n: number) => String(n).padStart(2, '0');

export type CountdownProps = {
  parts: DropParts;
  /** "Ends in" / "Starts in" */
  lead: string;
  /** Drops the days block once there are none left to show. */
  compact?: boolean;
  /** A quiet line under the digits — the dates, so they stay on the surface. */
  note?: string;
  onClick?: () => void;
};

export function Countdown({ parts, lead, compact, note, onClick }: CountdownProps) {
  const showDays = !compact && parts.days > 0;
  const cells: [string, string][] = [
    ...(showDays ? ([[PAD(parts.days), 'DAYS']] as [string, string][]) : []),
    [PAD(parts.hours), 'HRS'],
    [PAD(parts.mins), 'MIN'],
    [PAD(parts.secs), 'SEC'],
  ];

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="dropclock" type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="dropclock__lead">{lead}</span>
      <span className="dropclock__row">
        {cells.map(([v, l], i) => (
          <span className="dropclock__cell" key={l}>
            <b className="t-num">{v}</b>
            <small>{l}</small>
            {i < cells.length - 1 && <i className="dropclock__sep" aria-hidden="true" />}
          </span>
        ))}
      </span>
      {note && <span className="dropclock__note">{note}</span>}
    </Tag>
  );
}
