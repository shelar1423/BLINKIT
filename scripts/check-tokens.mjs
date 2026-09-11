/**
 * Asserts the Constants layer and tokens.css agree.
 *
 * The palette has two consumers with different needs — the DOM reads CSS custom
 * properties, three.js needs packed integers — so the values exist in two
 * files. This is what stops them drifting apart, which is the failure mode that
 * put 22 loose colour literals in the 3D scenes in the first place.
 *
 * Run: npm run check:tokens
 */
import { readFileSync } from 'node:fs';

const ts = readFileSync('src/design/constants/colors.ts', 'utf8');
const css = readFileSync('src/styles/tokens.css', 'utf8');

// t('yellow', '#F8CB46')
const declared = [...ts.matchAll(/t\('([a-z0-9-]+)',\s*'(#[0-9A-Fa-f]{6})'\)/g)]
  .map(([, name, hex]) => ({ name, hex: hex.toUpperCase() }));

// --yellow: #F8CB46;
const inCss = new Map(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map(([, n, h]) => [n, h.toUpperCase()]),
);

const problems = [];
for (const { name, hex } of declared) {
  if (!inCss.has(name)) problems.push(`--${name} is declared in Constants but missing from tokens.css`);
  else if (inCss.get(name) !== hex) problems.push(`--${name}: Constants says ${hex}, tokens.css says ${inCss.get(name)}`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} token mismatch(es):\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('');
  process.exit(1);
}
console.log(`✓ ${declared.length} colour tokens match between Constants and tokens.css`);
