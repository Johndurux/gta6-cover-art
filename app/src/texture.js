// texture.js — the film over the poster: the sunset wash behind everything, a halftone screen, seed-stable
// grain, vignettes, light leaks and the neon rim light that separates each panel from the sky. Every helper
// paints a rectangle of the poster and touches no DOM, so the small preview and the full-size export share
// exactly the same look.

export const INK = '#0b0410';

/** Sunset stops, top to horizon: violet night, hot magenta, ember red, gold. */
export const SKY_STOPS = ['#170727', '#3c0d48', '#8d1a56', '#dd4f42', '#ffb14e'];

/** mulberry32: a seeded generator, so grain and halftone are identical in the preview and in every export. */
export function seeded(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipRect(ctx, rect) {
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
}

/** Vertical sunset wash: violet night above, hot magenta and ember towards the horizon. */
export function paintSkyWash(ctx, rect, stops = SKY_STOPS) {
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** A radial sun bloom, blended additively, to put a light source in the sky behind the panels. */
export function paintSunBloom(ctx, cx, cy, radius, rgba) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, rgba);
  g.addColorStop(0.42, rgba.replace(/[\d.]+\)$/, '0.28)'));
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

let halftoneCache = null;

/** A single-dot tile at the given pitch, reused for every panel. */
function halftoneTile(pitch) {
  if (halftoneCache && halftoneCache.pitch === pitch) return halftoneCache.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = pitch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pitch / 2, pitch / 2, pitch * 0.29, 0, Math.PI * 2);
  ctx.fill();
  halftoneCache = { pitch, canvas };
  return canvas;
}

/** The print screen: dots on a tilted grid, blended over the art so it reads as printed ink. */
export function paintHalftone(ctx, rect, pitch, alpha = 0.12) {
  const pattern = ctx.createPattern(halftoneTile(Math.max(5, Math.round(pitch))), 'repeat');
  if (!pattern) return;
  ctx.save();
  clipRect(ctx, rect);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(-0.34);
  ctx.fillStyle = pattern;
  ctx.fillRect(-rect.w, -rect.h, rect.w * 2, rect.h * 2);
  ctx.restore();
}

let grainCache = null;

/** A 160 px of mid-grey noise, tiled. Grey 128 is a no-op under `overlay`, so only the speckle shows. */
function grainTile() {
  if (grainCache) return grainCache;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(size, size);
  const random = seeded(0x5eed);
  for (let i = 0; i < data.data.length; i += 4) {
    const value = 96 + Math.floor(random() * 64);
    data.data[i] = value;
    data.data[i + 1] = value;
    data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  grainCache = canvas;
  return canvas;
}

/** 35 mm grain across a rectangle, blended so it bites into the midtones. */
export function paintGrain(ctx, rect, alpha = 0.09) {
  const pattern = ctx.createPattern(grainTile(), 'repeat');
  if (!pattern) return;
  ctx.save();
  clipRect(ctx, rect);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Corner falloff, so the eye stays on the middle of the poster. */
export function paintVignette(ctx, rect, strength = 0.55) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.hypot(rect.w, rect.h) / 2;
  const g = ctx.createRadialGradient(cx, cy, radius * 0.42, cx, cy, radius);
  g.addColorStop(0, 'rgba(10,3,18,0)');
  g.addColorStop(0.72, `rgba(10,3,18,${strength * 0.34})`);
  g.addColorStop(1, `rgba(8,2,14,${strength})`);
  ctx.save();
  clipRect(ctx, rect);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** One edge of neon rim light, fading inwards over the panel. */
export function paintNeonRim(ctx, rect, side, color, alpha = 0.42, depth = 0.2) {
  const vertical = side === 'left' || side === 'right';
  const span = (vertical ? rect.w : rect.h) * depth;
  const x0 = side === 'left' ? rect.x : rect.x + rect.w;
  const y0 = side === 'top' ? rect.y : rect.y + rect.h;
  const g = vertical
    ? ctx.createLinearGradient(x0, 0, side === 'left' ? rect.x + span : rect.x + rect.w - span, 0)
    : ctx.createLinearGradient(0, y0, 0, side === 'top' ? rect.y + span : rect.y + rect.h - span);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  clipRect(ctx, rect);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Two soft horizontal flares, as if a strip light were passing across the frame. */
export function paintLightLeak(ctx, rect, seed = 1) {
  const random = seeded(seed);
  ctx.save();
  clipRect(ctx, rect);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 2; i += 1) {
    const y = rect.y + rect.h * (0.18 + random() * 0.6);
    const thickness = rect.h * (0.05 + random() * 0.08);
    const g = ctx.createLinearGradient(0, y - thickness, 0, y + thickness);
    const tint = i === 0 ? '255,180,120' : '255,90,170';
    g.addColorStop(0, `rgba(${tint},0)`);
    g.addColorStop(0.5, `rgba(${tint},0.16)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, y - thickness, rect.w, thickness * 2);
  }
  ctx.restore();
}

/** The octagonal-ish gradient border every panel carries, so the grid reads as a print grid. */
export function paintPanelEdge(ctx, rect, weight) {
  ctx.save();
  ctx.strokeStyle = 'rgba(8,2,14,0.92)';
  ctx.lineWidth = Math.max(2, weight * 2);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,228,244,0.16)';
  ctx.lineWidth = Math.max(1, weight * 0.7);
  ctx.strokeRect(rect.x + weight, rect.y + weight, rect.w - weight * 2, rect.h - weight * 2);
  ctx.restore();
}