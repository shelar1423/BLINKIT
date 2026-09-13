import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
const Diag = lazy(() => import('./pages/Diag'));
import { BottomNav } from './design/components/BottomNav';
import { IconCheck } from './design/elements/Icons';
import ErrorBoundary from './components/ErrorBoundary';
import { DriftLoader } from './design/components/DriftLoader';
import { primeAudio } from './lib/horn';

import Home from './pages/Home';
import HotWheels from './pages/HotWheels';
const Product = lazy(() => import('./pages/Product'));
import Campaign from './pages/Campaign';
import Race from './pages/Race';
const RacePlay = lazy(() => import('./pages/RacePlay'));
const ARView = lazy(() => import('./pages/ARView'));
import Rewards from './pages/Rewards';
import Leaderboard from './pages/Leaderboard';
import Invite from './pages/Invite';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import NotFound from './pages/NotFound';

/* ---------------- toast ---------------- */
type ToastCtx = { toast: (msg: string) => void };
const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

/** Routes that take over the screen — no bottom nav, no page padding. */
const FULLSCREEN = ['/race/play'];
/** Routes with their own sticky action bar, where Blinkit drops the tab bar. */
const NO_NAV = [/^\/hot-wheels\/[^/]+$/, /^\/cart$/, /^\/checkout$/, /^\/ar(\/|$)/, /^\/diag$/, /^\/order-success$/];

export default function App() {
  const [msg, setMsg] = useState<string | null>(null);
  const loc = useLocation();

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout((toast as unknown as { t?: number }).t);
    (toast as unknown as { t?: number }).t = window.setTimeout(() => setMsg(null), 2200);
  }, []);

  /* Unlock audio on the first touch anywhere, once.

     iOS only lets a page make sound from an AudioContext that was created or
     resumed inside a user gesture, and it was previously only primed by the
     horn button. The race engine starts on a countdown two seconds after the
     last tap, and a player steering by tilt may never touch the screen at all
     — so the sound that is supposed to run for the whole race could never
     start. Priming here means the tap that opened the app covers everything
     after it. */
  useEffect(() => {
    const unlock = () => primeAudio();
    const opts = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  const full = FULLSCREEN.some((p) => loc.pathname.startsWith(p));
  const hideNav = full || NO_NAV.some((re) => re.test(loc.pathname));

  return (
    <Ctx.Provider value={value}>
      <div className="app">
        <ErrorBoundary>
        {/* While a page's code downloads — the race and AR screens are the heavy
            ones — the same Hot Wheels loader the race uses, not a spinner. */}
        <Suspense fallback={<DriftLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/hot-wheels" element={<HotWheels />} />
          <Route path="/hot-wheels/:id" element={<Product />} />
          <Route path="/campaign" element={<Campaign />} />
          <Route path="/race" element={<Race />} />
          <Route path="/race/play" element={<RacePlay />} />
          <Route path="/ar" element={<ARView />} />
          <Route path="/ar/:id" element={<ARView />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          {/* device diagnostics — deliberately unlinked */}
          <Route path="/diag" element={<Diag />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        {!hideNav && <BottomNav />}
      </div>
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          <IconCheck size={16} />
          <span>{msg}</span>
        </div>
      )}
    </Ctx.Provider>
  );
}
