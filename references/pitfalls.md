# Pitfalls

Every entry here is a bug that shipped, looked mystifying, and cost real time
to find. Read the symptom column first — you are probably here because
something looks wrong and you don't know why.

## Table of contents

1. [The field looks like static stars, not falling snow](#1-static-stars)
2. [Particles teleport near the cursor](#2-teleporting-particles)
3. [Dot density pulses across the animation](#3-pulsing-density)
4. [Everything is grey mush instead of crisp dots](#4-grey-mush)
5. [The animation runs for a second, then freezes](#5-frozen-after-a-second)
6. [A masthead or element renders completely invisible](#6-invisible-element)
7. [Text collides with itself / measures collapse](#7-collapsed-measures)
8. [A CSS-variable component looks fine in one place, broken in another](#8-missing-css-import)
9. [The hero takes seconds to appear](#9-slow-hero)
10. [The dither looks muddy or shows moiré](#10-muddy-moire)
11. [An emitter drifts off the thing it belongs to](#11-emitter-drift)
12. [No pan value will bring the subject into frame](#12-unreachable-framing)
13. [Your engine edits have no effect in the browser](#13-stale-module)
14. [The grain gets coarser on small screens, not finer](#14-narrow-grain-floor)

---

## 1. Static stars

**Symptom:** the particle layer reads as a fixed starfield. It technically
moves, but it looks like a texture rather than weather.

Three causes, usually all at once:

- **Distributing particles along a golden-ratio walk.** It's the obvious
  no-RNG trick and it produces a *near-regular lattice* — mathematically even,
  visually inert. Use a seeded PRNG (mulberry32 is six lines) so the field is
  genuinely irregular but still reproducible run to run.
- **Uniform speed.** Real snowfall has depth. Give each particle a `z` and
  make near ones fall dramatically faster: a measured spread of ~16× between
  slowest and fastest is what sells it. Add per-particle jitter so no two
  share a cadence, plus a slow lateral sway so they wander instead of
  marching in formation.
- **One cell per particle.** A single lit cell is a star. Give the nearest
  particles a short vertical **streak** that fades behind the head — a streak
  is something falling.

## 2. Teleporting particles

**Symptom:** particles jump or density spikes near the pointer, but only when
the warp is active.

The warp displaces sampling coordinates, so `ix` can go out of bounds. If the
subject lookup is bounds-checked but the particle lookup isn't, an index like
`iy * cols + ix` with negative `ix` silently **wraps onto the previous row**
and reads a valid cell from somewhere else entirely.

Both lookups must share one guard:

```js
if (ix >= 0 && ix < cols && iy >= 0 && iy < rows) {
  v = tower[iy * cols + ix];
  const snow = snowMap.get(iy * cols + ix);
  if (snow !== undefined && snow > v) v = snow;
}
```

To catch it: sweep the pointer across the canvas and measure lit-pixel count
per step. Smooth variation is fine; a spike is this bug.

## 3. Pulsing density

**Symptom:** the whole field subtly breathes brighter and darker.

The auto-level is being recomputed per frame. Percentile levels must be
calculated **once** and pinned for the sequence — as the particle layer moves,
per-frame histograms shift and the dot density visibly pumps. This is the
single easiest thing to get wrong and the hardest to notice in a screenshot.

## 4. Grey mush

**Symptom:** dots look soft, smeared, or grey rather than crisp white.

A 1-bit dither contains **no intermediate greys** — a dot is fully inked or
absent. Grey arrives three ways:

- **Alpha-ramp masks.** Fading a mask's opacity (`rgba(0,0,0,0.55)`) renders
  white type or dots at partial alpha over black, which *is* grey. If you want
  a dissolve, remove whole dots; don't fade them.
- **Browser smoothing on scale-down.** Set `image-rendering: crisp-edges` on
  any canvas that gets CSS-scaled.
- **Too many levels.** Above ~6, adjacent steps stop being distinguishable and
  the field reads as continuous tone — which defeats the effect.

## 5. Frozen after a second

**Symptom:** the animation runs briefly on load, then stops permanently.
Manually calling `engine.start()` from the console fixes it.

In React, this is almost always a **callback prop in the effect dependency
array**:

```jsx
}, [src, onReady]);   // onReady is an inline arrow in the parent
```

Every render creates a new `onReady` identity → the effect re-runs → cleanup
tears down the engine → a new one starts → `onReady` fires → `setState` →
re-render → repeat. Because cleanup runs *after* the newest engine started,
the surviving instance ends up stopped.

Hold callbacks in a ref and keep them out of deps:

```jsx
const onReadyRef = useRef(onReady);
useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
useEffect(() => { /* ... */ onReadyRef.current?.(engine); }, [src]);
```

Also make cleanup tear down only the engine *that run created* — under
StrictMode the first pass unmounts after the second has already installed its
engine, and stopping that one leaves a dead canvas. And guard `start()`
against double-starting so it can't schedule two rAF loops.

Diagnose by reading `engine.running` in the console. `false` means something
called `stop()`.

## 6. Invisible element

**Symptom:** an element is in the DOM with correct size and white text, but
renders nothing.

Suspect a **multi-layer CSS mask**. Composited layers (`mask-composite`,
mixed `-webkit-` and standard properties, `mask-mode` differences between
alpha and luminance) can resolve to fully transparent in ways that are
genuinely hard to predict across engines.

Confirm by clearing the mask in the console. If it appears, don't try to
out-argue the compositor — on a guaranteed-solid background you can get a
pixel-identical result by **painting ground-coloured dots over** the element
instead of masking it away. That depends on nothing more exotic than a
`background-image`.

## 7. Collapsed measures

**Symptom:** two flex children pushed apart with `space-between` render
touching, e.g. `ISSUE 00129 JUL 2026`.

An **absolutely positioned parent with only `max-width` is shrink-to-fit**, and
a child sizing itself with `width: 100%` against a shrink-to-fit parent is
circular. The percentage resolves against the parent's content width — which
is determined by the children — so the measure silently collapses to the
widest item.

Give the positioned container a **definite width**, not just a max:

```css
.plate { position: absolute; width: min(56vw, 52rem); }
```

Verify geometrically — measure the gap between the two elements' bounding
rects. Don't check with `textContent`, which concatenates regardless of
layout and will look broken even when it isn't.

## 8. Missing CSS import

**Symptom:** a component looks right on one page and falls back to defaults on
another.

If a component inherits its type or colour from a *sibling's* stylesheet via
CSS custom properties, it must import that stylesheet itself. It will appear
to work anywhere a registry or index imports every variant — a neighbour is
loading the file for it. Import it explicitly at the point of use.

## 9. Slow hero

**Symptom:** the hero is blank for seconds on load.

Generated art comes back at 2048px+ and several megabytes each. The engine
samples at ~6px cells, so that resolution is thrown away immediately. Convert
to grayscale and cap the longest edge at ~1400px (see SKILL.md §2). Expect
roughly a 7× reduction with no visible change.

## 10. Muddy moiré

**Symptom:** the output is muddy, or shows interference patterns.

The source is **already dithered, stippled, halftoned, or engraved**. The
engine needs continuous tone to quantise; applying a grid to an existing grid
produces moiré, and applying one to 1-bit input produces mud.

Regenerate the source as smooth grayscale. This is not a settings problem and
no amount of contrast tuning will rescue it.


## 11. Emitter drift

**Symptom:** the particle source sits on the staff tip, then slides off it the
moment you adjust `zoom` or `panX`.

Emitter coordinates were anchored to the **canvas**, not the **source image**.
Canvas space moves under the art every time the framing changes, so every
framing tweak silently costs an emitter re-tune — and re-tuning drags the
framing, so the two chase each other.

Anchor in source coordinates and map them through the same fit as the image:

```js
const u0 = ((zoom - 1) * panX) / zoom;
const toCanvasX = (u) => (u - u0) * zoom;   // u is a source fraction, 0..1
```

Scale radial `spread` by `zoom` as well, or the ring stays a fixed screen size
while the object it belongs to grows.

## 12. Unreachable framing

**Symptom:** you drag `panY` end to end and the subject is clipped at every
value. Nothing you do frames it.

At zoom *z* the visible window is `1/z` of the source. If the subject's
bounding box is taller than that window, **no pan value can contain it** —
the framing is unreachable, not mistuned. Zooming *in* makes it worse, which
is the opposite of the instinct.

Measure the bounding box first and derive the maximum usable zoom:

```
zoomMax = min(1 / bboxWidth, 1 / bboxHeight)     // then back off ~12%
```

## 13. Stale module

**Symptom:** you edit the engine, reload, and the old behaviour persists. The
file on disk is definitely correct — you can even `fetch` it from the console
and see your change.

`fetch` bypasses the module cache; `import` does not. The page is running the
previously imported module while the network shows the new file, which makes
it look like your edit did nothing.

Cache-bust the import with a version that changes when the file does:

```js
import { DitherHero } from "./dither.js?v=8ce9fa96";   // content hash
```

**Related:** do not judge a change by eye against a browser window that can
resize itself between measurements. Ink coverage is a fraction of canvas area,
so a viewport change moves it independently of anything you edited, and you
will chase a regression that never happened. Measure on a fixed offscreen
canvas instead — same size every run, and cell counts become comparable.

## 14. Narrow grain floor

**Symptom:** you set a fine grain, and the dither comes out *coarser* on a
phone rather than finer.

The engine drops the cell size on narrow viewports so a subject still reads
when there are few cells to work with:

```js
this.cell = w < 700 ? Math.max(5, this.o.grain - 3) : this.o.grain;
```

That `Math.max(5, ...)` is a floor. Above `grain: 8` the rule fines the grid as
intended, but at `grain: 3` or `4` the floor is *above* your value, so narrow
screens jump to 5 and get chunkier. Anything tuned below `grain: 8` needs its
own check at mobile width — the desktop value does not predict it.
