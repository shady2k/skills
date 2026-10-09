#!/usr/bin/env node
// The walk a person with an agent takes from an empty folder: a draft product
// repository made under the products home they name, the product named in
// place, a product document refused at commit with its file and line and the
// fix passing, and the first code repository entered in the manifest, cloned
// into repos/ and found again from inside.
//
// It drives the real programs over real git in folders made for each test and
// removed in a finally, and swept at exit. Setup itself is a skill an agent
// runs; what a program can prove is that the files the skill works on behave.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const product = new URL('../skills/backlog/setup-shady2k-skills/product.mjs', import.meta.url).pathname;
const checkProduct = new URL('../skills/backlog/setup-shady2k-skills/check-product.mjs', import.meta.url).pathname;
const DAY = '2026-10-09';
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
const GIT_LEAKS = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'];

const scratches = [];

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'product-walk-'));
  scratches.push(dir);
  return dir;
}

function done(dir) {
  rmSync(dir, { recursive: true, force: true });
  const at = scratches.indexOf(dir);
  if (at >= 0) scratches.splice(at, 1);
}

process.on('exit', () => {
  for (const dir of scratches.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* the sweep is best effort */ }
  }
});

// The environment every git call and every run of a program gets: the
// machine's own environment without the loader variables git would follow,
// and with the test's identity in it.
function testerEnv() {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !GIT_LEAKS.includes(name)) env[name] = value;
  }
  return Object.assign(env, GIT_IDENTITY);
}

// One run of the product program over the real script.
function runProduct(...args) {
  const run = spawnSync(process.execPath, [product, ...args], { encoding: 'utf8', env: testerEnv() });
  run.id = /^id: (\S+)$/m.exec(run.stdout ?? '')?.[1];
  run.out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  return run;
}

// The product-documents check over what a commit would carry. It reads the
// index with git, so it runs with the product folder as its own directory.
function runCheck(folder, ...extra) {
  const run = spawnSync(process.execPath, [checkProduct, '--root', folder, '--staged', ...extra],
    { encoding: 'utf8', env: testerEnv(), cwd: folder });
  run.out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  return run;
}

// One git call the test makes itself, its stdout trimmed.
function git(folder, ...args) {
  const run = spawnSync('git', ['-C', folder, ...args], { encoding: 'utf8', env: testerEnv() });
  assert.equal(run.status, 0, `git ${args.join(' ')} in ${folder}: ${run.stderr}`);
  return run.stdout.trim();
}

// A draft already made under a home this test named.
function makeDraft(home) {
  const made = runProduct('new', '--home', home, '--date', DAY);
  assert.equal(made.status, 0, made.out);
  const folder = join(home, `idea-${DAY}`);
  return { folder, id: made.id };
}

// A local bare repository holding one commit, pushed from a scratch checkout:
// the url a manifest's `repos` names, and what bootstrap clones.
function publishedRepository(root, name = 'api') {
  const bare = join(root, `${name}.git`);
  const work = join(root, `${name}-work`);
  assert.equal(spawnSync('git', ['init', '--bare', '--quiet', '-b', 'main', bare], { encoding: 'utf8', env: testerEnv() }).status, 0);
  assert.equal(spawnSync('git', ['clone', '--quiet', bare, work], { encoding: 'utf8', env: testerEnv() }).status, 0);
  writeFileSync(join(work, `${name}.md`), `the ${name}\n`);
  git(work, 'add', `${name}.md`);
  git(work, 'commit', '-q', '-m', `the ${name}`);
  git(work, 'push', '-q', '-u', 'origin', 'main');
  assert.equal(git(bare, 'rev-list', '--all', '--count'), '1', 'the bare repository holds the pushed commit');
  return { bare, head: git(bare, 'rev-parse', 'HEAD') };
}

const VISION = [
  '# Leftovers: small cafes sell what is left at closing',
  '',
  '## Audience',
  '',
  'Owners of small cafes who throw food away every evening.',
  '',
  '## Problem',
  '',
  'Unsold portions are thrown away at closing, and the owner loses their cost.',
  '',
  '## Outcome',
  '',
  'A cafe lists what is left before closing, and people nearby buy it at a discount.',
  '',
  '## Exclusions',
  '',
  'Delivery, and chains with their own apps.',
  '',
].join('\n');

const QUESTION = [
  '# Q-001 — Who collects a portion nobody buys?',
  '',
  'Concerns: VISION',
  'Who can answer: the cafe owner',
  '',
  '## Question',
  '',
  'When the cafe closes with portions still listed, who takes what was not collected?',
  '',
  '## What settles it',
  '',
  "The owner's answer after the first week.",
  '',
].join('\n');

// ------------------------------------------------------------------- tests --

test('walk-a-draft-becomes-a-named-product: new makes it, rename names it in place and keeps its id', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const made = runProduct('new', '--home', home, '--date', DAY);
    assert.equal(made.status, 0, made.out);
    const draft = join(home, `idea-${DAY}`);
    assert.match(made.out, new RegExp(`^folder: ${draft}$`, 'm'));
    assert.match(made.out, /^id: [0-9a-f-]+$/m);
    assert.equal(git(draft, 'rev-list', '--count', 'HEAD'), '1', 'the draft is a repository with one commit');

    const readDraft = runProduct('read', draft);
    assert.equal(readDraft.status, 0, readDraft.out);
    assert.match(readDraft.out, new RegExp(`^name: idea-${DAY}$`, 'm'), 'a draft is named after its folder');

    const named = runProduct('rename', draft, 'leftover-listings');
    assert.equal(named.status, 0, named.out);
    const product = join(home, 'leftover-listings');
    assert.equal(existsSync(draft), false, 'the draft folder moved');
    assert.ok(existsSync(product), 'the product stands under its new name');

    const read = runProduct('read', product);
    assert.equal(read.status, 0, read.out);
    assert.match(read.out, new RegExp(`^folder: ${product}$`, 'm'));
    assert.match(read.out, new RegExp(`^name: leftover-listings$`, 'm'));
    assert.match(read.out, new RegExp(`^id: ${made.id}$`, 'm'), 'the id the draft was given is kept');
    assert.equal(git(product, 'show', '-s', '--format=%s', 'HEAD'), 'Name the product leftover-listings');
  } finally { done(root); }
});

test('walk-a-broken-product-document-is-refused-at-commit: with its file and line, and the fix passes', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    writeFileSync(join(folder, 'docs', 'vision.md'), VISION);
    const question = join(folder, 'docs', 'questions', 'Q-001-who-collects-unclaimed.md');
    mkdirSync(join(folder, 'docs', 'questions'), { recursive: true });
    // The deliberate error: a Status: field, where status is computed from the
    // links and never written.
    writeFileSync(question, QUESTION.replace('Who can answer: the cafe owner\n',
      'Who can answer: the cafe owner\nStatus: open\n'));
    git(folder, 'add', 'docs/vision.md', 'docs/questions/Q-001-who-collects-unclaimed.md');

    const refused = runCheck(folder);
    assert.equal(refused.status, 1, `the check refuses what is staged: ${refused.out}`);
    assert.match(refused.out, /docs\/questions\/Q-001-who-collects-unclaimed\.md:5:/,
      'the refusal names the document and the line the field stands on');
    assert.match(refused.out, /written-status/, 'and the rule it breaks');
    assert.match(refused.out, /remove the Status: field/, 'and what would make it green');

    // The fix in the working tree alone changes nothing: what a commit would
    // carry is the index, and the index still holds the document as it was.
    writeFileSync(question, QUESTION);
    const unstaged = runCheck(folder);
    assert.equal(unstaged.status, 1, 'the check reads the index, not the working tree');
    assert.match(unstaged.out, /written-status/, 'the staged document is the one judged');

    git(folder, 'add', 'docs/questions/Q-001-who-collects-unclaimed.md');
    const fixed = runCheck(folder);
    assert.equal(fixed.status, 0, `the fixed document passes: ${fixed.out}`);
    assert.match(fixed.out, /clean/, 'and the check says so');

    git(folder, 'commit', '-q', '-m', 'the vision and its first open question');
    assert.equal(git(folder, 'status', '--porcelain'), '', 'the product repository is clean');
  } finally { done(root); }
});

test('walk-the-first-code-repository: entered in the manifest, cloned into repos/, and found from inside', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    const product = join(home, 'leftover-listings');
    const named = runProduct('rename', folder, 'leftover-listings');
    assert.equal(named.status, 0, named.out);

    const { bare, head } = publishedRepository(root);
    const entered = runProduct('repo', 'add', product, 'api', bare, '--branch', 'main');
    assert.equal(entered.status, 0, entered.out);
    assert.match(entered.out, /^name: api$/m);
    assert.match(entered.out, new RegExp(`^url: ${bare}$`, 'm'));
    assert.equal(git(product, 'show', '-s', '--format=%s', 'HEAD'), 'Enter the code repository api');

    const read = runProduct('read', '--json', product);
    assert.equal(read.status, 0, read.out);
    assert.equal(JSON.parse(read.stdout).name, 'leftover-listings', 'the product reads back with the repository in its manifest');
    assert.match(readFileSync(join(product, 'workspace.yaml'), 'utf8'), /^repos:\n {2}- name: api\n {4}url: /m,
      'the manifest holds the repository the plan entered');

    const bootstrapped = runProduct('bootstrap', product);
    assert.equal(bootstrapped.status, 0, bootstrapped.out);
    assert.match(bootstrapped.out, /^repo: api cloned$/m, 'the declared repository is cloned');
    const checkout = join(product, 'repos', 'api');
    assert.ok(existsSync(checkout), 'the checkout stands under repos/');
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), head, 'it is the repository the manifest named');

    const inside = runProduct('where', checkout);
    assert.equal(inside.status, 0, inside.out);
    assert.match(inside.out, /^where: code$/m);
    assert.match(inside.out, new RegExp(`^product: ${product}$`, 'm'));
    assert.match(inside.out, /^repo: api$/m);
    const src = join(checkout, 'src');
    mkdirSync(src);
    const deeper = runProduct('where', src);
    assert.equal(deeper.status, 0, deeper.out);
    assert.match(deeper.out, /^where: code$/m, 'a folder inside the checkout is still the code repository');

    const atRoot = runProduct('where', product);
    assert.equal(atRoot.status, 0, atRoot.out);
    assert.match(atRoot.out, /^where: product$/m);
    assert.match(atRoot.out, new RegExp(`^product: ${product}$`, 'm'));

    const elsewhere = runProduct('where', root);
    assert.equal(elsewhere.status, 0, elsewhere.out);
    assert.match(elsewhere.out, /^where: none$/m);
  } finally { done(root); }
});
