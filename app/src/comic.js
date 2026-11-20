// comic.js — one photo through the printer's shop: a warm sunset grade, a six-level posterise, a thick Sobel
// outline, a 45-degree halftone screen and a vignette, all pixel operations on one cached offscreen canvas.

import { drawPhotoCover } from './photoPanels.js';

/** Poster ink, shared by the outline, the halftone and the sticker border. */
export const COMIC_INK = [13, 6, 17];

/** The six-tone ladder the photo is flattened onto. */
const LEVELS = 6;

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** The graded, posterised and screened canvas for one shot, cached by framing so a drag only pays once a frame. */
const cache = new WeakMap();

function cacheKey(w, h, shot) {
  return [w, h, shot.zoom.toFixed(3), shot.focusX.toFixed(3), shot.focusY.toFixed(3), shot.flip ? 1 : 0].join(':');
}

/** The comic treatment of one shot at w by h pixels: returns a canvas of exactly that size. */
export function comicCanvas(shot, w, h) {
  w = Math.max(16, Math.round(w));
  h = Math.max(16, Math.round(h));
  const key = cacheKey(w, h, shot);
  let entries = cache.get(shot);
  if (!entries) {
    entries = new Map();
    cache.set(shot, entries);
  }
  const held = entries.get(key);
  if (held) return held;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  drawPhotoCover(ctx, { x: 0, y: 0, w, h }, shot);

  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const count = w * h;
  const light = new Float32Array(count);

  // 1 + 2: warm sunset grade, then posterise. The curve is gentle; the tone ladder does the drawing.
  const step = 1 / (LEVELS - 1);
  for (let i = 0; i < count; i += 1) {
    const p = i * 4;
    const r0 = px[p] / 255;
    const g0 = px[p + 1] / 255;
    const b0 = px[p + 2] / 255;
    const base = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

    // Saturation up first, so the grade spreads colour rather than grey.
    let r = base + (r0 - base) * 1.3;
    let g = base + (g0 - base) * 1.3;
    let b = base + (b0 - base) * 1.3;

    // Warm highlights towards ember, shadows towards violet: the Vice City sunset in one line each.
    const warm = smoothstep(0.32, 1, base);
    const shade = smoothstep(0.42, 0, base);
    r += 0.17 * warm - 0.05 * shade;
    g += 0.07 * warm - 0.02 * shade;
    b += -0.10 * warm + 0.13 * shade;

    // Contrast curve about the midtones, then the six-level ladder.
    r = Math.round(clamp01(clamp01(0.5 + (r - 0.5) * 1.12)) / step) * step;
    g = Math.round(clamp01(clamp01(0.5 + (g - 0.5) * 1.12)) / step) * step;
    b = Math.round(clamp01(clamp01(0.5 + (b - 0.5) * 1.12)) / step) * step;

    // 3: the halftone screen, at 45 degrees, biting hardest in the midtones.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    light[i] = luma;
    const pitch = Math.max(3, Math.min(w, h) * 0.0125);
    const u = ((i % w) + Math.floor(i / w)) * 0.7071 / pitch;
    const v = ((i % w) - Math.floor(i / w)) * 0.7071 / pitch;
    const du = u - Math.round(u);
    const dv = v - Math.round(v);
    const distance = Math.sqrt(du * du + dv * dv);
    const tone = clamp01((0.88 - luma) / 0.72);
    const dots = clamp01((0.5 * Math.sqrt(tone) - distance) * 6);
    const gate = smoothstep(0.04, 0.3, luma) * smoothstep(1, 0.82, luma);
    const screen = dots * gate * 0.34;

    r = r * (1 - screen) + (COMIC_INK[0] / 255) * screen;
    g = g * (1 - screen) + (COMIC_INK[1] / 255) * screen;
    b = b * (1 - screen) + (COMIC_INK[2] / 255) * screen;

    px[p] = r * 255;
    px[p + 1] = g * 255;
    px[p + 2] = b * 255;
  }

  // 4: Sobel over the flattened tones, thresholded, then dilated so the line has weight.
  const edges = new Float32Array(count);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const tl = light[i - w - 1];
      const t = light[i - w];
      const tr = light[i - w + 1];
      const l = light[i - 1];
      const rr = light[i + 1];
      const bl = light[i + w - 1];
      const bb = light[i + w];
      const br = light[i + w + 1];
      const gx = tl + 2 * l + bl - tr - 2 * rr - br;
      const gy = tl + 2 * t + tr - bl - 2 * bb - br;
      edges[i] = smoothstep(0.5, 0.95, Math.sqrt(gx * gx + gy * gy));
    }
  }

  const thick = new Float32Array(count);
  const spread = Math.max(1, Math.round(Math.min(w, h) / 420));
  for (let pass = 0; pass < 1 + spread; pass += 1) {
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        const m = Math.max(
          edges[i], edges[i - 1], edges[i + 1], edges[i - w], edges[i + w],
          edges[i - w - 1], edges[i - w + 1], edges[i + w - 1], edges[i + w + 1],
        );
        thick[i] = m;
      }
    }
    edges.set(thick);
  }

  for (let i = 0; i < count; i += 1) {
    const m = thick[i] * 0.94;
    if (m <= 0.002) continue;
    const p = i * 4;
    px[p] = px[p] * (1 - m) + COMIC_INK[0] * m;
    px[p + 1] = px[p + 1] * (1 - m) + COMIC_INK[1] * m;
    px[p + 2] = px[p + 2] * (1 - m) + COMIC_INK[2] * m;
  }

  ctx.putImageData(image, 0, 0);

  // 5: a soft corner falloff, so the cut-out sits down into the poster instead of floating.
  const falloff = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  falloff.addColorStop(0, 'rgba(10,2,20,0)');
  falloff.addColorStop(0.72, 'rgba(10,2,20,0.1)');
  falloff.addColorStop(1, 'rgba(6,1,14,0.38)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, w, h);

  entries.set(key, canvas);
  return canvas;
}