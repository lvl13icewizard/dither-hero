---
name: dither-hero
description: Build a black-and-white dithered hero image — a generated grayscale subject rendered live on canvas as a Bayer dot-matrix field, with positioned particle emitters, a pointer-warp, scroll dissolve, and a slider panel for tuning grain, tone and framing. Use this whenever someone wants a dithered, halftone, 1-bit, dot-matrix, ASCII-adjacent, or "cool black and white" hero, landing page, splash screen, or masthead; when they mention dithering an image or applying a halftone effect on the web; or when they want to generate art for a site and give it a distinctive monochrome treatment rather than dropping in a flat photo. Also use it when a hero looks generic and needs a signature visual identity.
---

# Dithered hero

A hero built this way is a **live canvas field of white dots on pure black**,
not an image file. The subject is generated as smooth grayscale art, then the
browser re-renders it every frame through an ordered dither — so particles
drift through it, the pointer bends it, and it dissolves as the page scrolls.
Type sits beside it as real DOM text.

The reason it looks expensive is that everything on screen is made of the
*same material*: one dot lattice for the art, the particles moving through it,
the rules under the headings. The failure mode is a page where a dithered picture sits
next to unrelated smooth type — two objects, no system.

## The pipeline

0. **Get a source image** — generate it, or bring your own (§0)
1. **Make sure it will dither** — smooth grayscale, pure black ground (§1)
2. **Prepare the asset** — grayscale, cap resolution (§2)
3. **Drop in the engine** — `assets/dither.js` (§3)
4. **Tune it live** — `assets/Picker.jsx` (§4)
5. **Compose type over it** — real DOM, never canvas (§5)

Read `references/pitfalls.md` before debugging anything — every bug listed
there was found the hard way and costs an hour to rediscover.

`samples/` holds nine finished heroes with their settings in `presets.json`,
and `samples/index.html` is a no-build demo that loads them through the real
engine with the tuning panel attached. Open it before reading further — it is
faster than any description of what the parameters do, and the presets are
worked examples of the framing and emitter maths below.

---

## 0. Getting the source image

This skill is **generator-agnostic**. It needs one grayscale image and does not
care where that image came from — an image model, a photograph, a scan, a 3D
render. Nothing here depends on a particular vendor, service, MCP, account, or
API key, and nothing here will spend money on its own.

Work out which of three situations you are in before doing anything else.

**The user already has an image.** Skip generation entirely. Check it against §1
first: it has to be smooth continuous tone. A photograph or a soft 3D render is
fine. An image that is already dithered, stippled, halftoned, engraved, or 1-bit
is not, and no amount of settings tuning will rescue it — see pitfalls §10. Go
to §2.

**You have an image-generation tool available.** Use it with the template in §1.
Before you generate, say what you are about to make and how many — image
generation usually costs the user credits or money, and four rerolls of a
wordmark is a real charge, not a free preview. Ask first if you are generating
more than a couple.

**You have no image-generation tool.** Do not stall, and do not drop in a
placeholder and carry on as if the step is done. Fill in the §1 template
completely, print it for the user, and tell them to run it in whichever image
model they use — gpt-image, Nano Banana, Flux and Midjourney all accept this
prompt as written — then save the result and hand you the file path. The prompt
is the part of this step that transfers between people; the plumbing is not.
Pick up again at §2.

Whichever path you took, **§2 is not optional.** It applies to a file the user
supplied exactly as much as to one you generated.

---

## 1. Generating a source that actually dithers

This is where the whole thing is won or lost, and the intuition is backwards
from what people expect.

**The engine ADDS the dots.** So the source must be **smooth continuous-tone
grayscale** with a full range from near-white through mid-greys to pure black.
Feed it something already stippled, engraved, halftoned, or 1-bit and the
auto-level and quantize stages have no tonal range left to work with — you get
mud, or grid-on-grid moiré. If someone hands you a pre-dithered image, the fix
is to regenerate the source, not to fight the settings.

**Subject matters too.** Dithering resolves *structure*, not mass. A subject
made of many small discrete elements — a flock, falling snow, crumbling rock,
a crowd, architecture with lots of edges — has something for the dot field to
latch onto. A single smooth object (one face, one sphere) becomes a grey blob.
When the subject is solid, give it a **disintegrating edge**: rubble falling
off a floating rock, dust breaking from carved stone, ice crystals shedding
from letterforms. That dissolve is what makes it read as dots rather than as
a picture of a thing.

Prompt template (works on gpt-image, Nano Banana, Flux, Midjourney):

```
[SUBJECT], rendered in smooth continuous-tone grayscale — soft graphite and
charcoal shading with full tonal range. NO stippling, NO halftone, NO dot
patterns, NO cross-hatching, NO engraving texture, NO dithering. Smooth
gradients only.

Composition: [SUBJECT] occupies the [right] third of a wide 16:9 frame; the
[left] two-thirds is empty pure-black negative space.

[DISINTEGRATION CLAUSE — e.g. "the underside crumbles into drifting rubble
and falling debris that thins as it descends"]

Lighting: cold [moonlight] keyed from the upper left. Luminous near-white
highlights, deep black shadows, rich mid-grey transitions.

Pure black background (#000). No text, no border, no frame, no vignette,
no parchment edge, no signature.
```

Four clauses that each prevent a specific failure:

- **"NO stippling/halftone/dithering"** — models love adding texture that
  destroys the tonal range the engine needs.
- **Off-centre composition** — the empty side is where the headline goes. A
  centred subject splits the negative space in two and leaves nowhere good
  for type.
- **"Pure black background (#000)"** — the engine clamps a floor to keep empty
  cells truly empty. A lifted or noisy background renders as haze everywhere.
- **"No border, no frame, no vignette"** — image models habitually add a
  painted edge, which dithers into a hard rectangle floating mid-page.

**Aspect:** 16:9 for a full-bleed hero, 1:1 for an emblem that sits above type.

**Text in the image is a coin flip.** Models still garble lettering. If the
wordmark must be generated art, expect rerolls and verify the spelling
character by character. Safer: generate a symbol and set the wordmark in real
type.

---

## 2. Preparing the asset

Two mechanical steps that matter more than they sound:

```bash
python3 - <<'PY'
from PIL import Image
im = Image.open("hero.png").convert("L")      # luma is all the engine reads
w, h = im.size
s = min(1.0, 1400 / max(w, h))
if s < 1.0:
    im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
im.save("hero.png", optimize=True)
PY
```

The engine downsamples to ~6px cells before doing anything, so a 2048px
source is almost entirely wasted bytes. Converting to grayscale and capping
at 1400px typically takes a set of hero images from ~27 MB to ~4 MB **with no
visible difference** — the dither samples far below that resolution either
way. Skipping this ships a hero that takes seconds to appear.

---

## 3. The engine

`assets/dither.js` is a dependency-free ES module — copy it in and construct
it with a canvas and a loaded `Image`:

```js
import { DitherHero } from "./dither.js";

const engine = new DitherHero(canvas, img);   // img must be loaded
engine.resize();
engine.start();

// drive it from the page
window.addEventListener("pointermove", e => engine.setPointer(e.clientX, e.clientY));
window.addEventListener("pointerleave", () => engine.setPointer(null));
window.addEventListener("scroll", () => engine.setScroll(window.scrollY / heroHeight));
engine.setOptions({ grain: 8, particles: "fall" });   // live retune
```

What it does per frame: downsamples to a cell grid, converts to Rec. 709
luma, auto-levels against the 2nd/98th percentiles **pinned once at build
time**, applies contrast/brightness, clamps a floor, quantises through an 8×8
Bayer matrix, and draws each cell as a circle whose radius scales with its
tone level. Particles composite in as a separate sparse layer.

The parameters worth knowing:

| Option | Range | What it does |
|---|---|---|
| `grain` | 3–24 | Cell size. Bigger = coarser, more graphic, more poster |
| `toneSteps` | 2–6 | Tone levels. 2 is hard 1-bit; 4–5 is the sweet spot |
| `dotGap` | 0.15–0.6 | Gap fraction per cell |
| `dotFill` | 0.5–1 | Dot radius within the remaining cell |
| `contrast` / `brightness` | — | Applied after auto-level |
| `shadowLift` | 0–0.8 | 0 = linear. Higher lifts a dark subject into range |
| `blackCutoff` | ~0.02 | Below this a cell draws nothing — keeps the void empty |
| `zoom` / `panX` / `panY` | — | Framing. See below |
| `fit` | cover \| contain | Fill and crop, or fit the whole image in |
| `particles` | off \| fall \| radial | The emitter. See below |

**Airiness is cell size against dot fill, not dot count.** If it looks heavy
and flat, raise `grain` *and* lower `dotFill` together. Adding more dots makes
it worse.

**Framing decides whether the subject reads at all.** It must occupy enough
*cells* — a function of cell count, not pixels — so a subject that is small in
frame needs zooming into. Derive this rather than guess: measure the subject's
bounding box in the source, then

```
zoom  = min(1/bboxWidth, 1/bboxHeight) * 0.88   // 0.88 leaves a margin
panX  = (bboxCentreX - 1/zoom/2) / ((zoom-1)/zoom)   // clamp to 0..1
```

The trap this avoids: at high zoom the visible window can be **shorter than
the subject is tall**, in which case no pan value will ever contain it and you
will spend a long time dragging sliders that cannot work.

Use `fit: "contain"` for a square or oddly-shaped source in a wide hero.
Cover-fit slices the top and bottom off a square emblem; on a pure-black
ground, contain's leftover margins are simply invisible.

### Particles

Three modes, and the default is `off` — a full-screen weather layer competes
with the subject on most images. Localised emission reads as *the object doing
something* rather than ambience laid over it:

- **`fall`** — drifts down inside a box (`emitX`/`emitY`, `areaWidth`/
  `areaHeight`). Whole-frame gives you weather; a narrow box gives you sand
  inside an hourglass or dust pooling under an emblem.
- **`radial`** — streams outward from a point, brightest at the source and
  fading with distance (`emitX`/`emitY`, `spread`). A staff tip, a glowing
  core, an ember ring off a crater.

`emitX`/`emitY` are in **source coordinates, not canvas coordinates**, and are
mapped through the same fit as the image. Anchor an emitter to the canvas
instead and it slides off the thing it belongs to the moment you touch zoom or
pan, so every framing tweak costs a re-tune.

For a **static** dithered image (a logo, an emblem — anything that shouldn't
animate), use `assets/DitherMark.jsx` instead. Same Bayer matrix and radius
mapping, no animation loop, repaints only on resize. Using the same maths for
both is what makes a dithered logo look like it belongs to the dithered hero
rather than merely resembling it.

**Pointer interaction:** displace the *sampling coordinates*, not the drawn
output — the warp then costs nothing per frame because it happens while
reading the already-downscaled buffer. Give it a wide radius (~60% of the
canvas) and a soft falloff so it reads as a field effect rather than a
cursor-shaped bubble. Avoid radial ripple; on a natural subject it looks like
a lens artefact sitting on top of the image. Directional lean suits wind and
falling particles; rotational twist suits radial subjects.

---

## 4. Tuning it live

Ship `assets/Picker.jsx` + `assets/picker.css` during the design phase. It
gives a left-docked panel of grouped sliders — frame, dots, tone, particles
— that call `engine.setOptions()` live, plus three save slots and a **copy
settings** button that puts the settled JSON on your clipboard.

This exists because **nobody can specify these numbers in advance** — not you,
not the person you're building for. `grain: 6` versus `8` is the
difference between "elegant" and "poster", and the only way to settle it is to
look at both against the real art. Handing over a panel and asking which one
converges in one round; guessing at values and screenshotting them takes five.

Delete the picker once the values are chosen and hard-code them. Keep the
copied JSON somewhere durable — that tuning is real work and easy to lose.

---

## 5. Composing type over the dot field

**Never render text into the canvas.** It kills selection, search, screen
readers, and it resamples badly. Mark the canvas `aria-hidden="true"` — it's
decoration — and lay real DOM text over it.

Legibility over a dot field has three solutions; pick per design:

1. **Negative space** (best) — compose the art off-centre and put type in the
   empty side. No scrim needed, nothing dimmed.
2. **Gradient scrim** — a directional gradient, heaviest under the type.
3. **Solid backing panel** — only when the dither is genuinely dense.

To bind type to the art without making it illegible, put the *furniture* on
the same lattice rather than the letterforms: rules made of 2px dots on the
engine's 6px pitch, dissolving toward the art so the eye is handed forward.
Perforating the letters themselves with the dot grid is tempting and usually
reads as a Vegas marquee — every dot the same size, none of the tonal
variation that makes the art work. If you try it, the dots must stay **binary**
(full ink or absent); fading their *alpha* produces grey, and grey is the one
thing a 1-bit dither never contains.

Fonts: skip Inter, Roboto, Geist, Space Grotesk, Plus Jakarta Sans, and
Instrument Serif. They're the default faces of the current AI-generated-UI
wave, and the entire point of this treatment is not looking generic.

---

## Verifying it

Check these before calling it done — each catches a real class of failure:

- **Dot density holds steady** across the whole animation. Pulsing means the
  auto-levels aren't pinned.
- **Sweep the pointer edge to edge** and watch for particles teleporting or
  density spiking — that's an unguarded array lookup.
- **The subject still reads** at the chosen `grain`. Coarser is more
  striking right up until it dissolves into noise.
- **Narrow viewport** — the canvas is much smaller relative to the cell, so
  small screens usually need a finer grid.
- **`prefers-reduced-motion`** — paint one static frame and skip the loop.

**Testing in a headless or background browser:** `requestAnimationFrame` does
not fire when `document.hidden` is true, so the field will look frozen even
though the engine is healthy. Check `document.hidden` before concluding
anything is broken, and drive the simulation manually to verify it —
`for (let i = 0; i < 10; i++) engine.draw(1/15)` — then compare particle
positions before and after. (`start()` paints one synchronous frame precisely
so a page opened in a background tab isn't blank.)
