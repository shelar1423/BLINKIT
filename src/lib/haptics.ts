/* ============================================================
   Haptics.

   `navigator.vibrate` is refused until the document has seen a real tap, and
   every refusal logs an error. The race starts on its own countdown, so the
   first pickups fire before the player has touched anything — a hundred
   console errors in a single run, all of them for a buzz that was never going
   to happen.

   So: one entry point, which stays silent until a gesture has actually
   occurred, and never throws.
   ============================================================ */

let armed = false;

if (typeof window !== 'undefined') {
  const arm = () => {
    armed = true;
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('keydown', arm);
  };
  window.addEventListener('pointerdown', arm, { once: true });
  window.addEventListener('keydown', arm, { once: true });
}

/** Buzz, if the device can and the document is allowed to. */
export function haptic(pattern: number | number[]) {
  if (!armed) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw rather than returning false */
  }
}
