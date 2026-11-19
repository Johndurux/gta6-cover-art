// exporter.js — writing the PNG. The poster is re-rendered on a fresh canvas at the requested size, never
// scaled up from the preview, then handed back as a blob with a filename taken from the title.

import { drawPoster, POSTER_SIZES } from './poster.js';

export function sizeById(id) {
  return POSTER_SIZES.find((size) => size.id === id) ?? POSTER_SIZES[0];
}

/** A filename-safe form of the title: lowercase, dashes, no runs of punctuation. */
export function slugifyTitle(title) {
  const slug = (title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'cover';
}

export function posterFilename(scene, size) {
  return `${slugifyTitle(scene.title)}-${size.width}x${size.height}.png`;
}

/** A canvas holding the cover drawn at exactly `size`, which is what gets written out. */
export function renderPosterCanvas(scene, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  drawPoster(canvas.getContext('2d'), size.width, size.height, scene);
  return canvas;
}

export function posterBlob(scene, size) {
  const canvas = renderPosterCanvas(scene, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the browser wrote no PNG'))), 'image/png');
  });
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Saves a blob under `filename` by clicking a temporary link. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}