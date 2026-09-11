"""
Selective violet -> Blinkit-gold remap.

Two things make this non-trivial:

1. A blanket hue rotation would send Hot Wheels flame red to green, so only the
   violet/magenta band is touched. Reds, oranges, yellows and true blues pass
   through untouched (Hot Wheels blue sits at ~214 deg, below the band floor).

2. Partial-strength pixels must NOT be blended in hue space. Interpolating a
   hue of 255 deg toward 40 deg linearly travels the long way round the wheel,
   straight through green -- which is exactly what it looked like. So the full
   remap is computed first, and original and remapped are then mixed as RGB.
"""
import sys
import numpy as np
from PIL import Image

LO, HI = 240.0, 328.0             # violet .. magenta: the Zepto band
CORE_LO, CORE_HI = 252.0, 315.0   # fully remapped core
TARGET = 41.0                     # Blinkit gold
TARGET_SPREAD = 18.0              # enough variation to keep the art from flattening
SAT_FLOOR, SAT_SOFT = 0.05, 0.13  # ignore near-greys, which carry no violet cast


def _to_hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx); nz = d > 1e-6
    i = nz & (mx == r); h[i] = (60 * ((g - b)[i] / d[i])) % 360
    i = nz & (mx == g); h[i] = 60 * ((b - r)[i] / d[i]) + 120
    i = nz & (mx == b); h[i] = 60 * ((r - g)[i] / d[i]) + 240
    return h, s, mx


def _to_rgb(h, s, v):
    c = v * s
    hp = h / 60.0
    x = c * (1 - np.abs(hp % 2 - 1))
    z = np.zeros_like(c)
    i = hp.astype(np.int32) % 6
    sel = [i == k for k in range(6)]
    R = np.select(sel, [c, x, z, z, x, c])
    G = np.select(sel, [x, c, c, x, z, z])
    B = np.select(sel, [z, z, x, c, c, x])
    return np.stack([R, G, B], -1) + (v - c)[..., None]


def remap(path_in, path_out, quality=90):
    im = Image.open(path_in).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]

    h, s, v = _to_hsv(rgb)

    # band membership, 0..1, with feathered shoulders
    w = np.zeros_like(h)
    w[(h >= CORE_LO) & (h <= CORE_HI)] = 1.0
    sh = (h >= LO) & (h < CORE_LO); w[sh] = (h[sh] - LO) / (CORE_LO - LO)
    sh = (h > CORE_HI) & (h <= HI);  w[sh] = (HI - h[sh]) / (HI - CORE_HI)
    w *= np.clip((s - SAT_FLOOR) / SAT_SOFT, 0, 1)

    # full-strength remap for every in-band pixel
    pos = np.clip((h - LO) / (HI - LO), 0, 1)
    h_new = (TARGET - TARGET_SPREAD / 2) + pos * TARGET_SPREAD

    # gold at the luminance of deep violet reads muddy, so V is lifted -- but
    # only in the shadows, since lifting bright violet washed the skies out
    lift = np.clip(1.0 - v, 0, 1) ** 1.5
    v_new = np.clip(v * (1 + 0.18 * lift) + 0.035 * lift, 0, 1)
    s_new = np.clip(s * 0.95, 0, 1)

    remapped = _to_rgb(h_new, s_new, v_new)

    # mix in RGB space -- never in hue space (see module docstring)
    m = w[..., None]
    out = rgb * (1 - m) + remapped * m
    out = np.clip(np.concatenate([out, alpha], -1) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(path_out, 'WEBP', quality=quality, method=6)
    return float(w.mean())


if __name__ == '__main__':
    print(f"{remap(sys.argv[1], sys.argv[2]):.3f}")
