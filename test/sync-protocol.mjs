#!/usr/bin/env node
/**
 * The protocol, its references and the run journal each have one source, and a
 * copy in the folder of every skill that links to it: a harness may install
 * skills one folder at a time, so a path out of the folder is a path to
 * nothing. A skill needs what its SKILL.md links to, and whatever those files
 * link to in turn: the core protocol lists its references, and a reference
 * links the others it names. This writes the copies and removes the ones no
 * link reaches; test/repo.mjs is what fails when one of them has drifted.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = 'skills/backlog/setup-shady2k-skills';
const TAKE = 'skills/engineering/take-task';
// Each shared file, by its path inside a skill folder, and the folder that owns its source.
export const SHARED = {
  'protocol.md': SETUP,
  ...Object.fromEntries(readdirSync(join(ROOT, SETUP, 'references')).map((n) => [`references/${n}`, SETUP])),
  'time-format.mjs': SETUP,
  'runs.mjs': TAKE,
  'ledger.mjs': TAKE,
};

// The shared files a skill links to, directly or through another shared file.
export function needs(skill) {
  const found = new Set();
  const follow = (from, text) => {
    for (const [, target] of text.matchAll(/\]\(([^)#\s]+)\)/g)) {
      const path = relative(skill, join(skill, dirname(from), target));
      if (!(path in SHARED) || found.has(path)) continue;
      found.add(path);
      if (path.endsWith('.md')) follow(path, readFileSync(join(ROOT, SHARED[path], path), 'utf8'));
    }
  };
  follow('SKILL.md', readFileSync(join(skill, 'SKILL.md'), 'utf8'));
  return found;
}

export const skillFolders = () => {
  const walk = (d) =>
    readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  return walk(join(ROOT, 'skills')).filter((f) => f.endsWith('/SKILL.md')).map((f) => dirname(f));
};

if (process.argv[1] === fileURLToPath(import.meta.url))
  for (const skill of skillFolders()) {
    const needed = needs(skill);
    for (const [path, owner] of Object.entries(SHARED)) {
      if (join(ROOT, owner) === skill) continue;
      const copy = join(skill, path);
      const was = existsSync(copy) ? readFileSync(copy, 'utf8') : null;
      if (!needed.has(path)) {
        if (was !== null) {
          rmSync(copy);
          console.log(`removed ${relative(ROOT, copy)}`);
        }
        continue;
      }
      const source = join(ROOT, owner, path);
      if (was === readFileSync(source, 'utf8')) continue;
      mkdirSync(dirname(copy), { recursive: true });
      copyFileSync(source, copy);
      console.log(`${was === null ? 'wrote  ' : 'updated'} ${relative(ROOT, copy)}`);
    }
    // A reference whose source was renamed or removed is no longer in SHARED;
    // a skill's references/ holds only copies, so anything unreached goes.
    const refs = join(skill, 'references');
    if (join(ROOT, SETUP) !== skill && existsSync(refs))
      for (const n of readdirSync(refs))
        if (!needed.has(`references/${n}`)) {
          rmSync(join(refs, n), { recursive: true });
          console.log(`removed ${relative(ROOT, join(refs, n))}`);
        }
    if (existsSync(refs) && !readdirSync(refs).length) rmSync(refs, { recursive: true });
  }
