import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
const Diag = lazy(() => import('./pages/Diag'));
/* Deliberately unlinked, like /diag. See ResultPreview. */
const ResultPreview = lazy(() => import('./pages/ResultPreview'));
/* The AR onboarding on its own, so its three beats can be watched without
   opening a camera. Also unlinked. */
const IntroPreview = lazy(() => import('./pages/IntroPreview'));
import { BottomNav } from './design/components/BottomNav';
import { RewardsSheet } from './design/components/RewardsSheet';
import { IconCheck } from './design/elements/Icons';
import ErrorBoundary from './components/ErrorBoundary';
import { DriftLoader } from './design/components/DriftLoader';
import { primeAudio } from './lib/horn';
import { clearARSurfaces } from './lib/three/arSurfaces';

import Home from './pages/Home';
import HotWheels from './pages/HotWheels';
const Product = lazy(() => import('./pages/Product'));
const RacePlay = lazy(() => import('./pages/RacePlay'));
const ARView = lazy(() => import('./pages/ARView'));
/* Where you stand, shown once on the way back into a race. */
const LastResult = lazy(() => import('./pages/LastResult'));
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
const NO_NAV = [/^\/race\/result$/, /^\/hot-wheels\/[^/]+$/, /^\/cart$/, /^\/checkout$/, /^\/ar(\/|$)/, /^\/diag$/, /^\/order-success$/, /^\/preview\//];

export default function App() {
  const [msg, setMsg] = useState<string | null>(null);
  const loc = useLocation();
  const nav = useNavigate();

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

  /* Belt and braces for the AR canvas. It is appended to document.body, so if
     a session ever outlives its screen — a browser closed mid-race and
     reopened on an earlier page — nothing in React can reach it, and it draws
     a circuit over whatever is showing. Anywhere but /ar, there should be no
     AR surface on the page; if there is, it is a leak, and this sweeps it. */
  useEffect(() => {
    if (!/^\/ar(\/|$)/.test(loc.pathname)) clearARSurfaces();
  }, [loc.pathname]);

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
          <Route path="/race/play" element={<RacePlay />} />
          <Route path="/race/result" element={<LastResult />} />
          <Route path="/ar" element={<ARView />} />
          <Route path="/ar/:id" element={<ARView />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          {/* device diagnostics — deliberately unlinked */}
          <Route path="/diag" element={<Diag />} />
          {/* the result screen at any score, without driving for it */}
          <Route path="/preview/result" element={<ResultPreview />} />
          {/* the AR onboarding, without the AR */}
          <Route path="/preview/intro" element={<IntroPreview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        {!hideNav && <BottomNav />}
        {/* The campaign, everywhere, owned by nobody.
            On a query param rather than in a page's state so any screen can
            offer it, the back gesture closes it, and it can be linked to. */}
        <RewardsSheet
          open={new URLSearchParams(loc.search).has('rewards')}
          onClose={() => nav(-1)}
        />
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
