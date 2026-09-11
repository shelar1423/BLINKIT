/* ============================================================
   The drop window — one source for every screen that mentions it.

   The dates were previously written out three times and the countdown was
   relative ("ends in 2 days"), which meant the campaign always claimed to be
   live no matter what day it actually was. These are the real dates, and the
   copy follows the state: a drop that has not opened yet counts down to its
   start, not to its end.
   ============================================================ */

/** Drop runs 12–14 November, inclusive. */
const DROP_START_MONTH = 10; // zero-based: 10 = November
const DROP_START_DAY = 12;
const DROP_END_DAY = 14;

export const DROP_DATES = '12–14 Nov';

function windowFor(year: number) {
  return {
    start: new Date(year, DROP_START_MONTH, DROP_START_DAY, 0, 0, 0, 0),
    end: new Date(year, DROP_START_MONTH, DROP_END_DAY, 23, 59, 59, 999),
  };
}

/** The next drop window that has not finished yet. */
export function dropWindow(now = new Date()) {
  const thisYear = windowFor(now.getFullYear());
  return now.getTime() <= thisYear.end.getTime() ? thisYear : windowFor(now.getFullYear() + 1);
}

export type DropPhase = 'before' | 'live' | 'ended';

function parts(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export type DropStatus = {
  phase: DropPhase;
  /** "Starts in" / "Ends in" — empty once the drop is over. */
  lead: string;
  /** "62d 8h" — empty once the drop is over. */
  remaining: string;
  /** A whole phrase, for places that want one string. */
  label: string;
};

export function dropStatus(now = new Date()): DropStatus {
  const { start, end } = dropWindow(now);
  const t = now.getTime();
  if (t < start.getTime()) {
    const r = parts(start.getTime() - t);
    return { phase: 'before', lead: 'Starts in', remaining: r, label: `Starts in ${r}` };
  }
  if (t <= end.getTime()) {
    const r = parts(end.getTime() - t);
    return { phase: 'live', lead: 'Ends in', remaining: r, label: `Ends in ${r}` };
  }
  return { phase: 'ended', lead: '', remaining: '', label: 'Drop ended' };
}
