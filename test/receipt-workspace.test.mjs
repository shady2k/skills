import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { formatRecord, parseRecord } from '../skills/engineering/take-task/time-format.mjs';

const runs = fileURLToPath(new URL('../skills/engineering/take-task/runs.mjs', import.meta.url));
function fixture(t, location, present = true) {
  const root = mkdtempSync(join(tmpdir(), 'skills-workspace-receipt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = join(root, 'demo');
  const checkout = join(workspace, 'demo');
  const home = join(root, 'harness');
  const sessions = join(home, 'sessions');
  mkdirSync(checkout, { recursive: true });
  mkdirSync(sessions, { recursive: true });
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_SESSION_DIR: sessions };
  delete env.PI_SESSION_ID;
  const init = (cwd) => {
    const result = spawnSync('git', ['init', '-q', '-b', 'main'], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  init(checkout);
  let cwd = location === 'workspace' ? workspace : checkout;
  if (location === 'unmapped') {
    cwd = join(root, 'unrelated');
    mkdirSync(cwd);
  } else if (location === 'foreign') {
    cwd = join(workspace, 'foreign');
    mkdirSync(cwd);
    init(cwd);
  } else if (location === 'child') {
    cwd = join(workspace, 'notes');
    mkdirSync(cwd);
  } else if (location === 'historical') {
    cwd = join(root, 'scratch', 'demo');
    mkdirSync(cwd, { recursive: true });
    const remote = spawnSync('git', ['remote', 'add', 'origin', 'https://example.invalid/demo.git'], { cwd: checkout, env, encoding: 'utf8' });
    assert.equal(remote.status, 0, remote.stderr);
  }
  const from = '2026-01-01T10:00:00Z';
  const to = '2026-01-01T10:05:00Z';
  if (present) {
    const dir = join(sessions, '-workspace');
    mkdirSync(dir);
    if (location === 'historical') {
      writeFileSync(join(dir, '2026-01-01T10-00-00-000Z_gone-session.jsonl'), [
        { type: 'session', version: 3, id: 'gone-session', timestamp: from, cwd: join(cwd, 'old-clone'), git: { repoUrl: 'https://example.invalid/demo.git' } },
        { type: 'message', timestamp: to, message: { role: 'assistant', timestamp: Date.parse(from), completedAt: Date.parse(to), content: [{ type: 'text', text: 'old history' }] } },
      ].map((row) => JSON.stringify(row)).join('\n') + '\n');
    }
    writeFileSync(join(dir, '2026-01-01T10-00-00-000Z_workspace-session.jsonl'), [
      { type: 'session', version: 3, id: 'workspace-session', timestamp: from, cwd },
      { type: 'message', timestamp: from, message: { role: 'user', timestamp: Date.parse(from), content: [{ type: 'text', text: 'work on demo-abc' }] } },
      { type: 'message', timestamp: to, message: { role: 'assistant', timestamp: Date.parse(from), completedAt: Date.parse(to), content: [{ type: 'text', text: 'done' }] } },
    ].map((row) => JSON.stringify(row)).join('\n') + '\n');
    if (location === 'opaque') {
      rmSync(join(dir, '2026-01-01T10-00-00-000Z_workspace-session.jsonl'));
      const child = join(dir, 'parent-session');
      mkdirSync(child);
      writeFileSync(join(child, 'kid.jsonl'), '{unreadable identity\n');
    }
  }
  const backlog = join(root, 'backlog.json');
  writeFileSync(backlog, JSON.stringify({ issues: [{
    id: 'demo-abc', title: 'A receipt', type: 'task', status: 'active', labels: [], parent: null,
    blockedBy: [], body: '', updatedAt: from, comments: [{ id: 'claim', at: from, author: 'agent',
      body: formatRecord('claim', { span: '11111111', at: from, session: 'omp:workspace-session',
        agent: 'omp-worker:test@local:fix/receipt#workspace-session', role: 'worker' }, null) }],
  }] }));
  const invoke = (args) => {
    args = [...args, '--backlog', backlog, '--repo', checkout, '--json'];
    const result = spawnSync(process.execPath, [runs, ...args], {
      cwd: checkout, env, encoding: 'utf8', timeout: 30_000,
    });
    if (result.status !== 0) return { status: result.status, code: result.stderr.split(':')[0] };
    return { records: JSON.parse(result.stdout) };
  };
  return {
    receipt: (...extra) => invoke(['receipt', '--span', '11111111', '--end', 'finished', ...extra]),
    recover: (...extra) => invoke(['claim', '--recovered', '--item', 'demo-abc', '--role', 'worker', '--at', from, '--harness', 'omp', '--session', 'workspace-session', ...extra]),
  };
}

for (const location of ['checkout', 'workspace']) {
  test(`actual transcript stamps are measured from the owned ${location}`, (t) => {
    const result = fixture(t, location).receipt();
    const receipt = parseRecord(result.records[0].body);
    assert.deepEqual(receipt.problems, []);
    assert.equal(Date.parse(receipt.fields.to) - Date.parse(receipt.fields.from), 5 * 60_000);
    assert.equal(receipt.table.rows.total.total, 5);
    assert.equal(receipt.fields.unknown, undefined);
  });
}

for (const location of ['unmapped', 'foreign', 'child', 'historical']) {
  test(`a local ${location} transcript neither maps by item text nor becomes unknown`, (t) => {
    const run = fixture(t, location);
    assert.equal(run.receipt().code, 'TRANSCRIPT_UNMAPPED');
    assert.equal(run.receipt('--unknown', '--note', 'counterexample').code, 'TRANSCRIPT_UNMAPPED');
    assert.equal(run.recover('--basis', 'counterexample').code, 'TRANSCRIPT_UNMAPPED');
  });
}

test('an absent transcript stays distinct and follows the explicit unknown policy', (t) => {
  const run = fixture(t, 'unmapped', false);
  assert.equal(run.receipt().status, 3);
  const result = run.receipt('--unknown', '--note', 'the worker machine was wiped');
  const receipt = parseRecord(result.records[0].body);
  assert.deepEqual(receipt.problems, []);
  assert.equal(receipt.fields.unknown, 'yes');
  assert.equal(receipt.table, null);
});

test('an opaque transcript with unreadable identity cannot become missing or unknown', (t) => {
  const run = fixture(t, 'opaque');
  assert.equal(run.receipt().code, 'TRANSCRIPT_UNREADABLE');
  assert.equal(run.receipt('--unknown', '--note', 'counterexample').code, 'TRANSCRIPT_UNREADABLE');
  assert.equal(run.recover('--basis', 'counterexample').code, 'TRANSCRIPT_UNREADABLE');
});
