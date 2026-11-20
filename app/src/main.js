// main.js — the editor's wiring. It owns the whole app state (caption, ink and border settings, whose cut-out is
// selected) and every control, drag and scroll gesture in index.html ends here in a repaint or a PNG export.

import { POSTER_SIZES, coverLayout, drawPoster, pickSlot, placedSlots, slotBox } from './poster.js';
import { createShot, panShot, resetShot, zoomShot } from './photoPanels.js';
import { ensureDisplayFont } from './lettering.js';
import { formatBytes, posterBlob, posterFilename, sizeById } from './exporter.js';
import { demoMode, demoPlan, loadSamplePhoto, whenDecoded } from './demo.js';

const canvas = document.getElementById('poster');
const context = canvas.getContext('2d');
const compareCanvas = document.getElementById('compare-canvas');
const compareContext = compareCanvas.getContext('2d');
const slotGrid = document.getElementById('slot-grid');
const sizeList = document.getElementById('size-list');
const statusLine = document.getElementById('status');
const resultImage = document.getElementById('result-image');
const resultFile = document.getElementById('result-file');
const resultMeta = document.getElementById('result-meta');
const resultSizes = document.getElementById('result-sizes');
const downloadLink = document.getElementById('download-link');
const titleInput = document.getElementById('title-input');
const subtitleInput = document.getElementById('subtitle-input');
const creditInput = document.getElementById('credit-input');
const inkToggle = document.getElementById('ink-toggle');
const inkRange = document.getElementById('ink-strength');
const inkValue = document.getElementById('ink-value');
const borderRange = document.getElementById('sticker-border');
const borderValue = document.getElementById('border-value');
const toolRow = document.getElementById('tool-row');

const state = {
  size: POSTER_SIZES[1],
  shots: {},
  photos: [],
  offsets: {},
  selected: 'hero',
  tool: 'move',
  comic: true,
  ink: 0.85,
  border: 9,
  compare: false,
  title: 'NEON PARADISE',
  subtitle: 'A SUNSET CRIME STORY',
  credit: 'A LAGOON PICTURES RELEASE · SHOT ON HOME SOIL · EVERY PHOTO THE POSTER MAKER’S OWN',
  exported: {},
};

/** What the poster draws from: caption, ink settings, cut-out shots and drags. */
function scene(extra = {}) {
  return {
    title: state.title,
    subtitle: state.subtitle,
    credit: state.credit,
    shots: state.shots,
    offsets: state.offsets,
    selected: state.selected,
    comic: state.comic,
    ink: state.ink,
    border: state.border,
    ...extra,
  };
}

function layout() {
  return coverLayout(state.size.width, state.size.height);
}

/* ---------- painting ---------- */

let queued = 0;

function requestPaint() {
  if (queued) return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    paint();
  });
}

function fitCanvas(target, size) {
  if (target.width !== size.width || target.height !== size.height) {
    target.width = size.width;
    target.height = size.height;
  }
}

function paint() {
  fitCanvas(canvas, state.size);
  const fullBleed = document.body.classList.contains('cover-shot');
  drawPoster(context, state.size.width, state.size.height, scene({ preview: !fullBleed }));
  const caption = document.getElementById('preview-caption');
  if (caption) {
    caption.textContent = `${state.comic ? 'Comic ink on' : 'Comic ink off'} · ${state.size.width} × ${state.size.height} · drag to move, scroll to zoom`;
  }

  if (state.compare) {
    fitCanvas(compareCanvas, state.size);
    drawPoster(compareContext, state.size.width, state.size.height, scene({ preview: false, comic: true, ink: 1 }));
  }
  paintSlotGrid();
}

/** The five cut-out tiles in the left rail: what each one holds, and which is picked. */
let slotSignature = '';

function paintSlotGrid() {
  const slots = placedSlots(layout(), scene());
  const signature = slots.map((slot) => `${slot.id}:${state.shots[slot.id]?.name ?? ''}`).join('|') + state.selected;
  if (signature === slotSignature) return;
  slotSignature = signature;
  slotGrid.replaceChildren(
    ...slots.map((slot) => {
      const shot = state.shots[slot.id];
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `slot${slot.id === state.selected ? ' is-on' : ''}${shot ? '' : ' is-empty'}`;
      tile.innerHTML = `<span class="slot-thumb"></span><b>${slot.index + 1}</b><i>${slot.name}</i>`;
      const thumb = tile.querySelector('.slot-thumb');
      thumb.style.backgroundImage = shot ? `url("${shot.url}")` : '';
      thumb.style.backgroundPosition = shot ? `${shot.focusX * 100}% ${shot.focusY * 100}%` : '';
      tile.addEventListener('click', () => {
        state.selected = slot.id;
        requestPaint();
      });
      return tile;
    }),
  );
}

/* ---------- the controls ---------- */

function paintSizeList() {
  sizeList.replaceChildren(
    ...POSTER_SIZES.map((size) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `size${size.id === state.size.id ? ' is-on' : ''}`;
      button.innerHTML = `<span>${size.label}</span><b>${size.width} × ${size.height}</b><i>${size.ratio}</i>`;
      button.addEventListener('click', () => chooseSize(size.id));
      return button;
    }),
  );
}

function paintTools() {
  for (const button of toolRow.querySelectorAll('[data-tool]')) {
    button.classList.toggle('is-on', button.dataset.tool === state.tool);
  }
  document.getElementById('compare-toggle').classList.toggle('is-on', state.compare);
  document.body.classList.toggle('compare', state.compare);
}

function syncCaption() {
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  creditInput.value = state.credit;
  inkToggle.checked = state.comic;
  inkRange.value = String(Math.round(state.ink * 100));
  inkValue.textContent = `${Math.round(state.ink * 100)}%`;
  borderRange.value = String(state.border);
  borderValue.textContent = `${state.border} px`;
}

for (const [input, key] of [
  [titleInput, 'title'],
  [subtitleInput, 'subtitle'],
  [creditInput, 'credit'],
]) {
  input.addEventListener('input', () => {
    state[key] = input.value;
    requestPaint();
  });
}

inkToggle.addEventListener('change', () => {
  state.comic = inkToggle.checked;
  statusLine.textContent = state.comic ? 'Comic ink on.' : 'Comic ink off — the plain graded photo.';
  requestPaint();
});

inkRange.addEventListener('input', () => {
  state.ink = Number(inkRange.value) / 100;
  inkValue.textContent = `${inkRange.value}%`;
  requestPaint();
});

borderRange.addEventListener('input', () => {
  state.border = Number(borderRange.value);
  borderValue.textContent = `${state.border} px`;
  requestPaint();
});

/* ---------- photos ---------- */

async function loadPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await whenDecoded(image);
  return { image, url, name: file.name.replace(/\.[^.]+$/, '') || 'photo' };
}

function emptySlotId() {
  return layout().slots.find((slot) => !state.shots[slot.id])?.id ?? null;
}

async function addPhotos(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;
  for (const file of files) {
    const photo = await loadPhotoFile(file);
    state.photos.push(photo);
    const target = emptySlotId() ?? state.selected;
    const shot = createShot(photo.image, { focusY: 0.38 });
    shot.name = photo.name;
    shot.url = photo.url;
    state.shots[target] = shot;
    state.selected = target;
    delete state.offsets[target];
  }
  statusLine.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} cut in.`;
  requestPaint();
}

function fillEverySlot() {
  if (!state.photos.length) return;
  layout()
    .slots.forEach((slot, index) => {
      const photo = state.photos[index % state.photos.length];
      const shot = createShot(photo.image, { focusY: 0.38 });
      shot.name = photo.name;
      shot.url = photo.url;
      state.shots[slot.id] = shot;
    });
  statusLine.textContent = 'Every cut-out filled from your photos.';
  requestPaint();
}

/* ---------- dragging: move a sticker or reframe its photo ---------- */

function posterPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (canvas.width / box.width),
    y: (event.clientY - box.top) * (canvas.height / box.height),
  };
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = posterPoint(event);
  const layoutNow = layout();
  const slot = pickSlot(layoutNow, scene(), point.x, point.y);
  if (!slot) return;
  state.selected = slot.id;
  drag = {
    kind: state.tool === 'frame' && state.shots[slot.id] ? 'frame' : 'move',
    slotId: slot.id,
    x: point.x,
    y: point.y,
  };
  canvas.setPointerCapture(event.pointerId);
  document.body.classList.add('is-dragging');
  requestPaint();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = posterPoint(event);
  const layoutNow = layout();
  const slot = placedSlots(layoutNow, scene()).find((entry) => entry.id === drag.slotId);
  if (!slot) return;
  if (drag.kind === 'move') {
    const held = state.offsets[slot.id] ?? { x: 0, y: 0 };
    held.x += (point.x - drag.x) / layoutNow.unit;
    held.y += (point.y - drag.y) / layoutNow.unit;
    state.offsets[slot.id] = held;
  } else {
    const shot = state.shots[slot.id];
    if (shot) panShot(shot, slotBox(slot), point.x - drag.x, point.y - drag.y);
  }
  drag.x = point.x;
  drag.y = point.y;
  requestPaint();
});

for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, () => {
    drag = null;
    document.body.classList.remove('is-dragging');
  });
}

canvas.addEventListener(
  'wheel',
  (event) => {
    const point = posterPoint(event);
    const slot = pickSlot(layout(), scene(), point.x, point.y);
    const shot = slot ? state.shots[slot.id] : null;
    if (!slot || !shot) return;
    event.preventDefault();
    zoomShot(shot, slotBox(slot), Math.exp(-event.deltaY * 0.0016), point.x, point.y);
    state.selected = slot.id;
    requestPaint();
  },
  { passive: false },
);

document.getElementById('photo-input').addEventListener('change', (event) => {
  addPhotos(event.target.files);
  event.target.value = '';
});

const dropzone = document.getElementById('dropzone');

for (const type of ['dragenter', 'dragover']) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-hot');
  });
}

for (const type of ['dragleave', 'drop']) {
  dropzone.addEventListener(type, () => dropzone.classList.remove('is-hot'));
}

document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-hot');
  if (event.dataTransfer?.files?.length) addPhotos(event.dataTransfer.files);
});

document.getElementById('fill-all').addEventListener('click', fillEverySlot);
document.getElementById('reset-frame').addEventListener('click', () => {
  const shot = state.shots[state.selected];
  if (shot) resetShot(shot);
  delete state.offsets[state.selected];
  requestPaint();
});
document.getElementById('mirror-cutout').addEventListener('click', () => {
  const shot = state.shots[state.selected];
  if (!shot) return;
  shot.flip = !shot.flip;
  requestPaint();
});
document.getElementById('centre-cutout').addEventListener('click', () => {
  delete state.offsets[state.selected];
  requestPaint();
});

toolRow.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]');
  if (!button) return;
  state.tool = button.dataset.tool;
  paintTools();
  statusLine.textContent = state.tool === 'move' ? 'Drag a cut-out to move it.' : 'Drag inside a cut-out to reframe its photo.';
});

document.getElementById('compare-toggle').addEventListener('click', () => {
  state.compare = !state.compare;
  paintTools();
  requestPaint();
});

/* ---------- export ---------- */

function chooseSize(id) {
  state.size = sizeById(id);
  paintSizeList();
  requestPaint();
  if (document.body.classList.contains('view-result')) exportPoster(id);
}

async function renderBlob(size) {
  return posterBlob(scene({ preview: false }), size);
}

function showResult(blob, size, name) {
  const url = URL.createObjectURL(blob);
  state.exported[size.id] = { name, bytes: blob.size, url };
  resultImage.src = url;
  downloadLink.href = url;
  downloadLink.download = name;
  resultFile.textContent = name;
  resultMeta.textContent = `${size.width} × ${size.height} px · PNG · ${formatBytes(blob.size)}`;
  document.body.classList.add('view-result');
  paintResultSizes();
}

function paintResultSizes() {
  resultSizes.replaceChildren(
    ...POSTER_SIZES.map((size) => {
      const held = state.exported[size.id];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `export-row${held ? ' is-done' : ''}${size.id === state.size.id ? ' is-on' : ''}`;
      row.innerHTML = `<span>${size.label}<i>${size.width} × ${size.height}</i></span><b>${held ? formatBytes(held.bytes) : 'export'}</b>`;
      row.addEventListener('click', () => {
        state.size = size;
        paintSizeList();
        exportPoster(size.id);
      });
      return row;
    }),
  );
}

async function exportPoster(sizeId = state.size.id) {
  const size = sizeById(sizeId);
  state.size = size;
  paintSizeList();
  statusLine.textContent = `Drawing at ${size.width} × ${size.height}…`;
  let blob;
  try {
    blob = await renderBlob(size);
  } catch {
    // A file:// page reads the samples fine, but a tainted canvas refuses to write a PNG; say so plainly.
    statusLine.textContent = 'PNG export needs the page served over http — run a static server on app/ and open localhost.';
    window.__posterReady = true;
    return null;
  }
  const name = posterFilename(scene(), size);
  showResult(blob, size, name);
  statusLine.textContent = `Exported ${name}`;
  return blob;
}

/** Writes all three post sizes, so the result view lists the whole set. */
async function exportEverySize() {
  for (const size of POSTER_SIZES) {
    statusLine.textContent = `Drawing ${size.width} × ${size.height}…`;
    const blob = await renderBlob(size).catch(() => null);
    if (blob) showResult(blob, size, posterFilename(scene(), size));
  }
  // The last one written is the square; show it as the result and keep all three rows listed.
  const square = POSTER_SIZES[0];
  state.size = square;
  paintSizeList();
  const held = state.exported[square.id];
  if (held) {
    resultImage.src = held.url;
    downloadLink.href = held.url;
    downloadLink.download = held.name;
    resultFile.textContent = held.name;
    resultMeta.textContent = `${square.width} × ${square.height} px · PNG · ${formatBytes(held.bytes)}`;
  }
  paintResultSizes();
  statusLine.textContent = 'All three sizes written — pick one to download.';
  window.__posterReady = true;
}

document.getElementById('export-button').addEventListener('click', () => exportPoster(state.size.id));
document.getElementById('export-all').addEventListener('click', exportEverySize);
document.getElementById('back-to-editor').addEventListener('click', () => {
  document.body.classList.remove('view-result');
  requestPaint();
});

/* ---------- demo scenes ---------- */

async function runDemo(mode) {
  const plan = demoPlan(mode);
  state.title = plan.title;
  state.subtitle = plan.subtitle;
  state.credit = plan.credit;
  state.size = sizeById(plan.size);
  state.comic = plan.comic ?? true;
  state.compare = Boolean(plan.compare);
  state.selected = 'hero';
  syncCaption();
  paintSizeList();
  paintTools();

  const loaded = new Map();
  for (const [slotId, [sample, framing]] of Object.entries(plan.panels)) {
    let photo = loaded.get(sample);
    if (!photo) {
      const image = await loadSamplePhoto(sample);
      photo = { image, url: `./samples/${sample}.jpg`, name: sample };
      loaded.set(sample, photo);
      state.photos.push(photo);
    }
    const shot = createShot(photo.image, framing);
    shot.name = sample;
    shot.url = photo.url;
    state.shots[slotId] = shot;
  }

  document.body.classList.toggle('cover-shot', plan.view === 'cover');
  document.body.classList.toggle('view-result', plan.view === 'result');
  paint();

  if (plan.view === 'cover') {
    statusLine.textContent = 'Full-bleed poster.';
    window.__posterReady = true;
    return;
  }
  if (plan.view === 'result') {
    await exportEverySize();
    return;
  }
  statusLine.textContent = 'Demo scene loaded — drag a cut-out to move it.';
  window.__posterReady = true;
}

/* ---------- boot ---------- */

async function boot() {
  await ensureDisplayFont();
  syncCaption();
  paintSizeList();
  paintTools();
  const mode = demoMode();
  if (mode) await runDemo(mode);
  else {
    paint();
    statusLine.textContent = 'Drop a photo to cut it into the hero panel.';
    window.__posterReady = true;
  }
}

/** Boot, and say so plainly in the status line if anything in the first paint throws. */
async function start() {
  try {
    await boot();
  } catch (error) {
    console.error(error);
    document.getElementById('status').textContent = `Could not start: ${error?.message ?? error}`;
  }
}

start();