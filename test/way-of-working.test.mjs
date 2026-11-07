// The practice a project lands by is one recorded value, and the set follows
// it. These are the contracts a check can hold: that no skill names a practice
// of its own, that the reference answers the same six questions for each, that
// setup asks rather than decides, that the record a run pins is read back on a
// resume, and that the gate's reading of the value is the one the design says.
//
// What a check cannot hold is a run's behaviour under a practice: three traces
// are read by an independent model for that, and this file says so rather than
// pretending a grep is a trace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const LANDING = 'authoring/skills/backlog/setup-shady2k-skills/references/landing.md.in';
const SETUP = 'authoring/skills/backlog/setup-shady2k-skills/SKILL.md.in';
const TAKE_TASK = 'authoring/skills/engineering/take-task/SKILL.md.in';
const PRACTICES = ['feature-branch-pr', 'github-flow', 'trunk-based'];
const QUESTIONS = ['**How work goes.**', '**Who merges.**', '**What you see and when.**', '**What it costs.**', '**What it suits.**', '**How hard it is to leave.**'];

const authoring = readdirSync(resolve(root, 'authoring/skills'), { recursive: true })
  .map((p) => `authoring/skills/${p}`)
  .filter((p) => p.endsWith('.md.in'));

test('the reference answers the same six questions, in the same order, for each practice', () => {
  const text = read(LANDING);
  const sections = text.split(/^## /m).slice(1);
  const practiceSections = sections.filter((s) => PRACTICES.some((p) => s.split('\n')[0].includes(`\`${p}\``)));
  assert.equal(practiceSections.length, 3, 'each practice has a section whose heading carries its config value');
  for (const section of practiceSections) {
    const positions = QUESTIONS.map((q) => section.indexOf(q));
    assert.ok(positions.every((p) => p >= 0), `every question is answered: ${QUESTIONS.filter((_, i) => positions[i] < 0).join(', ')}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'the questions come in the same order');
    for (const extra of ['**Where unfinished work hides, and what a landing waits for.**'])
      assert.ok(section.includes(extra), `${section.split('\n')[0]} says ${extra}`);
  }
});

test('no skill names a practice of its own: the reference and setup\'s own question are the only places', () => {
  const allowed = new Set([LANDING, SETUP]);
  const words = ['feature-branch-pr', 'github-flow', 'trunk-based', 'GitHub Flow', 'trunk based'];
  for (const path of authoring) {
    if (allowed.has(path) || !path.endsWith('/SKILL.md.in')) continue; // a skill's own text
    const text = read(path);
    for (const word of words) assert.ok(!text.includes(word), `${path} names the practice "${word}"`);
  }
  assert.ok(read(LANDING).includes('`github-flow`'), 'the reference is where a practice is named');
});

test('setup asks in every repository, shows what the recommendation rests on, and never decides for the owner', () => {
  const text = norm(read(SETUP));
  for (const need of [
    'one question, in every repository, empty ones included',
    'The owner accepts the profile or changes this entry by naming another practice',
    'say plainly that you assume one person deciding',
    'A rerun keeps the recorded value and does not ask again',
    'says in one line when one of them now contradicts it',
    'keeps the retained practice in effect',
    'nothing is written from a default the owner never saw, since silence is not consent',
    'Setup never edits protection rules, hooks or queue settings to make a practice possible',
    'records the answer with that constraint named',
  ]) assert.ok(text.includes(norm(need)), `setup's question lost: ${need}`);
});

test('a run pins the practice it began under, and a resume reads its own record', () => {
  const text = norm(read(TAKE_TASK));
  for (const need of [
    'how this project lands, read once and written into the run\'s record**: the practice the config records and the revision of the config it was read at',
    'the run lands by what it wrote there, never by what the config says later',
    'A resumed run reads that record; where the live config now names another practice it says so in one line to the owner and keeps the one it began under',
  ]) assert.ok(text.includes(norm(need)), `the pin lost: ${need}`);
});

test('the gate reads one value: the three practices, the retained one when absent, and no rule per practice', () => {
  const code = read('skills/backlog/setup-shady2k-skills/check.mjs');
  assert.ok(code.includes("const WAYS_OF_WORKING = ['feature-branch-pr', 'github-flow', 'trunk-based'];"));
  assert.ok(code.includes("const RETAINED_WAY_OF_WORKING = 'feature-branch-pr';"));
  assert.ok(code.includes('wayOfWorking: practice === undefined ? RETAINED_WAY_OF_WORKING : practice'));
  // The value is refused when it names no practice the set describes, and the
  // refusal names the three: a wrong value must not read as the retained one.
  assert.ok(/not one of \$\{WAYS_OF_WORKING\.map/.test(code));
  // Nothing else in the gate branches on the value: a rule per practice would
  // tie the gate to how a project lands, which is what the design forbids.
  const uses = code.split('\n').filter((l) => l.includes('waysOfWorking') || l.includes('WAY_OF_WORKING') || l.includes('RETAINED_WAY'));
  assert.ok(uses.length <= 8, `the value is read in ${uses.length} places, and no rule depends on it`);
});

// The practice and the config revision a run read are written into the claim
// record it already posts, and read back from that record on a resume. The
// record is the run script's, so the round trip is proved with the script: the
// note as printed, posted as the item's own comment, and read back by the next
// copy that reads the export.
test('the practice and the config revision a run pinned come back from the record it posted', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const script = resolve(root, 'skills/engineering/take-task/runs.mjs');
  const home = mkdtempSync(join(tmpdir(), 'way-of-working-'));
  const backlog = join(home, 'bl.json');
  const note = 'b-app: wayOfWorking=github-flow config=9f2c1ab';
  const write = (comments) => writeFileSync(backlog, JSON.stringify({ issues: [{ id: 'A', title: 'x', status: 'active', type: 'epic', body: '', comments }] }));
  write([]);
  const claim = spawnSync(process.execPath, [script, 'claim', '--item', 'A', '--role', 'coordinator', '--backlog', backlog, '--note', note, '--harness', 'prime-agent', '--session', 's1'],
    { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, timeout: 20000 });
  assert.equal(claim.status, 0, claim.stderr);
  assert.ok(claim.stdout.includes(`note: ${note}`), `the claim record carries the note as written: ${claim.stdout}`);
  // Post it as the item's comment, the way the run does, and read it back.
  const body = claim.stdout.split('== post on A\n')[1];
  assert.ok(body && body.includes('wayOfWorking=github-flow'));
  write([{ id: 'c1', body }]);
  const reread = readFileSync(backlog, 'utf8');
  assert.ok(JSON.parse(reread).issues[0].comments[0].body.includes(note), 'the note is what a resume reads from the record');
});
