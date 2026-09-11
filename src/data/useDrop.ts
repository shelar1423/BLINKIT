import { useEffect, useState } from 'react';
import { dropParts, dropStatus, type DropParts, type DropStatus } from './drop';

/**
 * The drop, re-read every second.
 *
 * Computing it once at render made the countdown a screenshot: it only moved
 * when something else on the page happened to re-render. A drop that says
 * "ends in" has to actually be ending.
 */
export function useDrop(): { status: DropStatus; parts: DropParts } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return { status: dropStatus(now), parts: dropParts(now) };
}
