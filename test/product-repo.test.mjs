#!/usr/bin/env node
// The product repository's lifecycle, run as the command line: the draft made
// under a products home, the manifest read back, the name given in place, the
// remote added without pushing it, the declared code repositories cloned, and
// every misuse the command line refuses. Real git in folders made for each
// test and removed in a finally, and swept at exit.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PLUGIN_VERSION, PRODUCT_SCHEMA_VERSION, readProduct } from '../skills/backlog/setup-shady2k-skills/product.mjs';

const script = new URL('../skills/backlog/setup-shady2k-skills/product.mjs', import.meta.url).pathname;
const DAY = '2026-10-09';
const draftName = (n = 1) => `idea-${DAY}${n === 1 ? '' : `-${n}`}`;
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
const GIT_LEAKS = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'];

const scratches = [];

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'product-repo-'));
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

// The environment every git call and every run of the program gets: the
// machine's own environment without the loader variables git would follow,
// and with the test's identity in it.
function testerEnv() {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !GIT_LEAKS.includes(name)) env[name] = value;
  }
  return Object.assign(env, GIT_IDENTITY);
}

// One run of the program over the real script. `bin`, when it was set by an
// earlier test, puts the stub git first on the PATH that run sees.
runProgram.bin = undefined;

function runProgram(...args) {
  const env = testerEnv();
  if (runProgram.bin !== undefined) env.PATH = `${runProgram.bin}:${process.env.PATH ?? ''}`;
  const run = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
  run.id = /^id: (\S+)$/m.exec(run.stdout ?? '')?.[1];
  return run;
}

// One git call the test makes itself, its stdout trimmed.
function git(folder, ...args) {
  const run = spawnSync('git', ['-C', folder, ...args], { encoding: 'utf8', env: testerEnv() });
  assert.equal(run.status, 0, `git ${args.join(' ')} in ${folder}: ${run.stderr}`);
  return run.stdout.trim();
}

// A draft already made under a home this test named.
function makeDraft(home, number = 1) {
  const made = runProgram('new', '--home', home, '--date', DAY);
  assert.equal(made.status, 0, made.stderr ?? made.stdout);
  const folder = join(home, draftName(number));
  return { folder, id: made.id };
}

// A local bare repository holding one commit, pushed from a scratch checkout:
// the url a manifest's `repos` names.
function publishedRepository(root, name = 'api') {
  const bare = join(root, `${name}.git`);
  const work = join(root, `${name}-work`);
  {
    const init = spawnSync('git', ['init', '--bare', '--quiet', '-b', 'main', bare], { encoding: 'utf8', env: testerEnv() });
    assert.equal(init.status, 0, init.stderr);
  }
  spawnSync('git', ['clone', '--quiet', bare, work], { encoding: 'utf8', env: testerEnv() });
  writeFileSync(join(work, `${name}.md`), `the ${name}\n`);
  git(work, 'add', `${name}.md`);
  git(work, 'commit', '-q', '-m', `the ${name}`);
  git(work, 'push', '-q', '-u', 'origin', 'main');
  assert.equal(git(bare, 'rev-list', '--all', '--count'), '1', 'the bare repository holds the pushed commit');
  return { bare, head: git(bare, 'rev-parse', 'HEAD') };
}

// A draft whose manifest was rewritten to the text given and committed, since
// bootstrap reads what the commit holds. The home is the caller's, so a test
// can hold two products side by side.
function draftWithManifest(home, text) {
  const { folder } = makeDraft(home);
  writeFileSync(join(folder, 'workspace.yaml'), text);
  git(folder, 'add', 'workspace.yaml');
  git(folder, 'commit', '-q', '-m', 'declare the repositories');
  return folder;
}

// A snapshot of the state a refusal must leave unchanged.
const snapshot = (folder) => ({
  manifest: readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
  commits: git(folder, 'rev-list', '--count', 'HEAD'),
});

function unchangedFrom(folder, before) {
  assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'), before.manifest, 'the manifest is back as it was');
  assert.equal(git(folder, 'rev-list', '--count', 'HEAD'), before.commits, 'no commit was added');
}

const filesUnder = (start) => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) walk(path);
      else found.push(path);
    }
  };
  walk(start);
  return found;
};

// ------------------------------------------------------------------- tests --

test('new-draft: one created repository, one commit, the empty folders and repos/ ignored', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const made = runProgram('new', '--home', home, '--date', DAY);
    assert.equal(made.status, 0, `${made.stdout}${made.stderr}`);
    const folder = join(home, draftName());
    assert.match(made.stdout, new RegExp(`^folder: ${folder}$`, 'm'));
    assert.match(made.stdout, /^id: [0-9a-f-]+$/m);

    assert.equal(git(folder, 'rev-list', '--count', 'HEAD'), '1', 'the draft holds exactly one commit');
    assert.equal(
      git(folder, 'ls-tree', '-r', 'HEAD', '--name-only'),
      ['AGENTS.md', 'CLAUDE.md', '.gitignore', 'workspace.yaml', 'docs/.gitkeep', 'model/.gitkeep', 'skills/.gitkeep', 'prototypes/.gitkeep'].sort().join('\n'),
      'the one commit holds the constitution, the manifest, the .gitignore and the empty folders',
    );
    for (const file of ['docs/.gitkeep', 'model/.gitkeep', 'skills/.gitkeep', 'prototypes/.gitkeep'])
      assert.equal(readFileSync(join(folder, file), 'utf8'), '', `${file} is empty`);
    assert.equal(existsSync(join(folder, 'repos')), true, 'repos/ exists on disk');
    const ignored = spawnSync('git', ['-C', folder, 'check-ignore', '-q', 'repos/'], { encoding: 'utf8', env: testerEnv() });
    assert.equal(ignored.status, 0, 'git ignores repos/ through the .gitignore the commit holds');
    assert.equal(git(folder, 'status', '--porcelain'), '', 'nothing stands outside the one commit');
    assert.equal(git(folder, 'status', '--ignored=matching', '--porcelain'), '!! repos/', 'and repos/ is the one ignored thing');
  } finally { done(root); }
});

test('second-draft-that-day: the next name with its own id and its own commit, then the third', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const first = makeDraft(home, 1);
    const second = runProgram('new', '--home', home, '--date', DAY);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, new RegExp(`^folder: ${join(home, draftName(2))}$`, 'm'), 'the second run names its own folder');
    assert.ok(second.id !== undefined && second.id !== first.id, 'the second draft holds its own uuid');
    assert.equal(git(join(home, draftName(2)), 'rev-list', '--count', 'HEAD'), '1', 'its own single commit');
    const third = runProgram('new', '--home', home, '--date', DAY);
    assert.equal(third.status, 0, third.stderr);
    assert.match(third.stdout, new RegExp(`^folder: ${join(home, draftName(3))}$`, 'm'));
    assert.equal(git(join(home, draftName(3)), 'rev-list', '--count', 'HEAD'), '1', 'the third draft holds its own commit');
  } finally { done(root); }
});

test('home-not-usable: a file where the home belongs is refused, and nothing is written beside it', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    writeFileSync(home, 'a file, not a folder\n');
    const made = runProgram('new', '--home', home, '--date', DAY);
    assert.equal(made.status, 2, made.stdout);
    assert.ok(made.stderr.includes(home.slice(1)), `the refusal names the home: ${made.stderr}`);
    assert.equal(existsSync(join(root, draftName())), false, 'no folder starting idea- exists beside the file');
  } finally { done(root); }
});

test('framing-commit-fails: git says what it refused, and the folder the run reserved is gone', () => {
  const root = scratch();
  try {
    const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    assert.ok(realGit, 'the real git is on the PATH this box holds');
    const bin = join(root, 'bin');
    spawnSync('mkdir', ['-p', bin]);
    const stub = join(bin, 'git');
    const stubText = [
      '#!/bin/sh',
      'if [ "$1" = "commit" ]; then',
      "  echo 'stub: refusing to commit' >&2",
      '  exit 1',
      'fi',
      `exec '${realGit}' "$@"`,
      '',
    ].join('\n');
    writeFileSync(stub, stubText);
    spawnSync('chmod', ['+x', stub]);
    // Without the stub: the control run succeeds.
    runProgram.bin = undefined;
    const home = join(root, 'home');
    const made = runProgram('new', '--home', home, '--date', DAY);
    assert.equal(made.status, 0, made.stderr);
    assert.equal(existsSync(join(home, draftName())), true, 'the control draft stands');
    // With the stub: the commit is refused and the draft is gone.
    runProgram.bin = bin;
    const two = join(root, 'home-2');
    const refused = runProgram('new', '--home', two, '--date', DAY);
    runProgram.bin = undefined;
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /stub: refusing to commit/, 'git says its own words');
    assert.match(refused.stderr, /idea-2026-10-09/, 'the refusal names the run it was in');
    assert.equal(existsSync(join(two, draftName())), false, 'the folder the failed run reserved is gone');
  } finally { done(root); }
});

test('draft-manifest: read prints the id the command printed, the name and the schema version', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const read = runProgram('read', folder);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, new RegExp(`^folder: ${folder}$`, 'm'));
    assert.match(read.stdout, new RegExp(`^id: ${id}$`, 'm'));
    assert.match(read.stdout, /^name: idea-2026-10-09$/m);
    assert.match(read.stdout, /^schemaVersion: 1$/m);

    const asJson = runProgram('read', '--json', folder);
    assert.equal(asJson.status, 0, asJson.stderr);
    const facts = JSON.parse(asJson.stdout);
    assert.deepEqual(Object.keys(facts).sort(), ['folder', 'id', 'name', 'schemaVersion'], 'the four facts and no other');
    assert.equal(facts.id, id);
    assert.equal(facts.name, 'idea-2026-10-09');
    assert.equal(facts.schemaVersion, 1);
    // The library reads the same four facts from the same manifest.
    const library = readProduct(folder);
    assert.equal(library.ok, true, library.message);
    assert.deepEqual(
      { id: library.product.id, name: library.product.name, schemaVersion: library.product.schemaVersion },
      { id, name: 'idea-2026-10-09', schemaVersion: 1 },
    );
  } finally { done(root); }
});

test('manifest-without-id: a manifest that names no id is refused, workspace.yaml and id named', () => {
  const root = scratch();
  try {
    const folder = draftWithManifest(join(root, 'home'), 'schemaVersion: 1\n');
    const before = snapshot(folder);
    const read = runProgram('read', folder);
    assert.equal(read.status, 2, read.stdout);
    assert.match(read.stderr, /workspace\.yaml/);
    assert.match(read.stderr, /\bid\b/);
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('no-manifest: the folder named is refused, and the file it looked for is named', () => {
  const root = scratch();
  try {
    const folder = join(root, 'a folder with no manifest');
    spawnSync('mkdir', ['-p', folder]);
    const read = runProgram('read', folder);
    assert.equal(read.status, 2, read.stdout);
    assert.match(read.stderr, /workspace\.yaml/, 'the file it looked for');
    assert.ok(read.stderr.includes(folder.slice(1)), `the folder it looked in: ${read.stderr}`);
  } finally { done(root); }
});

test('unreadable-manifest: a manifest that cannot be read is refused, with the file and the line', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    rmSync(join(folder, 'workspace.yaml'));
    spawnSync('mkdir', ['-p', join(folder, 'workspace.yaml')]);
    const manifestFile = join(folder, 'workspace.yaml');

    const read = runProgram('read', folder);
    assert.equal(read.status, 2, read.stdout);
    assert.ok(read.stderr.includes(manifestFile.slice(1)), `the refusal names the file: ${read.stderr}`);
    assert.match(read.stderr, /could not be read/);

    const asJson = runProgram('read', '--json', folder);
    assert.equal(asJson.status, 2, asJson.stderr);
    const error = JSON.parse(asJson.stdout).error;
    assert.equal(error.file, manifestFile, 'the file the read stopped at');
    assert.equal(error.line, 1, 'the line it stopped on, where none is known');
  } finally { done(root); }
});

test('refusal-carries-where-it-was-found: every command\'s --json error holds the file and the line', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    writeFileSync(join(folder, 'workspace.yaml'), 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: 5\n');
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with a name that is a number');
    const manifestFile = join(folder, 'workspace.yaml');

    const wordFor = { rename: ['rename', folder, 'quiet-name'], remote: ['remote', folder, 'https://example.invalid/p.git'], bootstrap: ['bootstrap', folder] };
    for (const [command, args] of Object.entries(wordFor)) {
      const run = runProgram(...args, '--json');
      assert.equal(run.status, 2, `${command}: ${run.stdout}`);
      const error = JSON.parse(run.stdout).error;
      assert.ok(error.file.endsWith('workspace.yaml'), `${command}: ${JSON.stringify(error)}`);
      assert.equal(error.file, manifestFile, `${command} names the manifest it refused`);
      assert.equal(error.line, 3, `${command} names the line the name stood on`);
      assert.match(error.message, /"name"/, `${command} names the field the fault is at`);
    }
  } finally { done(root); }
});

test('refusal-names-where-first: the text output opens with the file and the line, as the checks do', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    writeFileSync(join(folder, 'workspace.yaml'), 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: 5\n');
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with a name that is a number');

    const read = runProgram('read', folder);
    assert.equal(read.status, 2, read.stdout);
    const first = read.stderr.split('\n')[0];
    const pattern = new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/workspace\.yaml:3: `);
    assert.ok(pattern.test(first), `the first line opens with where: ${JSON.stringify(read.stderr)}`);
  } finally { done(root); }
});

test('manifest-grows: fields beside the ones this program knows are read and passed', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    writeFileSync(join(folder, 'workspace.yaml'), `schemaVersion: 1\nid: ${id}\nownField: a plain word\nnested:\n  deep: value\n`);
    const read = runProgram('read', folder);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, new RegExp(`^id: ${id}$`, 'm'));
    assert.match(read.stdout, /^name: idea-2026-10-09$/m);

    const asJson = runProgram('read', '--json', folder);
    assert.equal(asJson.status, 0, asJson.stderr);
    const facts = JSON.parse(asJson.stdout);
    assert.equal(facts.id, id, 'the id stands in the grown manifest');
    assert.equal(facts.name, 'idea-2026-10-09');
  } finally { done(root); }
});

test('constitution-is-written-once: the folders and what each is for, and the markers as lines', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const text = readFileSync(join(folder, 'AGENTS.md'), 'utf8');
    for (const word of ['docs/', 'model/', 'skills/', 'prototypes/', 'repos/'])
      assert.ok(text.includes(word), `the constitution names ${word}`);
    assert.match(text, /skills\/ .{0,80}the team's own skills/, "what skills/ is for: the team's own");
    assert.match(text, /never a copy/, 'never a copy of the set');
    const lines = text.split('\n');
    assert.ok(lines.includes('<!-- product:maintained -->'), 'the opening marker is a line of its own');
    assert.ok(lines.includes('<!-- /product:maintained -->'), 'the closing marker is a line of its own');
  } finally { done(root); }
});

test('no-absolute-path: nothing the command wrote holds the home, and git grep of HEAD finds none', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    for (const file of filesUnder(folder)) {
      const text = readFileSync(file, 'utf8');
      assert.ok(!text.includes(home), `${file} holds no absolute path of the home`);
      assert.ok(!text.includes(root), `${file} holds no absolute path of the scratch root either`);
    }
    // git grep finds nothing and exits 1 when the commit holds no match; the
    // helper above asserts on a failing git, so this one is read raw.
    const search = spawnSync('git', ['-C', folder, 'grep', '-I', '--fixed-strings', '-e', home, 'HEAD'],
      { encoding: 'utf8', env: testerEnv() });
    assert.equal(search.status, 1, `git grep exits 1 when it finds no match: ${search.stderr}`);
    assert.equal(search.stdout, '', 'and prints no match');
  } finally { done(root); }
});

test('rename: the folder renamed in place, the manifest named, one commit more, and every refusal changes nothing', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const manifest = readFileSync(join(folder, 'workspace.yaml'), 'utf8');
    const commits = git(folder, 'rev-list', '--count', 'HEAD');

    const made = runProgram('rename', folder, 'quiet-harbor');
    assert.equal(made.status, 0, made.stderr);
    const renamedTo = join(home, 'quiet-harbor');
    assert.equal(existsSync(folder), false, 'the old name is gone');
    assert.equal(existsSync(renamedTo), true, 'the folder is renamed within its parent');
    assert.match(made.stdout, new RegExp(`^folder: ${renamedTo}$`, 'm'));

    const written = readFileSync(join(renamedTo, 'workspace.yaml'), 'utf8');
    assert.equal(written, manifest.replace(/^name:.*$/m, 'name: quiet-harbor'), 'every byte of the manifest but the name is unchanged');
    assert.match(written, new RegExp(`^id: ${id}$`, 'm'), 'the id is unchanged');
    assert.equal(git(renamedTo, 'rev-list', '--count', 'HEAD'), String(Number(commits) + 1), 'one commit more');
    assert.equal(git(renamedTo, 'status', '--porcelain'), '', 'nothing is left uncommitted');

    // The refusals, each changing nothing.
    const taker = join(home, 'taken-name');
    spawnSync('mkdir', ['-p', taker]);
    const snapshotTaken = snapshot(renamedTo);
    const takenRun = runProgram('rename', renamedTo, 'taken-name');
    assert.equal(takenRun.status, 2, takenRun.stdout);
    assert.match(takenRun.stderr, /taken-name/);
    unchangedFrom(renamedTo, snapshotTaken);
    assert.equal(existsSync(join(home, 'taken-name')), true, 'the folder in the way still stands');

    writeFileSync(join(renamedTo, 'prototypes', 'note.md'), 'an uncommitted note\n');
    const dirtyRun = runProgram('rename', renamedTo, 'another-name');
    assert.equal(dirtyRun.status, 2, dirtyRun.stdout);
    assert.match(dirtyRun.stderr, /changes that are not committed|uncommitted/);
    assert.equal(readFileSync(join(renamedTo, 'prototypes', 'note.md'), 'utf8'), 'an uncommitted note\n', 'the uncommitted note is still there');
    rmSync(join(renamedTo, 'prototypes', 'note.md'));

    const snapshotNow = snapshot(renamedTo);
    const slashRun = runProgram('rename', renamedTo, 'two/names');
    assert.equal(slashRun.status, 2, slashRun.stdout);
    assert.match(slashRun.stderr, /two\/names/);
    assert.equal(git(renamedTo, 'rev-list', '--count', 'HEAD'), snapshotNow.commits, 'no commit came of a refused name');
    assert.equal(existsSync(join(home, 'two')), false, 'no folder of that name was made');
    assert.equal(existsSync(renamedTo), true, 'and the product still stands in its own folder');

    const sameNameRun = runProgram('rename', renamedTo, 'quiet-harbor');
    assert.equal(sameNameRun.status, 2, sameNameRun.stdout);
    assert.match(sameNameRun.stderr, /quiet-harbor/);
    unchangedFrom(renamedTo, snapshotNow);
  } finally { done(root); }
});

test('remote: origin added, a second refused, and nothing was pushed', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const published = publishedRepository(root, 'far-side');
    const snapshotBefore = snapshot(folder);

    const made = runProgram('remote', folder, published.bare);
    assert.equal(made.status, 0, made.stderr);
    assert.equal(git(folder, 'remote'), 'origin', 'the remote the command adds');
    assert.equal(git(folder, 'remote', 'get-url', 'origin'), published.bare, 'at the url the command was given');

    const second = runProgram('remote', folder, published.bare);
    assert.equal(second.status, 2, second.stdout);
    assert.match(second.stderr, /origin/, 'the refusal names the remote that is already there');
    unchangedFrom(folder, snapshotBefore);

    // It never pushed: the bare repository still holds only the one commit
    // that was pushed to it before the run, on the branch it was pushed to.
    assert.equal(git(published.bare, 'rev-list', '--all', '--count'), '1', 'nothing was pushed by the remote command');
    assert.equal(spawnSync('git', ['-C', published.bare, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: testerEnv() }).status, 0, 'the branch the push made stands');
  } finally { done(root); }
});

test('bootstrap-cannot-read-a-checkout: an unreadable checkout is reported, its state unknown, and it is left alone', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const published = publishedRepository(root, 'api');
    const folder = draftWithManifest(home, `schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nrepos:\n  - name: api\n    url: ${published.bare}\n`);
    const firstRun = runProgram('bootstrap', folder);
    assert.equal(firstRun.status, 0, `${firstRun.stdout}${firstRun.stderr}`);
    assert.match(firstRun.stdout, /^repo: api cloned$/m);

    // The work of a person inside the clone, and an index git itself refuses.
    writeFileSync(join(folder, 'repos', 'api', 'notes.txt'), 'the work of a person\n');
    writeFileSync(join(folder, 'repos', 'api', '.git', 'index'), 'not an index at all\n');

    const unknownRun = runProgram('bootstrap', folder);
    assert.equal(unknownRun.status, 1, `${unknownRun.stdout}${unknownRun.stderr}`);
    const line = unknownRun.stdout.split('\n').find((one) => one.startsWith('repo: api '));
    assert.ok(line.startsWith('repo: api present'), `the checkout still reads as present: ${unknownRun.stdout}`);
    assert.ok(line.includes('could not be read'), `and its state could not be read: ${line}`);
    assert.equal(readFileSync(join(folder, 'repos', 'api', 'notes.txt'), 'utf8'), 'the work of a person\n', 'the checkout was left alone');

    const asJson = runProgram('bootstrap', folder, '--json');
    assert.equal(asJson.status, 1, asJson.stderr);
    const reported = JSON.parse(asJson.stdout).repos[0];
    assert.equal(reported.state, 'present');
    assert.equal(reported.dirty, null, 'the state is unknown, not clean and not dirty');
  } finally { done(root); }
});

test('remote-outside-a-repository: a folder that is no git repository of its own is refused, and the one around it gains nothing', () => {
  const root = scratch();
  try {
    const outer = join(root, 'outer');
    spawnSync('mkdir', ['-p', outer]);
    git(outer, 'init', '-q', '-b', 'main');
    const inner = join(outer, 'my-product');
    spawnSync('mkdir', ['-p', inner]);
    writeFileSync(join(inner, 'workspace.yaml'), 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\n');
    const url = join(root, 'far-away');
    git(root, 'init', '-q', '-b', 'main', url);

    const made = runProgram('remote', inner, url);
    assert.equal(made.status, 2, made.stdout);
    assert.ok(made.stderr.includes(inner.slice(1)), `the refusal names the folder: ${made.stderr}`);
    assert.match(made.stderr, /not a git repository of its own/, "and says why: a command run here would reach the one around it");
    assert.equal(git(outer, 'remote'), '', 'the repository around it gained no remote');
  } finally { done(root); }
});

test('bootstrap: the declared repositories cloned, reported, never replaced, and a failure still reports the rest', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const first = publishedRepository(root, 'api');
    const second = publishedRepository(root, 'ui');
    const manifest = `schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nrepos:\n  - name: api\n    url: ${first.bare}\n  - name: ui\n    url: ${second.bare}\n`;
    const folder = draftWithManifest(join(root, 'home'), manifest);

    const firstRun = runProgram('bootstrap', folder);
    assert.equal(firstRun.status, 0, `${firstRun.stdout}${firstRun.stderr}`);
    assert.match(firstRun.stdout, new RegExp(`^bootstrapped: ${folder}$`, 'm'));
    assert.match(firstRun.stdout, /^repo: api cloned$/m);
    assert.match(firstRun.stdout, /^repo: ui cloned$/m);
    assert.equal(existsSync(join(folder, 'repos', 'api', 'api.md')), true, 'the clone holds the commit that was pushed');
    assert.equal(git(join(folder, 'repos', 'api'), 'rev-parse', 'HEAD'), first.head, 'cloned at the head that was pushed');
    const beforeApi = git(join(folder, 'repos', 'api'), 'rev-parse', 'HEAD');
    const beforeUi = git(join(folder, 'repos', 'ui'), 'rev-parse', 'HEAD');

    const secondRun = runProgram('bootstrap', folder);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    assert.match(secondRun.stdout, /^repo: api present$/m);
    assert.match(secondRun.stdout, /^repo: ui present$/m);
    assert.equal(git(join(folder, 'repos', 'api'), 'rev-parse', 'HEAD'), beforeApi, 'the second run replaced nothing');

    writeFileSync(join(folder, 'repos', 'api', 'uncommitted.txt'), 'the work of a person\n');
    const dirtyRun = runProgram('bootstrap', folder);
    assert.equal(dirtyRun.status, 0, dirtyRun.stderr);
    assert.match(dirtyRun.stdout, /^repo: api present dirty$/m);
    assert.equal(readFileSync(join(folder, 'repos', 'api', 'uncommitted.txt'), 'utf8'), 'the work of a person\n', 'the file is still there');

    // A manifest whose url names nothing that exists: one repository fails,
    // the other still gets its own line, and the run exits 1.
    const failingHome = join(root, 'home-2');
    const failing = draftWithManifest(failingHome, manifest.replace(second.bare, join(root, 'no-such-repository')));
    const failureRun = runProgram('bootstrap', failing);
    assert.equal(failureRun.status, 1, failureRun.stdout);
    assert.match(failureRun.stdout, /repo: api (cloned|present)/, 'the declared repository that can still be cloned gets its own line');
    assert.match(failureRun.stdout, /^repo: ui failed: /m, "and the one that cannot says what git's words are");
    assert.match(failureRun.stdout, /no-such-repository/, 'the failure names the url that was refused');
  } finally { done(root); }
});

test('misuse: what each refused case says, with the prefix and the usage line', () => {
  const root = scratch();
  try {
    // The cases the command line's own argument parse refuses: the contract's
    // `product: ` prefix and usage line hold on every one.
    const refusals = [
      [],
      ['frobnicate'],
      ['read', '--frobnicate'],
      ['new', '--home'],
      ['new', '--home', '--date'],
      ['read', 'one', 'two'],
      ['rename', 'only-one-word'],
    ];
    for (const args of refusals) {
      const run = runProgram(...args);
      assert.equal(run.status, 2, `${JSON.stringify(args)}: ${run.stdout}${run.stderr}`);
      assert.ok(run.stderr.startsWith('product: '), `${JSON.stringify(args)} carries the prefix: ${JSON.stringify(run.stderr)}`);
      assert.ok(run.stderr.includes('product: usage: '), `${JSON.stringify(args)} carries the usage line: ${JSON.stringify(run.stderr)}`);
      assert.equal(run.stdout, '', 'a refusal says nothing on standard output');
    }
    // Each names what is wrong, in the words the scenario holds.
    assert.match(runProgram().stderr, /no command/);
    assert.match(runProgram('frobnicate').stderr, /frobnicate/);
    assert.match(runProgram('read', '--frobnicate').stderr, /frobnicate/);
    assert.match(runProgram('new', '--home').stderr, /--home/);
    assert.match(runProgram('new', '--home', '--date').stderr, /--home.*--date|option "--home"/);
    assert.match(runProgram('read', 'one', 'two').stderr, /word/);
    assert.match(runProgram('rename', 'only-one-word').stderr, /rename/);

    // A miswritten day is a fault of the argument itself, refused where it is
    // parsed: the same prefix and usage line as every other misuse, and no
    // draft folder made for a day the run could not take.
    for (const [day, like] of [['2026-10-9', /YYYY-MM-DD/], ['2026-02-30', /calendar/], ['2026-13-45', /calendar/]]) {
      const home = join(root, `home-${day}`);
      const run = runProgram('new', '--home', home, '--date', day);
      assert.equal(run.status, 2, day);
      assert.ok(like.test(run.stderr), `${day} names its fault: ${JSON.stringify(run.stderr)}`);
      assert.ok(run.stderr.startsWith('product: '), `${day} carries the prefix: ${JSON.stringify(run.stderr)}`);
      assert.ok(run.stderr.includes('product: usage: '), `${day} carries the usage line: ${JSON.stringify(run.stderr)}`);
      assert.equal(run.stdout, '', day);
      assert.equal(existsSync(join(home, draftName())), false, `${day}: no draft folder was made for it`);
    }
  } finally { done(root); }
});

test('rename-keeps-the-name-line: a quoted key and a trailing comment are kept, not duplicated', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    writeFileSync(join(folder, 'workspace.yaml'), `schemaVersion: 1\nid: ${id}\n"name": "Draft" # keep this note\n`);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with its quoted key');

    const made = runProgram('rename', folder, 'tide-model');
    assert.equal(made.status, 0, made.stderr);
    const renamedTo = join(home, 'tide-model');
    assert.equal(existsSync(renamedTo), true, 'the rename happened');

    const written = readFileSync(join(renamedTo, 'workspace.yaml'), 'utf8');
    assert.ok(written.includes('# keep this note'), `the comment still stands: ${JSON.stringify(written)}`);
    assert.equal(written.split('\n').filter((line) => /^(name|"name"):/.test(line)).length, 1,
      `one name field, not a duplicate: ${JSON.stringify(written)}`);
    const read = runProgram('read', renamedTo);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, /^name: tide-model$/m, 'the product is named');
    assert.match(read.stdout, new RegExp(`^id: ${id}$`, 'm'), 'the id is unchanged');
  } finally { done(root); }
});

test('rename-keeps-the-name-line: a plain name with a trailing comment keeps the comment, the rest byte for byte', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const manifest = `schemaVersion: 1\nid: ${id}\nname: product # approved\n`;
    writeFileSync(join(folder, 'workspace.yaml'), manifest);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with its note');

    const made = runProgram('rename', folder, 'tide-model');
    assert.equal(made.status, 0, made.stderr);
    const renamedTo = join(home, 'tide-model');
    const written = readFileSync(join(renamedTo, 'workspace.yaml'), 'utf8');
    assert.equal(written, manifest.replace(/^name:.*$/m, 'name: tide-model # approved'),
      'the name line keeps its note, and every other byte is unchanged');
    const read = runProgram('read', renamedTo);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, /^name: tide-model$/m);
  } finally { done(root); }
});

test('rename-names-only-its-own-line: a name nested under another field is not touched', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const manifest = `schemaVersion: 1\nid: ${id}\nnotes:\n  name: a note\nname: a-draft\n`;
    writeFileSync(join(folder, 'workspace.yaml'), manifest);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with a name under notes');

    const made = runProgram('rename', folder, 'tide-model');
    assert.equal(made.status, 0, made.stderr);
    const renamedTo = join(home, 'tide-model');
    const written = readFileSync(join(renamedTo, 'workspace.yaml'), 'utf8');
    assert.ok(written.includes('  name: a note\n'), `the note's name stands where it did: ${JSON.stringify(written)}`);
    assert.equal(written, manifest.replace(/^name:.*$/m, 'name: tide-model'), 'and only the product\'s own name was rewritten');
    const read = runProgram('read', renamedTo);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, /^name: tide-model$/m);
  } finally { done(root); }
});

test('rename-quotes-what-yaml-would-read-else: 123, true and null are named and read back as words', () => {
  const root = scratch();
  try {
    for (const [name, quoted] of [['123', `'123'`], ['true', `'true'`], ['null', `'null'`]]) {
      const home = join(root, `home-${name}`);
      const { folder } = makeDraft(home);
      const made = runProgram('rename', folder, name);
      assert.equal(made.status, 0, `${name}: ${made.stderr}`);
      const renamedTo = join(home, name);
      const read = runProgram('read', renamedTo);
      assert.equal(read.status, 0, `${name}: ${read.stderr}`);
      assert.match(read.stdout, new RegExp(`^name: ${name}$`, 'm'), `${name} is read back as the word it is`);
      const written = readFileSync(join(renamedTo, 'workspace.yaml'), 'utf8');
      assert.ok(written.includes(`name: ${quoted}\n`), `${name} is quoted in the manifest: ${JSON.stringify(written)}`);
    }
  } finally { done(root); }
});

test("rename-keeps-the-comment's-space: one space before the # the name line held", () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const manifest = 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: a-draft # keep this\n';
    writeFileSync(join(folder, 'workspace.yaml'), manifest);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with its note');

    const made = runProgram('rename', folder, 'named-product');
    assert.equal(made.status, 0, made.stderr);
    const written = readFileSync(join(home, 'named-product', 'workspace.yaml'), 'utf8');
    assert.equal(written, manifest.replace(/^name:.*$/m, 'name: named-product # keep this'),
      `one space before the #: ${JSON.stringify(written)}`);
  } finally { done(root); }
});

test('proto-field-forges-nothing: a manifest built under __proto__ is refused, and one beside it reads', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const forged = draftWithManifest(home, '__proto__:\n  schemaVersion: 1\n  id: forged\n');
    const read = runProgram('read', forged);
    assert.equal(read.status, 2, read.stdout);
    assert.match(read.stderr, /schemaVersion/, 'the refusal names the field the manifest never gave');

    const home2 = join(root, 'home-2');
    const own = draftWithManifest(home2, 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\n__proto__:\n  id: forged\n');
    const asJson = runProgram('read', '--json', own);
    assert.equal(asJson.status, 0, asJson.stderr);
    const facts = JSON.parse(asJson.stdout);
    assert.equal(facts.id, '046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01', 'the id the manifest gave itself');
    assert.notEqual(facts.id, 'forged', 'no identity came out of the __proto__ field');
  } finally { done(root); }
});

test('--version: the version of the plugin manifest, and the library constant with it', () => {
  const pluginManifest = JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url).pathname, 'utf8'));
  const printed = runProgram('--version');
  assert.equal(printed.status, 0, printed.stderr);
  assert.equal(printed.stdout.trim(), pluginManifest.version, 'the version printed is the one the manifest holds');
  assert.equal(typeof PLUGIN_VERSION, 'string', 'the library carries a version of its own');
  assert.equal(PLUGIN_VERSION, pluginManifest.version, 'and it is equal to the manifest\'s');
  assert.equal(PRODUCT_SCHEMA_VERSION, 1, 'the schema version the manifest is written in');
  assert.equal(readProduct !== undefined, true, 'the reader is part of the promise the test file was written against');
});
