#!/usr/bin/env node
/**
 * The proof for the tracker store's recovery-backup bound (trackers/br.mjs).
 *
 *   node test/tracker-backups.mjs [--keep] [--scratch <dir>]
 *
 * One br store in a scratch directory (like the mechanism keeps one: a plain
 * folder holding .beads). Items are written into the state file by hand, and
 * the recipe's declared import (`node <br.mjs> import`) brings the database
 * back from it, several times over the way a conditional write does. The
 * proof: the import still imports (the database holds the state file's
 * items), and the recovery backups br leaves behind stay within the bound the
 * recipe prunes them to, so repeated imports do not grow the store without
 * bound. Pruning is a read-side cleanup: the same import run twice prunes to
 * the same steady state.
 *
 * CI has no br, so the script skips cleanly and exits 0 when `br` is not on
 * the PATH. The scratch directory is removed at the end unless --keep. One
 * PASS/FAIL line per case; the script exits non-zero when a case fails — and
 * when no case ran at all.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKTREE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const BR_RECIPE = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/trackers/br.mjs');

const KEEP = process.argv.includes('--keep');
const SCRATCH = (() => {
  const i = process.argv.indexOf('--scratch');
  return i >= 0 ? resolve(process.argv[i + 1]) : `/tmp/tracker-backups-proof-${process.pid}`;
})();
rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

// ------------------------------------------------------------------ results
let failed = 0;
function pass(id, detail = '') { console.log(`PASS ${id}${detail ? ' — ' + detail : ''}`); }
function fail(id, why = '') { console.log(`FAIL ${id}${why ? ' ' + why : ''}`); failed++; }

// br is not on CI's PATH: an absent br is a skip, not a failure.
const probe = spawnSync('br', ['--version'], { encoding: 'utf8', timeout: 120000, shell: false });
if (probe.error || probe.status !== 0) {
  const why = probe.error ? probe.error.message : `exit status ${probe.status}: ${(probe.stderr || probe.stdout || '').trim()}`;
  console.log(`SKIP br not usable here (${why.trim()}); nothing to prove`);
  process.exit(0);
}
if (!existsSync(BR_RECIPE)) {
  console.error(`tracker-backups: ${BR_RECIPE} is missing; there is nothing to prove.`);
  process.exit(2);
}

// ------------------------------------------------------------------ helpers
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8', timeout: 120000 });
  return {
    code: r.status === null ? 127 : r.status,
    stdout: r.stdout || '', stderr: r.stderr || '',
    out: (r.stdout || '') + (r.stderr || ''),
  };
}
// Recipe commands run in the store, the way the mechanism runs them: cwd is the
// store, no arguments name it.
const recipe = (sub, args = [], cwd = store) => sh('node', [BR_RECIPE, sub, ...args], { cwd });
const brHere = (args, cwd = store) => sh('br', ['--no-color', '--no-auto-import', ...args], { cwd });

// The backup files br leaves; every backup carries a run timestamp in its name.
const recoveryDir = () => join(store, '.beads', '.br_recovery');
function backups() {
  const dir = recoveryDir();
  return (existsSync(dir) ? readdirSync(dir) : []).filter((n) => n.endsWith('.bak'));
}
const BACKUP_FILE_BOUND = 60; // the recipe keeps 3 run stamps; ~18 files per run measured on br 0.7.0

// ------------------------------------------------------------------ fixture
const store = join(SCRATCH, 'store');
mkdirSync(store, { recursive: true });
sh('git', ['init', '-q'], { cwd: store });

let initR = recipe('init', ['--prefix', 'tst']);
if (initR.code !== 0) {
  console.error('tracker-backups: the fixture store could not be initialized: ' + initR.out.trim());
  process.exit(2);
}
// Two items through br itself, exported, so the state file starts as the
// tracker wrote it.
brHere(['create', '--title', 'first', '--priority', '1']);
brHere(['create', '--title', 'second', '--priority', '2']);
if (brHere(['sync', '--flush-only']).code !== 0) {
  console.error('tracker-backups: the fixture store could not be exported.');
  process.exit(2);
}

// The record of where an authoritative state comes from: an issue.jsonl line's
// own fields. A hand-edited title is a legitimate reconciled state; the import
// must follow it and the list must show it.
function stateItems() {
  const f = join(store, '.beads', 'issues.jsonl');
  return readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}
function writeStateItems(items) {
  writeFileSync(join(store, '.beads', 'issues.jsonl'), items.map((i) => JSON.stringify(i)).join('\n') + '\n');
}

// ------------------------------------------------------------------ cases
// One loop is what a conditional write does: change the state file, run the
// recipe's import, expect the database to read it back.
const IMPORTS = 6;
const counts = [];
let importBrokeState = null;
let boundBroke = null;
for (let n = 1; n <= IMPORTS; n++) {
  const items = stateItems();
  items[0].title = `edited title ${n}`;
  writeStateItems(items);
  const r = recipe('import');
  if (r.code !== 0) { importBrokeState = `import ${n} failed (${r.code}): ${r.out.trim()}`; break; }
  const list = brHere(['list', '--json']);
  if (list.code !== 0 || !list.stdout.includes(`edited title ${n}`)) {
    importBrokeState = `import ${n} did not bring the state file's title into the database (br list rc ${list.code})`;
    break;
  }
  const found = backups().length;
  counts.push(found);
  if (found > BACKUP_FILE_BOUND) { boundBroke = `import ${n} left ${found} backup files, above the bound ${BACKUP_FILE_BOUND}`; }
}
if (importBrokeState) fail('backups-import-imports', importBrokeState);
else pass('backups-import-imports', `${IMPORTS} successive recipe imports all read the state file's items into the database`);

if (boundBroke) fail('backups-count-bounded', boundBroke);
else pass('backups-count-bounded', `backup files over ${IMPORTS} imports: ${counts.join(', ')} (bound ${BACKUP_FILE_BOUND})`);

// A steady state, not just a bound: two further identical imports, and the
// folder holds no more after the second than after the first — the prune found
// nothing left to delete the second time.
let steadyBroke = null;
const itemsLast = stateItems();
itemsLast[0].title = 'steady state';
writeStateItems(itemsLast);
const a = recipe('import');
const countA = backups().length;
const b = recipe('import');
const countB = backups().length;
if (a.code !== 0 || b.code !== 0) steadyBroke = `a repeat import failed (${a.code} / ${b.code})`;
else if (countA !== countB) steadyBroke = `two identical imports left ${countA} then ${countB} backup files, so the second's prune deleted things the first had already kept differently`;
else if (countB > BACKUP_FILE_BOUND) steadyBroke = `the steady state holds ${countB} backup files, above the bound`;
if (steadyBroke) fail('backups-prune-idempotent', steadyBroke);
else pass('backups-prune-idempotent', `two identical imports leave the same folder: ${countB} backup files`);

// ------------------------------------------------------------------ epilogue
if (!KEEP) rmSync(SCRATCH, { recursive: true, force: true });
if (failed) process.exit(1);
if (failed === 0 && counts.length === 0) { console.log('FAIL backups-no-case-ran — no case ran'); process.exit(1); }
process.exit(0);
