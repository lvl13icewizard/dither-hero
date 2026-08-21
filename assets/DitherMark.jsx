// Dithers an arbitrary image into a canvas using the same Bayer 8x8 ordered
// dither and dot-radius mapping the hero applies to the tower — so a logo
// rendered through this is made of literally the same material as the art
// beside it, rather than a picture pasted next to a picture.
//
// Static: no rAF loop. The mark does not animate, so it is drawn once per
// layout change and left alone. That keeps a second animation loop off the
// page while the tower is already running one.

import { useEffect, useRef } from "react";

const BAYER = (() => {
  const b2 = [
    [0, 2],
    [3, 1],
  ];
  const grow = (m) => {
    const n = m.length * 2;
    const out = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        out[y][x] =
          m[y % m.length][x % m.length] * 4 +
          b2[y < m.length ? 0 : 1][x < m.length ? 0 : 1];
    return out;
  };
  return grow(grow(b2)).map((r) => r.map((v) => v / 64));
})();

export default function DitherMark({
  src,
  alt = "",
  grain = 6,
  toneSteps = 4,
  dotGap = 0.34,
  dotFill = 0.82,
  // Same scale as DitherHero's contrast, not a bare multiplier — a number
  // that means one thing in the hero and another in the mark is a trap.
  contrast = 16,
  brightness = 0,
  shadowLift = 0.25,
  blackCutoff = 0.05,
  className = "",
  maxWidth = 520,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let dead = false;
    const img = new Image();
    img.decoding = "async";

    const paint = () => {
      if (dead || !img.naturalWidth) return;
      const host = canvas.parentElement;
      const cssW = Math.min(maxWidth, host ? host.clientWidth : maxWidth);
      if (cssW < 8) return;
      const cssH = Math.round((cssW * img.naturalHeight) / img.naturalWidth);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

      const cols = Math.max(1, Math.floor(cssW / grain));
      const rows = Math.max(1, Math.floor(cssH / grain));

      // Downsample once; everything after works on the small buffer.
      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.drawImage(img, 0, 0, cols, rows);
      const { data } = octx.getImageData(0, 0, cols, rows);

      // Rec. 709 luma, then auto-level against the 2nd/98th percentiles so a
      // dim source still uses the full dot range. Pinned per paint, not per
      // frame — this is static, so there is nothing to pulse.
      const luma = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const p = i * 4;
        luma[i] =
          (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
      }
      // Percentiles over NON-VOID pixels only. This art is mostly pure black
      // by design, so whole-frame percentiles are drawn almost entirely from
      // the void and crush the subject into the top level. Matches the hero.
      const lit = Array.from(luma).filter((v) => v > 0.03).sort((a, b) => a - b);
      const lo = lit.length > 32 ? lit[Math.floor(lit.length * 0.02)] : 0;
      const hi = lit.length > 32 ? lit[Math.floor(lit.length * 0.98)] : 1;
      const span = Math.max(1e-4, hi - lo);
      // Photoshop-style contrast, identical to the hero's.
      const k = (259 * (contrast + 255)) / (255 * (259 - contrast));

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#fff";

      const inner = grain * (1 - dotGap);
      const rMax = (inner / 2) * dotFill;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let v = (luma[y * cols + x] - lo) / span;
          v = Math.pow(Math.max(0, Math.min(1, v)), 1 - shadowLift);
          v = k * (v - 0.5) + 0.5 + brightness / 255;
          if (v <= blackCutoff) continue; // keep the ground genuinely empty
          v = Math.min(1, Math.max(0, v));
          const q = Math.floor(
            Math.min(0.9999, v + (BAYER[y & 7][x & 7] - 0.5) / toneSteps) * toneSteps
          );
          if (q <= 0) continue;
          const r = rMax * (q / (toneSteps - 1 || 1));
          if (r < 0.16) continue;
          ctx.beginPath();
          ctx.arc(x * grain + grain / 2, y * grain + grain / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    img.onload = paint;
    img.src = src;
    const ro = new ResizeObserver(paint);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      dead = true;
      ro.disconnect();
    };
  }, [src, grain, toneSteps, dotGap, dotFill, contrast, brightness, shadowLift,
      blackCutoff, maxWidth]);

  return (
    <canvas
      ref={ref}
      className={className}
      role={alt ? "img" : "presentation"}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : "true"}
    />
  );
}
