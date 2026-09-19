#!/usr/bin/env node
/**
 * Raise the plugin version in every manifest, and the setup version when
 * asked, in one step that fails loudly instead of silently changing nothing.
 *
 *   node scripts/bump.mjs <plugin-version> [--setup <setup-version>]
 *
 * An installed plugin updates only when its version rises, so a bump that
 * does not happen ships nothing to anyone.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = join(ROOT, 'skills/backlog/setup-shady2k-skills');
const [next, flag, setupNext] = process.argv.slice(2);
const semver = /^\d+\.\d+\.\d+$/;
const later = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
if (!semver.test(next || '') || (flag && (flag !== '--setup' || !semver.test(setupNext || '')))) {
  console.error('usage: node scripts/bump.mjs <plugin-version> [--setup <setup-version>]');
  process.exit(2);
}

const manifests = ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json'];
for (const f of manifests) {
  const path = join(ROOT, f);
  const text = readFileSync(path, 'utf8');
  const current = JSON.parse(text).version;
  if (!later(next, current)) {
    console.error(`${f} is at ${current}; ${next} is not later`);
    process.exit(1);
  }
  const bumped = text.replace(`"version": "${current}"`, `"version": "${next}"`);
  if (bumped === text) {
    console.error(`${f}: could not find its version line`);
    process.exit(1);
  }
  writeFileSync(path, bumped);
}

if (setupNext) {
  const protocol = join(SETUP, 'protocol.md');
  const text = readFileSync(protocol, 'utf8');
  const current = (text.match(/^Setup version: (.+)$/m) || [])[1];
  if (!current || !later(setupNext, current)) {
    console.error(`setup version is ${current}; ${setupNext} is not later`);
    process.exit(1);
  }
  writeFileSync(protocol, text.replace(`Setup version: ${current}`, `Setup version: ${setupNext}`));
  for (const f of ['check.mjs', 'check-commits.mjs', 'check-docs.mjs']) {
    const path = join(SETUP, f);
    const code = readFileSync(path, 'utf8');
    const bumped = code.replace(`RULES_VERSION = '${current}'`, `RULES_VERSION = '${setupNext}'`);
    if (bumped === code) {
      console.error(`${f}: RULES_VERSION is not ${current}`);
      process.exit(1);
    }
    writeFileSync(path, bumped);
  }
}
console.log(`plugin ${next}${setupNext ? `, setup ${setupNext}` : ''}; now run npm run protocol${setupNext ? ' and npm run setup-lock' : ''}`);
