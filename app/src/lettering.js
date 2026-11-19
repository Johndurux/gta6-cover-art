// lettering.js — the words on the poster: the banner lockup at the top (title in Anton, subtitle tracked out
// under it) and the credits strip along the foot. The title is set one glyph at a time so the tracking is
// exact, the glow is tight and the line can be fitted to any poster width.

export const DISPLAY_FONT = 'Anton';
export const UI_FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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

/** Draws text glyph by glyph, so the letters can be tracked, stroked and filled with a gradient. */
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
 * The banner lockup: an eyebrow rule, the title fat and white with a magenta glow and a dark edge, then the
 * subtitle tracked out in gold. Returns the baseline the title was set on, for the editor to line things up.
 */
export function drawBannerLockup(ctx, rect, scene) {
  const title = (scene.title || 'UNTITLED').trim().toUpperCase();
  const subtitle = (scene.subtitle || '').trim().toUpperCase();
  const ruleGap = rect.h * 0.1;

  const tracking = 0.035;
  const size = fitDisplaySize(ctx, title, rect.w * 0.86, rect.h * 0.82, tracking);
  const font = `${size}px ${DISPLAY_FONT}`;
  const cap = capHeight(ctx, title, font);

  const subtitleSize = Math.max(10, rect.h * 0.16);
  const subtitleFont = `600 ${subtitleSize}px ${UI_FONT}`;
  const subtitleCap = subtitle ? capHeight(ctx, subtitle, subtitleFont) : 0;
  const subtitleGap = subtitle ? subtitleSize * 0.72 : 0;

  const blockHeight = cap + subtitleGap + subtitleCap;
  const blockTop = rect.y + (rect.h - blockHeight) / 2 + rect.h * 0.02;
  const titleBaseline = blockTop + cap;

  // A white-hot core with a cold top edge, the way a backlit sign reads.
  const fill = ctx.createLinearGradient(0, titleBaseline - cap, 0, titleBaseline);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffe9f6');
  fill.addColorStop(1, '#ffb9dd');

  drawTracked(ctx, title, rect.x + rect.w / 2, titleBaseline, {
    font,
    tracking,
    fill,
    stroke: 'rgba(26,2,24,0.75)',
    strokeWidth: size * 0.055,
  });
  drawTracked(ctx, title, rect.x + rect.w / 2, titleBaseline, {
    font,
    tracking,
    fill: null,
    shadow: { color: 'rgba(255,52,150,0.55)', blur: size * 0.34, offsetY: size * 0.05 },
  });

  if (subtitle) {
    const gold = ctx.createLinearGradient(0, titleBaseline + subtitleGap, 0, titleBaseline + subtitleGap + subtitleCap);
    gold.addColorStop(0, '#ffe6a3');
    gold.addColorStop(1, '#ffb13d');
    const subtitleTracking = 0.34;
    const subtitleWidth = measureTracked(ctx, subtitle, subtitleFont, subtitleTracking);
    const subtitleY = titleBaseline + subtitleGap + subtitleCap;
    drawTracked(ctx, subtitle, rect.x + rect.w / 2, subtitleY, {
      font: subtitleFont,
      tracking: subtitleTracking,
      fill: gold,
      shadow: { color: 'rgba(20,0,20,0.8)', blur: subtitleSize * 0.4 },
    });
    // Hairlines off both ends of the subtitle hold the lockup together.
    const lineY = subtitleY - subtitleCap * 0.42;
    const lineWidth = Math.min(rect.w * 0.16, (rect.w - subtitleWidth) / 2 - subtitleSize);
    if (lineWidth > 8) {
      const g = ctx.createLinearGradient(rect.x + rect.w / 2 - subtitleWidth / 2 - lineWidth, 0, rect.x + rect.w / 2 - subtitleWidth / 2, 0);
      g.addColorStop(0, 'rgba(255,209,102,0)');
      g.addColorStop(1, 'rgba(255,209,102,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x + rect.w / 2 - subtitleWidth / 2 - lineWidth - ruleGap, lineY, lineWidth, Math.max(1, rect.h * 0.008));
      ctx.save();
      ctx.translate(rect.x + rect.w / 2 + subtitleWidth / 2 + lineWidth + ruleGap, 0);
      ctx.scale(-1, 1);
      ctx.fillStyle = g;
      ctx.fillRect(0, lineY, lineWidth, Math.max(1, rect.h * 0.008));
      ctx.restore();
    }
  }
  return titleBaseline;
}

/** The foot strip: the editable credit line in the middle, tiny labels at either end, a neon rule above. */
export function drawCreditsStrip(ctx, rect, scene, unit) {
  ctx.save();
  const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  bg.addColorStop(0, '#12051c');
  bg.addColorStop(1, '#07020c');
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const rule = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  rule.addColorStop(0, 'rgba(90,225,255,0.85)');
  rule.addColorStop(0.45, 'rgba(255,70,160,0.9)');
  rule.addColorStop(1, 'rgba(255,209,102,0.85)');
  ctx.fillStyle = rule;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(1.5, unit * 0.0022));

  const creditSize = Math.max(8, rect.h * 0.3);
  const creditText = (scene.credit || '').trim().toUpperCase();
  const font = `600 ${creditSize}px ${UI_FONT}`;
  const baseline = rect.y + rect.h * 0.62;

  if (creditText) {
    let tracking = 0.16;
    let size = creditSize;
    while (measureTracked(ctx, creditText, `600 ${size}px ${UI_FONT}`, tracking) > rect.w * 0.62 && size > 6) {
      size *= 0.9;
      tracking *= 0.95;
    }
    drawTracked(ctx, creditText, rect.x + rect.w / 2, baseline, {
      font: `600 ${size}px ${UI_FONT}`,
      tracking,
      fill: 'rgba(255,232,246,0.82)',
    });
  }

  const labelSize = Math.max(7, rect.h * 0.22);
  drawTracked(ctx, 'VICE POSTER · NO. 01', rect.x + rect.w * 0.02, baseline, {
    font: `700 ${labelSize}px ${UI_FONT}`,
    tracking: 0.2,
    align: 'left',
    fill: 'rgba(255,148,200,0.62)',
  });
  drawTracked(ctx, 'MADE FROM YOUR OWN PHOTOS', rect.x + rect.w * 0.98, baseline, {
    font: `700 ${labelSize}px ${UI_FONT}`,
    tracking: 0.2,
    align: 'right',
    fill: 'rgba(255,148,200,0.62)',
  });
  ctx.restore();
}