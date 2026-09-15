import { useEffect, useRef, useState } from 'react';

/* ============================================================
   Back to top.

   Blinkit's own, and its rule is the interesting part: the pill does not
   appear because you are far down the page, and it does not appear because you
   are scrolling up. It appears when BOTH are true — far down, and now heading
   back. That is the moment somebody is actually looking for the top, and it is
   why the control can be a floating pill over the content rather than a
   permanent fixture taking a corner of every screen.

   Scrolling down again puts it away, which is the same rule read backwards:
   somebody going further down is not looking for the top.
   ============================================================ */

/** How far down before going up counts as wanting the top: a fold and a half. */
const DEEP = 1.5;
/** Ignore the jitter a finger leaves at the end of a flick. */
const SLOP = 6;

export function BackToTop() {
  const [show, setShow] = useState(false);
  const last = useRef(0);
  const el = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    last.current = window.scrollY;
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - last.current;
      if (Math.abs(dy) < SLOP) return;
      last.current = y;

      const deep = y > window.innerHeight * DEEP;
      /* Up and deep shows it; down hides it; near the top there is nothing to
         go back to. */
      if (!deep) setShow(false);
      else setShow(dy < 0);
    };

    /* One read per frame. Scroll fires far faster than anything can be drawn,
       and this runs on every page the nav appears on. */
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* Under whatever header is stuck to the top of THIS page, measured rather
     than assumed: the storefront's header and the listing's are different
     heights, and a hard-coded offset is right on one of them. */
  useEffect(() => {
    if (!show || !el.current) return;
    const hdr = document.querySelector('.bhdr');
    const top = hdr ? hdr.getBoundingClientRect().bottom : 0;
    el.current.style.setProperty('--b2t-top', `${Math.max(12, Math.round(top) + 10)}px`);
  }, [show]);

  return (
    <button
      ref={el}
      type="button"
      className={'b2t' + (show ? ' is-on' : '')}
      /* Out of the tab order and off the screen reader when it is not offered:
         a control nobody can see should not be a control anybody can reach. */
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        setShow(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.25" />
        <path d="M12 16.8 L12 7.6" />
        <path d="M8.2 11.2 L12 7.4 L15.8 11.2" />
      </svg>
      Back to top
    </button>
  );
}
