[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Johndurux/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Johndurux/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Poster turns a handful of ordinary photos into GTA-style cover art: six overlapping sticker cut-outs — one big hero, five smaller ones that break each other's edges — a sunset sky with a slatted sun and a city skyline, and a logo band at the foot carrying the title in Anton, skewed six degrees, white with a thick black outline and a magenta offset shadow. Every pixel is drawn by the app's own canvas code; the photo you drop in only supplies the picture. No game artwork, wordmark or font file is used: the display face is Anton, shipped under the SIL Open Font License in `app/fonts/`.

## Comic ink

Each cut-out goes through a comic pass, in this order (`app/src/comic.js`): a warm sunset grade (saturation and an S-curve), a posterise to six levels per channel, a Sobel edge pass that paints a thick near-black outline over the strongest edges, a 45-degree halftone dot screen over the midtones, and a soft vignette. The pass is cached per cut-out and framing, so dragging a sticker never recomputes it. **Comic ink** is a toggle (on by default) and its strength is a slider — at 0% you see the plain graded photo, at 100% the full ink. The sticker border has its own slider (6-10 px reads best).

## The editor

Three rails: photos and the two sliders on the left, the live poster on the canvas with draggable cut-outs in the middle, the post sizes and the export button on the right. Drag a cut-out to move it, or switch to **Frame photo** and drag inside one to reframe its picture; scroll to zoom the photo under the cursor. The six photo tiles select a cut-out, dropping a file fills the first empty one, and **Before / after** shows the plain grade beside the inked cover.

## Exports

Real PNGs at 1080 x 1080, 1080 x 1350 and 1920 x 1080, drawn again on a fresh canvas at the exact pixel size — never upscaled from the preview. **Export PNG** writes the chosen size; **Export all three sizes** writes the set and lists each one with its byte count beside a download link.

**Export needs the page served over http.** Opened straight from `file://` the app draws everything, but Chrome taints a canvas that has drawn a `file://` image, so `toBlob` refuses to write the PNG and the status line says so. Serve `app/` with any static server (`python3 -m http.server` in `app/`) and open `index.html` from `localhost`; photos are still read only on your own machine and never uploaded.

## Demo scenes

`?demo=1` an editor with the sample photos loaded and the hero cut-out selected; `?demo=2` the same editor with comic ink off and the before/after pair on show; `?demo=3` the finished wide poster full-bleed, no chrome; `?demo=4` the export result view with all three sizes and the download button. They reproduce the four screenshots in `screenshots/`.

Run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`, then serve `app/` and open `index.html`.