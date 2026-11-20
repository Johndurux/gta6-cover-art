// photoPanels.js — one photo inside one cut-out: the framing state (zoom, the point of the photo held in the
// middle, the mirror), the clamp that keeps the image covering its shape while it is dragged or zoomed, and the
// plain draw whose pixels the comic pass reads.

import { paintHalftone } from './texture.js';

const MAX_ZOOM = 3;

/** A photo placed in a cut-out: the image plus where the user has dragged and zoomed it. */
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

/** The largest focus offset that still keeps the photo covering the cut-out, per axis. */
function focusLimits(shot, rect) {
  const scale = coverScale(shot, rect) * shot.zoom;
  const halfX = rect.w / 2 / (shot.image.naturalWidth * scale);
  const halfY = rect.h / 2 / (shot.image.naturalHeight * scale);
  return { halfX: Math.min(halfX, 0.5), halfY: Math.min(halfY, 0.5) };
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** The framing the cut-out will actually draw with: focus pulled back inside the photo's edges. */
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

/** Zoom about a point of the cut-out (poster pixels), so the spot under the cursor stays put. */
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

/** Draws the photo covering `rect`, honouring the shot's zoom, focus point and mirror. */
export function drawPhotoCover(ctx, rect, shot) {
  const framing = resolveFraming(shot, rect);
  const { naturalWidth: iw, naturalHeight: ih } = shot.image;
  const scale = coverScale(shot, rect) * framing.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const x = rect.x + rect.w / 2 - framing.focusX * dw;
  const y = rect.y + rect.h / 2 - framing.focusY * dh;
  ctx.save();
  if (shot.flip) {
    // Mirrored about the cut-out's own centre: the same frame, looking the other way.
    const mid = rect.x + rect.w / 2;
    ctx.translate(mid, 0);
    ctx.scale(-1, 1);
    ctx.translate(-mid, 0);
  }
  ctx.drawImage(shot.image, x, y, dw, dh);
  ctx.restore();
}

/** An empty cut-out: sky showing through with a print screen, for a poster still being filled. */
export function drawEmptyCutout(ctx, rect, label) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, 'rgba(74,20,86,1)');
  g.addColorStop(1, 'rgba(26,8,40,1)');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  paintHalftone(ctx, rect, Math.max(6, Math.max(rect.w, rect.h) * 0.018), 0.22);
  ctx.fillStyle = 'rgba(255,205,235,0.5)';
  ctx.font = `700 ${Math.round(Math.min(rect.w, rect.h) * 0.09)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}