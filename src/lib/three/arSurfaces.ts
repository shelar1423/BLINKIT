/* ============================================================
   The two elements an AR session puts on the page, and how to be sure they
   are gone.

   The renderer's canvas and the camera's <video> are appended to
   document.body, not into the React tree — they have to be, because in a
   WebXR session the DOM overlay owns the React side of the screen and the
   canvas cannot live inside it. The cost of that is that React cannot clean
   them up: they leave only when the session's own `end()` runs.

   Usually it does, on unmount. It did not when the phone put the browser to
   sleep and the page came back on an earlier screen — the canvas was still
   there, still drawing, painted over a product page, with the camera light
   still on. Two things fix it: the session ends when the page is hidden (see
   ARView), and any surface that outlives its session is swept on the next
   navigation away from /ar.

   No three.js in here on purpose. This is imported by App, which must not
   pull the whole AR chunk into the first load to do it.
   ============================================================ */

const MARK = 'data-ar-surface';

/** Mark a canvas or video as belonging to an AR session. */
export function tagARSurface(el: Element) {
  el.setAttribute(MARK, '');
}

/**
 * Remove every AR surface still on the page, stopping the camera behind any
 * of them. Safe to call when there are none, which is almost always.
 */
export function clearARSurfaces() {
  document.querySelectorAll(`[${MARK}]`).forEach((el) => {
    const stream = (el as HTMLVideoElement).srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      (el as HTMLVideoElement).srcObject = null;
    }
    el.remove();
  });
}
