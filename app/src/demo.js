// demo.js — the fixed scenes behind ?demo=1..4. Each one names the caption, the post size, the view to open and
// the crop of the sample photo that goes in each panel, so the screenshots in screenshots/ can be taken again at
// any time and the poster always shows the same faces in the same frames.

const SAMPLE_DIR = './samples';

/** Loads one of the kit's sample photos, decoded and ready to draw. */
export async function loadSamplePhoto(name) {
  const image = new Image();
  image.src = `${SAMPLE_DIR}/${name}.jpg`;
  await image.decode();
  return image;
}

/** A framed sample: the file, and where its subject sits (the woman's face is at 0.58, 0.27; the fisher's at 0.43, 0.29). */
function framed(sample, focusX, focusY, zoom = 1, flip = false) {
  return [sample, { focusX, focusY, zoom, flip }];
}

const CREDIT = 'A LAGOON PICTURES RELEASE · SHOT ON HOME SOIL · ALL PHOTOS THE POSTER MAKER’S OWN';

/**
 * The demo plans. `view` is 'cover' (the exported poster filling the frame), 'editor' or 'result'; `panels`
 * maps a panel id to a framed sample.
 */
export function demoPlan(mode) {
  if (mode === '2') {
    return {
      view: 'editor',
      size: '1080x1350',
      selected: 'main',
      title: 'VICE LAGOON',
      subtitle: 'A SUNSET CRIME STORY',
      credit: CREDIT,
      panels: {
        main: framed('boulevard', 0.55, 0.42),
        rightTop: framed('pier', 0.46, 0.42, 1.05, true),
        rightLow: framed('boulevard', 0.56, 0.34, 1.35),
        strip1: framed('pier', 0.45, 0.46, 1.2),
        strip2: framed('boulevard', 0.58, 0.3, 1.5, true),
        strip3: framed('pier', 0.52, 0.44, 1.7),
      },
    };
  }

  if (mode === '3') {
    return {
      view: 'result',
      size: '1080x1080',
      title: 'LAST NIGHT ON THE STRIP',
      subtitle: 'NOBODY LEAVES BEFORE SUNRISE',
      credit: CREDIT,
      panels: {
        main: framed('pier', 0.44, 0.4),
        rightTop: framed('boulevard', 0.58, 0.28, 1.15),
        rightLow: framed('pier', 0.42, 0.3, 1.5),
        strip1: framed('boulevard', 0.55, 0.6, 1.2),
        strip2: framed('pier', 0.62, 0.5, 1.35),
        strip3: framed('boulevard', 0.6, 0.3, 1.6),
      },
    };
  }

  if (mode === '4') {
    return {
      view: 'cover',
      size: '1080x1350',
      title: 'PIER PRESSURE',
      subtitle: 'THE TIDE BRINGS EVERYTHING BACK',
      credit: 'A LAGOON PICTURES RELEASE · SHOT AT THE END OF THE BOARDWALK · ALL PHOTOS THE POSTER MAKER’S OWN',
      panels: {
        main: framed('pier', 0.44, 0.42),
        rightTop: framed('boulevard', 0.6, 0.26, 1.25),
        rightLow: framed('pier', 0.55, 0.45, 1.25),
        strip1: framed('boulevard', 0.58, 0.3, 1.5),
        strip2: framed('pier', 0.66, 0.42, 1.3),
        strip3: framed('boulevard', 0.62, 0.28, 1.7, true),
      },
    };
  }

  return {
    view: 'cover',
    size: '1920x1080',
    title: 'VICE LAGOON',
    subtitle: 'A SUNSET CRIME STORY',
    credit: CREDIT,
    panels: {
      main: framed('boulevard', 0.55, 0.3),
      rightTop: framed('pier', 0.42, 0.3, 1.25, true),
      rightLow: framed('boulevard', 0.14, 0.4, 1.6),
      strip1: framed('boulevard', 0.62, 0.28, 2.4, true),
      strip2: framed('pier', 0.62, 0.62, 1.5),
      strip3: framed('boulevard', 0.2, 0.82, 1.5, true),
    },
  };
}

/** Which demo a `?demo=` value asks for, or null. */
export function demoMode(search = location.search) {
  const mode = new URLSearchParams(search).get('demo');
  return mode && /^[1-4]$/.test(mode) ? mode : null;
}