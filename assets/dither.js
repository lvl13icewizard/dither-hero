// Ordered-dither renderer: a continuous-tone image drawn as a live field of
// dots. Dependency-free ES module.
//
//   import { DitherHero } from "./dither.js";
//   const engine = new DitherHero(canvas, loadedImage);
//   engine.resize(); engine.start();
//   engine.setPointer(x, y);   // null on leave
//   engine.setScroll(0..1);    // dissolves the field
//   engine.setOptions({ grain: 8 });       // live retune
//
// Composites the image with a procedural particle layer, then quantises the
// pair through an 8x8 Bayer matrix and draws one dot per cell, radius scaled
// by tone level.
//
// Two decisions that matter:
//   * Levels are computed ONCE from the source image and pinned forever. The
//     source never changes, so there is no reason to recompute — and
//     recomputing per frame makes dot density visibly pulse.
//   * Levels are computed from non-void pixels only. This art is mostly pure
//     black by design, so whole-frame percentiles would be drawn almost
//     entirely from the void and would crush the subject into the top level.
//
// The pointer warp displaces SAMPLING coordinates rather than drawn output,
// so it costs nothing per frame beyond an extra read offset.

const BAYER_N = 8;

function buildBayer(n) {
  let m = [[0, 2], [3, 1]];
  let size = 2;
  while (size < n) {
    const next = [];
    for (let y = 0; y < size * 2; y++) next.push(new Array(size * 2).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + size] = v + 2;
        next[y + size][x] = v + 3;
        next[y + size][x + size] = v + 1;
      }
    }
    m = next;
    size *= 2;
  }
  const denom = n * n;
  return m.map((row) => row.map((v) => (v + 0.5) / denom));
}

const BAYER = buildBayer(BAYER_N);

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

const DEFAULTS = {
  // ---- dot grid ----------------------------------------------------------
  grain: 6,           // cell size in output px. Bigger = coarser, more poster.
  dotGap: 0.34,       // fraction of the cell left as gap
  dotFill: 0.82,      // dot radius as a fraction of what remains
  toneSteps: 5,       // tone levels. 2 is hard 1-bit; 4-5 is the usual sweet spot

  // ---- tone --------------------------------------------------------------
  // Applied after the pinned auto-level. Every source wants its own numbers:
  // a mid-grey subject needs almost none of this, a subject that is mostly
  // near-black needs a lot. These defaults are deliberately mild so a new
  // image renders legibly before any tuning rather than arriving blown out.
  contrast: 16,
  brightness: 0,
  // 0 = linear. Higher lifts the shadows, which is what rescues a dark
  // subject whose body would otherwise fall under the first dot threshold.
  shadowLift: 0.25,
  blackCutoff: 0.02,  // below this a cell draws nothing — keeps the void empty

  // ---- framing -----------------------------------------------------------
  // Defaults show the whole image, centred. Zoom in and pan when the subject
  // is small in frame: it must occupy enough CELLS for its structure to
  // survive quantisation, and that is a function of cell count, not pixels.
  // Derive these from the subject's bounding box rather than guessing — note
  // that a window shorter than the subject can never contain it at any pan.
  zoom: 1,
  panX: 0.5,
  panY: 0.5,
  // "cover" fills the frame and crops; "contain" fits the whole image inside.
  // A square emblem in a wide hero needs "contain", and on a black ground the
  // leftover margins are invisible rather than letterboxed.
  fit: "cover",

  // ---- particles ---------------------------------------------------------
  // "off" | "fall" | "radial". Off by default: a full-screen weather layer
  // competes with the subject on most images. Localised emission — sand
  // inside an hourglass, a ring off a staff tip, dust pooling under an emblem
  // — reads as the object doing something rather than ambience laid over it.
  // emitX/emitY are in SOURCE coordinates, so an emitter stays pinned to the
  // thing it belongs to when zoom or pan change.
  particles: "off",
  emitX: 0.5, emitY: 0.5,
  areaWidth: 1.0, areaHeight: 1.0,  // "fall": emission box, 1x1 = whole frame
  spread: 0.12,                     // "radial": outer radius
  particleCount: 150,
  particleSpeed: 0.09,
  particleDrift: 0.05,
  trailLength: 1.2,   // "fall": extra cells of trail on the nearest particles
  dimmest: 0.09,
  brightest: 0.28,

  // ---- pointer warp ------------------------------------------------------
  pointerRadius: 0.6, // fraction of the canvas diagonal
  pointerLean: 2.6,   // cells of horizontal lean at full strength
  pointerLift: 1.1,   // cells of vertical lift

  fps: 15,
  ink: "#ffffff",
};


function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// Older configs (and anything saved before the rename) use the terse names.
// Translate rather than break them — a saved slot outliving a rename is the
// whole point of saving it.
const LEGACY = {
  pixelSize: "grain", levels: "toneSteps", spacing: "dotGap", dotScale: "dotFill",
  floor: "blackCutoff", focalX: "panX", focalY: "panY", pMode: "particles",
  pX: "emitX", pY: "emitY", pR: "spread", pW: "areaWidth", pH: "areaHeight",
  pCount: "particleCount", pSpeed: "particleSpeed", pDrift: "particleDrift",
  pStreak: "trailLength", pMin: "dimmest", pMax: "brightest",
  snowCount: "particleCount", snowSpeed: "particleSpeed", snowDrift: "particleDrift",
  snowStreak: "trailLength", snowMin: "dimmest", snowMax: "brightest",
  warpRadius: "pointerRadius", warpLean: "pointerLean", warpLift: "pointerLift",
};
export function normalizeOptions(o = {}) {
  const out = {};
  for (const k in o) {
    // gamma inverted into shadowLift: 0 = linear, higher = brighter shadows
    if (k === "gamma") out.shadowLift = 1 - o[k];
    else out[LEGACY[k] || k] = o[k];
  }
  return out;
}

export class DitherHero {
  constructor(canvas, image, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.image = image;
    this.o = { ...DEFAULTS, ...normalizeOptions(opts) };

    this.buf = document.createElement("canvas");
    this.bufCtx = this.buf.getContext("2d", { willReadFrequently: true });

    this.cols = 0;
    this.rows = 0;
    this.subject = null;       // Float32Array, luma per cell, 0..1 post-level
    this.snow = [];
    this.pointer = null;     // {x, y} in cell space
    this.scroll = 0;         // 0 = full hero, 1 = fully dissolved
    this.running = false;
    this.lastFrame = 0;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this._levels = this._measureLevels();
    this._initSnow();
  }

  // ---- toneSteps, measured once from the source and never recomputed --------
  _measureLevels() {
    const w = 256;
    const h = Math.max(1, Math.round((this.image.height / this.image.width) * w));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(this.image, 0, 0, w, h);
    const { data } = cx.getImageData(0, 0, w, h);

    const lit = [];
    for (let i = 0; i < data.length; i += 4) {
      const l =
        (LUMA_R * data[i] + LUMA_G * data[i + 1] + LUMA_B * data[i + 2]) / 255;
      if (l > 0.03) lit.push(l); // non-void only — see header note
    }
    if (lit.length < 32) return { lo: 0, hi: 1 };
    lit.sort((a, b) => a - b);
    const at = (p) => lit[Math.min(lit.length - 1, Math.floor(lit.length * p))];
    const lo = at(0.02);
    const hi = at(0.98);
    return { lo, hi: hi > lo + 0.02 ? hi : lo + 0.02 };
  }

  _initSnow() {
    // Seeded PRNG rather than a golden-ratio walk: the walk lays particles on
    // a near-regular lattice, which is exactly why the field read as a static
    // starfield instead of weather. Seeded so runs stay reproducible.
    let s = 0x9e3779b9;
    const rnd = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const n = this.o.particles === "off" ? 0 : this.o.particleCount;
    this.snow = Array.from({ length: n }, () => {
      const z = Math.pow(rnd(), 1.6); // biased to distant; a few near ones
      return {
        // fall: u,v are position within the emitter rect, 0..1
        u: rnd(),
        v: rnd(),
        // radial: a is the launch angle, r the normalised distance travelled.
        // r starts spread out so the ring does not pulse as one wavefront.
        a: rnd() * Math.PI * 2,
        r: rnd(),
        z,
        // Per-particle jitter so no two share a cadence.
        vJit: 0.7 + rnd() * 0.75,
        xJit: (rnd() - 0.5) * 2,
        sway: rnd() * Math.PI * 2,
        swayAmp: 0.15 + rnd() * 0.85,
        rnd: rnd(),
      };
    });
    this.t = 0;
  }

  // ---- grid rebuild on resize -------------------------------------------
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    // The canvas can be measured before layout has given it a size (React
    // remount, fonts still loading). Building a grid from that yields a
    // degenerate 2-column field that silently renders nothing — bail and let
    // the ResizeObserver call back once the element has real dimensions.
    if (w < 8 || h < 8) {
      this.ready = false;
      return;
    }
    this.ready = true;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = w;
    this.cssH = h;

    // Narrow viewports get a finer grid, or the subject stops reading.
    this.cell = w < 700 ? Math.max(5, this.o.grain - 3) : this.o.grain;
    this.cols = Math.ceil(w / this.cell) + 1;
    this.rows = Math.ceil(h / this.cell) + 1;

    this._sampleSubject();
    // Assigning canvas.width above clears the surface. Repaint immediately:
    // without this every resize leaves a blank frame until the next tick —
    // permanently blank if the loop is throttled (hidden tab, reduced motion).
    this.draw(0);
  }

  _sampleSubject() {
    const { cols, rows } = this;
    this.buf.width = cols;
    this.buf.height = rows;
    const cx = this.bufCtx;
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, cols, rows);

    // cover/contain fit, pan-biased so the subject survives narrow viewports
    const ia = this.image.width / this.image.height;
    const ca = cols / rows;
    let dw, dh;
    // "cover" fills the frame and crops the overflow; "contain" fits the whole
    // image inside it. A square emblem in a 16:9 hero needs contain — cover
    // would slice its top and bottom off — and because the ground is pure
    // black the leftover margins are invisible rather than letterboxed.
    if ((this.o.fit === "cover") === (ia > ca)) {
      dh = rows;
      dw = rows * ia;
    } else {
      dw = cols;
      dh = cols / ia;
    }
    dw *= this.o.zoom;
    dh *= this.o.zoom;
    const dx = (cols - dw) * this.o.panX;
    const dy = (rows - dh) * this.o.panY;
    cx.drawImage(this.image, dx, dy, dw, dh);

    const { data } = cx.getImageData(0, 0, cols, rows);
    const { lo, hi } = this._levels;
    const span = hi - lo;
    const k = (259 * (this.o.contrast + 255)) / (255 * (259 - this.o.contrast));
    const bright = this.o.brightness / 255;

    const out = new Float32Array(cols * rows);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      let l =
        (LUMA_R * data[i] + LUMA_G * data[i + 1] + LUMA_B * data[i + 2]) / 255;
      l = (l - lo) / span;                    // pinned auto-level
      l = Math.pow(Math.max(0, Math.min(1, l)), 1 - this.o.shadowLift); // shadow lift
      l = k * (l - 0.5) + 0.5 + bright;       // contrast + brightness
      out[p] = l < this.o.blackCutoff ? 0 : Math.min(1, l);
    }
    this.subject = out;
  }

  // ---- interaction -------------------------------------------------------
  setPointer(clientX, clientY) {
    if (clientX == null) {
      this.pointer = null;
      return;
    }
    const r = this.canvas.getBoundingClientRect();
    this.pointer = {
      x: (clientX - r.left) / this.cell,
      y: (clientY - r.top) / this.cell,
    };
  }

  setScroll(t) {
    this.scroll = Math.min(1, Math.max(0, t));
  }

  /** Live retune. Rebuilds only what the changed keys require. */
  setOptions(patch) {
    patch = normalizeOptions(patch);
    const needsSnow = "particleCount" in patch || "particles" in patch;
    const needsResample =
      "shadowLift" in patch || "contrast" in patch || "brightness" in patch ||
      "zoom" in patch || "panX" in patch || "panY" in patch ||
      "grain" in patch || "blackCutoff" in patch;
    Object.assign(this.o, patch);
    if (needsSnow) this._initSnow();
    if (needsResample) this.resize();
    else this.draw(0);
  }

  // ---- loop --------------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    // Paint one frame synchronously. requestAnimationFrame does not fire in a
    // hidden tab, so without this a page opened in the background renders a
    // blank hero until the user focuses it.
    this.resize();
    this.draw(0);
    if (this.reduced) return;
    const tick = (now) => {
      if (!this.running) return;
      const step = 1000 / this.o.fps;
      if (now - this.lastFrame >= step) {
        const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        // Self-heal: if the canvas had no layout size when the grid was last
        // built, retry here. ResizeObserver covers genuine resizes but does
        // not reliably fire for the 0 -> laid-out transition in every host.
        if (!this.ready) this.resize();
        this.draw(dt);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _stepSnow(dt) {
    this.t += dt;
    const { particles, particleSpeed, particleDrift } = this.o;
    if (particles === "off") return;

    if (particles === "radial") {
      for (const p of this.snow) {
        // Constant outward speed. Respawning at r=0 with a fresh angle keeps
        // the ring continuous instead of firing in visible volleys.
        p.r += particleSpeed * (0.5 + p.z * 1.5) * p.vJit * dt;
        if (p.r > 1) { p.r -= 1; p.a = (p.a + 2.399963) % (Math.PI * 2); }
      }
      return;
    }

    for (const p of this.snow) {
      // Near particles fall markedly faster than distant ones — that parallax
      // is what separates falling from a field of stars.
      p.v += particleSpeed * (0.3 + p.z * 2.2) * p.vJit * dt;
      p.u +=
        (particleDrift * (0.3 + p.z) * p.xJit +
          Math.sin(this.t * 0.6 + p.sway) * particleDrift * p.swayAmp) * dt;
      if (p.v > 1) { p.v -= 1; p.u = (p.u + 0.37) % 1; } // re-seed on wrap
      if (p.u > 1) p.u -= 1;
      if (p.u < 0) p.u += 1;
    }
  }

  draw(dt) {
    const { cols, rows, cell, subject } = this;
    if (!subject || !this.ready) return;
    if (dt > 0) this._stepSnow(dt);

    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // Scroll dissolve: the field thins rather than scrolling away.
    const fade = 1 - this.scroll;
    if (fade <= 0.02) return;
    const toneSteps = Math.max(2, this.o.toneSteps);
    const gap = 1 - this.o.dotGap;
    const maxR = (cell * gap * this.o.dotFill * fade) / 2;
    if (maxR < 0.12) return;

    // Snow splats into a sparse map so most cells stay untouched. Near flakes
    // leave a short vertical streak — a single cell per flake is a star, a
    // streak is something falling.
    const snowMap = new Map();
    const put = (tx, ty, v) => {
      if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) return;
      const key = ty * cols + tx;
      const prev = snowMap.get(key);
      if (prev === undefined || v > prev) snowMap.set(key, v);
    };
    if (!this.reduced && this.o.particles !== "off") {
      const { dimmest, brightest, trailLength, particles, emitX, emitY, areaWidth, areaHeight, spread } = this.o;
      // Emitter coords are in SOURCE space, not canvas space, and are mapped
      // through the same cover-fit as the image. Anchoring to the canvas
      // instead means the emitter slides off the staff tip the moment zoom or
      // focal changes, and every framing tweak costs a re-tune.
      const z = this.o.zoom;
      const u0 = ((z - 1) * this.o.panX) / z;
      const v0 = ((z - 1) * this.o.panY) / z;
      const toCX = (u) => (u - u0) * z;
      const toCY = (v) => (v - v0) * z;
      if (particles === "radial") {
        // Scale x by rows/cols so the ring is round on screen rather than an
        // ellipse stretched by the canvas aspect.
        const ar = rows / cols;
        const ox = toCX(emitX), oy = toCY(emitY);
        for (const p of this.snow) {
          const d = p.r * spread * z;   // ring grows with the object
          const cx = (ox + Math.cos(p.a) * d * ar) * cols;
          const cy = (oy + Math.sin(p.a) * d) * rows;
          // Brightest at the source, fading out — reads as emission.
          const v = brightest * (1 - p.r) * (0.45 + p.z * 0.55);
          if (v > dimmest * 0.35) put(Math.floor(cx), Math.floor(cy), v);
        }
      } else {
        const x0 = toCX(emitX - areaWidth / 2), y0 = toCY(emitY - areaHeight / 2);
        const wz = areaWidth * z, hz = areaHeight * z;
        for (const p of this.snow) {
          const sx = Math.floor((x0 + p.u * wz) * cols);
          const sy = Math.floor((y0 + p.v * hz) * rows);
          const head = dimmest + p.z * (brightest - dimmest);
          const len = 1 + Math.round(p.z * trailLength);
          for (let k = 0; k < len; k++) {
            // Trail fades behind the head so the streak has direction.
            put(sx, sy - k, head * (1 - (k / (len + 0.6)) * 0.75));
          }
        }
      }
    }

    const warpR = this.o.pointerRadius * Math.hypot(cols, rows) * 0.5;
    const buckets = new Map();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let sx = x;
        let sy = y;

        // Directional lean: cells lean away and lift, like wind through snow.
        if (this.pointer) {
          const d = Math.hypot(x - this.pointer.x, y - this.pointer.y);
          if (d < warpR) {
            const f = smoothstep(1 - d / warpR);
            const dir = x < this.pointer.x ? -1 : 1;
            sx = x + dir * this.o.pointerLean * f;
            sy = y + this.o.pointerLift * f;
          }
        }

        const ix = Math.round(sx);
        const iy = Math.round(sy);
        let v = 0;
        // Both lookups must share this bounds check. Without it the snow read
        // `iy * cols + ix` unguarded, so a warped sample with ix < 0 wrapped
        // onto the previous row and teleported flakes around the cursor.
        if (ix >= 0 && ix < cols && iy >= 0 && iy < rows) {
          v = subject[iy * cols + ix];
          const snow = snowMap.get(iy * cols + ix);
          if (snow !== undefined && snow > v) v = snow; // max-composite
        }

        if (v <= 0) continue;

        const scaled = v * (toneSteps - 1);
        const base = Math.floor(scaled);
        const frac = scaled - base;
        const thr = BAYER[y & (BAYER_N - 1)][x & (BAYER_N - 1)];
        const lvl = Math.min(toneSteps - 1, base + (frac > thr ? 1 : 0));
        if (lvl <= 0) continue;

        let arr = buckets.get(lvl);
        if (!arr) {
          arr = [];
          buckets.set(lvl, arr);
        }
        arr.push(x * cell + cell / 2, y * cell + cell / 2);
      }
    }

    // One fillStyle per level, not per dot. Dots are drawn at full opacity:
    // radius alone carries tone. Modulating alpha as well double-encodes it
    // and washes the silhouette into grey mush — the references are crisp
    // white dots on black, and that crispness is the whole look.
    ctx.fillStyle = this.o.ink;
    const minR = maxR * 0.28; // smallest dot still reads; below this it fizzles
    for (const [lvl, pts] of buckets) {
      const t = lvl / (toneSteps - 1);
      const r = minR + t * (maxR - minR);
      if (r < 0.12) continue;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        ctx.moveTo(pts[i] + r, pts[i + 1]);
        ctx.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}

export { DEFAULTS };
