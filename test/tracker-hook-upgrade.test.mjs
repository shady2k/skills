import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { newCtx, mech, stopAllWatchers } from './tracker-sync-proof.mjs';

const recordMark = '# shady2k tracker-sync record: this line records the revision this hook just cut or landed';
const recordHooks = ['post-commit', 'post-merge'];
const hookNames = [...recordHooks, 'post-checkout'];
const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const legacyLine = (ctx) => `node ${quote(ctx.mech)} record --revision "$(git rev-parse HEAD)" --checkout "$(git rev-parse --show-toplevel)" --state ${quote(ctx.stateA)} --recipe ${quote(ctx.recipe)} >/dev/null 2>&1 || true\n`;
const currentLine = (ctx) => legacyLine(ctx).replace(' record --revision ', ' record --hook --revision ');
const hooksDir = (ctx) => join(ctx.codeA, '.git', 'hooks');
const reconnect = (ctx) => mech(ctx, 'connect', ['--machine', 'A', '--checkout', ctx.codeA]);
const succeeds = (r) => assert.equal(r.code, 0, r.out);
const git = (ctx, args, opts = {}) => {
  const r = spawnSync('git', ['-C', ctx.codeA, ...args], { encoding: 'utf8', timeout: 45000, ...opts });
  assert.equal(r.status, 0, r.error?.message || r.stderr);
  return r.stdout.trim();
};
async function fixture(t, name) {
  const ctx = newCtx(`hook-upgrade-${name}`);
  t.after(async () => {
    await stopAllWatchers(ctx);
    rmSync(ctx.scratch, { recursive: true, force: true });
  });
  succeeds(reconnect(ctx));
  return ctx;
}
function putHook(file, text) {
  writeFileSync(file, text);
  chmodSync(file, 0o755);
}

// The commands are the old generated commands, not a mutation of whatever the
// installer happens to emit today. Only their --hook argument may change.
test('reconnect upgrades both generated record hooks in place and remains idempotent', async (t) => {
  const ctx = await fixture(t, 'both');
  const before = '#!/bin/sh\nprintf "before\\n" >/dev/null\n';
  const after = 'printf "after\\n" >/dev/null\n  exit 0\n';
  for (const name of recordHooks)
    putHook(join(hooksDir(ctx), name), `${before}${recordMark}\n${legacyLine(ctx)}${after}`);
  const checkoutBefore = readFileSync(join(hooksDir(ctx), 'post-checkout'), 'utf8');
  succeeds(reconnect(ctx));
  for (const name of recordHooks)
    assert.equal(readFileSync(join(hooksDir(ctx), name), 'utf8'), `${before}${recordMark}\n${currentLine(ctx)}${after}`, name);
  succeeds(reconnect(ctx));
  for (const name of recordHooks)
    assert.equal(readFileSync(join(hooksDir(ctx), name), 'utf8'), `${before}${recordMark}\n${currentLine(ctx)}${after}`, `${name} reconnect must not append a duplicate`);
  assert.equal(readFileSync(join(hooksDir(ctx), 'post-checkout'), 'utf8'), checkoutBefore);
});

test('an upgrade preserves arbitrary surrounding hook bytes', async (t) => {
  const ctx = await fixture(t, 'bytes');
  const before = Buffer.concat([Buffer.from('#!/bin/sh\n# before: '), Buffer.from([0xff, 0x80, 0xc0]), Buffer.from('\n')]);
  const after = Buffer.concat([Buffer.from('# after: '), Buffer.from([0xfe, 0xe0, 0x80]), Buffer.from('\nexit 0\n')]);
  const legacy = Buffer.concat([before, Buffer.from(`${recordMark}\n${legacyLine(ctx)}`), after]);
  const expected = Buffer.concat([before, Buffer.from(`${recordMark}\n${currentLine(ctx)}`), after]);
  for (const name of recordHooks) putHook(join(hooksDir(ctx), name), legacy);
  succeeds(reconnect(ctx));
  for (const name of recordHooks) assert.deepEqual(readFileSync(join(hooksDir(ctx), name)), expected, name);
  succeeds(reconnect(ctx));
  for (const name of recordHooks) assert.deepEqual(readFileSync(join(hooksDir(ctx), name)), expected, `${name} remains byte-identical on reconnect`);
});

test('machine hook symlinks to tracked project hooks are accepted without rewriting their targets', async (t) => {
  const ctx = await fixture(t, 'tracked-target');
  const trackedDir = join(ctx.codeA, 'project-hooks');
  mkdirSync(trackedDir);
  const text = `#!/bin/sh\n${recordMark}\n${legacyLine(ctx)}exit 0\n`;
  for (const name of recordHooks) putHook(join(trackedDir, name), text);
  git(ctx, ['add', 'project-hooks']);
  git(ctx, ['-c', 'core.hooksPath=/nonexistent-hooks', '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'track hook targets']);
  for (const name of recordHooks) {
    const file = join(hooksDir(ctx), name);
    rmSync(file);
    symlinkSync(join(trackedDir, name), file);
  }
  succeeds(reconnect(ctx));
  succeeds(reconnect(ctx));
  for (const name of recordHooks) {
    assert.equal(readFileSync(join(trackedDir, name), 'utf8'), text, name);
    assert.equal(readlinkSync(join(hooksDir(ctx), name)), join(trackedDir, name));
  }
  assert.equal(git(ctx, ['status', '--porcelain', '--', 'project-hooks']), '');
});

test('a marker does not authorize rewriting custom relative or manual record commands', async (t) => {
  const ctx = await fixture(t, 'custom');
  const customs = [
    `${recordMark}\nnode ./tools/tracker-sync.mjs record --revision "$(git rev-parse HEAD)"\n`,
    `${recordMark}\n./record-this-revision --own-options\n`,
    `${recordMark}\n# the following generated-looking line is not this marker's command\n${legacyLine(ctx)}`,
    `# custom prefix ${recordMark}\n${legacyLine(ctx)}`,
    `${recordMark}\n${legacyLine(ctx).replace(' >/dev/null 2>&1 || true', ' >>my-record.log 2>&1 || true')}`,
  ];
  for (const custom of customs) {
    const text = `#!/bin/sh\n${custom}exit 0\n`;
    for (const name of recordHooks) putHook(join(hooksDir(ctx), name), text);
    succeeds(reconnect(ctx));
    for (const name of recordHooks) assert.equal(readFileSync(join(hooksDir(ctx), name), 'utf8'), text, name);
  }
});

test('tracked core.hooksPath legacy commands are accepted without rewriting', async (t) => {
  const ctx = await fixture(t, 'tracked');
  const trackedDir = join(ctx.codeA, 'hooks');
  mkdirSync(trackedDir);
  const expected = new Map();
  for (const name of hookNames) {
    const text = name === 'post-checkout'
      ? readFileSync(join(hooksDir(ctx), name), 'utf8')
      : `#!/bin/sh\n${recordMark}\n${legacyLine(ctx)}exit 0\n`;
    expected.set(name, text);
    putHook(join(trackedDir, name), text);
  }
  git(ctx, ['add', 'hooks']);
  git(ctx, ['-c', 'core.hooksPath=/nonexistent-hooks', '-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '-qm', 'track legacy hooks']);
  git(ctx, ['config', 'core.hooksPath', 'hooks']);
  succeeds(reconnect(ctx));
  succeeds(reconnect(ctx));
  for (const [name, text] of expected) assert.equal(readFileSync(join(trackedDir, name), 'utf8'), text, name);
  assert.equal(git(ctx, ['status', '--porcelain', '--', 'hooks']), '');
});

test('an upgrade refuses a non-shell hook instead of rewriting its generated-looking command', async (t) => {
  const ctx = await fixture(t, 'non-shell');
  const file = join(hooksDir(ctx), 'post-commit');
  const text = `#!/usr/bin/env python3\n${recordMark}\n${legacyLine(ctx)}`;
  putHook(file, text);
  const result = reconnect(ctx);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /not a shell hook/);
  assert.equal(readFileSync(file, 'utf8'), text);
});

test('a nonregular hook is refused without changing its contents', async (t) => {
  const ctx = await fixture(t, 'nonregular');
  const file = join(hooksDir(ctx), 'post-commit');
  const target = join(file, 'keep');
  const text = 'unrelated hook directory contents\n';
  rmSync(file);
  mkdirSync(file);
  writeFileSync(target, text);
  const result = reconnect(ctx);
  assert.equal(result.code, 1, result.out);
  assert.equal(readFileSync(target, 'utf8'), text);
});

test('a real upgraded post-commit hook leaves the hook-specific timeout marker', async (t) => {
  const ctx = await fixture(t, 'timeout');
  const file = join(hooksDir(ctx), 'post-commit');
  putHook(file, `#!/bin/sh\n${recordMark}\n${legacyLine(ctx)}exit 0\n`);
  succeeds(reconnect(ctx));
  // Fail quickly on the old installer, rather than waiting its manual-record
  // lock timeout of two minutes. The passing case still runs the actual hook.
  assert.ok(readFileSync(file, 'utf8').includes(currentLine(ctx)));
  const lock = join(ctx.stateA, 'lock');
  mkdirSync(lock);
  writeFileSync(join(lock, `owner-${process.pid}-held.json`), JSON.stringify({
    pid: process.pid, at: new Date().toISOString(), token: 'held-by-hook-upgrade-proof',
  }) + '\n');
  try {
    git(ctx, ['-c', 'user.name=proof', '-c', 'user.email=proof@local', 'commit', '--allow-empty', '-qm', 'run upgraded hook under lock']);
    const rev = git(ctx, ['rev-parse', 'HEAD']);
    const marker = join(ctx.stateA, 'record-timeouts', `${rev}.json`);
    assert.ok(existsSync(marker), 'the real git hook must take the bounded --hook timeout path');
    assert.match(readFileSync(marker, 'utf8'), new RegExp(rev));
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
});
