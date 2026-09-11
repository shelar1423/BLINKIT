#!/usr/bin/env node
/* ============================================================
   Guard against a class name being defined twice in two places.

   The styles are one flat global namespace, so a new component that picks a
   short class name can silently inherit an unrelated component's layout. That
   happened: a new drop countdown was called `.cdown`, which was already the
   race's 3-2-1 overlay — `position: absolute; inset: 0` — and the countdown
   rendered stretched across the whole campaign band, behind the tiles. Nothing
   errored. The build passed. It was only visible on screen, and only obvious
   once the boxes were measured.

   This fails the build on the shape of that mistake: the same bare class
   written as a whole selector in two places far enough apart to be different
   sections of the file.

   What it deliberately does not flag, because all of these are how CSS is
   meant to be written:

   - `.x` then `.x:active`, `.x.is-open`, `.x--variant` — states and modifiers.
   - `.page .x` — a scoped override. The ancestor is the point.
   - Anything inside `@media` / `@supports` — redefining there is the job.
   - Two rules a few lines apart, which is one component's block.
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Walk for .css rather than fs.globSync, which is still experimental and
 *  prints a warning on every build. */
function cssFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...cssFiles(full));
    else if (e.name.endsWith('.css')) out.push(full);
  }
  return out;
}

/** Rules this far apart are different sections, not one component's block. */
const DISTANT_LINES = 40;

const files = cssFiles('src');

/** Blank a region while keeping line numbers intact. */
const blank = (m) => '\n'.repeat((m.match(/\n/g) || []).length);

const seen = new Map(); // class -> [{file, line}]

for (const file of files.sort()) {
  let text = readFileSync(file, 'utf8');
  text = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  // at-rule bodies: redefining inside one is intentional
  text = text.replace(/@(?:media|supports|keyframes)[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, blank);

  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const line = text.slice(0, m.index).split('\n').length;
    for (const part of m[1].split(',')) {
      // the WHOLE selector must be a bare class — `.pdp .card` is a scoped
      // override and `.btn:active` is a state, neither of which is a clash
      const hit = /^\s*\.([A-Za-z0-9_-]+)\s*$/.exec(part);
      if (!hit) continue;
      const cls = hit[1];
      if (!seen.has(cls)) seen.set(cls, []);
      seen.get(cls).push({ file, line });
    }
  }
}

const clashes = [];
for (const [cls, sites] of seen) {
  if (sites.length < 2) continue;
  const sameFile = new Set(sites.map((s) => s.file)).size === 1;
  const lines = sites.map((s) => s.line);
  const spread = Math.max(...lines) - Math.min(...lines);
  // across two files it is always worth knowing; within one, only if distant
  if (!sameFile || spread > DISTANT_LINES) clashes.push({ cls, sites, spread });
}

if (clashes.length) {
  console.error('\n✗ CSS class defined in two separate places:\n');
  for (const { cls, sites, spread } of clashes) {
    console.error(`  .${cls}  (${spread} lines apart)`);
    for (const s of sites) console.error(`      ${path.relative('.', s.file)}:${s.line}`);
  }
  console.error(
    '\n  Two distant blocks for one class means one is silently overriding the\n' +
      '  other. Rename the newer one, or merge them into a single block.\n',
  );
  process.exit(1);
}

console.log(`✓ no duplicate class definitions across ${files.length} stylesheet(s)`);
