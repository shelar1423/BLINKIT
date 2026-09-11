# Asset brief — bringing every image onto Blinkit's language

Audit of all 52 shipped assets against what Blinkit actually does. **29 are off**,
all for the same reason: they are glossy 3D illustration — gold, sparkles, swoosh
trails — which is the house style this project inherited, not Blinkit's.

## What Blinkit actually does

Established from their own surfaces earlier in this build — the Ganeshotsav and
"Scream for Ice Cream" storefronts, the blinkit.com category tiles, the live Hot
Wheels PDP:

| Asset class | Blinkit's treatment |
|---|---|
| Anything that is a **product** | real product photography, cut out, on flat colour |
| Rewards, badges, empty states | **flat 2D vector** illustration |
| Campaign masthead | dimensional type treatment (the glowing ICE CREAM lockup) |
| Decoration | flat graphic — swashes, scallops, tabs |

There is **no glossy 3D illustration anywhere** in Blinkit's language. That is the
single rule the 29 assets break.

---

## Keep as-is (23)

Do not regenerate these.

- `cars/*-diecast.webp` (5) — rendered from the real GLBs; these *are* product photography
- `campaign/card-drop`, `card-leaderboard` — composited from those renders
- `campaign/card-rewards` — flat vector, correct for a non-product
- `campaign/race-it-home-wordmark` — dimensional masthead, the one place Blinkit goes glossy
- `campaign/track-divider`, `decor/tire-mark`, `decor/pdp-garage` — photographic
- `campaign/06-campaign-hub-hero` — cinematic hero, kept deliberately
- `campaign/14-ar-toy-car-placement` — already a photograph
- `campaign/delivery-map` — a map graphic, which Blinkit does use for tracking
- `assets/c_*.png` (8) — real Blinkit category photography
- `brand/hot-wheels.svg` — the official mark

---

## Regenerate (29), in four families

Each family shares one style block. Paste the family's block, then the subject
line for the asset. Every prompt is **1024×1024, transparent PNG** unless noted.

---

# Family A — Flat vector icons (6)

Rewards, badges and tokens. These are not products, so Blinkit illustrates them —
the same flat treatment as the trophy card that already works.

### Style block A

```
Flat 2D vector illustration in a clean modern app-icon style: solid flat colour fills, simple bold geometric shapes, crisp clean edges, minimal flat shading with at most two tones per shape. No gradients on the main forms, no photorealism, no 3D rendering, no bevels, no glossy highlights, no drop shadows, no sparkles. The look of a polished mobile-app spot illustration, not a render.

Palette, used strictly: warm gold #F8CB46, deeper gold #E0A93B for the minimal shading, pale cream #FFF3D2 for highlights, flame red #ED1C24 and Blinkit green #0C831F as accents only. ABSOLUTELY NO purple, violet, magenta, lavender or pink anywhere.

NO text, NO letters, NO numbers, NO logos, NO wordmarks anywhere in the image.

Isolated on a fully transparent background. Subject centred, filling about 80% of the frame, with clear margin on all four sides.
```

### Subjects

**A1 · `rewards/25-01-gold-coin.webp`**
```
A single round gold coin seen face on, with a thin darker gold rim and a simple lightning-bolt symbol embossed flat in the centre. Slight tilt.
```

**A2 · `rewards/25-02-free-delivery-badge.webp`**
```
A simple delivery scooter seen from the side in flat shapes, gold body with a flame-red seat, with two small motion dashes behind it.
```

**A3 · `rewards/25-03-wallet-reward-token.webp`**
```
A closed wallet seen face on in flat gold, with a single coin peeking above its top edge and a small flame-red fold strap across the front.
```

**A4 · `rewards/25-06-premium-membership-icon.webp`**
```
A simple five-pointed star sitting inside a rounded shield outline, gold on gold with a flame-red band across the shield's lower third.
```

**A5 · `rewards/15-cart-reward-badge.webp`**
```
A simple shopping basket seen three-quarter on in flat gold, with one coin dropping into it from above.
```

**A6 · `rewards/19-rewards-progression-track.webp`** — **wide, 1536×512**
```
A horizontal progress track: a straight gold bar running left to right with four evenly spaced round milestone nodes along it, the first two filled solid gold and the last two hollow outlines, and a small chequered flag marker at the right end. Flat shapes only.
```

---

# Family B — Grocery pickups (8)

These are the items collected on the track. They are **products**, so they should
be photography — the same treatment as everything on a Blinkit category tile.

### Style block B

```
Studio product photograph of a single everyday Indian supermarket item, shot straight on at a slight three-quarter angle, evenly lit with soft diffused light, gentle specular highlights, sharp focus throughout, clean and appetising. Real photography — NOT an illustration, NOT a 3D render, NOT glossy cartoon styling, NO sparkles, NO glow, NO motion trails.

NO text you invent, NO brand logos, NO wordmarks — keep any packaging blank or generic.

Isolated on a fully transparent background with a soft contact shadow directly beneath the item. Subject centred, filling about 85% of the frame.
```

### Subjects

**B1 · `grocery/24-01-banana-pickup.webp`** — `A small bunch of four ripe yellow bananas.`
**B2 · `grocery/24-02-milk-carton-pickup.webp`** — `A one-litre carton of milk, plain white and blue packaging with no branding, standing upright.`
**B3 · `grocery/24-03-chips-packet-pickup.webp`** — `A sealed foil packet of potato chips, plain warm-yellow packaging with no branding, standing upright and slightly puffed.`
**B4 · `grocery/24-04-cola-bottle-pickup.webp`** — `A 500 ml plastic bottle of dark cola with a red cap and a plain unbranded label.`
**B5 · `grocery/24-05-cereal-box-pickup.webp`** — `A rectangular breakfast cereal box standing upright, plain orange packaging with no branding.`
**B6 · `grocery/24-06-ice-cream-pickup.webp`** — `A single vanilla ice cream cone with a swirl of soft serve, held upright.`
**B7 · `grocery/24-07-grocery-delivery-bag-pickup.webp`** — `A plain yellow paper grocery bag standing upright, full, with fresh vegetables and a baguette visible at the top.`
**B8 · `grocery/24-08-fruit-basket-pickup.webp`** — `A small woven basket of mixed fresh fruit — apples, oranges, bananas — seen three-quarter on.`

---

# Family C — Catalogue cars (10)

Ten catalogue entries have no GLB behind them, so their images are AI renders that
do not match the five real ones. These must sit next to `ballistik-diecast.webp`
and friends in the same grid, so they need the **same studio treatment**.

### Style block C

```
Studio product photograph of a single 1:64 scale Hot Wheels style die-cast toy car, photographed at a three-quarter front angle from slightly above, as it would appear in an online store listing. Real die-cast metal body with glossy clearcoat paint, chrome detailing, plastic wheels with visible rims. Soft even studio lighting from above and front, gentle specular highlights along the body, a soft contact shadow directly beneath, sharp focus throughout.

Real product photography of a small toy — NOT a real full-size car, NOT a 3D illustration, NOT a cartoon, NO motion trails, NO sparkles, NO glow, NO background scenery.

NO text, NO numbers, NO logos, NO wordmarks anywhere on the car or in the image.

Isolated on a fully transparent background. Car centred, filling about 88% of the frame width, with clear margin on all sides.
```

### Subjects

**C1 · `Muscle Bound`** — `A chunky 1970s American muscle car with a raised hood scoop and exposed engine block, painted metallic burnt orange with a matte black bonnet stripe.`
**C2 · `Retro Racer`** — `A 1960s European racing coupe with a long bonnet and rounded tail, painted bright racing yellow with a single red stripe down the centre.`
**C3 · `Night Shifter`** — `A low modern supercar with sharp angular panels and a rear wing, painted deep metallic purple with black trim.`
**C4 · `Performance Pickup`** — `A lowered pickup truck with a short bed and wide rear tyres, painted deep metallic blue with an orange side stripe.`
**C5 · `Race Prototype`** — `An enclosed endurance prototype racer with a low nose and tall rear wing, painted flame red with white accents.`
**C6 · `Metallic Edition`** — `A sleek modern sports coupe with a mirror-polished chrome body, no paint, reflecting the studio light.`
**C7 · `Premium Limited Racer`** — `A wide-bodied track car with a large rear wing and front splitter, painted gloss black with gold wheels and thin gold pinstriping.`
**C8 · `Featured Drop Car`** — `A futuristic concept racer with a canopy cockpit and covered rear wheels, painted gloss white with flame-orange graphics along the flanks.`
**C9 · `Mystery Drop Car`** — `A die-cast toy car completely hidden under a smooth matte black cloth cover draped over it, only the silhouette and the bottom of the wheels visible.`
**C10 · `Phantom Reveal`** — `A sharp-edged modern hypercar painted deep flame red with gold-rimmed wheels and a gold roof stripe.`

---

# Family D — Campaign scenes (5)

Full scenes rather than cut-outs. Photographic, matching the campaign hero that
already works.

### Style block D

```
Cinematic photograph of a small-scale toy racing world, shot with a macro lens at a low angle as if the viewer is down at table level. Real 1:64 die-cast toy cars and orange plastic Hot Wheels track. Soft warm directional light, shallow depth of field with the background falling gently out of focus, gentle atmospheric haze, rich contrast.

Real photography of real toys — NOT a 3D illustration, NOT a cartoon, NO sparkles, NO glow trails, NO gold confetti.

Palette: warm amber light, orange track plastic, flame red and racing blue cars, deep charcoal shadow. ABSOLUTELY NO purple, violet, magenta or pink anywhere.
NO text, NO letters, NO numbers, NO logos, NO wordmarks anywhere.
```

### Subjects

**D1 · `campaign/08-race-complete-illustration.webp`** — race result hero. **1024×1024, transparent.**
```
A single flame-red die-cast toy car crossing a chequered finish line on orange plastic track, tape breaking across its nose, seen from a low three-quarter front angle. Isolated on a fully transparent background, centred, filling about 85% of the frame.
```

**D2 · `campaign/18-leaderboard-hero.webp`** — leaderboard hero. **1536×1024, opaque.**
```
Three die-cast toy cars lined up side by side facing the camera on orange plastic track — flame red in the centre and slightly ahead, racing blue to its left, gloss black to its right. A chequered flag lying blurred in the background. Full-bleed opaque scene.
```

**D3 · `campaign/20-refer-a-friend-hero.webp`** — invite hero. **1536×1024, opaque.**
```
Two die-cast toy cars nose to nose on orange plastic track as if squaring up, one flame red and one racing blue, shot low and close between them. Full-bleed opaque scene.
```

**D4 · `campaign/16-order-success-hero.webp`** — order placed hero. **1536×1024, opaque.**
```
A flame-red die-cast toy car on orange plastic track heading away from the camera toward a small cardboard delivery box sitting at the end of the track. Full-bleed opaque scene.
```

**D5 · `decor/marker-car.webp`** — the little car on the delivery tracker. **512×512, transparent.**
```
A single flame-red die-cast toy car seen in flat profile from the side, facing right, no perspective. Isolated on a fully transparent background, filling about 90% of the frame width.
```

---

## When you have them

Drop them in `blinkit_campaign_hero_assets/` under any names and tell me which
family each belongs to. I will trim each to its alpha bounding box, size it to
the canvas the app actually renders, convert to WebP, wire it in, and re-run the
violet audit.

Worth generating **one from each family first** and checking it in the running app
before doing all 29 — a grocery pickup renders at about 90 px in the race, and
detail that reads at 1024 px disappears at that size.
