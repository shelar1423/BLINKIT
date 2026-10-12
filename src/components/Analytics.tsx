import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../lib/analytics';

// Survives StrictMode's effect replay; only actual route changes count.
let previousPath: string | null = null;

export function Analytics() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (previousPath === pathname) return;
    previousPath = pathname;
    track('$pageview', { $current_url: window.location.origin + pathname, path: pathname });
  }, [pathname]);
  return null;
}
