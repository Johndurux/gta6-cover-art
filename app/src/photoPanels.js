// photoPanels.js — one panel of the poster and the photo inside it: the framing state (zoom and the point of
// the photo that sits in the middle), the maths that keeps the photo covering the panel while it is dragged,
// and the sunset grade, halftone and rim light painted over it.

import { paintGrain, paintHalftone, paintNeonRim, paintSunBloom, paintVignette } from './texture.js';

/** Where the sun sits in each panel, as a fraction of the panel, so no two panels are lit the same way. */
const PANEL_SUN = [
  [0.78, 0.22],
  [0.2, 0.3],
  [0.72, 0.16],
  [0.3, 0.2],
  [0.66, 0.24],
  [0.42, 0.18],
];

const MAX_ZOOM = 3;

/** A photo placed in a panel: the image plus where the user has dragged and zoomed it. */
export function createShot(image, framing = {}) {
  return {
    image,
    zoom: framing.zoom ?? 1,
    focusX: framing.focusX ?? 0.5,
    focusY: framing.focusY ?? 0.5,
    flip: framing.flip ?? false,
  };
}

function coverScale(shot, rect) {
  const { naturalWidth: iw, naturalHeight: ih } = shot.image;
  return Math.max(rect.w / iw, rect.h / ih);
}

/** The largest focus offset that still keeps the photo covering the panel, per axis. */
function focusLimits(shot, rect) {
  const scale = coverScale(shot, rect) * shot.zoom;
  const halfX = rect.w / 2 / (shot.image.naturalWidth * scale);
  const halfY = rect.h / 2 / (shot.image.naturalHeight * scale);
  return { halfX: Math.min(halfX, 0.5), halfY: Math.min(halfY, 0.5) };
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** The framing the panel will actually draw with: focus pulled back inside the photo's edges. */
export function resolveFraming(shot, rect) {
  const limits = focusLimits(shot, rect);
  return {
    zoom: shot.zoom,
    focusX: clamp(shot.focusX, limits.halfX, 1 - limits.halfX),
    focusY: clamp(shot.focusY, limits.halfY, 1 - limits.halfY),
  };
}

/** Drag by a pixel distance measured in poster pixels. */
export function panShot(shot, rect, dxPx, dyPx) {
  const framing = resolveFraming(shot, rect);
  const scale = coverScale(shot, rect) * shot.zoom;
  shot.focusX = framing.focusX - dxPx / (shot.image.naturalWidth * scale);
  shot.focusY = framing.focusY - dyPx / (shot.image.naturalHeight * scale);
  Object.assign(shot, resolveFraming(shot, rect));
}

/** Zoom about a point of the panel (poster pixels), so the spot under the cursor stays put. */
export function zoomShot(shot, rect, factor, atX = rect.x + rect.w / 2, atY = rect.y + rect.h / 2) {
  const before = resolveFraming(shot, rect);
  const next = clamp(shot.zoom * factor, 1, MAX_ZOOM);
  if (next === shot.zoom) return;
  const scaleBefore = coverScale(shot, rect) * shot.zoom;
  const scaleAfter = coverScale(shot, rect) * next;
  const offsetX = (atX - (rect.x + rect.w / 2)) / (shot.image.naturalWidth * scaleBefore);
  const offsetY = (atY - (rect.y + rect.h / 2)) / (shot.image.naturalHeight * scaleBefore);
  shot.zoom = next;
  shot.focusX = before.focusX + offsetX - (offsetX * scaleBefore) / scaleAfter;
  shot.focusY = before.focusY + offsetY - (offsetY * scaleBefore) / scaleAfter;
  Object.assign(shot, resolveFraming(shot, rect));
}

export function resetShot(shot) {
  shot.zoom = 1;
  shot.focusX = 0.5;
  shot.focusY = 0.5;
}

/** The panel a point of the poster falls in, or null. */
export function panelAt(panels, x, y) {
  return panels.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) ?? null;
}

function drawPhotoCover(ctx, rect, shot, filter = 'none') {
  const framing = resolveFraming(shot, rect);
  const { naturalWidth: iw, naturalHeight: ih } = shot.image;
  const scale = coverScale(shot, rect) * framing.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const x = rect.x + rect.w / 2 - framing.focusX * dw;
  const y = rect.y + rect.h / 2 - framing.focusY * dh;
  ctx.save();
  ctx.filter = filter;
  if (shot.flip) {
    // Mirrored about the panel's own centre: the same frame, looking the other way.
    const mid = rect.x + rect.w / 2;
    ctx.translate(mid, 0);
    ctx.scale(-1, 1);
    ctx.translate(-mid, 0);
  }
  ctx.drawImage(shot.image, x, y, dw, dh);
  ctx.restore();
}

/** Violet shadows and ember highlights, so a daylight or a blue photo joins the same sunset. */
function paintSunsetGrade(ctx, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.7;
  const duo = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.5, rect.y + rect.h);
  duo.addColorStop(0, 'rgba(88,26,170,0.55)');
  duo.addColorStop(0.45, 'rgba(196,60,140,0.4)');
  duo.addColorStop(0.78, 'rgba(255,112,52,0.5)');
  duo.addColorStop(1, 'rgba(255,178,84,0.55)');
  ctx.fillStyle = duo;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Cool the deep shadows back down; without this the grade flattens the whole frame.
  ctx.globalAlpha = 0.34;
  const shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.35, 0, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(20,10,60,0)');
  shade.addColorStop(1, 'rgba(24,6,58,0.85)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.restore();
}

/**
 * Draws one panel: the photo graded into the sunset, a halftone screen, grain, a vignette and the neon rim
 * that picks the panel's edge out of the sky.
 */
export function drawPhotoPanel(ctx, rect, shot, index = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  drawPhotoCover(ctx, rect, shot, 'contrast(1.22) saturate(1.14) brightness(0.97)');
  paintSunsetGrade(ctx, rect);

  // The photo over itself: overlay keeps the grade's hue but puts the blacks back and lifts the highlights.
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.32;
  drawPhotoCover(ctx, rect, shot);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  const [sx, sy] = PANEL_SUN[index % PANEL_SUN.length];
  paintSunBloom(ctx, rect.x + rect.w * sx, rect.y + rect.h * sy, Math.max(rect.w, rect.h) * 0.9, 'rgba(255,168,96,0.3)');

  paintHalftone(ctx, rect, Math.max(rect.w, rect.h) * 0.0045, 0.07);
  paintVignette(ctx, rect, 0.55);
  paintGrain(ctx, rect, 0.05);

  paintNeonRim(ctx, rect, index % 2 === 0 ? 'right' : 'left', index % 2 === 0 ? 'rgba(255,70,160,0.75)' : 'rgba(90,225,255,0.6)', 0.4, 0.16);
  paintNeonRim(ctx, rect, 'top', 'rgba(255,225,190,0.55)', 0.26, 0.08);
  ctx.restore();
}

/** An empty panel: sky showing through, with a print-screen texture, for a poster still being filled. */
export function drawEmptyPanel(ctx, rect, label) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, 'rgba(52,14,66,0.95)');
  g.addColorStop(1, 'rgba(20,6,32,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  paintHalftone(ctx, rect, Math.max(rect.w, rect.h) * 0.016, 0.2);
  ctx.fillStyle = 'rgba(255,205,235,0.45)';
  ctx.font = `600 ${Math.round(Math.min(rect.w, rect.h) * 0.12)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}