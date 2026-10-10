// The exec subcommand runs a long command under the bound of its own recorded
// durations for the same command, and stops it past the bound. These tests run
// the script itself, since the work under test is a process of its own: a real
// child, a real stop, and the record it leaves for the next bound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = new URL('../skills/engineering/take-task/runs.mjs', import.meta.url);

const HEAD = '<!-- shady2k-exec v1 -->';
const recordBody = (fields) => [HEAD,
  `item: ${fields.item}`, `command: ${fields.command}`, `started: ${fields.started}`,
  `duration: ${fields.duration}`, `result: ${fields.result}`, `bound: ${fields.bound}`].join('\n');

test('exec: the first-run default, the record it prints, and what another copy reads back', () => {
  const home = mkdtempSync(join(tmpdir(), 'runs-exec-test-'));
  const backlog = join(home, 'bl.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: [] }] }));
  const run = (args, timeout = 5000) => spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, ...args],
    { encoding: 'utf8', timeout, env: { ...process.env, NO_COLOR: '1' } });

  let r = run(['--', 'echo', 'hello']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo hello: bound 900 s, the first-run default/);
  assert.match(r.stdout, /== post on A/);
  assert.match(r.stdout, /duration: 0/);
  assert.match(r.stdout, /<!-- shady2k-exec v1 -->/);
  assert.match(r.stdout, /command: \["echo","hello"\]/);
  assert.match(r.stdout, /result: exit 0/);
  assert.match(r.stdout, /bound: 900/);

  // Post the record the way the agent does, and the same command's next bound
  // comes from it; a different command keeps the default.
  const body = r.stdout.split('== post on A\n', 2)[1];
  const comments = JSON.parse(readFileSync(backlog)).issues[0].comments;
  comments.push({ id: 'c1', body });
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments }] }));
  r = run(['--', 'echo', 'hello']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo hello: bound \d+ s, the longest of its runs \(took 0 s before\)/);
  r = run(['--', 'echo', 'other']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo other: bound 900 s, the first-run default/);
  // The boundary of the arguments is the identity: `echo hello world` is not
  // `echo hello`, even though one started with the other.
  r = run(['--', 'echo', 'hello', 'world']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo hello world: bound 900 s, the first-run default/);

  // --first is the estimate said before the first run of a command with none
  // recorded, and refused where its durations exist: the bound is theirs.
  r = run(['--first', '2', '--', 'echo', 'other']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /bound 120 s, the estimate named with --first/);
  r = run(['--first', '5', '--', 'echo', 'hello']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /the bound is theirs and is never raised/);

  // Misuse reads as misuse.
  assert.equal(spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog], { encoding: 'utf8', timeout: 5000 }).status, 2);
  assert.equal(spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'Z', '--backlog', backlog, '--', 'echo', 'x'], { encoding: 'utf8', timeout: 5000 }).status, 2);
  assert.equal(spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, '--', 'no-such-command-at-all-xyz'], { encoding: 'utf8', timeout: 5000 }).status, 127);

  // A journal comment that does not read clean is named, never counted.
  const left = JSON.parse(readFileSync(backlog)).issues[0].comments;
  left.push({ id: 'c2', body: `${HEAD}\nitem: A\ncommand: ${JSON.stringify(['echo', 'hello'])}\nduration: wrong` });
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: left }] }));
  r = run(['--', 'echo', 'hello']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /journal record\(s\) do not read clean and are left out/);
  assert.match(r.stderr, /took 0 s before/);
});

test('exec: the bound comes from the longest completed duration, never below the floor', () => {
  const home = mkdtempSync(join(tmpdir(), 'runs-exec-test-'));
  const backlog = join(home, 'bl.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: [
    { id: 'c1', body: recordBody({ item: 'A', command: JSON.stringify(['echo', 'hello']), started: '2026-10-09T10:00:00Z', duration: '45', result: 'exit 0', bound: '45' }) },
    { id: 'c2', body: recordBody({ item: 'A', command: JSON.stringify(['echo', 'hello']), started: '2026-10-09T10:10:00Z', duration: '20', result: 'exit 1', bound: '45' }) },
  ] }] }));
  const run = (args, timeout = 5000) => spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, ...args],
    { encoding: 'utf8', timeout });
  const r = run(['--', 'echo', 'hello']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo hello: bound 45 s, the longest of its runs \(took 45 s, 20 s before\)/);
});

test('exec: the floor keeps a bad near-zero record from stopping every later run', () => {
  const home = mkdtempSync(join(tmpdir(), 'runs-exec-test-'));
  const backlog = join(home, 'bl.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: [] }] }));
  const run = (...args) => spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, ...args],
    { encoding: 'utf8', timeout: 5000 });
  let r = run('--', 'echo', 'tight');
  assert.equal(r.status, 0);
  const body = r.stdout.split('== post on A\n', 2)[1];
  const model = JSON.parse(readFileSync(backlog));
  model.issues[0].comments.push({ id: 'c1', body });
  writeFileSync(backlog, JSON.stringify(model));
  r = run('--', 'echo', 'tight');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /exec echo tight: bound 10 s, the longest of its runs \(took 0 s before\)/);
});


test('exec: a detached descendant of the command is stopped with the group', () => {
  // The command keeps running while it detached a writer of its own, in its
  // own process group. Past the bound the whole command is stopped -- the
  // detached writer included -- and nothing of what the command started is
  // still writing after the stop.
  const home = mkdtempSync(join(tmpdir(), 'runs-exec-tree-'));
  const pidFile = join(home, 'pid');
  const marker = join(home, 'writes');
  const main = ['node', '-e',
    `const cp=require('node:child_process'); const ch=cp.spawn(process.execPath, ['-e', 'const fs=require("node:fs"); fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); const w=()=>fs.writeFileSync(${JSON.stringify(marker)}, "x"); w(); setInterval(w, 50);'], {detached: true, stdio: 'ignore'}); ch.unref(); setInterval(()=>{}, 1000);`];
  const backlog = join(home, 'bl.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: [
    // A prior run of the same command that ended of its own at 3 s: the bound
    // is the longest of those, floored, so this run stops at 10 s and the
    // detached writer must go with it.
    { id: 'c1', body: recordBody({ item: 'A', command: JSON.stringify(main), started: '2026-10-09T10:00:00Z', duration: '3', result: 'exit 0', bound: '10' }) },
  ] }] }));
  const run = () => spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, '--', ...main],
    { encoding: 'utf8', timeout: 30000, env: { ...process.env, NO_COLOR: '1' } });
  const r = run();
  assert.equal(r.status, 124);
  assert.match(r.stderr, /stopped after 10 s/);
  assert.match(r.stdout, /result: stopped/);
  // The detached writer was started and then stopped: its pid no longer
  // answers, within a moment of the command's stop.
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(Number.isFinite(pid));
  const gone = () => { try { process.kill(pid, 0); return false; } catch { return true; } };
  const stopped = Date.now();
  while (!gone() && Date.now() - stopped < 3000) {
    const until = Date.now() + 50;
    while (Date.now() < until);
  }
  assert.ok(gone(), 'the detached writer outlived its command stop');
});
test('exec: past the bound the command is stopped, its record does not loosen the bound', () => {
  const home = mkdtempSync(join(tmpdir(), 'runs-exec-test-'));
  const backlog = join(home, 'bl.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments: [
    { id: 'c1', body: recordBody({ item: 'A', command: JSON.stringify(['sleep', '12']), started: '2026-10-09T10:00:00Z', duration: '3', result: 'exit 0', bound: '10' }) },
  ] }] }));
  const run = () => spawnSync(process.execPath, [script.pathname, 'exec', '--item', 'A', '--backlog', backlog, '--', 'sleep', '12'],
    { encoding: 'utf8', timeout: 30000 });
  let r = run();
  assert.equal(r.status, 124);
  assert.match(r.stderr, /stopped after 10 s: this command took 3 s before/);
  assert.match(r.stdout, /result: stopped/);
  assert.match(r.stdout, /bound: 10/);
  // The stopped run is recorded, and it loosens nothing: the bound is still
  // set from the runs that had an end of their own.
  const body = r.stdout.split('== post on A\n', 2)[1];
  const comments = JSON.parse(readFileSync(backlog)).issues[0].comments;
  comments.push({ id: 'c2', body });
  writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'task', comments }] }));
  r = run();
  assert.equal(r.status, 124);
  assert.match(r.stderr, /stopped after 10 s: this command took 3 s before/);
});
