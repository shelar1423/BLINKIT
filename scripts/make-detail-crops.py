"""Close crops of the product photograph, for the cars with no 3D model.

Five cars have GLB models, so their extra card views are real renders from real
angles. The other eight have a single flat cut-out and no model, so there is no
angle to render.

What there IS, honestly, is more of the same photograph than the card shows at
once. A retailer's carousel routinely carries detail shots, and a crop of the
real photograph is a real picture of the real product — unlike four dots
cycling one identical image, which is a swipe that does nothing.

So each of these eight gets two close crops: the front half of the car and the
rear half, both taken from its own photograph and upscaled to the card's box.
"""
from PIL import Image
import os

SRC = DST = '/Users/digvijay/Downloads/blinkit/public/cars'
OUT = 560

CARS = {
    'muscle': '09-02-muscle-car-orange',
    'retro': '09-05-retro-racing-car-yellow',
    'supercar': '09-07-supercar-purple',
    'pickup': '09-09-performance-pickup-blue',
    'proto': '09-10-race-prototype-red',
    'metallic': '09-11-rare-metallic-edition',
    'premium': '09-12-premium-limited-racer',
    'featured': 'featured-drop-diecast',
}

# fraction of the car's width each crop keeps, from the left and from the right
KEEP = 0.62

for cid, stem in CARS.items():
    im = Image.open(f'{SRC}/{stem}.webp').convert('RGBA')
    x0, y0, x1, y1 = im.getchannel('A').getbbox()
    w, h = x1 - x0, y1 - y0
    cw = round(w * KEEP)
    for name, left in (('c1', x0), ('c2', x1 - cw)):
        box = im.crop((left, y0, left + cw, y1))
        # square canvas so the card frames it exactly like the full shot
        side = max(box.width, box.height)
        pad = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        pad.paste(box, ((side - box.width) // 2, (side - box.height) // 2), box)
        pad = pad.resize((OUT, OUT), Image.LANCZOS)
        path = f'{DST}/{cid}-{name}.webp'
        pad.save(path, 'WEBP', quality=92, method=6)
        print(f'{cid}-{name:3s} from {w}x{h} -> crop {cw}x{h} -> {OUT}px  {os.path.getsize(path)//1024}K')
