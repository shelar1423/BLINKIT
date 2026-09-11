# Art brief — 6 hero assets to regenerate

The campaign artwork currently in `public/` is the original Zepto-violet art put through
`scripts/recolor-violet.py`. The recolour holds up well on most assets, but six carry the campaign
and deserve to be authored in Blinkit's palette rather than mapped into it.

Originals are in `art-originals/` if you ever want to compare.

---

## Which six, and why

**The five homepage tiles have to be done as a set.** They sit side by side in the bento grid above
the fold — regenerating one would make the other four look wrong. The sixth is the campaign hero,
which was the worst recolour in the build (62.7% of its pixels were violet, and the background went
hazy when they moved).

| # | File | Renders as | Canvas | Background |
|---|---|---|---|---|
| 1 | `campaign/02-race-shortcut-card.webp` | Home bento — **tall** tile, "Race It Home" | 1254×1254 | transparent |
| 2 | `campaign/03-drops-shortcut-card.webp` | Home bento — "The Drop" | 1254×1254 | transparent |
| 3 | `campaign/04-rewards-shortcut-card.webp` | Home bento — "Rewards" | 1254×1254 | transparent |
| 4 | `campaign/21-friend-challenge-card.webp` | Home bento — "Leaderboard" **and** the Invite page | 1280×640 (2:1) | transparent |
| 5 | `campaign/05-invite-friend-shortcut-card.webp` | Home bento — "Race a friend" | 1254×1254 | transparent |
| 6 | `campaign/06-campaign-hub-hero.webp` | Campaign page hero, full-bleed | 1280×960, shown at 16:9 | **opaque** |

**Deliberately not on this list:** `18-leaderboard-hero` recoloured beautifully — the violet podium
became a gold one and the red and blue cars survived untouched. Leave it alone. Same for
`16-order-success-hero` and the delivery map.

**Optional seventh:** `cars/11-mystery-drop-car.webp` is the only asset still reading ~4% violet — a
warm magenta edge glow that reads as flame rather than Zepto. Low priority; it renders small and
behind a lock veil.

---

## Three constraints that matter more than the art direction

**1. No text, no logos, anywhere in the image.** This is the one that bit us. The old category tiles
had "Zepto Cafe" painted into the artwork, which no text search could find — it took a visual pass
to catch. Every label in this build is live DOM text, and the Hot Wheels mark is a separate SVG
overlay. Art that contains lettering will eventually be wrong.

**2. Five of the six need transparent backgrounds.** The tiles sit on a CSS cream gradient; the
current assets are 51–59% transparent. Only the campaign hero (#6) is a full opaque scene.

**3. Composition is bottom-anchored with a text safe zone.** The tiles render the image
bottom-right at 78–106% width, with the label overlaid top-left. Keep the **upper-left quadrant
empty**.

---

## Generating

**Via API (`gpt-image-1`) — preferred, because it gives you real transparency:**

```bash
# square tiles (#1, #2, #3, #5)
size="1024x1024"; background="transparent"; output_format="png"; quality="high"
# wide ones (#4, #6)
size="1536x1024"
```

**Via the ChatGPT UI:** it won't give you clean alpha. Generate on a flat pure-white background,
say so in the prompt, and hand me the files — cutting the background, resizing to the exact canvas
above and converting to WebP-with-alpha is a 2-minute script on my side.

---

## The shared style block

**Paste this ahead of every one of the six prompts.** It's what keeps the set consistent — without
it you'll get five tiles that don't belong to each other.

```
Glossy 3D-rendered illustration in a premium mobile-game icon style: smooth candy-gloss
materials, chunky simplified forms, soft global-illumination studio lighting with gentle
rim light, subtle contact shadows, a few small floating sparkle accents. Clean, bright,
high-energy, toy-like — not photoreal.

Palette, used strictly:
  warm gold and amber      #F8CB46, #F8E6B4, #E0BE55
  flame red                #ED1C24
  flame orange             #FF6A00
  racing blue              #0B5FD0
  deep charcoal            #1F1F1F
  small fresh-green accent #0C831F
Warm gold is the dominant colour of the world. Red and orange are the energy.
Blue appears only as a small cool counterpoint.

ABSOLUTELY NO purple, violet, magenta, lavender, lilac or pink anywhere in the image,
including in lighting, glows, haze, smoke, reflections or shadows.

NO text, NO letters, NO numbers, NO words, NO logos, NO wordmarks, NO brand names and
NO signage of any kind anywhere in the image.

Isolated on a fully transparent background, with nothing touching the frame edges.
```

(For prompt #6 only, replace that last line with the one given in its section.)

---

## Prompt 1 — `02-race-shortcut-card` · tall tile, "Race It Home"

The biggest single piece of campaign art in the app. Square canvas, but it renders into a tall box,
so keep the subject compact and centred-low.

```
A stylised die-cast toy race car, three-quarter front view, painted deep flame red with
orange racing stripes and gold-rimmed wheels, speeding along a glossy looping amber-gold
toy racetrack that curls through the lower half of the frame. Floating just above and
behind the car, a small scatter of bright everyday grocery items being collected mid-air:
a banana, a milk carton, a loaf of bread, a soda bottle. A checkered flag element at the
right edge. Motion streaks in gold and orange trail behind the car.

Composition: the car and track occupy the lower-right two-thirds of the square. The upper-
left quadrant must be completely empty and transparent — a text label is overlaid there.
```

## Prompt 2 — `03-drops-shortcut-card` · "The Drop"

```
A tight cluster of three collectible die-cast toy cars displayed as a limited-edition drop:
one flame red, one racing blue, one deep charcoal with gold trim, arranged overlapping at
slight angles on a low glossy amber-gold pedestal. A soft gold glow behind them suggests a
reveal. One small gold sparkle burst at the upper right of the cluster.

Composition: the cluster sits in the lower-right two-thirds of the square. The upper-left
quadrant must be completely empty and transparent — a text label is overlaid there.
```

## Prompt 3 — `04-rewards-shortcut-card` · "Rewards"

```
A gleaming gold trophy cup as the hero object, with a small pile of gold coins spilling
around its base and two or three gold reward tokens floating beside it. A single flame-red
ribbon accent on the trophy. Warm gold sparkles.

Composition: the trophy and coins occupy the lower-right two-thirds of the square. The
upper-left quadrant must be completely empty and transparent — a text label is overlaid
there.
```

## Prompt 4 — `21-friend-challenge-card` · "Leaderboard" + Invite page

Wide 2:1. Used in two places, so it has to read as *competition* in both.

```
Two stylised die-cast toy race cars racing side by side straight toward the viewer, nose to
nose — the left one flame red with orange stripes, the right one racing blue with white
stripes — on a glossy amber-gold track, with a black-and-white checkered finish line arch
behind them and gold motion streaks trailing off both cars. A small gold trophy silhouette
floating above and between them.

Composition: wide 2:1 landscape. Both cars centred, with clear empty space along the top
edge. Nothing touching the left or right frame edges.
```

## Prompt 5 — `05-invite-friend-shortcut-card` · "Race a friend"

```
Two stylised die-cast toy race cars — one flame red, one racing blue — angled toward each
other as if challenging one another, with a single glowing gold link-token or medal
floating between and slightly above them, and two small rounded speech-bubble shapes in
soft gold with no text inside them. A scatter of small gold sparkles.

Composition: both cars and the token occupy the lower-right two-thirds of the square. The
upper-left quadrant must be completely empty and transparent — a text label is overlaid
there.
```

## Prompt 6 — `06-campaign-hub-hero` · Campaign page hero

The only opaque one. It renders cropped to 16:9 with a dark gradient scrim over the bottom 40%
carrying three lines of white text — so the lower third must be visually simple or the type won't
read.

Swap the final line of the style block for:

```
A full-bleed opaque scene that fills the entire frame edge to edge. No transparency.
```

Then:

```
A wide cinematic view down a glossy amber-gold toy racetrack, shot from low and just behind
a stylised die-cast race car in flame red with orange stripes sitting at the start line,
facing away from the viewer down the track. The track runs forward into a bright, cheerful
miniature city built out of oversized everyday groceries — bread loaves, milk cartons, fruit
crates, cereal boxes — stacked like buildings in warm cream, gold and soft green, with
orange track ribbons looping between them against a clean warm sky. A starting gantry with
three glowing red lights arches over the track ahead of the car.

Composition: horizontal, cinematic. Keep the subject and horizon in the upper two-thirds and
safe within a centre 16:9 crop. The bottom third must stay visually simple and uncluttered —
a dark gradient and three lines of text are overlaid there.
```

---

## When you have the files

Send them over and I'll handle the rest: cut the background if you used the ChatGPT UI, resize each
to its exact canvas from the table above, convert to WebP with alpha at the quality the rest of the
build uses, drop them into `public/campaign/`, and re-run the violet audit so we can confirm the set
is clean. Filenames don't need to match — I'll wire them up.

Worth doing one tile first and looking at it in the running app before generating all six. The
tiles render at roughly 110×104 px, which is smaller than it feels when you're looking at a
1024×1024 render, and detail that reads beautifully at full size can turn to mush at tile size.

---

# v2 — regenerating `06-campaign-hub-hero` only

The first attempt came back flat and pale and has been reverted. Four things caused it, and three
of them were my prompt's fault:

1. **I never asked for a dark bottom.** This is the big one. The page lays a scrim over the image —
   `rgba(19,26,38, 0 → 0.92)` down the bottom 70% — and sets **white** text on it. The render came
   back uniformly mid-yellow, so white type landed on a light ground. My note said the bottom third
   must be "visually simple", which is about clutter. It needed to say **dark**.
2. **Too many objects.** I listed bread, milk, fruit crates, cereal boxes, a gantry, three lights,
   track ribbons and a sky. Asked for that much, the model simplifies everything to cope — which is
   exactly the flatness we got.
3. **Style drift.** "Glossy 3D illustration, mobile-game icon style" reads as *vector* at scene
   scale. A full scene needs explicit camera and render language.
4. **Crop compounding.** It renders `aspect-ratio: 16/9` with `object-fit: cover` from a 4:3 file,
   so ~12.5% is cropped off the top and bottom. Generating 3:2 and cropping again squeezes it further.

**Generate at 1536×1024 (landscape).** Send it over and I'll crop to 1280×960 on the safe centre.

## Style block for this one — replaces the shared block above

```
Cinematic 3D product render, photoreal-adjacent but stylised and toy-like: physically
based materials, glossy die-cast paint with clearcoat, soft volumetric light, shallow
depth of field with the background falling out of focus, warm rim light separating the
subject from the background, rich contrast and deep shadows. Rendered look — NOT flat
vector, NOT clip-art, NOT a sticker.

VALUE STRUCTURE — this matters more than any other instruction:
  Top half:    bright, warm, glowing — amber and gold light
  Middle:      the hero subject, brightly lit and high contrast
  Bottom third: DARK. Deep shadow, near-black warm brown and charcoal.
                It must be dark enough for white text to sit on it legibly.
  Never flat or uniformly mid-toned. There must be a strong light-to-dark
  gradient from top to bottom.

Palette:
  warm gold / amber light   #F8CB46, #FFD98A
  flame red bodywork        #ED1C24
  flame orange track        #FF6A00
  deep shadow               #1A0F08, #2A1A10
  small cool accent         #0B5FD0
ABSOLUTELY NO purple, violet, magenta, lavender or pink anywhere, including in
lighting, glow, haze, smoke, reflections or shadows.
NO text, NO letters, NO numbers, NO logos, NO wordmarks, NO signage anywhere.

Full-bleed opaque scene filling the whole frame, edge to edge. No transparency.
```

## The prompt

```
A low, wide, cinematic hero shot of a single stylised die-cast toy race car in glossy
flame red with orange flame graphics, sitting at the crest of a glossy orange plastic
toy racetrack that sweeps from the dark foreground up and away toward the horizon. The
camera is low and close to the track surface, looking slightly up at the car, wide-angle.

The orange track fills the dark lower foreground in deep shadow and falls out of focus.
Behind and above the car, a warm golden glow and soft out-of-focus bokeh light, with the
faint blurred suggestion of stacked grocery crates and boxes as a distant city skyline —
soft, unfocused, atmospheric, not detailed. Warm dust motes catch the light.

Composition: horizontal. The car sits slightly above centre and just left of centre. The
top half is bright and glowing. The bottom third is deep shadow with almost nothing in it
— dark enough that white text placed there is clearly legible. Keep the car and horizon
inside the safe centre 16:9 band, with nothing important in the outer 12% top or bottom.
```

## If it still comes back flat

Add this to the front of the prompt, which pushes the model hardest toward a rendered look:

```
Rendered in Blender with Cycles, 35mm lens, f/2.0, three-point studio lighting with a
strong warm key from behind the subject.
```
