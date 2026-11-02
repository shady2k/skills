import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { newCtx, bringUp, mech, storeOf, post, stopAllWatchers } from './tracker-sync-proof.mjs';

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

function assertUnknown(ctx, revision, legacyCommand) {
  const result = mech(ctx, 'export', ['--at', revision, '--offline']);
  assert.equal(result.code, 1, result.out);
  assert.equal(result.stdout, '', 'an unknown historical state must not export tracker data');
  assert.match(result.stderr, /timed out|timeout/i);
  assert.match(result.stderr, /unknown|not captured|never captured/i);
  assert.doesNotMatch(result.stderr, /redo it with|running record again removes|must rerun record/i);
  assert.equal(result.stderr.includes(legacyCommand), false, 'legacy marker commands are not recovery advice');
}

function assertNoRecording(ctx, revision) {
  const file = join(storeOf(ctx, 'A'), '.tracker-sync', 'recordings', `${revision}.jsonl`);
  assert.equal(existsSync(file), false, 'manual recovery must not invent a local historical recording');
  const remote = spawnSync('git', ['-C', ctx.remote, 'cat-file', '-e',
    `refs/tracker/state:.tracker-sync/recordings/${revision}.jsonl`], { encoding: 'utf8' });
  assert.equal(remote.status, 128, 'manual recovery must not publish a historical recording');
}

test('an uncaptured hook timeout cannot be repaired with later tracker state', async (t) => {
  const ctx = newCtx('recording-timeout-recovery');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const stateFile = join(store, 'fake', 'items.jsonl');
    // Give --from-tree a real, available state-bearing commit. Refusing it merely
    // because its object or state file was absent would not exercise the guard.
    mkdirSync(join(ctx.codeA, 'fake'), { recursive: true });
    writeFileSync(join(ctx.codeA, 'fake', 'items.jsonl'), readFileSync(stateFile));
    const revision = commit(ctx, 'state-bearing revision whose hook will time out');
    git(store, 'fetch', ctx.codeA, revision);
    const lock = join(ctx.stateA, 'lock');
    const token = `owner-${process.pid}-recovery-proof.json`;
    mkdirSync(lock);
    writeFileSync(join(lock, token), JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() }));
    let timeout;
    try {
      // The test process stays alive while the real mechanism exhausts its three
      // bounded lock waits. No shortened clocks, source patches or sleep probes.
      timeout = mech(ctx, 'record', ['--hook', '--revision', 'HEAD', '--checkout', ctx.codeA]);
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
    assert.equal(timeout.code, 1, timeout.out);
    assert.match(timeout.out, /timed out/i);
    assertNoRecording(ctx, revision);
    const markerPath = join(ctx.stateA, 'record-timeouts', `${revision}.json`);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.equal(marker.revision, revision);
    // Existing installations have markers containing the old unsafe advice.
    // Preserve real timeout evidence, adding only that legacy field explicitly.
    const legacyCommand = 'node legacy-tracker-sync.mjs record --revision ' + revision;
    writeFileSync(markerPath, JSON.stringify({ ...marker, command: legacyCommand }) + '\n');
    ok(post(ctx, 'A', 'i-1', 'later tracker write at unchanged code HEAD'), 'later tracker write');
    const laterState = readFileSync(stateFile, 'utf8');
    assert.match(laterState, /later tracker write at unchanged code HEAD/);
    assert.equal(git(ctx.codeA, 'rev-parse', 'HEAD'), revision);

    await t.test('export diagnoses unknown history and ignores legacy retry advice', () => {
      assertUnknown(ctx, revision, legacyCommand);
      assert.doesNotMatch(timeout.out, /running record again removes|must rerun record/i);
    });

    for (const [name, args] of [
      ['explicit retry at unchanged HEAD', ['--revision', revision]],
      ['implicit HEAD retry', []],
      ['symbolic HEAD retry', ['--revision', 'HEAD']],
      ['from-tree retry at unchanged HEAD', ['--revision', revision, '--from-tree']],
    ]) {
      await t.test(name, () => {
        const result = mech(ctx, 'record', [...args, '--checkout', ctx.codeA]);
        assert.equal(result.code, 1, result.out);
        assertNoRecording(ctx, revision);
        assert.equal(readFileSync(stateFile, 'utf8'), laterState, 'refusal must preserve the later write');
        assertUnknown(ctx, revision, legacyCommand);
      });
    }

    writeFileSync(join(ctx.codeA, 'later.txt'), 'advance code without a recording hook\n');
    const moved = commit(ctx, 'move HEAD after the missed recording');
    assert.notEqual(moved, revision);
    for (const fromTree of [false, true]) {
      await t.test(`retry after HEAD moved${fromTree ? ' with --from-tree' : ''}`, () => {
        const result = mech(ctx, 'record', ['--revision', revision, '--checkout', ctx.codeA,
          ...(fromTree ? ['--from-tree'] : [])]);
        assert.equal(result.code, 1, result.out);
        assertNoRecording(ctx, revision);
        assert.equal(readFileSync(stateFile, 'utf8'), laterState);
        assertUnknown(ctx, revision, legacyCommand);
      });
    }

    await t.test('a valid recording remains readable and replayable despite a stale timeout marker', () => {
      const expected = ok(mech(ctx, 'export', ['--now', '--offline']), 'current state').stdout;
      ok(mech(ctx, 'record', ['--revision', moved, '--checkout', ctx.codeA]), 'record new HEAD');
      const recordingPath = join(store, '.tracker-sync', 'recordings', `${moved}.jsonl`);
      const recording = readFileSync(recordingPath, 'utf8');
      // Reuse the genuine timeout's shape to represent a stale diagnostic beside
      // a recording that has since been confirmed valid, not a fake recording.
      writeFileSync(join(ctx.stateA, 'record-timeouts', `${moved}.json`),
        JSON.stringify({ ...marker, revision: moved, command: legacyCommand }) + '\n');
      ok(post(ctx, 'A', 'i-1', 'newer than the valid recording'), 'newer write');
      const newerState = readFileSync(stateFile, 'utf8');
      assert.equal(ok(mech(ctx, 'export', ['--at', moved, '--offline']), 'recorded state').stdout, expected);
      const replay = ok(mech(ctx, 'record', ['--revision', moved, '--checkout', ctx.codeA]), 'already-recorded replay');
      assert.match(replay.out, /already recorded/i);
      assert.equal(readFileSync(recordingPath, 'utf8'), recording, 'existing recording is immutable');
      assert.equal(ok(mech(ctx, 'export', ['--at', moved, '--offline']), 'replayed state').stdout, expected);
      assert.equal(readFileSync(stateFile, 'utf8'), newerState, 'replay must not roll back newer writes');
      assert.equal(git(ctx.remote, 'show', `refs/tracker/state:.tracker-sync/recordings/${moved}.jsonl`), recording.trim());
    });
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('ordinary successful recording preserves exact history across later writes and replay', async () => {
  const ctx = newCtx('recording-success-immutable');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    const store = storeOf(ctx, 'A');
    const expected = ok(mech(ctx, 'export', ['--now', '--offline']), 'current state').stdout;
    ok(mech(ctx, 'record', ['--revision', revision, '--checkout', ctx.codeA]), 'record');
    const recordingPath = join(store, '.tracker-sync', 'recordings', `${revision}.jsonl`);
    const recording = readFileSync(recordingPath, 'utf8');
    assert.equal(ok(mech(ctx, 'export', ['--at', revision, '--offline']), 'historical export').stdout, expected);
    ok(post(ctx, 'A', 'i-1', 'a later write is not the recorded history'), 'later write');
    const laterState = readFileSync(join(store, 'fake', 'items.jsonl'), 'utf8');
    const replay = ok(mech(ctx, 'record', ['--revision', revision, '--checkout', ctx.codeA]), 'replay');
    assert.match(replay.out, /already recorded/i);
    assert.equal(readFileSync(recordingPath, 'utf8'), recording);
    assert.equal(ok(mech(ctx, 'export', ['--at', revision, '--offline']), 'immutable historical export').stdout, expected);
    assert.equal(readFileSync(join(store, 'fake', 'items.jsonl'), 'utf8'), laterState);
    assert.equal(git(ctx.remote, 'show', `refs/tracker/state:.tracker-sync/recordings/${revision}.jsonl`), recording.trim());
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

function timeoutMarker(ctx, revision) {
  const directory = join(ctx.stateA, 'record-timeouts');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${revision}.json`), JSON.stringify({
    revision, at: new Date().toISOString(), said: 'store lock wait exhausted before capture',
  }) + '\n');
}

for (const headMoves of [false, true]) {
test(headMoves
  ? 'implicit record refuses when HEAD advances to a timed-out revision during its lock wait'
  : 'a timeout arriving while manual record waits for the lock prevents capture', async () => {
  const ctx = newCtx(headMoves ? 'recording-head-moves-during-wait' : 'recording-timeout-during-wait');
  let child;
  let exited;
  let waitingTimer;
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const revision = git(ctx.codeA, 'rev-parse', 'HEAD');
    const store = storeOf(ctx, 'A');
    const stateFile = join(store, 'fake', 'items.jsonl');
    const lock = join(ctx.stateA, 'lock');
    const token = `owner-${process.pid}-waiting-recovery.json`;
    mkdirSync(lock);
    writeFileSync(join(lock, token), JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() }));
    let output = '';
    child = spawn(process.execPath, [ctx.mech, 'record', '--recipe', ctx.recipe,
      '--state', ctx.stateA, '--repo', ctx.codeA, '--checkout', ctx.codeA,
      ...(headMoves ? [] : ['--revision', revision])],
    { cwd: ctx.scratch, env: { ...process.env, TRACKER_RECIPE: ctx.recipe }, stdio: ['ignore', 'pipe', 'pipe'] });
    exited = new Promise((resolve) => child.once('close', (code) => resolve(code)));
    await new Promise((resolve, reject) => {
      // A real process diagnostic is the barrier: fetch and any initial marker
      // check have completed, but this live owner still prevents state capture.
      const observe = (chunk) => {
        output += chunk.toString();
        if (/waiting for the store lock/.test(output)) {
          clearTimeout(waitingTimer);
          resolve();
        }
      };
      child.stdout.on('data', observe);
      child.stderr.on('data', observe);
      child.once('error', reject);
      child.once('close', (code) => {
        clearTimeout(waitingTimer);
        reject(new Error(`record exited before waiting (${code}): ${output}`));
      });
      waitingTimer = setTimeout(() => reject(new Error(`record never reported its lock wait: ${output}`)), 15000);
    });
    let timedOutRevision = revision;
    if (headMoves) {
      writeFileSync(join(ctx.codeA, 'advanced-during-wait.txt'), 'HEAD moved after record resolved its request\n');
      timedOutRevision = commit(ctx, 'advance HEAD while implicit recording waits');
      assert.notEqual(timedOutRevision, revision);
    }
    timeoutMarker(ctx, timedOutRevision);
    const markerPath = join(ctx.stateA, 'record-timeouts', `${timedOutRevision}.json`);
    const marker = readFileSync(markerPath, 'utf8');
    ok(post(ctx, 'A', 'i-1', 'tracker state changed while the retry waited'), 'later write');
    const laterState = readFileSync(stateFile, 'utf8');
    rmSync(lock, { recursive: true, force: true });
    assert.equal(await exited, 1, output);
    assert.match(output, headMoves ? /HEAD|revision|moved/i : /unknown|not captured|never captured/i);
    assertNoRecording(ctx, revision);
    if (headMoves) assertNoRecording(ctx, timedOutRevision);
    assert.equal(readFileSync(stateFile, 'utf8'), laterState);
    assert.equal(readFileSync(markerPath, 'utf8'), marker, 'refusal must retain timeout evidence');
    assertUnknown(ctx, timedOutRevision, 'legacy-command-not-present');
  } finally {
    clearTimeout(waitingTimer);
    if (child && child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    if (exited) await exited;
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});
}

test('from-tree HEAD checks the timeout for the requested linked checkout, not repo HEAD', async () => {
  const ctx = newCtx('recording-timeout-linked-head');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const stateFile = join(store, 'fake', 'items.jsonl');
    mkdirSync(join(ctx.codeA, 'fake'), { recursive: true });
    writeFileSync(join(ctx.codeA, 'fake', 'items.jsonl'), readFileSync(stateFile));
    const rootRevision = commit(ctx, 'root checkout with state');
    const linked = join(ctx.scratch, 'linked-checkout');
    git(ctx.codeA, '-c', 'core.hooksPath=/nonexistent-hooks', 'worktree', 'add', '--detach', linked, rootRevision);
    const linkedState = JSON.parse(readFileSync(stateFile, 'utf8').trim().split('\n')[0]);
    linkedState.title = 'distinct historical state in linked checkout';
    writeFileSync(join(linked, 'fake', 'items.jsonl'), JSON.stringify(linkedState) + '\n');
    const requested = commit({ ...ctx, codeA: linked }, 'linked checkout has different HEAD and state');
    assert.notEqual(requested, rootRevision);
    git(store, 'fetch', ctx.codeA, rootRevision, requested);
    timeoutMarker(ctx, requested);
    ok(post(ctx, 'A', 'i-1', 'later live store state must not certify either checkout'), 'later write');
    const laterState = readFileSync(stateFile, 'utf8');
    const result = mech(ctx, 'record', ['--revision', 'HEAD', '--checkout', linked, '--from-tree']);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /unknown|not captured|never captured/i);
    for (const alias of ['HEAD', requested, requested.slice(0, 12), rootRevision, rootRevision.slice(0, 12)])
      assertNoRecording(ctx, alias);
    assert.equal(readFileSync(stateFile, 'utf8'), laterState);
    assertUnknown(ctx, requested, 'legacy-command-not-present');
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('a valid short-name from-tree recording replays unchanged with a canonical timeout marker', async () => {
  const ctx = newCtx('recording-timeout-short-replay');
  try {
    ok(bringUp(ctx, 'A'), 'bring up');
    const store = storeOf(ctx, 'A');
    const stateFile = join(store, 'fake', 'items.jsonl');
    mkdirSync(join(ctx.codeA, 'fake'), { recursive: true });
    const originalState = readFileSync(stateFile, 'utf8');
    writeFileSync(join(ctx.codeA, 'fake', 'items.jsonl'), originalState);
    const revision = commit(ctx, 'state-bearing revision recorded by short name');
    const short = revision.slice(0, 12);
    git(store, 'fetch', ctx.codeA, revision);
    ok(mech(ctx, 'record', ['--revision', short, '--checkout', ctx.codeA, '--from-tree']), 'short-name recording');
    const recordingPath = join(store, '.tracker-sync', 'recordings', `${short}.jsonl`);
    const recording = readFileSync(recordingPath, 'utf8');
    const expected = `=== fake/items.jsonl\n${originalState}${originalState.endsWith('\n') ? '' : '\n'}`;
    assert.equal(ok(mech(ctx, 'export', ['--at', short, '--offline']), 'short historical export').stdout, expected);
    timeoutMarker(ctx, revision);
    ok(post(ctx, 'A', 'i-1', 'later live state after short-name recording'), 'later write');
    const laterState = readFileSync(stateFile, 'utf8');
    const replay = ok(mech(ctx, 'record', ['--revision', short, '--checkout', ctx.codeA, '--from-tree']), 'short-name replay');
    assert.match(replay.out, /already recorded/i);
    assert.equal(readFileSync(recordingPath, 'utf8'), recording);
    assert.equal(ok(mech(ctx, 'export', ['--at', short, '--offline']), 'immutable short-name export').stdout, expected);
    assert.equal(readFileSync(stateFile, 'utf8'), laterState);
    assert.equal(git(ctx.remote, 'show', `refs/tracker/state:.tracker-sync/recordings/${short}.jsonl`), recording.trim());
    timeoutMarker(ctx, revision);
    ok(mech(ctx, 'record', ['--hook', '--revision', short, '--checkout', ctx.codeA, '--from-tree']), 'hook short-name replay');
    assert.equal(readFileSync(recordingPath, 'utf8'), recording);
    assert.equal(ok(mech(ctx, 'export', ['--at', short, '--offline']), 'hook replayed history').stdout, expected);
    assert.equal(readFileSync(stateFile, 'utf8'), laterState);
    assertNoRecording(ctx, revision);
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});
