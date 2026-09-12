import { useEffect, useState } from 'react';
import { detectAR } from './three/arSession';

/**
 * Does this device do AR at all?
 *
 * Asked once per page load and shared, because `detectAR` ends in an
 * `isSessionSupported` call and every entry point in the app was about to ask
 * the same question independently.
 *
 * `null` means the answer has not arrived yet. Callers should treat that as
 * "assume yes" rather than hiding the AR route for a frame and then showing it,
 * which reads as a flicker.
 */
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function ask(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  inflight ??= detectAR().then((s) => {
    cached = s.kind === 'webxr' || s.kind === 'camera';
    return cached;
  });
  return inflight;
}

export function useARSupport(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(cached);
  useEffect(() => {
    let live = true;
    void ask().then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}
