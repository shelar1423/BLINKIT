import { useCallback, useRef, useState } from 'react';

/* ============================================================
   Floating score changes.

   Collecting groceries and hitting things both move the score, and neither
   said so: the counter in the corner just quietly changed, which in the middle
   of a race nobody is looking at. A number that lifts off the car and fades is
   the feedback — green up for a pickup, red for a hit.

   They rise from the lower third, which is where the chase camera keeps the
   car, and each one is nudged sideways so a run of pickups reads as several
   separate gains rather than one number flickering in place.
   ============================================================ */

export type Pop = { id: number; text: string; kind: 'up' | 'down'; x: number };

export function useScorePops() {
  const [pops, setPops] = useState<Pop[]>([]);
  const seq = useRef(0);

  const push = useCallback((points: number, kind: 'up' | 'down') => {
    const id = ++seq.current;
    const text = kind === 'up' ? `+${points}` : `-${points}`;
    // spread within the middle half of the screen, alternating side to side
    const x = 50 + (seq.current % 2 ? 1 : -1) * (6 + Math.random() * 14);
    setPops((p) => [...p.slice(-4), { id, text, kind, x }]);
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
  }, []);

  return { pops, push };
}

export function ScorePops({ pops }: { pops: Pop[] }) {
  return (
    <>
      {pops.map((p) => (
        <span key={p.id} className={`pop pop--${p.kind}`} style={{ left: `${p.x}%` }}>
          {p.text}
        </span>
      ))}
    </>
  );
}
