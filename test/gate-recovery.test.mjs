#!/usr/bin/env node
/**
 * The proof for the gate's recovery step: a check that guards shared work
 * refuses only what it cannot settle (item skills-0wfd, GitHub #31).
 *
 *   node test/gate-recovery.test.mjs [--keep] [--scratch <dir>]
 *
 * One code repository with two worktrees, sharing ONE backlog export. Both
 * worktrees run the real skills/engineering/take-task/runs.mjs with
 * --backlog <export> --project <name>, and the real
 * skills/backlog/setup-shady2k-skills/check.mjs with the fixture config.
 *
 * The entry point this test writes is the one setup tells a project to build:
 * `runs.mjs gaps --json` first, every record it prints under `recover` posted
 * to the export exactly as printed, and then the gate — whose own exit code is
 * the verdict. A recovery step that fails changes nothing: the gate still
 * judges, so a span no machine can recover still refuses, and nothing is
 * turned green by a failure.
 *
 * A session's transcript is written where its harness keeps them, under a
 * scratch HOME and CLAUDE_CONFIG_DIR, so the ledger's adapters read it as this
 * machine's (see skills/engineering/take-task/ledger.mjs and its --selftest).
 * The scratch directory is removed at the end unless --keep. One line per case
 * with PASS/FAIL; the script exits non-zero when any case fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKTREE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const RUNS = join(WORKTREE, 'skills/engineering/take-task/runs.mjs');
const GATE = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/check.mjs');
const GATE_CONFIG = join(WORKTREE, 'skills/backlog/setup-shady2k-skills/fixtures/config.json');
const LEDGER = join(WORKTREE, 'skills/engineering/take-task/ledger.mjs');
const PROJECT = 'demo';
const CHECK = 'time-span-unreceipted';

for (const f of [RUNS, GATE, GATE_CONFIG, LEDGER]) {
  if (!existsSync(f)) {
    console.error(`gate-recovery: ${f} is missing; there is nothing to prove.`);
    process.exit(2);
  }
}

const KEEP = process.argv.includes('--keep');
const scratchArg = process.argv.indexOf('--scratch');
const SCRATCH = scratchArg >= 0
  ? resolve(process.argv[scratchArg + 1])
  : join(tmpdir(), `gate-recovery-${process.pid}`);
mkdirSync(SCRATCH, { recursive: true });

// The proof runs the way a CI runner or a fresh container does: no global or
// system git configuration, an empty home, and none of the variables a harness
// names its own session with — so a mechanism that leaned on the person's
// configuration, or on this session's own transcript, would fail here.
const { sessionEnvVars } = await import('file://' + LEDGER);
process.env.HOME = join(SCRATCH, 'home');
mkdirSync(process.env.HOME, { recursive: true });
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.GIT_AUTHOR_NAME; delete process.env.GIT_AUTHOR_EMAIL;
delete process.env.GIT_COMMITTER_NAME; delete process.env.GIT_COMMITTER_EMAIL;
delete process.env.XDG_CONFIG_HOME;
for (const key of sessionEnvVars()) delete process.env[key];

// ---------------------------------------------------------------- results
let failures = 0;
function record(id, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + detail : ''}`);
}

// ---------------------------------------------------------------- helpers
function sh(cmd, args, { cwd, env } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...(env || {}) }, encoding: 'utf8' });
  return { code: r.status ?? 127, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', stderr: r.stderr || '' };
}
const node = (args, opts) => sh(process.execPath, args, opts);
function git(cwd, args) {
  return sh('git', ['-C', cwd, '-c', 'user.name=proof', '-c', 'user.email=proof@example.test', ...args]);
}
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const NOW = Date.now();
const T0 = NOW - 3 * 60 * 60e3;
const T1 = T0 + 60 * 60e3;

// One code repository with two worktrees, one backlog export, and this
// machine's Claude Code home for the case.
function newCase(name) {
  const dir = join(SCRATCH, name);
  const root = join(dir, 'demo');
  const wt = join(dir, 'demo-wt');
  const claude = join(dir, 'claude');
  const backlog = join(dir, 'backlog.json');
  mkdirSync(root, { recursive: true });
  mkdirSync(claude, { recursive: true });
  if (git(root, ['init', '-q', '-b', 'main']).code !== 0
    || git(root, ['commit', '-q', '--allow-empty', '-m', 'init']).code !== 0
    || git(root, ['worktree', 'add', '-q', '-b', 'work', wt]).code !== 0) {
    throw new Error(`case ${name}: the code repository with two worktrees could not be made`);
  }
  return { name, dir, root, wt, claude, backlog, report: join(dir, 'recovered.json') };
}

// A transcript of a session that worked on an item, in the shape Claude Code
// leaves them: <home>/projects/<working copy>/<session>.jsonl.
function transcript(ctx, cwd, sid, rows) {
  const d = join(ctx.claude, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${sid}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
function worked(cwd, startMs, minutes, item) {
  return [
    { type: 'user', timestamp: iso(startMs), cwd, origin: { kind: 'human' }, message: { content: `work on ${item}` } },
    { type: 'assistant', timestamp: iso(startMs + minutes * 0.4 * 60e3), attributionSkill: 'shady2k-skills:take-task',
      message: { id: 'm1', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } },
    { type: 'user', timestamp: iso(startMs + minutes * 60e3), message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] } },
    { type: 'system', subtype: 'turn_duration', timestamp: iso(startMs + minutes * 60e3), durationMs: minutes * 60e3 },
  ];
}

// A claim record in the format the run script writes, so a case can date a
// span without waiting for the clock.
const claimBody = (span, at, sid, agent) =>
  `[shady2k-time v1] claim\nspan: ${span}\nat: ${iso(at)}\nsession: claude-code:${sid}\nagent: ${agent}\nrole: worker`;

const epic = () => ({
  id: 'demo-f1', title: 'The feature', type: 'epic', status: 'active', labels: ['transport', 'v0-5'],
  parent: null, blockedBy: [], body: 'DONE WHEN the export can be read.', updatedAt: iso(NOW),
  holder: 'claude-coordinator:alex@laptop:work#c0',
});
const leaf = (id, holder, comments) => ({
  id, title: `Task ${id}`, type: 'task', status: 'active', labels: ['transport'], parent: 'demo-f1',
  blockedBy: [], body: '', updatedAt: iso(NOW), holder, ...(comments ? { comments } : {}),
});
function writeExport(ctx, issues) {
  writeFileSync(ctx.backlog, JSON.stringify({ generatedAt: iso(NOW), source: 'test/gate-recovery.test.mjs', issues }, null, 2));
  if (existsSync(ctx.report)) rmSync(ctx.report);
}
const readExport = (ctx) => JSON.parse(readFileSync(ctx.backlog, 'utf8'));

// The real run script, from a working copy of the project: what it prints is
// what the machine can recover.
function gaps(ctx, cwd) {
  const r = node([RUNS, 'gaps', '--json', '--backlog', ctx.backlog, '--project', PROJECT],
    { cwd, env: { CLAUDE_CONFIG_DIR: ctx.claude } });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* the case reports the exit code */ }
  return { ...r, json };
}
// The real gate, on the export, at block strength: its own exit code is the
// verdict, and 1 is a red backlog, 2 misuse.
function gate(ctx) {
  return node([GATE, '--config', GATE_CONFIG, '--strength', 'block', ctx.backlog],
    { cwd: ctx.wt, env: { CLAUDE_CONFIG_DIR: ctx.claude } });
}
// The project's entry point: recover, then judge. RECOVERY_FAULT makes its
// recovery step fail, which is the case a failure must never turn green.
function entry(ctx, { fault = '' } = {}) {
  return node([ENTRY, RUNS, GATE, GATE_CONFIG, ctx.backlog, PROJECT, ctx.wt],
    { cwd: ctx.wt, env: { CLAUDE_CONFIG_DIR: ctx.claude, RECOVERY_FAULT: fault, RECOVERY_REPORT: ctx.report } });
}
const recovered = (ctx) => {
  try { return JSON.parse(readFileSync(ctx.report, 'utf8')); } catch { return null; }
};
// The commit on the unrelated item Y: the entry point is the project's commit
// gate, so the commit happens only where that exits green.
function commitY(ctx) {
  writeFileSync(join(ctx.wt, 'notes.md'), 'notes for demo-y1\n');
  git(ctx.wt, ['add', 'notes.md']);
  const c = git(ctx.wt, ['commit', '-q', '-m', 'work on demo-y1']);
  return { committed: c.code === 0, out: c.out };
}
const headSubject = (ctx) => git(ctx.wt, ['log', '-1', '--format=%s']).stdout.trim();
const receiptsOn = (ctx, item) => ((readExport(ctx).issues.find((i) => i.id === item) || {}).comments || [])
  .filter((c) => /^\[shady2k-time v1\] receipt/.test(c.body));
const saysUnreceipted = (out) => new RegExp(`FAIL\\s+${CHECK}`).test(out) && /span a0000001 has ended with no receipt/.test(out);

// The entry point, written once: it is what setup tells a project to build,
// in a few lines, and nothing else.
const ENTRY = join(SCRATCH, 'entry.mjs');
writeFileSync(ENTRY, `#!/usr/bin/env node
/**
 * The project's gate entry point: recover every ended span this machine can,
 * then judge.
 *
 *   node entry.mjs <runs.mjs> <check.mjs> <config> <backlog> <project> <checkout>
 *
 * The gate's own exit code is the verdict. A recovery step that fails changes
 * nothing: the gate still judges, and the failure is never a pass.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const [runs, gate, config, backlog, project, checkout] = process.argv.slice(2);
const fault = process.env.RECOVERY_FAULT || '';
try {
  const g = spawnSync(process.execPath,
    [runs, 'gaps', '--json', '--backlog', fault === 'gaps' ? backlog + '.missing' : backlog, '--project', project],
    { cwd: checkout, encoding: 'utf8' });
  if (g.status !== 0) throw new Error('gaps exited ' + g.status);
  if (process.env.RECOVERY_REPORT) writeFileSync(process.env.RECOVERY_REPORT, g.stdout);
  const b = JSON.parse(readFileSync(backlog, 'utf8'));
  let n = 0;
  for (const rec of JSON.parse(g.stdout).recover) {
    const it = b.issues.find((i) => i.id === rec.item);
    if (!it) throw new Error('no item ' + rec.item + ' in the export');
    (it.comments ||= []).push({ id: 'rc-' + process.pid + '-' + (++n), at: new Date().toISOString(), author: 'agent', body: rec.body });
  }
  writeFileSync(fault === 'post' ? backlog + '/post-failed.json' : backlog, JSON.stringify(b, null, 2));
} catch (e) {
  process.stderr.write('entry: the recovery step failed (' + e.message + '); the gate still judges\\n');
}
const r = spawnSync(process.execPath, [gate, '--config', config, '--strength', 'block', backlog], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status === null ? 2 : r.status);
`);

// ---------------------------------------------------------------- case 1
//
// A claim on X by a session whose transcript IS on this machine, ended by a
// later claim on X, with no receipt. Until it is settled the check refuses the
// commit on the unrelated Y. The entry point recovers the span from the OTHER
// worktree's copy of the run script — the transcript is this machine's, so
// either worktree can read it — posts the receipt the script printed, and the
// commit lands.
const sameWindow = (a, b) => !!a && !!b && a.replace(/^recovered:.*$/m, '') === b.replace(/^recovered:.*$/m, '');

function case1() {
  const ctx = newCase('case-1');
  writeExport(ctx, [
    epic(),
    leaf('demo-x1', 'claude-worker:alex@other:work#sx2', [
      { id: 'c1', at: iso(T0), author: 'agent', body: claimBody('a0000001', T0, 'sx', 'claude-worker:alex@laptop:work#sx') },
      { id: 'c2', at: iso(T1), author: 'agent', body: claimBody('b0000001', T1, 'sx2', 'claude-worker:alex@other:work#sx2') },
    ]),
    leaf('demo-y1', 'claude-worker:alex@laptop:work#sy'),
  ]);
  transcript(ctx, ctx.root, 'sx', worked(ctx.root, T0, 60, 'demo-x1'));

  const before = gate(ctx);
  const fromRoot = gaps(ctx, ctx.root);
  const e = entry(ctx);
  const commit = e.code === 0 ? commitY(ctx) : { committed: false };
  const after = gate(ctx);
  const report = recovered(ctx);
  const printed = report?.recover?.[0]?.body || null;
  const posted = receiptsOn(ctx, 'demo-x1');
  const fromRootBody = fromRoot.json?.recover?.[0]?.body || null;

  const ok = before.code === 1 && saysUnreceipted(before.out)
    && fromRoot.code === 0 && fromRoot.json?.recover?.length === 1 && fromRoot.json.recover[0].item === 'demo-x1'
    && sameWindow(printed, fromRootBody)
    && e.code === 0
    && after.code === 0 && !saysUnreceipted(after.out)
    && commit.committed === true && headSubject(ctx) === 'work on demo-y1'
    && posted.length === 1 && posted[0].body === printed;
  return { ok, detail: `gate ${before.code} -> ${after.code}, recovered from either worktree, receipt on demo-x1 ${posted.length === 1 && posted[0].body === printed ? 'exactly as gaps printed' : 'MISSING OR CHANGED'}, commit on demo-y1 ${commit.committed ? 'landed' : 'REFUSED'}` };
}

// ---------------------------------------------------------------- case 2
//
// The same shape, but the session that claimed X left no transcript on this
// machine: nothing can settle it, so the commit on Y is still refused.
function case2() {
  const ctx = newCase('case-2');
  writeExport(ctx, [
    epic(),
    leaf('demo-x1', 'claude-worker:alex@other:work#sx2', [
      { id: 'c1', at: iso(T0), author: 'agent', body: claimBody('a0000001', T0, 'sx2', 'claude-worker:alex@other:work#sx2') },
      { id: 'c2', at: iso(T1), author: 'agent', body: claimBody('b0000001', T1, 'sx3', 'claude-worker:alex@laptop:work#sx3') },
    ]),
    leaf('demo-y1', 'claude-worker:alex@laptop:work#sy'),
  ]);

  const before = gate(ctx);
  const g = gaps(ctx, ctx.wt);
  const e = entry(ctx);
  const commit = e.code === 0 ? commitY(ctx) : { committed: false };
  const after = gate(ctx);
  const named = (g.json?.elsewhere || []).some((x) => x.item === 'demo-x1');

  const ok = before.code === 1 && saysUnreceipted(before.out)
    && g.code === 0 && g.json?.recover?.length === 0 && named
    && e.code === 1 && commit.committed === false && headSubject(ctx) === 'init'
    && after.code === 1 && saysUnreceipted(after.out) && receiptsOn(ctx, 'demo-x1').length === 0;
  return { ok, detail: `gate ${before.code} -> ${after.code}, gaps names demo-x1 ${named ? 'on another machine' : 'WRONGLY'}, entry point ${e.code}, commit on demo-y1 ${commit.committed ? 'LANDED' : 'refused'}` };
}

// ---------------------------------------------------------------- case 3
//
// A LIVE span: the session is still running, so its span has not ended. The
// recovery step must leave it alone — no receipt, no invented end — and the
// gate's verdict must be the one it gave before the step ran.
function case3() {
  const ctx = newCase('case-3');
  const z0 = NOW - 20 * 60e3;
  writeExport(ctx, [
    epic(),
    leaf('demo-z1', 'claude-worker:alex@laptop:work#slive', [
      { id: 'c1', at: iso(z0), author: 'agent', body: claimBody('z0000001', z0, 'slive', 'claude-worker:alex@laptop:work#slive') },
    ]),
    leaf('demo-y1', 'claude-worker:alex@laptop:work#sy'),
  ]);
  transcript(ctx, ctx.root, 'slive', worked(ctx.root, z0, 19, 'demo-z1'));

  const bytesBefore = readFileSync(ctx.backlog, 'utf8');
  const before = gate(ctx);
  const e = entry(ctx);
  const after = gate(ctx);
  const report = recovered(ctx);
  const untouched = readFileSync(ctx.backlog, 'utf8') === bytesBefore;

  const ok = before.code === 0 && after.code === 0 && e.code === 0
    && report?.recover?.length === 0 && report?.elsewhere?.length === 0
    && untouched && receiptsOn(ctx, 'demo-z1').length === 0;
  return { ok, detail: `verdict ${before.code} -> ${after.code}, spans recovered ${report?.recover?.length ?? '?'}, export ${untouched ? 'unchanged' : 'CHANGED'}, receipt on the live span ${receiptsOn(ctx, 'demo-z1').length}` };
}

// ---------------------------------------------------------------- case 4
//
// A recovery step that fails changes nothing: the verdict is the gate's own.
// The span here is the one no machine can recover, so the gate is red either
// way — and a failure is never a pass.
function case4() {
  const ctx = newCase('case-4');
  writeExport(ctx, [
    epic(),
    leaf('demo-x1', 'claude-worker:alex@other:work#sx2', [
      { id: 'c1', at: iso(T0), author: 'agent', body: claimBody('a0000001', T0, 'sx2', 'claude-worker:alex@other:work#sx2') },
      { id: 'c2', at: iso(T1), author: 'agent', body: claimBody('b0000001', T1, 'sx3', 'claude-worker:alex@laptop:work#sx3') },
    ]),
    leaf('demo-y1', 'claude-worker:alex@laptop:work#sy'),
  ]);

  const bytesBefore = readFileSync(ctx.backlog, 'utf8');
  const before = gate(ctx);
  const gapsFailed = entry(ctx, { fault: 'gaps' });
  const postFailed = entry(ctx, { fault: 'post' });
  const after = gate(ctx);
  const untouched = readFileSync(ctx.backlog, 'utf8') === bytesBefore;
  const said = (r) => /the recovery step failed/.test(r.out);

  const ok = before.code === 1 && saysUnreceipted(before.out)
    && gapsFailed.code === before.code && said(gapsFailed)
    && postFailed.code === before.code && said(postFailed)
    && after.code === 1 && saysUnreceipted(after.out)
    && untouched && receiptsOn(ctx, 'demo-x1').length === 0;
  return { ok, detail: `gate ${before.code}; gaps failing -> ${gapsFailed.code}, posting failing -> ${postFailed.code}, both as the gate gives it; after ${after.code}, export ${untouched ? 'untouched' : 'CHANGED'}` };
}

// ------------------------------------------------------------------- main
const CASES = [
  ['1-receipt-recovered-and-posted', case1],
  ['2-transcript-elsewhere-still-refused', case2],
  ['3-live-span-left-alone', case3],
  ['4-recovery-failure-fails-closed', case4],
];

function main() {
  for (const [id, fn] of CASES) {
    let r;
    try { r = fn(); } catch (e) { record(id, false, `threw: ${e && e.message}`); continue; }
    record(id, r.ok, r.detail);
  }
  console.log(`\n${CASES.length - failures}/${CASES.length} cases passed`);
  return failures ? 1 : 0;
}

process.on('exit', () => {
  if (!KEEP) { try { rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* best effort */ } }
});

process.exit(main());
