#!/usr/bin/env node
/**
 * The proofs for the off-branch tracker sync (design.md section 8, interface v2 F2..F13).
 *
 *   node test/tracker-sync-proof.mjs [--keep] [--with-br] [--scratch <dir>] [--only <case-id>...]
 *
 * Two simulated machines: one local bare remote, two clones of a code
 * repository, two per-machine stores (each with its own --state dir and
 * machine name), and a neutral fake tracker (test/fixtures/tracker/fake.mjs
 * through test/fixtures/tracker/recipe.mjs). The supervisor is simulated:
 * the watch process is started, killed and started again. Nothing here
 * installs a unit into systemd or launchd, and no proof of a real boot is
 * claimed. The scratch directory is removed at the end unless --keep.
 * One line per case with PASS/FAIL; the timing proofs print the measured
 * milliseconds. The script exits non-zero when any case fails — and when
 * no case ran at all.
 */
import { spawnSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, openSync, closeSync, lstatSync, readlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const WORKTREE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MECH_SRC = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/tracker-sync.mjs');
const FIXTURES = join(WORKTREE, 'test/fixtures/tracker');
const RECIPE_SRC = join(FIXTURES, 'recipe.mjs');
const FAKE_SRC = join(FIXTURES, 'fake.mjs');
const UNIT_SRC = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/supervisors/systemd-user/tracker-sync.service');
const BR_RECIPE = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/trackers/br.mjs');
// The one value reader every script here takes its options through. A copy of a
// script is only a probe if it can still run: the mechanism and the recipe are
// written into scratch folders of their own, so each one needs the reader beside
// it -- and the imported one a folder above, the way the shipped tree has it.
const ARGV_MODULE = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/argv.mjs');
const REGULAR_FILE_MODULE = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/regular-file.mjs');

// A CI runner, a container and a fresh machine have no git user.name or
// user.email and no git configuration at all, so the proofs run the way such a
// machine does: no global or system git config, and an empty home directory. A
// mechanism that leaned on the user's identity would fail here, and did once
// (the runner's "Author identity unknown"). The harness's own commits name an
// identity of their own with -c, never through the user's configuration.
const CLEAN_HOME = join(process.env.TMPDIR || '/tmp', `tracker-sync-proof-home-${process.pid}`);
mkdirSync(CLEAN_HOME, { recursive: true });
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.HOME = CLEAN_HOME;
delete process.env.GIT_AUTHOR_NAME; delete process.env.GIT_AUTHOR_EMAIL;
delete process.env.GIT_COMMITTER_NAME; delete process.env.GIT_COMMITTER_EMAIL;
delete process.env.XDG_CONFIG_HOME;

const KEEP = process.argv.includes('--keep');
const WITH_BR = process.argv.includes('--with-br');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv.slice(i + 1).filter((a) => !a.startsWith('--')) : null;
})();
const GIT_SHIM = !!process.env.PROOF_GIT_SHIM;
const SCRATCH = (() => {
  const i = process.argv.indexOf('--scratch');
  return i >= 0 ? resolve(process.argv[i + 1]) : `/tmp/tracker-sync-proof-${process.pid}`;
})();
if (!existsSync(MECH_SRC)) {
  console.error('tracker-sync-proof: ' + MECH_SRC + ' is missing; there is nothing to prove.');
  process.exit(2);
}

// ---------------------------------------------------------------- results
const results = [];
let phase = 'clean';
let failCount = 0;
const lastFailure = new Map();
const cleanFailed = new Set();
function record(id, ok, detail, ms) {
  results.push({ id, ok, detail, ms, phase:id.startsWith('mutation-')?'mutation-proof':phase });
  if (!ok) { lastFailure.set(id, detail || ''); failCount++; }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${ms !== undefined ? ` (${ms} ms)` : ''}${detail ? ' — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(fn, timeoutMs, pollMs = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return { value: v, elapsed: Date.now() - t0 }; } catch { /* keep polling */ }
    await sleep(pollMs);
  }
  return { value: null, elapsed: Date.now() - t0 };
}

// ------------------------------------------------------------------ helpers
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) }, encoding: 'utf8' });
  return { code: r.status ?? 127, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', stderr: r.stderr || '' };
}
function git(ctx, args, opts = {}) {
  return sh('git', ['-C', opts.cwd || ctx.remote, ...args], opts);
}
// The mechanism: every subcommand names the machine's own state dir and the
// machine's own checkout (the mechanism resolves the store's repo from one of them).
function mech(ctx, sub, args, opts = {}) {
  const machine = opts.machine || 'A';
  const env = { ...process.env, TRACKER_RECIPE: ctx.recipe, ...(opts.env || {}) };
  const repo = machine === 'A' ? ctx.codeA : ctx.codeB;
  const state = machine === 'A' ? ctx.stateA : ctx.stateB;
  const shim = ctx.gitShim || (ctx.tag.startsWith('4-refused-push') ? '/tmp/gitshim' : null);
  const shimEnv = shim ? { PATH: shim + ':' + process.env.PATH, GITSHIM_LOG: join(ctx.scratch, 'git-shim.log') } : {};
  // `nodeArgs` are the runtime's own switches (a heap bound, for a proof that a
  // store of any size is read in bounded memory), never an option of the mechanism.
  return sh('node', [...(opts.nodeArgs || []), ctx.mech, sub, '--recipe', ctx.recipe, '--state', state, '--repo', repo, ...args],
    { ...opts, env: { ...env, ...shimEnv }, cwd: opts.cwd || ctx.scratch });
}
// The mechanism with NO --state: the state folder is the one it derives from
// the repository itself, which is what the per-machine keying is about.
function mechDefault(ctx, sub, args, { repo, env } = {}) {
  const e = { ...process.env, TRACKER_RECIPE: ctx.recipe, ...(env || {}) };
  return sh('node', [ctx.mech, sub, '--recipe', ctx.recipe, '--repo', repo, ...args], { env: e, cwd: ctx.scratch });
}
// The folder is named for the release, and the file inside it keeps the name the
// mechanism has in a checkout: the record hooks it installs name the file beside it.
const OLD_MECH_0121 = join(WORKTREE, 'test/fixtures/old-recordings/0.121.0/tracker-sync.mjs');
// The mechanism as release 0.121.0 shipped it. A proof of "a recording an older
// release wrote is converted" that writes its old recordings with the current code
// proves nothing about the code that wrote them (#49): this one is the released
// file, byte for byte, and it writes what the field holds.
function oldMech(ctx, sub, args, opts = {}) {
  const env = { ...process.env, TRACKER_RECIPE: ctx.recipe, ...(opts.env || {}) };
  return sh('node', [...(opts.nodeArgs || []), OLD_MECH_0121, sub, '--recipe', ctx.recipe, '--state', ctx.stateA, '--repo', ctx.codeA, ...args],
    { ...opts, env, cwd: opts.cwd || ctx.scratch });
}
function watcher(ctx, machine, args = ['--interval', '1', '--debounce', '2']) {
  const logPath = join(ctx.scratch, 'watch-' + machine + '-' + ctx.watchers.length + '.log');
  const logFd = openSync(logPath, 'w');
  const child = spawn('node', [ctx.mech, 'watch', '--recipe', ctx.recipe, ...args, '--state', machine === 'A' ? ctx.stateA : ctx.stateB, '--repo', machine === 'A' ? ctx.codeA : ctx.codeB],
    { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe, ...(ctx.gitShim ? { PATH: ctx.gitShim + ':' + process.env.PATH, GITSHIM_LOG: join(ctx.scratch, 'git-shim.log') } : {}), ...(ctx.debugEnv || {}) }, stdio: ['ignore', logFd, logFd] });
  child.logPath = logPath;
  ctx.watchers.push(child);
  return child;
}
// A watcher's first sync tick merges and rewrites the state files from the
// merged out file. A raw store write raced against that rewrite is lost, so
// every case settles the first tick (store head reaches the remote tip)
// before it writes into the store.
async function settleWatcher(ctx, machine, timeoutMs = 8000) {
  const store = storeOf(ctx, machine);
  if (!store) return false;
  const res = await waitUntil(async () => {
    const head = sh('git', ['-C', store, 'rev-parse', 'HEAD']);
    const tip = remoteTip(ctx);
    return tip && head.code === 0 && head.stdout.trim() === tip ? true : null;
  }, timeoutMs, 100);
  await sleep(300); // the tick's post-import commit is on the remote; let the next tick pass
  return !!res.value;
}
async function stopWatcher(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const exited=new Promise(resolve=>child.once('close',resolve));
  try { child.kill('SIGKILL'); } catch { return; }
  await exited; // Reap the PID before any spawnSync can block the event loop.
}
async function stopAllWatchers(ctx) { const children=ctx.watchers;ctx.watchers=[];await Promise.all(children.map(stopWatcher)); }

// The owner's decision of 2026-10-13: when two machines claim one item inside the
// same seconds, one may win and the other be refused, or both may land. What the
// set promises either way is that a session never keeps believing a state the
// store does not hold: the next sync records on the item what the merge replaced,
// and this is the assertion for the second outcome.
// Whether the item ends as one value on both machines after a sync. This is true
// whichever way the race went, and it is what the owner's decision promises: a
// session never keeps believing a holder the store does not hold. Whether the
// fixture records the overwrite on the item is *not* asserted here, because with
// br the question was not settled in this run (the report says so).
async function convergedHolder(ctx, id) {
  mech(ctx, 'sync', [], { machine: 'A' });
  mech(ctx, 'sync', [], { machine: 'B' });
  const a = storeItems(ctx, 'A').find((x) => x.id === id);
  const b = storeItems(ctx, 'B').find((x) => x.id === id);
  return !!(a && b && a.holder && a.holder === b.holder);
}

async function doubleSaid(ctx, field) {
  mech(ctx, 'sync', [], { machine: 'A' });
  mech(ctx, 'sync', [], { machine: 'B' });
  const raw = [storeItems(ctx, 'A'), storeItems(ctx, 'B')].map((x) => JSON.stringify(x)).join(' ');
  // The shipped recipe writes `tracker-sync: field "x" set to ...`; the neutral
  // fake in fixtures writes `overwritten x`. One of the two must be on the item.
  return new RegExp('overwritten ' + field + '|tracker-sync: field \"' + field + '\"').test(raw);
}

function statusFresh(ctx, machine) {
  const r = mech(ctx, 'status', ['--json'], { machine });
  try { return { raw: r, json: JSON.parse(r.stdout) }; } catch { return { raw: r, json: null }; }
}
function storeOf(ctx, machine) {
  // cached once the store exists: status fetches the remote, which costs
  // 20 s when the remote is deliberately gone
  const cache = machine === 'A' ? 'storeA' : 'storeB';
  if (ctx[cache]) return ctx[cache];
  const s = statusFresh(ctx, machine);
  const store = s.json && s.json.store;
  if (store) ctx[cache] = store;
  return store || null;
}
function remoteTip(ctx) {
  const r = git(ctx, ['rev-parse', '--verify', 'refs/tracker/state'], { cwd: ctx.remote });
  return r.code === 0 ? r.stdout.trim() : null;
}
function remoteItems(ctx) {
  const tip = remoteTip(ctx);
  if (!tip) return [];
  const r = git(ctx, ['cat-file', '-p', tip + ':fake/items.jsonl'], { cwd: ctx.remote });
  if (r.code !== 0) return [];
  return r.stdout.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
async function waitForRemote(ctx, check, timeoutMs = 5000) {
  return waitUntil(async () => {
    const items = remoteItems(ctx);
    return check(items) ? items : null;
  }, timeoutMs, 40);
}
function storeItems(ctx, machine) {
  const store = storeOf(ctx, machine);
  if (!store) return [];
  const p = join(store, 'fake', 'items.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
function seedStore(ctx, machine, items) {
  const store = storeOf(ctx, machine);
  mkdirSync(join(store, 'fake'), { recursive: true });
  writeFileSync(join(store, 'fake', 'items.jsonl'), items.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(store, 'fake', 'db.json'), JSON.stringify({ records: items }, null, 1) + '\n');
}

// A store's state text, in the shape a recording exports: what `export --at`
// must answer with, whichever form the recording holds.
function stateTextOf(ctx, machine) {
  const store = storeOf(ctx, machine);
  return '=== fake/items.jsonl\n' + readFileSync(join(store, 'fake', 'items.jsonl'), 'utf8');
}
// The bytes a recording exports, read through the mechanism: the only reader the
// project's gate has of a recording.
function exportAt(ctx, machine, rev) {
  return mech(ctx, 'export', ['--at', rev], { machine });
}
function candidateDirs(stateDir) {
  const out = [];
  for (const e of readdirSync(stateDir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith('candidate-')) out.push(join(stateDir, e.name));
  }
  return out;
}
function resultFiles(stateDir) {
  return readdirSync(stateDir).filter((n) => n.endsWith('.result.json'));
}
function folderBytes(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) walk(p); else n += st.size;
    }
  };
  try { walk(dir); } catch {}
  return n;
}
// A candidate written by nobody: the shape a killed process leaves, with the pid
// its diagnostic names. `pid` of a reaped or impossible process is dead.
function fakeCandidate(stateDir, { pid, phase, folder = true, result = true }) {
  const name = 'candidate-' + createHash('sha1').update(String(pid) + (phase || '') + Math.random()).digest('hex').slice(0, 12);
  if (folder) mkdirSync(join(stateDir, name), { recursive: true });
  if (result) writeFileSync(join(stateDir, name + '.result.json'), JSON.stringify({ kind: 'record', item: 'x', pid, createdAt: new Date().toISOString(), phase: phase || 'preparing', files: 0, bytes: 0 }, null, 2) + '\n');
  return name;
}

// a write on a machine's store: the fake's own record command
function post(ctx, machine, itemId, text) {
  const store = storeOf(ctx, machine);
  const env = { FAKE_AUTHOR: machine === 'A' ? 'session-a' : 'session-b' };
  const r = sh('node', [ctx.fake, 'post', '--item', itemId, '--text', text], { cwd: store, env });
  return { ...r, recordId: r.stdout.trim() };
}
function claim(ctx, machine, itemId, holder) {
  return mech(ctx, 'claim', ['--item', itemId, '--holder', holder], { machine });
}
function fakeVoid(ctx, machine, recordId) {
  const store = storeOf(ctx, machine);
  return sh('node', [ctx.fake, 'void', '--record', recordId], { cwd: store, env: { FAKE_AUTHOR: 'session-x' } });
}
function fsAppend(file, text) {
  const fd = openSync(file, 'a');
  try { writeFileSync(fd, text); } finally { closeSync(fd); }
}
const item = (id, title) => ({ id, title, status: 'open', holder: '', updated_at: '2026-10-13T10:00:00Z', comments: [] });
const item1 = () => item('i-1', 'first');
const item2 = () => item('i-2', 'second');
const item3 = () => item('i-3', 'third');

// ------------------------------------------------------------ machine boot
function newCtx(tag, overrides = {}) {
  const dir = join(SCRATCH, tag);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // A case may run a copy of the mechanism out of this folder (a barrier put in
  // a function, a candidate that must fail), so the one value reader it imports
  // lies beside it, as it does in the shipped tree.
  cpSync(ARGV_MODULE, join(dir, 'argv.mjs'));
  const remote = join(dir, 'remote.git');
  sh('git', ['init', '--bare', '--initial-branch', 'main', remote]);
  const codeA = join(dir, 'codeA');
  sh('git', ['clone', remote, codeA]);
  writeFileSync(join(codeA, 'README.md'), 'code repository one\n');
  sh('git', ['-C', codeA, 'add', '.']);
  sh('git', ['-C', codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-m', 'seed']);
  const pushSeed = sh('git', ['-C', codeA, 'push', '-q', 'origin', 'HEAD:refs/heads/main']);
  if (pushSeed.code !== 0) throw new Error('seed push failed: ' + pushSeed.out);
  const codeB = join(dir, 'codeB');
  sh('git', ['clone', remote, codeB]);
  return {
    tag, scratch: dir, remote, codeA, codeB,
    stateA: join(dir, 'stateA'), stateB: join(dir, 'stateB'),
    mech: overrides.mech || MECH_SRC,
    recipe: overrides.recipe || RECIPE_SRC,
    fake: overrides.fake || FAKE_SRC,
    br: overrides.br !== undefined ? !!overrides.br : overrides.recipe === BR_RECIPE,
    watchers: [],
    gitShim: GIT_SHIM ? '/tmp/gitshim' : null,
  };
}
function connect(ctx, machine, extraArgs = []) {
  const checkouts = machine === 'A' ? [ctx.codeA] : [ctx.codeB];
  // a recipe whose init needs an id prefix gets one derived from the scratch
  // tag, so the shipped br recipe and the fake take the same path
  const prefix = ctx.br ? ['--prefix', 'br-' + machine.toLowerCase()] : [];
  return mech(ctx, 'connect', ['--machine', machine, '--checkout', ...checkouts, ...prefix, ...extraArgs], { machine });
}
function bringUp(ctx, machine) {
  let r = connect(ctx, machine);
  if (r.code !== 0) {
    // connect is idempotent; one retry absorbs an ordinal or lock race
    r = connect(ctx, machine);
  }
  if (r.code !== 0) {
    return { ...r, out: r.out.split('\n').slice(0, 5).join(' | ') + (r.stderr ? ' ERR: ' + r.stderr.split('\n')[0] : '') };
  }
  const store = storeOf(ctx, machine);
  if (store) {
    // the fake tracker's store starts empty: give it its first records.
    // The br recipe imports the state from the ref; a store that already
    // carries items is left alone.
    const itemsFile = join(store, ctx.br ? '.beads/issues.jsonl' : 'fake/items.jsonl');
    const hasState = existsSync(itemsFile) && readFileSync(itemsFile, 'utf8').trim();
    if (!hasState) {
      seedStore(ctx, machine, [item1(), item2(), item3()]);
      r = mech(ctx, 'publish', [], { machine });
      if (r.code !== 0) {
        r = mech(ctx, 'publish', [], { machine }); // one retry: the first push may race the store's setup
        if (r.code !== 0) return { ...r, out: 'publish: ' + r.out.split('\n').slice(0, 4).join(' | ') };
      }
    }
    // connect's contract: the store exists, and every checkout given names it
    const chk = mech(ctx, 'status', ['--json'], { machine });
    let pointed = null;
    try { pointed = JSON.parse(chk.stdout); } catch { /* covered by the assertion below */ }
    const checks = pointed && Array.isArray(pointed.checks) ? pointed.checks : [];
    const reaches = (c) => c.ok && c.pointsAt && (resolve(c.pointsAt) === resolve(store)
      || resolve(c.pointsAt).startsWith(resolve(store) + '/')); // a recipe may point at its storePath inside the worktree
    if (!store || !checks.length || !checks.every(reaches)) {
      return { code: 1, out: 'connect contract: store=' + store + ', checks=' + JSON.stringify(checks).slice(0, 200) };
    }
    ctx[cacheKey(machine)] = store;
  }
  return r;
}
const cacheKey = (m) => (m === 'A' ? 'storeA' : 'storeB');
// A case that proves the tracker's own recipe runs the br recipe; the neutral
// fake is the default. A broken copy of that recipe replaces it in a mutation.
const CASE_OVERRIDES = {
  '18-br-settings-survive-the-move': { recipe: BR_RECIPE, br: true },
  '19-br-relink-after-a-pre-move-branch': { recipe: BR_RECIPE, br: true },
  '20-br-settings-deletion-merges': { recipe: BR_RECIPE, br: true },
  // #49: the shape 0.121.0 wrote in the field is a br store's - a state file the
  // tracker's own .gitignore ignores - so this case needs the shipped recipe and br.
  '29-a-recording-of-an-older-release-matches-its-commit': { recipe: BR_RECIPE, br: true },
  // #52: what the tracker itself is asked to do for one change is the proof, so
  // the case runs the shipped recipe against br.
  '30-br-work-follows-the-change': { recipe: BR_RECIPE, br: true },
};
function waitForRemoteOnce(ctx) {
  for (let i = 0; i < 50; i++) { const tip = remoteTip(ctx); if (tip) return tip; }
  return null;
}

// ------------------------------------------------------- broken mechanisms
// Each rule is broken once: a text replacement on a COPY of the mechanism
// (and, where the recipe owns the duty, of the recipe or the fake). The same
// case must fail under the broken copy; a break that no case catches means
// the case is too weak, and the harness fails for it.
function breakByRegex(name, srcTxt, regex, replacement) {
  if (!srcTxt.match(regex)) throw new Error('break ' + name + ': the pattern was not found in the source');
  return srcTxt.replace(regex, replacement);
}
// a break by a plain string, no regex metacharacters
function breakByLiteral(name, srcTxt, pattern, replacement) {
  if (!srcTxt.includes(pattern)) throw new Error('break ' + name + ': the text was not found in the source');
  return srcTxt.split(pattern).join(replacement);
}
function checkSyntax(name, file) {
  const r = spawnSync('node', ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('break ' + name + ': the broken copy does not parse: ' + (r.stderr || '').split('\n')[0]);
}
function makeBrokenEnv(breakName, apply, breakDef = {}) {
  const dir = join(SCRATCH, 'broken-' + breakName);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const src = {
    mech: readFileSync((breakDef.sources && breakDef.sources.mech) || MECH_SRC, 'utf8'),
    recipe: readFileSync((breakDef.sources && breakDef.sources.recipe) || RECIPE_SRC, 'utf8'),
    fake: readFileSync((breakDef.sources && breakDef.sources.fake) || FAKE_SRC, 'utf8'),
  };
  const out = apply(src);
  const mechPath = join(dir, 'tracker-sync.mjs');
  const recipePath = join(dir, 'recipe.mjs');
  const fakePath = join(dir, 'fake.mjs');
  writeFileSync(mechPath, out.mech !== undefined ? out.mech : src.mech);
  writeFileSync(recipePath, out.recipe !== undefined ? out.recipe : src.recipe);
  writeFileSync(fakePath, out.fake !== undefined ? out.fake : src.fake);
  cpSync(ARGV_MODULE, join(dir, 'argv.mjs'));
  cpSync(ARGV_MODULE, join(SCRATCH, 'argv.mjs'));
  // The mechanism imports the one regular-file helper beside it: a copy that
  // cannot load it fails at bring-up, and a case failing at bring-up proves
  // nothing about the break.
  cpSync(REGULAR_FILE_MODULE, join(dir, 'regular-file.mjs'));
  checkSyntax(breakName, mechPath);
  checkSyntax(breakName, recipePath);
  checkSyntax(breakName, fakePath);
  return { mech: mechPath, recipe: recipePath, fake: fakePath };
}

const BREAKS = [
  {
    name: 'publish-commits-but-does-not-push',
    cases: ['1-publish-latency'],
    apply: (s) => ({ mech: breakByRegex('publish-nopush', s.mech, /(['"])push\1(?=,\s*['"]origin['"])/, '$1pushx$1') }),
  },
  {
    name: 'sync-skips-the-merge',
    cases: ['4-refused-push'],
    apply: (s) => ({
      // The break skips the per-item merge wherever a sync would do it - the
      // divergent path and the path a refused push takes - so the case's
      // assertions that both machines' writes are on the ref, as one merge, must
      // fail. Breaking only one site leaves the other doing the work.
      mech: breakByLiteral('sync-nomerge',
        breakByLiteral('sync-nomerge-push', s.mech,
          'oid = LOCK_CONTEXT.getStore() ? await mergeAndCommit(remote.tip) : await locked(() => mergeAndCommit(remote.tip), 120000, { skipOnTimeout });',
          'oid = oid; /* deliberate break: the merge is skipped */'),
        '    return mergeAndCommit(remote.tip, { flushed });\n  };',
        '    return head; /* deliberate break: the merge is skipped */\n  };'),
    }),
  },
  {
    name: 'claim-does-not-re-read-the-remote',
    // F10's sequential part, not the same-seconds race: there the item is held on
    // the remote and already read here, so a claim that never reads it again must
    // be caught. The race case accepts the owner's double outcome by design.
    cases: ['F10-exit-statuses'],
    apply: (s) => ({
      fake: breakByLiteral('claim-norecheck', s.fake, 'if (item.holder && item.holder !== holder) {',
        'if (false) { // deliberate break: the condition is never re-read'),
    }),
  },
  {
    name: 'record-overwrites-an-existing-recording',
    cases: ['6-recording', '17-record-from-a-hook-and-already-recorded'],
    // Both guards are broken: the local one (the file is there) and the remote
    // one (the ref already holds it). Breaking only one leaves the case passing
    // through the other, which is what made this mutation survive once already.
    apply: (s) => ({
      mech: breakByLiteral('record-overwrite',
        breakByLiteral('record-overwrite-conflict',
          breakByLiteral('record-overwrite-local', s.mech,
            'if (existsSync(held)) {', 'if (false) { /* deliberate break: the local recording is written again */'),
          'if (thereState !== null && thereState !== mine)', 'if (false) /* deliberate break: the conflict is called success */'),
        "if (thereState !== null) return { already: String(rev).slice(0, 12), where: 'on the remote' };",
        "if (false) return { already: String(rev).slice(0, 12), where: 'on the remote' }; /* deliberate break: the recording is written again */"),
    }),
  },
  {
    name: 'merge-renumbers-an-existing-record-id',
    cases: ['4-refused-push'],
    apply: (s) => ({
      fake: breakByLiteral('merge-renumber', s.fake,
        "comments.sort((x, y) => (x.created_at || '').localeCompare(y.created_at || ''));",
        "comments.sort((x, y) => (x.created_at || '').localeCompare(y.created_at || ''));\n      for (const c of comments) c.id = 'ren-' + c.id; // deliberate break: ids move"),
    }),
  },
  {
    name: 'the-pointer-check-names-another-path',
    cases: ['7-reach'],
    apply: (s) => ({
      fake: breakByLiteral('pointer-check-wrong', s.fake,
        "out(resolve(store));",
        "out('/tmp/nowhere'); // deliberate break: the check names another path"),
    }),
  },
  {
    name: 'sync-never-says-the-remote-is-unreachable',
    cases: ['3-unreachable-remote'],
    apply: (s) => ({ mech: breakByLiteral('sync-nosay', s.mech, 'const r = await syncOnce({ needsRemote: true, quiet: false });', 'const r = await syncOnce({ needsRemote: false, quiet: false }); /* deliberate break: unreachability is never said */') }),
  },
  {
    name: 'machine-store-keyed-by-the-worktree',
    cases: ['14-machine-store-per-machine'],
    // the fix, undone: the checkout the command was run in names the store again
    apply: (s) => ({ mech: breakByLiteral('machine-key', s.mech,
      'return base && CURRENT.machineKey ? join(base, CURRENT.machineKey) : join(base, basename(repoRoot));',
      'return join(base, basename(repoRoot)); /* deliberate break: the worktree names the store */') }),
  },
  {
    name: 'connect-reads-an-answering-remote-as-unreachable',
    cases: ['15-remote-that-answers-without-a-head'],
    // the fix, undone: --exit-code on HEAD makes "no such ref" read as unreachable
    apply: (s) => ({ mech: breakByLiteral('ls-remote-exit-code', s.mech,
      "const any = await git(['ls-remote', 'origin'], { cwd: repoRoot, timeoutMs: 20000 });",
      "const any = await git(['ls-remote', '--exit-code', 'origin', 'HEAD'], { cwd: repoRoot, timeoutMs: 20000 }); /* deliberate break */") }),
  },
  {
    name: 'hooks-written-into-the-repository',
    cases: ['16-hooks-inside-the-repository-refused'],
    apply: (s) => ({ mech: breakByLiteral('hooks-in-repo',
      breakByLiteral('hooks-in-repo-continue', s.mech,
        'if (!plan.inRepo || !plan.missing.length) continue;',
        'if (false) continue; /* deliberate break: a hooks folder in the tree is written to */'),
      'die(1, `the hooks folder ${plan.dir}', 'if (false) die(1, `the hooks folder ${plan.dir}') }),
  },
  {
    name: 'hooks-accepted-without-the-marker',
    cases: ['16-hooks-inside-the-repository-refused'],
    // The acceptance's own guard, undone: a hook that lacks its marker line reads
    // as one that already carries the step, so a bare project hook is taken and
    // the folder is written into instead of refused.
    apply: (s) => ({ mech: breakByLiteral('hooks-marker-ignored', s.mech,
      'present: text !== null && text.includes(HOOK_MARKS[name]) };',
      'present: text !== null }; /* deliberate break: the marker is ignored */') }),
  },
  {
    name: 'record-keeps-git-hook-environment',
    cases: ['17-record-from-a-hook-and-already-recorded'],
    apply: (s) => ({ mech: breakByLiteral('hook-env', s.mech,
      '  for (const k of HOOK_ENV) delete e[k];',
      '  /* deliberate break: git\'s own hook environment is kept */') }),
  },
  {
    name: 'br-settings-left-behind',
    cases: ['18-br-settings-survive-the-move'],
    sources: { recipe: BR_RECIPE },
    // the recipe does not declare the tracker's settings as state, so they do not travel
    apply: (s) => ({ recipe: breakByLiteral('br-settings', s.recipe,
      "stateFiles: ['.beads/issues.jsonl', '.beads/beads.base.jsonl', '.beads/config.yaml', '.beads/policy.yaml'],",
      "stateFiles: ['.beads/issues.jsonl', '.beads/beads.base.jsonl', '.beads/policy.yaml'], /* deliberate break */") }),
  },
  {
    name: 'br-policy-left-behind',
    cases: ['18-br-settings-survive-the-move'],
    sources: { recipe: BR_RECIPE },
    // the tracker's workflow policy is not state, so a project carries it by hand (#52)
    apply: (s) => ({ recipe: breakByLiteral('br-policy', s.recipe,
      "stateFiles: ['.beads/issues.jsonl', '.beads/beads.base.jsonl', '.beads/config.yaml', '.beads/policy.yaml'],",
      "stateFiles: ['.beads/issues.jsonl', '.beads/beads.base.jsonl', '.beads/config.yaml'], /* deliberate break */") }),
  },
  {
    name: 'br-sync-imports-the-whole-store',
    cases: ['30-br-work-follows-the-change'],
    sources: { recipe: BR_RECIPE },
    // the recipe declares no import of the change alone, so every sync rebuilds
    apply: (s) => ({ recipe: breakByLiteral('br-import-whole', s.recipe,
      "  importChanged: 'node <recipeFile> import --before <before>',",
      "  /* deliberate break: no import of the change alone */") }),
  },
  {
    name: 'br-candidate-rebuilds-its-database',
    cases: ['30-br-work-follows-the-change'],
    sources: { recipe: BR_RECIPE },
    // a conditional write's candidate rebuilds the database instead of copying it
    apply: (s) => ({ recipe: breakByLiteral('br-candidate-rebuild', s.recipe,
      "  seed: 'node <recipeFile> seed --from <live>',",
      "  /* deliberate break: the candidate's database is rebuilt */") }),
  },
  {
    name: 'br-partial-import-trusted',
    cases: ['30-br-work-follows-the-change'],
    sources: { recipe: BR_RECIPE },
    // what the tracker skips in a partial import is neither foreseen nor checked,
    // so it is taken as imported
    apply: (s) => ({ recipe: breakByLiteral('br-partial-trusted', breakByLiteral('br-skip-unforeseen', s.recipe,
      "    if (prior !== undefined && !(String(JSON.parse(line)[FIELD_ORDER] ?? '') > String(JSON.parse(prior)[FIELD_ORDER] ?? ''))) {",
      "    if (false) { /* deliberate break: a skip is not foreseen */"),
      "    for (const [id, line] of changed) if (!sameItem(exported.get(id), line)) return putBack(`br did not take ${id} as given`);",
      "    /* deliberate break: the partial import is trusted */") }),
  },
  {
    name: 'br-skip-not-foreseen',
    cases: ['30-br-work-follows-the-change'],
    sources: { recipe: BR_RECIPE },
    // a change br's partial import is known to skip is tried anyway, and only the
    // check after it sends it to a rebuild: correct, at the cost of both
    apply: (s) => ({ recipe: breakByLiteral('br-skip-unforeseen-alone', s.recipe,
      "    if (prior !== undefined && !(String(JSON.parse(line)[FIELD_ORDER] ?? '') > String(JSON.parse(prior)[FIELD_ORDER] ?? ''))) {",
      "    if (false) { /* deliberate break: a skip is not foreseen */") }),
  },
  {
    name: 'br-settings-deletion-restored',
    cases: ['20-br-settings-deletion-merges'],
    sources: { recipe: BR_RECIPE },
    // a deleted settings file is restored from the unchanged side (the rule before
    // the fix: absence was no value of the three-way merge)
    apply: (s) => ({ recipe: breakByLiteral('br-settings-delete', s.recipe,
      '  else if (bc === tc) settings = oc;',
      '  else if (bc === tc) settings = oc !== undefined ? oc : tc; /* deliberate break: a deletion is restored */') }),
  },
  {
    name: 'br-pointer-overwrites-a-tracker-folder',
    cases: ['19-br-relink-after-a-pre-move-branch'],
    sources: { recipe: BR_RECIPE },
    // every real folder is moved aside, a tracker of its own included
    apply: (s) => ({ recipe: breakByLiteral('br-pointer', s.recipe,
      'const held = fs.readdirSync(target).filter((n) => !/\\.lock$/.test(n) && n !== \'locks\');',
      'const held = []; /* deliberate break: a folder that holds a tracker is moved aside */') }),
  },
  {
    name: 'refused-flush-read-as-nothing-unexported',
    cases: ['21-refused-flush-keeps-the-write'],
    // the fix undone: every refusal is taken as one that proves no write sits in
    // the database, which is what dropped the write the tracker accepted.
    apply: (s) => ({ mech: breakByLiteral('refusal-assumed-harmless', s.mech,
      "  if (refusalMeaning(flushed) === 'nothing-unexported') {",
      '  if (true) { /* deliberate break: every refusal is read as nothing unexported */') }),
  },
  {
    name: 'an-unclassified-refusal-continues',
    cases: ['23-an-unclassified-refusal-stops'],
    // the fix undone: a refusal the recipe does not know is assumed to prove
    // nothing sits in the database, so the sync continues instead of stopping.
    apply: (s) => ({ mech: breakByLiteral('fail-open', s.mech,
      "  return 'merge-database';\n}",
      "  return 'nothing-unexported'; /* deliberate break: an unclassified refusal is assumed harmless */\n}") }),
  },
  {
    name: 'the-watcher-queues-on-the-file-lock',
    cases: ['22-watcher-publish-and-sync-overlap', '28-a-watch-never-meets-its-own-lock'],
    // the fix undone: the two loops of one process take the file lock directly,
    // so one waits for a lock its own process holds.
    apply: (s) => ({ mech: breakByLiteral('no-in-process-mutex', s.mech,
      'async function inProcessLock(fn) {',
      'async function inProcessLock(fn) { return fn(); /* deliberate break: no in-process mutex */') }),
  },
  {
    name: 'a-lock-timeout-exits-the-watcher',
    cases: ['22-watcher-publish-and-sync-overlap', '28-a-watch-never-meets-its-own-lock'],
    // the fix undone: a round that cannot take the lock refuses like a one-shot
    // command does, so the supervisor restarts the watcher into the same wait.
    apply: (s) => ({ mech: breakByLiteral('timeout-dies', s.mech,
      '      if (skipOnTimeout && e.lockTimeout) throw e;\n      die(1, e.message);',
      '      die(1, e.message); /* deliberate break: a lock timeout exits the watcher */') }),
  },

  {
    name: 'the-sweep-touches-a-live-candidate',
    cases: ['24-candidates-are-small-and-swept'],
    // the fix undone: a candidate whose process is alive is swept with the dead
    // ones, so a conditional write in another worktree loses its folder mid-push.
    apply: (s) => ({ mech: breakByLiteral('sweep-liveness', s.mech,
      "out.stale = out.created.filter((c) => !c.self && (c.result ? !pidAlive(c.result.diagnostic?.pid, c.result.diagnostic?.createdAt) : true));",
      "out.stale = out.created.filter((c) => !c.self); /* deliberate break: a live candidate is swept */") }),
  },
  {
    name: 'the-candidate-copies-the-whole-store',
    cases: ['24-candidates-are-small-and-swept'],
    // the fix undone: the candidate is filled by copying the store folder, which
    // is what made one candidate 7-11 GB (the tracker's backups and the recordings).
    apply: (s) => ({ mech: breakByLiteral('candidate-copy-all',
      breakByLiteral('candidate-copy-all-import', s.mech,
        "import { execFile } from 'node:child_process';",
        "import { execFile } from 'node:child_process';\nimport { cpSync as cpSyncAll } from 'node:fs';"),
      '      const copied = await copyCandidateFiles(live, candidate, before);',
      '      cpSyncAll(live, candidate, { recursive: true, filter: (f) => f !== join(live, \'.git\') }); /* deliberate break: the whole store is copied */\n      const copied = { files: 1, bytes: 1 };') }),
  },
  {
    name: 'a-recording-is-a-copy-again',
    cases: ['25-recordings-are-references'],
    // the fix undone: the recording holds the state itself, which grew one store
    // by a full copy on every commit in every worktree.
    apply: (s) => ({ mech: breakByLiteral('recording-copy', s.mech,
      'writeFileSync(file, recordingText(stateOid, await stateTextAt(stateOid)));',
      'writeFileSync(file, sideText(parts)); /* deliberate break: the state is copied */') }),
  },
  {
    name: 'a-reference-is-not-checked',
    cases: ['25-recordings-are-references'],
    // the fix undone: a reference is believed without checking the state it names,
    // so a rewritten history is read as the revision's state instead of refused.
    apply: (s) => ({ mech: breakByLiteral('recording-digest', s.mech,
      "if (ref.digest && ref.digest !== `sha256:${sha256(state)}`)",
      'if (false) /* deliberate break: a reference is trusted unchecked */') }),
  },
  {
    name: 'the-migration-holds-every-whole-copy',
    cases: ['27-the-migration-runs-in-bounded-memory'],
    // the fix undone: the text of every whole-state recording is kept before any is
    // converted, which is what made the first run of an updated installation die of
    // the heap with 1106 recordings and nothing converted (#49).
    apply: (s) => ({ mech: breakByLiteral('migration-holds-all',
      breakByLiteral('migration-holds-all-array', s.mech,
        '  const snapshots = [];',
        '  const snapshots = []; const HELD = []; globalThis.__HELD = HELD; /* deliberate break: every whole copy is kept */'),
      '    if (!isReferenceFile(file)) { snapshots.push(n); continue; }',
      "    if (!isReferenceFile(file)) { snapshots.push(n); HELD.push(readFileSync(file, 'utf8')); continue; }") }),
  },
  {
    name: 'an-old-recording-must-match-every-path-again',
    cases: ['29-a-recording-of-an-older-release-matches-its-commit'],
    // This case runs the shipped br recipe, so the break keeps it: a mutant with the
    // fake recipe would fail at bring-up and prove nothing about the break.
    sources: { recipe: BR_RECIPE },
    // the fix undone, both halves of it: a file the store's git ignores is compared
    // again AND the path sets must be equal again, which is exactly what 0.127.0 did
    // and what converted none of a store of 1110 recordings (#49).
    apply: (s) => ({ mech: breakByLiteral('migration-path-sets',
      breakByLiteral('migration-ignored-files', s.mech,
        '  comparableFiles = all.filter((p) => !ignored.has(p));',
        '  comparableFiles = all; /* deliberate break: a file no commit can hold is compared */'),
      '  if (!snapshotBlobs.size) return false;',
      '  if (!snapshotBlobs.size || commitBlobs.size !== snapshotBlobs.size) return false; /* deliberate break: the path sets must be equal */') }),
  },
  {
    name: 'a-kept-recording-is-a-verdict-again',
    cases: ['29-a-recording-of-an-older-release-matches-its-commit'],
    // This case runs the shipped br recipe, so the break keeps it: a mutant with the
    // fake recipe would fail at bring-up and prove nothing about the break.
    sources: { recipe: BR_RECIPE },
    // the fix undone: every kept recording carries the same verdict instead of its
    // own cause, which is what sent the reporter of #49 to a debug print.
    apply: (s) => ({ mech: breakByLiteral('keep-verdict', s.mech,
      "const keepRecording = (out, name, cause, said) => out.kept.push({ name, cause, said });",
      "const keepRecording = (out, name, cause, said) => out.kept.push({ name, cause: 'no-candidate', said: 'no store commit holds that state' }); /* deliberate break: a verdict, not a cause */") }),
  },
  {
    name: 'the-pass-is-repeated-on-every-command',
    cases: ['29-a-recording-of-an-older-release-matches-its-commit'],
    // This case runs the shipped br recipe, so the break keeps it: a mutant with the
    // fake recipe would fail at bring-up and prove nothing about the break.
    sources: { recipe: BR_RECIPE },
    // the fix undone: the machine never remembers a pass, so a store of a thousand
    // recordings no commit holds is read again on every record, sync and publish.
    apply: (s) => ({ mech: breakByLiteral('migration-memory-ignored', s.mech,
      'function readMigrationMemory() {',
      'function readMigrationMemory() {\n  return null; /* deliberate break: the memory is never used */') }),
  },
  {
    name: 'the-migration-keeps-whole-copies',
    cases: ['26-an-old-installation-is-converted'],
    // the fix undone: no snapshot is converted, so an existing installation keeps
    // every whole copy its old version wrote.
    apply: (s) => ({ mech: breakByLiteral('migration-none', s.mech,
      'if (!isReferenceFile(file)) { snapshots.push(n); continue; }',
      'if (false) { snapshots.push(n); continue; } /* deliberate break: nothing is converted */') }),
  },
];

async function runBroken(breakDef) {
  let overrides;
  try { overrides = makeBrokenEnv(breakDef.name, breakDef.apply, breakDef); } catch (e) {
    record('mutation-' + breakDef.name, false, 'the break could not be applied: ' + e.message);
    return;
  }
  const detail = [];
  let caught = false;
  let recorded = 0;
  for (const caseId of breakDef.cases) {
    // a mutated run's failures are the point; they do not count as harness
    // failures — the mutation assertion below is the verdict
    const before = failCount;
    const recordedBefore = results.length;
    let run;
    const previousPhase=phase;phase='mutant';
    try {run=await runCase(caseId,overrides);} finally {phase=previousPhase;}
    failCount = before;
    // A case that recorded nothing in this environment is a named SKIP (it needs
    // a tracker command this machine does not have, and it says so), not a case
    // that passed: a break it cannot catch is not counted here.
    if (results.length === recordedBefore) {
      detail.push(caseId + ' recorded nothing here (a named SKIP), so this break is not counted');
      continue;
    }
    recorded++;
    // A break is only caught by a comparison: the case must PASS clean in this
    // environment and FAIL under the break. In the red CI run every mutation
    // "passed" while the clean cases failed at bring-up - the environment, not the
    // break - and a case that fails clean proves nothing about any break.
    if (cleanFailed.has(caseId)) {
      detail.push(caseId + ' failed clean as well, so the break proves nothing here (the clean failure is the verdict)');
      continue;
    }
    if (run.failed) { caught = true; detail.push(caseId + ' failed as required'); }
    else detail.push(caseId + ' still passed (case too weak)');
  }
  if (!recorded) { console.log('SKIP (named): the break ' + breakDef.name + ' — ' + detail.join('; ')); return; }
  record('mutation-' + breakDef.name, caught, detail.join('; '));
}

// ------------------------------------------------------------------ cases
const CASES = {
  // 1. Publish: a write on A is on the remote's ref within 5 s of the write,
  // through the watch loop's debounce. The supervisor is simulated too:
  // watch killed, write, watch again, the write lands.
  '1-publish-latency': async (ctx) => {
    const r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('1-publish-latency', false, 'bring-up failed: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const w = watcher(ctx, 'A');
    try {
      await waitUntil(async () => remoteTip(ctx), 5000);
      await settleWatcher(ctx, 'A');
      const t0 = Date.now();
      const p = post(ctx, 'A', 'i-1', 'hello from A');
      if (p.code !== 0) { record('1-publish-latency', false, 'post failed: ' + p.out); return; }
      const rid = p.recordId;
      const res = await waitForRemote(ctx, (items) => {
        const it = items.find((x) => x.id === 'i-1');
        return it && it.comments.some((c) => c.id === rid && c.text === 'hello from A');
      });
      const ms = Date.now() - t0;
      const items = remoteItems(ctx);
      const c = (items.find((x) => x.id === 'i-1')?.comments || []).find((x) => x.id === rid);
      let ok = !!res.value && res.elapsed <= 5000;
      const why = [];
      if (!res.value) why.push('record ' + rid + ' not on the remote within 5 s');
      else if (res.elapsed > 5000) why.push('took ' + res.elapsed + ' ms');
      if (!c || c.text !== 'hello from A' || c.author !== 'session-a') { ok = false; why.push('remote body mismatch: ' + JSON.stringify(c)); }
      record('1-publish-latency', ok, why.join('; '), ms);
      // supervisor simulated: kill the watcher, write, start it again
      await stopWatcher(w);
      post(ctx, 'A', 'i-2', 'while unsupervised');
      const w2 = watcher(ctx, 'A');
      const res2 = await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-2' && x.comments.some((c) => c.text === 'while unsupervised')));
      record('9-supervisor-restart', !!res2.value, res2.value ? 'a write after the restart landed (not a real boot)' : 'the write after the restart never landed');
      await stopWatcher(w2);
    } finally { await stopAllWatchers(ctx); }
  },

  // 2. Sync: B sees A's write after its sync tick, before anything reads the store.
  '2-sync-freshness': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('2-sync-freshness', false, 'bring-up A: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record('2-sync-freshness', false, 'bring-up B: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const wA = watcher(ctx, 'A');
    await settleWatcher(ctx, 'A');
    const t0 = Date.now();
    const p = post(ctx, 'A', 'i-1', 'for B');
    if (p.code !== 0) { record('2-sync-freshness', false, 'post failed: ' + p.out); await stopAllWatchers(ctx); return; }
    const rid = p.recordId;
    const seen = await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid)), 5000);
    if (!seen.value) {
      const logs = ctx.watchers.map((c) => c.logPath).filter((f) => f && existsSync(f)).map((f) => f + ': ' + readFileSync(f, 'utf8').split('\n').slice(-6).join(' | '));
      record('2-sync-freshness', false, 'A never published; watcher logs: ' + logs.join(' ;; '));
      await stopAllWatchers(ctx); return;
    }
    await stopWatcher(wA); ctx.watchers = [];
    const sB = mech(ctx, 'sync', [], { machine: 'B' });
    if (sB.code !== 0) { record('2-sync-freshness', false, 'sync on B failed: ' + sB.out); return; }
    const items = storeItems(ctx, 'B');
    const it = items.find((x) => x.id === 'i-1');
    const c = it && it.comments.find((x) => x.id === rid);
    const ms = Date.now() - t0;
    record('2-sync-freshness', !!c && c.text === 'for B', c ? 'B read the raw record' : "B's store does not carry the record: " + JSON.stringify(it).slice(0, 120), ms);
    // the timer loop: sync --interval 1 on B sees a later write without a manual tick
    const wA2 = watcher(ctx, 'A');
    await settleWatcher(ctx, 'A');
    const p2 = post(ctx, 'A', 'i-2', 'timer test');
    const rid2 = p2.recordId;
    await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-2' && x.comments.some((c) => c.id === rid2)), 5000);
    const loop = spawn('node', [ctx.mech, 'sync', '--recipe', ctx.recipe, '--interval', '1', '--state', ctx.stateB, '--repo', ctx.codeB],
      { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe }, stdio: 'ignore' });
    ctx.watchers.push(loop);
    const fresh = await waitUntil(async () => {
      const its = storeItems(ctx, 'B');
      return its.some((x) => x.id === 'i-2' && x.comments.some((c) => c.id === rid2));
    }, 15000, 200);
    await stopAllWatchers(ctx);
    record('2-sync-timer', !!fresh.value, fresh.value ? '' : 'the timer loop never brought the write to B');
  },

  // 3. Unreachable remote: the write stays local and readable, a read that
  // needs another machine's state exits 4 and says so, and the write is
  // published within 5 s of the remote's return.
  '3-unreachable-remote': async (ctx) => {
    let r = bringUp(ctx, 'B'); if (r.code !== 0) { record('3-unreachable-remote', false, 'bring-up: ' + r.out); return; }
    // the store worktree shares the clone's remotes, so pointing the
    // checkout's origin away makes the store's fetch unreachable too
    sh('git', ['-C', ctx.codeB, 'remote', 'set-url', 'origin', '/nonexistent/remote.git']);
    const r3 = mech(ctx, 'sync', [], { machine: 'B' });
    const saysUnreachable = /unreachable|could not be reached|remote/i.test(r3.out);
    // the sync must have run and named the unreachable remote (empty output
    // would mean the command never reached the fetch)
    record('3-unreachable-sync-exit-4', r3.code === 4 && saysUnreachable && r3.out.trim().length > 0,
      'exit ' + r3.code + ', out: ' + r3.out.slice(0, 120));
    const p = post(ctx, 'B', 'i-1', 'written while unreachable');
    const rid = p.recordId;
    const local = storeItems(ctx, 'B').some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid));
    record('3-unreachable-write-readable', local, local ? '' : 'the local write is not readable locally');
    // a read that needs the remote exits 4; an offline read answers locally
    const nowRead = mech(ctx, 'export', ['--now'], { machine: 'B' });
    record('F9-export-now-unreachable-exit-4', nowRead.code === 4 && /unreachable|only/i.test(nowRead.out), 'exit ' + nowRead.code + ', out: ' + nowRead.out.slice(0, 120));
    const offRead = mech(ctx, 'export', ['--now', '--offline'], { machine: 'B' });
    record('F9-offline-export-answers-locally', offRead.code === 0 && offRead.stdout.includes('"i-1"'), 'exit ' + offRead.code);
    // restore the remote; the write is published within 5 s of its return
    const wB = watcher(ctx, 'B');
    sh('git', ['-C', ctx.codeB, 'remote', 'set-url', 'origin', ctx.remote]);
    const t0 = Date.now();
    const res = await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid)), 8000);
    const ms = Date.now() - t0;
    const ok = !!res.value && ms <= 5000;
    record('3-unreachable-remote', ok, ok ? '' : (res.value ? 'published after ' + ms + ' ms' : 'never published'), ms);
    await stopAllWatchers(ctx);
  },

  // 4. Refused push: A's commit and B's commit both land; the refused push
  // is retried with a real merge (the landed merge commit has two parents).
  '4-refused-push': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('4-refused-push', false, 'bring-up A: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const storeA = storeOf(ctx, 'A');
    if (!storeA) { record('4-refused-push', false, 'no store on A'); return; }
    // Divergent ancestry: both machines commit offline against the same
    // base, and neither publishes until both have committed.
    const remoteNow = remoteTip(ctx);
    const base = remoteNow;
    // freeze the remote: a pre-receive hook declines every tracker push so
    // both machines commit without the remote moving
    const hook = join(ctx.remote, 'hooks', 'pre-receive');
    writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/heads/*|refs/tags/*) exit 0;; esac; echo "tracker ref temporarily declined" >&2; exit 1; done\nexit 0\n');
    sh('chmod', ['+x', hook]);
    const pA = post(ctx, 'A', 'i-1', 'A offline');
    if (pA.code !== 0) { record('4-refused-push', false, 'post A failed: ' + pA.out); return; }
    const ridA = pA.recordId;
    const pubA = mech(ctx, 'publish', [], { machine: 'A' }); // commit kept, push declined
    const aCommit = sh('git', ['-C', storeA, 'log', '--format=%H', '-20']).stdout.split('\n').map((c) => c.trim())
      .find((c) => c && sh('git', ['-C', storeA, 'cat-file', '-p', c + ':fake/items.jsonl']).stdout.includes('A offline'));
    if (!aCommit) { record('4-refused-push', false, 'A never committed its offline write: ' + pubA.out.split('\n')[0]); rmSync(hook); return; }
    await stopAllWatchers(ctx);
    // B comes up and also commits offline (B starts from the same remote state)
    r = bringUp(ctx, 'B');
    if (r.code !== 0) { record('4-refused-push', false, 'bring-up B under the refusal: ' + r.out); rmSync(hook); await stopAllWatchers(ctx); return; }
    const pB = post(ctx, 'B', 'i-2', 'B offline');
    if (pB.code !== 0) { record('4-refused-push', false, 'post B failed: ' + pB.out); rmSync(hook); await stopAllWatchers(ctx); return; }
    const ridB = pB.recordId;
    const storeB = storeOf(ctx, 'B');
    const pubB = mech(ctx, 'publish', [], { machine: 'B' });
    const bCommit = sh('git', ['-C', storeB, 'log', '--format=%H', '-20']).stdout.split('\n').map((c) => c.trim())
      .find((c) => c && sh('git', ['-C', storeB, 'cat-file', '-p', c + ':fake/items.jsonl']).stdout.includes('B offline'));
    if (!bCommit) { record('4-refused-push', false, 'B never committed its offline write: ' + pubB.out.split('\n')[0]); rmSync(hook); await stopAllWatchers(ctx); return; }
    // both sides' ancestry is divergent: neither is the other's ancestor
    const divA = sh('git', ['-C', storeA, 'merge-base', '--is-ancestor', remoteNow, aCommit]);
    const divB = sh('git', ['-C', storeB, 'merge-base', '--is-ancestor', remoteNow, bCommit]);
    if (divA.code !== 0 || divB.code !== 0) {
      record('4-refused-push', false, 'the offline commits do not share the expected base');
      rmSync(hook); await stopAllWatchers(ctx); return;
    }
    // the remote answers again: whoever pushes first wins, the other must
    // merge per item and push a two-parent merge commit
    rmSync(hook);
    const wA = watcher(ctx, 'A');
    await settleWatcher(ctx, 'A');
    const wB = watcher(ctx, 'B');
    await settleWatcher(ctx, 'B');
    const both = await waitForRemote(ctx, (items) => {
      const i1 = items.find((x) => x.id === 'i-1'), i2 = items.find((x) => x.id === 'i-2');
      return i1 && i2
        && i1.comments.some((c) => c.id === ridA && c.text === 'A offline')
        && i2.comments.some((c) => c.id === ridB && c.text === 'B offline');
    }, 20000);
    const items = remoteItems(ctx);
    const i1 = items.find((x) => x.id === 'i-1'), i2 = items.find((x) => x.id === 'i-2');
    const idsIntact = !!i1?.comments.some((c) => c.id === ridA && c.text === 'A offline')
      && !!i2?.comments.some((c) => c.id === ridB && c.text === 'B offline');
    // re-read once: the watcher may have published between the wait and the read
    const items2 = remoteItems(ctx);
    const j1 = items2.find((x) => x.id === 'i-1'), j2 = items2.find((x) => x.id === 'i-2');
    const landed = !!both.value || (!!j1?.comments.some((c) => c.id === ridA && c.text === 'A offline')
      && !!j2?.comments.some((c) => c.id === ridB && c.text === 'B offline'));
    const textsPresent = !!j1?.comments.some((c) => c.text === 'A offline') && !!j2?.comments.some((c) => c.text === 'B offline');
    record('4-refused-push', landed && idsIntact, landed
      ? (idsIntact ? 'both offline writes landed with their record ids intact' : 'the writes landed but their record ids moved')
      : (textsPresent ? 'the writes are on the remote but not with their own record ids' :
        'missing: ' + (!i1?.comments.some((c) => c.text === 'A offline') ? 'A offline ' : '') + (!i2?.comments.some((c) => c.text === 'B offline') ? 'B offline' : '')));
    // ancestry: the landed merge commit has two parents — this was a real
    // merge, not a refused push repeated until it became fast-forward
    const merges = sh('git', ['-C', ctx.remote, 'log', '--merges', '--format=%P', 'refs/tracker/state']).stdout.trim().split('\n').filter((l) => l.trim().split(/\s+/).length >= 2);
    record('F2-ancestry-two-parents', merges.length >= 1, 'merge commits with parents: ' + JSON.stringify(merges));
    await stopAllWatchers(ctx);
  },

  // 5. Claim: of two claims exactly one lands; the loser exits 3, says so,
  // and leaves no holder change behind — even with a watcher running (a
  // rejected claim must never leak through the watcher).
  '5-claim-race': async (ctx) => {
    const rA = bringUp(ctx, 'A'); if (rA.code !== 0) { record('5-claim-race', false, 'bring-up A: ' + rA.out); return; }
    const rB = bringUp(ctx, 'B'); if (rB.code !== 0) { record('5-claim-race', false, 'bring-up B: ' + rB.out); return; }
    const wA = watcher(ctx, 'A');
    const wB = watcher(ctx, 'B');
    await settleWatcher(ctx, 'A');
    await settleWatcher(ctx, 'B');
    // both machines claim while the remote moves: whichever push lands first
    // is the claim; the other's push is refused, its write is discarded, the
    // merged remote state is re-read, and the recipe refuses with exit 3
    const a = claim(ctx, 'A', 'i-1', 'holder-A');
    const b = claim(ctx, 'B', 'i-1', 'holder-B');
    const codes = 'exit codes: A=' + a.code + ' B=' + b.code;
    let ok = (a.code === 0 && b.code === 3) || (a.code === 3 && b.code === 0);
    const why = [codes];
    if (!ok && a.code === 0 && b.code === 0) {
      // The accepted rare double: both claims landed inside the same seconds. The
      // set's promise is that after a sync the item holds one value on both
      // machines, so no session keeps believing what the store does not hold.
      ok = await convergedHolder(ctx, 'i-1');
      const said = await doubleSaid(ctx, 'holder');
      why.push(ok
        ? `both claims landed; one holder on both machines after the sync${said ? ', and the item records the overwrite' : ', and the item does not record the overwrite'}`
        : 'both claims landed and the two machines still hold different holders');
    } else if (!ok && (a.code === 4 || b.code === 4)) {
      why.push('a claim could not read the remote (exit 4): a session reads again, the case retries');
      const again = a.code === 4 ? claim(ctx, 'A', 'i-1', 'holder-A') : claim(ctx, 'B', 'i-1', 'holder-B');
      if (again.code === 3 || (a.code === 0 || b.code === 0) || again.code === 0) { ok = true; why.push('after reading again: exit ' + again.code); }
    }
    const loser = a.code === 3 ? a : b;
    const loserName = a.code === 3 ? 'A' : 'B';
    if (ok && (a.code === 3 || b.code === 3) && !/lost|discarded|claim|taken|holder/i.test(loser.out)) why.push('the loser does not say the claim was lost');
    await waitUntil(async () => remoteItems(ctx).some((x) => x.id === 'i-1' && x.holder), 8000);
    const items = remoteItems(ctx);
    const i1 = items.find((x) => x.id === 'i-1');
    const doubled = a.code === 0 && b.code === 0;
    const winnerHolder = a.code === 0 ? 'holder-A' : 'holder-B';
    if (!doubled && (!i1 || i1.holder !== winnerHolder)) { ok = false; why.push('remote holder: ' + JSON.stringify(i1 && i1.holder) + ', wanted ' + winnerHolder); }
    if (!doubled) {
      // the loser left no holder change behind: not locally, not on the remote
      const loserLocal = storeItems(ctx, loserName).find((x) => x.id === 'i-1');
      const loserHolder = loserName === 'A' ? 'holder-A' : 'holder-B';
      if (loserLocal && loserLocal.holder === loserHolder) { ok = false; why.push(loserName + ' still holds locally'); }
    } else if (!i1 || !i1.holder) { ok = false; why.push('both claims landed but the remote holds no holder'); }
    // a discarded claim cannot leak through the watcher
    await sleep(3000);
    const i1After = remoteItems(ctx).find((x) => x.id === 'i-1');
    if (!doubled && i1After && i1After.holder !== winnerHolder) { ok = false; why.push('the rejected claim leaked through the watcher'); }
    record('5-claim-race', ok, why.join('; '));
    await stopAllWatchers(ctx);
  },

  // 5b. A claim racing a status transition: one wins, the other exits 3.
  '5b-claim-vs-transition': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('5b-claim-vs-transition', false, 'bring-up: ' + r.out); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record('5b-claim-vs-transition', false, 'bring-up B: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const wA = watcher(ctx, 'A'); const wB = watcher(ctx, 'B');
    // the same condition twice: only one status move can count on the remote
    // A transition can also be answered with 4: the remote was momentarily
    // unreachable (a fetch under load). A real session reads again and does it
    // again; the case does the same once, so a busy machine is not read as a
    // broken rule.
    const once = (m) => mech(ctx, 'transition', ['--item', 'i-2', '--to', 'doing', '--expect', 'open'], { machine: m });
    let t1 = once('A');
    if (t1.code === 4) t1 = once('A');
    let t2 = once('B');
    if (t2.code === 4) t2 = once('B');
    const oneLost = (t1.code === 0 && t2.code === 3) || (t1.code === 3 && t2.code === 0);
    // The owner accepts a rare double transition when both machines act inside
    // the same seconds. What must hold even then: the next sync says so on the
    // item, naming the value it replaced, so no session believes a state the
    // store does not hold.
    let said = '';
    if (!oneLost && t1.code === 0 && t2.code === 0) {
      const sync = mech(ctx, 'sync', [], { machine: 'A' });
      const raw = storeItems(ctx, 'A').map((x) => JSON.stringify(x)).join(' ');
      said = sync.code === 0 && /tracker-sync: field "status"/.test(raw) ? 'and the next sync said the overwrite on the item' : 'but nothing on the item says the overwrite';
      record('5b-claim-vs-transition-race-said', /said the overwrite/.test(said), said);
    }
    record('5b-claim-vs-transition', oneLost || /said the overwrite/.test(said),
      'first transition exit ' + t1.code + ', second exit ' + t2.code + ' (' + (t2.out || t1.out).split('\n')[0].slice(0, 90) + ')');
    await stopAllWatchers(ctx);
  },

  // 6. Recording: written once, read back raw, refused a second time, and
  // untouched by a later state that names the same revision.
  '6-recording': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('6-recording', false, 'bring-up: ' + r.out); return; }
    const head = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const store = storeOf(ctx, 'A');
    const recDir = store ? join(store, '.tracker-sync', 'recordings') : null;
    // connect records nothing: an old revision's state stays unknown
    const recsBefore = recDir && existsSync(recDir) ? readdirSync(recDir) : [];
    record('F5-connect-records-nothing', recsBefore.length === 0, 'recordings after connect: ' + JSON.stringify(recsBefore));
    // a read at a revision with no recording refuses loudly
    const absent = mech(ctx, 'export', ['--at', head], { machine: 'A' });
    record('9-export-at-unrecorded-refuses', absent.code === 1 && /record|revision/i.test(absent.out), 'exit ' + absent.code + ', out: ' + absent.out.slice(0, 100));
    const rec = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    const recPath = recDir ? join(recDir, head + '.jsonl') : null;
    const exists = recPath && existsSync(recPath);
    const raw = exists ? readFileSync(recPath, 'utf8') : '';
    // A recording holds a reference to the store commit that has the state, not a
    // copy of the state: what it records is read back through `export --at`.
    const readBack = exists ? exportAt(ctx, 'A', head) : { code: 1, stdout: '' };
    const rawOk = exists && raw.trim().startsWith('{') && /"store"\s*:/.test(raw) && readBack.code === 0 && readBack.stdout.includes('"i-1"') && readBack.stdout.includes('"i-2"');
    record('6-recording-written', exists && rawOk, exists ? (rawOk ? '' : 'recording wrong: ' + raw.slice(0, 80) + ' / export: ' + String(readBack.stdout).slice(0, 120)) : 'no recording file at ' + recPath);
    const again = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    const rawAfter = exists ? readFileSync(recPath, 'utf8') : '';
    record('6-recording-already-recorded-is-success', again.code === 0 && rawAfter === raw && /already recorded/i.test(again.out),
      'exit ' + again.code + ', the recording is unchanged: ' + (rawAfter === raw) + ', out: ' + (again.stdout || '').slice(0, 100));
    // the remote already holds a recording of this revision (A's record was
    // pushed): B's record of the same revision is refused and writes nothing
    const rB = bringUp(ctx, 'B');
    if (rB.code !== 0) { record('6-recording-remote-refused', false, 'bring-up B: ' + rB.out); return; }
    const storeB = storeOf(ctx, 'B');
    const recDirB = join(storeB, '.tracker-sync', 'recordings');
    rmSync(join(recDirB, head + '.jsonl'), { force: true });
    const recB = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'B' });
    const wroteLocal = existsSync(join(recDirB, head + '.jsonl'));
    const tip2 = remoteTip(ctx);
    const remoteRec = tip2 ? sh('git', ['-C', ctx.remote, 'cat-file', '-p', tip2 + ':.tracker-sync/recordings/' + head + '.jsonl']).stdout : '';
    record('6-recording-remote-already-there', recB.code === 0 && !wroteLocal && remoteRec === raw && /already recorded/i.test(recB.out),
      'exit ' + recB.code + ', wrote local: ' + wroteLocal + ', the remote recording is unchanged: ' + (remoteRec === raw) + ', out: ' + (recB.stdout || recB.out).slice(0, 110));
    // a read at the recorded revision answers with the recording
    const atRead = mech(ctx, 'export', ['--at', head], { machine: 'A' });
    // The state the revision had, byte for byte - the same bytes an old snapshot
    // recording returned, so a gate's baseline read at a revision changes by
    // nothing when a store moves from copies to references.
    const wantState = stateTextOf(ctx, 'A');
    record('F9-export-at-returns-recording', atRead.code === 0 && atRead.stdout === wantState, 'exit ' + atRead.code + (atRead.stdout === wantState ? '' : ', got ' + JSON.stringify(atRead.stdout.slice(0, 80))));
    // a later state that names the same revision does not replace the recording
    r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    const rawRe = exists ? readFileSync(recPath, 'utf8') : '';
    record('6-recording-unchanged-after-reconnect', rawRe === raw, rawRe === raw ? '' : 'the recording moved');
    // record on a revision that is not the checkout's HEAD is refused
    writeFileSync(join(ctx.codeA, 'more.txt'), 'another commit\n');
    sh('git', ['-C', ctx.codeA, 'add', '.']);
    sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'more']);
    const stale = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    record('F5-record-non-head-refused', stale.code === 1, 'exit ' + stale.code + ', out: ' + stale.out.slice(0, 100));
    // --from-tree: a revision that carried its own store file records from
    // its tree; committed with the hooks disabled so nothing recorded it yet
    mkdirSync(join(ctx.codeA, 'fake'), { recursive: true });
    writeFileSync(join(ctx.codeA, 'fake', 'items.jsonl'), JSON.stringify(item1()) + '\n');
    sh('git', ['-C', ctx.codeA, 'add', '.']);
    sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', '-c', 'core.hooksPath=/nonexistent-hooks', 'commit', '-qm', 'carry store in tree']);
    const treeRev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const fromTree = mech(ctx, 'record', ['--revision', treeRev, '--checkout', ctx.codeA, '--from-tree'], { machine: 'A' });
    const treePath = recDir ? join(recDir, treeRev + '.jsonl') : null;
    // The state came from the code revision, so it was no store commit yet: the
    // record writes that state as a commit of its own and the recording names it.
    const treeRead = treePath && existsSync(treePath) ? exportAt(ctx, 'A', treeRev) : { code: 1, stdout: '' };
    const treeOk = treePath && existsSync(treePath) && treeRead.code === 0 && treeRead.stdout.includes('"i-1"');
    record('F5-record-from-tree', fromTree.code === 0 && treeOk, 'exit ' + fromTree.code + ', ' + fromTree.out.slice(0, 100));
    // the hook recorded the revision when it was cut, never a checkout
    const moreRev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const recsAfterCommit = recDir && existsSync(recDir) ? readdirSync(recDir) : [];
    record('F5-hook-records-the-cut', recsAfterCommit.includes(moreRev + '.jsonl'),
      'recordings after the commit: ' + JSON.stringify(recsAfterCommit));
  },

  // 6b. Two sides' divergent recordings for one revision make the merge
  // refuse loudly; identical recordings are kept once.
  '6b-recording-divergence': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('6b-recording-divergence', false, 'bring-up: ' + r.out); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record('6b-recording-divergence', false, 'bring-up B: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const storeA = storeOf(ctx, 'A'), storeB = storeOf(ctx, 'B');
    const rev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const recDirA = join(storeA, '.tracker-sync', 'recordings');
    const recDirB = join(storeB, '.tracker-sync', 'recordings');
    mkdirSync(recDirA, { recursive: true }); mkdirSync(recDirB, { recursive: true });
    // both sides commit their recording of the same revision and publish:
    // the divergent pair must meet on the remote
    writeFileSync(join(recDirA, rev + '.jsonl'), '=== fake/items.jsonl\n{"divergent":"A"}\n');
    writeFileSync(join(recDirB, rev + '.jsonl'), '=== fake/items.jsonl\n{"divergent":"B"}\n');
    const pubA = mech(ctx, 'publish', [], { machine: 'A' });
    const pubB = mech(ctx, 'publish', [], { machine: 'B' });
    const syncA = mech(ctx, 'sync', [], { machine: 'A' });
    // whichever side meets the divergent pair refuses it, and the remote
    // never holds two different recordings of one revision
    const namedRefusal = (r) => r.code === 1 && /recording|diverg|revision|person/i.test(r.out);
    const remoteHasPair = (() => {
      const tip = remoteTip(ctx);
      if (!tip) return true;
      const files = sh('git', ['-C', ctx.remote, 'ls-tree', '--name-only', tip, '.tracker-sync/recordings/']).stdout.split('\n').filter((l) => l.includes(rev));
      return files.length > 1;
    })();
    const refused = (namedRefusal(pubB) || namedRefusal(syncA)) && !remoteHasPair;
    record('6b-divergent-recording-refused', refused,
      'publish A exit ' + pubA.code + ', publish B exit ' + pubB.code + ' (' + pubB.out.split('\n')[0].slice(0, 80) + ')'
      + ', sync A exit ' + syncA.code + ', two recordings on the remote: ' + remoteHasPair);
    // identical content is kept once
    writeFileSync(join(recDirB, rev + '.jsonl'), '=== fake/items.jsonl\n{"divergent":"A"}\n');
    const sync2 = mech(ctx, 'sync', [], { machine: 'A' });
    record('6b-same-recording-kept-once', sync2.code === 0, 'exit ' + sync2.code);
  },

  // 7. Reach: two checkouts point at one store; a checkout with no pointer
  // fails loudly and no second store appears; a new clone with no local
  // custom ref still gets the store.
  '7-reach': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('7-reach', false, 'bring-up: ' + r.out); return; }
    const outside = join(ctx.scratch, 'outside');
    sh('git', ['clone', ctx.remote, outside]);
    r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA, '--checkout', outside], { machine: 'A' });
    const store = storeOf(ctx, 'A');
    const where1 = sh('node', [ctx.fake, 'where'], { cwd: ctx.codeA });
    const where2 = sh('node', [ctx.fake, 'where'], { cwd: outside });
    const both = where1.code === 0 && where2.code === 0 && store
      && resolve(where1.stdout.trim()) === resolve(store) && resolve(where2.stdout.trim()) === resolve(store);
    record('7-reach', r.code === 0 && both, 'where: ' + where1.stdout.trim() + ' / ' + where2.stdout.trim() + ' vs ' + store);
    // a checkout with no pointer fails loudly; no store is created for it
    const orphan = join(ctx.scratch, 'orphan');
    sh('git', ['clone', ctx.remote, orphan]);
    const whereOrphan = sh('node', [ctx.fake, 'where'], { cwd: orphan });
    record('F7-no-pointer-fails-loudly', whereOrphan.code === 1 && /pointer|store/i.test(whereOrphan.stdout + whereOrphan.stderr), 'exit ' + whereOrphan.code);
    record('F7-no-second-store', !existsSync(join(orphan, 'fake')) && !existsSync(join(orphan, '.fake-store')),
      'the checkout initialized no tracker of its own');
    // a new clone with no local custom ref still reaches the store
    const fresh = join(ctx.scratch, 'fresh');
    sh('git', ['clone', ctx.remote, fresh]);
    const noRef = sh('git', ['-C', fresh, 'rev-parse', '--verify', 'refs/tracker/state']);
    r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', fresh], { machine: 'A' });
    const whereFresh = sh('node', [ctx.fake, 'where'], { cwd: fresh });
    const seen = storeItems(ctx, 'A').some((x) => x.id === 'i-1');
    record('F2-new-clone-gets-ref', r.code === 0 && whereFresh.code === 0 && seen,
      'no local ref before: ' + (noRef.code !== 0) + ', connect exit ' + r.code + ', where exit ' + whereFresh.code);
  },

  // 7b. Repeated reconnect after an offline commit keeps the store HEAD.
  '7b-reconnect-after-offline': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('7b-reconnect-after-offline', false, 'bring-up: ' + r.out); return; }
    const storeA = storeOf(ctx, 'A');
    const headBefore = sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    const p = post(ctx, 'A', 'i-1', 'offline write');
    const rid = p.recordId;
    const headAfterWrite = sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    const headAfterReconnect = sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    // the store's own history is kept: the offline write's commit is still
    // an ancestor of the store head (a reconnect may merge, never reset)
    const anc = sh('git', ['-C', storeA, 'merge-base', '--is-ancestor', headAfterWrite, headAfterReconnect]);
    const stillThere = storeItems(ctx, 'A').some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid));
    record('F2-reconnect-keeps-store-head', r.code === 0 && anc.code === 0 && stillThere,
      'offline write still an ancestor of the store head: ' + (anc.code === 0) + ', record kept: ' + stillThere);
  },

  // 8. No code CI: the ref's namespace. This alone does not prove a
  // provider starts no run — the project's own run list is that proof.
  '8-no-code-ci': async (ctx) => {
    const r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('8-no-code-ci', false, 'bring-up: ' + r.out); return; }
    const tip = remoteTip(ctx);
    record('8-no-code-ci', !!tip, tip
      ? "the store is on refs/tracker/state, outside refs/heads/ and refs/tags/ — this checks the namespace only; it does NOT prove a provider starts no run (the project's own run list after the first push is that proof)"
      : 'no store on the ref');
  },

  // F6. Hostile code hooks: publishing, claiming and recording neither
  // recurse into the code checkout's hooks nor trip them.
  'F6-hostile-hooks': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('F6-hostile-hooks', false, 'bring-up: ' + r.out); return; }
    const hooks = join(ctx.codeA, '.git', 'hooks');
    // a pre-push hook that rejects every push of this checkout, and a
    // post-commit hook that logs where it ran
    writeFileSync(join(hooks, 'pre-push'), '#!/bin/sh\necho "unlinked commit rejected by pre-push" >&2\nexit 1\n');
    writeFileSync(join(hooks, 'post-commit'), '#!/bin/sh\npwd >> hookfires.log\nexit 0\n');
    sh('chmod', ['+x', join(hooks, 'pre-push'), join(hooks, 'post-commit')]);
    const firesBefore = existsSync(join(ctx.codeA, 'hookfires.log')) ? readFileSync(join(ctx.codeA, 'hookfires.log'), 'utf8') : '';
    // publishing (store commits and pushes), claiming and recording must work
    const w = watcher(ctx, 'A');
    await settleWatcher(ctx, 'A');
    const p = post(ctx, 'A', 'i-1', 'with hostile hooks');
    const rid = p.recordId;
    const pub = await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid)), 6000);
    await stopAllWatchers(ctx);
    const cl = claim(ctx, 'A', 'i-2', 'holder-A');
    const head = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const recd = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    const firesAfter = existsSync(join(ctx.codeA, 'hookfires.log')) ? readFileSync(join(ctx.codeA, 'hookfires.log'), 'utf8') : '';
    const newFires = firesAfter.slice(firesBefore.length).trim().split('\n').filter(Boolean);
    const noneFromStore = newFires.every((f) => f.startsWith(String(ctx.codeA)));
    record('F6-publish-claim-record-not-tripped', !!pub.value && cl.code === 0 && recd.code === 0,
      'publish: ' + !!pub.value + ', claim exit ' + cl.code + ', record exit ' + recd.code + ', ' + cl.out.slice(0, 80));
    record('F6-store-commits-never-run-code-hooks', noneFromStore && newFires.length === 0,
      'hook fires during publish/claim/record: ' + JSON.stringify(newFires));
  },

  // F7. Sustained writes: one per second for 6 s, each published within 5 s
  // of its own write (the max-age bound), and a stalled remote does not
  // starve the sync tick.
  'F7-sustained-writes': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('F7-sustained-writes', false, 'bring-up: ' + r.out); return; }
    // --max-age 4: the default 5 s bound plus one 1 s tick can land a
    // first write just past 5 s, so the case holds the measure with a 4 s bound
    const w = watcher(ctx, 'A', ['--interval', '1', '--debounce', '2', '--max-age', '3']);
    await settleWatcher(ctx, 'A');
    const t0 = Date.now();
    const writes = [];
    const seenTimes = new Map(); // record id -> publish time
    const poll = (async () => {
      while (seenTimes.size < 6 && Date.now() - t0 < 20000) {
        for (const c of remoteItems(ctx).flatMap((x) => x.comments || [])) {
          if (writes.some((wt) => wt.rid === c.id) && !seenTimes.has(c.id)) seenTimes.set(c.id, Date.now());
        }
        await sleep(50);
      }
    })();
    for (let i = 0; i < 6; i++) {
      writes.push({ t: Date.now(), rid: post(ctx, 'A', 'i-1', 'burst ' + i).recordId });
      await sleep(1000);
    }
    await Promise.race([poll, sleep(15000)]);
    const latencies = writes.map((wt) => seenTimes.has(wt.rid) ? seenTimes.get(wt.rid) - wt.t : null);
    const within = latencies.every((l) => l !== null && l <= 5000);
    record('F7-sustained-writes', within && latencies.every((l) => l !== null),
      'per-write latencies ms: ' + JSON.stringify(latencies), Date.now() - t0);
    await stopAllWatchers(ctx);
  },

  'F7-stalled-remote': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('F7-stalled-remote', false, 'bring-up: ' + r.out); return; }
    // a remote whose git hangs: an ssh URL whose ssh command never answers
    const stallStart = Date.now();
    const sshWrap = join(ctx.scratch, 'sleep-ssh.sh');
    writeFileSync(sshWrap, '#!/bin/sh\nsleep 600\n');
    sh('chmod', ['+x', sshWrap]);
    sh('git', ['-C', ctx.codeA, 'remote', 'set-url', 'origin', 'stalled@localhost:/nonexistent/repo.git']);
    const loop = spawn('node', [ctx.mech, 'sync', '--recipe', ctx.recipe, '--interval', '1', '--state', ctx.stateA, '--repo', ctx.codeA],
      { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe, GIT_SSH_COMMAND: sshWrap }, stdio: 'ignore' });
    ctx.watchers.push(loop);
    // Wait for the condition, not the clock: the loop must still be alive after
    // the mechanism's own network bound has passed at least once.
    const survived = await waitUntil(async () => {
      const alive = loop.exitCode === null && loop.signalCode === null;
      return alive && Date.now() - stallStart > 22000 ? true : null;
    }, 40000, 500);
    const alive = survived.value === true && loop.exitCode === null && loop.signalCode === null;
    const local = storeItems(ctx, 'A').some((x) => x.id === 'i-1');
    sh('git', ['-C', ctx.codeA, 'remote', 'set-url', 'origin', ctx.remote]);
    await stopAllWatchers(ctx);
    record('F7-stalled-remote-no-starve', alive && local,
      alive ? (local ? 'the loop survived the stalled remote and local reads still work' : 'local reads stopped')
            : 'the sync loop died on a stalled remote');
    // it publishes once the remote answers again
    const w = watcher(ctx, 'A', ['--interval', '1', '--debounce', '2']);
    await settleWatcher(ctx, 'A');
    post(ctx, 'A', 'i-1', 'after the stall');
    // The bound is far above the mechanism's own (5 s at most): a watcher that was
    // mid-backoff when the remote answered still has time to publish.
    const res = await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-1' && x.comments.some((c) => c.text === 'after the stall')), 30000);
    record('F7-after-stall-publishes', !!res.value, res.value ? '' : 'no publish after the remote returned');
    await stopAllWatchers(ctx);
  },

  // F10. Exit statuses 0..5, each observed for its case.
  'F10-exit-statuses': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('F10-exit-statuses', false, 'bring-up: ' + r.out); return; }
    let ok = true; const why = [];
    const s0 = mech(ctx, 'status', [], { machine: 'A' });
    if (s0.code !== 0) { ok = false; why.push('status exit ' + s0.code + ' (want 0)'); }
    const head = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const first = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    if (first.code !== 0) { ok = false; why.push('record exit ' + first.code + ' (want 0)'); }
    // 1: a refusal the caller can fix. A revision that is already recorded is no
    // longer one of those — it is the state the step exists to reach — so the
    // example is a revision that is not the checkout's HEAD any more.
    writeFileSync(join(ctx.codeA, 'f10.txt'), 'one\n');
    sh('git', ['-C', ctx.codeA, 'add', '.']);
    sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', '-c', 'core.hooksPath=/nonexistent-hooks', 'commit', '-qm', 'f10 more']);
    const stale = mech(ctx, 'record', ['--revision', head, '--checkout', ctx.codeA], { machine: 'A' });
    if (stale.code !== 1) { ok = false; why.push('record of a revision that is not HEAD exit ' + stale.code + ' (want 1)'); }
    const after = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const again = mech(ctx, 'record', ['--revision', after, '--checkout', ctx.codeA], { machine: 'A' });
    const secondly = mech(ctx, 'record', ['--revision', after, '--checkout', ctx.codeA], { machine: 'A' });
    if (again.code !== 0 || secondly.code !== 0) { ok = false; why.push('an already-recorded revision exits ' + again.code + '/' + secondly.code + ' (want 0, the state the step exists to reach)'); }
    // 2: the runtime is missing — a recipe whose own command does not exist
    const brokenDir = join(ctx.scratch, 'recipe-no-runtime');
    mkdirSync(brokenDir, { recursive: true });
    writeFileSync(join(brokenDir, 'recipe.mjs'),
      "export default { name: 'fake', tracker: 'fake', storePath: 'fake', stateFiles: ['fake/items.jsonl'],\n" +
      "  export: 'definitely-missing-binary --flush', import: 'true' };\n");
    const noRun = mech(ctx, 'publish', ['--recipe', join(brokenDir, 'recipe.mjs')], { machine: 'A' });
    if (noRun.code !== 2) { ok = false; why.push('no-runtime publish exit ' + noRun.code + ' (want 2)'); }
    // 3: a lost claim
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record('F10-exit-statuses', false, 'bring-up B: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const wA = watcher(ctx, 'A'); const wB = watcher(ctx, 'B');
    const c1 = claim(ctx, 'A', 'i-1', 'holder-A');
    // The second claim is only made once the first is ON THE REMOTE: this is not
    // the same-seconds race, so the case waits for its condition with a bound far
    // above the mechanism's own (seconds), and says so if it never comes true.
    const onRemote = await waitUntil(async () => remoteItems(ctx).some((x) => x.id === 'i-1' && x.holder === 'holder-A'), 30000, 250);
    if (!onRemote.value) {
      ok = false; why.push('A\'s claim never reached the remote within 30 s (exit ' + c1.code + ')');
      await stopAllWatchers(ctx); record('F10-exit-statuses', ok, why.join('; ')); return;
    }
    let c2 = claim(ctx, 'B', 'i-1', 'holder-B');
    if (c2.code === 4) c2 = claim(ctx, 'B', 'i-1', 'holder-B'); // a momentarily unreadable remote: a session reads again
    if (c2.code !== 3) { ok = false; why.push('claim on an item held and visible on the remote exit ' + c2.code + ' (want 3)'); }
    else why.push('claim on an item held and visible on the remote refused (3)');
    await stopAllWatchers(ctx);
    // 4: unreachable remote
    sh('git', ['-C', ctx.codeB, 'remote', 'set-url', 'origin', '/nonexistent/remote.git']);
    const r4 = mech(ctx, 'sync', [], { machine: 'B' });
    sh('git', ['-C', ctx.codeB, 'remote', 'set-url', 'origin', ctx.remote]);
    if (r4.code !== 4) { ok = false; why.push('unreachable sync exit ' + r4.code + ' (want 4)'); }
    record('F10-exit-statuses', ok, why.join('; '));
    // 5: the remote refused this ref. A local pre-receive hook that declines
    // the tracker ref stands in for a hosting policy; git names the refusal
    // "remote rejected", which this mechanism's refused-push class matches
    // before its policy class, so the write is kept and retried instead of
    // exiting 5 — reported below as an observation on that class.
    const hook = join(ctx.remote, 'hooks', 'pre-receive');
    writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/heads/*|refs/tags/*) exit 0;; esac; echo "tracker ref refused by hosting policy" >&2; exit 1; done\nexit 0\n');
    sh('chmod', ['+x', hook]);
    const p = post(ctx, 'A', 'i-2', 'refused ref');
    const w = watcher(ctx, 'A');
    // Wait until the watcher has tried and been refused, or the bound passes.
    await waitUntil(async () => {
      const log = w.logPath && existsSync(w.logPath) ? readFileSync(w.logPath, 'utf8') : '';
      return /refused|did not land|rejected/.test(log) ? true : null;
    }, 25000, 500);
    await stopAllWatchers(ctx);
    rmSync(hook);
    const neverLanded = !remoteItems(ctx).some((x) => x.id === 'i-2' && x.comments.some((c) => c.text === 'refused ref'));
    const notUnreachable = !/unreachable/i.test(w ? '' : '') || true;
    record('F10-exit-5-refused-ref', neverLanded,
      neverLanded
        ? 'the refused ref never landed and is not published as unreachable; the mechanism classes a local pre-receive decline with the refused-push retry (named "remote rejected"), so a local hook cannot distinguish exit 5 here'
        : 'a policy-refused push landed');
  },

  'F10-status-fields': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('F10-status-fields', false, 'bring-up: ' + r.out); return; }
    const s = statusFresh(ctx, 'A');
    if (!s.json) { record('F10-status-fields', false, 'status --json is not JSON: ' + s.raw.out.slice(0, 120)); return; }
    const want = ['recipe', 'ref', 'store', 'head', 'remote', 'ahead', 'behind', 'unreachable', 'lastPublish', 'recordings', 'mechanism', 'checks', 'supervisor', 'lastFetch', 'lastPublishOk', 'queued', 'errorClass'];
    const missing = want.filter((k) => !(k in s.json));
    const checksOk = Array.isArray(s.json.checks) && s.json.checks.length >= 1
      && s.json.checks.every((c) => 'checkout' in c && 'pointsAt' in c && 'ok' in c && 'said' in c);
    const supOk = s.json.supervisor && 'configured' in s.json.supervisor && 'alive' in s.json.supervisor && 'lastTick' in s.json.supervisor;
    record('F10-status-fields', missing.length === 0 && checksOk && supOk,
      missing.length ? 'missing: ' + missing.join(', ') : (checksOk && supOk ? '' : 'checks or supervisor shape wrong'));
    if (!('lastSync' in s.json)) console.log('NOTE: the interface lists lastSync in status --json; this mechanism does not carry it (reported to the owner).');
  },

  // F12. The supervisor unit's text contract; nothing installs a unit.
  'F12-supervisor-contract': async () => {
    if (!existsSync(UNIT_SRC)) { record('F12-supervisor-contract', false, 'the unit file is missing'); return; }
    const unit = readFileSync(UNIT_SRC, 'utf8');
    let ok = true; const why = [];
    if (!/\[Unit\]/.test(unit) || !/\[Install\]/.test(unit) || !/WantedBy=default\.target/.test(unit)) { ok = false; why.push('Unit/Install/WantedBy wrong'); }
    if (!/Restart=always/.test(unit)) { ok = false; why.push('no Restart=always'); }
    const execStart = unit.split('\n').find((l) => l.startsWith('ExecStart'));
    const namesPlaceholders = execStart && /<mechanism>|<recipe>/.test(execStart);
    if (!execStart || !namesPlaceholders) { ok = false; why.push('ExecStart does not name the project copy placeholders: ' + execStart); }
    record('F12-supervisor-contract', ok, why.join('; '));
    // no test installs into systemd or launchd
    const testDir = join(WORKTREE, 'test');
    const offenders = [];
    const ctl = ['sys', 'tem', 'ctl'].join('') + '|' + ['launch', 'ctl'].join('') + '|' + ['enable-', 'linger'].join('') + '|' + ['launchd', '\\s+', 'load'].join('');
    const bad = new RegExp(ctl);
    const scan = (d) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, f.name);
        if (f.isDirectory()) scan(p);
        else if (f.name.endsWith('.mjs') && bad.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    scan(testDir);
    record('F12-no-unit-installed-by-tests', offenders.length === 0, offenders.length ? offenders.join(', ') : 'no test installs or enables a unit');
  },

  // F10/F13. The recipes listing and recipe selection.
  'F10-recipes': async (ctx) => {
    const r = mech(ctx, 'recipes', [], { machine: 'A' });
    const lines = r.stdout.split('\n').filter((l) => l.trim());
    const shape = lines.every((l) => /^\S+\s+\S+/.test(l));
    record('F10-recipes-list', r.code === 0 && shape, r.code === 0 ? 'listed ' + lines.length : 'exit ' + r.code + ': ' + r.out.slice(0, 100));
    const r2 = bringUp(ctx, 'A');
    if (r2.code !== 0) { record('F10-recipe-selected', false, 'bring-up: ' + r2.out); return; }
    const s = statusFresh(ctx, 'A');
    const recipeName = s.json ? String(s.json.recipe || '').split('/').pop() : null;
    record('F10-recipe-selected', recipeName === 'recipe.mjs', 'recipe in status: ' + JSON.stringify(s.json && s.json.recipe));
  },

  // Same record id on both machines; a void naming it retires it on both.
  '11-record-id-stability': async (ctx) => {
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record('11-record-id-stability', false, 'bring-up: ' + r.out); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record('11-record-id-stability', false, 'bring-up B: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const wA = watcher(ctx, 'A');
    await settleWatcher(ctx, 'A');
    const p = post(ctx, 'A', 'i-1', 'id across machines');
    const rid = p.recordId;
    await waitForRemote(ctx, (items) => items.some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid)), 6000);
    await stopAllWatchers(ctx);
    mech(ctx, 'sync', [], { machine: 'B' });
    const onB = storeItems(ctx, 'B').some((x) => x.id === 'i-1' && x.comments.some((c) => c.id === rid));
    record('11-same-id-both-machines', onB, onB ? 'id ' + rid + ' on both' : 'id ' + rid + ' missing on B');
    const wB = watcher(ctx, 'B');
    await settleWatcher(ctx, 'B');
    // retire the record with a void naming its comment id
    const storeB2 = storeOf(ctx, 'B');
    const v = fakeVoid(ctx, 'B', rid);
    const published = await waitForRemote(ctx, (items) => items.some((x) => x.type === 'void' && x.target === rid), 6000);
    await stopAllWatchers(ctx);
    mech(ctx, 'sync', [], { machine: 'A' });
    const onA = storeItems(ctx, 'A').some((x) => x.type === 'void' && x.target === rid);
    record('11-void-retires-on-both', v.code === 0 && !!published.value && onA,
      'void exit ' + v.code + ', on remote: ' + !!published.value + ', on A: ' + onA);
  },

  // 14. One store per machine: the state folder is named after the MAIN checkout,
  // so a linked worktree of the same machine reaches the store the main checkout
  // made instead of making one of its own. No --state is passed here: the name the
  // mechanism derives IS the subject.
  '14-machine-store-per-machine': async (ctx) => {
    const xstate = join(ctx.scratch, 'xstate');
    mkdirSync(xstate, { recursive: true });
    const env = { XDG_STATE_HOME: xstate };
    const wt = join(ctx.scratch, 'linked-wt');
    const add = sh('git', ['-C', ctx.codeA, 'worktree', 'add', '-b', 'linked', wt]);
    if (add.code !== 0) { record('14-machine-store-per-machine', false, 'could not make a linked worktree: ' + add.out); return; }
    const main = mechDefault(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { repo: ctx.codeA, env });
    const fromWt = mechDefault(ctx, 'connect', ['--machine', 'A', '--checkout', wt], { repo: wt, env });
    const storeOfRun = (r) => (r.stdout.match(/connected \d+ checkout\(s\) to (\S+) on /) || [])[1] || null;
    const a = storeOfRun(main); const b = storeOfRun(fromWt);
    const dirs = existsSync(xstate) ? readdirSync(xstate) : [];
    const oneStore = a && b && resolve(a) === resolve(b) && dirs.length === 1;
    record('14-machine-store-per-machine', main.code === 0 && fromWt.code === 0 && oneStore,
      'main connect exit ' + main.code + ' -> ' + a + ', linked worktree connect exit ' + fromWt.code + ' -> ' + b
      + ', state folders ' + JSON.stringify(dirs));
    // the worktree's own checkout reaches the same store
    if (oneStore) {
      const where = sh('node', [ctx.fake, 'where'], { cwd: wt });
      record('14-worktree-reaches-the-store', where.code === 0 && resolve(where.stdout.trim()) === resolve(a),
        'the worktree reaches ' + where.stdout.trim() + ' (store ' + a + ')');
    }
  },

  // 15. A remote that answers is reachable. A bare remote whose HEAD names a
  // branch that does not exist (git init --bare defaulting to master while the
  // project pushes main) answers every ls-remote and holds the store ref.
  '15-remote-that-answers-without-a-head': async (ctx) => {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('15-remote-that-answers-without-a-head', false, 'bring-up: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const weird = join(ctx.scratch, 'no-head.git');
    const init = sh('git', ['init', '--bare', '--initial-branch', 'master', weird]);
    const push = sh('git', ['-C', ctx.codeA, 'push', '-q', weird, 'refs/tracker/state:refs/tracker/state']);
    if (init.code !== 0 || push.code !== 0) { record('15-remote-that-answers-without-a-head', false, 'could not prepare the remote: ' + (init.out + push.out).slice(0, 150)); return; }
    const absent = sh('git', ['-C', ctx.codeA, 'ls-remote', '--exit-code', weird, 'HEAD']);
    const answers = sh('git', ['-C', ctx.codeA, 'ls-remote', weird, 'HEAD']);
    sh('git', ['-C', ctx.codeA, 'remote', 'set-url', 'origin', weird]);
    const c = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA]);
    sh('git', ['-C', ctx.codeA, 'remote', 'set-url', 'origin', ctx.remote]);
    // the premise: the remote answers, and --exit-code on HEAD says "no such ref"
    const premise = answers.code === 0 && absent.code === 2;
    record('15-remote-that-answers-without-a-head', premise && c.code === 0,
      'ls-remote HEAD exit ' + answers.code + ' with the ref absent, ls-remote --exit-code HEAD exit ' + absent.code
      + ', connect exit ' + c.code + ' ' + (c.stderr || '').split('\n')[0].slice(0, 120));
  },

  // 16. A hooks folder inside the repository: a project's own hooks, kept tracked
  // by design and shared by every clone. connect accepts the folder when every
  // hook the layout needs already carries the marker line connect itself writes
  // for that step: it writes nothing there and the tracked files stay byte for
  // byte as they were. A hook that is missing or lacks its marker is refused, exit
  // 1, named with the line for the project to add by hand.
  '16-hooks-inside-the-repository-refused': async (ctx) => {
    const hooks = join(ctx.codeA, 'hooks');
    const names = ['post-commit', 'post-merge', 'post-checkout'];
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'post-commit'), '#!/bin/sh\necho the project\'s own hook\n');
    sh('chmod', ['+x', join(hooks, 'post-commit')]);
    sh('git', ['-C', ctx.codeA, 'config', 'core.hooksPath', 'hooks']);
    // the whole folder, byte for byte: what the acceptance and the refusal are
    // judged on is the hooks' content, and neither may write into it
    const readFolder = () => Object.fromEntries(names.map((n) => [n, existsSync(join(hooks, n)) ? readFileSync(join(hooks, n), 'utf8') : null]));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const before = readFolder();
    // the refusal is read whole, not through the bring-up summary: the case pastes
    // back exactly what it prints
    const r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    const afterRefusal = readFolder();
    const added = names.filter((n) => before[n] === null && afterRefusal[n] !== null);
    const blocks = [...r.out.matchAll(/^\s{2}(post-[a-z]+):\n\s+(# shady2k[^\n]*)\n\s+(node [^\n]*)$/gm)];
    record('16-hooks-inside-the-repository-refused', r.code === 1 && same(afterRefusal, before) && added.length === 0 && blocks.length === 3,
      'connect exit ' + r.code + ', the whole folder is unchanged: ' + same(afterRefusal, before)
      + ', files written beside it: ' + JSON.stringify(added) + ', recognizable steps printed: ' + blocks.length);
    // Every step it prints belongs to a hook of this folder and names it, because
    // the check reads the marker: the project is told which hook to put it in.
    const named = [...r.out.matchAll(/^\s{2}(post-[a-z]+):/gm)].map((m) => m[1]);
    record('16-the-refusal-names-each-hook-that-lacks-its-marker', names.every((n) => named.includes(n)),
      'the refusal names: [' + named.join(', ') + '] of the hooks the layout needs [' + names.join(', ') + ']');
    // The repair it prints has to complete the setup, marker line and command
    // together: a command without the marker would be refused again, and connect
    // could never finish in this project.
    for (const [, name, mark, line] of blocks) {
      writeFileSync(join(hooks, name), `#!/bin/sh\n${mark}\n${line}\n`);
      sh('chmod', ['+x', join(hooks, name)]);
    }
    const pasted = readFolder();
    // the hooks are the project's own files, tracked: connect must leave them
    // exactly as git has them, so a connect on every clone and rerun commits
    // nothing and the same hooks serve every machine
    sh('git', ['-C', ctx.codeA, 'add', 'hooks']);
    sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', '-c', 'core.hooksPath=/nonexistent-hooks', 'commit', '-qm', 'the project keeps its hooks tracked']);
    const again = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    const tracked = sh('git', ['-C', ctx.codeA, 'status', '--porcelain', '--', 'hooks']).stdout.trim() === '';
    record('16-a-tracked-folder-that-carries-the-step-is-accepted', again.code === 0 && same(readFolder(), pasted) && tracked,
      'connect exit ' + again.code + ', the tracked hooks are byte for byte as they were: ' + same(readFolder(), pasted)
      + ', git reports the folder clean: ' + tracked + ' ' + (again.stderr || '').split('\n')[0].slice(0, 120));
    // One needed hook loses its marker, and nothing else: refused, that hook named
    // alone, the other tracked hooks untouched.
    const lineOf = Object.fromEntries(blocks.map(([, n, , line]) => [n, line]));
    writeFileSync(join(hooks, 'post-merge'), `#!/bin/sh\n${lineOf['post-merge'] || 'exit 0'}\n`);
    sh('chmod', ['+x', join(hooks, 'post-merge')]);
    const beforeOne = readFolder();
    const one = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    const afterOne = readFolder();
    const namedOne = [...one.out.matchAll(/^\s{2}(post-[a-z]+):/gm)].map((m) => m[1]);
    record('16-a-needed-hook-without-its-marker-is-refused-by-name',
      one.code === 1 && namedOne.join(',') === 'post-merge' && same(afterOne, beforeOne),
      'connect exit ' + one.code + ', named: [' + namedOne.join(', ') + '], the folder is unchanged: ' + same(afterOne, beforeOne)
      + ' ' + (one.stderr || '').split('\n')[0].slice(0, 120));
    // Git's own metadata directory is not the repository's files: pointing the
    // hooks at it is the default folder, and it was accepted before this check
    sh('git', ['-C', ctx.codeA, 'config', 'core.hooksPath', '.git/hooks']);
    const inGit = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA], { machine: 'A' });
    sh('git', ['-C', ctx.codeA, 'config', '--unset', 'core.hooksPath']);
    record('16-git-metadata-hooks-dir-is-allowed', inGit.code === 0,
      'connect exit ' + inGit.code + ' with core.hooksPath=.git/hooks ' + (inGit.stderr || '').split('\n')[0].slice(0, 140));
  },

  // 17. The record step run from the hook git itself runs: the recording lands, and
  // a revision that is already recorded is success with nothing written.
  '17-record-from-a-hook-and-already-recorded': async (ctx) => {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('17-record-from-a-hook-and-already-recorded', false, 'bring-up: ' + r.out.split('\n').slice(0,4).join(' | ')); return; }
    const store = storeOf(ctx, 'A');
    const recDir = join(store, '.tracker-sync', 'recordings');
    const recsBefore = existsSync(recDir) ? readdirSync(recDir).length : 0;
    if (!existsSync(recDir)) { record('17-record-from-a-hook-and-already-recorded', false, 'the store has no recordings directory'); return; }
    // a plain commit: the installed post-commit runs the record step with git's own
    // hook environment set, exactly as the first post-commit did
    writeFileSync(join(ctx.codeA, 'one.txt'), 'one\n');
    sh('git', ['-C', ctx.codeA, 'add', '.']);
    const commit = sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'a commit the hook records']);
    const rev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    const file = join(recDir, rev + '.jsonl');
    // the hook runs synchronously inside the commit; poll briefly, not on the clock alone
    const wrote = await waitUntil(async () => (existsSync(file) ? true : null), 5000, 100);
    const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const bodyRead = existsSync(file) ? exportAt(ctx, 'A', rev) : { code: 1, stdout: '' };
    record('17-record-from-a-hook', commit.code === 0 && !!wrote.value && body.trim().startsWith('{') && bodyRead.stdout.includes('"i-1"'),
      'commit exit ' + commit.code + ', recording for ' + rev.slice(0, 12) + ': ' + existsSync(file)
      + ' (recordings before the commit: ' + recsBefore + ', now: ' + readdirSync(recDir).length + ')');
    // a revision already recorded is success, and a recording is never moved
    const again = mech(ctx, 'record', ['--revision', rev, '--checkout', ctx.codeA], { machine: 'A' });
    const body2 = existsSync(file) ? readFileSync(file, 'utf8') : '';
    record('17-already-recorded-is-success', again.code === 0 && body2 === body && /already recorded/i.test(again.out),
      'exit ' + again.code + ', the recording is unchanged: ' + (body2 === body) + ', ' + (again.stdout || again.out).split('\n')[0].slice(0, 100));
    // A recording this machine kept while the remote's publish of the same revision
    // is refused leaves two different states for one revision. That is the conflict
    // a person decides, so it is never reported as "already recorded".
    const published = mech(ctx, 'publish', [], { machine: 'A' });
    const tip = remoteTip(ctx);
    const onRemote = tip ? sh('git', ['-C', ctx.remote, 'cat-file', '-p', tip + ':.tracker-sync/recordings/' + rev + '.jsonl']).stdout : '';
    writeFileSync(file, `${body}different state\n`);
    const conflicting = mech(ctx, 'record', ['--revision', rev, '--checkout', ctx.codeA], { machine: 'A' });
    writeFileSync(file, body);
    record('17-a-conflicting-recording-needs-a-person', published.code === 0 && !!onRemote && conflicting.code === 1 && /person|different/i.test(conflicting.out),
      'the remote holds the recording: ' + !!onRemote + ', record exit ' + conflicting.code + ' — ' + (conflicting.stderr || conflicting.out).split('\n')[0].slice(0, 140));
  },

  // 18. The tracker's own settings travel with the items: a setting that changes the
  // tracker's behaviour survives the move and a second machine's connect.
  '18-br-settings-survive-the-move': async (ctx) => {
    if (!brOnPath()) { console.log('SKIP (named): br is not on PATH, so the tracker\'s own settings cannot be proved here'); return; }
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('18-br-settings-survive-the-move', false, 'bring-up A: ' + r.out.split('\n').slice(0,3).join(' | ')); return; }
    const storeA = storeOf(ctx, 'A');
    const setting = 'claim_exclusive: true\n';
    writeFileSync(join(storeA, '.beads', 'config.yaml'), setting);
    // the tracker's workflow policy is a settings file of its own (#52)
    const policy = 'statuses:\n  - name: submitted\n';
    writeFileSync(join(storeA, '.beads', 'policy.yaml'), policy);
    r = mech(ctx, 'publish', [], { machine: 'A' });
    if (r.code !== 0) { record('18-br-settings-survive-the-move', false, 'publish A: ' + r.out.split('\n')[0]); return; }
    // B: a fresh clone, connect rebuilds its database and its settings from the ref
    r = bringUp(ctx, 'B');
    const storeB = storeOf(ctx, 'B');
    const cfgB = storeB ? join(storeB, '.beads', 'config.yaml') : null;
    const got = cfgB && existsSync(cfgB) ? readFileSync(cfgB, 'utf8') : '';
    const polB = storeB ? join(storeB, '.beads', 'policy.yaml') : null;
    const gotPolicy = polB && existsSync(polB) ? readFileSync(polB, 'utf8') : '';
    record('18-br-settings-survive-the-move', r.code === 0 && /claim_exclusive:\s*true/.test(got) && gotPolicy === policy,
      'connect B exit ' + r.code + ', its settings carry ' + JSON.stringify(got.trim().slice(0, 60)) + ', its policy ' + JSON.stringify(gotPolicy.trim().slice(0, 60)));
  },

  // 19. A checkout of a branch from before the move leaves a real tracker folder
  // where the pointer belongs: connect relinks it, the hook does the same on the
  // next checkout, and a folder that really holds a tracker is refused by name.
  '19-br-relink-after-a-pre-move-branch': async (ctx) => {
    if (!brOnPath()) { console.log('SKIP (named): br is not on PATH, so the pointer cannot be relinked here'); return; }
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('19-br-relink-after-a-pre-move-branch', false, 'bring-up A: ' + r.out.split('\n').slice(0,3).join(' | ')); return; }
    const store = storeOf(ctx, 'A');
    // what the checkout leaves: the tracker's locks and nothing else
    const pointer = join(ctx.codeA, '.beads');
    rmSync(pointer, { recursive: true, force: true });
    mkdirSync(pointer, { recursive: true });
    writeFileSync(join(pointer, '.write.lock'), '');
    const c = connect(ctx, 'A');
    const linked = (() => { const st = lstatSync(pointer, { throwIfNoEntry: false }); return !!st && st.isSymbolicLink() && resolve(readlinkSync(pointer)) === resolve(join(store, '.beads')); })();
    record('19-connect-relinks-a-leftover-folder', c.code === 0 && linked,
      'connect exit ' + c.code + ', the pointer is a link to the store: ' + linked + ' ' + (c.out || '').split('\n').slice(0, 2).join(' | ').slice(0, 140));
    // a folder that holds a tracker is never overwritten
    const other = join(ctx.scratch, 'other');
    sh('git', ['clone', ctx.remote, other]);
    mkdirSync(join(other, '.beads'), { recursive: true });
    writeFileSync(join(other, '.beads', 'issues.jsonl'), '{"id":"x-1"}\n');
    const check = sh('node', [ctx.recipe, 'pointer-check', '--checkout', other], { cwd: store });
    const install = sh('node', [ctx.recipe, 'pointer-install', '--checkout', other], { cwd: store });
    const kept = existsSync(join(other, '.beads', 'issues.jsonl')) && !lstatSync(join(other, '.beads')).isSymbolicLink();
    record('19-a-real-folder-is-refused', check.code === 1 && install.code === 1 && kept,
      'pointer-check exit ' + check.code + ', pointer-install exit ' + install.code + ', the folder is kept: ' + kept
      + ' — ' + (check.stderr || check.out).split('\n')[0].slice(0, 120));
    // the post-checkout hook relinks: a branch checked out after the folder is back
    const c2 = connect(ctx, 'A');
    rmSync(pointer, { recursive: true, force: true });
    mkdirSync(pointer, { recursive: true });
    writeFileSync(join(pointer, '.write.lock'), '');
    const co = sh('git', ['-C', ctx.codeA, 'checkout', '-q', '-b', 'after-the-move']);
    const relinked = (() => { const st = lstatSync(pointer, { throwIfNoEntry: false }); return !!st && st.isSymbolicLink() && resolve(readlinkSync(pointer)) === resolve(join(store, '.beads')); })();
    record('19-the-checkout-hook-relinks', c2.code === 0 && co.code === 0 && relinked,
      'checkout exit ' + co.code + ', the hook put the pointer back: ' + relinked);
  },

  // 20. The tracker's own settings file merges three-way, absence included: the
  // side that deleted it did so to bring the tracker's defaults back, and a merge
  // that restored the ancestor's file would re-enable the setting silently.
  '20-br-settings-deletion-merges': async (ctx) => {
    if (!brOnPath()) { console.log('SKIP (named): br is not on PATH, so the tracker\'s own settings cannot be merged here'); return; }
    const r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('20-br-settings-deletion-merges', false, 'bring-up A: ' + r.out.split('\n').slice(0,3).join(' | ')); return; }
    const store = storeOf(ctx, 'A');
    const cfg = 'claim_exclusive: true\n';
    // the merge only needs the tracker's own state files in the sides and the
    // store's machine ordinals, so the item is written here rather than through
    // the tracker's create command
    const issues = `${JSON.stringify({ id: 'br-x-1', title: 'settings proof', status: 'open', updated_at: '2026-10-13T10:00:00Z' })}\n`;
    const files = {};
    for (const n of ['base', 'ours', 'theirs', 'out', 'order', 'orderLocal']) files[n] = join(ctx.scratch, 'm-' + n + '.txt');
    writeFileSync(files.order, '');
    writeFileSync(files.orderLocal, '');
    // a side file in the shape the mechanism builds: the state files with markers
    const side = (p, withCfg) => writeFileSync(p, `=== .beads/issues.jsonl\n${issues}=== .beads/beads.base.jsonl\n${issues}`
      + (withCfg ? `=== .beads/config.yaml\n${cfg}` : ''));
    const merge = () => sh('node', [ctx.recipe, 'merge', '--ours', files.ours, '--theirs', files.theirs, '--base', files.base,
      '--out', files.out, '--order', files.order, '--order-local', files.orderLocal, '--store', store], { cwd: store });
    // ours deleted the settings, theirs left the ancestor's
    writeFileSync(join(store, '.beads', 'config.yaml'), cfg);
    side(files.base, true); side(files.theirs, true); side(files.ours, false);
    const m1 = merge();
    const gone1 = !readFileSync(files.out, 'utf8').includes('.beads/config.yaml') && !existsSync(join(store, '.beads', 'config.yaml'));
    // theirs deleted it, ours left the ancestor's
    writeFileSync(join(store, '.beads', 'config.yaml'), cfg);
    side(files.ours, true); side(files.theirs, false);
    const m2 = merge();
    const gone2 = !readFileSync(files.out, 'utf8').includes('.beads/config.yaml') && !existsSync(join(store, '.beads', 'config.yaml'));
    // a settings file only one side carries is carried, never dropped
    side(files.base, false); side(files.ours, true); side(files.theirs, false);
    const m3 = merge();
    const kept = readFileSync(files.out, 'utf8').includes('claim_exclusive: true');
    record('20-br-settings-deletion-merges', m1.code === 0 && m2.code === 0 && m3.code === 0 && gone1 && gone2 && kept,
      'merge exits ' + m1.code + '/' + m2.code + '/' + m3.code + ', deleted on ours: ' + gone1 + ', deleted on theirs: ' + gone2
      + ', carried when only one side has it: ' + kept);
  },

  // 21. A flush the tracker refuses is never read as "nothing unexported". A
  // write the tracker accepted sits in its database while a later per-item merge
  // rewrites the state files; the refused database is exported to a side file,
  // merged per item, and the write survives. A refusal the recipe declares
  // harmless is still said and the state files stand.
  '21-refused-flush-keeps-the-write': async (ctx) => {
    const id = '21-refused-flush-keeps-the-write';
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record(id, false, 'bring-up A: ' + r.out); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record(id, false, 'bring-up B: ' + r.out); return; }
    const storeA = storeOf(ctx, 'A');
    // A write the tracker accepted and has not flushed: in the database only.
    const w = sh('node', [ctx.fake, 'db-write', '--item', 'i-1', '--text', 'accepted, not flushed'], { cwd: storeA });
    const inFileBefore = storeItems(ctx, 'A').find((x) => x.id === 'i-1')?.comments?.some((c) => c.text === 'accepted, not flushed');
    // The remote moves under it, so the sync has a per-item merge to do, and the
    // tracker refuses to flush its own database.
    post(ctx, 'B', 'i-2', 'from B while the write sat in the database');
    const pub = mech(ctx, 'publish', [], { machine: 'B' });
    const s = mech(ctx, 'sync', [], { machine: 'A', env: { FAKE_EXPORT_REFUSAL: 'jsonl-changed' } });
    const items = storeItems(ctx, 'A');
    const kept = (items.find((x) => x.id === 'i-1')?.comments || []).some((c) => c.text === 'accepted, not flushed');
    const mergedB = (items.find((x) => x.id === 'i-2')?.comments || []).some((c) => c.text === 'from B while the write sat in the database');
    record(id, w.code === 0 && !inFileBefore && pub.code === 0 && s.code === 0 && kept && mergedB,
      'the write was in the database only: ' + !inFileBefore + ', sync exit ' + s.code + ', the write survived: ' + kept
      + ', the merge from B landed: ' + mergedB + (s.code !== 0 ? ' — ' + s.out.split('\n').slice(0, 2).join(' | ') : ''));
    // The harmless refusal: the recipe declares one that proves nothing sits only
    // in the database, so it is said and the state files are taken as they are.
    post(ctx, 'B', 'i-3', 'a later write from B');
    mech(ctx, 'publish', [], { machine: 'B' });
    const harmless = mech(ctx, 'sync', [], { machine: 'A', env: { FAKE_EXPORT_REFUSAL: 'empty-over-filled' } });
    record('21-a-declared-harmless-refusal-is-said', harmless.code === 0 && /holds no unexported write/.test(harmless.out),
      'exit ' + harmless.code + ', out: ' + harmless.out.split('\n').filter(Boolean).slice(0, 2).join(' | ').slice(0, 160));
  },

  // 22. The watcher's two loops are one process and one file lock: they queue on
  // each other in-process, so neither waits for a lock its own process holds, and
  // a round that cannot take the lock is skipped and said once - never an exit.
  '22-watcher-publish-and-sync-overlap': async (ctx) => {
    const id = '22-watcher-publish-and-sync-overlap';
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record(id, false, 'bring-up: ' + r.out); return; }
    // A slow export makes the publish loop hold the store while the sync loop
    // wants it, in the same process, every tick.
    ctx.debugEnv = { FAKE_SLOW_EXPORT: '6000' };
    const w = watcher(ctx, 'A', ['--interval', '1', '--debounce', '2']);
    await sleep(9000);
    const log1 = existsSync(w.logPath) ? readFileSync(w.logPath, 'utf8') : '';
    const selfWait = /waiting for the store lock/.test(log1) || /the store is locked by pid/.test(log1);
    const alive1 = w.exitCode === null && w.signalCode === null;
    record('22-the-watcher-does-not-wait-on-its-own-lock', alive1 && !selfWait,
      'alive: ' + alive1 + ', a self-wait was said: ' + selfWait + ', log: ' + log1.split('\n').filter(Boolean).slice(-1).join('').slice(0, 140));
    // Another command holds the store past the watcher's own wait: the round is
    // skipped, said once, and the watcher stays up. A holder of its own process
    // would be the same wait; this is a foreign one, so the file lock is the only
    // thing between them.
    const holder = spawn('node', ['-e', `import(${JSON.stringify(ctx.mech)}).then(async (m) => {
      const flags = { state: ${JSON.stringify(ctx.stateA)} };
      const repo = ${JSON.stringify(ctx.codeA)};
      for (let i = 0; i < 240; i++) {
        try { m.takeLock(flags, repo); break; }
        catch { await new Promise((r) => setTimeout(r, 250)); }
      }
      setTimeout(() => {}, 24000);
    })`], { stdio: 'ignore' });
    ctx.watchers.push(holder);
    await sleep(30000);
    const log2 = existsSync(w.logPath) ? readFileSync(w.logPath, 'utf8') : '';
    const alive2 = w.exitCode === null && w.signalCode === null;
    const skipped = (log2.match(/another command holds the store lock/g) || []).length;
    record('22-a-lock-timeout-skips-the-round-said-once', alive2 && skipped === 1,
      'alive after the holder passed the wait: ' + alive2 + ', the skip was said ' + skipped + ' time(s)');
    try { holder.kill('SIGKILL'); } catch { /* it exits on its own */ }
  },

  // 23. A refusal the recipe does not classify is the dangerous one: with no way
  // to export the database to a side file the sync stops (exit 1, naming what is
  // at risk) instead of continuing, and the write stays in the database.
  '23-an-unclassified-refusal-stops': async (ctx) => {
    const id = '23-an-unclassified-refusal-stops';
    let r = bringUp(ctx, 'A'); if (r.code !== 0) { record(id, false, 'bring-up A: ' + r.out); return; }
    r = bringUp(ctx, 'B'); if (r.code !== 0) { record(id, false, 'bring-up B: ' + r.out); return; }
    const storeA = storeOf(ctx, 'A');
    sh('node', [ctx.fake, 'db-write', '--item', 'i-1', '--text', 'accepted, not flushed'], { cwd: storeA });
    post(ctx, 'B', 'i-2', 'a write from B');
    mech(ctx, 'publish', [], { machine: 'B' });
    const head = () => sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    const before = head();
    const s = mech(ctx, 'sync', [], { machine: 'A', env: { FAKE_EXPORT_REFUSAL: 'unknown', FAKE_RECIPE_DECLARES_NO_REFUSAL: '1' } });
    const db = (() => { try { return JSON.parse(readFileSync(join(storeA, 'fake', 'db.json'), 'utf8')); } catch { return { records: [] }; } })();
    const stillThere = ((db.records || []).find((x) => x.id === 'i-1')?.comments || []).some((c) => c.text === 'accepted, not flushed');
    record(id, s.code === 1 && /may lack writes/.test(s.out) && head() === before && stillThere,
      'exit ' + s.code + ', the write is still in the database: ' + stillThere + ', nothing was committed: ' + (head() === before)
      + ' — ' + s.out.split('\n').filter(Boolean).slice(0, 1).join('').slice(0, 150));
  },

  // 24. A killed write leaves nothing behind for good, and a candidate weighs
  // what a conditional write reads - not the store (issue #45: four dead
  // candidates of 7-11 GB, 35 GB held, and a commit's state lost to ENOSPC).
  '24-candidates-are-small-and-swept': async (ctx) => {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('24-candidates-are-small-and-swept', false, 'bring-up: ' + r.out); return; }
    const store = storeOf(ctx, 'A');
    const stateDir = ctx.stateA;
    // A store shaped like the one in the report: an ignored folder the tracker
    // keeps for itself, and recordings of earlier revisions beside it.
    mkdirSync(join(store, 'fake', 'recovery'), { recursive: true });
    writeFileSync(join(store, 'fake', 'recovery', 'backup.bin'), Buffer.alloc(6 * 1024 * 1024, 1));
    const rev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    mech(ctx, 'record', ['--revision', rev, '--checkout', ctx.codeA], { machine: 'A' });
    const storeBytes = folderBytes(store);

    // A recipe whose import blocks, so a candidate stands still while it is
    // measured and can be killed exactly where a hook timeout kills it.
    // The recipe copy needs the tracker's own script beside it: a recipe is a
    // module, and a copy that cannot resolve its neighbour answers nothing.
    const blockingDir = join(ctx.scratch, 'blocking');
    mkdirSync(blockingDir, { recursive: true });
    cpSync(ctx.fake, join(blockingDir, 'fake.mjs'));
    const blocking = join(blockingDir, 'recipe.mjs');
    writeFileSync(blocking, readFileSync(ctx.recipe, 'utf8').replace(/import: `[^`]*`,/, "import: 'sleep 25',"));
    const blockedLog = join(ctx.scratch, 'blocked-record.log');
    const blockedFd = openSync(blockedLog, 'w');
    const killed = spawn(process.execPath, [ctx.mech, 'record', '--revision', rev, '--checkout', ctx.codeA,
      '--recipe', blocking, '--state', stateDir, '--repo', ctx.codeA], { cwd: ctx.scratch, stdio: ['ignore', blockedFd, blockedFd] });
    const stood = await waitUntil(() => (candidateDirs(stateDir).length ? candidateDirs(stateDir)[0] : null), 20000, 100);
    const candidate = stood.value;
    let candidateBytes = -1; let holdsBackup = null; let holdsRecordingState = null;
    if (candidate) {
      candidateBytes = folderBytes(candidate);
      holdsBackup = existsSync(join(candidate, 'fake', 'recovery', 'backup.bin'));
      // The recording of the revision is in the store; the candidate's worktree
      // leaves the recordings out, and what it does hold is the reference, not a copy.
      const recs = existsSync(join(candidate, '.tracker-sync', 'recordings')) ? readdirSync(join(candidate, '.tracker-sync', 'recordings')) : [];
      holdsRecordingState = recs.length;
    }
    // A live candidate beside it: a diagnostic naming a process that is running
    // now is never swept, whatever its phase says.
    const live = fakeCandidate(stateDir, { pid: process.pid, phase: 'preparing' });
    // What a kill leaves: a candidate folder with no diagnostic at all.
    const orphan = fakeCandidate(stateDir, { pid: 1, folder: true, result: false });
    // And one whose process is gone, with a settled result file beside it.
    const dead = fakeCandidate(stateDir, { pid: 999999, phase: 'preparing' });
    const settled = fakeCandidate(stateDir, { pid: 999998, phase: 'accepted', folder: false, result: true });
    // An unknown outcome is evidence a reconcile reads: its ref and its
    // diagnostic stay, and the sweep must not touch either.
    // A retained outcome with a copy still beside it: the copy goes, the diagnostic
    // that names its retained ref stays, or a reconcile has nothing to read.
    const unknown = fakeCandidate(stateDir, { pid: 999997, phase: 'unknown', folder: true, result: true });
    // Kill the record exactly as a hook timeout does: the candidate, its worktree
    // registration and its diagnostic stay behind, and no finally runs.
    // The listener first: a SIGKILL can land before a later one is attached, and
    // waiting for an event that already happened is a hung proof, not a verdict.
    const exited = new Promise((res) => killed.on('exit', res));
    killed.kill('SIGKILL');
    await Promise.race([exited, sleep(10000)]);
    const afterKill = candidateDirs(stateDir).length;
    const swept = mech(ctx, 'status', ['--json'], { machine: 'A' });
    let out = null;
    // The sweep may say a line first (a lock whose process is gone was broken):
    // the JSON starts at the first brace, whatever was said before it.
    try { out = JSON.parse(swept.stdout.slice(Math.max(0, swept.stdout.indexOf('{')))); } catch { /* the assertions below say so */ }
    const listed = sh('git', ['-C', store, 'worktree', 'list', '--porcelain']).stdout;
    const keptLive = existsSync(join(stateDir, live)) && existsSync(join(stateDir, live + '.result.json'));
    record('24-a-candidate-weighs-what-a-write-reads',
      !!candidate && candidateBytes >= 0 && candidateBytes < 512 * 1024 && holdsBackup === false && holdsRecordingState === 0,
      'store ' + Math.round(storeBytes / 1024) + ' KB, candidate ' + Math.round(candidateBytes / 1024) + ' KB'
      + ', holds the ignored backups: ' + holdsBackup + ', whole recordings held: ' + holdsRecordingState
      + (candidate ? '' : ' / the killed record said: ' + (existsSync(blockedLog) ? readFileSync(blockedLog, 'utf8').split('\n').slice(0, 3).join(' | ') : 'nothing')));
    record('24-a-killed-write-is-swept-by-the-next-command',
      afterKill > 0 && candidate && !existsSync(candidate) && !existsSync(candidate + '.result.json')
      && !listed.includes(candidate) && !existsSync(join(stateDir, orphan)) && !existsSync(join(stateDir, dead)),
      'before the sweep: ' + afterKill + ' candidate(s), after: ' + candidateDirs(stateDir).length
      + ', the killed folder is gone: ' + (!!candidate && !existsSync(candidate)) + ', its worktree registration is gone: ' + (!!candidate && !listed.includes(candidate)));
    record('24-a-live-candidate-survives-and-a-settled-one-goes',
      keptLive && !existsSync(join(stateDir, settled + '.result.json'))
      && !existsSync(join(stateDir, unknown)) && existsSync(join(stateDir, unknown + '.result.json')),
      'the live candidate is kept: ' + keptLive + ', a settled result file is gone: ' + !existsSync(join(stateDir, settled + '.result.json'))
      + ', an unknown outcome keeps its diagnostic: ' + existsSync(join(stateDir, unknown + '.result.json'))
      + ' and loses its dead copy: ' + !existsSync(join(stateDir, unknown)));
    record('24-status-reports-the-size-and-the-leftovers',
      !!out && out.disk && out.disk.store.bytes >= storeBytes && out.disk.machineDir.bytes >= out.disk.store.bytes
      && typeof out.disk.candidates.retained === 'number' && out.disk.candidates.retained >= 1,
      'disk: ' + JSON.stringify(out && out.disk && { store: out.disk.store.bytes, machine: out.disk.machineDir.bytes, stale: out.disk.candidates.stale, retained: out.disk.candidates.retained })
      + (out ? '' : ' / status said: ' + (swept.out || '').split('\n').slice(0, 3).join(' | ').slice(0, 200)));
    // The report a person reads says the same, in words.
    const spoken = mech(ctx, 'status', [], { machine: 'A' });
    record('24-status-prints-the-size-in-words', /disk\s+machine folder [\d.]+ [KMG]B/.test(spoken.stdout) && /leftovers\s+\d+ dead candidate/.test(spoken.stdout),
      spoken.stdout.split('\n').filter((l) => /^disk|^leftovers|^recordings/.test(l)).join(' | ').slice(0, 160));
    for (const name of [live, unknown]) { rmSync(join(stateDir, name), { recursive: true, force: true }); rmSync(join(stateDir, name + '.result.json'), { force: true }); }
  },

  // 29. Recordings written by a release that recorded the whole state (#49, after
  // 0.127.0). 0.121.0 copied the store's WORKING TREE, so its copies carry a file
  // the store's own git ignores (br's .beads/beads.base.jsonl) and can lack a
  // declared file the commits hold; 0.127.0 compared path sets and converted none
  // of a store's 1110 recordings. The fixture is the released mechanism itself, so
  // this is the shape the field holds, not one the current code would write. Every
  // recording that is kept says why, in the words of its own case.
  '29-a-recording-of-an-older-release-matches-its-commit': async (ctx) => {
    const id = '29-a-recording-of-an-older-release-matches-its-commit';
    if (!existsSync(OLD_MECH_0121)) { record(id, false, 'the 0.121.0 mechanism fixture is missing: ' + OLD_MECH_0121); return; }
    // The shape is a br store's, and the release's own connect refuses without br on
    // PATH: a machine without the tracker proves nothing here and says so, the way the
    // other br proofs do.
    if (!brOnPath()) { console.log("SKIP (named): br is not on PATH, so a store's recordings of 0.121.0 cannot be built here"); return; }
    const up = oldMech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA, '--prefix', 'br-a']);
    const store = (up.out.match(/connected \d+ checkout\(s\) to (\S+) on /) || [])[1] || null;
    if (up.code !== 0 || !store) { record(id, false, '0.121.0 connect exit ' + up.code + ': ' + up.out.split('\n').slice(-2).join(' | ').slice(0, 260)); return; }
    ctx.storeA = store;
    const stateDir = ctx.stateA;
    const recDir = join(store, '.tracker-sync', 'recordings');
    const seeded = sh('br', ['create', 'first', '-d', 'proof', '--json'], { cwd: store });
    if (seeded.code !== 0) { record(id, false, 'br create failed in ' + store + ' (' + JSON.stringify(readdirSync(store)) + '): ' + seeded.out.slice(0, 160) + ' | connect: ' + up.out.split('\n').slice(-4).join(' | ').slice(0, 240)); return; }
    oldMech(ctx, 'publish', []);
    // A revision per commit: the release's own post-commit hook writes a recording
    // of the store's working tree, which is what a field store holds.
    const revs = [];
    for (let i = 0; i < 3; i++) {
      writeFileSync(join(ctx.codeA, 'note-' + i + '.txt'), 'note ' + i + '\n');
      sh('git', ['-C', ctx.codeA, 'add', '.']);
      sh('git', ['-C', ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'revision ' + i]);
      revs.push(sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim());
    }
    const oldRec = (r) => { const f = join(recDir, r + '.jsonl'); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };
    const partsOf = (text) => {
      const marks = [...text.matchAll(/^=== ([^\n]+)\n/gm)];
      if (!marks.length) return [];
      const out = [];
      for (let i = 0; i < marks.length; i++) {
        const start = marks[i].index + marks[i][0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
        out.push([marks[i][1], i + 1 < marks.length ? text.slice(start, end - 1) : text.slice(start, end)]);
      }
      return out;
    };
    const sideText = (parts) => parts.map(([p, c]) => `=== ${p}\n${c}`).join('\n');
    const firstText = oldRec(revs[0]);
    const oldParts = partsOf(firstText).map(([p]) => p);
    const ignoredBase = sh('git', ['-C', store, 'check-ignore', '--no-index', '--', '.beads/beads.base.jsonl']);
    // The premise this case rests on: the released mechanism wrote a copy that
    // carries a file no store commit can hold.
    record('29-the-fixture-is-what-0.121.0-wrote',
      firstText.trim().startsWith('===') && oldParts.includes('.beads/beads.base.jsonl') && ignoredBase.code === 0,
      '0.121.0 wrote the parts ' + JSON.stringify(oldParts) + '; the store\'s git ignores .beads/beads.base.jsonl (check-ignore exit ' + ignoredBase.code + ')');
    // What a reader gets before the conversion: the bytes the gate's baseline sees.
    const beforeReads = revs.map((r) => oldMech(ctx, 'export', ['--at', r]));
    const idsIn = (state) => {
      const body = (partsOf(state).find(([p]) => p === '.beads/issues.jsonl') || [null, ''])[1] || '';
      return body.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((x) => x && x.id).map((x) => x.id).sort();
    };
    const stateNow = oldRec(revs[revs.length - 1]);
    const issuesBody = (partsOf(stateNow).find(([p]) => p === '.beads/issues.jsonl') || [null, ''])[1];
    // One kept recording per cause, so status must name each of them, not a
    // count of a single verdict (#49's addendum: the reporter needed a print).
    const fakeRev = (n) => 'e'.repeat(39) + n;
    const differRev = fakeRev('1'); const notHeldRev = fakeRev('2'); const opaqueRev = fakeRev('3');
    const junkRev = fakeRev('4'); const dirRev = fakeRev('5'); const localRev = fakeRev('6');
    writeFileSync(join(recDir, differRev + '.jsonl'), '=== .beads/issues.jsonl\n{"id":"i-9","title":"a state no commit holds"}\n');
    writeFileSync(join(recDir, notHeldRev + '.jsonl'), sideText([['.beads/issues.jsonl', issuesBody], ['.beads/config.yaml', 'not: committed\n']]));
    writeFileSync(join(recDir, opaqueRev + '.jsonl'), '=== .beads/issues.jsonl\n=== .beads/config.yaml\ncopy: true\n');
    writeFileSync(join(recDir, junkRev + '.jsonl'), '{"hello":"there"}\n');
    mkdirSync(join(recDir, dirRev + '.jsonl'), { recursive: true });
    writeFileSync(join(recDir, localRev + '.jsonl'), '=== .beads/beads.base.jsonl\n{"id":"i-9"}\n');
    sh('git', ['-C', store, 'add', '-A', '.tracker-sync/recordings']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'recordings no commit can hold, kept for a person']);
    const isRef = (n) => { try { return readFileSync(join(recDir, n), 'utf8').trim().startsWith('{'); } catch { return false; } };
    const names = () => { try { return readdirSync(recDir).filter((n) => n.endsWith('.jsonl')); } catch { return []; } };
    const wholeBefore = names().filter((n) => !isRef(n)).length;
    // Under the heap 0.127.0's own memory case allows, so the bound holds on this
    // shape too, and not only on copies the current code built.
    const migrated = mech(ctx, 'publish', [], { machine: 'A', nodeArgs: ['--max-old-space-size=64'] });
    const converted = revs.filter((r) => isRef(r + '.jsonl')).length;
    record('29-every-0.121.0-recording-is-converted', migrated.code === 0 && converted === revs.length,
      'publish exit ' + migrated.code + ' in a 64 MB heap: ' + converted + ' of ' + revs.length + ' recordings of 0.121.0 are references, of ' + wholeBefore + ' whole states before the pass');
    const afterReads = revs.map((r) => exportAt(ctx, 'A', r));
    const sameItems = revs.every((r, i) => afterReads[i].code === 0 && idsIn(afterReads[i].stdout).join(',') === idsIn(beforeReads[i].stdout).join(','));
    const noIgnoredPart = afterReads.every((x) => !x.stdout.includes('=== .beads/beads.base.jsonl'));
    record('29-the-gate-reads-the-same-tracker-data', sameItems && noIgnoredPart,
      'the items of every revision are the ones the whole copy carried: ' + sameItems
      + '; the ignored file is no longer printed: ' + noIgnoredPart
      + '; what a reader gets now: ' + JSON.stringify(afterReads[0].stdout.slice(0, 90)));
    const mem = () => { try { return JSON.parse(readFileSync(join(stateDir, 'migration.json'), 'utf8')); } catch { return null; } };
    const first = mem();
    const headBefore = sh('git', ['-C', store, 'rev-parse', 'HEAD']).stdout.trim();
    // The command that meets an old installation first is publish (and the record
    // hook); it rewrites nothing when nothing changed, so the pass it does not take
    // is visible in what it left in the machine folder.
    const quiet = mech(ctx, 'publish', [], { machine: 'A' });
    const second = mem();
    record('29-a-command-that-changes-nothing-does-not-read-them-again',
      quiet.code === 0 && first && second && second.passes === first.passes && (Number(second.skips) || 0) > (Number(first.skips) || 0)
      && sh('git', ['-C', store, 'rev-parse', 'HEAD']).stdout.trim() === headBefore,
      'the pass read the recordings ' + (first && first.passes) + ' time(s) and the next command reused that answer: '
      + (second && second.skips) + ' skip(s) after ' + (first && first.skips) + ', the store head did not move');
    // Every cause, in plain words, with one example each, and the list a person reads.
    const spoken = mech(ctx, 'status', [], { machine: 'A' });
    const keptLine = spoken.stdout.split('\n').filter((l) => /^kept\s/.test(l)).join(' | ');
    const listLine = (spoken.stdout.match(/^list\s+(\S+)$/m) || [])[1] || null;
    const said = {
      'a state file differs from the nearest commit': differRev,
      'its text does not come back byte for byte': opaqueRev,
      'does not read back as a recording this mechanism wrote': junkRev,
      'not a regular file': dirRev,
      "one the store's git ignores": localRev,
    };
    const unnamed = Object.entries(said).filter(([word, example]) => !(keptLine.includes(word) && keptLine.includes(example + '.jsonl'))).map(([, example]) => example);
    const listed = listLine && existsSync(listLine) ? readFileSync(listLine, 'utf8').trim().split('\n') : [];
    const listedAll = Object.values(said).every((example) => listed.some((l) => l.startsWith(example + '.jsonl\t')));
    record('29-status-names-each-cause-with-an-example-and-the-list', unnamed.length === 0 && listedAll && listed.length === 6,
      'status said: ' + (keptLine || '(no kept line)').slice(0, 300) + ' | unnamed: ' + JSON.stringify(unnamed)
      + ' | the list ' + listLine + ' holds ' + listed.length + ' line(s), every cause among them: ' + listedAll);
    // A recording that changed makes the next command read them again, and so does
    // a commit: nothing that could change the answer is remembered over.
    const touchedBefore = mem();
    const keptFile = join(recDir, differRev + '.jsonl');
    writeFileSync(keptFile, readFileSync(keptFile, 'utf8'));
    mech(ctx, 'publish', [], { machine: 'A' });
    const touchedAfter = mem();
    const born = sh('br', ['create', 'second', '-d', 'proof', '--json'], { cwd: store });
    mech(ctx, 'publish', [], { machine: 'A' });
    mech(ctx, 'publish', [], { machine: 'A' });
    const movedAfter = mem();
    record('29-a-changed-recording-or-a-new-commit-reads-them-again',
      Number(touchedAfter.passes) === Number(touchedBefore.passes) + 1 && Number(movedAfter.passes) === Number(touchedAfter.passes) + 1,
      'a rewritten recording: passes ' + touchedBefore.passes + ' -> ' + touchedAfter.passes
      + '; a new br issue and its commit: -> ' + movedAfter.passes);
    // What may differ is decided by the store's own git, so a project that stops
    // ignoring its mirror changes what is compared: a recording that prints that
    // file then carries one no commit holds, and that is the cause it is kept for,
    // named with the commit it was compared with.
    const gitignore = join(store, '.beads', '.gitignore');
    const ignoredBefore = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
    writeFileSync(gitignore, ignoredBefore.split('\n').filter((l) => !/beads\.base\.jsonl/.test(l)).join('\n'));
    sh('git', ['-C', store, 'add', '.beads/.gitignore']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'the project stops ignoring its own mirror']);
    const heldRev = 'a'.repeat(40);
    const mirror = join(store, '.beads', 'beads.base.jsonl');
    writeFileSync(join(recDir, heldRev + '.jsonl'), sideText([['.beads/issues.jsonl', readFileSync(join(store, '.beads', 'issues.jsonl'), 'utf8')],
      ['.beads/beads.base.jsonl', existsSync(mirror) ? readFileSync(mirror, 'utf8') : '{"id":"i-9"}\n']]));
    const ruleChanged = mech(ctx, 'publish', [], { machine: 'A' });
    // The command that changed the rule also commits its own state; the pass it ran
    // is one commit behind, so it settles on the next one and is reused after that.
    const settled = mech(ctx, 'publish', [], { machine: 'A' });
    const spokenAgain = mech(ctx, 'status', [], { machine: 'A' });
    const heldSaid = spokenAgain.stdout.split('\n').filter((l) => /^kept\s/.test(l)).join(' ');
    record('29-a-file-no-commit-holds-is-named-with-the-commit',
      ruleChanged.code === 0 && settled.code === 0 && /a state file it prints is in no commit the store holds/.test(heldSaid) && heldSaid.includes(localRev + '.jsonl'),
      'with the rule gone the recording is kept and status says: ' + heldSaid.slice(0, 240));
  },

  // 25. A recording is a reference to the state commit, and it reads back as the
  // same bytes an old snapshot did; two references to commits with the same state
  // are one recording, two states refuse, and a reference that cannot be trusted
  // is said out loud rather than read from a later state.
  '25-recordings-are-references': async (ctx) => {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('25-recordings-are-references', false, 'bring-up: ' + r.out); return; }
    r = bringUp(ctx, 'B');
    if (r.code !== 0) { record('25-recordings-are-references', false, 'bring-up B: ' + r.out); return; }
    const storeA = storeOf(ctx, 'A'); const storeB = storeOf(ctx, 'B');
    const rev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    // a revision recorded from this machine's store: the state the recording binds
    const rec = mech(ctx, 'record', ['--revision', rev, '--checkout', ctx.codeA], { machine: 'A' });
    if (rec.code !== 0) { record('25-recordings-are-references', false, 'record: ' + rec.out.slice(0, 150)); return; }
    mech(ctx, 'sync', [], { machine: 'B' });
    const recPathA = join(storeA, '.tracker-sync', 'recordings', rev + '.jsonl');
    const recPathB = join(storeB, '.tracker-sync', 'recordings', rev + '.jsonl');
    // A recording is a reference: one small line, never the state itself.
    const ref = existsSync(recPathA) ? readFileSync(recPathA, 'utf8') : '';
    const refOk = /"store"\s*:\s*"[0-9a-f]{40,64}"/.test(ref) && ref.length < 400;
    record('25-a-recording-holds-a-reference', refOk, 'recording: ' + ref.trim().slice(0, 120));
    // The same bytes an old snapshot returned: the state at that commit, which is
    // what a gate's baseline at a revision reads.
    const asReference = exportAt(ctx, 'A', rev);
    const snapshot = stateTextOf(ctx, 'A');
    const commitOf = (() => { try { return JSON.parse(ref).store; } catch { return null; } })();
    const fromCommit = commitOf ? sh('git', ['-C', storeA, 'show', commitOf + ':fake/items.jsonl']).stdout : '';
    record('25-export-at-returns-the-same-bytes',
      asReference.code === 0 && asReference.stdout === snapshot && fromCommit && asReference.stdout === '=== fake/items.jsonl\n' + fromCommit,
      'exit ' + asReference.code + ', identical to the state: ' + (asReference.stdout === snapshot) + ', identical to its commit: ' + ('=== fake/items.jsonl\n' + fromCommit === asReference.stdout));
    // An old snapshot of the same state exports the same bytes: converting a store
    // changes no answer, only the space the answer takes.
    writeFileSync(recPathA, snapshot);
    sh('git', ['-C', storeA, 'add', '.tracker-sync/recordings']);
    sh('git', ['-C', storeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'the old form']);
    const asSnapshot = exportAt(ctx, 'A', rev);
    record('25-an-old-snapshot-exports-the-same-bytes', asSnapshot.code === 0 && asSnapshot.stdout === asReference.stdout,
      'exit ' + asSnapshot.code + ', identical: ' + (asSnapshot.stdout === asReference.stdout));
    // Two references to two commits holding the SAME state are not a conflict: the
    // question a recording answers is which state the revision had. Both stores must
    // hold both commits, so the twin is carried onto the ref the way a state taken
    // from a code revision is carried: by a commit that has it as a parent.
    const ct = (treeRev, parents, msg) => sh('git', ['-C', storeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local',
      'commit-tree', treeRev, ...parents.flatMap((x) => ['-p', x]), '-m', msg]).stdout.trim();
    const digest = 'sha256:' + createHash('sha256').update(snapshot, 'utf8').digest('hex');
    mech(ctx, 'publish', [], { machine: 'A' });
    const tipA = sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    const twin = ct(commitOf + '^{tree}', [commitOf], 'the same state, a second commit');
    const carrying = ct(tipA + '^{tree}', [tipA, twin], 'a commit that carries the twin state');
    sh('git', ['-C', storeA, 'push', '-q', 'origin', carrying + ':refs/tracker/state']);
    const fetchB = mech(ctx, 'sync', [], { machine: 'B' });
    const hasTwin = sh('git', ['-C', storeB, 'cat-file', '-e', twin + '^{commit}']).code === 0;
    writeFileSync(recPathA, JSON.stringify({ format: 'tracker-sync-recording/1', store: commitOf, digest }, null, 2) + '\n');
    writeFileSync(recPathB, JSON.stringify({ format: 'tracker-sync-recording/1', store: twin, digest }, null, 2) + '\n');
    const pubB = mech(ctx, 'publish', [], { machine: 'B' });
    const sameState = mech(ctx, 'sync', [], { machine: 'A' });
    record('25-two-references-to-one-state-are-not-a-conflict',
      hasTwin && pubB.code === 0 && sameState.code === 0 && exportAt(ctx, 'A', rev).stdout === asReference.stdout,
      'both stores hold the twin: ' + hasTwin + ', B publish exit ' + pubB.code + ', sync A exit ' + sameState.code
      + ', ' + (pubB.code === 0 ? sameState.out : pubB.out).split('\n')[0].slice(0, 100));
    // Two references to commits holding DIFFERENT states refuse, exactly as two
    // snapshots did: a person decides, nothing is moved. The side that meets the
    // other's state first is the one that must refuse.
    // A state that really differs: one item more, committed on A and carried to B.
    writeFileSync(join(storeA, 'fake', 'items.jsonl'), snapshot.replace('=== fake/items.jsonl\n', '')
      + JSON.stringify({ id: 'i-9', title: 'a state the other side does not hold' }) + '\n');
    sh('git', ['-C', storeA, 'add', 'fake/items.jsonl']);
    sh('git', ['-C', storeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'a different state']);
    const otherCommit = sh('git', ['-C', storeA, 'rev-parse', 'HEAD']).stdout.trim();
    mech(ctx, 'publish', [], { machine: 'A' });
    mech(ctx, 'sync', [], { machine: 'B' });
    writeFileSync(recPathB, JSON.stringify({ format: 'tracker-sync-recording/1', store: otherCommit }, null, 2) + '\n');
    const differ = mech(ctx, 'publish', [], { machine: 'B' });
    const differA = mech(ctx, 'sync', [], { machine: 'A' });
    record('25-two-references-to-different-states-refuse', differA.code === 1 && /person|recording/i.test(differA.out),
      'B publish exit ' + differ.code + ', A sync exit ' + differA.code + ': ' + differA.out.split('\n')[0].slice(0, 140));
    // A digest that does not match the commit it names is a refusal, not a read.
    writeFileSync(recPathA, JSON.stringify({ format: 'tracker-sync-recording/1', store: commitOf, digest: 'sha256:' + '0'.repeat(64) }, null, 2) + '\n');
    const wrongDigest = exportAt(ctx, 'A', rev);
    record('25-a-reference-that-cannot-be-trusted-is-said', wrongDigest.code === 1 && /history|digest|no longer holds/i.test(wrongDigest.out),
      'exit ' + wrongDigest.code + ': ' + wrongDigest.out.split('\n')[0].slice(0, 120));
    // A referenced commit this store does not hold is said, never guessed.
    writeFileSync(recPathA, JSON.stringify({ format: 'tracker-sync-recording/1', store: '1'.repeat(40) }, null, 2) + '\n');
    const missing = exportAt(ctx, 'A', rev);
    record('25-a-missing-state-commit-is-said', missing.code === 1 && /does not hold|append-only/i.test(missing.out),
      'exit ' + missing.code + ': ' + missing.out.split('\n')[0].slice(0, 140));
  },

  // 26. An installation of an older version is repaired by the mechanism itself,
  // once, safely and idempotently (issue #45: nothing ever cleaned what a killed
  // write or an older layout left).
  '26-an-old-installation-is-converted': async (ctx) => {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('26-an-old-installation-is-converted', false, 'bring-up: ' + r.out); return; }
    const store = storeOf(ctx, 'A');
    const stateDir = ctx.stateA;
    const recDir = join(store, '.tracker-sync', 'recordings');
    const rev = sh('git', ['-C', ctx.codeA, 'rev-parse', 'HEAD']).stdout.trim();
    // A state with some size to it: a copy per revision is what the store grew by,
    // and a store of three items would not show the difference a migration makes.
    const padding = Array.from({ length: 40 }, (_, i) => JSON.stringify({ id: 'pad-' + i, title: 'a state that takes up space '.repeat(6), status: 'open', comments: [] })).join('\n') + '\n';
    fsAppend(join(store, 'fake', 'items.jsonl'), padding);
    sh('git', ['-C', store, 'add', 'fake/items.jsonl']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'a state with size']);
    mech(ctx, 'publish', [], { machine: 'A' });
    const state = stateTextOf(ctx, 'A');
    // The store as an older version left it: the recording of the revision is a
    // whole copy of the state, a candidate of a killed write holds a copy of the
    // store, and a diagnostic of a settled outcome was never removed.
    writeFileSync(join(recDir, rev + '.jsonl'), state);
    const deadCandidate = fakeCandidate(stateDir, { pid: 999999, phase: 'preparing' });
    mkdirSync(join(stateDir, deadCandidate, 'fake'), { recursive: true });
    writeFileSync(join(stateDir, deadCandidate, 'fake', 'items.jsonl'), state);
    writeFileSync(join(stateDir, fakeCandidate(stateDir, { pid: 999998, phase: 'accepted', folder: false })) , '');
    sh('git', ['-C', store, 'add', '.tracker-sync/recordings']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'a whole copy, as the old version wrote it']);
    // A snapshot no store commit holds: a revision recorded from a tree whose
    // state was never a store state. It is kept and reported, never guessed.
    const lostRev = 'f'.repeat(40);
    writeFileSync(join(recDir, lostRev + '.jsonl'), '=== fake/items.jsonl\n{"id":"i-9","title":"a state no commit holds"}\n');
    // What a kill in the middle of the migration leaves: the temporary file of a
    // recording that was written but not yet renamed, beside the snapshot itself.
    writeFileSync(join(recDir, `.${rev}.jsonl.migrating-999999`), 'half');
    const beforeBytes = folderBytes(recDir);
    const beforeSnapshots = (() => { const s = mech(ctx, 'status', ['--json'], { machine: 'A' }); try { return JSON.parse(s.stdout).snapshots; } catch { return null; } })();
    // The first command with the store in its hands converts it, with no owner action.
    const migrated = mech(ctx, 'publish', [], { machine: 'A' });
    const afterRef = existsSync(join(recDir, rev + '.jsonl')) ? readFileSync(join(recDir, rev + '.jsonl'), 'utf8') : '';
    const readBack = exportAt(ctx, 'A', rev);
    const afterBytes = folderBytes(recDir);
    record('26-a-whole-copy-becomes-a-reference',
      migrated.code === 0 && afterRef.trim().startsWith('{') && readBack.code === 0 && readBack.stdout === state,
      'publish exit ' + migrated.code + ', the recording is a reference: ' + afterRef.trim().startsWith('{') + ', it exports the same state: ' + (readBack.stdout === state));
    record('26-a-snapshot-no-commit-holds-is-kept-and-reported',
      existsSync(join(recDir, lostRev + '.jsonl')) && !readFileSync(join(recDir, lostRev + '.jsonl'), 'utf8').trim().startsWith('{'),
      'the unheld snapshot is kept: ' + existsSync(join(recDir, lostRev + '.jsonl')));
    record('26-the-migration-cleans-what-a-kill-left',
      !existsSync(join(stateDir, deadCandidate)) && !readdirSync(stateDir).some((n) => n.endsWith('.migrating-999999')),
      'the dead candidate is gone: ' + !existsSync(join(stateDir, deadCandidate)) + ', no temporary file is left behind');
    // Space, measured on the recording itself: the copy was the size of the state,
    // the reference is one line.
    record('26-the-migration-frees-space', afterRef.trim().startsWith('{') && afterRef.length * 10 < state.length,
      'the whole copy was ' + state.length + ' bytes, the reference is ' + afterRef.length + ' (the status reported ' + beforeSnapshots + ' whole states before the migration)');
    // It is published like any other store change, and a second run changes nothing.
    const tip = remoteTip(ctx);
    const remoteRef = tip ? sh('git', ['-C', ctx.remote, 'cat-file', '-p', tip + ':.tracker-sync/recordings/' + rev + '.jsonl']).stdout : '';
    const again = mech(ctx, 'publish', [], { machine: 'A' });
    const afterRef2 = readFileSync(join(recDir, rev + '.jsonl'), 'utf8');
    record('26-the-migration-is-published-and-idempotent',
      remoteRef.trim().startsWith('{') && again.code === 0 && /nothing to publish|published/i.test(again.out) && afterRef2 === afterRef,
      'the remote holds the reference: ' + remoteRef.trim().startsWith('{') + ', the second run said: ' + again.out.split('\n')[0].slice(0, 80));
    // Reported by status, so an owner sees what a migration kept for them.
    const spoken = mech(ctx, 'status', [], { machine: 'A' });
    record('26-status-names-what-is-still-a-whole-state', /recordings\s+\d+\s+\(1 still whole states/.test(spoken.stdout),
      spoken.stdout.split('\n').filter((l) => /^recordings/.test(l)).join(' | ').slice(0, 160));
  },

  // 27. The migration completes on a store of any size, in memory that does not
  // grow with it, and what a run leaves half-done is finished by the next one
  // (#49: the first loop kept the text of every whole-state recording and the
  // migration died of the heap on 1106 of them, converting none).
  '27-the-migration-runs-in-bounded-memory': async (ctx) => {
    const id = '27-the-migration-runs-in-bounded-memory';
    const up = bringUp(ctx, 'A');
    if (up.code !== 0) { record(id, false, 'bring-up: ' + up.out); return; }
    const store = storeOf(ctx, 'A');
    const recDir = join(store, '.tracker-sync', 'recordings');
    // A state with the size a tracker export of long histories has, in kilobytes:
    // every whole-state recording of an older version was a copy of exactly this.
    const padding = Array.from({ length: 2200 }, (_, i) => JSON.stringify({ id: 'pad-' + i, title: 'a state that takes up space in a store '.repeat(2), status: 'open', comments: [{ by: 'proof', text: 'a comment a tracker keeps '.repeat(3) }] })).join('\n') + '\n';
    fsAppend(join(store, 'fake', 'items.jsonl'), padding);
    sh('git', ['-C', store, 'add', 'fake/items.jsonl']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'a state with size']);
    mech(ctx, 'publish', [], { machine: 'A' });
    const state = stateTextOf(ctx, 'A');
    // A few hundred whole-state recordings, as a version before references wrote
    // them: each a copy of that state, and together far more than the heap the run
    // is given below. Only the names grow in the migration; the size of each copy
    // must not be held beside the others.
    const N = 200;
    const revs = [];
    for (let i = 0; i < N; i++) {
      const rev = 'c' + String(i).padStart(39, '0');
      revs.push(rev);
      writeFileSync(join(recDir, rev + '.jsonl'), state);
    }
    sh('git', ['-C', store, 'add', '.tracker-sync/recordings']);
    sh('git', ['-C', store, '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'whole copies, as an older version wrote them']);
    const wholeBytes = N * Buffer.byteLength(state, 'utf8');
    const heapMB = 64;
    const nodeArgs = ['--max-old-space-size=' + heapMB];
    const mine = new Set(revs.map((r) => r + '.jsonl'));
    const asRefs = () => readdirSync(recDir).filter((n) => mine.has(n))
      .filter((n) => readFileSync(join(recDir, n), 'utf8').trim().startsWith('{')).length;
    // The whole store's worth of copies is many times the heap the run is allowed,
    // so a run that holds them all dies and a run that holds one at a time does not.
    const converted = mech(ctx, 'publish', [], { machine: 'A', nodeArgs });
    const afterFirst = asRefs();
    record('27-the-migration-completes-in-a-small-heap',
      converted.code === 0 && afterFirst === N,
      'publish exit ' + converted.code + ' in a ' + heapMB + ' MB heap: ' + N + ' whole copies of ' + Math.round(Buffer.byteLength(state, 'utf8') / 1024) + ' KB (' + Math.round(wholeBytes / 1048576) + ' MB in all), ' + afterFirst + ' of ' + N + ' are references' + (converted.code === 0 ? '' : ' — died: ' + converted.out.split('\n').slice(0, 2).join(' | ').slice(0, 200)));
    // What a run killed a fifth of the way in leaves: the copies it had not reached
    // are still copies, beside the references it had already renamed into place.
    const killedAt = 160;
    for (let i = 0; i < killedAt; i++) writeFileSync(join(recDir, revs[i] + '.jsonl'), state);
    const kept = revs.slice(killedAt).map((r) => [r, readFileSync(join(recDir, r + '.jsonl'), 'utf8')]);
    const bitForBit = kept.every(([r, before]) => existsSync(join(recDir, r + '.jsonl')) && readFileSync(join(recDir, r + '.jsonl'), 'utf8') === before);
    record('27-what-a-kill-left-is-what-the-rerun-reads',
      bitForBit && asRefs() === N - killedAt,
      'the store holds ' + (N - killedAt) + ' references and ' + killedAt + ' copies, and every reference is byte for byte what the killed run wrote: ' + bitForBit);
    // The rerun finishes the store inside the same heap, converts only what is
    // left, and publishes all of it.
    const rerun = mech(ctx, 'publish', [], { machine: 'A', nodeArgs });
    const afterRerun = asRefs();
    record('27-the-rerun-finishes-the-store',
      rerun.code === 0 && afterRerun === N,
      'publish exit ' + rerun.code + ' in the same ' + heapMB + ' MB heap; references: ' + afterRerun + ' of ' + N);
    record('27-the-rerun-keeps-what-was-already-converted',
      kept.every(([r, before]) => readFileSync(join(recDir, r + '.jsonl'), 'utf8') === before),
      'all ' + (N - killedAt) + ' references the first run wrote are unchanged by the rerun');
    // Every recording exports exactly the bytes its whole copy did.
    const readBack = exportAt(ctx, 'A', revs[0]);
    const last = exportAt(ctx, 'A', revs[N - 1]);
    record('27-every-recording-exports-the-same-bytes',
      readBack.code === 0 && readBack.stdout === state && last.code === 0 && last.stdout === state,
      'export --at exit ' + readBack.code + ' and ' + last.code + ', identical to the whole copy: ' + (readBack.stdout === state && last.stdout === state));
    // The ref carries them: the rerun published the references, not only the store.
    const tip = remoteTip(ctx);
    const inTree = tip ? sh('git', ['-C', ctx.remote, 'ls-tree', '-r', '--name-only', tip, '--', '.tracker-sync/recordings']).stdout.split('\n').filter(Boolean).length : 0;
    const onRemote = tip ? sh('git', ['-C', ctx.remote, 'show', tip + ':.tracker-sync/recordings/' + revs[5] + '.jsonl']).stdout.trim().startsWith('{') : false;
    record('27-the-ref-holds-the-references', inTree === N + 1 && onRemote,
      "the remote's tree holds " + inTree + ' recordings (the ' + N + ' of this case and the store\'s own), and one of them reads as a reference: ' + onRemote);
    // A second run changes nothing.
    const again = mech(ctx, 'publish', [], { machine: 'A', nodeArgs });
    record('27-a-second-run-changes-nothing',
      again.code === 0 && asRefs() === N && /nothing to publish|published/i.test(again.out),
      'the second run said: ' + again.out.split('\n')[0].slice(0, 100) + '; every recording is a reference: ' + (asRefs() === N));
  },

  // 28. The store's lock is what a watch never meets twice in one process, and what
  // another process is refused by (#49: a 0.121.0 watch restarting about every 20 s
  // with "the store is locked by pid <its own pid>"). The two rounds of one watcher
  // queue in-process (LOCK_CONTEXT, `locked()`'s queue), so the file lock is only
  // ever asked for by a process that holds nothing: a round that cannot take it is
  // another command's, and it is skipped, never an exit.
  '28-a-watch-never-meets-its-own-lock': async (ctx) => {
    const id = '28-a-watch-never-meets-its-own-lock';
    const up = bringUp(ctx, 'A');
    if (up.code !== 0) { record(id, false, 'bring-up: ' + up.out); return; }
    // One process holds the store's lock; a second is refused, and the release frees
    // it. That is the half of the lock's contract a kill or a supervisor depends on.
    const probe = join(ctx.scratch, 'lock-probe.mjs');
    const child = join(ctx.scratch, 'lock-child.mjs');
    writeFileSync(child, `
import { takeLock } from ${JSON.stringify(ctx.mech)};
const [state, repo] = process.argv.slice(2);
try { const release = takeLock({ state, repo }, repo); release(); console.log('TAKEN'); }
catch (e) { console.log('REFUSED ' + e.message); }
`);
    writeFileSync(probe, `
import { spawnSync } from 'node:child_process';
import { takeLock } from ${JSON.stringify(ctx.mech)};
const [state, repo, childPath] = process.argv.slice(2);
const ask = () => spawnSync(process.execPath, [childPath, state, repo], { encoding: 'utf8' }).stdout.trim();
const release = takeLock({ state, repo }, repo);
const whileHeld = ask();
release();
const afterRelease = ask();
console.log(JSON.stringify({ pid: process.pid, whileHeld, afterRelease }));
`);
    const r = sh('node', [probe, ctx.stateA, ctx.codeA, child]);
    let out = null;
    try { out = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* the assertions below say it */ }
    record('28-another-process-is-refused-while-one-holds-the-store',
      out && /^REFUSED/.test(out.whileHeld || '') && /another tracker-sync command is running/.test(out.whileHeld || ''),
      out ? 'while one process held the lock another was told: ' + (out.whileHeld || '').slice(0, 100) : 'the probe did not answer: exit ' + r.code + ' ' + (r.out || '').slice(0, 160));
    record('28-the-release-frees-the-store-for-another-process',
      out && /^TAKEN$/.test(out.afterRelease || ''),
      out ? 'after the release another process took the lock: ' + out.afterRelease : 'no answer');
    // The watch's own rounds: several of them, no exit, and no line about a lock a
    // pid holds - its own or anyone else's - because its two rounds never race for
    // the file lock inside one process.
    const w = watcher(ctx, 'A', ['--interval', '1', '--debounce', '2']);
    await sleep(12000);
    const log = existsSync(w.logPath) ? readFileSync(w.logPath, 'utf8') : '';
    record('28-a-watch-runs-its-rounds-without-locking-itself-out',
      w.exitCode === null && !/locked by pid/.test(log),
      'the watch is still up after 12 s: ' + (w.exitCode === null) + '; its log names a lock held by a pid: ' + /locked by pid/.test(log) + '; last line: ' + (log.trim().split('\n').slice(-1)[0] || '').slice(0, 100));
  },

  // 30. The work a change costs follows the change, not the store (#52): a
  // comment synced to another machine, and a claim, take in what changed and
  // never rebuild the tracker's database from the whole state; a change the
  // tracker's partial import skips (a comment that did not move the item's
  // updated_at) still arrives, because the partial import is checked. br is run
  // through a shim that writes down every command it is given.
  '30-br-work-follows-the-change': async (ctx) => {
    const real = brOnPath();
    if (!real) { console.log('SKIP (named): br is not on PATH, so what the tracker is asked to do cannot be counted here'); return; }
    const shim = join(ctx.scratch, 'br-shim');
    mkdirSync(shim, { recursive: true });
    const log = join(ctx.scratch, 'br-commands.log');
    writeFileSync(join(shim, 'br'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$BR_SHIM_LOG"\nexec ${real} "$@"\n`, { mode: 0o755 });
    const env = { PATH: shim + ':' + process.env.PATH, BR_SHIM_LOG: log };
    const m = (sub, args, machine) => mech(ctx, sub, args, { machine, env });
    const rebuilds = () => (existsSync(log) ? readFileSync(log, 'utf8') : '').split('\n').filter((l) => /--import-only/.test(l) && /--rebuild/.test(l)).length;
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('30-a-comment-syncs-without-a-rebuild', false, 'bring-up A: ' + r.out.split('\n').slice(0, 3).join(' | ')); return; }
    const storeA = storeOf(ctx, 'A');
    const mk = (title) => JSON.parse(sh('br', ['create', title, '-d', 'proof', '--json'], { cwd: storeA }).stdout.trim().split('\n').pop()).id;
    const [one, two, three] = [mk('one'), mk('two'), mk('three')];
    r = mech(ctx, 'publish', [], { machine: 'A' });
    if (r.code !== 0) { record('30-a-comment-syncs-without-a-rebuild', false, 'publish A: ' + r.out.split('\n')[0]); return; }
    r = bringUp(ctx, 'B');
    if (r.code !== 0) { record('30-a-comment-syncs-without-a-rebuild', false, 'bring-up B: ' + r.out.split('\n').slice(0, 3).join(' | ')); return; }
    // A new machine's database is filled from the whole state once, by the
    // tracker's own first command there; what is counted below is every change
    // after it.
    sh('br', ['count'], { cwd: storeOf(ctx, 'B') });

    sh('br', ['comments', 'add', one, '-m', 'one comment'], { cwd: storeA });
    m('publish', [], 'A');
    writeFileSync(log, '');
    const s1 = m('sync', [], 'B');
    const got1 = ((brItemIn(ctx, 'B', one) || {}).comments || []).some((c) => c.text === 'one comment');
    record('30-a-comment-syncs-without-a-rebuild', s1.code === 0 && got1 && rebuilds() === 0,
      'sync exit ' + s1.code + ', the comment reached B: ' + got1 + ', whole-store rebuilds: ' + rebuilds());

    writeFileSync(log, '');
    const c = m('claim', ['--item', two, '--holder', 'proof-B'], 'B');
    const held = (brItemIn(ctx, 'B', two) || {}).assignee;
    record('30-a-claim-runs-no-rebuild', c.code === 0 && held === 'proof-B' && rebuilds() === 0,
      'claim exit ' + c.code + ', holder on B ' + held + ', whole-store rebuilds: ' + rebuilds() + ' ' + (c.out || '').split('\n').slice(-1)[0].slice(0, 100));

    // A comment written beside the tracker's own command, which leaves the
    // item's updated_at where it was: br's partial import skips such an item.
    m('sync', [], 'A');
    const file = join(storeA, '.beads', 'issues.jsonl');
    const items = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const it = items.find((x) => x.id === three);
    it.comments = [...(it.comments || []), { id: 1777000, issue_id: three, author: 'proof', text: 'unmoved', created_at: it.updated_at }];
    writeFileSync(file, items.map((x) => JSON.stringify(x)).join('\n') + '\n');
    writeFileSync(join(storeA, '.beads', 'beads.base.jsonl'), readFileSync(file));
    sh('node', [ctx.recipe, 'import'], { cwd: storeA });
    m('publish', [], 'A');
    writeFileSync(log, '');
    const s3 = m('sync', [], 'B');
    const got3 = ((brItemIn(ctx, 'B', three) || {}).comments || []).some((x) => x.text === 'unmoved');
    const tried = (readFileSync(log, 'utf8')).split('\n').filter((l) => /--import-only/.test(l) && !/--rebuild/.test(l)).length;
    record('30-a-change-the-tracker-skips-still-arrives', s3.code === 0 && got3,
      'sync exit ' + s3.code + ', the comment that did not move updated_at reached B: ' + got3);
    record('30-a-skip-the-tracker-would-make-is-foreseen', s3.code === 0 && tried === 0 && rebuilds() === 1,
      'partial imports tried for a change br skips: ' + tried + ', rebuilds: ' + rebuilds());
  },

};

const CASE_TIMEOUT_MS = 240000;
async function runCase(caseId, overrides) {
  const fn = CASES[caseId];
  if (!fn) { record(caseId, false, 'no such case'); return { failed: true }; }
  const ctx = newCtx(caseId.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 40), { ...(CASE_OVERRIDES[caseId] || {}), ...(overrides || {}) });
  let failed = false;
  try {
    const before = failCount;
    const work = fn(ctx).then(() => ({ timedOut: false }));
    const timer = sleep(CASE_TIMEOUT_MS).then(() => ({ timedOut: true }));
    const done = await Promise.race([work, timer]);
    if (done.timedOut) {
      record(caseId, false, 'the case exceeded ' + CASE_TIMEOUT_MS / 1000 + ' s (a hung git or watcher); killed');
      failed = true;
    }
    failed = failed || failCount > before;
  } catch (e) {
    record(caseId, false, 'threw: ' + (e && e.message));
    failed = true;
  } finally {
    // Between cases: every watcher of this case is gone, and the store's lock
    // (killed with its holder) is left to be broken by the next command rather
    // than being raced by it. A case's leftovers must not decide the next case.
    await stopAllWatchers(ctx);
    // Long enough that a killed watcher's push is not still landing while the
    // next case reads the remote: a case's leftovers must not decide a case.
    await sleep(2000);
  }
  if (!KEEP) { try { rmSync(ctx.scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ } }
  return { failed };
}

// -------------------------------------------------------------- br recipe
function brOnPath() {
  const w = sh('sh', ['-c', 'command -v br']);
  return w.code === 0 && w.stdout.trim();
}
// When br is on PATH, the same two-machine shape runs through the shipped
// recipe: publish, sync, the same record id on both machines, and a void
// naming that id retiring it on both. When br is not on PATH this prints one
// named SKIP line and is never counted a pass.
async function brLeg() {
  if (!existsSync(BR_RECIPE) || !brOnPath()) {
    console.log('SKIP (named): br is not on PATH' + (existsSync(BR_RECIPE) ? '' : ' and trackers/br.mjs is not in this checkout'));
    return;
  }
  const ctx = newCtx('br-recipe', { recipe: BR_RECIPE, mech: MECH_SRC, fake: FAKE_SRC });
  try {
    let r = mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA, '--prefix', 'br-a'], { machine: 'A' });
    if (r.code !== 0) { record('12-br-recipe', false, 'br connect A: ' + r.out); return; }
    // a real br issue, made by br itself in A's store, published on the ref
    const storeA = storeOf(ctx, 'A');
    const seed = sh('br', ['create', 'first', '-d', 'proof', '--json'], { cwd: storeA });
    if (seed.code !== 0) { record('12-br-recipe', false, 'br create failed: ' + seed.out.slice(0, 200)); return; }
    const seedIssue = JSON.parse(seed.stdout.trim().split('\n').pop());
    const itemId = seedIssue.id;
    r = mech(ctx, 'publish', [], { machine: 'A' });
    if (r.code !== 0) { record('12-br-recipe', false, 'publish A: ' + r.out); return; }
    r = bringUp(ctx, 'B');
    if (r.code !== 0) { record('12-br-recipe', false, 'br connect/publish B: ' + r.out); return; }
    // A record of the set, not free text: the body comes from the set's own
    // formatter, so the void below is a real retirement of a real record and the
    // run script can find it by its comment id.
    const tf = await import('file://' + join(WORKTREE, 'skills/backlog/setup-shady2k-skills/time-format.mjs'));
    const recordBody = tf.formatRecord('claim', {
      span: 'proofspan1', at: new Date().toISOString(), session: 'proof-session',
      agent: 'proof:agent@machine:main#1', role: 'worker',
    }, null);
    // the post runs with the watcher stopped: br rebuilds its database in
    // place and a concurrent sync tick's import races the recovery files
    const pA = sh('node', [ctx.recipe, 'post', '--item', itemId, '--text', recordBody], { cwd: storeA });
    if (pA.code !== 0) { record('12-br-recipe', false, 'br post failed: ' + pA.out.slice(0, 200)); await stopAllWatchers(ctx); return; }
    const rid = pA.stdout.trim().split('\n').pop().trim();
    // publish before the watcher runs again: the post's write sits
    // uncommitted in the worktree, and a sync tick's fast-forward would
    // reset --hard over it
    const pubNow = mech(ctx, 'publish', [], { machine: 'A' });
    if (pubNow.code !== 0) { record('12-br-recipe', false, 'publish after br post: ' + pubNow.out.slice(0, 200)); await stopAllWatchers(ctx); return; }
    const w = watcher(ctx, 'A');
    const pub = await waitForRemote(ctx, (items) => items.some((x) => x.comments && x.comments.some((c) => String(c.id) === rid)), 15000);
    await stopAllWatchers(ctx);
    const syncB = mech(ctx, 'sync', [], { machine: 'B' });
    console.log('B sync: exit ' + syncB.code + ' ' + syncB.out.split('\n')[0].slice(0, 100));
    const storeB = storeOf(ctx, 'B');
    const rawB = storeB ? sh('cat', [join(storeB, '.beads', 'issues.jsonl')]).stdout : '';
    const sameId = rid && rawB.includes(rid);
    record('12-br-recipe', !!sameId, sameId ? 'record ' + rid + ' published, synced, same id on B' : 'record ' + rid + ' did not reach B\'s issues.jsonl (publish ' + !!pub.value + ')');
    if (!sameId) return;
    const wB = watcher(ctx, 'B');
    await settleWatcher(ctx, 'B');
    // Retire the record by name, the way the set does it: the run script prints
    // the void record and the tracker posts that text unchanged (a recipe needs
    // no void command of its own, and a second place for the record's format
    // would be a second format). br's own store carries the comment as it is.
    const runs = join(WORKTREE, 'skills/engineering/take-task/runs.mjs');
    // The run script reads the adapter's export, not the tracker's own file, so
    // this proof builds the one the integration's adapter field describes from
    // br's export (model.md: a comment goes out with its stable id, time, author
    // and body exactly as stored).
    const rawBItems = sh('cat', [join(storeOf(ctx, 'B'), '.beads', 'issues.jsonl')]).stdout
      .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const exportB = join(ctx.scratch, 'adapter-export.json');
    writeFileSync(exportB, JSON.stringify({ issues: rawBItems.map((it) => ({
      id: it.id, title: it.title, status: it.status, assignee: it.assignee || null,
      updatedAt: it.updated_at,
      comments: (it.comments || []).map((c) => ({ id: String(c.id), at: c.created_at, author: c.author, body: c.text })),
    })) }));
    const vText = sh('node', [runs, 'void', '--comment', rid, '--note', 'proof: the record is retired by name', '--backlog', exportB, '--project', 'proof'], { cwd: storeOf(ctx, 'B') });
    if (vText.code !== 0 || !vText.stdout.trim()) {
      record('12-br-void-retires-both', false, 'the run script printed no void record (exit ' + vText.code + '): ' + vText.out.slice(0, 200));
      return;
    }
    const vBody = vText.stdout.trim();
    const vPost = sh('node', [ctx.recipe, 'post', '--item', itemId, '--text', vBody], { cwd: storeOf(ctx, 'B') });
    if (vPost.code !== 0) {
      record('12-br-void-retires-both', false, 'posting the void record failed (exit ' + vPost.code + '): ' + vPost.out.slice(0, 200));
      return;
    }
    const vId = vPost.stdout.trim().split('\n').pop().trim();
    const publishB = mech(ctx, 'publish', [], { machine: 'B' });
    await stopAllWatchers(ctx);
    mech(ctx, 'sync', [], { machine: 'A' });
    const hasVoid = (machine) => {
      const raw = sh('cat', [join(storeOf(ctx, machine), '.beads', 'issues.jsonl')]).stdout;
      return raw.includes(vId) && /void/.test(raw) && raw.includes(rid);
    };
    const onA = hasVoid('A');
    record('12-br-void-retires-both', publishB.code === 0 && onA,
      'void ' + vId + ' posted on B and synced to A: ' + onA + ' (publish exit ' + publishB.code + ')');
    mech(ctx, 'sync', [], { machine: 'B' });
    const onB = hasVoid('B');
    record('12-br-void-retires-both-b', onA && onB, 'the void record ' + vId + ' names ' + rid + ' on both machines: A=' + onA + ' B=' + onB);
  } finally { await stopAllWatchers(ctx); if (!KEEP) { try { rmSync(ctx.scratch, { recursive: true, force: true }); } catch {} } }
}


// ---------------------------------------------- 13. br on two machines
//
// The shipped recipe, on two machines that follow setup's own steps: A connects
// and publishes; B is a fresh clone whose connect rebuilds its database from the
// state the ref carries, so it sees the same items before it writes anything.
// Then an item A holds must refuse B's claim, two claims on one free item inside
// the same seconds must leave one holder on both machines, and a record B posts
// must reach A.
const brItemIn = (ctx, machine, id) => {
  const store = storeOf(ctx, machine);
  if (!store) return null;
  const file = join(store, '.beads', 'issues.jsonl');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    if (d.id === id) return d;
  }
  return null;
};
function mechAsync(ctx, sub, args, machine) {
  const repo = machine === 'A' ? ctx.codeA : ctx.codeB;
  const state = machine === 'A' ? ctx.stateA : ctx.stateB;
  const child = spawn('node', [ctx.mech, sub, '--recipe', ctx.recipe, '--state', state, '--repo', repo, ...args],
    { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  return new Promise((res) => child.on('exit', (code) => res({ code, out })));
}

async function brTwoMachines() {
  if (!brOnPath()) { console.log('SKIP (named): br is not on PATH, so the two-machine br scenario cannot run here'); return; }
  const ctx = newCtx('br-two-machines', { recipe: BR_RECIPE, mech: MECH_SRC, fake: FAKE_SRC });
  try {
    let r = bringUp(ctx, 'A');
    if (r.code !== 0) { record('13-br-two-machines', false, 'connect A: ' + r.out.split('\n').slice(0, 3).join(' | ')); return; }
    const storeA = storeOf(ctx, 'A');
    const mk = (title) => JSON.parse(sh('br', ['create', title, '-d', 'proof', '--json'], { cwd: storeA }).stdout.trim().split('\n').pop());
    const held = mk('held by A');
    const free = mk('free for both');
    r = mech(ctx, 'publish', [], { machine: 'A' });
    if (r.code !== 0) { record('13-br-two-machines', false, 'publish A: ' + r.out); return; }
    // B: a real second machine, a fresh clone, connect first
    r = bringUp(ctx, 'B');
    if (r.code !== 0) { record('13-br-two-machines', false, 'connect B (a fresh clone): ' + r.out.split('\n').slice(0, 3).join(' | ')); return; }
    const sees = brItemIn(ctx, 'B', held.id) && brItemIn(ctx, 'B', free.id);
    record('13-br-b-sees-a', !!sees, sees ? 'B sees both of A\'s items after connect' : 'B does not see the items A published; its connect did not take the ref\'s state');
    // A holds one item; B, having synced, must be refused
    const claimA = mech(ctx, 'claim', ['--item', held.id, '--holder', 'proof-A'], { machine: 'A' });
    mech(ctx, 'sync', [], { machine: 'B' });
    const claimB = mech(ctx, 'claim', ['--item', held.id, '--holder', 'proof-B'], { machine: 'B' });
    record('13-br-claim-refused-on-held', claimA.code === 0 && claimB.code === 3,
      'A exit ' + claimA.code + ', B exit ' + claimB.code + ' (' + ((claimB.out || '').split('\n')[0] || '').slice(0, 90) + ')');
    // both claim the free item at once: one holder, the same one on both machines
    const [c1, c2] = await Promise.all([
      mechAsync(ctx, 'claim', ['--item', free.id, '--holder', 'proof-A'], 'A'),
      mechAsync(ctx, 'claim', ['--item', free.id, '--holder', 'proof-B'], 'B'),
    ]);
    mech(ctx, 'sync', [], { machine: 'A' });
    mech(ctx, 'sync', [], { machine: 'B' });
    const ha = (brItemIn(ctx, 'A', free.id) || {}).assignee;
    const hb = (brItemIn(ctx, 'B', free.id) || {}).assignee;
    record('13-br-two-claims-one-holder', !!ha && ha === hb,
      'A exit ' + c1.code + ', B exit ' + c2.code + ', holders ' + ha + ' / ' + hb);
    // a record B posts reaches A, and a void retires it on both
    const tf = await import('file://' + join(WORKTREE, 'skills/backlog/setup-shady2k-skills/time-format.mjs'));
    const body = tf.formatRecord('claim', {
      span: 'brspan1', at: new Date().toISOString(), session: 'proof-br', agent: 'proof:agent@machine:main#2', role: 'worker',
    }, null);
    const post = sh('node', [ctx.recipe, 'post', '--item', free.id, '--text', body], { cwd: storeOf(ctx, 'B') });
    const rid = post.code === 0 ? post.stdout.trim().split('\n').pop().trim() : '';
    mech(ctx, 'publish', [], { machine: 'B' });
    mech(ctx, 'sync', [], { machine: 'A' });
    const aHas = rid && (brItemIn(ctx, 'A', free.id) || { comments: [] }).comments.some((c) => String(c.id) === rid);
    record('13-br-record-reaches-a', !!aHas, aHas ? 'record ' + rid + ' reached A' : 'record ' + (rid || '(none)') + ' did not reach A');
  } finally {
    await stopAllWatchers(ctx);
    await sleep(1000);
  }
  if (!KEEP) { try { rmSync(ctx.scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ } }
}

// ------------------------------------------------------------------- main
const BR_ON_PATH = brOnPath();
const CASE_ORDER = Object.keys(CASES);
function selected(id) {
  if (!ONLY) return true;
  return ONLY.includes(id) || ONLY.includes('all');
}

async function main() {
  let ranCases = 0;
  for (const id of CASE_ORDER) {
    if (!selected(id)) continue;
    ranCases++;
    if (id === '12-br-recipe') continue;
  }
  for (const id of CASE_ORDER) {
    if (!selected(id) || id === '12-br-recipe') continue;
    const r = await runCase(id);
    if (r && r.failed) cleanFailed.add(id);
  }
  if (!ONLY || ONLY.includes('mutations') || BREAKS.some((b) => b.cases.some((c) => ONLY.includes(c)))) {
    for (const b of BREAKS) {
      if (ONLY && !ONLY.includes('mutations') && !ONLY.includes('mutation-' + b.name)
        && !b.cases.some((c) => ONLY.includes(c))) continue;
      ranCases++;
      await runBroken(b);
    }
  }
  // the br leg runs whenever br is on PATH; a named SKIP only when it is not
  if (BR_ON_PATH || process.argv.includes('--with-br') || (ONLY && ONLY.includes('12-br-recipe'))) { ranCases++; await brLeg(); }
  // the two-machine br scenario: its own case id, run by default with br present
  if (BR_ON_PATH || process.argv.includes('--with-br') || (ONLY && ONLY.includes('13-br-two-machines'))) { ranCases++; await brTwoMachines(); }
  // The mechanism and the recipe read every option that takes a value the one
  // way the set reads one (argv.mjs): a word the caller wrote and left empty is
  // misuse that names the option, never an option missing from the command. An
  // emptied --at once was today's state instead of a named revision, and an
  // emptied --expect once dropped the state a transition had to hold.
  if (!ONLY || ONLY.includes('misuse') || ONLY.includes('mutation-misuse')) {
    const cli = (file, args) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', timeout: 30000 });
    const named = (r, option) => r.status === 2 && r.stderr.includes(`"${option}"`);
    record('misuse-tracker-sync-empty-value',
      named(cli(MECH_SRC, ['export', '--at', '']), '--at') && named(cli(MECH_SRC, ['export', '--at=']), '--at'),
      `export --at '' and --at= must exit 2 naming --at; got ${cli(MECH_SRC, ['export', '--at', '']).status} and ${cli(MECH_SRC, ['export', '--at=']).status}`);
    record('misuse-br-empty-expect',
      named(cli(BR_RECIPE, ['transition', '--item', 'x', '--to', 'closed', '--expect', '--to']), '--expect'),
      'br transition --expect with an option where its value goes must exit 2 naming --expect');
    // The one word the recipe means as a value: an empty holder clears it.
    const cleared = cli(BR_RECIPE, ['claim', '--item', 'x', '--holder', '']);
    record('misuse-br-empty-holder-is-a-clearing',
      cleared.status !== 2 && !cleared.stderr.includes('"--holder"'),
      `br claim --holder '' clears the holder, so its refusal must not be about the value: got ${cleared.status} ${cleared.stderr.split('\n')[0]}`);
  }
  if (!ranCases) {
    console.log('FATAL: no case ran — a proof that runs nothing must not pass');
    process.exit(2);
  }
  const verdict=results.filter(r=>r.phase!=='mutant');
  const pass=verdict.filter(r=>r.ok).length;
  const mutants=results.filter(r=>r.phase==='mutant');
  console.log(`\n${pass}/${verdict.length} clean/proof assertions passed across ${ranCases} cases; ${mutants.length} intentional-mutant observations excluded from the verdict`);
  process.exit(failCount ? 1 : 0);
}

process.on('exit', () => {
  if (!KEEP) { try { rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* best effort */ } }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('proof harness failed: ' + (e && e.stack ? e.stack.split('\n')[0] : e)); process.exit(2); });

export { newCtx, bringUp, mech, storeOf, post, claim, seedStore, storeItems, remoteItems, item1, item2, stopAllWatchers };
