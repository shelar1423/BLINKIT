"""Bring the supplied HD icon set into the app.

They arrive 1254x1254 on white. Keyed the same way as the campaign art: a flood
fill inwards from the border, so white INSIDE an icon — the stripe on the car,
the highlight on a coin — is never touched, and the fill refuses to run at all
if the border is not actually white.
"""
from PIL import Image
from collections import deque
import os

SRC = '/Users/digvijay/Downloads/blinkit_hotwheels_ui_icons_hd'
DST = '/Users/digvijay/Downloads/blinkit/public/icons'
os.makedirs(DST, exist_ok=True)

NAMES = {
    '01_total_points': 'total-points',
    '02_blinkit_cash': 'blinkit-cash',
    '03_best_race': 'best-race',
    '04_rewards': 'rewards',
    '05_leaderboard': 'leaderboard',
    '06_race_a_friend': 'race-a-friend',
    '07_free_delivery': 'free-delivery',
    '08_25_rupees_blinkit_cash': 'cash-25',
    '09_50_rupees_blinkit_cash': 'cash-50',
}

def key_white(im, thresh=244):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(0, w, 9)] + [px[x, h-1] for x in range(0, w, 9)] \
           + [px[0, y] for y in range(0, h, 9)] + [px[w-1, y] for y in range(0, h, 9)]
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
        q.extend(((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
    return im

for stem, out in NAMES.items():
    im = key_white(Image.open(f'{SRC}/{stem}.png'))
    im = im.crop(im.getchannel('A').getbbox())
    # square again after the trim, so every icon centres the same way in its box
    side = max(im.size)
    pad = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    pad.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    pad = pad.resize((256, 256), Image.LANCZOS)
    path = f'{DST}/{out}.webp'
    pad.save(path, 'WEBP', quality=90, method=6)
    print(f'{out:16s} {os.path.getsize(path)//1024}K')
