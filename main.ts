// gta6-cover-art-01 entry: hand the built cover maker to the grader.
//
// The app lives in app/ as plain static files a desktop browser opens offline (app/index.html, its ES modules,
// its styles and sample photos, no network, no library), and the renders of it live in screenshots/. This
// program stages both into the output directory and writes dossier.json beside them with the vendored make.fun
// library, which is the one file the judge reads.
//
// Locally, outside the grader's container, MAKEFUN_OUTPUT_DIR replaces /output:
//   MAKEFUN_OUTPUT_DIR=/tmp/aout node main.ts
// To look at the app, run `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repo root: this file's own directory.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Where the entry is staged: /output in the grader, MAKEFUN_OUTPUT_DIR otherwise.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The grader's own caps, taken from its gate.json. text_max_bytes is the only one that shapes the dossier; the
// rest are here so a build that would be refused is refused now, here, instead of at the judge.
const GRADER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Make the stage directory, empty enough to be filled: created when absent, reused when it is there. */
function prepareOutputDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Copy one directory from the repo into the stage, returning how many files it brought over. */
function copyTree(sourceDir: string, targetDir: string): number {
  cpSync(sourceDir, targetDir, { recursive: true });
  return countFiles(targetDir);
}

/** How many plain files sit under a directory, at any depth. */
function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) total++;
  }
  return total;
}

/** Write dossier.json for the staged entry and return its size in bytes. */
function buildManifest(dir: string): number {
  const dossier = buildDossier(dir, GRADER_CAPS);
  writeFileSync(join(dir, 'dossier.json'), dossier);
  return dossier.length;
}

// The app is the entry's whole point: without it there is nothing to hand in, so say that plainly.
const appSource = join(repoRoot, 'app');
if (!existsSync(appSource) || !statSync(appSource).isDirectory()) {
  throw new Error(`no app/ directory in ${repoRoot}: the cover maker's static files belong there, app/index.html at its root`);
}

prepareOutputDirectory(outputDir);

let filesCopied = copyTree(appSource, join(outputDir, 'app'));
const shotsSource = join(repoRoot, 'screenshots');
if (existsSync(shotsSource)) filesCopied += copyTree(shotsSource, join(outputDir, 'screenshots'));

const dossierBytes = buildManifest(outputDir);

console.log(`staged ${filesCopied} files into ${outputDir}; dossier.json is ${dossierBytes} bytes`);