// poster.js — the composition itself: where the six panels sit on a poster of any size, the sky behind them,
// the banner band across the top and the credits strip along the foot. drawPoster is the single entry point the
// preview, the export and the screenshots all go through, so what you see is exactly what is written out.

import { INK, paintGrain, paintHalftone, paintSkyWash, paintSunBloom, paintVignette } from './texture.js';
import { drawEmptyPanel, drawPhotoPanel } from './photoPanels.js';
import { drawBannerLockup, drawCreditsStrip } from './lettering.js';

/** The three post sizes the app writes, at their exact pixel sizes. */
export const POSTER_SIZES = [
  { id: '1080x1080', width: 1080, height: 1080, label: 'Square', ratio: '1 : 1' },
  { id: '1080x1350', width: 1080, height: 1350, label: 'Portrait', ratio: '4 : 5' },
  { id: '1920x1080', width: 1920, height: 1080, label: 'Wide', ratio: '16 : 9' },
];

/** The order panels fill in, and the names the editor shows for them. */
export const PANEL_NAMES = ['Main', 'Right top', 'Right low', 'Strip 1', 'Strip 2', 'Strip 3'];

/**
 * Lays the poster out for a given size: a banner band, a body of six panels (one large main panel, two stacked
 * beside it, three across the foot) and a credits strip. All lengths come off the short side, so every size
 * keeps the same proportions and the same gutters.
 */
export function posterLayout(w, h) {
  const unit = Math.min(w, h);
  const wide = w > h * 1.1;
  const bannerH = Math.round(h * (wide ? 0.17 : 0.125));
  const creditsH = Math.round(h * (wide ? 0.058 : 0.046));
  const margin = Math.round(unit * 0.028);
  const gutter = Math.round(unit * 0.014);
  const edge = Math.round(unit * 0.011);

  const banner = { x: 0, y: 0, w, h: bannerH };
  const credits = { x: 0, y: h - creditsH, w, h: creditsH };
  const bodyTop = bannerH + edge;
  const bodyBottom = h - creditsH - edge;
  const body = { x: margin, y: bodyTop, w: w - margin * 2, h: bodyBottom - bodyTop };

  const rightW = Math.round(body.w * 0.33);
  const mainW = body.w - rightW - gutter;
  const topRowH = Math.round(body.h * (wide ? 0.63 : 0.655));
  const rightTopH = Math.round((topRowH - gutter) * 0.55);
  const stripY = body.y + topRowH + gutter;
  const stripH = body.h - topRowH - gutter;
  const stripW = Math.round((body.w - gutter * 2) / 3);

  const panels = [
    { id: 'main', x: body.x, y: body.y, w: mainW, h: topRowH },
    { id: 'rightTop', x: body.x + mainW + gutter, y: body.y, w: rightW, h: rightTopH },
    { id: 'rightLow', x: body.x + mainW + gutter, y: body.y + rightTopH + gutter, w: rightW, h: topRowH - rightTopH - gutter },
    { id: 'strip1', x: body.x, y: stripY, w: stripW, h: stripH },
    { id: 'strip2', x: body.x + stripW + gutter, y: stripY, w: stripW, h: stripH },
    { id: 'strip3', x: body.x + (stripW + gutter) * 2, y: stripY, w: body.w - (stripW + gutter) * 2, h: stripH },
  ].map((panel, index) => ({ ...panel, index, name: PANEL_NAMES[index] }));

  return { width: w, height: h, unit, banner, body, credits, panels, gutter };
}

/** The banner band: a night-to-magenta wash, a bloom behind the title, and a neon rule along its foot. */
function drawBannerBand(ctx, rect, scene, unit) {
  const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  bg.addColorStop(0, '#0a0311');
  bg.addColorStop(0.42, '#2a0a33');
  bg.addColorStop(0.82, '#561046');
  bg.addColorStop(1, '#7d1a4e');
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  paintSunBloom(ctx, rect.x + rect.w * 0.26, rect.y + rect.h * 1.06, rect.h * 2, 'rgba(255,120,90,0.55)');
  paintHalftone(ctx, rect, unit * 0.011, 0.09);
  paintGrain(ctx, rect, 0.075);

  // Hairline gold at the very top, like the trim on a record sleeve.
  const trim = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  trim.addColorStop(0, 'rgba(255,209,102,0)');
  trim.addColorStop(0.3, 'rgba(255,209,102,0.75)');
  trim.addColorStop(0.7, 'rgba(255,209,102,0.75)');
  trim.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = trim;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(1, unit * 0.0018));

  // The neon rule that separates the banner from the artwork, with its own glow.
  ctx.save();
  ctx.shadowColor = 'rgba(255,60,150,0.9)';
  ctx.shadowBlur = unit * 0.022;
  const rule = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  rule.addColorStop(0, '#5ae1ff');
  rule.addColorStop(0.5, '#ff469c');
  rule.addColorStop(1, '#ffd166');
  ctx.fillStyle = rule;
  ctx.fillRect(rect.x, rect.y + rect.h - unit * 0.004, rect.w, unit * 0.004);
  ctx.restore();

  drawBannerLockup(ctx, { x: rect.x, y: rect.y + rect.h * 0.02, w: rect.w, h: rect.h * 0.9 }, scene);
}

/**
 * Draws the whole cover at `w` by `h`: sky, six panels, vignette, banner lockup and credits. `scene` carries
 * the caption text and one shot (or nothing) per panel id.
 */
export function drawPoster(ctx, w, h, scene) {
  const layout = posterLayout(w, h);
  const unit = layout.unit;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  paintSkyWash(ctx, { x: 0, y: 0, w, h });
  paintSunBloom(ctx, w * 0.78, layout.banner.h * 0.9, w * 0.42, 'rgba(255,150,120,0.45)');

  for (const panel of layout.panels) {
    const shot = scene.shots?.[panel.id];
    if (shot?.image) drawPhotoPanel(ctx, panel, shot, panel.index);
    else drawEmptyPanel(ctx, panel, `PANEL ${panel.index + 1}`);
    ctx.save();
    ctx.strokeStyle = 'rgba(8,2,14,0.9)';
    ctx.lineWidth = Math.max(2, unit * 0.0035);
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.restore();
  }

  paintHalftone(ctx, { x: 0, y: 0, w, h }, unit * 0.0038, 0.03);
  paintVignette(ctx, { x: 0, y: 0, w, h }, 0.5);

  drawBannerBand(ctx, layout.banner, scene, unit);
  drawCreditsStrip(ctx, layout.credits, scene, unit);
  ctx.restore();
  return layout;
}