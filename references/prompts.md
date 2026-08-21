# Source-image prompt library

Every prompt here shares the same four non-negotiable clauses (smooth
continuous tone / off-centre composition / pure black ground / no frame). What
changes is the subject and its **disintegration** — the crumbling, drifting,
shedding edge that gives the dot field internal structure to resolve. A solid
mass with a clean silhouette dithers into a grey blob no matter how good the
render is.

Swap `[right]`/`[left]` to move the type space to the other side.

## Table of contents

- [Architecture on a floating mass](#architecture-on-a-floating-mass)
- [Carved stone wordmark](#carved-stone-wordmark)
- [Ice or crystal wordmark](#ice-or-crystal-wordmark)
- [Circular instrument or emblem](#circular-instrument-or-emblem)
- [Rune or monogram](#rune-or-monogram)
- [Natural phenomenon](#natural-phenomenon)
- [Product or object](#product-or-object)
- [Figure](#figure)
- [Adapting to your own subject](#adapting-to-your-own-subject)

---

## Architecture on a floating mass

The most reliable hero subject: hard edges, lit facets, and a base that can
crumble.

```
A lone [wizard's tower / lighthouse / observatory / cathedral spire] on a
floating rock island, rendered in smooth continuous-tone grayscale — soft
graphite and charcoal shading with full tonal range. NO stippling, NO
halftone, NO dot patterns, NO cross-hatching, NO engraving texture, NO
dithering. Smooth gradients only.

Composition: the structure occupies the right third of a wide 16:9 frame; the
left two-thirds is empty pure-black negative space. Tall narrow [stone] form,
[conical roof], tall arched windows faintly lit from within.

The island's underside crumbles into drifting rubble and falling snow that
thins as it descends.

Lighting: cold moonlight keyed from the upper left. Luminous near-white
highlights on the stone, deep black shadows, rich mid-grey transitions.
Atmospheric, still, quiet.

Pure black background (#000). No text, no border, no frame, no vignette,
no signature.
```

## Carved stone wordmark

Text is a coin flip — models garble lettering. Spell the word out
letter-by-letter in the prompt and verify the result character by character.
Budget for rerolls, or use a symbol and set the words in real type.

```
The words "[WORD ONE] [WORD TWO]" on two stacked lines, carved deep into a
slab of dark weathered stone in heavy inscriptional Roman capitals. Spelling
must be exact: [W-O-R-D O-N-E] on the first line, [W-O-R-D T-W-O] on the
second line.

Smooth continuous-tone grayscale, dramatic side lighting from upper left so
each letter carries a bright chiselled edge and deep shadow; full tonal range.
NO stipple, NO halftone, NO dither, NO hatching.

Stone dust crumbles from the bottom edge of the slab and drifts down.

Pure black background (#000), wide composition. No other text, no border,
no frame, no signature.
```

## Ice or crystal wordmark

Crystalline facets give the dither far more to resolve than carved stone, so
this survives a coarser grain.

```
Two words stacked on two lines, forged from pale glowing ice and frost rather
than carved: the word [ONE] on the upper line, the word [TWO] on the lower
line. Spelling exactly [O-N-E] then [T-W-O].

Heavy blackletter-influenced capitals with sharp crystalline facets, rimed in
frost, faintly lit from within. Smooth continuous-tone grayscale, full tonal
range from near-white highlights on the ice through mid greys to pure black.
NO stipple, NO halftone, NO dither, NO cross-hatching.

Fine ice crystals and snow break away from the bottom of the letters and
drift downward, thinning as they fall.

Pure black background (#000), wide composition, letters filling the frame.
No other text, no border, no frame, no vignette.
```

## Circular instrument or emblem

Square-crop emblem for sitting above a wordmark. Fine internal linework needs
a smaller cell (`cell: 5` or less) or the spokes collapse into a disc.

```
A circular arcane instrument: concentric engraved rings, an inner astrolabe
wheel of fine radial spokes, a crescent moon nested off-centre, and a band of
small angular runic tick-marks around the outer edge.

Rendered in smooth continuous-tone grayscale, soft graphite shading, full
tonal range. NO stippling, NO halftone, NO dither, NO engraving hatch texture.

The lower third disintegrates into drifting particles and dust that thin as
they fall.

Cold moonlight from upper left, luminous white highlights, deep black
shadows. Centred on a pure black background (#000). Square composition.
No text, no border, no frame, no vignette.
```

**On symbols:** check what the geometry actually reads as before shipping it.
A six-pointed star is a standard occult hexagram *and* unmistakably a Star of
David — fine in one context, an unintended statement in another. Rings, arcs,
spokes, crescents and orbital paths carry the same arcane register with no
such reading. Similar care is worth taking with anything resembling national,
religious, or political insignia.

## Rune or monogram

Initials as an angular carved mark — reliable where full words are not,
because the model only has to form two or three letterforms.

```
The letters [X] and [Y] interlocked as a single carved rune-monogram, cut into
weathered stone, angular Nordic-rune construction rather than calligraphy.

Smooth continuous-tone grayscale with deep carved shadow and bright lit edges,
full tonal range. NO stipple, NO halftone, NO dither, NO hatching.

Chipped stone dust and fragments crumble from the lower edge of the carving
and drift downward.

Pure black background (#000), centred, square. Only the letters [X] and [Y] —
no other text, no border, no frame.
```

## Natural phenomenon

The easiest and best category — these subjects are *already* made of discrete
elements, so no disintegration clause is needed.

**A murmuration is the strongest subject in this whole library**, and the
reason is structural rather than aesthetic: the technique resolves *structure,
not mass*, and a murmuration **is** structure — thousands of discrete birds
whose density variation forms the tone. The subject and the medium are the
same idea, so it reads instantly and gets *better* as you coarsen the grain,
which is the opposite of everything else here. Reach for it first.

```
A vast murmuration of starlings in flight, rendered in smooth continuous-tone
grayscale with full tonal range. NO stippling, NO halftone, NO dot patterns,
NO cross-hatching, NO engraving texture, NO dithering. Smooth gradients only.

Composition: the flock occupies the right third of a wide 16:9 frame; the left
two-thirds is empty pure-black negative space. The mass twists into a dense
dark core and thins toward its edges, individual birds resolving at the
fringes and scattering into open sky.

Lighting: hard directional light from the upper left, luminous pale sky
showing through the thinner parts of the flock, deep black where it is dense.

Pure black background (#000). No text, no border, no frame, no vignette,
no signature.
```

Also strong: **a breaking wave dissolving into spray** (foam carries real
mid-greys) and **ink diffusing in water** (pure gradation).

**A weak one, tested:** an erupting volcano. The bright plume blows out while
the dark rock falls under the threshold, leaving nothing legible between them
— you get a white blob above a sparse scatter. Any subject that is *very
bright against very dark with little in between* has this problem, however
dramatic the photograph looks.

## Product or object

Hardest category: a smooth manufactured object has exactly the clean silhouette
that dithers into a blob. Buy back structure with a **material excuse** for
particles — dust, spray, splash, steam, motion trails.

```
[OBJECT], three-quarter view, rendered in smooth continuous-tone grayscale —
studio lighting with a strong key from the upper left and deep falloff into
black. Full tonal range with bright specular highlights on the edges. NO
stippling, NO halftone, NO dither, NO cross-hatching.

Composition: the object occupies the right third of a wide 16:9 frame; the
left two-thirds is empty pure-black negative space.

Fine dust and particles drift through the light around it, thinning outward.

Pure black background (#000). No text, no border, no frame, no reflection
plane, no vignette.
```

## Figure

The hardest category, and the one where the obvious advice is wrong.

A face is a smooth mass, so the instinct is to keep the figure tiny and throw
it into silhouette. **Do not do both.** That combination was in an earlier
version of this file and it produced an unusable source: the figure occupied
too few cells for anything to resolve, and 96% of the image came back pure
black with only 1.7% of pixels above 16/255 — no mid-tones for the dither to
quantise. Heavy shadow lift turned it to mush; light lift left a sparse
outline. Neither is recoverable, because the tone was never in the file.

Two corrections:

- **Medium in frame, not tiny.** Roughly a third of frame height. Small enough
  that facial features never have to resolve, large enough that the silhouette
  gets real cells.
- **Rim light plus fill.** The body must sit in readable **mid-grey**, not
  near-black. Rim light alone gives you an outline and a void.

What survives the dither is silhouette — a pointed hat, a staff line, a cape
edge. What does not is facial features, embroidery, insignia. Lean the prompt
on shapes that read at a distance, and if you need a specific character, hand
the model a reference image rather than describing gear in prose.

```
A lone elderly wizard standing in three-quarter view, occupying about a third
of the frame height, rendered in smooth continuous-tone grayscale with full
tonal range. NO stippling, NO halftone, NO dot patterns, NO cross-hatching,
NO engraving texture, NO dithering. Smooth gradients only.

Composition: the figure stands in the right third of a wide 16:9 frame; the
left two-thirds is empty pure-black negative space.

The figure: a tall narrow cone-shaped hat, a long full beard, heavy
floor-length robes, a cape falling from the shoulders, and a tall staff with a
glowing head. Read as a strong silhouette with clearly separated shapes.

Lighting: rim light from behind and above, PLUS enough soft fill on the robes
that the cloth sits in mid-grey with visible folds — not crushed to black.
Deep black shadows only in the deepest creases. A luminous near-white glow at
the staff head.

Snow and fine dust fall through the scene, denser near the figure and thinning
outward.

Pure black background (#000). No text, no border, no frame, no vignette,
no signature.
```

---

## Adapting to your own subject

Keep all four fixed clauses and change only the subject and its
disintegration. Before generating, ask two questions: **what part of this can
fall apart?** and **does this subject have mid-tones, or only highlights and
shadow?** The second one is what the volcano failed.
If the honest answer is nothing, either add an atmospheric layer (dust, spray,
snow) or pick a different subject — the technique cannot rescue a smooth
solid mass, and it is much cheaper to change the source than to fight the
settings afterwards.
