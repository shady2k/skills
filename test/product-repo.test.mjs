#!/usr/bin/env node
// The product repository's lifecycle, run as the command line: the draft made
// under a products home, the manifest read back, the name given in place, the
// remote added without pushing it, the declared code repositories cloned, and
// every misuse the command line refuses. Real git in folders made for each
// test and removed in a finally, and swept at exit.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PLUGIN_VERSION, PRODUCT_SCHEMA_VERSION, addCodeRepository, readProduct } from '../skills/backlog/setup-shady2k-skills/product.mjs';

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

test('rename-keeps-a-hash-inside-the-quoted-name: the # of the name is not mistaken for a comment', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const manifest = `schemaVersion: 1\nid: ${id}\nname: 'Draft # part' # keep this\n`;
    writeFileSync(join(folder, 'workspace.yaml'), manifest);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with a hash inside the name');

    const made = runProgram('rename', folder, 'named-product');
    assert.equal(made.status, 0, made.stderr);
    const written = readFileSync(join(home, 'named-product', 'workspace.yaml'), 'utf8');
    assert.equal(written, `schemaVersion: 1\nid: ${id}\nname: named-product # keep this\n`,
      `the name was rewritten and the comment kept, nothing cut: ${JSON.stringify(written)}`);
    const read = runProgram('read', join(home, 'named-product'));
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, /^name: named-product$/m);
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

// ---- a code repository entered in the manifest, and what a folder is --------

test('repo-add: the manifest gains the repository, keeps its id, and the entry is one commit', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder, id } = makeDraft(home);
    const before = readFileSync(join(folder, 'workspace.yaml'), 'utf8');

    const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git', '--branch', 'main');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.match(entered.stdout, /^folder: .*/m);
    assert.match(entered.stdout, /^name: api$/m);
    assert.match(entered.stdout, /^url: https:\/\/example\.invalid\/api\.git$/m);
    assert.match(entered.stdout, /^branch: main$/m);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      `${before}repos:\n  - name: api\n    url: https://example.invalid/api.git\n    branch: main\n`,
      'the manifest is the bytes it held, plus the block the entry added');

    const read = readProduct(folder);
    assert.equal(read.ok, true, read.message);
    assert.equal(read.product.id, id, 'the id the product was given is kept');
    assert.deepEqual(read.product.repos, [{ name: 'api', url: 'https://example.invalid/api.git', branch: 'main' }],
      'the code repository is read back out of the manifest');

    assert.equal(git(folder, 'rev-list', '--count', 'HEAD'), '2', 'entering a repository is one commit of its own');
    assert.equal(git(folder, 'show', '-s', '--format=%s', 'HEAD'), 'Enter the code repository api');
    assert.equal(git(folder, 'status', '--porcelain'), '', 'and it commits nothing else');
  } finally { done(root); }
});

test('repo-add-json: one object holding what the entry wrote', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const entered = runProgram('repo', 'add', '--json', folder, 'api', '/tmp/here/api.git');
    assert.equal(entered.status, 0, entered.stderr);
    assert.deepEqual(JSON.parse(entered.stdout),
      { folder, name: 'api', url: '/tmp/here/api.git' },
      'the object holds the folder, the name and the url, and no branch where none was given');
    const refused = runProgram('repo', 'add', '--json', folder, 'api', '/tmp/here/api.git');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(JSON.parse(refused.stdout).error.message, /already declares the code repository "api"/);
  } finally { done(root); }
});

test('repo-add-keeps-comments-and-appends-to-an-existing-list: every other byte stays', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const first = draftWithManifest(home, 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n');
    const folder = first;
    const manifest = [
      'schemaVersion: 1',
      'id: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01',
      'name: idea-2026-10-09',
      'skills:',
      '  shady2k: 0.91.0',
      'repos: # the code repositories',
      '  # the api comes first',
      '  - name: api',
      '    url: https://example.invalid/api.git',
      '  - name: web',
      "    url: 'https://example.invalid/web.git'",
      '',
      'wikiRevision: 7',
      '',
    ].join('\n');
    writeFileSync(join(folder, 'workspace.yaml'), manifest);
    git(folder, 'add', 'workspace.yaml');
    git(folder, 'commit', '-q', '-m', 'the manifest with its notes');

    const entered = runProgram('repo', 'add', folder, 'jobs', 'https://example.invalid/jobs.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    const expected = manifest.replace(
      "  - name: web\n    url: 'https://example.invalid/web.git'\n",
      "  - name: web\n    url: 'https://example.invalid/web.git'\n  - name: jobs\n    url: https://example.invalid/jobs.git\n");
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'), expected,
      'the item is appended to the list, and every comment, quote and byte around it is kept');

    const read = readProduct(folder);
    assert.equal(read.ok, true, read.message);
    assert.deepEqual(read.product.repos.map((repo) => repo.name), ['api', 'web', 'jobs'],
      'the reader takes all three, the one that was there without a branch included');
  } finally { done(root); }
});

test('repo-add-joins-a-list-that-is-indented-otherwise: the item follows its own block', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos:\n    - name: api\n      url: https://example.invalid/api.git\n');
    const entered = runProgram('repo', 'add', folder, 'web', 'https://example.invalid/web.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    const written = readFileSync(join(folder, 'workspace.yaml'), 'utf8');
    assert.ok(written.endsWith('    - name: web\n      url: https://example.invalid/web.git\n'),
      `the item takes the indentation of the block it joins: ${JSON.stringify(written)}`);
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api', 'web']);
  } finally { done(root); }
});

test('repo-add-refuses-a-second-time: the name is declared once, and nothing moved', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    assert.equal(runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git').status, 0);
    const before = snapshot(folder);

    const again = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api-again.git');
    assert.equal(again.status, 2, again.stdout);
    assert.match(again.stderr, /already declares the code repository "api"/, 'the refusal names the repository');
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('repo-add-refuses-a-name-that-is-not-a-folder: nothing is written', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const before = snapshot(folder);
    for (const name of ['../escape', 'a/b', '.', '..', '']) {
      const refused = runProgram('repo', 'add', folder, name, 'https://example.invalid/api.git');
      assert.equal(refused.status, 2, `${JSON.stringify(name)}: ${refused.stdout}${refused.stderr}`);
      assert.match(refused.stderr, new RegExp(`cannot be a code repository's`), `${JSON.stringify(name)} is refused for its name`);
    }
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('repo-add-refuses-a-manifest-that-does-not-read: with its file and line', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home, 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos: api\n');
    const before = snapshot(folder);

    const refused = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, new RegExp(`^${join(folder, 'workspace.yaml')}:4: `, 'm'),
      `the refusal names the manifest and the line: ${refused.stderr}`);
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('repo-add-refuses-uncommitted-changes: the entry is a commit and would take them with it', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    writeFileSync(join(folder, 'notes.md'), 'work in progress\n');
    const before = readFileSync(join(folder, 'workspace.yaml'), 'utf8');

    const refused = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, /holds changes that are not committed/);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'), before, 'the manifest is untouched');
    assert.equal(git(folder, 'rev-list', '--count', 'HEAD'), '1', 'no commit was added');
    assert.equal(git(folder, 'status', '--porcelain'), '?? notes.md', 'and the work in progress is still there');
  } finally { done(root); }
});

test('repo-add-refuses-a-url-that-is-an-option: a value beginning with - is not a url', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const before = snapshot(folder);
    const refused = runProgram('repo', 'add', folder, 'api', '-here.git');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, /begins with "-"/);
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('repo-add-then-bootstrap: the declared repository is cloned into repos/<name>', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const { bare, head } = publishedRepository(root);

    const entered = runProgram('repo', 'add', folder, 'api', bare, '--branch', 'main');
    assert.equal(entered.status, 0, entered.stderr);
    const bootstrapped = runProgram('bootstrap', folder);
    assert.equal(bootstrapped.status, 0, `${bootstrapped.stdout}${bootstrapped.stderr}`);
    assert.match(bootstrapped.stdout, /^repo: api cloned$/m, 'the repository the entry declared is the one cloned');

    const checkout = join(folder, 'repos', 'api');
    assert.equal(existsSync(checkout), true, 'the checkout stands under repos/, which the product repository ignores');
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), head, 'it is the commit the url held');
    assert.equal(git(folder, 'status', '--porcelain'), '', 'and the ignored folder leaves the product repository clean');
  } finally { done(root); }
});

test('where: a product repository, a code repository of one, and neither', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    const named = runProgram('rename', folder, 'leftover-listings');
    assert.equal(named.status, 0, named.stderr);
    const product = join(home, 'leftover-listings');

    const atRoot = runProgram('where', product);
    assert.equal(atRoot.status, 0, atRoot.stderr);
    assert.match(atRoot.stdout, /^where: product$/m);
    assert.match(atRoot.stdout, new RegExp(`^product: ${product}$`, 'm'));
    const inside = runProgram('where', join(product, 'docs'));
    assert.equal(inside.status, 0, inside.stderr);
    assert.match(inside.stdout, /^where: product$/m, 'a folder inside the product repository is the product repository');

    const { bare, head } = publishedRepository(root);
    assert.equal(runProgram('repo', 'add', product, 'api', bare, '--branch', 'main').status, 0);
    assert.equal(runProgram('bootstrap', product).status, 0);
    const checkout = join(product, 'repos', 'api');
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);

    const atCheckout = runProgram('where', '--json', checkout);
    assert.equal(atCheckout.status, 0, atCheckout.stderr);
    assert.deepEqual(JSON.parse(atCheckout.stdout), { where: 'code', product, repo: 'api' });
    mkdirSync(join(checkout, 'src'));
    const deeper = runProgram('where', join(checkout, 'src'));
    assert.equal(deeper.status, 0, deeper.stderr);
    assert.match(deeper.stdout, /^where: code$/m, 'a folder inside the checkout is the code repository it stands in');

    const elsewhere = runProgram('where', root);
    assert.equal(elsewhere.status, 0, elsewhere.stderr);
    assert.match(elsewhere.stdout, /^where: none$/m, 'a folder that is no repository is neither');
    const inAnotherRepository = runProgram('where', join(root, 'api-work'));
    assert.equal(inAnotherRepository.status, 0, inAnotherRepository.stderr);
    assert.match(inAnotherRepository.stdout, /^where: none$/m,
      'a git repository that is not under a product\'s repos/ is not a code repository of one');
  } finally { done(root); }
});

test('where-refuses-a-manifest-that-does-not-read: the folder it stands over is not answered for', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    const manifest = join(folder, 'workspace.yaml');
    writeFileSync(manifest, 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos: api\n');

    const atProduct = runProgram('where', '--json', folder);
    assert.equal(atProduct.status, 2, atProduct.stdout);
    assert.deepEqual(JSON.parse(atProduct.stdout).error.file, manifest, 'the refusal names the manifest');
    assert.equal(JSON.parse(atProduct.stdout).error.line, 4, 'and the line it cannot use');

    mkdirSync(join(folder, 'repos', 'api'), { recursive: true });
    git(join(folder, 'repos', 'api'), 'init', '--quiet');
    const insideCheckout = runProgram('where', join(folder, 'repos', 'api'));
    assert.equal(insideCheckout.status, 2, insideCheckout.stdout);
    assert.match(insideCheckout.stderr, new RegExp(`^${manifest}:4: `, 'm'));
  } finally { done(root); }
});

test('where-refuses-a-path-that-is-not-a-folder: it starts from a folder', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    for (const path of [join(folder, 'workspace.yaml'), join(root, 'nowhere')]) {
      const refused = runProgram('where', path);
      assert.equal(refused.status, 2, `${path}: ${refused.stdout}`);
      assert.match(refused.stderr, /is not a folder: where starts from a folder and walks up/);
    }
  } finally { done(root); }
});

test('repo-add-keeps-the-line-ending-the-file-uses: a manifest written with carriage returns gains none of ours', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\r\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\r\nname: idea-2026-10-09\r\n');
    const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      'schemaVersion: 1\r\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\r\nname: idea-2026-10-09\r\nrepos:\r\n  - name: api\r\n    url: https://example.invalid/api.git\r\n',
      'every line of the block the entry added ends the way the manifest ends its lines');
    assert.equal(readProduct(folder).product.repos.length, 1, 'and the manifest still reads');
  } finally { done(root); }
});

test('repo-add-to-a-manifest-that-declares-an-empty-list: the item joins the field it finds', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos: # the code repositories\n');
    const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos: # the code repositories\n  - name: api\n    url: https://example.invalid/api.git\n');
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api']);
  } finally { done(root); }
});

test('repo-add-refuses-a-folder-that-is-no-repository-of-its-own: the entry would land in another history', () => {
  const root = scratch();
  try {
    const outer = join(root, 'outer');
    mkdirSync(outer);
    git(outer, 'init', '--quiet');
    const inner = join(outer, 'inner');
    mkdirSync(inner);
    writeFileSync(join(inner, 'workspace.yaml'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n');
    const before = readFileSync(join(inner, 'workspace.yaml'), 'utf8');

    const refused = runProgram('repo', 'add', inner, 'api', 'https://example.invalid/api.git');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, /is not a git repository of its own/,
      `a manifest inside another repository is not a product: ${refused.stderr}`);
    assert.equal(readFileSync(join(inner, 'workspace.yaml'), 'utf8'), before, 'nothing was written');
  } finally { done(root); }
});

test('repo-add-refuses-no-url: a code repository is entered with the url it is cloned from', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const before = snapshot(folder);
    const refused = runProgram('repo', 'add', folder, 'api', '');
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, /no url was given/);
    unchangedFrom(folder, before);
  } finally { done(root); }
});

test('repo-add-reads-past-a-comment: a note among the items never splits one', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + 'repos:\n  - name: api\n# the api was first\n    url: https://example.invalid/api.git\n');
    const entered = runProgram('repo', 'add', folder, 'jobs', 'https://example.invalid/jobs.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + 'repos:\n  - name: api\n# the api was first\n    url: https://example.invalid/api.git\n'
      + '  - name: jobs\n    url: https://example.invalid/jobs.git\n',
      'the item goes after the whole list, and the comment stays where it was written');
    const read = readProduct(folder);
    assert.equal(read.ok, true, read.message);
    assert.deepEqual(read.product.repos.map((repo) => repo.name), ['api', 'jobs']);
    assert.equal(read.product.repos[0].url, 'https://example.invalid/api.git', 'the first item kept its url');
  } finally { done(root); }
});

test('repo-add-reads-past-a-comment-between-items: the list keeps its order and gains the last place', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + 'repos:\n  - name: api\n    url: https://example.invalid/api.git\n'
      + '# the web is built later\n  - name: web\n    url: https://example.invalid/web.git\n');
    const entered = runProgram('repo', 'add', folder, 'jobs', 'https://example.invalid/jobs.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    const written = readFileSync(join(folder, 'workspace.yaml'), 'utf8');
    assert.ok(written.endsWith('  - name: jobs\n    url: https://example.invalid/jobs.git\n'),
      `the new item is last: ${JSON.stringify(written)}`);
    assert.ok(written.includes('# the web is built later\n'), 'the comment is still there');
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api', 'web', 'jobs']);
  } finally { done(root); }
});

test('repo-add-to-a-field-written-with-a-value: the value is taken off the line and the list written under it', () => {
  const root = scratch();
  try {
    for (const written of ['null', '~']) {
      const home = join(root, `home-${written === '~' ? 'tilde' : written}`);
      const folder = draftWithManifest(home,
        `schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos: ${written} # no code yet\n`);
      const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
      assert.equal(entered.status, 0, `${written}: ${entered.stdout}${entered.stderr}`);
      const read = readProduct(folder);
      assert.equal(read.ok, true, `${written}: ${read.message}`);
      assert.deepEqual(read.product.repos.map((repo) => repo.name), ['api'], `${written}: the repository reads back`);
      const text = readFileSync(join(folder, 'workspace.yaml'), 'utf8');
      assert.ok(text.includes('repos: # no code yet\n  - name: api\n    url: https://example.invalid/api.git\n'),
        `${written}: the key and its comment are kept, the value is gone: ${JSON.stringify(text)}`);
      assert.ok(!text.includes(`${written} #`), `${written}: the value it held is not written any more`);
    }
  } finally { done(root); }
});

test('repo-add-writes-a-url-the-reader-gives-back: a value it would read as a number is quoted', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    for (const url of ['.5', '123', 'true', 'a b', 'https://example.invalid/api.git', '/tmp/here/api.git']) {
      const entered = runProgram('repo', 'add', folder, `r${url.length}${url.replace(/\W/g, '')}`.slice(0, 12), url);
      assert.equal(entered.status, 0, `${url}: ${entered.stdout}${entered.stderr}`);
    }
    const read = readProduct(folder);
    assert.equal(read.ok, true, read.message);
    assert.deepEqual(read.product.repos.map((repo) => repo.url),
      ['.5', '123', 'true', 'a b', 'https://example.invalid/api.git', '/tmp/here/api.git'],
      'every url is given back exactly as it was entered, whichever spelling the reader needs');
  } finally { done(root); }
});

test('repo-add-leaves-a-repos-of-another-field-alone: only the product\'s own field is written', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + 'other:\n  repos:\n    - name: nested\n      url: https://example.invalid/nested.git\n');
    const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    const text = readFileSync(join(folder, 'workspace.yaml'), 'utf8');
    assert.ok(text.includes('  repos:\n    - name: nested\n      url: https://example.invalid/nested.git\n'),
      'the repos of another field is untouched');
    assert.ok(/^repos:\n {2}- name: api\n {4}url: /m.test(text), 'the product\'s own field is written at the left margin');
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api'],
      'the reader takes the product\'s own field, not the nested one');
  } finally { done(root); }
});

test('repo-add-to-a-manifest-without-a-final-newline: the file keeps its own ending', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home, 'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09');
    const entered = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos:\n  - name: api\n    url: https://example.invalid/api.git',
      'the block follows the last line as it stood, and no newline is invented');
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api']);
  } finally { done(root); }
});

test('repo-add-a-commit-that-fails: the manifest goes back byte for byte, and nothing is left staged', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const before = snapshot(folder);
    const manifest = readFileSync(join(folder, 'workspace.yaml'), 'utf8');

    // A git that refuses to commit, and nothing else: the entry writes the
    // manifest, the commit fails, and the product must be as it was. The stub
    // goes on to the real git by its own path, never by name, which would
    // find the stub again.
    const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    assert.ok(realGit, 'the real git is on the PATH this box holds');
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const stub = [
      '#!/bin/sh',
      'for a in "$@"; do',
      '  if [ "$a" = commit ]; then',
      "    echo 'stub: refusing to commit' >&2",
      '    exit 1',
      '  fi',
      'done',
      `exec '${realGit}' "$@"`,
      '',
    ].join('\n');
    writeFileSync(join(bin, 'git'), stub);
    spawnSync('chmod', ['+x', join(bin, 'git')]);
    const saved = runProgram.bin;
    runProgram.bin = bin;
    let failed;
    try {
      failed = runProgram('repo', 'add', folder, 'api', 'https://example.invalid/api.git');
    } finally { runProgram.bin = saved; }

    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.match(failed.stderr, /git commit failed/, 'the failure names the step that failed');
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'), manifest, 'the manifest is back as it was');
    unchangedFrom(folder, before);
    assert.equal(git(folder, 'status', '--porcelain'), '', 'and nothing of the failed entry is left staged');
  } finally { done(root); }
});

test('repo-add-refuses-a-name-already-declared-with-its-line: the refusal names where it stands', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\nrepos:\n  - name: api\n    url: https://example.invalid/api.git\n');
    const manifest = join(folder, 'workspace.yaml');
    const refused = runProgram('repo', 'add', '--json', folder, 'api', 'https://example.invalid/api-again.git');
    assert.equal(refused.status, 2, refused.stdout);
    const { error } = JSON.parse(refused.stdout);
    assert.equal(error.file, manifest, 'the refusal names the manifest');
    assert.equal(error.line, 5, 'and the line the name stands on');
    assert.match(error.message, /already declares the code repository "api"/);
  } finally { done(root); }
});

test('where-answers-none-for-another-repository: only a repository of its own is answered for', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    assert.equal(runProgram('rename', folder, 'leftover-listings').status, 0);
    const product = join(home, 'leftover-listings');

    // A manifest in a folder that is no git repository of its own: the walk
    // answers for a product repository, and this is not one.
    const plain = join(root, 'plain');
    mkdirSync(plain);
    writeFileSync(join(plain, 'workspace.yaml'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: plain\n');
    const outside = runProgram('where', plain);
    assert.equal(outside.status, 0, outside.stderr);
    assert.match(outside.stdout, /^where: none$/m, 'a manifest without a repository of its own is no product repository');

    // A repository of its own inside the product's tree but outside repos/ is
    // another tree: what stands above it is not reached.
    const foreign = join(product, 'prototypes', 'foreign');
    mkdirSync(foreign, { recursive: true });
    git(foreign, 'init', '--quiet');
    const atForeign = runProgram('where', foreign);
    assert.equal(atForeign.status, 0, atForeign.stderr);
    assert.match(atForeign.stdout, /^where: none$/m, 'another repository inside the product is not the product repository');
    const insideForeign = join(foreign, 'src');
    mkdirSync(insideForeign);
    const deeper = runProgram('where', insideForeign);
    assert.equal(deeper.status, 0, deeper.stderr);
    assert.match(deeper.stdout, /^where: none$/m, 'nor is a folder inside it');

    const atProduct = runProgram('where', product);
    assert.equal(atProduct.status, 0, atProduct.stderr);
    assert.match(atProduct.stdout, /^where: product$/m, 'and the product repository is still the product repository');
  } finally { done(root); }
});

test('repo-add-writes-a-value-one-line-cannot-carry: an escape is written, and read back whole', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const url = '/tmp/api\nmirror.git';
    const branch = 'a\tb';

    const entered = runProgram('repo', 'add', folder, 'api', url, '--branch', branch);
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.ok(readFileSync(join(folder, 'workspace.yaml'), 'utf8').includes(
      '    url: "/tmp/api\\nmirror.git"\n    branch: "a\\tb"\n'),
      'a value holding a newline or a tab is written double-quoted, with the reader\'s escapes');

    const read = readProduct(folder);
    assert.equal(read.ok, true, read.message);
    assert.deepEqual(read.product.repos, [{ name: 'api', url, branch }],
      'the reader gives back exactly what was entered');
    const again = runProgram('read', folder);
    assert.equal(again.status, 0, `${again.stdout}${again.stderr}`);
  } finally { done(root); }
});

test('repo-add-finds-a-quoted-key: the field is the one its name spells', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const folder = draftWithManifest(home,
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + '"repos":\n  - name: api\n    url: https://example.invalid/api.git\n');
    const entered = runProgram('repo', 'add', folder, 'web', 'https://example.invalid/web.git');
    assert.equal(entered.status, 0, `${entered.stdout}${entered.stderr}`);
    assert.equal(readFileSync(join(folder, 'workspace.yaml'), 'utf8'),
      'schemaVersion: 1\nid: 046b6c7f-0b8a-43b9-b70d-6fa34f2b1e01\nname: idea-2026-10-09\n'
      + '"repos":\n  - name: api\n    url: https://example.invalid/api.git\n'
      + '  - name: web\n    url: https://example.invalid/web.git\n',
      'the item joins the field as the manifest spells it, and no second field is written');
    assert.deepEqual(readProduct(folder).product.repos.map((repo) => repo.name), ['api', 'web']);
  } finally { done(root); }
});

test('repo-add-refuses-an-empty-branch-through-the-library: the branch is a word or nothing', () => {
  const root = scratch();
  try {
    const home = join(root, 'home');
    const { folder } = makeDraft(home);
    const before = snapshot(folder);
    const refused = addCodeRepository({ folder, name: 'api', url: 'https://example.invalid/api.git', branch: ' ' });
    assert.equal(refused.outcome, 'refused', JSON.stringify(refused));
    assert.match(refused.message, /the branch was given empty/);
    unchangedFrom(folder, before);
    assert.equal(git(folder, 'status', '--porcelain'), '', 'nothing of the refused entry is staged');
  } finally { done(root); }
});

test('where-follows-a-link-to-the-product: a folder reached by a link is the folder it names', () => {
  const root = scratch();
  try {
    const home = join(root, 'products');
    const { folder } = makeDraft(home);
    assert.equal(runProgram('rename', folder, 'leftover-listings').status, 0);
    const product = join(home, 'leftover-listings');
    const alias = join(root, 'alias');
    symlinkSync(product, alias, 'dir');

    const atAlias = runProgram('where', '--json', alias);
    assert.equal(atAlias.status, 0, atAlias.stderr);
    assert.deepEqual(JSON.parse(atAlias.stdout), { where: 'product', product: alias },
      'the product is recognised through the link, and named as it was reached');
    const insideAlias = runProgram('where', join(alias, 'docs'));
    assert.equal(insideAlias.status, 0, insideAlias.stderr);
    assert.match(insideAlias.stdout, /^where: product$/m, 'and so is a folder inside it');
  } finally { done(root); }
});
