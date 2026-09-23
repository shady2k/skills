import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkDocuments, decided, digest, fixtureCases } from '../skills/backlog/setup-shady2k-skills/check-docs.mjs';
import { parseCapability, parseVision, parseMilestone } from '../skills/backlog/setup-shady2k-skills/document-format.mjs';

const script = new URL('../skills/backlog/setup-shady2k-skills/check-docs.mjs', import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'document-gate-test-'));
const run = (...args) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: 'utf8', timeout: 10000 });
const good = () => structuredClone(fixtureCases().find((c) => c.name === 'acceptance'));
const save = (name, value) => {
  const path = join(scratch, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
};

for (const c of fixtureCases()) test(`fixture ${c.name}`, () => {
  if (c.expected.includes('invalid-input')) assert.throws(() => checkDocuments(c.model, c.policy, c.evidence));
  else assert.deepEqual([...new Set(checkDocuments(c.model, c.policy, c.evidence).map((v) => v.id))].sort(), [...c.expected].sort());
});

test('digests are key-order independent, content-sensitive', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
});

test('changing a proposal invalidates prior approval', () => {
  const c = good();
  c.model.change.intent = 'Also support unattended export.';
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'missing-approval'));
});

test('changing policy invalidates prior receipts even when required IDs are unchanged', () => {
  const c = good();
  c.policy.requireApproval = false;
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'stale-evidence'));
});

test('every required receipt must be successful and retrievable', () => {
  for (const status of ['failed', 'skipped', 'unsupported']) {
    const c = good(); c.evidence.checks[0].status = status;
    assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'unproved-check'));
  }
  const c = good(); c.evidence.checks[0].reference = '';
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'unproved-check'));
});

test('closed schemas reject inherited names and unexpected success flags', () => {
  const c = good();
  c.model.change.constructor = true;
  assert.throws(() => checkDocuments(c.model, c.policy, c.evidence), /unknown field/);
});

test('CLI distinguishes clean, violations and malformed input', () => {
  const c = good();
  const input = save('model.json', c.model), policy = save('policy.json', c.policy), evidence = save('evidence.json', c.evidence);
  const args = ['--input', input, '--policy', policy, '--evidence', evidence, '--json'];
  const clean = run(...args);
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout).violations, []);
  c.model.change.openQuestions = ['Unsettled authorization boundary'];
  save('model.json', c.model);
  assert.equal(run(...args).status, 1);
  c.model.phase = 'skip'; save('model.json', c.model);
  assert.equal(run(...args).status, 2);
  writeFileSync(input, '{'); assert.equal(run(...args).status, 2);
});

test('CLI fails closed on all invocation mistakes', () => {
  const c = good(), input = save('cli-model.json', c.model), policy = save('cli-policy.json', c.policy);
  for (const args of [[], ['--bogus'], ['--input'], ['--input', input],
    ['--input', input, '--policy'], ['--input', input, '--policy', policy, '--policy', policy],
    ['--version', '--json'], ['--selftest', '--json'], ['--input', '/does-not-exist', '--policy', policy],
    ['--input', input, '--policy', policy, '--json', '--json']]) {
    const result = run(...args);
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
  }
});

const capabilityMarkdown = `# Export
Capability: export
## Purpose
Export selected records.
## Requirement: export-file — Export a file
A user can export the selected records.
### Scenario: selected
- Given: Some records are selected.
- When: The user exports them.
- Then: The file contains the selected records.
## Coverage limits
Only the current export flow has been examined.
`;

test('real Markdown capability parses to the normalized contract', () => {
  assert.deepEqual(parseCapability(capabilityMarkdown), good().model.baseline[0]);
});

test('removing a scenario from a document trips the real gate', () => {
  const c = good();
  const incomplete = capabilityMarkdown.replace(/### Scenario:[\s\S]*?## Coverage limits/, '## Coverage limits');
  c.model.baseline = c.model.current = [parseCapability(incomplete)];
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'missing-scenario'));
});

test('changed current Markdown cannot pass against an old delta', () => {
  const c = good();
  const modified = capabilityMarkdown.replace('A user can export the selected records.', 'Only administrators can export records.');
  c.model.baseline = c.model.current = [parseCapability(modified)];
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'stale-base'));
});

test('reader rejects unrecognized headings instead of silently dropping requirements', () => {
  assert.throws(() => parseCapability(capabilityMarkdown.replace('## Requirement:', '## Requirement typo:')), /unrecognized/);
  assert.throws(() => parseCapability(capabilityMarkdown.replace('### Scenario:', '#### Scenario:')), /unsupported/);
  assert.throws(() => parseCapability(capabilityMarkdown + '\n```'), /unclosed/);
  assert.throws(() => parseCapability(capabilityMarkdown.replace('- Given:', '- Given: \n- Given:')), /duplicate/);
});

test('fenced examples cannot invent requirements or vision sections', () => {
  const c = parseCapability(capabilityMarkdown.replace('Export selected records.', '```md\n## Requirement: fake — Not a contract\n```'));
  assert.equal(c.requirements.length, 1);
  assert.equal(parseVision('## Problem\nA problem\n```md\n## Audience\nFake\n```').audience, '');
});

test('vision/milestone missing fields remain missing and duplicates fail', () => {
  assert.deepEqual(parseVision('## Audience\nPeople'), { audience: 'People', problem: '', outcome: '', exclusions: '' });
  assert.deepEqual(parseMilestone('## Exclusions\nImport', 'first'), { id: 'first', outcomes: [], exclusions: 'Import' });
  assert.throws(() => parseVision('## Audience\nA\n## Audience\nB'), /duplicate/);
});

test('retained preparatory research needs evidence, not invented product requirements', () => {
  const c = good();
  c.model.project.vision = { audience: '', problem: '', outcome: '', exclusions: '' };
  c.model.project.milestone = { id: '', outcomes: [], exclusions: '' };
  c.model.baseline = c.model.current = [];
  Object.assign(c.model.change, { kind: 'supporting', rationale: 'Retain the bounded investigation results only.', deltas: [], preserves: [], coverage: [] });
  c.evidence.approvals[0].changeDigest = digest(decided(c.model.change));
  assert.deepEqual(checkDocuments(c.model, c.policy, c.evidence), []);
  c.evidence.checks = [];
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'unproved-check'));
});

test('supporting work cannot carry a product delta or change current requirements', () => {
  const c = good();
  c.model.change.kind = 'supporting'; c.model.change.rationale = 'Claimed documentation only';
  c.evidence.approvals[0].changeDigest = digest(decided(c.model.change));
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'change-kind'));
  c.model.change.deltas = []; c.model.change.coverage = [];
  c.model.current[0].requirements[0].statement = 'Different contract';
  c.evidence.approvals[0].changeDigest = digest(decided(c.model.change));
  assert.ok(checkDocuments(c.model, c.policy, c.evidence).some((v) => v.id === 'unsynced-current'));
});

test('the shipped templates parse once their identifiers are filled in, and their optional sections are recognized, not required', () => {
  const read = (n) => readFileSync(new URL(`../skills/backlog/setup-shady2k-skills/templates/${n}`, import.meta.url), 'utf8');
  const vision = parseVision(read('vision.md'));
  assert.ok(vision.audience && vision.problem && vision.outcome && vision.exclusions);
  const small = parseVision('## Audience\nA\n## Problem\nP\n## Outcome\nO\n## Exclusions\nE');
  assert.deepEqual(small, { audience: 'A', problem: 'P', outcome: 'O', exclusions: 'E' });
  assert.throws(() => parseVision('## Audience\nA\n## Personas\nX'), /unrecognized section: Personas/);
  assert.equal(parseMilestone(read('milestone.md'), 'm1').outcomes.length, 1);
  // A template is placeholders; with each identifier filled in, it parses.
  let n = 0;
  const filled = read('capability.md').replace(/<stable-id>/g, () => `id-${++n}`);
  const capability = parseCapability(filled);
  assert.equal(capability.requirements.length, 1);
  assert.equal(capability.requirements[0].scenarios.length, 1);
  const withQuality = capabilityMarkdown.replace('## Coverage limits', '## Quality requirements\nPerformance: not applicable.\n## Coverage limits');
  assert.deepEqual(parseCapability(withQuality), parseCapability(capabilityMarkdown));
  assert.throws(() => parseCapability(withQuality.replace('## Quality requirements\n', '## Quality requirements\n### Scenario: q1\n')), /unrecognized scenario/);
});
