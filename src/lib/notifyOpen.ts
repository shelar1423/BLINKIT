// Pings the alert endpoint the first time this browser opens the site.
// - A random per-browser flag is stored so reloads/revisits don't re-alert.
// - Opening with ?me=1 once marks this browser as the owner's, so your own
//   visits stay silent from then on.
const SEEN = 'rih_open_pinged';
const OWNER = 'rih_owner';

export function notifyOpen(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('me') === '1') {
      localStorage.setItem(OWNER, '1');
    }
    if (localStorage.getItem(OWNER) === '1') return;
    if (localStorage.getItem(SEEN) === '1') return;

    localStorage.setItem(SEEN, '1');
    void fetch('/api/notify', { method: 'POST', keepalive: true }).catch(() => {});
  } catch {
    // Storage blocked (private mode etc.) - skip silently.
  }
}
