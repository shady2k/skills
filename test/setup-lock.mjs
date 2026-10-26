#!/usr/bin/env node
/**
 * A project reruns setup only when the protocol's setup version changes, so
 * that version must change whenever something setup puts into a project does:
 * the checks, the document reader, the templates and the contracts setup
 * builds from. This compares those files with the digests recorded for the
 * current setup version and fails when they changed under the same version.
 *
 *   node test/setup-lock.mjs          verify
 *   node test/setup-lock.mjs --write  record the current files (after a bump)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED, LAYOUT, walk } from './setup-installed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = join(ROOT, 'skills/backlog/setup-shady2k-skills');
const LOCK = join(ROOT, 'test/setup-lock.json');

// What setup installs only where the project chose the off-branch tracker layout:
// the mechanism, the recipes and the supervisor template. They are locked exactly
// as the rest are — an unflagged change to one of them fails here — but they are
// recorded apart from the version-bound list, for one reason: a project that did
// not choose that layout never receives them, and a setup version rises to send
// every project to setup, so keying them to the version would make a project keep
// the tracker on its branches rerun setup for a file it never gets. A project
// that did choose the layout reads the version the installed copy reports
// (`tracker-sync.mjs status`), which setup writes from the plugin's version, and
// setup's own recheck compares the copy with the shipped file byte for byte, the
// same duty the copied checks already carry.

const digestOf = (list) => Object.fromEntries(list.map((n) => join(SETUP, n)).filter(existsSync).flatMap(walk).map((f) =>
  [relative(SETUP, f), createHash('sha256').update(readFileSync(f)).digest('hex')]));
const files = Object.keys(digestOf(INSTALLED));
const digests = digestOf(INSTALLED);
const layout = digestOf(LAYOUT);
const version = (readFileSync(join(SETUP, 'protocol.md'), 'utf8').match(/^Setup version: (.+)$/m) || [])[1];

if (process.argv[2] === '--write') {
  writeFileSync(LOCK, `${JSON.stringify({ setupVersion: version, files: digests, layout }, null, 2)}\n`);
  console.log(`recorded ${files.length} installed files and ${Object.keys(layout).length} layout files for setup version ${version}`);
  process.exit(0);
}

const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { setupVersion: null, files: {}, layout: {} };
const diff = (recorded, now) => [...new Set([...Object.keys(recorded || {}), ...Object.keys(now)])]
  .filter((f) => (recorded || {})[f] !== now[f]).sort();
const changed = diff(lock.files, digests);
const changedLayout = diff(lock.layout, layout);
if (lock.setupVersion !== version) {
  console.log(`FAIL  setup version is ${version} but the lock records ${lock.setupVersion}: run npm run setup-lock`);
  process.exit(1);
}
if (changed.length) {
  console.log(`FAIL  installed files changed under setup version ${version}: ${changed.join(', ')}`);
  console.log('      Projects would keep the old files without a setup rerun. Bump the setup version');
  console.log('      (protocol line and the checks\' RULES_VERSION), npm run protocol, then npm run setup-lock.');
  process.exit(1);
}
if (changedLayout.length) {
  console.log(`FAIL  files setup installs for the off-branch layout changed: ${changedLayout.join(', ')}`);
  console.log('      Record them again (npm run setup-lock) and tell the projects that run that layout, whose');
  console.log('      installed copy reports its version from status; the setup version alone does not reach them.');
  process.exit(1);
}
console.log(`PASS  setup lock: ${files.length} installed files match setup version ${version}, and ${Object.keys(layout).length} layout files match`);
