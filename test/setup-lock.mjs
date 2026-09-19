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
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = join(ROOT, 'skills/backlog/setup-shady2k-skills');
const LOCK = join(ROOT, 'test/setup-lock.json');
const INSTALLED = ['check.mjs', 'check-commits.mjs', 'check-docs.mjs', 'document-format.mjs',
  'integration.md', 'model.md', 'documents.md', 'templates', 'adapters'];

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).sort().flatMap((n) => walk(join(p, n))) : [p]);
const files = INSTALLED.map((n) => join(SETUP, n)).filter(existsSync).flatMap(walk);
const digests = Object.fromEntries(files.map((f) =>
  [relative(SETUP, f), createHash('sha256').update(readFileSync(f)).digest('hex')]));
const version = (readFileSync(join(SETUP, 'protocol.md'), 'utf8').match(/^Setup version: (.+)$/m) || [])[1];

if (process.argv[2] === '--write') {
  writeFileSync(LOCK, `${JSON.stringify({ setupVersion: version, files: digests }, null, 2)}\n`);
  console.log(`recorded ${files.length} installed files for setup version ${version}`);
  process.exit(0);
}

const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { setupVersion: null, files: {} };
const changed = [...new Set([...Object.keys(lock.files), ...Object.keys(digests)])]
  .filter((f) => lock.files[f] !== digests[f]).sort();
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
console.log(`PASS  setup lock: ${files.length} installed files match setup version ${version}`);
