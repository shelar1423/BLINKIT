from PIL import Image
from collections import deque
import sys, os

SRC = '/Users/digvijay/Downloads/Hotwheels Image Assets'
DST = '/Users/digvijay/Downloads/blinkit/public/campaign'

def key_white(im, thresh=246):
    """Flood-fill the white surround to transparent, from the border inwards.

    Only reaches pixels connected to the edge, so white INSIDE the art — the
    stripes on the cars, the light squares of a chequered flag — is never
    touched. Guarded: if the border is not actually white we refuse, which is
    what stops this being run on a dark scene by mistake."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(0, w, 7)] + [px[x, h-1] for x in range(0, w, 7)] \
           + [px[0, y] for y in range(0, h, 7)] + [px[w-1, y] for y in range(0, h, 7)]
    worst = min(min(p[0], p[1], p[2]) for p in border)
    if worst < 225:
        raise SystemExit(f'refusing to key: darkest border channel is {worst}, not a white surround')
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            q.append((x, y))
    hit = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if min(r, g, b) < thresh:
            continue
        px[x, y] = (r, g, b, 0)
        hit += 1
        q.extend(((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
    return im, hit

def save(im, name, width, q=88):
    im = im.copy()
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = os.path.join(DST, name)
    im.save(out, 'WEBP', quality=q, method=6)
    print(f'{name:34s} {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}K')

# 1. the lockup: already transparent, just trimmed of its dead margin
logo = Image.open(f'{SRC}/Race It Home Logo.png').convert('RGBA')
logo = logo.crop(logo.getchannel('A').getbbox())
print('logo trimmed to', logo.size)
save(logo, 'race-it-home-wordmark.webp', 1200, q=92)

# 2. the hub hero: a full-bleed illustration, no alpha wanted
hero = Image.open(f'{SRC}/Race it home hero image.png').convert('RGB')
save(hero, '06-campaign-hub-hero.webp', 1440, q=84)

# 3 + 4. the two spot illustrations, keyed off their white ground
for src, name, width in [('leaderboard.png', '18-leaderboard-hero.webp', 1280),
                         ('race your friends.png', '20-refer-a-friend-hero.webp', 1280)]:
    im = Image.open(f'{SRC}/{src}')
    im, hit = key_white(im)
    pct = 100 * hit / (im.width * im.height)
    print(f'{src}: keyed {pct:.1f}% of pixels')
    im = im.crop(im.getchannel('A').getbbox())
    save(im, name, width, q=90)
