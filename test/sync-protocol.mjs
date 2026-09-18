#!/usr/bin/env node
/**
 * The protocol has one source, beside the installer, and a copy in the folder
 * of every skill that links to it: a harness may install skills one folder at
 * a time, so a path out of the folder is a path to nothing. This writes the
 * copies; test/repo.mjs is what fails when one of them has drifted.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'skills/backlog/setup-shady2k-skills/protocol.md');
const walk = (d) =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

for (const skill of walk(join(ROOT, 'skills')).filter((f) => f.endsWith('/SKILL.md'))) {
  const copy = join(dirname(skill), 'protocol.md');
  if (copy === SOURCE || !readFileSync(skill, 'utf8').includes('](protocol.md)')) continue;
  const was = existsSync(copy) ? readFileSync(copy, 'utf8') : null;
  if (was === readFileSync(SOURCE, 'utf8')) continue;
  copyFileSync(SOURCE, copy);
  console.log(`${was === null ? 'wrote  ' : 'updated'} ${relative(ROOT, copy)}`);
}
