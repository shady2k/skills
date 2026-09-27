// The present-documents check on real git history: what it reads from a base
// and a head, and what its command line refuses.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const script = new URL('../skills/backlog/setup-shady2k-skills/check-present.mjs', import.meta.url).pathname;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'present-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const write = (path, text) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = (message) => { git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); };
  const config = (extra = {}) => {
    const path = join(dir, '.present.json');
    writeFileSync(path, JSON.stringify({ presentDocuments: ['docs/architecture.md', 'AGENTS.md'], ...extra }));
    return path;
  };
  const run = (...args) => spawnSync(process.execPath, [script, '--repo', dir, ...args], { encoding: 'utf8', env: runEnv });
  let runEnv = process.env;
  const withEnv = (env) => { runEnv = { ...process.env, ...env }; };
  return { dir, git, write, commit, config, run, withEnv, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('a change that removes what a document names is refused, older drift only reported', () => {
  const r = repo();
  try {
    r.write('src/billing/invoice.js', '');
    r.write('src/auth/token.js', '');
    r.write('docs/architecture.md', 'Invoices: `src/billing/invoice.js`. Tokens: [token](../src/auth/token.js). Old: `src/legacy/`.\n');
    r.write('AGENTS.md', 'Run from `src/auth/`; secrets in `src/auth/.env`, cache in `.cache/index`, which git does not keep.\n');
    r.write('.gitignore', '.env\n/.cache/\n');
    const base = r.commit('base');
    r.git('mv', 'src/auth', 'src/identity');
    r.commit('move auth');
    const cfg = r.config({ presentAreas: ['src'] });
    const refused = r.run('--config', cfg, '--base', base);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stdout, /new errors: 2/);
    assert.match(refused.stdout, /docs\/architecture\.md: `\.\.\/src\/auth\/token\.js`/);
    assert.match(refused.stdout, /AGENTS\.md: `src\/auth`/);
    assert.match(refused.stdout, /older dead references \(debt, not refused\): 1/);
    assert.match(refused.stdout, /areas no present document mentions: src\/identity/);

    r.write('docs/architecture.md', 'Invoices: `src/billing/invoice.js`. Tokens: [token](../src/identity/token.js). Old: `src/legacy/`.\n');
    r.write('AGENTS.md', 'Run from `src/identity/`; secrets in `src/identity/.env`, cache in `.cache/index`, which git does not keep.\n');
    r.commit('fix the documents');
    const fixed = r.run('--config', cfg, '--base', base, '--json');
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    const report = JSON.parse(fixed.stdout);
    assert.equal(report.newErrors, 0);
    assert.deepEqual(report.violations.map((v) => v.id), ['old-dead']);
  } finally { r.done(); }
});

test('a document left alone while files come and go under what it names is named to read', () => {
  const r = repo();
  try {
    r.write('src/core/engine.js', '0');
    r.write('docs/architecture.md', 'The core: `src/core/`.\n');
    r.write('AGENTS.md', 'Nothing named.\n');
    const base = r.commit('base');
    // Edits inside what it names do not age a document about structure.
    for (let i = 1; i <= 5; i++) { r.write('src/core/engine.js', String(i)); r.commit(`edit ${i}`); }
    for (let i = 1; i <= 3; i++) { r.write(`src/core/part${i}.js`, ''); r.commit(`part ${i}`); }
    r.write('README.md', 'unrelated');
    r.commit('unrelated');
    const aged = r.run('--config', r.config({ presentChurnCommits: 3 }), '--base', base);
    assert.equal(aged.status, 0, aged.stderr);
    assert.match(aged.stdout, /read against the code: docs\/architecture\.md \(3 commits/);
    const fresh = r.run('--config', r.config({ presentChurnCommits: 4 }), '--base', base);
    assert.doesNotMatch(fresh.stdout, /read against the code/);
  } finally { r.done(); }
});

test('misuse exits 2 and says what is missing', () => {
  const r = repo();
  try {
    r.write('docs/architecture.md', 'x\n');
    const base = r.commit('base');
    const empty = r.run('--config', r.config({ presentDocuments: [] }), '--base', base);
    assert.equal(empty.status, 2);
    assert.match(empty.stderr, /presentDocuments is empty/);
    const none = r.run('--config', r.config({ presentDocuments: ['nothing/*.md'] }), '--base', base);
    assert.equal(none.status, 2);
    assert.match(none.stderr, /no present document at the head/);
    assert.equal(r.run('--config', r.config(), '--base', 'no-such-revision').status, 2);
    assert.equal(r.run('--config', r.config()).status, 2);
    assert.equal(r.run('--config', r.config(), '--base', base, '--bogus').status, 2);
  } finally { r.done(); }
});

test('the verdict is the repository\'s, not the machine\'s, and a path beside its document is read there', () => {
  const r = repo();
  try {
    r.write('src/secret.txt', '');
    r.write('src/app.js', '');
    r.write('docs/architecture.md', 'Secret: `../src/secret.txt`. App: `../src/app.js`.\n');
    r.write('AGENTS.md', 'x\n');
    const base = r.commit('base');
    r.git('rm', '-q', 'src/secret.txt');
    r.commit('remove the secret');
    const plain = r.run('--config', r.config(), '--base', base);
    assert.equal(plain.status, 1, plain.stdout + plain.stderr);
    assert.match(plain.stdout, /docs\/architecture\.md: `\.\.\/src\/secret\.txt`/);
    // A global ignore file on this machine must not change the verdict.
    const home = join(r.dir, '.home');
    mkdirSync(home);
    writeFileSync(join(home, 'ignore'), 'secret.txt\n');
    writeFileSync(join(home, '.gitconfig'), `[core]\n\texcludesFile = ${join(home, 'ignore')}\n`);
    r.withEnv({ HOME: home, XDG_CONFIG_HOME: home });
    const machine = r.run('--config', r.config(), '--base', base);
    assert.equal(machine.status, 1, machine.stdout + machine.stderr);
  } finally { r.done(); }
});
