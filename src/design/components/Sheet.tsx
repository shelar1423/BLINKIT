import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ============================================================
   Bottom sheet.

   Blinkit puts almost every secondary surface in one — address, variants,
   coupon detail — rather than pushing a whole route for something you are
   meant to read and dismiss. This is that component, built once here so the
   campaign and anything after it share the same behaviour.

   The parts that are easy to get wrong and are handled:

   - It closes on the backdrop, on Escape, and on a downward drag, because a
     sheet that only closes by a small button is a trap on a phone.
   - The page behind it does not scroll while it is open. Without that, the
     feed slides around under your finger as you drag the sheet.
   - It unmounts after the close animation rather than instantly, so it slides
     out instead of vanishing.
   - Focus moves into the sheet on open, and the backdrop is inert to screen
     readers, so it is not just a visual layer.
   ============================================================ */

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional pinned action row along the bottom. */
  footer?: ReactNode;
};

const EXIT_MS = 220;

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  /* `open` is the caller's intent; `mounted` is what is actually in the DOM.
     They differ for exactly the length of the close animation. */
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // a frame between mount and the shown class, or there is no transition
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = window.setTimeout(() => {
      setMounted(false);
      setDrag(0);
    }, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  useEffect(() => {
    if (shown) panel.current?.focus();
  }, [shown]);

  if (!mounted) return null;

  const onDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
  };
  const onMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    // downward only: dragging up should not lift the sheet off its edge
    setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (startY.current == null) return;
    // past a third of the panel and it is a dismiss, not a fidget
    const h = panel.current?.offsetHeight ?? 300;
    if (drag > h / 3) onClose();
    else setDrag(0);
    startY.current = null;
  };

  return (
    <div className={'sheet' + (shown ? ' is-open' : '')}>
      <button className="sheet__scrim" type="button" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet__grip"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <i />
        </div>
        {title && <h2 className="sheet__title">{title}</h2>}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}
