import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { newCtx, bringUp, mech, storeOf, post, stopAllWatchers } from './tracker-sync-proof.mjs';

// A recording is the one history a revision will ever have: the gate reads it
// with --at, and the baseline under block-new compares against it. So a record
// that timed out at commit time is redone with the state the revision had then,
// never a later one - and a marker that saved no state refuses the redo instead
// of inventing it.

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function ok(result, label) {
  assert.equal(result.code, 0, `${label}: ${result.out}`);
  return result;
}

function commit(ctx, message) {
  git(ctx.codeA, 'add', '.');
  git(ctx.codeA, '-c', 'user.name=proof', '-c', 'user.email=proof@local',
    '-c', 'core.hooksPath=/nonexistent-hooks', 'commit', '-qm', message);
  return git(ctx.codeA, 'rev-parse', 'HEAD');
}

const stateFileOf = (store) => join(store, 'fake', 'items.jsonl');
const markerOf = (ctx, revision) => join(ctx.stateA, 'record-timeouts', `${revision}.json`);

// A live holder of the store lock, so the hook's record exhausts its three
// bounded waits exactly as a hook does when another command holds the store.
function holdLock(ctx) {
  const lock = join(ctx.stateA, 'lock');
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, `owner-${process.pid}-recovery.json`),
    JSON.stringify({ pid: process.pid, at: new Date().toISOString(), token: 'held-by-the-recovery-proof' }) + '\n');
  return () => rmSync(lock, { recursive: true, force: true });
}

const exportedAt = (ctx, revision) => mech(ctx, 'export', ['--at', revision, '--offline']);

function assertNoRecording(ctx, revision) {
  const store = storeOf(ctx, 'A');
  assert.equal(existsSync(join(store, '.tracker-sync', 'recordings', `${revision}.jsonl`)), false,
    'a refused redo must not invent a recording');
  const remote = spawnSync('git', ['-C', ctx.remote, 'cat-file', '-e',
    `refs/tracker/state:.tracker-sync/recordings/${revision}.jsonl`], { encoding: 'utf8' });
  assert.equal(remote.status, 128, 'a refused redo must not publish a recording');
}

// The later write, at unchanged code HEAD, made the store's published state:
// exactly what a retry that captured "now" would record under the old revision.
function writeLaterState(ctx, text) {
  ok(post(ctx, 'A', 'i-1', text), 'later tracker write');
  ok(mech(ctx, 'publish', [], { machine: 'A' }), 'publish the later write');
  return readFileSync(stateFileOf(storeOf(ctx, 'A')), 'utf8');
}

test('a redo of a timed-out hook record keeps the state the revision had at commit time', async () => {
  const ctx = newCtx('recording-timeout-exact');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    // The state the revision has now, read the way a reader reads a recording.
    const atCommit = ok(mech(ctx, 'export', ['--now', '--offline']), 'the state at the commit').stdout;
    const pinned = git(store, 'rev-parse', 'HEAD');
    const release = holdLock(ctx);
    let timeout;
    try {
      // The real mechanism, the real bounds: no shortened clocks, no patched copy.
      timeout = mech(ctx, 'record', ['--hook', '--revision', revision, '--checkout', ctx.codeA]);
    } finally { release(); }
    assert.equal(timeout.code, 1, timeout.out);
    assert.match(timeout.out, /timed out/i);
    assertNoRecording(ctx, revision);
    const marker = JSON.parse(readFileSync(markerOf(ctx, revision), 'utf8'));
    assert.equal(marker.revision, revision);
    assert.equal(marker.commit, pinned, 'the marker must name the store commit whose tree is the state the revision had');

    // At unchanged HEAD the tracker moves on, and the store publishes it: the
    // later state is the store's head now, so a retry that captured "now" would
    // write it as this revision's permanent history.
    const later = writeLaterState(ctx, 'written after the timeout, at unchanged HEAD');
    assert.match(later, /written after the timeout/);
    assert.equal(git(ctx.codeA, 'rev-parse', 'HEAD'), revision);
    assert.notEqual(git(store, 'rev-parse', 'HEAD'), pinned);

    const said = exportedAt(ctx, revision);
    assert.equal(said.code, 1, said.out);
    assert.match(said.out, /timed out at commit time/);
    assert.match(said.out, new RegExp(pinned.slice(0, 12)), 'the push names the state the marker kept');
    assert.match(said.out, /record --revision/, 'and the command that restores exactly that state');

    ok(mech(ctx, 'record', ['--revision', revision, '--checkout', ctx.codeA]), 'the redo');
    assert.equal(existsSync(markerOf(ctx, revision)), false, 'a successful record clears the marker');
    const replayed = ok(exportedAt(ctx, revision), 'the redone recording');
    assert.equal(replayed.stdout, atCommit, 'the redo records the commit-time state, byte for byte');
    assert.doesNotMatch(replayed.stdout, /written after the timeout/, 'a later write is not that revision');
    assert.equal(readFileSync(stateFileOf(store), 'utf8'), later, 'the redo must not roll the tracker back');
    const remoteRecording = spawnSync('git', ['-C', ctx.remote, 'show',
      `refs/tracker/state:.tracker-sync/recordings/${revision}.jsonl`], { encoding: 'utf8' });
    assert.equal(remoteRecording.status, 0, 'the redone recording is published');
    assert.match(remoteRecording.stdout, new RegExp(pinned), 'and it names the pinned store commit');
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('a marker that saved no state refuses the redo and names the ways out', async () => {
  const ctx = newCtx('recording-timeout-legacy-marker');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    mkdirSync(join(ctx.stateA, 'record-timeouts'), { recursive: true });
    // Exactly what 0.132.0 wrote: a timeout, its evidence, and a command that
    // would record today's state under the old revision.
    const legacyCommand = `node old-tracker-sync.mjs record --revision ${revision}`;
    writeFileSync(markerOf(ctx, revision), JSON.stringify({
      revision, at: new Date().toISOString(), said: 'the store lock was held elsewhere', command: legacyCommand,
    }) + '\n');
    const later = writeLaterState(ctx, 'later state under an old marker');
    assert.match(later, /later state under an old marker/);

    for (const [name, args] of [
      ['explicit redo', ['--revision', revision]],
      ['implicit HEAD redo', []],
      ['hook redo', ['--hook', '--revision', revision]],
    ]) {
      const result = mech(ctx, 'record', [...args, '--checkout', ctx.codeA]);
      assert.equal(result.code, 1, `${name}: ${result.out}`);
      assert.match(result.out, /make a new commit/i, `${name}: a way out is named`);
      assert.match(result.out, /sync/i, `${name}: the other way out is named`);
      assert.doesNotMatch(result.out, /old-tracker-sync/, `${name}: an old marker's command is not recovery advice`);
      assertNoRecording(ctx, revision);
      assert.equal(existsSync(markerOf(ctx, revision)), true, `${name}: a refusal never clears the marker`);
      assert.equal(readFileSync(stateFileOf(store), 'utf8'), later, `${name}: a refusal writes no tracker state`);
    }
    const said = exportedAt(ctx, revision);
    assert.equal(said.code, 1, said.out);
    assert.equal(said.stdout, '', 'a state that was never captured is never exported');
    assert.match(said.out, /make a new commit/i);
    assert.match(said.out, /sync/i);
    assert.doesNotMatch(said.out, /old-tracker-sync/);
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('a marker that arrives while a manual record waits is recorded instead of the run’s later capture', async () => {
  const ctx = newCtx('recording-timeout-during-wait');
  let child;
  let exited;
  let timer;
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    const atCommit = ok(mech(ctx, 'export', ['--now', '--offline']), 'the state at the commit').stdout;
    const pinned = git(store, 'rev-parse', 'HEAD');
    const release = holdLock(ctx);
    let output = '';
    child = spawn(process.execPath, [ctx.mech, 'record', '--recipe', ctx.recipe, '--state', ctx.stateA,
      '--repo', ctx.codeA, '--checkout', ctx.codeA, '--revision', revision],
    { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe }, stdio: ['ignore', 'pipe', 'pipe'] });
    exited = new Promise((resolve) => child.once('close', (code) => resolve(code)));
    await new Promise((resolve, reject) => {
      // A real diagnostic is the barrier: the run has fetched and is waiting for
      // the store lock, which is where a hook's marker reaches it.
      const observe = (chunk) => {
        output += chunk.toString();
        if (/waiting for the store lock/.test(output)) { clearTimeout(timer); resolve(); }
      };
      child.stdout.on('data', observe);
      child.stderr.on('data', observe);
      child.once('error', reject);
      timer = setTimeout(() => reject(new Error(`record never reported its lock wait: ${output}`)), 20000);
    });
    // The hook gave up at this moment: its marker keeps the state the store had.
    mkdirSync(join(ctx.stateA, 'record-timeouts'), { recursive: true });
    writeFileSync(markerOf(ctx, revision), JSON.stringify({
      revision, at: new Date().toISOString(), said: 'the store lock was held elsewhere', commit: pinned,
      command: `node tracker-sync.mjs record --revision ${revision}`,
    }) + '\n');
    // The lock holder is what a publish is: it exports and commits the write, so
    // the store's head moves on while the run waits, and a run that captured
    // "now" after taking the lock would record that later state.
    ok(post(ctx, 'A', 'i-1', 'tracker state changed while the record waited'), 'later write');
    const later = readFileSync(stateFileOf(store), 'utf8');
    assert.match(later, /changed while the record waited/);
    git(store, 'add', 'fake/items.jsonl');
    git(store, '-c', 'user.name=proof', '-c', 'user.email=proof@local',
      '-c', 'core.hooksPath=/nonexistent-hooks', 'commit', '-qm', 'the lock holder publishes the later write');
    assert.notEqual(git(store, 'rev-parse', 'HEAD'), pinned);
    release();
    assert.equal(await exited, 0, output);
    const replayed = ok(exportedAt(ctx, revision), 'the recording the waiting run made');
    assert.equal(replayed.stdout, atCommit, 'it recorded the marker’s commit, not its own later capture');
    assert.doesNotMatch(replayed.stdout, /changed while the record waited/);
    assert.equal(readFileSync(stateFileOf(store), 'utf8'), later);
    assert.equal(existsSync(markerOf(ctx, revision)), false, 'the record that succeeds clears the marker');
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    if (exited) await exited;
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('an abbreviated key replays its own recording and finds the full id’s marker', async () => {
  const ctx = newCtx('recording-timeout-abbreviated');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    // A state-bearing commit, so --from-tree reads a tree the store holds.
    mkdirSync(join(ctx.codeA, 'fake'), { recursive: true });
    const originalState = readFileSync(stateFileOf(store), 'utf8');
    writeFileSync(join(ctx.codeA, 'fake', 'items.jsonl'), originalState);
    const revision = commit(ctx, 'a state-bearing revision recorded by short name');
    const short = revision.slice(0, 12);
    git(store, 'fetch', ctx.codeA, revision);
    ok(mech(ctx, 'record', ['--revision', short, '--checkout', ctx.codeA, '--from-tree']), 'short-name recording');
    const recordingPath = join(store, '.tracker-sync', 'recordings', `${short}.jsonl`);
    const recording = readFileSync(recordingPath, 'utf8');
    const expected = ok(exportedAt(ctx, short), 'short-name export').stdout;

    // The later state, then a timeout marker keyed by the FULL id: the marker and
    // the recording are about one revision, whichever name each one uses.
    const later = writeLaterState(ctx, 'later live state after a short-name recording');
    mkdirSync(join(ctx.stateA, 'record-timeouts'), { recursive: true });
    writeFileSync(markerOf(ctx, revision), JSON.stringify({
      revision, at: new Date().toISOString(), said: 'the lock was held', commit: git(store, 'rev-parse', 'HEAD'),
      command: `node tracker-sync.mjs record --revision ${revision}`,
    }) + '\n');
    const replay = ok(mech(ctx, 'record', ['--revision', short, '--checkout', ctx.codeA, '--from-tree']), 'short-name replay');
    assert.match(replay.out, /already recorded/i, 'a recording is written once and never moved');
    assert.equal(readFileSync(recordingPath, 'utf8'), recording, 'the existing recording is immutable');
    assert.equal(ok(exportedAt(ctx, short), 'replayed export').stdout, expected);
    assert.equal(readFileSync(stateFileOf(store), 'utf8'), later);
    assert.equal(existsSync(markerOf(ctx, revision)), false, 'the replay clears the marker of the same revision');
    assertNoRecording(ctx, revision);
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('a linked checkout’s marker is found at the revision it was written for', async () => {
  const ctx = newCtx('recording-timeout-linked');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const rootRevision = git(ctx.codeA, 'rev-parse', 'HEAD');
    const linked = join(ctx.scratch, 'linked-checkout');
    git(ctx.codeA, '-c', 'core.hooksPath=/nonexistent-hooks', 'worktree', 'add', '--detach', linked, rootRevision);
    // A commit of the linked checkout that carries the state files, so --from-tree
    // reads a state: the question here is the marker, not a missing state file.
    mkdirSync(join(linked, 'fake'), { recursive: true });
    writeFileSync(join(linked, 'fake', 'items.jsonl'), readFileSync(stateFileOf(store), 'utf8'));
    writeFileSync(join(linked, 'linked.txt'), 'a commit only the linked checkout has\n');
    const requested = commit({ ...ctx, codeA: linked }, 'linked checkout moves ahead');
    assert.notEqual(requested, rootRevision);
    mkdirSync(join(ctx.stateA, 'record-timeouts'), { recursive: true });
    // A marker for the linked checkout's HEAD, with no state: this checkout's
    // revision is the one refused, and it is found there, not at the root.
    writeFileSync(markerOf(ctx, requested), JSON.stringify({
      revision: requested, at: new Date().toISOString(), said: 'the lock was held elsewhere',
    }) + '\n');
    const refused = mech(ctx, 'record', ['--revision', 'HEAD', '--checkout', linked, '--from-tree']);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /make a new commit/i);
    for (const alias of ['HEAD', requested, requested.slice(0, 12), rootRevision, rootRevision.slice(0, 12)])
      assertNoRecording(ctx, alias);
    // A marker for another revision does not refuse this one: resolution happens
    // in the checkout the person asked about.
    rmSync(markerOf(ctx, requested), { force: true });
    writeFileSync(markerOf(ctx, rootRevision), JSON.stringify({
      revision: rootRevision, at: new Date().toISOString(), said: 'the lock was held elsewhere',
    }) + '\n');
    const done = mech(ctx, 'record', ['--revision', 'HEAD', '--checkout', linked, '--from-tree']);
    assert.equal(done.code, 0, done.out);
    assert.equal(existsSync(markerOf(ctx, requested)), false, 'still no marker for the linked revision');
    assertNoRecording(ctx, requested);
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('a repeated timeout keeps the first state, and no marker outlives a recording', async () => {
  const ctx = newCtx('recording-timeout-repeated');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    const first = git(store, 'rev-parse', 'HEAD');
    let release = holdLock(ctx);
    try { mech(ctx, 'record', ['--hook', '--revision', revision, '--checkout', ctx.codeA]); } finally { release(); }
    assert.equal(JSON.parse(readFileSync(markerOf(ctx, revision), 'utf8')).commit, first);
    // The store moves on, and the hook is asked again: the second timeout names
    // the state NOW, and must not replace the earlier evidence with it.
    writeLaterState(ctx, 'later state between two timeouts');
    assert.notEqual(git(store, 'rev-parse', 'HEAD'), first);
    release = holdLock(ctx);
    try { mech(ctx, 'record', ['--hook', '--revision', revision, '--checkout', ctx.codeA]); } finally { release(); }
    assert.equal(JSON.parse(readFileSync(markerOf(ctx, revision), 'utf8')).commit, first,
      'the first marker is the evidence closest to the commit, and a later one may not replace it');
    // A recording made once needs no marker, and a hook that times out afterwards
    // must not leave one behind it.
    ok(mech(ctx, 'record', ['--revision', revision, '--checkout', ctx.codeA]), 'the redo');
    assert.equal(existsSync(markerOf(ctx, revision)), false);
    release = holdLock(ctx);
    try { mech(ctx, 'record', ['--hook', '--revision', revision, '--checkout', ctx.codeA]); } finally { release(); }
    assert.equal(existsSync(markerOf(ctx, revision)), false, 'a marker must not outlive a recording another run already made');
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});
