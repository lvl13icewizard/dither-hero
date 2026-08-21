#!/usr/bin/env python3
"""Render a dithered still, matching assets/dither.js exactly.

The engine is a live canvas, so there is no way to export a frame from it in a
build step. This ports its quantisation — same Bayer matrix, same pinned
non-void auto-level, same radius-by-level mapping — so a still and the live
hero are the same picture.

Particles ARE drawn, using the engine's own seeded PRNG at t=0 — so the still
is the engine's first painted frame, not an approximation of it. Pass
--no-particles to omit them.

Fidelity: measured against the live engine on the murmuration preset, this
lands within ~12% of its ink coverage. The residual is PIL's non-antialiased
rasteriser versus the browser's antialiased arcs at sub-pixel radii; it is not
visible, but do not treat a still as pixel-identical to the canvas.

    python3 scripts/render_still.py murmuration.png out.png --width 1600
"""
import argparse, json, math, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def bayer(n=8):
    m = [[0, 2], [3, 1]]
    size = 2
    while size < n:
        nxt = [[0] * (size * 2) for _ in range(size * 2)]
        for y in range(size):
            for x in range(size):
                v = m[y][x] * 4
                nxt[y][x] = v
                nxt[y][x + size] = v + 2
                nxt[y + size][x] = v + 3
                nxt[y + size][x + size] = v + 1
        m, size = nxt, size * 2
    return [[(v + 0.5) / (n * n) for v in row] for row in m]


BAYER = bayer(8)


def spawn(n):
    """The engine's seeded PRNG and spawn order, reproduced exactly. A
    golden-ratio walk would lay particles on a near-regular lattice; this is
    seeded so runs stay identical between the browser and here."""
    state = 0x9E3779B9

    def rnd():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = (state ^ (state >> 15)) * (1 | state) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    out = []
    for _ in range(n):
        z = rnd() ** 1.6            # computed before the object literal in JS
        out.append({"z": z, "u": rnd(), "v": rnd(),
                    "a": rnd() * 2 * math.pi, "r": rnd()})
        rnd(); rnd(); rnd(); rnd(); rnd()   # vJit, xJit, sway, swayAmp, rnd
    return out


def particle_map(o, cols, rows):
    """Particle layer as {cell index: value}, max-composited over the subject
    after tone mapping — exactly where the engine applies it."""
    mode = o.get("particles", "off")
    if mode == "off":
        return {}
    m = {}

    def put(tx, ty, v):
        if 0 <= tx < cols and 0 <= ty < rows:
            k = ty * cols + tx
            if v > m.get(k, 0):
                m[k] = v

    z = o["zoom"]
    u0 = (z - 1) * o["panX"] / z
    v0 = (z - 1) * o["panY"] / z
    to_cx = lambda u: (u - u0) * z
    to_cy = lambda v: (v - v0) * z
    ps = spawn(o["particleCount"])
    dim, bright = o["dimmest"], o["brightest"]

    if mode == "radial":
        ar = rows / cols
        ox, oy = to_cx(o["emitX"]), to_cy(o["emitY"])
        for p in ps:
            d = p["r"] * o["spread"] * z
            cx = (ox + math.cos(p["a"]) * d * ar) * cols
            cy = (oy + math.sin(p["a"]) * d) * rows
            val = bright * (1 - p["r"]) * (0.45 + p["z"] * 0.55)
            if val > dim * 0.35:
                put(math.floor(cx), math.floor(cy), val)
    else:
        x0 = to_cx(o["emitX"] - o["areaWidth"] / 2)
        y0 = to_cy(o["emitY"] - o["areaHeight"] / 2)
        wz, hz = o["areaWidth"] * z, o["areaHeight"] * z
        for p in ps:
            sx = math.floor((x0 + p["u"] * wz) * cols)
            sy = math.floor((y0 + p["v"] * hz) * rows)
            head = dim + p["z"] * (bright - dim)
            ln = 1 + round(p["z"] * o["trailLength"])
            for k in range(ln):
                put(sx, sy - k, head * (1 - (k / (ln + 0.6)) * 0.75))
    return m


def measure_levels(img):
    """Percentiles over NON-VOID pixels only, from a 256px sample — the art is
    mostly pure black, so whole-frame percentiles crush the subject."""
    w = 256
    h = max(1, round(img.height / img.width * w))
    small = img.convert("L").resize((w, h), Image.LANCZOS)
    lit = sorted(v / 255 for v in small.getdata() if v / 255 > 0.03)
    if len(lit) < 32:
        return 0.0, 1.0
    lo = lit[int(len(lit) * 0.02)]
    hi = lit[min(len(lit) - 1, int(len(lit) * 0.98))]
    return lo, hi if hi > lo + 0.02 else lo + 0.02


def render(img, o, out_w, out_h, ss=2, particles=True):
    """ss supersamples then downscales. The browser draws at devicePixelRatio
    with antialiased arcs; at fine grain the dots are SUB-PIXEL (radius well
    under 1px), so a hard-edged 1x rasteriser over-inks them badly. Rendering
    large and resampling reproduces the browser's coverage."""
    cell = o["grain"]
    # Grid comes from the CSS-pixel size, exactly as resize() computes it —
    # supersampling must not change the cell count, only how finely it is drawn.
    cols = math.ceil(out_w / cell) + 1
    rows = math.ceil(out_h / cell) + 1
    draw_cell = cell * ss

    # cover / contain fit, biased by pan — mirrors _sampleSubject()
    ia, ca = img.width / img.height, cols / rows
    if (o.get("fit", "cover") == "cover") == (ia > ca):
        dh, dw = rows, rows * ia
    else:
        dw, dh = cols, cols / ia
    dw, dh = dw * o["zoom"], dh * o["zoom"]
    dx, dy = (cols - dw) * o["panX"], (rows - dh) * o["panY"]

    buf = Image.new("L", (cols, rows), 0)
    scaled = img.convert("L").resize((max(1, round(dw)), max(1, round(dh))), Image.LANCZOS)
    buf.paste(scaled, (round(dx), round(dy)))
    px = buf.load()

    lo, hi = measure_levels(img)
    span = hi - lo
    c = o["contrast"]
    k = (259 * (c + 255)) / (255 * (259 - c))
    gamma = 1 - o["shadowLift"]
    bright = o.get("brightness", 0) / 255
    steps = max(2, o["toneSteps"])

    max_r = (draw_cell * (1 - o["dotGap"]) * o["dotFill"]) / 2
    min_r = max_r * 0.28

    pmap = particle_map(o, cols, rows) if particles else {}

    out = Image.new("L", (out_w * ss, out_h * ss), 0)
    d = ImageDraw.Draw(out)
    for y in range(rows):
        for x in range(cols):
            v = px[x, y] / 255
            v = (v - lo) / span
            v = max(0.0, min(1.0, v)) ** gamma
            v = k * (v - 0.5) + 0.5 + bright
            if v < o["blackCutoff"]:
                v = 0.0
            v = min(1.0, v)
            pv = pmap.get(y * cols + x)
            if pv is not None and pv > v:
                v = pv          # max-composite, same as the engine
            s = v * (steps - 1)
            base = math.floor(s)
            lvl = min(steps - 1, base + (1 if (s - base) > BAYER[y & 7][x & 7] else 0))
            if lvl <= 0:
                continue
            r = min_r + (lvl / (steps - 1)) * (max_r - min_r)
            if r < 0.12 * ss:
                continue
            cx, cy = x * draw_cell + draw_cell / 2, y * draw_cell + draw_cell / 2
            # PIL's ellipse bounds are INCLUSIVE, so it draws ~1px wider than
            # asked. Harmless at large radii, but these dots are sub-pixel at
            # fine grain, where the error triples the ink. Shrink by 1.
            d.ellipse([cx - r, cy - r, cx + r - 1, cy + r - 1], fill=255)
    if ss > 1:
        out = out.resize((out_w, out_h), Image.LANCZOS)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("preset")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=0)
    ap.add_argument("--supersample", type=int, default=4)
    ap.add_argument("--no-particles", action="store_true")
    a = ap.parse_args()

    manifest = json.load(open(os.path.join(ROOT, "samples", "presets.json")))
    if a.preset not in manifest["presets"]:
        sys.exit(f"unknown preset {a.preset}; have: {', '.join(manifest['order'])}")
    o = dict(manifest["presets"][a.preset])
    o.pop("label", None)
    h = a.height or round(a.width * 9 / 16)
    img = Image.open(os.path.join(ROOT, "samples", "img", a.preset))
    render(img, o, a.width, h, a.supersample, not a.no_particles).save(a.out, optimize=True)
    print(f"{a.out}  {a.width}x{h}  from {a.preset}")


if __name__ == "__main__":
    main()
