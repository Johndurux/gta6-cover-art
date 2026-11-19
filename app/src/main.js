// main.js — the studio wiring: photos in, panels framed by drag and scroll, caption typed live, PNG written at
// three sizes. It owns the state, paints the preview from poster.js, and lays the panel handles over the canvas
// so what you grab is what you reframe.

import { POSTER_SIZES, drawPoster, posterLayout } from './poster.js';
import { createShot, panelAt, panShot, resetShot, zoomShot } from './photoPanels.js';
import { ensureDisplayFont } from './lettering.js';
import { formatBytes, posterBlob, posterFilename, sizeById } from './exporter.js';
import { demoMode, demoPlan, loadSamplePhoto } from './demo.js';

const canvas = document.getElementById('poster');
const context = canvas.getContext('2d');
const handles = document.getElementById('handles');
const filmstrip = document.getElementById('filmstrip');
const panelChips = document.getElementById('panel-chips');
const statusLine = document.getElementById('status');
const resultImage = document.getElementById('result-image');
const resultFile = document.getElementById('result-file');
const resultMeta = document.getElementById('result-meta');
const downloadLink = document.getElementById('download-link');
const ribbonFile = document.getElementById('ribbon-file');
const ribbonMeta = document.getElementById('ribbon-meta');
const titleInput = document.getElementById('title-input');
const subtitleInput = document.getElementById('subtitle-input');
const creditInput = document.getElementById('credit-input');

const state = {
  size: POSTER_SIZES[1],
  selected: 'main',
  shots: {},
  photos: [],
  title: 'VICE LAGOON',
  subtitle: 'A SUNSET CRIME STORY',
  credit: 'A LAGOON PICTURES RELEASE · SHOT ON HOME SOIL · ALL PHOTOS THE POSTER MAKER’S OWN',
};

/** What the poster draws from: the caption plus one shot per panel. */
function scene() {
  return { title: state.title, subtitle: state.subtitle, credit: state.credit, shots: state.shots };
}

function layout() {
  return posterLayout(state.size.width, state.size.height);
}

function showView(view) {
  document.body.classList.toggle('view-result', view === 'result' || view === 'cover');
  document.body.classList.toggle('cover-shot', view === 'cover');
}

/* ---------- painting ---------- */

let queued = 0;

function requestPaint() {
  if (queued) return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    paintPreview();
  });
}

function paintPreview() {
  if (canvas.width !== state.size.width || canvas.height !== state.size.height) {
    canvas.width = state.size.width;
    canvas.height = state.size.height;
  }
  const composed = drawPoster(context, state.size.width, state.size.height, scene());
  paintHandles(composed);
}

/** The panel outlines and grab targets, laid over the canvas as a percentage grid. */
function paintHandles(composed) {
  const signature = composed.panels.map((panel) => `${panel.id}:${panel.w}`).join(',');
  if (paintHandles.signature !== signature) {
    paintHandles.signature = signature;
    handles.replaceChildren(
      ...composed.panels.map((panel) => {
        const box = document.createElement('div');
        box.className = 'handle';
        box.dataset.panel = panel.id;
        box.dataset.index = String(panel.index + 1);
        box.style.left = `${(panel.x / composed.width) * 100}%`;
        box.style.top = `${(panel.y / composed.height) * 100}%`;
        box.style.width = `${(panel.w / composed.width) * 100}%`;
        box.style.height = `${(panel.h / composed.height) * 100}%`;
        return box;
      }),
    );
  }
  for (const box of handles.children) {
    box.classList.toggle('is-active', box.dataset.panel === state.selected);
  }
}

/* ---------- the controls that mirror the state ---------- */

function paintSizeRows() {
  for (const row of document.querySelectorAll('[data-size-row]')) {
    row.replaceChildren(
      ...POSTER_SIZES.map((size) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `size-chip${size.id === state.size.id ? ' is-on' : ''}`;
        button.dataset.size = size.id;
        button.innerHTML = `<span>${size.ratio}</span><b>${size.width}×${size.height}</b>`;
        button.addEventListener('click', () => chooseSize(size.id));
        return button;
      }),
    );
  }
}

function paintPanelChips() {
  panelChips.replaceChildren(
    ...layout().panels.map((panel) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${panel.id === state.selected ? ' is-on' : ''}${state.shots[panel.id] ? '' : ' is-empty'}`;
      chip.textContent = `${panel.index + 1} ${panel.name}`;
      chip.addEventListener('click', () => {
        state.selected = panel.id;
        paintPanelChips();
        paintFilmstrip();
        requestPaint();
      });
      return chip;
    }),
  );
}

function paintFilmstrip() {
  const activeName = state.shots[state.selected]?.name ?? null;
  filmstrip.replaceChildren(
    ...state.photos.map((photo) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `thumb${photo.name === activeName ? ' is-on' : ''}`;
      button.title = `Put ${photo.name} in the selected panel`;
      button.style.backgroundImage = `url("${photo.url}")`;
      button.addEventListener('click', () => usePhotoInPanel(photo, state.selected));
      return button;
    }),
  );
}

function paintAll() {
  paintSizeRows();
  paintPanelChips();
  paintFilmstrip();
  requestPaint();
}

/* ---------- captions ---------- */

function syncCaptionFields() {
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  creditInput.value = state.credit;
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

/* ---------- photos ---------- */

async function loadPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  return { image, url, name: file.name.replace(/\.[^.]+$/, '') || 'photo' };
}

function emptyPanelId() {
  return layout().panels.find((panel) => !state.shots[panel.id])?.id ?? null;
}

async function addPhotos(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;
  for (const file of files) {
    const photo = await loadPhotoFile(file);
    state.photos.push(photo);
    const target = emptyPanelId() ?? state.selected;
    const shot = createShot(photo.image, { focusY: 0.44 });
    shot.name = photo.name;
    state.shots[target] = shot;
    state.selected = target;
  }
  statusLine.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} placed.`;
  paintAll();
}

function usePhotoInPanel(photo, panelId) {
  const previous = state.shots[panelId];
  const framing = previous ? { zoom: previous.zoom, focusX: previous.focusX, focusY: previous.focusY } : {};
  const shot = createShot(photo.image, framing);
  shot.name = photo.name;
  state.shots[panelId] = shot;
  paintAll();
}

/** Fills every panel from the photo pool, in order, so one photo can carry the whole poster. */
function fillEveryPanel() {
  if (!state.photos.length) return;
  for (const [index, panel] of layout().panels.entries()) {
    const photo = state.photos[index % state.photos.length];
    const shot = createShot(photo.image, { focusY: 0.44 });
    shot.name = photo.name;
    state.shots[panel.id] = shot;
  }
  statusLine.textContent = 'Every panel filled from your photos.';
  paintAll();
}

function swapWithNextPanel() {
  const panels = layout().panels;
  const index = panels.findIndex((panel) => panel.id === state.selected);
  const next = panels[(index + 1) % panels.length];
  const current = panels[index];
  const held = state.shots[current.id];
  state.shots[current.id] = state.shots[next.id];
  state.shots[next.id] = held;
  paintPanelChips();
  paintFilmstrip();
  requestPaint();
}

/* ---------- framing by hand ---------- */

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
  const panel = panelAt(layout().panels, point.x, point.y);
  if (!panel) return;
  state.selected = panel.id;
  drag = { panelId: panel.id, x: point.x, y: point.y };
  canvas.setPointerCapture(event.pointerId);
  paintPanelChips();
  paintFilmstrip();
  requestPaint();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = posterPoint(event);
  const panel = layout().panels.find((entry) => entry.id === drag.panelId);
  const shot = state.shots[drag.panelId];
  if (!panel || !shot) return;
  panShot(shot, panel, point.x - drag.x, point.y - drag.y);
  drag.x = point.x;
  drag.y = point.y;
  requestPaint();
});

for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, () => {
    drag = null;
  });
}

canvas.addEventListener(
  'wheel',
  (event) => {
    const point = posterPoint(event);
    const panel = panelAt(layout().panels, point.x, point.y);
    const shot = panel ? state.shots[panel.id] : null;
    if (!panel || !shot) return;
    event.preventDefault();
    zoomShot(shot, panel, Math.exp(-event.deltaY * 0.0016), point.x, point.y);
    state.selected = panel.id;
    paintPanelChips();
    requestPaint();
  },
  { passive: false },
);

/* ---------- export ---------- */

function chooseSize(id) {
  state.size = sizeById(id);
  paintSizeRows();
  const shown = document.body.classList.contains('cover-shot')
    ? 'cover'
    : document.body.classList.contains('view-result')
      ? 'result'
      : null;
  if (shown) exportPoster(id, shown);
  else requestPaint();
}

async function exportPoster(sizeId = state.size.id, view = 'result') {
  const size = sizeById(sizeId);
  state.size = size;
  paintSizeRows();
  statusLine.textContent = `Drawing at ${size.width} × ${size.height}…`;
  let blob;
  try {
    blob = await posterBlob(scene(), size);
  } catch (error) {
    // file:// pages read the samples fine but a tainted canvas refuses to write a PNG; say so plainly.
    statusLine.textContent = 'PNG export is blocked on this page — open the app over http (e.g. python3 -m http.server).';
    window.__posterReady = true;
    return;
  }
  const filename = posterFilename(state, size);
  const url = URL.createObjectURL(blob);

  resultImage.src = url;
  downloadLink.href = url;
  downloadLink.download = filename;
  resultFile.textContent = filename;
  resultMeta.textContent = `${size.width} × ${size.height} px · PNG · ${formatBytes(blob.size)}`;
  ribbonFile.textContent = filename;
  ribbonMeta.textContent = `${size.width} × ${size.height} · PNG · ${formatBytes(blob.size)}`;
  statusLine.textContent = `Exported ${filename}`;
  showView(view);
  requestPaint();
  return blob;
}

/* ---------- wiring ---------- */

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

document.getElementById('fill-all').addEventListener('click', fillEveryPanel);
document.getElementById('reset-frame').addEventListener('click', () => {
  const shot = state.shots[state.selected];
  if (shot) resetShot(shot);
  requestPaint();
});
document.getElementById('swap-panel').addEventListener('click', swapWithNextPanel);
document.getElementById('mirror-panel').addEventListener('click', () => {
  const shot = state.shots[state.selected];
  if (!shot) return;
  shot.flip = !shot.flip;
  requestPaint();
});
document.getElementById('export-button').addEventListener('click', () => exportPoster(state.size.id, 'result'));
document.getElementById('back-to-editor').addEventListener('click', () => {
  showView('editor');
  requestPaint();
});

/* ---------- demo scenes ---------- */

async function runDemo(mode) {
  const plan = demoPlan(mode);
  state.title = plan.title;
  state.subtitle = plan.subtitle;
  state.credit = plan.credit;
  state.size = sizeById(plan.size);
  state.selected = plan.selected ?? 'main';
  syncCaptionFields();

  const loaded = new Map();
  for (const [panelId, [sample, framing]] of Object.entries(plan.panels)) {
    let photo = loaded.get(sample);
    if (!photo) {
      const image = await loadSamplePhoto(sample);
      photo = { image, url: `./samples/${sample}.jpg`, name: sample };
      loaded.set(sample, photo);
      state.photos.push(photo);
    }
    const shot = createShot(photo.image, framing);
    shot.name = sample;
    state.shots[panelId] = shot;
  }

  paintAll();
  paintPreview();
  if (plan.view === 'editor') {
    statusLine.textContent = 'Demo scene loaded — drag a panel to reframe it.';
  } else {
    await exportPoster(plan.size, plan.view);
  }
  window.__posterReady = true;
}

/* ---------- boot ---------- */

async function boot() {
  await ensureDisplayFont();
  syncCaptionFields();
  const mode = demoMode();
  if (mode) await runDemo(mode);
  else {
    paintAll();
    paintPreview();
    statusLine.textContent = 'Drop a photo to fill the main panel.';
    window.__posterReady = true;
  }
}

boot();