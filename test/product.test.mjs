// The product-documents check on a real repository: the working tree, what is
// staged for a commit, a revision, and what its command line refuses.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = new URL('../skills/backlog/setup-shady2k-skills/check-product.mjs', import.meta.url).pathname;
const good = new URL('../skills/backlog/setup-shady2k-skills/fixtures/product/good', import.meta.url).pathname;
const FR2 = 'docs/requirements/FR-002-listing-ends-at-closing.md';

function product() {
  const dir = mkdtempSync(join(tmpdir(), 'product-'));
  cpSync(good, dir, { recursive: true });
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-q', '-m', 'the example product');
  const run = (...args) => spawnSync(process.execPath, [script, '--root', dir, ...args], { encoding: 'utf8' });
  const edit = (path, from, to) => writeFileSync(join(dir, path), readFileSync(join(dir, path), 'utf8').replace(from, to));
  return { dir, git, run, edit, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('a clean product passes in every tree it can be read from', () => {
  const p = product();
  try {
    for (const args of [[], ['--staged'], ['--rev', 'HEAD']]) {
      const r = p.run(...args);
      assert.equal(r.status, 0, `${args.join(' ')}: ${r.stdout}${r.stderr}`);
      assert.match(r.stdout, /Product documents: clean/);
    }
  } finally { p.done(); }
});

test('a broken document is refused with its file and line, in the tree that holds it', () => {
  const p = product();
  try {
    p.edit(FR2, 'Verified by: test', 'Verified by: test\nStatus: done');
    const tree = p.run();
    assert.equal(tree.status, 1);
    assert.match(tree.stdout, new RegExp(`^${FR2}:5: error written-status: `, 'm'));
    assert.equal(p.run('--staged').status, 0, 'nothing staged yet: the index is still clean');
    p.git('add', FR2);
    const staged = p.run('--staged', '--json');
    assert.equal(staged.status, 1);
    const { findings } = JSON.parse(staged.stdout);
    assert.deepEqual(findings.map((f) => `${f.rule} ${f.file}:${f.line}`), [`written-status ${FR2}:5`]);
    assert.ok(findings[0].why, 'a refusal says what green looks like');
    assert.equal(p.run('--rev', 'HEAD').status, 0, 'the committed revision is still clean');
  } finally { p.done(); }
});

test('a note refuses nothing', () => {
  const p = product();
  try {
    p.edit('docs/hypotheses/H-001-owners-list-in-a-minute.md', '- S-001 L12 "it has to take a minute"',
      '- S-001 L12 "it has to take a minute"\n- S-002 "restaurants throw away a fifth of their food"');
    const r = p.run();
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /note outside-quote/);
    assert.match(r.stdout, /0 error\(s\), 1 note\(s\)/);
  } finally { p.done(); }
});

test('misuse exits 2 and says what is wrong', () => {
  const p = product();
  try {
    for (const args of [['--frobnicate'], ['--rev'], ['--staged', '--rev', 'HEAD'], ['--rev', 'no-such-revision'], ['--root', p.dir]]) {
      const r = p.run(...args);
      assert.equal(r.status, 2, `${args.join(' ')}: ${r.stdout}`);
      assert.match(r.stderr, /^check-product: \S/);
    }
    const missing = spawnSync(process.execPath, [script, '--root', join(p.dir, 'nothing')], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
  } finally { p.done(); }
});
