// cutout.js — the sticker shapes the photos are cut into. A cut-out is not a rectangle: its edge is a rounded
// blob walked segment by segment with a seeded wobble, so it reads as torn from a print and pasted down. Each one
// carries a heavy black border and a drop shadow, which is what lifts it off the poster behind it.

import { seeded } from './texture.js';

/**
 * The outline of one sticker, in local pixels from (0, 0) to (w, h). The wobble is seeded per cut-out, so the
 * same cut-out keeps the same torn edge in the preview and in every export.
 */
export function stickerPath(w, h, seed = 1, wobble = 0.012) {
  const random = seeded(seed);
  const path = new Path2D();
  const radius = Math.min(w, h) * 0.06;
  const amplitude = Math.min(w, h) * wobble;
  const step = Math.max(9, Math.min(w, h) / 26);
  const points = [];

  const push = (x, y) => {
    points.push([x + (random() * 2 - 1) * amplitude, y + (random() * 2 - 1) * amplitude]);
  };

  const edge = (x0, y0, x1, y1) => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const runs = Math.max(2, Math.round(length / step));
    for (let i = 0; i < runs; i += 1) {
      push(x0 + ((x1 - x0) * i) / runs, y0 + ((y1 - y0) * i) / runs);
    }
  };

  const corner = (cx, cy, from, to) => {
    const runs = 5;
    for (let i = 0; i <= runs; i += 1) {
      const angle = from + ((to - from) * i) / runs;
      push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
  };

  corner(radius, radius, Math.PI, Math.PI * 1.5);
  edge(radius, 0, w - radius, 0);
  corner(w - radius, radius, Math.PI * 1.5, Math.PI * 2);
  edge(w, radius, w, h - radius);
  corner(w - radius, h - radius, 0, Math.PI * 0.5);
  edge(w - radius, h, radius, h);
  corner(radius, h - radius, Math.PI * 0.5, Math.PI);
  edge(0, h - radius, 0, radius);

  path.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) path.lineTo(points[i][0], points[i][1]);
  path.closePath();
  return path;
}

/**
 * Draws one cut-out: the black sticker body with its shadow, then `paint` inside the clipped inner shape, then a
 * printed hairline along the inner edge. `border` is the black rim in poster pixels.
 */
export function paintCutout(ctx, rect, seed, border, paint) {
  const { x, y, w, h } = rect;
  const outer = stickerPath(w, h, seed);
  const inner = stickerPath(w - border * 2, h - border * 2, seed + 101);

  ctx.save();
  ctx.translate(x, y);

  // The shadow: two offset copies of the sticker outline, fanned out, which reads as a soft drop shadow
  // without a blurred canvas shadow (that is far too slow to rasterise at export size).
  const drop = Math.min(w, h) * 0.018;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 1, 10, 0.34)';
  ctx.translate(drop * 2.1, drop * 3.1);
  ctx.fill(outer);
  ctx.fillStyle = 'rgba(5, 1, 10, 0.5)';
  ctx.translate(-drop * 0.55, -drop * 0.75);
  ctx.fill(outer);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#08030d';
  ctx.fill(outer);
  ctx.restore();

  ctx.save();
  ctx.translate(border, border);
  ctx.clip(inner);
  paint(ctx, { x: 0, y: 0, w: w - border * 2, h: h - border * 2 });
  ctx.restore();

  // A one-pixel paper edge inside the black rim, the way a printed sticker catches the light.
  ctx.save();
  ctx.translate(border, border);
  ctx.strokeStyle = 'rgba(255, 236, 246, 0.16)';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0022);
  ctx.stroke(inner);
  ctx.restore();

  ctx.restore();
}