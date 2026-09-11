import type { ReactNode } from 'react';

/* ============================================================
   Element — Tag.
   The small status pills on the PDP and product cards.
   ============================================================ */

export type TagTone = 'blue' | 'dark' | 'green' | 'flame';

export function Tag({ tone = 'dark', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}
