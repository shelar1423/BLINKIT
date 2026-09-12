"""The three category cut-outs for the hero tiles.

Balanced on optical size for the same reason the icon set is: these sit in a
row, and scaling each to fill its box by the longest side makes a wide, flat
subject (the track set) read small next to a tall chunky one (the monster
truck). sqrt(ink pixels) compares them fairly.
"""
from PIL import Image
from collections import deque
import math, os


def key_white(im, thresh=244):
    """Flood fill the white surround away, inwards from the border.

    These arrive as RGBA with alpha 255 everywhere, which makes them look like
    cut-outs to anything that checks the mode — they are opaque images on a
    near-white ground. Only white CONNECTED to the edge is removed, so white
    inside the art (the stripe on a car, the highlight on a tyre) survives, and
    the fill refuses to run if the border is not actually white.
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    border = ([px[x, 0] for x in range(0, w, 9)] + [px[x, h - 1] for x in range(0, w, 9)]
              + [px[0, y] for y in range(0, h, 9)] + [px[w - 1, y] for y in range(0, h, 9)])
    worst = min(min(p[0], p[1], p[2]) for p in border)
    if worst < 225:
        raise SystemExit(f'refusing to key: darkest border channel is {worst}')
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, _ = px[x, y]
        if min(r, g, b) < thresh:
            continue
        px[x, y] = (r, g, b, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im

SRC = '/Users/digvijay/Downloads/hotwheels_category_images'
DST = '/Users/digvijay/Downloads/blinkit/public/campaign'

NAMES = {
    'die-cast-cars': 'tile-diecast',
    'track-sets': 'tile-tracksets',
    'trucks-playsets': 'tile-trucks',
}

W = 520          # published width of the tile art
TARGET = 300.0   # optical size every piece is scaled to

trimmed = {}
for stem, out in NAMES.items():
    im = key_white(Image.open(f'{SRC}/{stem}.png'))
    bb = im.getchannel('A').getbbox()
    im = im.crop(bb)
    ink = sum(1 for v in im.getchannel('A').tobytes() if v > 8)
    trimmed[out] = (im, math.sqrt(ink), bb)
    print(f'{out:16s} trimmed {im.width}x{im.height}  optical {math.sqrt(ink):.0f}')

print()
# One canvas height for all three, tall enough for the tallest piece after
# scaling. Deriving it from the width instead cropped the track set, which is
# the tallest of the three, by 60px off the top.
scaled = {}
for out, (im, optical, _) in trimmed.items():
    scale = min(TARGET / optical, (W * 0.98) / im.width)
    scaled[out] = im.resize(
        (max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS
    )
H = max(a.height for a in scaled.values())
print(f'canvas {W}x{H}\n')

for out, art in scaled.items():
    pad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # sitting on the floor of the canvas, so the three align along their base
    pad.paste(art, ((W - art.width) // 2, H - art.height), art)
    path = f'{DST}/{out}.webp'
    pad.save(path, 'WEBP', quality=90, method=6)
    print(f'{out:16s} {art.width}x{art.height} in {W}x{H}  {os.path.getsize(path)//1024}K')
