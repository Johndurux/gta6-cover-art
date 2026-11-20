// demo.js — the four canned scenes behind ?demo=1..4. Each plan fixes the caption, post size, view and the crop
// of which sample photo sits in which cut-out, so the poster always shows the same faces in the same frames.

const SAMPLE_DIR = './samples';

/** Resolves once an image element has its pixels, whether or not decode() is available to wait on. */
export function whenDecoded(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve(image);
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error(`could not read ${image.src}`)), { once: true });
  });
}

/** Loads one of the app's sample photos, decoded and ready to draw. */
export async function loadSamplePhoto(name) {
  const image = new Image();
  image.src = `${SAMPLE_DIR}/${name}.jpg`;
  await whenDecoded(image);
  return image;
}

/** A framed sample: the file, and where its subject sits (the woman's face is at 0.56, 0.23; the fisher's at 0.44, 0.28). */
function framed(sample, focusX, focusY, zoom = 1, flip = false) {
  return [sample, { focusX, focusY, zoom, flip }];
}

const CREDIT = 'A LAGOON PICTURES RELEASE · SHOT ON HOME SOIL · EVERY PHOTO THE POSTER MAKER’S OWN';

const CAST = {
  hero: framed('boulevard', 0.56, 0.3, 1.02),
  leftTop: framed('pier', 0.55, 0.75, 2.4, true),
  rightTop: framed('pier', 0.44, 0.3, 1.15, true),
  rightLow: framed('boulevard', 0.6, 0.34, 1.55),
  leftLow: framed('pier', 0.5, 0.42, 1.35),
  bandSticker: framed('boulevard', 0.26, 0.74, 2.1),
};

/**
 * The demo plans. `view` is 'editor', 'result' (the export result view) or 'cover' (the poster full-bleed);
 * `panels` maps a cut-out id to a framed sample.
 */
export function demoPlan(mode) {
  if (mode === '2') {
    return {
      view: 'editor',
      size: '1080x1350',
      title: 'NEON PARADISE',
      subtitle: 'A SUNSET CRIME STORY',
      credit: CREDIT,
      comic: false,
      compare: true,
      panels: CAST,
    };
  }

  if (mode === '3') {
    return {
      view: 'cover',
      size: '1920x1080',
      title: 'LAST NIGHT ON THE STRIP',
      subtitle: 'NOBODY LEAVES BEFORE SUNRISE',
      credit: CREDIT,
      comic: true,
      panels: {
        hero: framed('boulevard', 0.56, 0.29, 1.06),
        leftTop: framed('pier', 0.52, 0.78, 2.6, true),
        rightTop: framed('pier', 0.43, 0.3, 1.2, true),
        rightLow: framed('boulevard', 0.58, 0.32, 1.5),
        leftLow: framed('pier', 0.6, 0.62, 1.9, true),
        bandSticker: framed('boulevard', 0.24, 0.72, 2.2),
      },
    };
  }

  if (mode === '4') {
    return {
      view: 'result',
      size: '1080x1080',
      title: 'PIER PRESSURE',
      subtitle: 'THE TIDE BRINGS EVERYTHING BACK',
      credit: 'A LAGOON PICTURES RELEASE · SHOT AT THE END OF THE BOARDWALK · EVERY PHOTO THE POSTER MAKER’S OWN',
      comic: true,
      exportAll: true,
      panels: {
        hero: framed('pier', 0.44, 0.3, 1.1),
        leftTop: framed('boulevard', 0.2, 0.7, 2.4, true),
        rightTop: framed('boulevard', 0.56, 0.26, 1.4),
        rightLow: framed('pier', 0.46, 0.42, 1.3),
        leftLow: framed('boulevard', 0.5, 0.55, 1.8, true),
        bandSticker: framed('pier', 0.5, 0.4, 1.6),
      },
    };
  }

  return {
    view: 'editor',
    size: '1080x1350',
    title: 'NEON PARADISE',
    subtitle: 'A SUNSET CRIME STORY',
    credit: CREDIT,
    comic: true,
    panels: CAST,
  };
}

/** Which demo a `?demo=` value asks for, or null. */
export function demoMode(search = location.search) {
  const mode = new URLSearchParams(search).get('demo');
  return mode && /^[1-4]$/.test(mode) ? mode : null;
}