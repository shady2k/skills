#!/usr/bin/env node
// Break real checks in isolated copies; require the intended fixture to fail.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = join(dirname(fileURLToPath(import.meta.url)), '../skills/backlog/setup-shady2k-skills');
const root = mkdtempSync(join(tmpdir(), 'skill-gate-mutations-'));
const mutations = [
  ...['dependency-cycle', 'nonleaf-dependency', 'submitted-without-evidence', 'implemented-without-evidence'].map((id) => ({
    name: id, file: 'check.mjs', failure: `FAIL  bad/${id}.json`,
    change: (code) => {
      const at = code.indexOf(`id: '${id}'`);
      const before = code.slice(0, at);
      const after = code.slice(at).replace('run: (m) =>', 'run: (m) => [] ||');
      return before + after;
    },
  })),
  { name: 'age-correction', file: 'check.mjs', failure: 'FAIL  ages-from: later real work',
    change: (code) => code.replace('old.has(i.id) && after.get(i.id) === i.updatedAt', 'old.has(i.id)') },
  { name: 'commit-missing', file: 'check-commits.mjs', failure: 'FAIL  commits/unlinked.json',
    change: (code) => code.replace('if (!commit.taskIds.length)', 'if (false)') },
  { name: 'commit-unknown', file: 'check-commits.mjs', failure: 'FAIL  commits/unknown.json',
    change: (code) => code.replace("if (!issue) violations.push", "if (!issue) continue; else if (false) violations.push") },
  { name: 'commit-container', file: 'check-commits.mjs', failure: 'FAIL  commits/container.json',
    change: (code) => code.replace("issue.type === 'epic' || parents.has(id)", 'false') },
];

let failures = 0;
for (const mutation of mutations) {
  const dir = join(root, mutation.name);
  cpSync(source, dir, { recursive: true });
  const path = join(dir, mutation.file);
  const original = readFileSync(path, 'utf8');
  const changed = mutation.change(original);
  if (changed === original) throw new Error(`mutation no longer applies: ${mutation.name}`);
  writeFileSync(path, changed);
  const run = spawnSync(process.execPath, [path, '--selftest'], { encoding: 'utf8', timeout: 15000 });
  const killed = run.status === 1 && run.stdout.includes(mutation.failure);
  console.log(`${killed ? 'PASS' : 'FAIL'}  mutation ${mutation.name}: ${killed ? 'caught by intended fixture' : run.error?.message || run.stderr || run.stdout}`);
  if (!killed) failures++;
}
console.log(`Isolated mutation copies: ${root}`);
process.exitCode = failures ? 1 : 0;
