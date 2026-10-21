import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, renameSync, readdirSync, symlinkSync, unlinkSync, utimesSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { newCtx, bringUp, mech, storeOf, post, storeItems, stopAllWatchers } from './tracker-sync-proof.mjs';

const root = resolve(import.meta.dirname, '..');
const source = process.env.TRACKER_RACE_SOURCE || join(root, 'skills/backlog/setup-shady2k-skills/tracker-sync.mjs');
// The one value reader the mechanism takes its options through. Every copy of
// the mechanism written into a scratch folder gets it beside the copy: a probe
// that cannot start proves nothing about a race.
const ARGV_MODULE = join(root, 'skills/backlog/setup-shady2k-skills/argv.mjs');
// The mechanism also imports the one regular-file helper beside it, so a copy of
// it that cannot load proves nothing: both files are written beside every copy.
const REGULAR_FILE_MODULE = join(root, 'skills/backlog/setup-shady2k-skills/regular-file.mjs');
const withReader = (dir) => {
  for (const [name, from] of [['argv.mjs', ARGV_MODULE], ['regular-file.mjs', REGULAR_FILE_MODULE]])
    writeFileSync(join(dir, name), readFileSync(from));
  return dir;
};

const src = () => readFileSync(source, 'utf8');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (fn()) return;
    await delay(10);
  }

  throw new Error('barrier did not arrive');
}

const git = (cwd, args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

  assert.equal(r.status, 0, r.stderr);

  return r.stdout.trim();
};

function fixtureModule(dir, probe = false) {
  let s = src();

  if (!s.includes('if (process.argv[1]')) {
    s = s.replace(/main\(\)\.catch\(\(e\) => die\(1,[^\n]+\n?/, '');
  }

  // The old version has an empty publication window; the new version publishes
  // a complete directory. Probe exactly when the lock name becomes visible.
  if (probe) {
    s = s.replace("const fd = openSync(p, 'wx');", "const fd = openSync(p, 'wx'); globalThis.lockProbe?.();")
      .replace('renameSync(candidate, p);', 'renameSync(candidate, p); globalThis.lockProbe?.();');
  }

  if (!s.includes('export function takeLock')) {
    s += '\nexport {takeLock};\n';
  }

  // A gated entrypoint left after removing its body still needs a statement.
  s = s.replace(/if \(process\.argv\[1\] === fileURLToPath\(import\.meta\.url\)\)\s*$/, '');

  const file = join(dir, 'fixture.mjs');

  writeFileSync(file, s);
  withReader(dir);

  return file;
}

test('lock is fully published before a contender can see its name', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-publish-'));
  try {
    const { takeLock } = await import(pathToFileURL(fixtureModule(dir, true)));
    let entered = false;
    let other;
    globalThis.lockProbe = () => {
      delete globalThis.lockProbe;
      try {
        other = takeLock({ state: dir }, dir);
        entered = true;
      } catch {}
    };

    const release = takeLock({ state: dir }, dir);

    delete globalThis.lockProbe;
    other?.();
    release();

    assert.equal(entered, false, 'contender entered before owner publication finished');
  } finally {
    delete globalThis.lockProbe;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live owners cannot be stolen by mtime and old releases cannot remove a successor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-owner-'));
  try {
    const { takeLock } = await import(pathToFileURL(fixtureModule(dir)));

    const release = takeLock({ state: dir }, dir);
    const lock = join(dir, 'lock');
    const file = statSync(lock).isDirectory()
      ? readdirSync(lock).map((n) => join(lock, n))[0]
      : lock;

    utimesSync(file, new Date(0), new Date(0));

    assert.throws(() => takeLock({ state: dir }, dir), /locked/);

    renameSync(lock, join(dir, 'obsolete'));

    const next = takeLock({ state: dir }, dir);

    release();

    assert.throws(() => takeLock({ state: dir }, dir), /locked/);

    next();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync reads HEAD and ancestry under the mutation lock, preserving a concurrent local commit', async () => {
  const ctx = newCtx('race-stale-head');
  try {
    for (const machine of ['A', 'B']) {
      const r = bringUp(ctx, machine);

      assert.equal(r.code, 0, r.out);
    }

    assert.equal(mech(ctx, 'sync', [], { machine: 'A' }).code, 0);
    assert.equal(mech(ctx, 'publish', [], { machine: 'A' }).code, 0);
    assert.equal(post(ctx, 'B', 'i-1', 'remote-advance').code, 0);
    assert.equal(mech(ctx, 'publish', [], { machine: 'B' }).code, 0);

    git(ctx.remote, ['merge-base', '--is-ancestor',
      git(storeOf(ctx, 'A'), ['rev-parse', 'HEAD']),
      git(ctx.remote, ['rev-parse', 'refs/tracker/state'])]);

    assert.equal(git(storeOf(ctx, 'A'), ['status', '--porcelain', '--', 'fake/items.jsonl', '.tracker-sync']), '');

    const arrived = join(ctx.scratch, 'arrived');
    const go = join(ctx.scratch, 'go');
    const resetSnapshot = join(ctx.scratch, 'reset-snapshot');
    const marker = `if (process.env.RACE_BARRIER && !globalThis.racePassed) {globalThis.racePassed=true;writeFileSync(process.env.RACE_BARRIER,'ready');while(!existsSync(process.env.RACE_GO)) await sleep(10);}`;
    withReader(ctx.scratch);
    const file = join(ctx.scratch, 'barrier.mjs');

    writeFileSync(file, src().replace(
      'async function locked(fn, waitMs = 120000, { skipOnTimeout = false } = {}) {',
      'async function locked(fn, waitMs = 120000, { skipOnTimeout = false } = {}) {' + marker)
      .replace(
        "await gitOk(['reset', '--hard', remote.tip], { cwd: CURRENT.store });",
        "await gitOk(['reset', '--hard', remote.tip], { cwd: CURRENT.store }); if(process.env.RACE_RESET) writeFileSync(process.env.RACE_RESET,await headOid());"));

    const child = spawn(process.execPath,
      [file, 'sync', '--recipe', ctx.recipe, '--repo', ctx.codeA, '--state', ctx.stateA],
      { env: { ...process.env, RACE_BARRIER: arrived, RACE_GO: go, RACE_RESET: resetSnapshot }, stdio: ['ignore', 'pipe', 'pipe'] });

    let output = '';
    child.stdout.on('data', (b) => (output += b));
    child.stderr.on('data', (b) => (output += b));
    const done = new Promise((r) => child.on('close', r));

    ctx.watchers.push(child);

    await until(() => existsSync(arrived));

    assert.equal(post(ctx, 'A', 'i-1', 'concurrent-local').code, 0);
    assert.equal(mech(ctx, 'publish', [], { machine: 'A' }).code, 0);

    const before = git(storeOf(ctx, 'A'), ['rev-parse', 'HEAD']);

    writeFileSync(go, 'go');

    assert.equal(await done, 0, output);

    git(storeOf(ctx, 'A'), ['merge-base', '--is-ancestor', before, 'HEAD']);

    if (existsSync(resetSnapshot)) {
      git(storeOf(ctx, 'A'), ['merge-base', '--is-ancestor', before, readFileSync(resetSnapshot, 'utf8').trim()]);
    }

    const item = storeItems(ctx, 'A').find((i) => i.id === 'i-1');

    assert.ok(item.comments.some((c) => c.text === 'concurrent-local'));
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

for (const mode of ['failed', 'timeout-no-ref', 'retried', 'retried-remote', 'accepted-timeout', 'accepted']) {
  test(`conditional ${mode} push cannot publish speculation or erase concurrent local work`, async () => {
    const rejected = mode === 'failed' || mode === 'timeout-no-ref';
    const ctx = newCtx(`race-conditional-${mode}`);
    try {
      const ready = bringUp(ctx, 'A');

      assert.equal(ready.code, 0, ready.out);

      if (mode === 'retried-remote') {
        const readyB = bringUp(ctx, 'B');

        assert.equal(readyB.code, 0, readyB.out);
      }

      const arrived = join(ctx.scratch, 'arrived');
      const go = join(ctx.scratch, 'go');
      const marker = `if (process.env.RACE_BARRIER && !globalThis.racePassed) {globalThis.racePassed=true;writeFileSync(process.env.RACE_BARRIER,'ready');while(!existsSync(process.env.RACE_GO)) await sleep(10);${rejected?(mode==='timeout-no-ref'?"await gitOk(['push','origin',`:${CURRENT.ref}`],{cwd:CURRENT.store});return {unreachable:true};":'return {unreachable:true};'):mode==='accepted-timeout'?"await gitOk(['push','origin',`${oid}:${CURRENT.ref}`],{cwd:CURRENT.store});return {unreachable:true};":''}}`;
      withReader(ctx.scratch);
      const file = join(ctx.scratch, 'barrier.mjs');

      writeFileSync(file, src().replace(
        'async function pushOnce(oid) {',
        'async function pushOnce(oid) {' + marker));

      const child = spawn(process.execPath,
        [file, 'claim', '--item', 'i-1', '--holder', 'claiming-agent', '--recipe', ctx.recipe, '--repo', ctx.codeA, '--state', ctx.stateA],
        { env: { ...process.env, RACE_BARRIER: arrived, RACE_GO: go }, stdio: ['ignore', 'pipe', 'pipe'] });

      let output = '';
      child.stdout.on('data', (b) => (output += b));
      child.stderr.on('data', (b) => (output += b));
      const done = new Promise((r) => child.on('close', r));

      ctx.watchers.push(child);

      await until(() => existsSync(arrived));

      assert.equal(post(ctx, 'A', 'i-1', 'independent-local-write').code, 0);

      if (mode !== 'accepted-timeout' && mode !== 'accepted') {
        const published = mech(ctx, 'publish', [], { machine: 'A' });

        assert.equal(published.code, 0, published.out);
      } else {
        // Commit the unrelated write locally without moving the remote.
        const live = storeOf(ctx, 'A');
        const exp = spawnSync(process.execPath, [ctx.fake, 'export'], { cwd: live, encoding: 'utf8' });

        assert.equal(exp.status, 0, exp.stderr);

        git(live, ['add', 'fake/items.jsonl']);
        git(live, ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-m', 'unrelated live write']);
      }

      if (mode === 'retried-remote') {
        assert.equal(post(ctx, 'B', 'i-1', 'remote-update-during-push').code, 0);

        const p = mech(ctx, 'publish', [], { machine: 'B' });

        assert.equal(p.code, 0, p.out);
      }

      const local = git(storeOf(ctx, 'A'), ['rev-parse', 'HEAD']);
      const remote = JSON.parse(git(ctx.remote, ['show', 'refs/tracker/state:fake/items.jsonl']).split('\n')[0]);
      const speculativeHolder = remote.holder;

      writeFileSync(go, 'go');

      assert.equal(await done, rejected ? 4 : 0, output);

      git(storeOf(ctx, 'A'), ['merge-base', '--is-ancestor', local, 'HEAD']);

      const current = storeItems(ctx, 'A').find((i) => i.id === 'i-1');

      assert.ok(current.comments.some((c) => c.text === 'independent-local-write'));
      assert.equal(current.holder, rejected ? '' : 'claiming-agent');

      if (rejected) assert.match(output, /outcome is unknown/);

      if (mode === 'retried-remote') assert.ok(current.comments.some((c) => c.text === 'remote-update-during-push'));

      assert.equal(speculativeHolder, '', 'another publisher exposed the unaccepted conditional write');

      // A settled outcome leaves no diagnostic behind: accepted, accepted-reconciled,
      // lost and refused-then-succeeded all delete it, and a reconciled candidate
      // also drops the ref it retained. An unknown outcome keeps both for a person.
      const resultFiles = readdirSync(ctx.stateA).filter((n) => n.endsWith('.result.json'));
      const diagnostics = resultFiles.map((n) => JSON.parse(readFileSync(join(ctx.stateA, n), 'utf8')));

      assert.equal(diagnostics.length, rejected ? 1 : 0, 'a settled outcome must leave no diagnostic');
      assert.ok(diagnostics.every((d) => d.files > 0 && d.bytes > 0 && d.importMs >= 0));

      const candidateRefs = git(storeOf(ctx, 'A'), ['for-each-ref', '--format=%(refname)', 'refs/tracker-sync/candidates/']);

      if (rejected) {
        assert.ok(diagnostics.some((d) => d.phase === 'unknown' && d.retainedRef));

        assert.equal(candidateRefs, `refs/tracker-sync/candidates/${resultFiles[0].replace(/\.result\.json$/, '')}`);
      } else {
        assert.equal(candidateRefs, '', 'a settled candidate keeps no ref');
      }
    } finally {
      await stopAllWatchers(ctx);
      rmSync(ctx.scratch, { recursive: true, force: true });
    }
  });
}

test('a retained candidate and its diagnostic go once a later run proves acceptance', async () => {
  const ctx = newCtx('race-candidate-prune');
  try {
    const ready = bringUp(ctx, 'A');

    assert.equal(ready.code, 0, ready.out);

    assert.equal(post(ctx, 'A', 'i-1', 'published').code, 0);
    assert.equal(mech(ctx, 'publish', [], { machine: 'A' }).code, 0);

    const live = storeOf(ctx, 'A');
    const accepted = git(live, ['rev-parse', 'HEAD']);
    const elsewhere = git(ctx.codeA, ['rev-parse', 'HEAD']);

    git(live, ['update-ref', 'refs/tracker-sync/candidates/candidate-accepted', accepted]);
    git(live, ['update-ref', 'refs/tracker-sync/candidates/candidate-pending', elsewhere]);

    for (const name of ['candidate-accepted', 'candidate-pending']) {
      writeFileSync(join(ctx.stateA, `${name}.result.json`),
        JSON.stringify({ phase: 'unknown', retainedRef: `refs/tracker-sync/candidates/${name}` }));
    }

    const synced = mech(ctx, 'sync', [], { machine: 'A' });

    assert.equal(synced.code, 0, synced.out);

    // The remote holds the accepted one: a later run settles it and takes the ref
    // and the diagnostic away. What the remote does not hold stays for a person.
    assert.equal(git(live, ['for-each-ref', '--format=%(refname)', 'refs/tracker-sync/candidates/']),
      'refs/tracker-sync/candidates/candidate-pending');

    assert.equal(existsSync(join(ctx.stateA, 'candidate-accepted.result.json')), false);
    assert.ok(existsSync(join(ctx.stateA, 'candidate-pending.result.json')));

    // A record run proves acceptance of an earlier recording too, even though
    // record does not sync first.
    assert.equal(mech(ctx, 'record', [], { machine: 'A' }).code, 0);

    git(live, ['update-ref', 'refs/tracker-sync/candidates/candidate-record', accepted]);

    writeFileSync(join(ctx.stateA, 'candidate-record.result.json'),
      JSON.stringify({ phase: 'unknown', retainedRef: 'refs/tracker-sync/candidates/candidate-record' }));

    const again = mech(ctx, 'record', [], { machine: 'A' });

    assert.equal(again.code, 0, again.out);

    assert.equal(git(live, ['for-each-ref', '--format=%(refname)', 'refs/tracker-sync/candidates/']),
      'refs/tracker-sync/candidates/candidate-pending');

    assert.equal(existsSync(join(ctx.stateA, 'candidate-record.result.json')), false);
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('dead legacy and token owners recover, while an uninitialized legacy lock fails closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-recovery-'));
  try {
    const { takeLock } = await import(pathToFileURL(fixtureModule(dir)));

    const lock = join(dir, 'lock');

    writeFileSync(lock, JSON.stringify({ pid: 2147483647, at: 'old' }));

    takeLock({ state: dir }, dir)();

    assert.equal(existsSync(lock), false);

    // This empty file is exactly what a pre-upgrade process exposed between
    // exclusive creation and PID publication. Never treat unknown as dead.
    writeFileSync(lock, '');

    assert.throws(() => takeLock({ state: dir }, dir), /verifiable owner/);

    rmSync(lock);

    const { mkdirSync } = await import('node:fs');

    mkdirSync(lock);
    writeFileSync(join(lock, 'dead-token'), JSON.stringify({ pid: 2147483647, at: 'old', token: 'dead-token' }));

    takeLock({ state: dir }, dir)();

    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a lock released between the failed rename and the stat is retried, not an error', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-vanish-'));
  try {
    const file = fixtureModule(dir);

    writeFileSync(file, readFileSync(file, 'utf8').replace(
      'directory = statSync(p).isDirectory();',
      'globalThis.beforeStat?.(); directory = statSync(p).isDirectory();'));

    const { takeLock } = await import(pathToFileURL(file));

    const release = takeLock({ state: dir }, dir);

    // The holder releases exactly between the contender's failed rename and its
    // stat, so the lock name is already gone when the contender looks.
    globalThis.beforeStat = () => {
      delete globalThis.beforeStat;
      release();
    };

    const next = takeLock({ state: dir }, dir);

    assert.equal(typeof next, 'function', 'a vanished holder must be retried, not reported as an error');

    next();
  } finally {
    delete globalThis.beforeStat;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty lock directory is a retry, and several entries still fail closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-empty-'));
  try {
    const file = fixtureModule(dir);

    writeFileSync(file, readFileSync(file, 'utf8').replace(
      'directory = statSync(p).isDirectory();',
      'globalThis.beforeStat?.(); directory = statSync(p).isDirectory();'));

    const { takeLock } = await import(pathToFileURL(file));

    const lock = join(dir, 'lock');
    const release = takeLock({ state: dir }, dir);
    const token = readdirSync(lock)[0];

    // The holder is between unlinking its token and removing the directory when
    // the contender looks: a lock on its way out, never an owner nobody can
    // verify, so the contender tries again and takes it.
    globalThis.beforeStat = () => {
      delete globalThis.beforeStat;
      unlinkSync(join(lock, token));
    };

    const next = takeLock({ state: dir }, dir);

    assert.equal(typeof next, 'function', 'an empty lock directory must be retried, not reported as unverifiable');

    next();
    release();

    // An owner nobody can verify still fails closed: several entries that stay.
    mkdirSync(lock);
    writeFileSync(join(lock, 'a'), '{}');
    writeFileSync(join(lock, 'b'), '{}');

    assert.throws(() => takeLock({ state: dir }, dir), /verifiable owner/);
  } finally {
    delete globalThis.beforeStat;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('candidate fatal errors clean only their worktree and preserve diagnostics and live data', async () => {
  const ctx = newCtx('race-fatal-cleanup');
  try {
    const ready = bringUp(ctx, 'A');

    assert.equal(ready.code, 0, ready.out);

    const live = storeOf(ctx, 'A');
    const before = readFileSync(join(live, 'fake/db.json'), 'utf8');
    withReader(ctx.scratch);
    const file = join(ctx.scratch, 'fatal.mjs');

    writeFileSync(file, src().replace(
      'return { oid: await commitState(`tracker store: ${kind} ${item}`, [before]) };',
      "die(1,'injected candidate commit failure');"));

    const result = spawnSync(process.execPath,
      [file, 'claim', '--item', 'i-1', '--holder', 'pending', '--recipe', ctx.recipe, '--repo', ctx.codeA, '--state', ctx.stateA],
      { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /injected candidate/);

    assert.equal(readFileSync(join(live, 'fake/db.json'), 'utf8'), before);

    const artifacts = readdirSync(ctx.stateA).filter((n) => n.startsWith('candidate-'));

    assert.equal(artifacts.length, 1);
    assert.ok(artifacts[0].endsWith('.result.json'));

    const diagnostic = JSON.parse(readFileSync(join(ctx.stateA, artifacts[0]), 'utf8'));

    assert.equal(diagnostic.phase, 'error');
    assert.ok(diagnostic.files > 0);
    assert.ok(diagnostic.bytes > 0);
    assert.ok(!git(live, ['worktree', 'list', '--porcelain']).includes('candidate-'));
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

for (const hazard of ['symlink', 'absolute-config', 'absolute-command', 'absolute-env']) {
  test(`candidate refuses ${hazard} before changing the live database`, async () => {
    const ctx = newCtx(`race-isolation-${hazard}`);
    try {
      const ready = bringUp(ctx, 'A');

      assert.equal(ready.code, 0, ready.out);

      const live = storeOf(ctx, 'A');
      const before = readFileSync(join(live, 'fake/db.json'), 'utf8');

      if (hazard === 'symlink') {
        symlinkSync(join(live, 'fake/db.json'), join(live, 'shared-db'));
      } else if (hazard === 'absolute-config') {
        writeFileSync(join(live, 'local-config.json'), JSON.stringify({ db: join(live, 'fake/db.json') }));
      } else {
        const custom = join(ctx.scratch, 'recipe.mjs');

        writeFileSync(custom, `import original from ${JSON.stringify(pathToFileURL(ctx.recipe).href)};\nexport default {...original,${hazard==='absolute-command'?`import: ${JSON.stringify('cat '+JSON.stringify(join(live,'fake/db.json')))},`:`pointer: {...original.pointer,env: ${JSON.stringify('echo '+JSON.stringify('FAKE_STORE='+live))}},`}};`);

        ctx.recipe = custom;
      }

      const result = mech(ctx, 'claim', ['--item', 'i-1', '--holder', 'pending']);

      assert.equal(result.code, 1, result.out);
      assert.match(result.out, /cannot isolate/);

      assert.equal(readFileSync(join(live, 'fake/db.json'), 'utf8'), before);

      assert.ok(readdirSync(ctx.stateA).filter((n) => n.startsWith('candidate-')).every((n) => n.endsWith('.result.json')));
    } finally {
      await stopAllWatchers(ctx);
      rmSync(ctx.scratch, { recursive: true, force: true });
    }
  });
}

test('pointer.env retains shell quoting, expansion, multiple assignments and unset semantics', async () => {
  const ctx = newCtx('race-pointer-shell');
  try {
    const ready = bringUp(ctx, 'A');

    assert.equal(ready.code, 0, ready.out);

    const custom = join(ctx.scratch, 'shell-recipe.mjs');
    const launcher = 'FAKE_STORE=<store>; ROUTE_A="two words"; ROUTE_B="$ROUTE_A quote"; unset ROUTE_POISON';
    const check = 'case "$PWD" in */candidate-*) test "$ROUTE_B" = "two words quote" && test "${ROUTE_POISON+x}" != x || exit 91;; esac; ';

    writeFileSync(custom, `import original from ${JSON.stringify(pathToFileURL(ctx.recipe).href)};\nexport default {...original,import:${JSON.stringify(check)}+original.import,pointer:{...original.pointer,env:${JSON.stringify("printf '%s\\n' "+JSON.stringify(launcher).replaceAll('$','\\$'))}}};`);

    ctx.recipe = custom;

    const result = mech(ctx, 'claim', ['--item', 'i-1', '--holder', 'shell-agent'], { env: { ROUTE_POISON: 'inherited' } });

    assert.equal(result.code, 0, result.out);

    assert.equal(storeItems(ctx, 'A')[0].holder, 'shell-agent');
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

test('SIGKILL leaves an inspectable own candidate and a subsequent attempt preserves it and live writes', async () => {
  const ctx = newCtx('race-crash-cleanup');
  try {
    const ready = bringUp(ctx, 'A');

    assert.equal(ready.code, 0, ready.out);

    const arrived = join(ctx.scratch, 'arrived');
    withReader(ctx.scratch);
    const file = join(ctx.scratch, 'crash.mjs');

    writeFileSync(file, src().replace(
      'async function pushOnce(oid) {',
      `async function pushOnce(oid) {writeFileSync(${JSON.stringify(arrived)},'ready');await new Promise(()=>{setInterval(()=>{},1000);});`));

    const child = spawn(process.execPath,
      [file, 'claim', '--item', 'i-1', '--holder', 'crashed', '--recipe', ctx.recipe, '--repo', ctx.codeA, '--state', ctx.stateA],
      { stdio: ['ignore', 'pipe', 'pipe'] });

    const done = new Promise((r) => child.on('close', r));

    ctx.watchers.push(child);

    await until(() => existsSync(arrived));

    child.kill('SIGKILL');
    await done;

    const artifacts = readdirSync(ctx.stateA).filter((n) => n.startsWith('candidate-'));

    assert.equal(artifacts.length, 2);

    const diagnostic = artifacts.find((n) => n.endsWith('.result.json'));
    const saved = readFileSync(join(ctx.stateA, diagnostic), 'utf8');

    assert.equal(JSON.parse(saved).phase, 'pushing');

    assert.equal(post(ctx, 'A', 'i-1', 'survived-crash').code, 0);

    const result = mech(ctx, 'claim', ['--item', 'i-1', '--holder', 'after-crash']);

    assert.equal(result.code, 0, result.out);

    assert.equal(readFileSync(join(ctx.stateA, diagnostic), 'utf8'), saved);

    for (const name of artifacts) assert.ok(existsSync(join(ctx.stateA, name)));

    const item = storeItems(ctx, 'A')[0];

    assert.equal(item.holder, 'after-crash');
    assert.ok(item.comments.some((c) => c.text === 'survived-crash'));
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});

for (const mode of ['failed', 'accepted-timeout', 'remote-update', 'code-head-update']) {
  test(`record ${mode} preserves concurrent live writes without speculative publication`, async () => {
    const ctx = newCtx(`race-record-${mode}`);
    try {
      const ready = bringUp(ctx, 'A');

      assert.equal(ready.code, 0, ready.out);

      if (mode === 'remote-update' || mode === 'code-head-update') {
        const b = bringUp(ctx, 'B');

        assert.equal(b.code, 0, b.out);
      }

      const arrived = join(ctx.scratch, 'arrived');
      const go = join(ctx.scratch, 'go');
      const marker = `if(!globalThis.recordBarrier){globalThis.recordBarrier=true;writeFileSync(${JSON.stringify(arrived)},'ready');while(!existsSync(${JSON.stringify(go)}))await sleep(10);${mode==='failed'?'return {ok:false,unreachable:true};':mode==='accepted-timeout'?"await gitOk(['push','origin',`${oid}:${CURRENT.ref}`],{cwd:CURRENT.store});return {ok:false,unreachable:true};":''}}`;
      withReader(ctx.scratch);
      const file = join(ctx.scratch, 'record-barrier.mjs');

      writeFileSync(file, src().replace(
        'async function pushOnce(oid) {',
        'async function pushOnce(oid) {' + marker)
        .replace(
          'async function pushOid(oid, { quiet, attempts = 3, skipOnTimeout = false } = {}) {',
          'async function pushOid(oid, { quiet, attempts = 3 } = {}) {' + marker));

      const revision = git(ctx.codeA, ['rev-parse', 'HEAD']);

      const child = spawn(process.execPath,
        [file, 'record', '--revision', revision, '--recipe', ctx.recipe, '--repo', ctx.codeA, '--state', ctx.stateA],
        { stdio: ['ignore', 'pipe', 'pipe'] });

      let output = '';
      child.stdout.on('data', (b) => (output += b));
      child.stderr.on('data', (b) => (output += b));
      const done = new Promise((r) => child.on('close', r));

      ctx.watchers.push(child);

      await until(() => existsSync(arrived));

      assert.equal(post(ctx, 'A', 'i-1', 'live-during-record').code, 0);

      // Commit locally; the failed case also exercises an independent publisher.
      if (mode === 'failed') {
        const p = mech(ctx, 'publish', []);

        assert.equal(p.code, 0, p.out);
      } else {
        const live = storeOf(ctx, 'A');

        assert.equal(spawnSync(process.execPath, [ctx.fake, 'export'], { cwd: live }).status, 0);

        git(live, ['add', 'fake/items.jsonl']);
        git(live, ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-m', 'live during record']);
      }

      const before = git(storeOf(ctx, 'A'), ['rev-parse', 'HEAD']);
      const speculative = git(ctx.remote, ['ls-tree', '-r', '--name-only', 'refs/tracker/state', '--', '.tracker-sync/recordings']);

      if (mode === 'code-head-update') {
        git(ctx.codeA, ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '--allow-empty', '-m', 'advance code during record']);
      }

      if (mode === 'remote-update' || mode === 'code-head-update') {
        assert.equal(post(ctx, 'B', 'i-1', 'remote-during-record').code, 0);

        assert.equal(mech(ctx, 'publish', [], { machine: 'B' }).code, 0);
      }

      writeFileSync(go, 'go');

      assert.equal(await done, mode === 'failed' ? 4 : 0, output);

      const ancestry = spawnSync('git', ['-C', storeOf(ctx, 'A'), 'merge-base', '--is-ancestor', before, 'HEAD']);

      assert.equal(ancestry.status, 0, 'record rollback erased concurrent committed live history');

      assert.ok(storeItems(ctx, 'A')[0].comments.some((c) => c.text === 'live-during-record'));
      assert.equal(speculative, '', 'ordinary publisher exposed an unaccepted recording');

      if (mode === 'failed') assert.match(output, /unknown/);

      if (mode === 'remote-update') assert.ok(storeItems(ctx, 'A')[0].comments.some((c) => c.text === 'remote-during-record'));

      if (mode !== 'failed') {
        const recorded = git(ctx.remote, ['show', `refs/tracker/state:.tracker-sync/recordings/${revision}.jsonl`]);

        assert.ok(!recorded.includes('live-during-record'), 'retry recaptured a later state for the same revision');
      }
    } finally {
      await stopAllWatchers(ctx);
      rmSync(ctx.scratch, { recursive: true, force: true });
    }
  });
}

test('record preserves missing recipe dependency exit 2 and installed version provenance', async () => {
  const ctx = newCtx('record-missing-runtime');
  try {
    const ready = bringUp(ctx, 'A');

    assert.equal(ready.code, 0, ready.out);

    const installed = join(ctx.scratch, 'tracker-sync.mjs');

    writeFileSync(installed, src());
    withReader(ctx.scratch);
    writeFileSync(join(ctx.scratch, 'tracker-sync.version'), '0.112.0\n');

    assert.equal(spawnSync(process.execPath, [installed, 'version'], { encoding: 'utf8' }).stdout.trim(), '0.112.0');

    const custom = join(ctx.scratch, 'missing-recipe.mjs');

    writeFileSync(custom, `import original from ${JSON.stringify(pathToFileURL(ctx.recipe).href)};export default {...original,import:'definitely-missing-tracker-runtime --import'};`);

    const result = spawnSync(process.execPath,
      [installed, 'record', '--recipe', custom, '--repo', ctx.codeA, '--state', ctx.stateA],
      { encoding: 'utf8' });

    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /definitely-missing-tracker-runtime/);

    assert.equal(storeItems(ctx, 'A')[0].holder, '');
  } finally {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  }
});
