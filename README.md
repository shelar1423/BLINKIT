# Blinkit × Hot Wheels — Race It Home

A working, mobile-first campaign experience built as if Blinkit shipped a Hot Wheels activation
inside its existing product. Not a mockup, not a phone-frame simulator, no fake AR.

React 18 · TypeScript · Vite · three.js · zustand · React Router.

## Design system

Tokens in `src/styles/tokens.css` are read off the live Blinkit product — the `:root` custom
property dump from blinkit.com — not invented:

| Role | Value | Blinkit's own name |
|---|---|---|
| Brand ground | `#F8CB46` | `--colors-base-yellow` |
| Action | `#0C831F` | `--color__grg1` (ADD, price, ETA, CTA) |
| Brand green | `#318616` | `--colors-base-green` |
| Ink | `#1F1F1F` | `--colors-base-black` |
| Page ground | `#F5F8FA` | `--colors-base-appbase` |
| Body text | `#666666` | `--color__grc2` |
| Header height | `68px` | `--header__height--mobile` |

Blinkit sets **Okra**, a licensed ITF typeface that can't be redistributed, so the build ships
**Figtree** (SIL OFL) under the family name `Blinkit Sans` — one 20 KB variable file covering
300–900, matched on x-height, contrast and bowl geometry.

**On the yellow collision.** Hot Wheels' own yellow (`#FFC400`) is within a few degrees of
Blinkit's `#F8CB46`, so the campaign would have disappeared into the brand. Hot Wheels yellow is
therefore absent from this build: yellow is Blinkit's ground, green is the action, and the
campaign leads with Hot Wheels **flame red** (`#ED1C24`) — maximum contrast on yellow, and the
most recognisably Hot Wheels part of the palette.

**Campaign chrome follows Blinkit's own takeover pattern.** When Blinkit runs a festival
(Ganeshotsav, for instance) it re-skins the entire header in the campaign's colours, adds a tab to
the category rail with a `New` badge, and drops a themed bento grid that ends in a scalloped edge
handing back to the white product feed. Race It Home uses exactly that device in flame red, so the
campaign never has to fight Blinkit's yellow. The permanent tab bar — a floating pill of
Home · Order Again · Categories · Print — is untouched, because a campaign never adds a tab; the
race lives on the partner shortcut that floats beside it.

Campaign artwork was authored in Zepto violet. `scripts/recolor-violet.py` remaps only the
violet/magenta band (240–328°) to Blinkit gold, leaving Hot Wheels red, orange and true blue
untouched; originals are preserved in `art-originals/` (not bundled or committed), so the pass is fully reversible. Purple die-cast paint — the
Night Shifter — is product colour, not brand colour, and is left alone.

Independent concept. Not affiliated with or endorsed by Blinkit or Mattel.

## Run

```bash
npm install
npm run dev
```

Opens on `http://localhost:5180`, and Vite also prints a `Network:` URL you can open on your phone
on the same Wi-Fi. `npm run build` → `npm run preview` for the production bundle.

## Architecture

React owns the app, routing and state. The three 3D surfaces are **vanilla three.js** mounted into
a container by a thin effect. That was deliberate:

- `@react-three/xr` is version-fragile against three/R3F, and the brief prioritised reliability.
- The game loop must never trigger React re-renders. The engine pushes stats out through a callback
  which React throttles into HUD state; the simulation itself never touches the React tree.

```
src/
  lib/three/
    modelLoader.ts    GLB load + cache + normalisation
    productViewer.ts  PDP 3D viewer (orbit, zoom, IBL, contact shadow)
    raceEngine.ts     the actual game: track, collision, scoring, laps
    raceScene.ts      3D race runtime (renderer, chase camera)
    arSession.ts      real WebXR immersive-ar: hit-test, reticle, anchoring
  store/useStore.ts   persisted campaign + cart state
  data/catalog.ts     products, pickups, categories, leaderboard
  components/blinkit/ Blinkit chrome: header, bottom nav, product card, ADD control
  pages/              one file per route
```

## GLB handling

The five supplied models have wildly different scales and origins, so `normalizeModel()`:

1. measures the bounding box,
2. rotates so the longer horizontal axis becomes the car's length, aligned to −Z,
3. scales uniformly so length = a requested target,
4. centres X/Z,
5. drops the lowest point onto `y = 0` so wheels sit exactly on the ground.

Prototypes are cached per URL and cloned per use, so opening the same car twice costs one download.

**Originals are untouched.** `models-original/` holds your five uncompressed GLBs (101 MB, not
shipped). `public/models/` holds runtime copies generated with `gltf-transform optimize`
(texture resize to 1024 + quantisation, no Draco so no decoder fetch): 101 MB → 13 MB, ~2.5 MB per
car, loaded lazily only when a car is opened.

## The race is a real game

`raceEngine.ts` models the car as `(t, lateral)` — normalised progress along a closed CatmullRom
circuit, plus offset across the road. That makes collision and lap counting exact 2D maths rather
than physics guesswork.

- Car accelerates on its own; you steer. Hold the left or right half of the screen (or arrow keys /
  A-D on desktop, space to boost).
- 46 grocery pickups from the supplied artwork, placed along the circuit. Collection is a genuine
  proximity test on `(t, lateral)` — no scripted increments.
- Cones scrub speed; barriers clamp you to the road.
- Ends on lap 2 **or** when 45 s expires, whichever comes first. Both paths are handled.
- Score → reward tier → Blinkit Cash that actually reduces the cart total.

Verified by driving the engine headlessly (1,832 steps): 2 laps in 31 s, 25 groceries collected,
25 score events, 21 of 46 pickups left untouched, finish fired on lap completion.

## AR is real WebXR

`arSession.ts` requests `immersive-ar` with `requiredFeatures: ['hit-test']` and
`optionalFeatures: ['dom-overlay', 'local-floor', 'light-estimation']`.

1. Reticle follows real `XRHitTestResult` poses.
2. Tap places the circuit in the `local` reference space — it stays anchored there; nothing is
   parented to the camera after placement.
3. The track scales to a ~1.5 m tabletop footprint; the car renders at true 1:64 (7.4 cm).
4. Same engine, same steering, same scoring as the 3D race.

**No fallback pretends to be AR.** `detectAR()` reports one of three states and the UI says which
you'll get: full WebXR, "needs HTTPS", or "not available in this browser — play in 3D instead".

Browser reality: WebXR needs a secure context, so over a plain LAN IP it will report the HTTPS
state. iOS Safari does not implement WebXR at all (verified against caniuse: `ios_saf` 26.1–26.6
all report no support), so iPhones get the honest 3D fallback.

## What's verified

| Area | Result |
|---|---|
| GLB loads, normalised, visible | Ballistik 2.2 MB in 65 ms, wheels on ground, full car framed |
| 3D viewer | drag-rotate, pinch-zoom, reset, IBL lighting, contact shadow |
| Race | 2 laps, 25 pickups by real collision, finish + timeout both fire |
| Score → reward | 5,200 pts → `pit` tier → ₹50 off |
| Cart | add / step / remove, totals recompute |
| Checkout | ₹249 − ₹50 reward + ₹9 handling = **₹208** |
| Order success | BLK42013, cart emptied, 5-stage race-track tracker advances |
| Persistence | points, best score, races left, rewards, cart survive reload |
| Mystery car | revealed only after score genuinely passed 5,000 |
| Typecheck | `tsc --noEmit` clean |
| Build | 90 KB gzip commerce shell; three.js split into its own async chunk |

## Known limits

- **Referral has no backend.** Sharing uses the Web Share API (clipboard fallback). Nothing can
  genuinely confirm a friend raced, so the unlock sits behind an explicitly-labelled demo button
  rather than pretending a server confirmed it.
- Checkout takes no payment.
- Prices, drop times, points and reward values are illustrative.
- No audio yet — the brief listed it as optional and gameplay was the priority.
