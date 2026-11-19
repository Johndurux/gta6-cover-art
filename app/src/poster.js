// poster.js — the composition: a sunset sky, five sticker cut-outs layered over it, a logo band across the
// foot and a credit strip under that. Every length comes off the short side, so the square, the portrait and the
// wide cover are the same poster at three shapes. drawPoster is the one entry point the preview, the export and
// the demo screenshots all go through.

import { INK, paintGrain, paintHalftone, paintSkyWash, paintSunBloom, paintVignette, seeded } from './texture.js';
import { drawEmptyCutout, drawPhotoCover } from './photoPanels.js';
import { comicCanvas } from './comic.js';
import { paintCutout } from './cutout.js';
import { drawCreditsStrip, drawLogoBand } from './lettering.js';

/** The three post sizes the app writes, at their exact pixel sizes. */
export const POSTER_SIZES = [
  { id: '1080x1080', width: 1080, height: 1080, label: 'Square', ratio: '1 : 1' },
  { id: '1080x1350', width: 1080, height: 1350, label: 'Portrait', ratio: '4 : 5' },
  { id: '1920x1080', width: 1920, height: 1080, label: 'Wide', ratio: '16 : 9' },
];

export const SLOT_NAMES = ['Hero', 'Left top', 'Right top', 'Right low', 'Left low', 'Band sticker'];

/**
 * Where the five cut-outs sit, as fractions of the poster: one big hero, a stack of smaller ones that overlap it
 * and each other, and a last sticker sat on the logo band. `rot` is in degrees; a cut-out's print wobble is seeded
 * off `seed` so it never shifts between paints.
 */
const SLOT_PLANS = {
  portrait: [
    { id: 'hero', cx: 0.34, cy: 0.375, w: 0.615, h: 0.6, rot: -2.5, seed: 11 },
    { id: 'leftTop', cx: 0.14, cy: 0.125, w: 0.25, h: 0.115, rot: -6, seed: 83 },
    { id: 'rightTop', cx: 0.755, cy: 0.17, w: 0.31, h: 0.165, rot: 6, seed: 23 },
    { id: 'rightLow', cx: 0.775, cy: 0.43, w: 0.34, h: 0.2, rot: -5, seed: 37 },
    { id: 'leftLow', cx: 0.17, cy: 0.645, w: 0.27, h: 0.135, rot: -4, seed: 51 },
    { id: 'bandSticker', cx: 0.865, cy: 0.78, w: 0.215, h: 0.105, rot: 6, seed: 67 },
  ],
  wide: [
    { id: 'hero', cx: 0.4, cy: 0.37, w: 0.36, h: 0.7, rot: 2, seed: 11 },
    { id: 'leftTop', cx: 0.12, cy: 0.17, w: 0.145, h: 0.25, rot: -6, seed: 83 },
    { id: 'rightTop', cx: 0.6, cy: 0.22, w: 0.185, h: 0.26, rot: 5, seed: 23 },
    { id: 'rightLow', cx: 0.63, cy: 0.55, w: 0.17, h: 0.27, rot: -6, seed: 37 },
    { id: 'leftLow', cx: 0.145, cy: 0.55, w: 0.17, h: 0.27, rot: -5, seed: 51 },
    { id: 'bandSticker', cx: 0.875, cy: 0.5, w: 0.14, h: 0.24, rot: 7, seed: 67 },
  ],
  square: [
    { id: 'hero', cx: 0.42, cy: 0.36, w: 0.52, h: 0.62, rot: -2, seed: 11 },
    { id: 'leftTop', cx: 0.15, cy: 0.14, w: 0.26, h: 0.13, rot: -6, seed: 83 },
    { id: 'rightTop', cx: 0.735, cy: 0.2, w: 0.31, h: 0.21, rot: 6, seed: 23 },
    { id: 'rightLow', cx: 0.75, cy: 0.47, w: 0.33, h: 0.24, rot: -5, seed: 37 },
    { id: 'leftLow', cx: 0.15, cy: 0.67, w: 0.26, h: 0.145, rot: -4, seed: 51 },
    { id: 'bandSticker', cx: 0.855, cy: 0.75, w: 0.2, h: 0.13, rot: 6, seed: 67 },
  ],
};

function aspectOf(w, h) {
  if (w > h * 1.2) return 'wide';
  if (h > w * 1.1) return 'portrait';
  return 'square';
}

/**
 * The poster's frame: the logo band along the foot, the credit strip inside its bottom edge, the sky above them,
 * and the five cut-outs placed. `unit` is the short side, the length every other measurement is a fraction of.
 */
export function coverLayout(w, h) {
  const aspect = aspectOf(w, h);
  const unit = Math.min(w, h);
  const bandH = Math.round(h * (aspect === 'wide' ? 0.335 : aspect === 'portrait' ? 0.3 : 0.28));
  const creditsH = Math.round(Math.min(bandH * 0.27, h * 0.062));
  const band = { x: 0, y: h - bandH, w, h: bandH };
  const credits = { x: 0, y: h - creditsH, w, h: creditsH };

  const slots = SLOT_PLANS[aspect].map((slot, index) => ({
    ...slot,
    index,
    name: SLOT_NAMES[index],
    w: Math.round(slot.w * (aspect === 'wide' ? w : unit)),
    h: Math.round(slot.h * (aspect === 'wide' ? h : h)),
  }));

  return { width: w, height: h, unit, aspect, band, credits, slots, gutter: unit * 0.02 };
}

/** The slots with the user's drags applied, in poster pixels, ready to draw or hit-test. */
export function placedSlots(layout, scene) {
  return layout.slots.map((slot) => {
    const offset = scene.offsets?.[slot.id] ?? { x: 0, y: 0 };
    return {
      ...slot,
      cx: slot.cx * layout.width + offset.x * layout.unit,
      cy: slot.cy * layout.height + offset.y * layout.unit,
    };
  });
}

/** The cut-out under a point of the poster, topmost first, or null. */
export function pickSlot(layout, scene, x, y) {
  const slots = placedSlots(layout, scene);
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const slot = slots[i];
    const angle = (-slot.rot * Math.PI) / 180;
    const dx = x - slot.cx;
    const dy = y - slot.cy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(lx) <= slot.w / 2 && Math.abs(ly) <= slot.h / 2) return slot;
  }
  return null;
}

/** The box a slot occupies, in poster pixels — what the photo is framed into. */
export function slotBox(slot) {
  return { x: slot.cx - slot.w / 2, y: slot.cy - slot.h / 2, w: slot.w, h: slot.h };
}

/** A synthwave sun: a hot disc with slats taken out of its lower half, sitting on the horizon. */
function paintSun(ctx, cx, cy, radius) {
  const disc = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
  disc.addColorStop(0, '#fff3c4');
  disc.addColorStop(0.4, '#ffcf6b');
  disc.addColorStop(0.75, '#ff6b6b');
  disc.addColorStop(1, '#d92b6b');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.shadowColor = 'rgba(255,110,90,0.7)';
  ctx.shadowBlur = radius * 0.8;
  ctx.fill();
  ctx.restore();

  // Slats: widen towards the bottom of the disc, the way a retro sun is printed.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(46, 8, 42, 0.92)';
  for (let i = 0; i < 7; i += 1) {
    const t = i / 7;
    const y = cy + radius * (0.08 + t * 0.9);
    const thickness = radius * (0.012 + t * 0.05);
    ctx.fillRect(cx - radius, y, radius * 2, thickness);
  }
  ctx.restore();
}

/** A distant skyline: a seeded run of blocks and towers just above the band, so the sky has a city in it. */
function paintSkyline(ctx, rect, unit, seed = 7) {
  const random = seeded(seed);
  const baseline = rect.y + rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(28, 6, 44, 0.92)';
  let x = rect.x - 20;
  while (x < rect.x + rect.w + 20) {
    const width = unit * (0.01 + random() * 0.038);
    const height = unit * (0.015 + random() * 0.075);
    ctx.fillRect(x, baseline - height, width, height);
    if (random() > 0.78) {
      ctx.fillRect(x + width * 0.42, baseline - height - unit * 0.024, width * 0.1, unit * 0.028);
    }
    // A gap between blocks, so the skyline reads as a city rather than a black bar.
    x += width + unit * (0.006 + random() * 0.03);
  }
  ctx.restore();
}

/** The sky behind everything: sunset wash, sun, city, a print screen and the stars above the horizon. */
function paintSky(ctx, layout) {
  const { width: w, height: h, unit, band } = layout;
  paintSkyWash(ctx, { x: 0, y: 0, w, h });
  paintSunBloom(ctx, w * 0.3, band.y * 0.86, w * 0.52, 'rgba(255,150,110,0.5)');
  paintSun(ctx, w * 0.29, band.y * 0.62, w * 0.16);
  paintSkyline(ctx, { x: 0, y: band.y - unit * 0.12, w, h: unit * 0.125 }, unit);
  paintHalftone(ctx, { x: 0, y: 0, w, h }, unit * 0.0042, 0.05);

  // Stars, sparse, only in the top third where the sky is still night.
  const random = seeded(91);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 232, 246, 0.75)';
  for (let i = 0; i < 60; i += 1) {
    const x = random() * w;
    const y = random() * h * 0.42;
    const r = unit * (0.0012 + random() * 0.0022);
    ctx.globalAlpha = 0.25 + random() * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The chosen cut-out wears a dashed neon rim, four corner grips and a name tag, so it reads as picked. */
function paintSelection(ctx, slot, unit) {
  ctx.save();
  ctx.translate(slot.cx, slot.cy);
  ctx.rotate((slot.rot * Math.PI) / 180);
  const x = -slot.w / 2;
  const y = -slot.h / 2;
  const grip = Math.max(5, unit * 0.011);

  ctx.lineWidth = Math.max(2, unit * 0.0032);
  ctx.strokeStyle = 'rgba(70, 224, 255, 0.95)';
  ctx.setLineDash([unit * 0.018, unit * 0.012]);
  ctx.strokeRect(x - grip * 0.6, y - grip * 0.6, slot.w + grip * 1.2, slot.h + grip * 1.2);
  ctx.setLineDash([]);

  ctx.fillStyle = '#46e0ff';
  for (const [gx, gy] of [[x, y], [x + slot.w, y], [x, y + slot.h], [x + slot.w, y + slot.h]]) {
    ctx.fillRect(gx - grip / 2, gy - grip / 2, grip, grip);
  }

  const label = `${slot.index + 1}  ${slot.name.toUpperCase()}`;
  ctx.font = `700 ${Math.round(unit * 0.019)}px ui-sans-serif, system-ui, sans-serif`;
  const textWidth = ctx.measureText(label).width;
  const padX = unit * 0.012;
  const boxH = unit * 0.036;
  ctx.fillStyle = 'rgba(12, 3, 22, 0.9)';
  ctx.fillRect(x, y - boxH - grip * 0.9, textWidth + padX * 2, boxH);
  ctx.fillStyle = '#ff6ab8';
  ctx.fillRect(x, y - boxH - grip * 0.9, unit * 0.004, boxH);
  ctx.fillStyle = '#f6e9ff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y - boxH / 2 - grip * 0.9);
  ctx.restore();
}

/**
 * Draws the whole cover at `w` by `h`. `scene` carries the caption, the ink settings and one shot per cut-out;
 * `scene.preview` adds the selection rim the editor shows and never reaches an exported PNG.
 */
export function drawPoster(ctx, w, h, scene = {}) {
  const layout = coverLayout(w, h);
  const unit = layout.unit;
  const slots = placedSlots(layout, scene);
  const strength = Math.max(0, Math.min(1, scene.ink ?? 0.85));
  const border = Math.max(4, (scene.border ?? 9) * (unit / 720));

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  paintSky(ctx, layout);

  const drawSlot = (slot) => {
    const box = slotBox(slot);
    ctx.save();
    ctx.translate(slot.cx, slot.cy);
    ctx.rotate((slot.rot * Math.PI) / 180);
    paintCutout(ctx, { x: -box.w / 2, y: -box.h / 2, w: box.w, h: box.h }, slot.seed, border, (innerCtx, inner) => {
      const shot = scene.shots?.[slot.id];
      if (!shot?.image) {
        drawEmptyCutout(innerCtx, inner, `CUT-OUT ${slot.index + 1}`);
        return;
      }
      // The graded photo sits under the comic pass, so the ink slider can fade between the two. The grade is a
      // painted wash rather than a canvas filter, which keeps a full-size export quick.
      innerCtx.save();
      drawPhotoCover(innerCtx, inner, shot);
      innerCtx.globalCompositeOperation = 'soft-light';
      innerCtx.globalAlpha = 0.28;
      const wash = innerCtx.createLinearGradient(0, 0, inner.w * 0.4, inner.h);
      wash.addColorStop(0, '#3a1568');
      wash.addColorStop(0.55, '#ff5f6d');
      wash.addColorStop(1, '#ffc247');
      innerCtx.fillStyle = wash;
      innerCtx.fillRect(0, 0, inner.w, inner.h);
      innerCtx.restore();
      if (scene.comic) {
        // The ink texture is drawn at a fixed print resolution and scaled into the cut-out, so a full-size
        // export costs no more than the preview and the texture stays consistent across all three sizes.
        const inkScale = Math.min(1, 640 / Math.max(inner.w, inner.h));
        const inked = comicCanvas(shot, Math.max(16, inner.w * inkScale), Math.max(16, inner.h * inkScale));
        innerCtx.save();
        innerCtx.globalAlpha = strength;
        innerCtx.drawImage(inked, 0, 0, inner.w, inner.h);
        innerCtx.restore();
      }
    });
    ctx.restore();
  };

  // Everything but the band sticker goes down first; the band covers their feet, as the real posters do.
  for (const slot of slots) if (slot.id !== 'bandSticker') drawSlot(slot);

  drawLogoBand(ctx, layout, scene);
  drawCreditsStrip(ctx, layout.credits, scene, unit);

  const sticker = slots.find((slot) => slot.id === 'bandSticker');
  if (sticker) drawSlot(sticker);

  paintGrain(ctx, { x: 0, y: 0, w, h }, 0.06);
  paintVignette(ctx, { x: 0, y: 0, w, h }, 0.55);

  if (scene.preview && scene.selected) {
    const chosen = slots.find((slot) => slot.id === scene.selected);
    if (chosen) paintSelection(ctx, chosen, unit);
  }

  ctx.restore();
  return layout;
}