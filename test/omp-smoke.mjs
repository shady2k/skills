#!/usr/bin/env node
// Linux + bubblewrap + omp CLI. No model calls, credentials or network required.
// Bind a disposable directory over omp's state; never change HOME or ~/.omp.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux', 'This isolated smoke test requires Linux and bubblewrap');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'shady2k-omp-test-'));
const ompState = join(homedir(), '.omp');
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const setupVersion = (readFileSync(join(root, 'skills/backlog/setup-shady2k-skills/protocol.md'), 'utf8').match(/^Setup version: (.+)$/m) || [])[1];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const skillFiles = walk(join(root, 'skills')).map((p) => p.slice(root.length + 1));
// omp names a plugin's skills without the plugin's prefix.
const expectedNames = skillFiles.filter((p) => p.endsWith('/SKILL.md')).map((p) => dirname(p).split('/').pop()).sort();
// The published install line: `omp plugin marketplace add shady2k/skills`.
const published = 'https://github.com/shady2k/skills';

const base = temp;
const source = join(base, 'shady2k-skills');
const state = join(base, 'state');
const work = join(base, 'work');
for (const dir of [source, state, work]) mkdirSync(dir, { recursive: true });

function isolated(args) {
  return ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--unshare-net',
    '--die-with-parent', '--bind', temp, temp, '--bind', state, ompState,
    // Skills the person installed elsewhere must not stand in for the plugin's.
    '--tmpfs', join(homedir(), '.agents'), '--tmpfs', join(homedir(), '.claude'),
    '--tmpfs', join(homedir(), '.codex'), '--chdir', work,
    '--setenv', 'ANTHROPIC_API_KEY', 'smoke-test-no-model-is-called',
    // Exercise the GitHub source's clone and refresh against a local repository.
    '--setenv', 'GIT_CONFIG_NOSYSTEM', '1', '--setenv', 'GIT_CONFIG_GLOBAL', '/dev/null',
    '--setenv', 'GIT_CONFIG_COUNT', '2',
    '--setenv', 'GIT_CONFIG_KEY_0', `url.file://${source}.insteadOf`,
    '--setenv', 'GIT_CONFIG_VALUE_0', published,
    '--setenv', 'GIT_CONFIG_KEY_1', `url.file://${source}.insteadOf`,
    '--setenv', 'GIT_CONFIG_VALUE_1', `${published}.git`,
    'omp', ...args];
}
function run(args) {
  const result = spawnSync('bwrap', isolated(args), { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}
// What a new session offers the model: omp lists each skill as `skill:<name>`.
function skills() {
  return new Promise((resolve, reject) => {
    const child = spawn('bwrap', isolated(['--mode', 'rpc']), { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data; });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timed out listing commands\n${stderr}`)); }, 30000);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      let frame;
      try { frame = JSON.parse(line); } catch { return; }
      if (frame.type === 'ready') child.stdin.write(JSON.stringify({ id: 'list', type: 'get_available_commands' }) + '\n');
      if (frame.id !== 'list') return;
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      child.kill();
      if (!frame.success) return reject(new Error(JSON.stringify(frame)));
      resolve(frame.data.commands.filter((c) => c.name.startsWith('skill:'))
        .map((c) => ({ name: c.name.slice('skill:'.length), description: c.description })));
    });
    child.on('error', reject);
  });
}
const git = (...args) => {
  const result = spawnSync('git', ['-c', 'user.name=Plugin smoke test', '-c', 'user.email=smoke@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: source, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
};
const cacheOf = (v) => join(state, 'plugins/cache/plugins', `shady2k___shady2k-skills___${v}`);

try {
  for (const path of ['.codex-plugin', '.claude-plugin', 'skills', 'mcp', 'package.json'])
    cpSync(join(root, path), join(source, path), { recursive: true });
  git('init', '-b', 'main');
  git('add', '.');
  git('commit', '-m', 'Initial plugin fixture');
  const work0 = spawnSync('git', ['init', '-q', work]);
  assert.equal(work0.status, 0);

  run(['plugin', 'marketplace', 'add', 'shady2k/skills']);
  run(['plugin', 'install', 'shady2k-skills@shady2k']);
  const cache = cacheOf(version);
  for (const file of skillFiles)
    assert.deepEqual(readFileSync(join(cache, file)), readFileSync(join(root, file)), `cache preserved ${file}`);
  for (const script of ['check.mjs', 'check-commits.mjs', 'check-docs.mjs', 'check-present.mjs']) {
    const result = spawnSync(process.execPath, [join(cache, 'skills/backlog/setup-shady2k-skills', script), '--version'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), setupVersion);
  }
  // Jev's tool server: omp reads it from the Claude manifest and fills in the
  // plugin's root itself; started that way from the cache, it answers.
  const declared = JSON.parse(readFileSync(join(cache, '.claude-plugin/plugin.json'), 'utf8')).mcpServers.jev;
  const served = spawnSync(declared.command, declared.args.map((a) => a.replaceAll('${CLAUDE_PLUGIN_ROOT}', cache)),
    { cwd: work, encoding: 'utf8', timeout: 10000, input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n` });
  assert.equal(JSON.parse(served.stdout || '{}').result?.tools[0].name, 'ask_each', `the cached jev server answers: ${served.stderr}`);
  const loaded = await skills();
  assert.deepEqual(loaded.map((s) => s.name).sort(), expectedNames, 'every skill discovered exactly once');
  console.log(`PASS  omp: ${loaded.length} discovered skills, ${skillFiles.length} cached files, runnable checks`);

  // A release raises the version in both catalogs; `omp plugin upgrade` with no
  // name, and the startup update check, compare the catalog entry's version.
  const next = `${version.replace(/\d+$/, (n) => Number(n) + 1)}`;
  for (const path of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const target = join(source, path);
    writeFileSync(target, JSON.stringify({ ...JSON.parse(readFileSync(target)), version: next }));
  }
  const catalogPath = join(source, '.claude-plugin/marketplace.json');
  const catalog = JSON.parse(readFileSync(catalogPath));
  catalog.plugins.find((p) => p.name === 'shady2k-skills').version = next;
  writeFileSync(catalogPath, JSON.stringify(catalog));
  const marked = join(source, 'skills/productivity/brainstorming/SKILL.md');
  writeFileSync(marked, readFileSync(marked, 'utf8').replace(/^description: /m, 'description: [smoke] '));
  git('add', '.');
  git('commit', '-m', 'Updated plugin fixture');
  run(['plugin', 'marketplace', 'update', 'shady2k']);
  run(['plugin', 'upgrade']);
  const upgraded = join(cacheOf(next), 'skills/productivity/brainstorming/SKILL.md');
  assert.ok(existsSync(upgraded), `omp plugin upgrade did not install ${next}: the catalog entry must carry the version`);
  assert.ok(readFileSync(upgraded, 'utf8').includes('[smoke]'), 'the upgrade installed the new source');
  const refreshed = await skills();
  assert.deepEqual(refreshed.map((s) => s.name).sort(), expectedNames);
  assert.ok(refreshed.find((s) => s.name === 'brainstorming').description.startsWith('[smoke]'), 'a new session loads the upgraded skills');
  console.log('PASS  omp: upgrade of every plugin loads the new version without duplicates');
} finally {
  console.log(`Isolated test state: ${temp}`);
}
