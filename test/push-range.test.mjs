#!/usr/bin/env node
/**
 * The proof for the pre-push entry point — the set's "What a push introduces" —
 * over a REAL scratch git remote: a local bare repository in a temp directory,
 * never a network remote.
 *
 *   node test/push-range.test.mjs [--keep] [--scratch <dir>]
 *
 * One line per case with PASS/FAIL; the script exits non-zero when any case
 * fails. The scratch directory is removed at the end unless --keep.
 *
 * The documented entry point is the hook script this file writes into the
 * scratch clone's own hooks folder (HOOK_SRC). git gives pre-push ref lines on
 * stdin — <local ref> <local sha> <remote ref> <remote sha> — and the hook:
 * skips deletions and refs whose local and remote revisions are equal; peels a
 * tag to its commit; takes, for each pushed ref, the commits of its tip that no
 * ref the remote already has reaches; says "introduces no commits: nothing to
 * check" for a ref that introduces nothing; refuses a hook given no ref lines
 * and a range git cannot compute; and checks the introduced commits with the
 * real check skills/backlog/setup-shady2k-skills/check-commits.mjs.
 *
 * What is proved (skills-ijyk, GitHub #29): a ref the remote has whose object is
 * NOT in this clone cannot be an ancestor of any local commit, so it bounds
 * nothing and is skipped. Passing it to `git rev-list <tip> --not <hashes...>`
 * instead makes git answer "fatal: bad object <hash>" and the hook refuse a push
 * whose range it could compute. Case 1 asserts the OLD recipe refuses and the
 * FIXED recipe passes, in the deliberate-break style of test/tracker-sync-proof.mjs,
 * so removing the skip makes this proof fail.
 *
 * The project's adapter owns the real message parsing. Here the task id is read
 * from the conventional-commit scope, the way this repository names items
 * (`fix(skills-ijyk): ...`); the scratch repository's messages follow it.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKTREE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const CHECK_COMMITS = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/check-commits.mjs');
const KEEP = process.argv.includes('--keep');
const SCRATCH = (() => {
  const i = process.argv.indexOf('--scratch');
  return i >= 0 ? resolve(process.argv[i + 1]) : `/tmp/push-range-proof-${process.pid}`;
})();

// A CI runner, a container and a fresh machine have no git user.name or
// user.email and no git configuration at all, so this proof runs the way such a
// machine does: no global or system git config, and an empty home directory. The
// commits and tags here name an identity of their own with -c, never through the
// user's configuration.
const CLEAN_HOME = join(process.env.TMPDIR || '/tmp', `push-range-proof-home-${process.pid}`);
mkdirSync(CLEAN_HOME, { recursive: true });
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.HOME = CLEAN_HOME;
delete process.env.GIT_AUTHOR_NAME; delete process.env.GIT_AUTHOR_EMAIL;
delete process.env.GIT_COMMITTER_NAME; delete process.env.GIT_COMMITTER_EMAIL;
delete process.env.XDG_CONFIG_HOME;

// ---------------------------------------------------------------- results
const results = [];
let failCount = 0;
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  if (!ok) failCount++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + detail : ''}`);
}

// ------------------------------------------------------------------ helpers
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd, input: opts.input,
    env: { ...process.env, ...(opts.env || {}) }, encoding: 'utf8',
  });
  return {
    code: r.status === null ? 127 : r.status,
    out: (r.stdout || '') + (r.stderr || ''),
    stdout: r.stdout || '', stderr: r.stderr || '',
  };
}
function git(cwd, args, opts = {}) { return sh('git', ['-C', cwd, ...args], opts); }
function commit(cwd, message) {
  return git(cwd, ['-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', message]);
}
function tag(cwd, name, message) {
  return git(cwd, ['-c', 'user.name=proof', '-c', 'user.email=proof@local', 'tag', '-a', name, '-m', message]);
}
function rev(cwd, ref) {
  const r = git(cwd, ['rev-parse', '--verify', '--quiet', ref]);
  return r.code === 0 ? r.stdout.trim() : null;
}
// is this clone able to name the object? (the premise of the whole proof)
function hasObject(cwd, sha) { return git(cwd, ['cat-file', '-e', sha + '^{commit}']).code === 0; }
function short(sha) { return sha ? sha.slice(0, 12) : '(none)'; }
function oneLine(text) { return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' | '); }

// ------------------------------------------------- the documented entry point
// The skip condition is kept as its own text: HOOK_SRC is built from it, and the
// deliberate break in case 1 targets the same text, so a proof whose skip was
// removed cannot build its old recipe and fails instead of passing quietly.
const SKIP_CONDITION = "git(['cat-file', '-e', sha + '^{commit}']).status === 0";
const SKIP_SRC = [
  '  // THE SKIP: a ref the remote has whose object is not in this clone cannot be an',
  '  // ancestor of any local commit, so it bounds nothing and is left out of --not.',
  '  if (' + SKIP_CONDITION + ') hashes.push(sha);',
].join('\n');
// the OLD recipe of skills-ijyk / GitHub #29, built by breaking the condition
// above: every hash the remote names is handed to rev-list --not, whether or not
// this clone holds its object
const OLD_CONDITION = 'true /* the OLD recipe: every hash the remote names is handed to rev-list --not */';

const HOOK_HEAD = `#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The documented pre-push entry point ("What a push introduces").
//
// git gives the ref lines on stdin: <local ref> <local sha> <remote ref>
// <remote sha>. For each pushed ref: the commits of its tip (a tag peeled to its
// commit) that no ref the remote already has reaches.
//
// A ref the remote has whose object is NOT in this clone (git cat-file -e
// <sha>^{commit} fails) cannot be an ancestor of any local commit: it bounds
// nothing and is skipped, never handed to rev-list --not. Handing it over is the
// defect of skills-ijyk / GitHub #29, where every push was refused with
// "fatal: bad object <hash>" because the remote carried merge-request refs whose
// commits the clone had never fetched.
//
// The project's adapter owns the real message parsing; here the task id is the
// conventional-commit scope, the way this repository names items.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const ZERO = '0000000000000000000000000000000000000000';
const remoteUrl = process.argv[3] || 'origin';
const issuesPath = process.env.PUSH_RANGE_ISSUES;
const checkPath = process.env.PUSH_RANGE_CHECK;

function git(args) { return spawnSync('git', args, { encoding: 'utf8' }); }

const lines = fs.readFileSync(0, 'utf8').split('\\n').map((l) => l.trim()).filter(Boolean);
if (!lines.length) {
  console.error('pre-push: no ref lines on stdin: a push that introduces nothing is not a push to check');
  process.exit(1);
}
if (!issuesPath || !checkPath) {
  console.error('pre-push: the project adapter has not supplied the task list or the commit check; run the connect command');
  process.exit(1);
}

// every ref the remote already has, minus those whose object is not here
const ls = git(['ls-remote', '--refs', remoteUrl]);
if (ls.status !== 0) {
  process.stderr.write(ls.stderr || '');
  console.error('pre-push: the remote ' + remoteUrl + ' could not be read, so what this push introduces is unknown');
  process.exit(1);
}
const hashes = [];
for (const line of ls.stdout.split('\\n').map((l) => l.trim()).filter(Boolean)) {
  const sha = line.split(/\\s+/)[0];
`;

const HOOK_TAIL = `
}

const introduced = new Map();
for (const line of lines) {
  const [localRef, localSha, remoteRef, remoteSha] = line.split(/\\s+/);
  if (localSha === ZERO) continue;       // a deletion introduces nothing
  if (localSha === remoteSha) continue;  // the remote already has this revision
  const peel = git(['rev-parse', '--verify', '--quiet', localSha + '^{commit}']);
  if (peel.status !== 0) {
    console.error('pre-push: ' + localRef + ' (' + localSha + ') is not a commit');
    process.exit(1);
  }
  const tip = peel.stdout.trim();
  // A range git cannot compute is refused: what the push introduces is unknown.
  const range = hashes.length ? git(['rev-list', tip, '--not', ...hashes]) : git(['rev-list', tip]);
  if (range.status !== 0) {
    process.stderr.write(range.stderr || '');
    console.error('pre-push: the range of ' + localRef + ' cannot be computed, so what it introduces is unknown');
    process.exit(1);
  }
  const commits = range.stdout.split('\\n').map((s) => s.trim()).filter(Boolean);
  if (!commits.length) {
    console.log('introduces no commits: nothing to check (' + localRef + ')');
    continue;
  }
  for (const sha of commits) introduced.set(sha, localRef);
}
if (!introduced.size) process.exit(0);

// The project's adapter owns the real message parsing: here the task id is the
// conventional-commit scope (fix(skills-ijyk): ...).
const taskIds = (subject) => {
  const m = /\\(([^()]+)\\)!?:/.exec(subject);
  return m ? [m[1]] : [];
};
const commits = [];
for (const sha of introduced.keys()) {
  commits.push({ id: sha, taskIds: taskIds(git(['log', '-1', '--format=%s', sha]).stdout.trim()) });
}
const supplied = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
const issues = Array.isArray(supplied) ? supplied : supplied.issues;
const checked = spawnSync(process.execPath, [checkPath, '-'],
  { input: JSON.stringify({ issues, commits }), encoding: 'utf8' });
process.stdout.write(checked.stdout || '');
process.stderr.write(checked.stderr || '');
if (checked.status !== 0) {
  console.error('pre-push: the commits this push introduces are refused (exit ' + checked.status + ')');
  process.exit(1);
}
process.exit(0);
`;

const HOOK_SRC = HOOK_HEAD + SKIP_SRC + HOOK_TAIL;

// a break by a plain string, no regex metacharacters (the house style of
// test/tracker-sync-proof.mjs): the same text must be in the source, so a proof
// whose skip was removed fails here instead of passing quietly
function breakByLiteral(name, srcText, pattern, replacement) {
  if (!srcText.includes(pattern)) {
    throw new Error('break ' + name + ': the text was not found in the source, so the old recipe cannot be built (is the skip still in HOOK_SRC?)');
  }
  return srcText.split(pattern).join(replacement);
}

// ------------------------------------------------------------- the repository
function plantRemoteOnlyRef(ctx) {
  // a second clone pushes a commit to a ref outside refs/heads and refs/tags:
  // the remote names it, the first clone has never fetched its object
  const b = ctx.cloneB;
  writeFileSync(join(b, 'merge-request.txt'), 'a commit the first clone never fetches\n');
  git(b, ['add', '.']);
  const made = commit(b, 'chore(proof): a merge request the first clone never fetches');
  if (made.code !== 0) throw new Error('the merge-request commit failed: ' + made.out);
  const sha = rev(b, 'HEAD');
  const pushed = git(b, ['push', '-q', 'origin', 'HEAD:refs/merge-requests/1/merge']);
  if (pushed.code !== 0) throw new Error('the merge-request push failed: ' + pushed.out);
  return sha;
}

function boot() {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });
  const remote = join(SCRATCH, 'remote.git');
  const init = sh('git', ['init', '--bare', '--initial-branch', 'main', '-q', remote]);
  if (init.code !== 0) throw new Error('the scratch remote could not be made: ' + init.out);
  const cloneA = join(SCRATCH, 'clone-a');
  const clonedA = sh('git', ['clone', '-q', remote, cloneA]);
  if (clonedA.code !== 0) throw new Error('the first clone failed: ' + clonedA.out);
  writeFileSync(join(cloneA, 'README.md'), 'the scratch repository\n');
  git(cloneA, ['add', '.']);
  const seeded = commit(cloneA, 'chore(proof): seed the scratch repository');
  if (seeded.code !== 0) throw new Error('the seed commit failed: ' + seeded.out);
  const seedPush = git(cloneA, ['push', '-q', 'origin', 'HEAD:refs/heads/main']);
  if (seedPush.code !== 0) throw new Error('the seed push failed: ' + seedPush.out);
  const cloneB = join(SCRATCH, 'clone-b');
  const clonedB = sh('git', ['clone', '-q', remote, cloneB]);
  if (clonedB.code !== 0) throw new Error('the second clone failed: ' + clonedB.out);

  const issuesPath = join(SCRATCH, 'issues.json');
  writeFileSync(issuesPath, JSON.stringify({ issues: [
    { id: 'skills-ijyk', type: 'bug' },
    { id: 'skills-proof', type: 'task' },
  ] }, null, 1) + '\n');

  // the hook lives in the clone's own hooks folder: a real hooks folder, and a
  // real `git push` runs it
  const hookPath = join(cloneA, '.git', 'hooks', 'pre-push');
  mkdirSync(dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, HOOK_SRC);
  chmodSync(hookPath, 0o755);

  const ctx = { remote, cloneA, cloneB, issuesPath, hookPath };
  ctx.mergeRequestSha = plantRemoteOnlyRef(ctx);
  return ctx;
}

function push(ctx, args, opts = {}) {
  const env = { PUSH_RANGE_ISSUES: ctx.issuesPath, PUSH_RANGE_CHECK: CHECK_COMMITS };
  const cfg = opts.hooksPath ? ['-c', 'core.hooksPath=' + opts.hooksPath] : [];
  return git(opts.cwd || ctx.cloneA, [...cfg, 'push', ...args], { env });
}

// ---------------------------------------------------------------- the cases
function caseOne(ctx) {
  const id = '1-old-recipe-refuses-with-bad-object';
  const fixedId = '1-fixed-recipe-passes';
  // the premise: the remote names a ref whose object this clone does not have
  const listed = /refs\/merge-requests\/1\/merge/.test(git(ctx.cloneA, ['ls-remote', '--refs', ctx.remote]).stdout);
  const absent = !hasObject(ctx.cloneA, ctx.mergeRequestSha);
  // a linked commit on the branch the remote already has
  writeFileSync(join(ctx.cloneA, 'linked.txt'), 'a linked commit\n');
  git(ctx.cloneA, ['add', '.']);
  const made = commit(ctx.cloneA, 'fix(skills-ijyk): a linked commit on a branch the remote has');
  if (made.code !== 0) {
    record(id, false, 'the linked commit failed: ' + oneLine(made.out));
    record(fixedId, false, 'the linked commit failed: ' + oneLine(made.out));
    return;
  }
  const linked = rev(ctx.cloneA, 'HEAD');

  // the old recipe, built by breaking the skip out of the same source: a proof
  // whose skip was removed fails here, and fails the fixed half below
  let oldSrc = null;
  try { oldSrc = breakByLiteral('old-recipe', HOOK_SRC, SKIP_CONDITION, OLD_CONDITION); }
  catch (error) { record(id, false, error.message); }
  if (oldSrc) {
    const oldDir = join(SCRATCH, 'hooks-old');
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, 'pre-push'), oldSrc);
    chmodSync(join(oldDir, 'pre-push'), 0o755);
    const oldPush = push(ctx, ['origin', 'main'], { hooksPath: oldDir });
    const refused = oldPush.code !== 0 && /fatal: bad object/.test(oldPush.out);
    record(id, listed && absent && refused,
      'the remote ref is listed: ' + listed + ', its object is absent here: ' + absent
      + ', the old recipe exit ' + oldPush.code + ': ' + oneLine(oldPush.out));
  }

  const fixedPush = push(ctx, ['origin', 'main']);
  const landed = rev(ctx.remote, 'refs/heads/main') === linked;
  record(fixedId, fixedPush.code === 0 && landed,
    'the fixed recipe exit ' + fixedPush.code + ', ' + short(linked) + ' on the remote: ' + landed
    + (fixedPush.code === 0 ? '' : ': ' + oneLine(fixedPush.out)));
}

function caseTwo(ctx) {
  // a linked push passes while that remote ref is still present
  const checkedOut = git(ctx.cloneA, ['checkout', '-q', '-b', 'feature-two']);
  if (checkedOut.code !== 0) { record('2-linked-push-passes', false, 'the branch failed: ' + checkedOut.out); return; }
  writeFileSync(join(ctx.cloneA, 'linked-two.txt'), 'a second linked commit\n');
  git(ctx.cloneA, ['add', '.']);
  const made = commit(ctx.cloneA, 'fix(skills-ijyk): a second linked commit on a new branch');
  if (made.code !== 0) { record('2-linked-push-passes', false, 'the linked commit failed: ' + oneLine(made.out)); return; }
  const sha = rev(ctx.cloneA, 'HEAD');
  const r = push(ctx, ['origin', 'feature-two']);
  const landed = rev(ctx.remote, 'refs/heads/feature-two') === sha;
  const stillListed = /refs\/merge-requests\/1\/merge/.test(git(ctx.cloneA, ['ls-remote', '--refs', ctx.remote]).stdout);
  const stillAbsent = !hasObject(ctx.cloneA, ctx.mergeRequestSha);
  record('2-linked-push-passes', r.code === 0 && landed && stillListed && stillAbsent,
    'exit ' + r.code + ', ' + short(sha) + ' on the remote: ' + landed
    + ', the remote-only ref is still listed: ' + stillListed + ' and still absent here: ' + stillAbsent
    + (r.code === 0 ? '' : ': ' + oneLine(r.out)));
}

function caseThree(ctx) {
  // a tag, and a new branch, on a commit the remote already holds
  const held = rev(ctx.cloneA, 'HEAD'); // on the remote as refs/heads/feature-two
  const branched = git(ctx.cloneA, ['branch', 'alias']);
  const tagged = tag(ctx.cloneA, 'v-proof', 'the proof tag');
  if (branched.code !== 0 || tagged.code !== 0) {
    record('3-tag-and-new-branch-introduce-nothing', false, 'the branch or the tag failed: ' + oneLine(branched.out + tagged.out));
    return;
  }
  const r = push(ctx, ['origin', 'alias', 'v-proof']);
  const said = (r.out.match(/introduces no commits: nothing to check/g) || []).length;
  const alias = rev(ctx.remote, 'refs/heads/alias') === held;
  const tagOnRemote = rev(ctx.remote, 'refs/tags/v-proof') !== null;
  record('3-tag-and-new-branch-introduce-nothing', r.code === 0 && said >= 2 && alias && tagOnRemote,
    'exit ' + r.code + ', "nothing to check" said ' + said + ' times for ' + short(held)
    + ' (the remote holds it), alias on the remote: ' + alias + ', tag on the remote: ' + tagOnRemote
    + (r.code === 0 ? '' : ': ' + oneLine(r.out)));
}

function caseFour(ctx) {
  // an unlinked new commit on a pushed branch is still refused
  const checkedOut = git(ctx.cloneA, ['checkout', '-q', '-b', 'unlinked']);
  if (checkedOut.code !== 0) { record('4-unlinked-new-commit-refused', false, 'the branch failed: ' + checkedOut.out); return; }
  writeFileSync(join(ctx.cloneA, 'unlinked.txt'), 'a commit with no task link\n');
  git(ctx.cloneA, ['add', '.']);
  const made = commit(ctx.cloneA, 'fix: a commit with no task link');
  if (made.code !== 0) { record('4-unlinked-new-commit-refused', false, 'the commit failed: ' + oneLine(made.out)); return; }
  const r = push(ctx, ['origin', 'unlinked']);
  const refused = r.code !== 0 && /no task link/.test(r.out);
  const notOnRemote = rev(ctx.remote, 'refs/heads/unlinked') === null;
  const said = (r.out.match(/"reason": "[^"]+"/) || ['(no reason was given)'])[0];
  record('4-unlinked-new-commit-refused', refused && notOnRemote,
    'exit ' + r.code + ', it never reached the remote: ' + notOnRemote + ', the check said ' + said);
}

function caseFive(ctx) {
  // a hook given no ref lines is refused (git never sends an empty stdin; the
  // entry point is called the way a caller with nothing to say would call it)
  const r = sh(ctx.hookPath, [], {
    cwd: ctx.cloneA, input: '',
    env: { PUSH_RANGE_ISSUES: ctx.issuesPath, PUSH_RANGE_CHECK: CHECK_COMMITS },
  });
  record('5-no-ref-lines-refused', r.code === 1 && /no ref lines/.test(r.out),
    'exit ' + r.code + ', out: ' + oneLine(r.out));
}

// --------------------------------------------------------------------- main
function main() {
  const ctx = boot();
  caseOne(ctx);
  caseTwo(ctx);
  caseThree(ctx);
  caseFour(ctx);
  caseFive(ctx);
}

try {
  main();
} catch (error) {
  record('scratch-repository', false, 'the proof could not be set up: ' + error.message);
} finally {
  if (!KEEP) {
    rmSync(SCRATCH, { recursive: true, force: true });
    rmSync(CLEAN_HOME, { recursive: true, force: true });
  } else {
    console.log('kept: ' + SCRATCH);
  }
}

if (!results.length) {
  console.error('push-range-proof: no case ran at all');
  process.exitCode = 2;
} else {
  process.exitCode = failCount ? 1 : 0;
}
