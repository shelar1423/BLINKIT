import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { Analytics } from './components/Analytics';
import './styles/tokens.css';
import './styles/base.css';

/* Inside the case study's phone frame the page scrollbar reads as a grey bar down the
   screen. Mark embedded runs so base.css can hide it there and nowhere else. */
try {
  if (window.self !== window.top) document.documentElement.classList.add('is-embedded');
} catch {
  document.documentElement.classList.add('is-embedded');
}

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');

/* ?sim=dark or ?sim=offline previews the AR edge states for a demo; ?sim=off
   clears it. Kept for the visit so it survives navigating into the race. */
try {
  const sim = new URLSearchParams(window.location.search).get('sim');
  if (sim === 'off') window.sessionStorage.removeItem('rih-sim');
  else if (sim) window.sessionStorage.setItem('rih-sim', sim);
} catch {
  /* storage blocked: the URL still works on the AR screen itself */
}

createRoot(el).render(
  <StrictMode>
    <BrowserRouter>
      <Analytics />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
