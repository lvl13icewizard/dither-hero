# Samples

Nine finished heroes with their exact settings. Open `index.html` from a local
server — ES modules will not load over `file://`:

```bash
python3 -m http.server 8000    # then visit /samples/
```

The demo loads `../assets/dither.js` — the shipped engine, not a copy — so what
you see is what the skill produces.

## What's here

| image | notes |
|---|---|
| `murmuration` | The best natural-phenomenon subject. Density variation *is* the tone, so the dither and the subject are doing the same job. Improves as you coarsen it. |
| `open-grimoire` | Widest tonal range of the set. Radial emitter off the open pages. |
| `hourglass` | `fall` emitter confined to a narrow box — sand inside the glass, not weather over the frame. |
| `elderly-wizard` | Figure subject, deliberately small in frame. `radial` emitter pinned to the staff tip. |
| `volcanic-peak` | Wide slow ember ring (`spread 0.34`, 30 particles). |
| `tower` | Architecture on a floating mass. Whole-frame `fall` — the one case where weather is the point. |
| `e2-ice`, `e1-stone` | Wordmarks as generated art. `fit: contain`. |
| `a2-astrolabe` | Square emblem, `fit: contain`, with 270 near-static motes pooled at its base. |

## presets.json

`order` is display order; `presets` maps filename to a full settings object.
Load one straight into the engine:

```js
const { presets } = await (await fetch("presets.json")).json();
const { label, ...opts } = presets["murmuration.png"];
const engine = new DitherHero(canvas, img, opts);
```

Every preset is framed for a **landscape** viewport. The six `cover` ones crop
hard in portrait; the three `contain` ones survive it.

## Provenance

Sources were generated with an image model from the templates in
`references/prompts.md`, then prepared per SKILL.md §2 (grayscale, longest edge
capped at 1400px). `e2-ice` and `e1-stone` spell a specific project's name —
swap them for your own wordmark rather than shipping someone else's.
