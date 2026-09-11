import { useEffect, useState } from 'react';
import type { DropParts } from '../../data/drop';

/* ============================================================
   Split-flap countdown.

   A row of numbers that simply changes is a readout. A split-flap is a
   mechanism: the top leaf falls away, the new one drops into place, and the
   seconds cell does it once a second whether or not anyone is watching. That
   movement is the whole reason the drop feels like it is running out.

   How the illusion works, since the markup looks redundant otherwise. Each
   cell is one glyph clipped into two panes — the top pane shows the upper half
   of the number, the bottom pane the lower half. On a change:

   - the top pane immediately shows the NEW value, because it is what gets
     revealed as the old leaf falls off it;
   - the bottom pane keeps the OLD value until the new leaf lands on it;
   - a leaf carrying the OLD top half rotates down and away over the first
     half of the animation;
   - a leaf carrying the NEW bottom half rotates up into place over the second.

   So four copies of the digit exist mid-flip, showing two different values.
   That is the mechanism, not duplication.
   ============================================================ */

const FLIP_MS = 420;

function Pane({ value, kind }: { value: string; kind: 'top' | 'bot' }) {
  return (
    <span className={`flip__pane flip__pane--${kind}`}>
      <b>{value}</b>
    </span>
  );
}

function FlipCell({ value }: { value: string }) {
  /** What is currently settled on the display. */
  const [shown, setShown] = useState(value);
  /** Set only while a flip is in flight. */
  const [incoming, setIncoming] = useState<string | null>(null);

  useEffect(() => {
    if (value === shown) return;
    setIncoming(value);
    const t = window.setTimeout(() => {
      setShown(value);
      setIncoming(null);
    }, FLIP_MS);
    return () => window.clearTimeout(t);
  }, [value, shown]);

  return (
    <span className={'flip' + (incoming ? ' is-flipping' : '')}>
      {/* revealed by the falling leaf, so it already carries the new value */}
      <Pane kind="top" value={incoming ?? shown} />
      {/* still the old value until the incoming leaf lands on it */}
      <Pane kind="bot" value={shown} />
      {incoming && (
        <>
          <span className="flip__leaf flip__leaf--top">
            <Pane kind="top" value={shown} />
          </span>
          <span className="flip__leaf flip__leaf--bot">
            <Pane kind="bot" value={incoming} />
          </span>
        </>
      )}
    </span>
  );
}

const PAD = (n: number) => String(n).padStart(2, '0');

export type FlipClockProps = {
  parts: DropParts;
  /** "Ends in" / "Starts in" */
  lead: string;
  /** A quiet line under the flaps — the dates, so they stay on the surface. */
  note?: string;
  onClick?: () => void;
};

export function FlipClock({ parts, lead, note, onClick }: FlipClockProps) {
  const cells: [string, string][] = [
    ...(parts.days > 0 ? ([[PAD(parts.days), 'DAYS']] as [string, string][]) : []),
    [PAD(parts.hours), 'HRS'],
    [PAD(parts.mins), 'MIN'],
    [PAD(parts.secs), 'SEC'],
  ];

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="dropclock" type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="dropclock__lead">{lead}</span>
      <span className="dropclock__row">
        {cells.map(([v, l]) => (
          <span className="dropclock__cell" key={l}>
            {/* Two flaps per unit, so the tens digit sits still while the units
                digit flips — which is what a real board does. */}
            <span className="dropclock__flaps">
              <FlipCell value={v[0]} />
              <FlipCell value={v[1]} />
            </span>
            <small>{l}</small>
          </span>
        ))}
      </span>
      {note && <span className="dropclock__note">{note}</span>}
    </Tag>
  );
}
