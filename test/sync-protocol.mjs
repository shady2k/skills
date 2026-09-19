#!/usr/bin/env node
/**
 * The protocol and the run journal each have one source, and a copy in the
 * folder of every skill that links to it: a harness may install skills one
 * folder at a time, so a path out of the folder is a path to nothing. This
 * writes the copies; test/repo.mjs is what fails when one of them has drifted.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Each shared file, and the skill folder that owns its source.
export const SHARED = {
  'protocol.md': 'skills/backlog/setup-shady2k-skills',
  'runs.mjs': 'skills/engineering/take-task',
};
const walk = (d) =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

if (process.argv[1] === fileURLToPath(import.meta.url))
  for (const [name, owner] of Object.entries(SHARED)) {
    const source = join(ROOT, owner, name);
    for (const skill of walk(join(ROOT, 'skills')).filter((f) => f.endsWith('/SKILL.md'))) {
      const copy = join(dirname(skill), name);
      if (copy === source || !readFileSync(skill, 'utf8').includes(`](${name})`)) continue;
      const was = existsSync(copy) ? readFileSync(copy, 'utf8') : null;
      if (was === readFileSync(source, 'utf8')) continue;
      copyFileSync(source, copy);
      console.log(`${was === null ? 'wrote  ' : 'updated'} ${relative(ROOT, copy)}`);
    }
  }
