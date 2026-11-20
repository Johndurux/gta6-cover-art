// lettering.js — the words on the poster: the Anton title lockup on the logo band (skewed, outlined, magenta
// plate behind it), the subtitle under it and the credit strip's two legal rows. It also owns the glyph-by-glyph
// draw that gives tracked letter spacing, and the wait for the display face before the first paint.

import { paintGrain, paintHalftone } from './texture.js';

export const DISPLAY_FONT = 'Anton';
export const UI_FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The title leans six degrees, like a sticker slapped on at speed. */
const TITLE_SKEW = -Math.tan((6 * Math.PI) / 180);

/** Resolves once the display face is usable on a canvas, so the first frame is not drawn in a fallback. */
export async function ensureDisplayFont() {
  if (!document.fonts) return false;
  try {
    await document.fonts.load(`64px ${DISPLAY_FONT}`);
    await document.fonts.ready;
    return document.fonts.check(`64px ${DISPLAY_FONT}`);
  } catch {
    return false;
  }
}

/** Width of `text` set with letter tracking, in pixels. Tracking is a fraction of the font size. */
export function measureTracked(ctx, text, font, tracking) {
  ctx.font = font;
  const size = Number(font.match(/([\d.]+)px/)?.[1] ?? 16);
  const chars = [...text];
  if (!chars.length) return 0;
  const widths = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0);
  return widths + tracking * size * (chars.length - 1);
}

/** Draws text glyph by glyph, so the letters can be tracked, stroked and filled with any paint. */
export function drawTracked(ctx, text, x, baselineY, options) {
  const { font, tracking = 0.02, align = 'center', fill = '#fff', stroke = null, strokeWidth = 0, shadow = null } = options;
  ctx.font = font;
  const size = Number(font.match(/([\d.]+)px/)?.[1] ?? 16);
  const chars = [...text];
  if (!chars.length) return 0;
  const gap = tracking * size;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;

  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  if (shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetY = shadow.offsetY ?? 0;
  }
  chars.forEach((ch, i) => {
    if (stroke && strokeWidth > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(ch, cursor, baselineY);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillText(ch, cursor, baselineY);
    }
    cursor += widths[i] + gap;
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.textAlign = previousAlign;
  return total;
}

/** Largest size at which `text` fits `maxWidth` at the given tracking. */
export function fitDisplaySize(ctx, text, maxWidth, maxSize, tracking) {
  let size = maxSize;
  while (size > 8) {
    const width = measureTracked(ctx, text, `${size}px ${DISPLAY_FONT}`, tracking);
    if (width <= maxWidth) return size;
    size *= 0.96;
  }
  return size;
}

/** Cap height of a line, measured from the glyphs themselves rather than guessed from the font metrics. */
function capHeight(ctx, text, font) {
  ctx.font = font;
  const metrics = ctx.measureText(text || 'H');
  return metrics.actualBoundingBoxAscent || 0.72 * Number(font.match(/([\d.]+)px/)?.[1] ?? 16);
}

/**
 * The logo band across the foot: a sunset strip, a black rule along its top, the title skewed over it, the subtitle
 * tracked out in gold beneath, and a soft magenta glow behind the whole lockup.
 */
export function drawLogoBand(ctx, layout, scene) {
  const { band, unit } = layout;
  const title = (scene.title || 'UNTITLED').trim().toUpperCase();
  const subtitle = (scene.subtitle || '').trim().toUpperCase();

  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();

  // The sunset strip the logo sits on: plum at the top, ember at the bottom.
  const bg = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  bg.addColorStop(0, '#2a0836');
  bg.addColorStop(0.3, '#67124c');
  bg.addColorStop(0.62, '#b52a45');
  bg.addColorStop(0.85, '#e85a34');
  bg.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = bg;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  paintHalftone(ctx, band, unit * 0.006, 0.16);
  paintGrain(ctx, band, 0.08);

  // Light behind the title, so white lettering has something to sit against.
  const glow = ctx.createRadialGradient(band.x + band.w * 0.5, band.y + band.h * 0.42, 0, band.x + band.w * 0.5, band.y + band.h * 0.42, band.w * 0.62);
  glow.addColorStop(0, 'rgba(255, 216, 150, 0.34)');
  glow.addColorStop(1, 'rgba(255, 120, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  // The heavy black rule that separates the logo from the artwork, with a neon hairline over it.
  ctx.fillStyle = '#0a0312';
  ctx.fillRect(band.x, band.y, band.w, unit * 0.012);
  const trim = ctx.createLinearGradient(band.x, 0, band.x + band.w, 0);
  trim.addColorStop(0, '#46e0ff');
  trim.addColorStop(0.5, '#ff3d9a');
  trim.addColorStop(1, '#ffc247');
  ctx.fillStyle = trim;
  ctx.fillRect(band.x, band.y - unit * 0.0035, band.w, unit * 0.0035);

  const tracking = 0.015;
  const maxWidth = band.w * 0.86;
  const size = fitDisplaySize(ctx, title, maxWidth, band.h * 0.46, tracking);
  const font = `${size}px ${DISPLAY_FONT}`;
  const cap = capHeight(ctx, title, font);
  const titleBaseline = band.y + band.h * 0.5 + cap * 0.1;

  // Skewed about the title's own baseline, so the lean grows upwards out of the band.
  ctx.save();
  ctx.translate(band.x + band.w / 2, titleBaseline);
  ctx.transform(1, 0, TITLE_SKEW, 1, 0, 0);

  // The magenta offset plate, then the black outline, then the white letterform: the three-layer print.
  drawTracked(ctx, title, 0, size * 0.055, {
    font,
    tracking,
    fill: '#ff2d95',
    stroke: '#ff2d95',
    strokeWidth: size * 0.05,
  });
  drawTracked(ctx, title, 0, 0, {
    font,
    tracking,
    fill: null,
    stroke: '#0a0312',
    strokeWidth: Math.max(6, size * 0.13),
  });
  const white = ctx.createLinearGradient(0, -cap, 0, 0);
  white.addColorStop(0, '#ffffff');
  white.addColorStop(0.62, '#fff4fb');
  white.addColorStop(1, '#ffd9ec');
  drawTracked(ctx, title, 0, 0, { font, tracking, fill: white });
  ctx.restore();

  if (subtitle) {
    const subSize = Math.max(11, band.h * 0.082);
    const subFont = `800 ${subSize}px ${UI_FONT}`;
    const subTracking = 0.28;
    const width = measureTracked(ctx, subtitle, subFont, subTracking);
    const subY = Math.min(band.y + band.h * 0.78, titleBaseline + subSize * 2.1);
    const scale = Math.min(1, (band.w * 0.8) / Math.max(width, 1));
    ctx.save();
    ctx.translate(band.x + band.w / 2, subY);
    ctx.scale(scale, 1);
    drawTracked(ctx, subtitle, 0, 0, {
      font: subFont,
      tracking: subTracking,
      fill: '#ffe6a8',
      stroke: 'rgba(10,3,18,0.85)',
      strokeWidth: subSize * 0.34,
    });
    ctx.restore();
  }

  ctx.restore();
}

/** The foot strip: the editable credit line, two filler legal lines, and a neon rule along its top. */
export function drawCreditsStrip(ctx, rect, scene, unit) {
  ctx.save();
  const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  bg.addColorStop(0, '#140520');
  bg.addColorStop(1, '#06010c');
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const rule = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  rule.addColorStop(0, 'rgba(70,224,255,0.8)');
  rule.addColorStop(0.45, 'rgba(255,61,154,0.9)');
  rule.addColorStop(1, 'rgba(255,194,71,0.8)');
  ctx.fillStyle = rule;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(1, unit * 0.0016));

  const credit = (scene.credit || '').trim().toUpperCase();
  const legal = 'ALL PERSONS AND EVENTS IN THIS WORK ARE FICTIONAL · PHOTOS SUPPLIED BY THE MAKER · NOT AFFILIATED WITH ANY GAME PUBLISHER';
  const rowA = Math.max(9, rect.h * 0.3);
  const rowB = Math.max(8, rect.h * 0.2);
  const baselineA = rect.y + rect.h * 0.42;
  const baselineB = rect.y + rect.h * 0.82;
  const margin = rect.x + rect.w * 0.025;
  const inner = rect.w * 0.95;

  const fitRow = (text, weight, baseSize, tracking) => {
    let size = baseSize;
    let space = tracking;
    while (measureTracked(ctx, text, `${weight} ${size}px ${UI_FONT}`, space) > inner && size > 5) {
      size *= 0.94;
      space *= 0.96;
    }
    return { font: `${weight} ${size}px ${UI_FONT}`, tracking: space };
  };

  if (credit) {
    const row = fitRow(credit, 700, rowA, 0.14);
    drawTracked(ctx, credit, margin, baselineA, { ...row, align: 'left', fill: 'rgba(255,241,250,0.92)' });
  }
  const small = fitRow(legal, 600, rowB, 0.1);
  drawTracked(ctx, legal, margin, baselineB, { ...small, align: 'left', fill: 'rgba(255,170,210,0.62)' });
  ctx.restore();
}