import { useEffect, useState } from 'react';
import { lockActive, racerOff, rankFor, useStore } from '../store/useStore';

/* ============================================================
   The racer price, where the player shops.

   The race costs Blinkit a home-screen slot, so it has to pay its way in
   conversion. Points climb one ladder (1,000 → 5%, 2,500 → 10%, 5,000 → 15%,
   8,000 → 20%), and the step reached is a racer price on every Hot Wheels car
   for 24 hours. Everything here reads that lock:

   - Every car's price wears Blinkit's own yellow price ticket, the one it uses
     for its best prices, with the shelf price struck beside it and one blue
     line under it that turns over between "10% off · Race reward" and the
     rank, the way Blinkit turns its "Lowest in 30 days". The product page
     carries the same ticket and line, and the bill takes off exactly that.
   - How long it lasts is said once, not on every card: a slim timer strip
     above the listing's grid, "Race reward ends in 23h 41m".
   - The lock is announced once, wherever the player lands first:
       the listing, cart empty           -> a slim bar shaped like the cart pill
       the listing, cart already has items -> nothing; the cart pill owns that
                                            spot, the tickets say it
       home (left the result screen without Shop now) -> a sheet, whose button
                                            goes to the listing
     Every visit after that, the tickets alone carry it.
   - When it runs out, or an order spends it, all of it goes.
   ============================================================ */

const SEEN = 'rih-reward-pop-seen';

export type RacerDeal = { id: string; pct: number; rank: number; until: number; hoursLeft: number };

/** A clock that ticks once a minute, so time-left copy and expiry stay true. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** The racer price locked by the last race, while it is still running. */
export function useRacerDeal(): RacerDeal | null {
  const lock = useStore((s) => s.racerLock);
  const points = useStore((s) => s.totalPoints);
  const now = useMinute();
  if (!lockActive(lock, now)) return null;
  return {
    id: String(lock.until),
    pct: lock.pct,
    /* Today's standing, for the line under the price. It never sets the price. */
    rank: rankFor(points),
    until: lock.until,
    hoursLeft: Math.max(1, Math.ceil((lock.until - now) / 3600000)),
  };
}

/** The price a car sells at under the racer price. */
export const racerPrice = (price: number, pct: number) => Math.max(0, price - racerOff(price, pct));

/** Whether this lock's announcement has been shown, so it appears once per lock. */
export function popSeen(id: string) {
  /* On the comparison page each phone says for itself whether it was seen. */
  const q = new URLSearchParams(window.location.search);
  if (q.get('seed') === '1') return q.get('seen') === '1';
  try {
    return localStorage.getItem(SEEN) === id;
  } catch {
    return false;
  }
}
export function markPopSeen(id: string) {
  if (new URLSearchParams(window.location.search).get('seed') === '1') return;
  try {
    localStorage.setItem(SEEN, id);
  } catch {
    /* storage blocked: it may show again, which is harmless */
  }
}
