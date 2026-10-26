#!/usr/bin/env node
/**
 * The tracker-neutral sync mechanism: one store per machine, kept in step on a
 * ref no branch contains. This file names no tracker; a recipe does.
 *
 * The store is a linked worktree of the project's own repository, detached at
 * the ref (default refs/tracker/state), parked at the machine's state directory
 * outside every checkout. Inside it:
 *
 *   <the recipe's stateFiles>                  the tracker's committed state
 *   .tracker-sync/recordings/<revision>.jsonl  the state at a code revision,
 *                                              written once and never moved
 *
 * The tracker's database is machine-local, rebuilt from the state files, and is
 * never committed, so two machines never collide on the ref over a database.
 * Everything of the mechanism that is not state (the lock, an empty hooks
 * directory, the watch pid file, the resolved configuration) lives beside the
 * worktree, at <machine dir>, never inside a checkout.
 *
 * A field changed on two sides takes the tracker's own order for that field;
 * where that cannot separate two values, the position of the commit that
 * published the value on the remote's first-parent chain decides, oldest first,
 * and a value not yet on the remote ranks as the tip being published now. A
 * machine's clock is never consulted.
 *
 * The machine's state folder is named after the MAIN checkout - the parent of
 * `git rev-parse --git-common-dir` - so every linked worktree of this machine
 * reaches the one store, not a store of its own.
 *
 * The record hooks this installs are composed onto the checkout's hooks, never
 * written into a folder inside the repository: with `core.hooksPath` pointing
 * into the tree, the line would carry this machine's absolute paths into every
 * machine's checkout, so connect refuses and prints the line to add by hand.
 * The hooks it installs are post-commit, post-merge and post-checkout; the
 * post-checkout one relinks a checkout whose pointer a pre-move branch replaced
 * with a real folder.
 *
 * Exit statuses, each with a message naming what is missing or who must fix it:
 *   0  ok
 *   1  a refusal the caller can fix: usage, no recipe, a pointer absent, a
 *      checkout that is not a repository, a hooks folder inside the repository, a
 *      failed recipe command, a malformed export, two different recordings of one
 *      revision. A recording that already exists is not one of these: it is the
 *      state the step exists to reach, and the command says so and exits 0.
 *   2  the runtime is missing: git, or a command the recipe needs
 *   3  a claim or a transition was lost: said out loud, nothing left behind
 *   4  the remote is unreachable and another machine's state was needed; the
 *      store here is this machine's only, and the command says so
 *   5  the remote refused this ref: a hosting policy, never counted with 4
 *
 * BOUNDED LATENCY, and what it costs: publish waits for the debounce of quiet or
 * the maximum batch age, whichever comes first, so a stream of writes is still
 * published within the maximum age. Every network git operation is killed after
 * its timeout (10 s for a push, 20 s for a fetch) and reported as unreachable or
 * refused rather than hanging. Network operations run outside the store mutation
 * lock. A conditional operation snapshots and imports under the local lock, then
 * pushes its isolated candidate; unrelated live writes survive timeout or retry.
 *
 * WHY A REF OUTSIDE THE BRANCHES STARTS NO CODE CI, and how far that goes: a
 * push event's ref is a branch or a tag. GitHub documents github.ref as "the
 * fully-formed ref of the branch or tag that triggered the workflow run. For
 * workflows triggered by push, this is the branch or tag ref that was pushed"
 * and github.ref_type as "valid values are branch or tag"
 * (https://docs.github.com/en/actions/reference/workflows-and-actions/contexts),
 * and the push event as "Runs your workflow when you push a commit or tag"
 * (https://docs.github.com/en/actions/reference/events-that-trigger-workflows).
 * That is the documented behaviour, and it is an inference about a provider, not
 * a proof: the proof is the project's own run list after the first push, read by
 * the owner. A host that refuses a ref outside refs/heads/ and refs/tags/ is
 * unsupported for this layout, and this mechanism says so by name (exit 5).
 *
 * No git command here sees the project's hooks, and the project's hooks never
 * see a tracker commit: every git call runs with core.hooksPath set to an empty
 * directory. The record hooks installed in code checkouts are composed onto
 * whatever hook is already there, and they only record a revision that is cut
 * or landed (post-commit, post-merge) — never a checkout.
 */
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync, readdirSync, openSync, closeSync, unlinkSync, readSync, renameSync, rmdirSync, realpathSync, cpSync, lstatSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(new URL(import.meta.url).pathname);
const DEFAULT_REF = 'refs/tracker/state';
const FETCH_REF = 'refs/tracker-sync/remote';
const VERSION = readVersion();

function readVersion() {
  try { return readFileSync(join(HERE, 'tracker-sync.version'), 'utf8').trim(); } catch { return 'unknown'; }
}
let THROW_ERRORS = false;
const die = (code, msg) => { if (THROW_ERRORS) throw Object.assign(new Error(msg), {exitCode:code}); process.stderr.write(`tracker-sync: ${msg}\n`); process.exit(code); };
const say = (msg) => process.stdout.write(`${msg}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

/** Parse --flag value, --flag=value and positional arguments. */
function parseArgs(argv) {
  const flags = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.match(/^--([A-Za-z][A-Za-z-]*)=(.*)$/);
    if (eq) { flags[eq[1]] = eq[2]; continue; }
    const bare = a.match(/^--([A-Za-z][A-Za-z-]*)$/);
    if (bare) {
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[bare[1]] = argv[++i];
      else flags[bare[1]] = true;
      continue;
    }
    pos.push(a);
  }
  return { flags, pos };
}
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// The variables git exports to a hook it runs. Under `post-commit` and
// `post-merge` this mechanism IS such a hook, and git sets GIT_DIR,
// GIT_INDEX_FILE, GIT_WORK_TREE and the rest to the code checkout's repository:
// a `git -C <store> ...` then reads and writes the CODE repository instead of
// the store worktree, and the first recording after a commit failed for exactly
// that reason. Nothing here needs them - every command names its own checkout
// and its own cwd - so every child runs without them. The tracker's own command
// is a child too, and it inherits the cleaned environment.
const HOOK_ENV = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_PREFIX', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_QUARANTINE_PATH', 'GIT_NAMESPACE', 'GIT_INDEX_VERSION'];
function childEnv(env) {
  const e = { ...process.env, ...(env || {}) };
  for (const k of HOOK_ENV) delete e[k];
  for (const k of Object.keys(e)) if (e[k] === null) delete e[k];
  return e;
}

/** Run a program, bounded in time. Never throws: the caller reads the status. */
function run(cmd, args, { cwd, env, timeoutMs = 20000, input } = {}) {
  return new Promise((res) => {
    const child = execFile(cmd, args, { cwd, env: childEnv(env), timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        const timedOut = !!err && (err.killed || err.signal) && !err.code;
        res({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: stdout || '', stderr: stderr || '', timedOut, missing: !!err && err.code === 'ENOENT' });
      });
    if (input !== undefined && child.stdin) { child.stdin.end(input); }
  });
}
const sh = (command, opts) => run('/bin/sh', ['-c', command], opts);
const text = (r) => `${r.stdout}${r.stderr}`.trim();

// ---- the machine's own directory, the lock, the pid file --------------------

function machineDir(flags, repoRoot) {
  if (flags.state) return resolve(String(flags.state));
  const base = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  // ONE STORE PER MACHINE, and every checkout and worktree of the machine
  // reaches it: the name is the MAIN checkout's, never the checkout the command
  // was run in. `git rev-parse --show-toplevel` differs per linked worktree, so
  // keying on it gave one machine a store per worktree; the parent of the common
  // git directory is the main checkout of every worktree of this repository, and
  // it is the same string from all of them. The value is resolved once, before
  // anything runs (main()), because resolving it needs git and every git call
  // here passes through machineDir for the empty hooks path.
  return base && CURRENT.machineKey ? join(base, CURRENT.machineKey) : join(base, basename(repoRoot));
}
const storePathOf = (flags, repoRoot) => join(machineDir(flags, repoRoot), 'tracker');
// macOS /tmp and symlinked checkouts must name the same physical directory.
// Hooks may not exist yet, so resolve their closest existing ancestor.
function canonicalPath(path) {
  try {return realpathSync(path);} catch (e) {
    const parent=dirname(path);if(parent===path) throw e;
    return join(canonicalPath(parent),basename(path));
  }
}

const configPath = (flags, repoRoot) => join(machineDir(flags, repoRoot), 'config.json');
const lockPath = (flags, repoRoot) => join(machineDir(flags, repoRoot), 'lock');
const pidPath = (flags, repoRoot) => join(machineDir(flags, repoRoot), 'watch.pid');
const noHooksPath = (flags, repoRoot) => join(machineDir(flags, repoRoot), 'nohooks');

const readConfig = (flags, repoRoot) => {
  try { return JSON.parse(readFileSync(configPath(flags, repoRoot), 'utf8')); } catch { return {}; }
};
const writeConfig = (flags, repoRoot, patch) => {
  const merged = { ...readConfig(flags, repoRoot), ...patch };
  mkdirSync(machineDir(flags, repoRoot), { recursive: true });
  writeFileSync(configPath(flags, repoRoot), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
};

// A command that dies inside a locked section still leaves the store usable: the
// lock names its process, and a lock whose process is gone is broken at once.
let LOCK_HELD = null;
process.on('exit', () => { LOCK_HELD?.release(); });

/** Publish a fully written, nonempty owner directory atomically. A reaper
 * removes only the dead owner's unique file; only its successful remover may
 * remove the now-empty directory. A successor is nonempty, so rmdir cannot
 * remove it. A live process is never evicted on timestamp alone.
 *
 * A contender that meets a lock on its way out tries again rather than failing:
 * the name may already be gone when it looks, and a holder is briefly between
 * unlinking its token and removing the directory. What still fails closed is an
 * owner nobody can verify: a malformed owner file, or several entries that stay.
 * The token carries no mtime anyone reads, so nothing refreshes one. */
export function takeLock(flags, repoRoot) {
  const p = lockPath(flags, repoRoot);
  mkdirSync(dirname(p), { recursive: true });
  const token = `owner-${process.pid}-${randomUUID()}.json`;
  const candidate = `${p}.${token}`;
  mkdirSync(candidate);
  writeFileSync(join(candidate, token), `${JSON.stringify({ pid: process.pid, at: nowIso(), token })}\n`, { flag: 'wx' });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        renameSync(candidate, p);
        const lease = { release: null };
        let released = false;
        lease.release = () => {
          if (released) return;
          released = true;
          // Never unlink/rmdir a successor's name, even after an external
          // recovery or a repeated exit/release callback.
          try {
            unlinkSync(join(p, token));
            try {
              rmdirSync(p);
            } catch {}
          } catch {}
          if (LOCK_HELD === lease) LOCK_HELD = null;
        };
        LOCK_HELD = lease;
        return lease.release;
      } catch (e) {
        if (!['EEXIST', 'ENOTEMPTY', 'ENOTDIR'].includes(e.code)) throw e;
        // The holder may have released between the failed rename and this stat.
        let directory;
        try {
          directory = statSync(p).isDirectory();
        } catch (err) {
          if (err.code === 'ENOENT') continue;
          throw err;
        }
        let held, ownerFile;
        try {
          const names = directory ? readdirSync(p) : [];
          // A holder is between unlinking its token and removing the directory.
          if (directory && names.length === 0) continue;
          if (directory && names.length !== 1) throw new Error('unknown owner');
          ownerFile = directory ? join(p, names[0]) : p;
          held = JSON.parse(readFileSync(ownerFile, 'utf8'));
          if (!Number.isInteger(held.pid) || held.pid <= 0 || (directory && basename(ownerFile) !== held.token)) throw new Error('invalid owner');
        } catch { throw new Error(`the store lock ${p} has no verifiable owner; nothing was written; inspect it before manual recovery`); }
        let alive = true;
        try {
          process.kill(held.pid, 0);
        } catch (err) {
          alive = err.code !== 'ESRCH';
        }
        if (alive) throw new Error(`the store is locked by pid ${held.pid} since ${held.at} (${p}); another tracker-sync command is running`);
        say(`tracker-sync: breaking a lock whose process is gone (${p}, pid ${held.pid})`);
        // Unlink of an obsolete unique token fails rather than removing a new
        // holder. Only a successful remover attempts rmdir (which also refuses
        // a nonempty successor). Legacy file locks cannot replace a directory.
        try {
          unlinkSync(ownerFile);
          if (directory) {
            try {
              rmdirSync(p);
            } catch {}
          }
        } catch {}
      }
    }
    throw new Error(`could not take the store lock ${p}`);
  } finally {
    rmSync(candidate, { recursive: true, force: true });
  }
}

// ---- git, always without the project's hooks --------------------------------

function git(args, { cwd, timeoutMs } = {}) {
  const flags = CURRENT.flags; const repoRoot = CURRENT.repoRoot;
  // The mechanism commits to the store with its OWN identity, always: a CI runner,
  // a container, a supervisor running as another user and a fresh machine have no
  // user.name and user.email, and a store commit that depended on them would fail
  // everywhere the mechanism is meant to run unattended. The machine's own name
  // is in its config, so two machines' commits are told apart in the ref's log.
  return run('git', [
    '-c', `core.hooksPath=${noHooksPath(flags, repoRoot)}`,
    '-c', 'user.name=tracker-sync',
    '-c', `user.email=tracker-sync@${ourMachine() || 'machine'}`,
    ...args,
  ], { cwd, timeoutMs });
}
const gitOk = async (args, opts) => {
  const r = await git(args, opts);
  if (r.code !== 0) die(1, `git ${args.join(' ')} failed: ${text(r) || 'no output'}`);
  return r.stdout.trim();
};

const CURRENT = { flags: {}, repoRoot: null, recipe: null, store: null, ref: DEFAULT_REF, checkouts: [], machineKey: null };

/** The name of the machine's state folder: the main checkout of this repository.
 *
 * The parent of the common git directory answers for every worktree, linked ones
 * included, and for a checkout inside the main worktree alike; a repository git
 * cannot answer about falls back to this checkout's own name, which at least
 * keeps the command working.
 */
async function machineKeyOf(checkout) {
  const r = await run('git', ['-C', checkout, 'rev-parse', '--git-common-dir'], {});
  if (r.code !== 0 || !r.stdout.trim()) return basename(checkout);
  const common = resolve(checkout, r.stdout.trim());
  const main = dirname(common);
  return basename(main) || basename(checkout);
}

async function repoRootOf(checkout) {
  const r = await run('git', ['-C', checkout, 'rev-parse', '--show-toplevel'], {});
  if (r.missing) die(2, 'git is not on PATH');
  if (r.code !== 0) die(1, `${checkout} is not a git repository: ${text(r)}`);
  return r.stdout.trim();
}

// ---- the recipe: the port to one tracker ------------------------------------

const placeholders = (cmd, map) => cmd.replace(/<([A-Za-z][A-Za-z-]*)>/g, (m, k) => (k in map ? map[k] : m));
const quote = (s) => `'${String(s).split("'").join(`'\\''`)}'`;

async function loadRecipes() {
  const dir = join(HERE, 'trackers');
  let names = [];
  try { names = readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort(); } catch {}
  const out = [];
  for (const n of names) {
    const p = join(dir, n);
    try { out.push({ path: p, ...((await import(pathToFileURL(p).href)).default || {}) }); }
    catch (e) { out.push({ path: p, name: n.replace(/\.mjs$/, ''), broken: e.message }); }
  }
  return out;
}

async function resolveRecipe() {
  const { flags, repoRoot } = CURRENT;
  const named = flags.recipe || process.env.TRACKER_RECIPE || readConfig(flags, repoRoot).recipe;
  if (named) {
    const p = resolve(String(named));
    if (!existsSync(p)) die(1, `the recipe ${p} does not exist`);
    try {
      const mod = (await import(pathToFileURL(p).href)).default;
      if (!mod || !mod.stateFiles) die(1, `the recipe ${p} declares no stateFiles`);
      return { path: p, ...mod };
    } catch (e) { die(1, `the recipe ${p} could not be loaded: ${e.message}`); }
  }
  const all = await loadRecipes();
  const usable = all.filter((r) => !r.broken);
  die(1, `no recipe: name the one this project's tracker needs with --recipe <file> or TRACKER_RECIPE. `
    + `This copy ships ${all.length ? all.map((r) => `${r.path}${r.broken ? ' (broken)' : ` (declares tracker ${r.tracker || r.name})`}`).join(', ') : 'none'}`);
}

/** Run one of the recipe's declared commands in the store. */
// Bounded on purpose: a tracker command that hangs (its own store lock, a slow
// disk) must not hold the store's lock with it, or the next session's claim
// would wait on it. 20 s is longer than any export this mechanism runs.
async function recipe(decl, map, { cwd, timeoutMs = 20000 } = {}) {
  const r = CURRENT.recipe;
  const raw = decl.split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), r);
  if (!raw) die(1, `the recipe ${r.path} declares no ${decl}`);
  const cmd = placeholders(typeof raw === 'string' ? raw : raw.command || '', {
    recipeFile: quote(r.path), mechanismFile: quote(join(HERE, 'tracker-sync.mjs')),
    store: quote(CURRENT.store), ref: CURRENT.ref, ...map,
  });
  if(CURRENT.isolatedFrom && cmd.includes(CURRENT.isolatedFrom)) throw new Error('cannot isolate conditional recipe: command names live store');
  const res = await sh(cmd, { cwd: cwd || CURRENT.store, timeoutMs, env: CURRENT.recipeEnv });
  return res;
}
async function recipeOk(decl, map, opts) {
  const r = await recipe(decl, map, opts);
  if (r.code !== 0) die(r.code === 127 || r.missing ? 2 : 1,
    `the recipe's ${decl} command failed (${r.code}): ${text(r) || 'no output'}`);
  return r.stdout;
}

// ---- the store: a worktree detached at the ref ------------------------------

const headOid = async () => (await gitOk(['rev-parse', 'HEAD'], { cwd: CURRENT.store }));

async function ensureStore({ create = false } = {}) {
  const { flags, repoRoot } = CURRENT;
  const store = storePathOf(flags, repoRoot);
  if (!create && !existsSync(store)) {
    CURRENT.store = store;
    return { store, absent: true };
  }
  mkdirSync(machineDir(flags, repoRoot), { recursive: true });
  mkdirSync(noHooksPath(flags, repoRoot), { recursive: true });
  let fresh = false;
  if (!existsSync(store)) {
    fresh = true;
    let have = (await git(['rev-parse', '--verify', '--quiet', CURRENT.ref], { cwd: repoRoot })).code === 0;
    if (!have) {
      await git(['fetch', 'origin', `+${CURRENT.ref}:${CURRENT.ref}`], { cwd: repoRoot, timeoutMs: 20000 });
      have = (await git(['rev-parse', '--verify', '--quiet', CURRENT.ref], { cwd: repoRoot })).code === 0;
    }
    if (!have) {
      const emptyTree = (await gitOk(['hash-object', '-t', 'tree', '/dev/null'], { cwd: repoRoot })).trim();
      const c = await git(['commit-tree', emptyTree, '-m', 'tracker store: the first state'], { cwd: repoRoot });
      if (c.code !== 0) die(1, `could not create the store ref ${CURRENT.ref}: ${text(c)}`);
      await gitOk(['update-ref', CURRENT.ref, c.stdout.trim()], { cwd: repoRoot });
      say(`tracker-sync: created ${CURRENT.ref} (no branch contains it)`);
    }
    await git(['worktree', 'prune'], { cwd: repoRoot });
    const add = await git(['worktree', 'add', '--detach', store, CURRENT.ref], { cwd: repoRoot });
    if (add.code !== 0) die(1, `could not create the store worktree at ${store}: ${text(add)}`);
    say(`tracker-sync: the store is ${store}`);
  } else if ((await git(['rev-parse', '--is-inside-work-tree'], { cwd: store })).code !== 0) {
    die(1, `${store} exists and is not the store worktree: move it aside or point --state elsewhere`);
  }
  CURRENT.store = canonicalPath(store);
  mkdirSync(join(store, '.tracker-sync', 'recordings'), { recursive: true });
  return { store, fresh };
}

const stateFiles = () => CURRENT.recipe.stateFiles;

/** Write one state file into the store from a revision's tree, or from nowhere. */
async function stateFrom(rev) {
  const out = [];
  for (const p of stateFiles()) {
    const r = await git(['show', `${rev}:${p}`], { cwd: CURRENT.store });
    out.push([p, r.code === 0 ? r.stdout : null]);
  }
  return out;
}
const sideText = (parts) => parts.filter(([, c]) => c !== null).map(([p, c]) => `=== ${p}\n${c}`).join('\n');
function parseSide(txt) {
  const out = [];
  const re = /^=== (.*)\n/gm;
  let m; const marks = [];
  while ((m = re.exec(txt))) marks.push([m[1], m.index, m.index + m[0].length]);
  for (let i = 0; i < marks.length; i++) {
    const [p, , start] = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1][1] : txt.length;
    out.push([p, txt.slice(start, end)]);
  }
  return out;
}
async function writeState(parts) {
  for (const [p, c] of parts) {
    if (c === null) continue;
    const f = join(CURRENT.store, p);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, c);
  }
}

/** Stage the state files and the mechanism's own files, and commit a tree. */
async function commitState(message, parents) {
  const existing = stateFiles().filter((p) => existsSync(join(CURRENT.store, p)));
  if (existing.length) await git(['add', '--', ...existing], { cwd: CURRENT.store });
  const tracked = (await git(['ls-files', '--', ...stateFiles()], { cwd: CURRENT.store })).stdout.split('\n').filter(Boolean);
  const gone = tracked.filter((p) => !existsSync(join(CURRENT.store, p)));
  if (gone.length) await git(['rm', '--cached', '-q', '--', ...gone], { cwd: CURRENT.store });
  await git(['add', '-A', '--', '.tracker-sync'], { cwd: CURRENT.store });
  const tree = (await gitOk(['write-tree'], { cwd: CURRENT.store })).trim();
  const args = ['commit-tree', tree];
  for (const p of parents) args.push('-p', p);
  args.push('-m', message);
  const c = await git(args, { cwd: CURRENT.store });
  if (c.code !== 0) die(1, `could not write the store commit: ${text(c)}`);
  const oid = c.stdout.trim();
  await gitOk(['reset', '--soft', oid], { cwd: CURRENT.store });
  return oid;
}

/** Fetch the ref into a private ref: never into the one the worktree holds. */
async function fetchRemote() {
  // A fetch that fails while two machines and their watchers are working is far
  // more often a moment's contention - or a slow disk under load - than an
  // unreachable remote, and calling it unreachable is what makes a session refuse
  // work it could do. Three tries over a few seconds, then it is said.
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await git(['fetch', 'origin', `+${CURRENT.ref}:${FETCH_REF}`], { cwd: CURRENT.store, timeoutMs: 20000 });
    if (r.code === 0) return { ok: true, tip: (await gitOk(['rev-parse', FETCH_REF], { cwd: CURRENT.store })).trim() };
    const t = text(r);
    if (/couldn't find remote ref|Could not find remote ref|no such ref/i.test(t)) return { ok: true, noRef: true };
    if (attempt < 2 && !isPolicy(r)) { await sleep(1000 * (attempt + 1)); continue; }
    return { ok: false, unreachable: true, said: t };
  }
  return { ok: false, unreachable: true, said: 'the fetch did not answer' };
}
const isUnreachable = (r) => r.timedOut || /could not resolve host|unable to access|Connection (refused|reset|timed out)|Network is unreachable|Could not read from remote|Operation timed out|no route to host|terminal prompts disabled|Permission denied \(publickey\)/i.test(text(r));
const isRefused = (r) => /rejected|non-fast-forward|fetch first|stale info/i.test(text(r));
// A refusal the remote's own policy makes (a protected ref, a denied user) is
// its own class and is never retried; a push a pre-receive hook merely declined
// this once is an ordinary refusal, and the fetch-merge-push round retries it.
// `cannot lock ref` is not a policy: it is a ref momentarily held by another
// process, and the fetch-merge-push round retries it. A policy refusal is one a
// person must change something for.
const isPolicy = (r) => /denied|protected ref|not allowed|refusing to allow|forbidden/i.test(text(r));

/** Which machine this store belongs to, and keeping that true.
 *
 * The machine ordinals travel on the ref so that record ids never collide, but
 * which machine THIS one is must not travel: taking the remote's file wholesale
 * (a fast-forward, a merge, a rollback) would hand this machine the other's
 * ordinal, and the two would mint the same record ids. The name is in the
 * machine's own config, written by connect. */
function ourMachine() {
  return readConfig(CURRENT.flags, CURRENT.repoRoot).machine || null;
}
function keepIdentity() {
  const me = ourMachine();
  if (!me || !CURRENT.store) return;
  const f = join(CURRENT.store, '.tracker-sync', 'machines.json');
  if (!existsSync(f)) return;
  try {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    if (d.thisMachine !== me) writeFileSync(f, `${JSON.stringify({ ...d, thisMachine: me }, null, 2)}\n`);
  } catch {}
}

/** Merge the remote's tip into ours, per item, through the recipe, per F3. */
/** Merge the remote's tip into ours, per item, through the recipe, per F3.
 * Caller holds the lock: this is local work only. */
async function mergeAndCommit(tip) {
  const head = await headOid();
  const base = (await git(['merge-base', head, tip], { cwd: CURRENT.store })).stdout.trim();
  const work = join(machineDir(CURRENT.flags, CURRENT.repoRoot), 'merge');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const oursParts = await Promise.all(stateFiles().map(async (p) => [p, existsSync(join(CURRENT.store, p)) ? readFileSync(join(CURRENT.store, p), 'utf8') : null]));
  const theirsParts = await stateFrom(tip);
  const baseParts = base ? await stateFrom(base) : stateFiles().map((p) => [p, null]);
  const order = (await git(['log', '--first-parent', '--format=%H', base ? `${base}..${tip}` : tip], { cwd: CURRENT.store })).stdout.split('\n').filter(Boolean).reverse();
  const orderLocal = (await git(['log', '--first-parent', '--format=%H', head], { cwd: CURRENT.store })).stdout.split('\n').filter(Boolean);
  const paths = {
    ours: join(work, 'ours.txt'), theirs: join(work, 'theirs.txt'), base: join(work, 'base.txt'),
    out: join(work, 'merged.txt'), order: join(work, 'order.txt'), orderLocal: join(work, 'order-local.txt'),
  };
  writeFileSync(paths.ours, sideText(oursParts));
  writeFileSync(paths.theirs, sideText(theirsParts));
  writeFileSync(paths.base, sideText(baseParts));
  writeFileSync(paths.order, `${order.join('\n')}\n`);
  writeFileSync(paths.orderLocal, `${orderLocal.join('\n')}\n`);
  await recipeOk('merge', { ours: quote(paths.ours), theirs: quote(paths.theirs), base: quote(paths.base), out: quote(paths.out), order: quote(paths.order), orderLocal: quote(paths.orderLocal) });
  await writeState(parseSide(readFileSync(paths.out, 'utf8')));
  // recordings travel beside the tracker items and are immutable: two different
  // states for one revision are a refusal, never a newer-wins choice.
  const listIn = async (rev) => (await git(['ls-tree', '-r', '--name-only', rev, '--', '.tracker-sync/recordings'], { cwd: CURRENT.store })).stdout.split('\n').filter(Boolean);
  const [a, b] = [await listIn(head), await listIn(tip)];
  for (const p of new Set([...a, ...b])) {
    const ca = a.includes(p) ? (await git(['show', `${head}:${p}`], { cwd: CURRENT.store })).stdout : null;
    const cb = b.includes(p) ? (await git(['show', `${tip}:${p}`], { cwd: CURRENT.store })).stdout : null;
    if (ca !== null && cb !== null && ca !== cb)
      die(1, `two different recordings for ${basename(p)}: ${head.slice(0, 12)} and ${tip.slice(0, 12)} recorded different states for one revision, so neither is moved; a person must decide`);
    if (ca === null) { mkdirSync(dirname(join(CURRENT.store, p)), { recursive: true }); writeFileSync(join(CURRENT.store, p), cb); }
  }
  await recipeIsland(head, tip);
  keepIdentity();
  await recipeOk('import', {});
  return commitState(`tracker store: merge ${head.slice(0, 12)} and ${tip.slice(0, 12)} per item`, [head, tip]);
}
/** The mechanism's own files under .tracker-sync travel beside the state. */
async function recipeIsland(head, tip) {
  const names = (await git(['ls-tree', '-r', '--name-only', tip, '--', '.tracker-sync'], { cwd: CURRENT.store }))
    .stdout.split('\n').filter((n) => n && !n.startsWith('.tracker-sync/recordings/'));
  for (const n of names) {
    const theirs = (await git(['show', `${tip}:${n}`], { cwd: CURRENT.store })).stdout;
    const mine = existsSync(join(CURRENT.store, n)) ? readFileSync(join(CURRENT.store, n), 'utf8') : null;
    if (mine === null) { mkdirSync(dirname(join(CURRENT.store, n)), { recursive: true }); writeFileSync(join(CURRENT.store, n), theirs); continue; }
    if (mine === theirs) continue;
    if (n.endsWith('/machines.json')) {
      // One machine ordinal per machine: the two sides are unioned, and a lost
      // race (two machines taking the same ordinal) is named so connect runs again.
      const a = JSON.parse(mine); const b = JSON.parse(theirs);
      const ordinals = { ...a.ordinals };
      for (const [machine, ordinal] of Object.entries(b.ordinals || {})) {
        const taken = Object.entries(ordinals).find(([m, o]) => o === ordinal && m !== machine);
        if (taken) die(1, `two machines claimed ordinal ${ordinal} (${taken[0]} and ${machine}): run connect again on this machine, which takes the next free one`);
        if (ordinals[machine] === undefined) ordinals[machine] = ordinal;
      }
      writeFileSync(join(CURRENT.store, n), `${JSON.stringify({ ...a, ...b, ordinals, thisMachine: a.thisMachine || b.thisMachine }, null, 2)}\n`);
      continue;
    }
    die(1, `${n} differs between ${head.slice(0, 12)} and ${tip.slice(0, 12)} and is neither a recording nor the machine ordinals: a person must decide`);
  }
}

/** Bring our store to the remote's state, or merge it; never text-merge files. */
/** Bring our store to the remote's state, or merge it; never text-merge files.
 *
 * The network is never inside the lock: the fetch, the push and a refused push's
 * second fetch happen outside it, and only the store's own mutations (export,
 * merge, import, commit) are inside. A write that reached the tracker's database
 * is exported first, so neither a fast-forward nor a merge can lose it. */
async function syncOnce({ needsRemote, push, quiet } = {}) {
  const remote = await fetchRemote();
  if (!remote.ok) { if (needsRemote) die(4, `the remote is unreachable (${remote.said}); this store is this machine's only`); return { unreachable: true }; }
  if (remote.noRef) return { noRef: true };
  let fast=false;
  const oid = await locked(async () => {
    // HEAD and ancestry belong to the same critical section as reset/merge.
    // A local publisher may have advanced HEAD while the fetch was in flight.
    const head=await headOid();
    // A candidate an earlier run could not confirm may be proven accepted now.
    await pruneSettledCandidates(remote.tip);
    if (head===remote.tip) return head;
    fast=(await git(['merge-base','--is-ancestor',head,remote.tip],{cwd:CURRENT.store})).code===0;
    // The live database becomes state files first, so a write that only reached
    // it is not lost to a fast-forward or a merge. A tracker that refuses the
    // flush (br refuses to export an empty database over a filled one, which is
    // what a store that has not imported the ref yet looks like) is not holding
    // an unexported write: it is said, and the state files are taken as they are.
    const flushed = await recipe('export', {});
    if (flushed.code !== 0) say(`tracker-sync: the tracker refused to flush its database (${flushed.code}): ${text(flushed).split('\n')[0]}; the state files are taken as they are`);
    if (fast) {
      // Our own unpublished writes are a commit of their own; the push that
      // follows merges the remote in rather than dropping them.
      // Our own unpublished writes are merged with the remote's state per item
      // and committed, never merely committed and left as they are: a state that
      // is stale against the remote is exactly what makes a claim land twice,
      // because the recipe is asked about the state in front of it.
      if (await hasUncommittedState()) return mergeAndCommit(remote.tip);
      // Nothing of ours is unpublished: the remote's state replaces this store's.
      await gitOk(['reset', '--hard', remote.tip], { cwd: CURRENT.store });
      keepIdentity();
      await recipeOk('import', {});
      return remote.tip;
    }
    return mergeAndCommit(remote.tip);
  });
  if (!quiet) say(fast ? `tracker-sync: took the remote's state ${remote.tip.slice(0, 12)}` : `tracker-sync: merged the remote's ${remote.tip.slice(0, 12)} into ${oid.slice(0, 12)} per item`);
  const pushed = push === false ? null : await pushOid(oid, { quiet });
  return { oid, pushed };
}
/** Push an immutable oid; a refused push fetches, merges and pushes again. */
/** Push an immutable oid; a refused push fetches, merges and pushes again.
 * The push itself is a network call and runs outside the lock; the merge is local
 * work and takes it. */
async function pushOid(oid, { quiet, attempts = 3 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const r = await git(['push', 'origin', `${oid}:${CURRENT.ref}`], { cwd: CURRENT.store, timeoutMs: 10000 });
    if (r.code === 0) return { ok: true, oid };
    if (isUnreachable(r)) { if (!quiet) say(`tracker-sync: the remote is unreachable; the write is kept here and published when it answers (${text(r).split('\n')[0]})`); return { ok: false, unreachable: true }; }
    // A hosting policy that refuses this ref is its own class (exit 5): named,
    // never retried as if the remote had merely moved.
    if (isPolicy(r)) die(5, `the remote refused ${CURRENT.ref}: ${text(r)}`);
    if (isRefused(r)) {
      const remote = await fetchRemote();
      if (!remote.ok) { if (!quiet) say('tracker-sync: the push was refused and the remote is unreachable; the write is kept here'); return { ok: false, unreachable: true }; }
      if (remote.noRef) { if (!quiet) say('tracker-sync: the push was refused and the remote has no store ref yet'); return { ok: false, refused: true }; }
      // A caller that already holds the store's lock (connect) merges directly:
      // taking it twice in one process would wait for itself.
      oid = LOCK_HELD ? await mergeAndCommit(remote.tip) : await locked(() => mergeAndCommit(remote.tip));
      if (!quiet) say(`tracker-sync: the push was refused; merged the remote's ${remote.tip.slice(0, 12)} and pushing again`);
      continue;
    }
    die(1, `the push failed: ${text(r)}`);
  }
  say('tracker-sync: the push did not land after three attempts; the write is kept here and the next tick tries again');
  return { ok: false, refused: true };
}
// ---- publish, sync, claim, transition, record -------------------------------

const stateDigest = () => {
  const h = createHash('sha256');
  for (const p of stateFiles()) {
    const f = join(CURRENT.store, p);
    h.update(p);
    h.update(existsSync(f) ? readFileSync(f) : Buffer.from(''));
  }
  return h.digest('hex');
};
async function hasUncommittedState() {
  const r = await git(['status', '--porcelain', '--', ...stateFiles(), '.tracker-sync'], { cwd: CURRENT.store });
  return r.stdout.trim().length > 0;
}

async function takeLockWait(ms) {
  const deadline = Date.now() + (ms || 0);
  let said = false;
  for (;;) {
    try { return takeLock(CURRENT.flags, CURRENT.repoRoot); } catch (e) {
      if (Date.now() > deadline) die(1, `${e.message}; nothing was written, and the command that held it is named above`);
      if (!said) {
        said = true;
        say(`tracker-sync: waiting for the store lock (${e.message.split(';')[0]})`);
      }
      await sleep(200);
    }
  }
}

/** Local store work only: never a network call inside it. */
async function locked(fn, waitMs = 120000) {
  const release = await takeLockWait(waitMs);
  try { return await fn(); } finally { release(); }
}
async function publishOnce({ quiet } = {}) {
  const oid = await locked(async () => {
    await recipeOk('export', {});
    if (!(await hasUncommittedState())) return null;
    return commitState(`tracker store: ${nowIso()}`, [await headOid()]);
  });
  if (oid === null) return { ok: true, nothing: true };
  const res = await pushOid(oid, { quiet });
  writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastPublish: nowIso(), lastPublishOk: !!res.ok });
  if (res.ok && !quiet) say(`tracker-sync: published ${oid.slice(0, 12)} to ${CURRENT.ref}`);
  return res;
}
async function pushOnce(oid) {
  const r = await git(['push', 'origin', `${oid}:${CURRENT.ref}`], { cwd: CURRENT.store, timeoutMs: 10000 });
  if (r.code === 0) return { ok: true };
  if (isUnreachable(r)) return { unreachable: true, said: text(r) };
  if (isPolicy(r)) die(5, `the remote refused ${CURRENT.ref}: ${text(r)}`);
  if (isRefused(r)) return { refused: true, said: text(r) };
  die(1, `the push failed: ${text(r)}`);
}

/** A conditional write: it counts only once it is on the remote (claim, transition).
 *
 * The recipe is what knows the tracker's own state, so the condition lives
 * there: its claim and transition commands refuse by exiting 3 when the item is
 * already held, or the transition has already moved, and write nothing. This
 * wrapper makes the remote the only place the write counts: fetch and merge
 * first, write, push an immutable oid, and, when the remote refuses the push,
 * discard everything written, rebuild on top of the remote's new state and ask
 * the recipe again before writing a second time. */
/** A settled outcome needs no person: the diagnostic of a discarded candidate
 * goes with it. An error, or an outcome nobody could confirm yet, keeps it,
 * because someone must reconcile that. */
function settleDiagnostic(file) {
  if (!file) return;
  try {
    rmSync(file, { force: true });
  } catch {}
}

/** A candidate an earlier run retained may be proven accepted later: once the
 * remote's tip contains it, the write did reach the remote, so its ref and its
 * diagnostic are settled and go. A candidate the remote does not hold is left
 * for a person. */
async function pruneSettledCandidates(remoteTip) {
  if (!remoteTip) return;
  const listed = await git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/tracker-sync/candidates/'], { cwd: CURRENT.store });
  if (listed.code !== 0) return;
  for (const line of listed.stdout.split('\n')) {
    const [ref, oid] = line.trim().split(/\s+/);
    if (!ref || !oid) continue;
    if ((await git(['merge-base', '--is-ancestor', oid, remoteTip], { cwd: CURRENT.store })).code !== 0) continue;
    await git(['update-ref', '-d', ref, oid], { cwd: CURRENT.store });
    settleDiagnostic(join(machineDir(CURRENT.flags, CURRENT.repoRoot), `${basename(ref)}.result.json`));
  }
}

/** A pending condition never becomes the live worktree's HEAD or database.
 * Local writers and publishers keep using the live store while the immutable
 * candidate is on the wire. Only acceptance integrates it under the local lock.
 * Copy local recipe configuration too, but never follow a pointer to live data. */
async function isolatedCandidate(kind, item, prepare) {
  const live = CURRENT.store;
  const previousEnv = CURRENT.recipeEnv;
  const previousThrow = THROW_ERRORS;
  const previousIsolation = CURRENT.isolatedFrom;
  const candidate = join(machineDir(CURRENT.flags, CURRENT.repoRoot), `candidate-${randomUUID()}`);
  const diagnostic = { kind, item, pid: process.pid, createdAt: nowIso(), phase: 'preparing', files: 0, bytes: 0, snapshotMs: 0, importMs: 0 };
  const resultFile = `${candidate}.result.json`;
  const save = () => writeFileSync(resultFile, `${JSON.stringify(diagnostic, null, 2)}\n`);
  try {
    THROW_ERRORS = true;
    save();
    const step = await locked(async () => {
      await recipeOk('export', {});
      if (await hasUncommittedState()) await commitState(`tracker store: before ${kind}`, [await headOid()]);
      const before = await headOid();
      await gitOk(['worktree', 'add', '--detach', candidate, before], { cwd: live });
      const snapshotStart = Date.now();
      cpSync(live, candidate, {
        recursive: true,
        filter: (from) => {
          if (from === join(live, '.git')) return false;
          const info = lstatSync(from);
          if (info.isFile()) {
            diagnostic.files++;
            diagnostic.bytes += info.size;
            if (/(?:\.(?:json|yaml|yml|toml|ini|conf|env)|\/config)$/.test(from) && readFileSync(from).includes(Buffer.from(live)))
              throw new Error('cannot isolate conditional recipe: a local file names the live store');
          }
          if (info.isSymbolicLink()) throw new Error(`cannot isolate conditional recipe: ${from} is a symbolic link; nothing conditional was written`);
          return true;
        },
      });
      diagnostic.snapshotMs = Date.now() - snapshotStart;
      save();
      CURRENT.store = canonicalPath(candidate);
      CURRENT.isolatedFrom = live;
      // pointer.env is trusted recipe-produced launcher shell text. Preserve
      // its existing shell quoting/expansion contract and keep values in memory.
      const route = await recipe('pointer.env', {});
      if (route.code !== 0) return { failed: route, decl: 'pointer.env' };
      const bound = await sh(`{ set -a;\n${route.stdout}\nset +a; } >/dev/null\n${quote(process.execPath)} -e 'process.stdout.write(JSON.stringify(process.env))'`, { cwd: CURRENT.store, env: previousEnv });
      if (bound.code !== 0) throw new Error('cannot isolate conditional recipe: pointer.env launcher failed');
      try {
        CURRENT.recipeEnv = JSON.parse(bound.stdout);
        for (const key of Object.keys(process.env)) if (!(key in CURRENT.recipeEnv)) CURRENT.recipeEnv[key] = null;
        for (const value of Object.values(CURRENT.recipeEnv)) if (typeof value === 'string' && value.includes(live)) throw new Error('live routing');
      } catch {
        throw new Error('cannot isolate conditional recipe: pointer.env launcher returned invalid environment');
      }
      keepIdentity();
      const importStart = Date.now();
      const imported = await recipe('import', {});
      diagnostic.importMs = Date.now() - importStart;
      save();
      if (imported.code !== 0) return { failed: imported, decl: 'import' };
      return prepare(before);
    });
    if (!step.oid) {
      diagnostic.phase = step.already ? 'already-recorded' : step.lost ? 'lost' : 'recipe-failed';
      save();
      return { ...step, diagnostic: resultFile };
    }
    diagnostic.oid = step.oid;
    diagnostic.phase = 'pushing';
    save();
    // Network outside the mutation lock. A refused/unreachable candidate is
    // discarded, not rolled back over another local operation's completed work.
    const pushed = await pushOnce(step.oid);
    diagnostic.phase = pushed.ok ? 'accepted' : pushed.unreachable ? 'unknown' : 'refused';
    if (pushed.unreachable) {
      diagnostic.retainedRef = `refs/tracker-sync/candidates/${basename(candidate)}`;
      await gitOk(['update-ref', diagnostic.retainedRef, step.oid], { cwd: live });
    }
    save();
    return { ...step, pushed, diagnostic: resultFile };
  } catch (error) {
    diagnostic.phase = 'error';
    diagnostic.error = 'candidate preparation or push failed';
    save();
    throw error;
  } finally {
    CURRENT.store = live;
    CURRENT.recipeEnv = previousEnv;
    THROW_ERRORS = previousThrow;
    CURRENT.isolatedFrom = previousIsolation;
    if (existsSync(candidate)) {
      await git(['worktree', 'remove', '--force', candidate], { cwd: live });
      rmSync(candidate, { recursive: true, force: true });
    }
  }
}

async function conditionalCandidate(kind, decl, map, item) {
  return isolatedCandidate(kind, item, async (before) => {
    const w = await recipe(decl, map);
    if (w.code === 3) return { lost: text(w) };
    if (w.code !== 0) return { failed: w, decl };
    const exported = await recipe('export', {});
    if (exported.code !== 0) return { failed: exported, decl: 'export' };
    return { oid: await commitState(`tracker store: ${kind} ${item}`, [before]) };
  });
}

/** An unreachable push may have reached the remote after all: fetch, and check
 * whether the remote's tip contains this exact candidate. A run that proves it
 * accepts the write; anything else stays unknown.
 *
 * Another command may have settled and pruned this candidate first. That is the
 * same proof, so a diagnostic that is already gone is not an error, and the
 * ref is dropped from the diagnostic's own name when there is no file left to
 * read it from. */
async function reconcileCandidate(step) {
  if (!step.pushed?.unreachable) return;
  const observed = await fetchRemote();
  if (!observed.ok || !observed.tip) return;
  if ((await git(['merge-base', '--is-ancestor', step.oid, observed.tip], { cwd: CURRENT.store })).code !== 0) return;
  step.pushed = { ok: true, reconciled: true };
  let diagnostic = null;
  try { diagnostic = JSON.parse(readFileSync(step.diagnostic, 'utf8')); } catch {}
  const retained = diagnostic?.retainedRef || `refs/tracker-sync/candidates/${basename(step.diagnostic).replace(/\.result\.json$/, '')}`;
  if (diagnostic) {
    diagnostic.phase = 'accepted-reconciled';
    delete diagnostic.retainedRef;
    try { writeFileSync(step.diagnostic, `${JSON.stringify(diagnostic, null, 2)}\n`); } catch {}
  }
  // The ref is dropped with the old value: a ref that moved since is not ours.
  await git(['update-ref', '-d', retained, step.oid], { cwd: CURRENT.store });
}

async function integrateCandidate(step) {
  await locked(async () => {
    await recipeOk('export', {});
    await mergeAndCommit(step.oid);
  });
}

async function conditional(kind, decl, map, item) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await syncOnce({ needsRemote: true, quiet: true });
    const step = await conditionalCandidate(kind, decl, map, item);
    await reconcileCandidate(step);
    if (step.lost) {
      settleDiagnostic(step.diagnostic);
      die(3, `${kind} lost: ${step.lost.split('\n')[0] || 'the condition no longer holds'}; read again and take other work`);
    }
    // A recipe command that failed is an error: its diagnostic stays for a person.
    if (step.failed) die(step.failed.code === 127 || step.failed.missing ? 2 : 1, `the recipe's ${step.decl} command failed (${step.failed.code}): ${text(step.failed) || 'no output'}`);
    if (step.pushed.ok) {
      await integrateCandidate(step);
      settleDiagnostic(step.diagnostic);
      writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastPublish: nowIso(), lastPublishOk: true });
      say(`${kind} landed on the remote: ${item}`);
      return;
    }
    if (step.pushed.unreachable) {
      // Unknown: the diagnostic and the retained ref stay until a run proves
      // what the remote holds.
      writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastPublishOk: false });
      die(4, `the remote is unreachable, the ${kind} outcome is unknown: the remote may have accepted it before the connection failed. Reconcile remote state before retrying; candidate ${step.oid}`);
    }
    settleDiagnostic(step.diagnostic);
    say(`${kind}: the push was refused; the pending candidate was discarded, and the condition is asked again after synchronization`);
  }
  die(3, `${kind} lost: three pushes were refused; read again and take other work`);
}

async function recordRun({ revision, checkout, fromTree }) {
  const ck = checkout ? resolve(checkout) : CURRENT.repoRoot;
  let captured;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await fetchRemote();
    if (!remote.ok) die(4, 'the remote is unreachable, so recording identity cannot be checked; nothing new was recorded');
    // A record run proves acceptance of an earlier candidate too: a recording
    // that was reported unknown and did land is settled here, so its ref and
    // diagnostic go before this run looks at the revision.
    await locked(async () => { await pruneSettledCandidates(remote.tip); });
    const step = await isolatedCandidate('record', revision || 'HEAD', async () => {
      const ck2 = ck;
      let rev = revision;
      let parts;
      if (!captured) {
        if (fromTree) {
          rev = rev || (await gitOk(['rev-parse', 'HEAD'], { cwd: ck2 })).trim();
          if ((await git(['cat-file', '-e', `${rev}^{commit}`], { cwd: CURRENT.store })).code !== 0)
            die(1, `${rev} is not a revision of this repository`);
          parts = await stateFrom(rev);
          if (parts.every(([, c]) => c === null))
            die(1, `${rev} carries none of the state files (${stateFiles().join(', ')}), so it holds no state to record`);
        } else {
          const head = (await gitOk(['rev-parse', 'HEAD'], { cwd: ck2 })).trim();
          rev = rev || head;
          if (rev !== head)
            die(1, `revision ${String(rev).slice(0, 12)} is not ${ck2}'s HEAD (${head.slice(0, 12)}): only a revision cut or landed now is recorded, because a later state is not that revision's`);
          parts = stateFiles().map((p) => [p, existsSync(join(CURRENT.store, p)) ? readFileSync(join(CURRENT.store, p), 'utf8') : null]);
        }
        captured = { rev, parts };
      }
      ({ rev, parts } = captured);
      const file = join(CURRENT.store, '.tracker-sync', 'recordings', `${rev}.jsonl`);
      // What the remote holds for this revision, read before anything is said about
      // "already recorded": a recording this machine kept while the remote's publish
      // of the same revision was refused is exactly where two different states for
      // one revision meet, and that is a refusal for a person, never a success.
      const there = remote.ok && !remote.noRef
        ? (await git(['show', `${remote.tip}:.tracker-sync/recordings/${rev}.jsonl`], { cwd: CURRENT.store })).stdout
        : '';
      // A recording that already exists is SUCCESS, not a failure: the record hook
      // runs again after a merge, and a person reruns the step after an interrupted
      // one; "this revision is recorded" is the state the step exists to reach, and
      // reporting it as an error made a session believe the revision never was
      // recorded, and made a hook fail on a revision it had recorded itself.
      // Nothing is written and nothing is pushed.
      if (existsSync(file)) {
        const mine = readFileSync(file, 'utf8');
        if (there && there !== mine)
          die(1, `${String(rev).slice(0, 12)} is recorded here with a state the remote does not carry, and the remote holds one this machine does not: two different recordings of one revision, so neither is moved. A person must decide which state that revision had`);
        return { already: String(rev).slice(0, 12), where: 'here' };
      }
      if (there && there !== sideText(parts))
        die(1, `${String(rev).slice(0, 12)} is already recorded on the remote with a different state; neither is moved, a person must decide`);
      if (there) return { already: String(rev).slice(0, 12), where: 'on the remote' };
      // Capture the revision's state once, before merging remote changes.
      // Retries preserve that exact recording rather than recapturing later work.
      if (!remote.noRef) await mergeAndCommit(remote.tip);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, sideText(parts));
      return { oid: await commitState(`tracker store: record ${String(rev).slice(0, 12)}`, [await headOid()]) };
    });
    if (step.already) {
      settleDiagnostic(step.diagnostic);
      writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastRecord: nowIso() });
      say(`tracker-sync: ${step.already} is already recorded ${step.where}; a recording is written once and never moved, so nothing was written`);
      return;
    }
    // A recipe command that failed is an error: its diagnostic stays for a person.
    if (step.failed) die(step.failed.code === 127 || step.failed.missing ? 2 : 1, `the recipe's ${step.decl} command failed (${step.failed.code}): ${text(step.failed) || 'no output'}`);
    await reconcileCandidate(step);
    if (step.pushed.ok) {
      await integrateCandidate(step);
      settleDiagnostic(step.diagnostic);
      writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastRecord: nowIso() });
      say(`tracker-sync: recorded the store at ${String(captured.rev).slice(0, 12)}`);
      return;
    }
    if (step.pushed.unreachable) die(4, `recording outcome is unknown: the remote may have accepted candidate ${step.oid}; reconcile remote state before retrying`);
    // A refused candidate is discarded and asked again: its diagnostic goes.
    settleDiagnostic(step.diagnostic);
  }
  die(4, 'the remote refused three recording candidates; live work was preserved; reconcile remote state before retrying');
}
// ---- connect, status, export, watch ----------------------------------------

/** The record step a checkout's own hook needs, said so a person can put it in a
 * hook this mechanism must not write to itself. */
const recordLine = (flags, repoRoot, checkout) =>
  `node ${quote(join(HERE, 'tracker-sync.mjs'))} record --revision "$(git rev-parse HEAD)" --checkout "$(git rev-parse --show-toplevel)" --state ${quote(machineDir(flags, repoRoot))} --recipe ${quote(CURRENT.recipe.path)}`;

/** The line that puts a checkout back on the store's pointer, for the hook that
 * runs when a branch is checked out. A branch from before the move carries its
 * own tracker folder, so checking it out replaces the pointer with a real
 * folder; switching away leaves that folder behind, and a tracker started there
 * would be a second one. This relinks it, and it says so when it cannot. */
const relinkLine = (flags, repoRoot) =>
  `node ${quote(join(HERE, 'tracker-sync.mjs'))} relink --checkout "$(git rev-parse --show-toplevel)" --state ${quote(machineDir(flags, repoRoot))} --recipe ${quote(CURRENT.recipe.path)}`;

const HOOK_MARKS = {
  'post-commit': '# shady2k tracker-sync record: this line records the revision this hook just cut or landed',
  'post-merge': '# shady2k tracker-sync record: this line records the revision this hook just cut or landed',
  'post-checkout': '# shady2k tracker-sync relink: this line puts a checkout back on the store when a branch left a folder there',
};

/** Where a checkout's hooks are, the line each one needs, and whether that
 * folder is the repository's own (core.hooksPath inside the tree), where a
 * machine's absolute paths must never be written. Asked with plain git, never
 * through the mechanism's own core.hooksPath override: that override would make
 * git report the mechanism's empty directory instead of the project's hooks. */
async function hookPlan(checkout) {
  const flags = CURRENT.flags; const repoRoot = CURRENT.repoRoot;
  const hp = await run('git', ['-C', checkout, 'rev-parse', '--git-path', 'hooks'], {});
  if (hp.code !== 0) die(1, `could not find the hooks directory of ${checkout}: ${text(hp)}`);
  const dir = resolve(checkout, hp.stdout.trim());
  const cfg = await run('git', ['-C', checkout, 'config', '--get', 'core.hooksPath'], {});
  const inRepo = cfg.code === 0 && cfg.stdout.trim() !== '' ? await hooksInsideRepository(checkout, dir) : false;
  const files = {
    'post-commit': `${recordLine(flags, repoRoot, checkout)} >/dev/null 2>&1 || true\n`,
    'post-merge': `${recordLine(flags, repoRoot, checkout)} >/dev/null 2>&1 || true\n`,
    'post-checkout': `${relinkLine(flags, repoRoot)} || true\n`,
  };
  const wanted = Object.keys(HOOK_MARKS).map((name) => {
    const file = join(dir, name);
    const text = existsSync(file) ? readFileSync(file, 'utf8') : null;
    return { name, file, line: files[name], mark: `${HOOK_MARKS[name]}\n`, text, present: text !== null && text.includes(HOOK_MARKS[name]) };
  });
  return { dir, inRepo, wanted, missing: wanted.filter((h) => !h.present) };
}

/** Whether this hooks folder is inside the checkout's working tree. Git's own
 * hooks folder is <git dir>/hooks and is not the repository's file; a folder the
 * project configured with core.hooksPath that lies in the tree is. */
async function hooksInsideRepository(checkout, dir) {
  const top = await run('git', ['-C', checkout, 'rev-parse', '--show-toplevel'], {});
  if (top.code !== 0) return false;
  const inside = (p, root) => p === root || p.startsWith(root.endsWith('/') ? root : `${root}/`);
  dir=canonicalPath(dir);
  if (!inside(dir, canonicalPath(resolve(top.stdout.trim())))) return false;
  // Git's own metadata directory is not the repository's tracked files:
  // `core.hooksPath` naming it (`.git/hooks`) is the folder git uses by default,
  // nothing there is committed, and refusing it would take away a configuration
  // that worked before this check existed. The common directory is asked too, so a
  // linked worktree's hooks (which live in the main repository's git directory)
  // are recognised as git's own.
  for (const what of ['--git-dir', '--git-common-dir']) {
    const g = await run('git', ['-C', checkout, 'rev-parse', what], {});
    if (g.code === 0 && g.stdout.trim() && inside(dir, canonicalPath(resolve(checkout, g.stdout.trim())))) return false;
  }
  return true;
}

async function installHooks(checkout) {
  const plan = await hookPlan(checkout);
  mkdirSync(plan.dir, { recursive: true });
  for (const h of plan.wanted) {
    const { file: f, mark, line } = h;
    if (h.present) continue;
    if (h.text !== null) {
      // A hook that is not a POSIX shell script cannot carry this line: shell
      // appended to another language is a syntax error that stops every commit.
      const shebang = (h.text.split('\n')[0] || '').trim();
      if (shebang.startsWith('#!') && !/\/(sh|bash|dash|zsh|ksh)\b/.test(shebang)) {
        die(1, `${f} is not a shell hook (${shebang}): tracker-sync will not append shell to it. Call the step from that hook yourself: ${line.trim()}`);
      }
      // A hook that ends in `exit 0` would end before an appended step runs, so
      // the step goes in front of that line, and the project's own hook is kept.
      const tail = h.text.match(/\n[ \t]*exit[ \t]+0[ \t]*\n?[ \t]*$/);
      writeFileSync(f, tail && tail.index !== undefined
        ? `${h.text.slice(0, tail.index)}\n${mark}${line}${h.text.slice(tail.index).replace(/^\n/, '')}`
        : `${h.text.replace(/\n*$/, '\n')}${mark}${line}`);
      say(`tracker-sync: composed the ${h.name} step onto the existing ${f}${tail ? ' (before its own exit 0)' : ''}`);
    } else {
      writeFileSync(f, `#!/bin/sh\n${mark}${line}`);
      say(`tracker-sync: installed ${f}`);
    }
    await run('chmod', ['755', f], {});
  }
}

/** Put a checkout back on the store's pointer, and say so only when it moves.
 *
 * This is what the post-checkout hook runs. A branch that predates the move
 * tracks its own tracker folder, so checking it out replaces the pointer with a
 * real folder; switching away leaves that folder behind, and a tracker started
 * there would be a second tracker beside the machine's store. Whether such a
 * folder may be relinked or must be refused is the recipe's to say: it knows its
 * own tracker's files. Nothing of the store is written here, so no lock is taken.
 */
async function relinkRun(flags) {
  const checkouts = list(flags.checkout).map((c) => resolve(String(c)));
  if (!checkouts.length) checkouts.push(CURRENT.repoRoot);
  // Never for the store itself, nor for a worktree parked beside it: the checkout
  // a hook reports has to be the PROJECT's, and a git worktree of the store (the
  // mechanism makes one, and that very `worktree add` runs the project's hooks)
  // has the store as its own top level, whose pointer cannot be a link to itself.
  const mine = resolve(machineDir(flags, CURRENT.repoRoot));
  const isOurs = (c) => c === mine || c.startsWith(mine.endsWith('/') ? mine : `${mine}/`);
  for (const c of checkouts) {
    if (isOurs(c)) continue;
    const r = await recipe('pointer.install', { checkout: quote(c) }, { cwd: CURRENT.store });
    if (r.code !== 0)
      die(r.code === 127 || r.missing ? 2 : 1, `${c} is not on the store's pointer at ${CURRENT.store}: ${text(r)}`);
    const said = text(r);
    if (/relinked|installed|added/.test(said)) say(`tracker-sync: ${c} was put back on the store at ${CURRENT.store}: ${said.split('\n')[0]}`);
  }
}

async function connectRun(flags) {
  const repoRoot = CURRENT.repoRoot;
  const checkouts = list(flags.checkout).map((c) => resolve(String(c)));
  if (flags.all) {
    const wt = (await git(['worktree', 'list', '--porcelain'], { cwd: repoRoot })).stdout;
    for (const line of wt.split('\n')) if (line.startsWith('worktree ')) checkouts.push(resolve(line.slice(9).trim()));
    checkouts.push(repoRoot);
  }
  if (!checkouts.length) checkouts.push(repoRoot);
  const unique = [...new Set(checkouts)];
  // preflight: nothing is written before every runtime and destination answers
  const missing = [];
  if ((await run('git', ['--version'], {})).missing) missing.push('git is not on PATH');
  if (await recipe('prove', {}, { cwd: repoRoot }).then((r) => r.missing || r.code === 127)) missing.push(`the tracker's own command is missing (${CURRENT.recipe.prove})`);
  for (const c of unique) {
    if (!existsSync(c)) { missing.push(`${c} does not exist`); continue; }
    const isRepo = await run('git', ['-C', c, 'rev-parse', '--git-dir'], {});
    if (isRepo.code !== 0) missing.push(`${c} is not a git repository`);
  }
  if (missing.length) die(2, `connect cannot start: ${missing.join('; ')}`);
  // A hooks folder inside the repository must never take this machine's own
  // state path: the record line names an absolute state directory and the
  // recipe's own path, and it would be committed for every machine's checkout to
  // read. Asked before anything is written, and refused with the line that fixes
  // it, which the project puts in its own hook. A hook that already carries the
  // step is left alone: nothing is written there, so nothing is refused.
  for (const c of unique) {
    const plan = await hookPlan(c);
    if (!plan.inRepo || !plan.missing.length) continue;
    // Every missing hook is printed whole - the marker line and the command - so
    // the project can paste it into its own hook and rerun connect: the check reads
    // the marker, so a command without it would be refused again and the recovery
    // the message recommends would never complete.
    const add = plan.missing.map((h) => `  ${h.name}:\n    ${h.mark.trim()}\n    ${h.line.trim()}`).join('\n');
    die(1, `the hooks folder ${plan.dir} of ${c} is inside the repository (core.hooksPath names a folder in the tree), so these steps would commit this machine's own paths - its state directory ${machineDir(CURRENT.flags, repoRoot)} and the recipe ${CURRENT.recipe.path} - into every checkout of every machine. Nothing was written. Put them in the project's own hooks there yourself, marker line and command together, or point core.hooksPath at a folder outside the working tree and rerun connect:\n${add}`);
  }
  if (!flags.offline) {
    // Reachability is whether the remote answers at all. `--exit-code` makes git
    // exit 2 for "no matching ref", which says nothing about the remote: a bare
    // remote whose HEAD names a branch that does not exist (git init --bare
    // still defaulting to master while the project pushes main) answers
    // perfectly, and reading that as unreachable refused a remote connect can
    // use. The store ref's own absence is not unreachability either: connect
    // makes the store, and a remote with no store ref yet is the normal first
    // connect on a fresh remote.
    const any = await git(['ls-remote', 'origin'], { cwd: repoRoot, timeoutMs: 20000 });
    if (any.missing || any.timedOut || any.code !== 0)
      die(4, `the remote is unreachable (${text(any).split('\n')[0] || 'no answer'}); the store cannot be brought up to date. Pass --offline to connect anyway, and it will publish when the remote answers`);
  }
  // Everything connect writes happens under the store's one lock: nothing of its
  // transaction can interleave with a watcher's publish or another session's claim.
  const release = await takeLockWait(5000);
  try {
  const { fresh } = await ensureStore({ create: true });
  // A store that came from the ref carries the other machines' state files. The
  // tracker's database here is this machine's own and must be rebuilt from them
  // BEFORE anything writes, or the first write is made against an empty database
  // and the export that follows is refused (br refuses to flush an empty database
  // over a filled one) or the two sides' prefixes disagree.
  if (!fresh && CURRENT.recipe.import) {
    await recipeOk('import', {});
    say('tracker-sync: this machine\'s database was rebuilt from the state the ref carries');
  }
  // A store the mechanism has just created carries no tracker state. The
  // tracker's own "make me a store" command is the recipe's, and it runs here
  // and only here: never in a checkout, so a checkout can never conjure up a
  // second, empty tracker beside the machine's store.
  if (fresh && CURRENT.recipe.init) {
    await recipeOk('init', { prefix: quote(String(flags.prefix || '')) });
    say('tracker-sync: initialized the tracker inside the new store');
  } else if (fresh && !CURRENT.recipe.init) {
    say(`tracker-sync: the store is new; the recipe declares no init, so the tracker's state must be put there by the project (see the integration's Tracker layout field)`);
  }
  // The in-branch store's state is taken in BEFORE this machine claims its
  // ordinal and before anything of ours is pushed: the copy is allowed only
  // while the ref holds no store, and our own first commit would make it look
  // as if it already did.
  const from = flags['from-checkout'] ? resolve(String(flags['from-checkout'])) : null;
  if (from) {
    const remote = await fetchRemote();
    const hasRemoteStore = remote.ok && !remote.noRef;
    if (hasRemoteStore)
      die(1, `the ref ${CURRENT.ref} already holds a store (${remote.tip.slice(0, 12)}): a byte copy would overwrite records. Import and merge the checkout's remaining writes per item instead`);
    for (const p of stateFiles()) {
      const src = join(from, p);
      if (!existsSync(src)) continue;
      const dest = join(CURRENT.store, p);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(src));
      say(`tracker-sync: copied ${p} from ${from} into the store`);
    }
    await recipeOk('import', {});
  }
  const machineName = String(flags.machine || (await run('hostname', [], {})).stdout.trim() || 'machine');
  writeConfig(flags, repoRoot, { machine: machineName });
  if (CURRENT.recipe.ordinal) {
    const name = machineName;
    await recipeOk('ordinal', { machine: quote(name) });
    const oid = await commitState(`tracker store: this machine takes its ordinal`, [await headOid()]);
    const res = await pushOid(oid, { quiet: true });
    say(`tracker-sync: this machine is named in the store's machine ordinals${res.ok ? '' : ' (kept here, published when the remote answers)'}`);
  }
  const envLine = (await recipe('pointer.env', {}, { cwd: CURRENT.store })).stdout.trim();
  // NOT `--env-file`: node itself consumes that option (`--env-file=<path>`), so
  // the mechanism would never see it and node would fail on a missing file.
  const envFile = flags['launcher-file'] ? resolve(String(flags['launcher-file'])) : readConfig(flags, repoRoot).envFile;
  const says = [];
  for (const c of unique) {
    const install = await recipe('pointer.install', { checkout: quote(c) }, { cwd: CURRENT.store });
    if (install.code !== 0) {
      const done = says.map((s) => s.checkout).join(', ') || 'none';
      if (install.code === 127 || install.missing) die(2, `the pointer command is missing for ${c}; checkouts already pointed: ${done}. connect is safe to rerun`);
      die(1, `${c} could not be pointed at the store: ${text(install)}. Checkouts already pointed: ${done}. connect is safe to rerun`);
    }
    const check = await recipe('pointer.check', { checkout: quote(c) }, { cwd: CURRENT.store });
    const said = text(check);
    // The check must name the store this mechanism created: a tracker that
    // answers with some other store is not pointing at the machine's one.
    if (check.code !== 0 || !said.includes(CURRENT.store))
      die(1, `${c} does not reach the store at ${CURRENT.store}: the pointer check said "${said || 'nothing'}" (exit ${check.code})`);
    const variableOnly = /variable-only/.test(said);
    if (variableOnly && !envFile)
      die(1, `${c} reaches ${CURRENT.store} only through a variable and no launcher file was named: pass --launcher-file <file> (or put the checkout's pointer in place) so the checkout is pointed where its agents start, not in an agent's memory`);
    says.push({ checkout: c, variableOnly });
    say(`tracker-sync: ${c} reaches ${CURRENT.store}${variableOnly ? ' (through the variable the launcher carries)' : ' through its own pointer'}`);
    await installHooks(c);
  }
  if (envFile && envLine) {
    const lines = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    if (!lines.includes(envLine)) writeFileSync(envFile, `${lines.replace(/\n*$/, '\n')}${envLine}\n`);
    say(`tracker-sync: the launcher file ${envFile} carries ${envLine.split('=')[0]}=... for checkouts outside the product's folder`);
  } else if (envLine) {
    say(`tracker-sync: checkouts outside the product's folder need this line in the agents' launcher: ${envLine}`);
  }
  writeConfig(flags, repoRoot, {
    recipe: CURRENT.recipe.path, tracker: CURRENT.recipe.tracker, ref: CURRENT.ref, repo: repoRoot,
    store: CURRENT.store, checkouts: unique, envFile: envFile || null, connectedAt: nowIso(),
    points: says, mechanismVersion: VERSION, mechanism: join(HERE, 'tracker-sync.mjs'),
  });
  say(`tracker-sync: connected ${unique.length} checkout(s) to ${CURRENT.store} on ${CURRENT.ref} (mechanism ${VERSION})`);
  } finally { release(); }
}

async function statusRun(flags) {
  const repoRoot = CURRENT.repoRoot;
  const release = await takeLockWait(5000);
  try {
  const cfg = readConfig(flags, repoRoot);
  const out = { recipe: CURRENT.recipe.path, tracker: CURRENT.recipe.tracker, ref: CURRENT.ref, store: CURRENT.store,
    mechanism: { path: join(HERE, 'tracker-sync.mjs'), version: VERSION }, recordings: 0, checks: [], queued: {}, errorClass: null };
  try {
    out.head = await headOid();
    const recs = join(CURRENT.store, '.tracker-sync', 'recordings');
    out.recordings = existsSync(recs) ? readdirSync(recs).filter((n) => n.endsWith('.jsonl')).length : 0;
    const remote = await fetchRemote();
    out.unreachable = !remote.ok;
    out.queued = { unpublished: null, behind: null };
    if (!remote.ok) { out.errorClass = 4; out.remote = null; out.said = remote.said.split('\n')[0]; }
    else if (remote.noRef) { out.remote = null; out.errorClass = 0; out.said = 'the remote has no store ref yet'; }
    else {
      out.remote = remote.tip;
      const ahead = (await git(['rev-list', '--count', `${remote.tip}..HEAD`], { cwd: CURRENT.store })).stdout.trim();
      const behind = (await git(['rev-list', '--count', `HEAD..${remote.tip}`], { cwd: CURRENT.store })).stdout.trim();
      out.ahead = Number(ahead); out.behind = Number(behind);
      out.queued = { unpublished: Number(ahead), behind: Number(behind) };
    }
    for (const c of cfg.checkouts || []) {
      const r = await recipe('pointer.check', { checkout: quote(c) }, { cwd: CURRENT.store });
      out.checks.push({ checkout: c, pointsAt: text(r).split('\n')[0] || null, ok: r.code === 0,
        variableOnly: /variable-only/.test(text(r)), said: text(r) });
    }
    const pid = (() => { try { return Number(readFileSync(pidPath(flags, repoRoot), 'utf8').trim()); } catch { return null; } })();
    const alive = pid ? (() => { try { process.kill(pid, 0); return true; } catch { return false; } })() : false;
    out.supervisor = { configured: !!cfg.supervisor || !!pid, alive, pid, lastTick: pid ? new Date(statSync(pidPath(flags, repoRoot)).mtimeMs).toISOString() : null };
    out.lastPublish = cfg.lastPublish || null; out.lastPublishOk = cfg.lastPublishOk ?? null;
    out.lastFetch = remote.ok ? nowIso() : cfg.lastFetch || null;
    out.lastSync = cfg.lastFetch || null;
    // How a project learns that its installed copy is older than the set's: the
    // copy reports the version it was installed from, and whoever has the set
    // compares it with the set's own (setup does this on every run, byte for
    // byte, and rewrites the copy and this version file).
    out.mechanism.installedAt = cfg.connectedAt || null;
    const expected = flags['expect-version'] ? String(flags['expect-version']) : cfg.expectedVersion;
    out.mechanism.update = !expected ? 'the set version is not named here'
      : expected === VERSION ? 'up to date with the set'
        : `older than the set (${expected}): rerun setup to refresh the copy`;
    out.points = cfg.points || null;
    out.config = { recipe: cfg.recipe, ref: cfg.ref, store: cfg.store, connectedAt: cfg.connectedAt || null };
    out.recipes = (await loadRecipes()).map((r) => ({ path: r.path, tracker: r.tracker || null, broken: r.broken || null }));
  } catch (e) { out.errorClass = 1; out.said = e.message; }
  if (flags.json) { say(JSON.stringify(out, null, 2)); return; }
  say(`recipe      ${basename(out.recipe)} (${out.tracker || 'tracker unnamed'})`);
  say(`ref         ${out.ref}`);
  say(`store       ${out.store}`);
  say(`head        ${out.head ? out.head.slice(0, 12) : 'none'}${out.remote ? `  remote ${out.remote.slice(0, 12)}` : '  remote none'}${out.unreachable ? '  UNREACHABLE' : ''}`);
  say(`queued      ${out.queued.unpublished ?? 0} local, ${out.queued.behind ?? 0} to take`);
  say(`recordings  ${out.recordings}`);
  say(`supervisor  ${out.supervisor?.alive ? `alive (pid ${out.supervisor.pid})` : 'not running'}`);
  say(`mechanism   ${out.mechanism.version}${out.mechanism.update ? `  (${out.mechanism.update})` : ''}`);
  for (const c of out.checks) say(`checkout    ${c.ok ? (c.variableOnly ? 'ok via variable' : 'ok') : 'NOT POINTED'}  ${c.checkout}  ${c.pointedAt}`);
  } finally { release(); }
}

async function exportRun(flags, pos) {
  const at = flags.at ? String(flags.at) : pos[0];
  if (at) {
    const f = join(CURRENT.store, '.tracker-sync', 'recordings', `${at}.jsonl`);
    if (!existsSync(f))
      die(1, `no recording for ${at}: the store never recorded that revision, so its state is unknown and is not guessed from a later state`);
    process.stdout.write(readFileSync(f, 'utf8'));
    return;
  }
  if (!flags.offline) {
    // syncOnce takes the store lock itself, around its local work only.
    const r = await syncOnce({ needsRemote: true, quiet: true });
    writeConfig(CURRENT.flags, CURRENT.repoRoot, { lastFetch: nowIso(), lastUnreachable: !!(r && r.unreachable) });
  } else {
    process.stderr.write("tracker-sync: --offline: this store is this machine's only and the other machines' state is not in it\n");
  }
  for (const p of stateFiles()) {
    const f = join(CURRENT.store, p);
    if (existsSync(f)) process.stdout.write(`=== ${p}\n${readFileSync(f, 'utf8')}${readFileSync(f, 'utf8').endsWith('\n') ? '' : '\n'}`);
  }
}

async function watchRun(flags) {
  const debounce = Number(flags.debounce ?? 2);
  const maxAge = Number(flags['max-age'] ?? 5);
  const interval = Number(flags.interval ?? 10);
  mkdirSync(machineDir(flags, CURRENT.repoRoot), { recursive: true });
  writeFileSync(pidPath(flags, CURRENT.repoRoot), String(process.pid));
  let stop = false;
  const onStop = () => { stop = true; };
  process.on('SIGINT', onStop); process.on('SIGTERM', onStop);
  say(`tracker-sync: watching ${CURRENT.store} (publish after ${debounce}s of quiet or ${maxAge}s at most, sync every ${interval}s)`);
  let firstChange = null; let lastChange = null; let lastDigest = '';
  // The pid file is touched every tick: its age is how a reader tells a live
  // watcher from a stale one.
  const heartbeat = setInterval(() => { try { const p = pidPath(flags, CURRENT.repoRoot); writeFileSync(p, String(process.pid)); } catch {} }, 5000);
  heartbeat.unref();
  const publishLoop = async () => {
    while (!stop) {
      // The lock covers the store's own work only; the push is a network call
      // and happens with the lock released, so a claim or a record from another
      // session is never made to wait on the watcher's network.
      let digest = null;
      try {
        digest = await locked(async () => {
          await recipeOk('export', {});
          if (!(await hasUncommittedState())) return null;
          return stateDigest();
        }, 20000);
      } catch (e) { say(`tracker-sync: the export failed: ${e.message}`); }
      if (digest === null) { firstChange = null; lastChange = null; lastDigest = ''; await sleep(1000); continue; }
      const t = Date.now();
      if (digest !== lastDigest) { lastDigest = digest; lastChange = t; if (firstChange === null) firstChange = t; }
      const ready = (t - lastChange) / 1000 >= debounce || (t - firstChange) / 1000 >= maxAge;
      if (ready) {
        const oid = await locked(async () => commitState(`tracker store: ${nowIso()}`, [await headOid()]), 20000);
        const res = await pushOid(oid, { quiet: true });
        writeConfig(flags, CURRENT.repoRoot, { lastPublish: nowIso(), lastPublishOk: !!res.ok });
        if (res.ok) {
          say(`tracker-sync: published ${oid.slice(0, 12)} (${((Date.now() - firstChange) / 1000).toFixed(1)}s after the first unpublished change)`);
          firstChange = null; lastChange = null; lastDigest = '';
        }
      }
      await sleep(1000);
    }
  };
  const syncLoop = async () => {
    while (!stop) {
      try { await syncOnce({ quiet: true }); } catch (e) { say(`tracker-sync: the sync failed: ${e.message}`); }
      await sleep(interval * 1000);
    }
  };
  await Promise.all([publishLoop(), syncLoop()]);
  clearInterval(heartbeat);
  try { unlinkSync(pidPath(flags, CURRENT.repoRoot)); } catch {}
  say('tracker-sync: watch stopped');
}
// ---- the command line -------------------------------------------------------

function usage(code = 1) {
  const t = [
    'usage: tracker-sync.mjs <command> [options]',
    '',
    'commands:',
    '  connect [--checkout <path>]... [--all] [--from-checkout <path>] [--launcher-file <path>] [--machine <name>] [--prefix <id prefix>] [--offline]',
    '  relink [--checkout <path>]...',
    '  publish [--watch] [--debounce <s>] [--max-age <s>]',
    '  sync [--interval <s>]',
    '  claim --item <id> --holder <holder>',
    '  transition --item <id> --to <status>',
    '  record --revision <rev> [--checkout <path>] [--from-tree]',
    '  export [--at <revision>] [--now] [--offline]',
    '  status [--json]',
    '  watch [--interval <s>] [--debounce <s>] [--max-age <s>]',
    '  recipes | version | help',
    '',
    'options:  --recipe <file>  --state <dir>  --repo <checkout>',
    'The recipe names the tracker; this mechanism never does. TRACKER_RECIPE is read too.',
  ].join('\n');
  (code === 0 ? say : (s) => process.stderr.write(`${s}\n`))(t);
  process.exit(code);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const { flags, pos } = parseArgs(argv.slice(1));
  CURRENT.flags = { ...flags };
  if (!cmd || cmd === 'help' || cmd === '--help') usage(cmd ? 0 : 1);
  if (cmd === 'version') { say(VERSION); return; }
  if (cmd === 'recipes') {
    const all = await loadRecipes();
    if (!all.length) { say('this copy ships no recipe'); return; }
    for (const r of all) say(`${r.broken ? 'broken' : (r.tracker || r.name)} ${r.path}${r.broken ? ` — ${r.broken}` : ''}`);
    return;
  }
  CURRENT.repoRoot = await repoRootOf(flags.repo ? String(flags.repo) : process.cwd());
  CURRENT.machineKey = await machineKeyOf(CURRENT.repoRoot);
  CURRENT.recipe = await resolveRecipe();
  CURRENT.ref = CURRENT.recipe.ref || DEFAULT_REF;
  // A ref a branch or a tag contains would put the tracker back inside the code
  // branches, which is what the layout exists to avoid, and would start code CI.
  if (/^refs\/(heads|tags)\//.test(CURRENT.ref))
    die(1, `the recipe names ${CURRENT.ref} as the store's ref, and a branch or a tag carries the store back into the code branches: name a ref no branch contains (refs/tracker/state by default)`);
  // Only connect creates the store: every other command attaches to it and
  // fails loudly, naming connect, where there is none.
  if (cmd !== 'connect') {
    const s = await ensureStore({ create: false });
    if (s.absent) die(1, `there is no store at ${s.store}: run connect first (it creates the store, points the checkouts at it and starts the sync)`);
  }
  switch (cmd) {
    case 'connect':
      await connectRun(flags);
      break;
    case 'relink':
      await relinkRun(flags);
      break;
    case 'publish': {
      // publishOnce takes the store lock itself, for its local work only.
      const r = await publishOnce({ quiet: false });
      if (flags.watch) { await watchRun(flags); break; }
      if (r.nothing) say('tracker-sync: nothing to publish');
      else if (r.ok) say(`tracker-sync: published ${String(r.oid).slice(0, 12)}`);
      else say('tracker-sync: the write is kept here and is published when the remote answers');
      break;
    }
    case 'sync': {
      if (flags.interval) { await watchRun(flags); break; }
      // syncOnce takes the store lock itself, around its local work only.
      const r = await syncOnce({ needsRemote: true, quiet: false });
      if (r.upToDate) say('tracker-sync: already in step with the remote');
      break;
    }
    case 'claim': {
      if (!flags.item || !flags.holder) usage(1);
      await conditional('claim', 'claim', { item: quote(String(flags.item)), holder: quote(String(flags.holder)) }, String(flags.item));
      break;
    }
    case 'transition': {
      if (!flags.item || !flags.to) usage(1);
      await conditional('transition', 'transition', {
        item: quote(String(flags.item)), to: quote(String(flags.to)),
        expect: quote(flags.expect ? String(flags.expect) : ''),
      }, String(flags.item));
      break;
    }
    case 'record':
      await recordRun({ revision: flags.revision ? String(flags.revision) : null, checkout: flags.checkout ? String(flags.checkout) : null, fromTree: !!flags['from-tree'] });
      break;
    case 'export':
      await exportRun(flags, pos);
      break;
    case 'status':
      await statusRun(flags);
      break;
    case 'watch':
      await watchRun(flags);
      break;
    default:
      process.stderr.write(`tracker-sync: unknown command ${cmd}\n`);
      usage(1);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))
  main().catch((e) => die(e.exitCode || 1, e && e.stack ? e.stack.split('\n')[0] : String(e)));
