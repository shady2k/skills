#!/usr/bin/env node
/**
 * Every file setup installs must be reachable from the installed set, and
 * every installed source file must be named by setup's prose. This walks the
 * local imports of every installed .mjs file and requires each resolved import
 * to be inside the setup skill folder and itself installed; then it requires
 * each installed file's basename to appear in SKILL.md's authoring source
 * (the file setup's prose tells a project to copy must be named there).
 *
 *   node test/setup-imports.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED, LAYOUT, walk } from './setup-installed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = join(ROOT, 'skills/backlog/setup-shady2k-skills');
const AUTHORING = join(ROOT, 'authoring/skills/backlog/setup-shady2k-skills/SKILL.md.in');

// Which installed names (files or directories) cover a relative path.
const installedNames = [...INSTALLED, ...LAYOUT];
const installedFiles = installedNames
  .map((n) => join(SETUP, n))
  .filter(existsSync)
  .flatMap(walk)
  .map((f) => relative(SETUP, f));
const installedSet = new Set(installedFiles);
// A file is installed when it is listed itself or lives under a listed directory.
const isInstalled = (rel) =>
  installedSet.has(rel) ||
  installedNames.some((n) => (rel === n || rel.startsWith(n + '/')));

// Every local import form: `import x from './a.mjs'`, `export … from '../b.mjs'`,
// a side-effect `import './c.mjs'`, and a dynamic `import('./d.mjs')`. A relative
// specifier is `./` or `../`; one that is neither `../` nor `./` is not local.
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const isLocal = (spec) => spec.startsWith('./') || spec.startsWith('../');

const failures = [];
const seen = new Set();
const queue = installedFiles.filter((f) => f.endsWith('.mjs'));
while (queue.length) {
  const rel = queue.pop();
  if (seen.has(rel)) continue;
  seen.add(rel);
  const source = readFileSync(join(SETUP, rel), 'utf8');
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] || match[2];
    if (!spec || !isLocal(spec)) continue;
    const target = resolve(dirname(join(SETUP, rel)), spec);
    const targetRel = relative(SETUP, target);
    if (!existsSync(target)) {
      failures.push(`${rel}: imports ${spec} but ${targetRel} does not exist`);
      continue;
    }
    if (targetRel.startsWith('..')) {
      failures.push(`${rel}: imports ${spec}, which resolves outside ${relative(ROOT, SETUP)}`);
      continue;
    }
    if (!isInstalled(targetRel)) {
      const importer = relative(ROOT, join(SETUP, rel));
      failures.push(`${importer}: imports ${spec}, but ${targetRel} is not in the installed list (test/setup-installed.mjs)`);
      continue;
    }
    if (targetRel.endsWith('.mjs')) queue.push(targetRel);
  }
}

const prose = readFileSync(AUTHORING, 'utf8');
for (const rel of INSTALLED.flatMap((n) => existsSync(join(SETUP, n)) && statSync(join(SETUP, n)).isDirectory() ? walk(join(SETUP, n)).map((f) => relative(SETUP, f)) : [n])) {
  if (rel.endsWith('.mjs') && !prose.includes(rel)) {
    failures.push(`${rel}: installed, but SKILL.md's authoring source never names it`);
  }
}

if (failures.length) {
  for (const f of [...new Set(failures)].sort()) console.log(`FAIL  ${f}`);
  process.exit(1);
}
console.log(`ok  ${installedFiles.length} installed files, all imports installed and named`);
