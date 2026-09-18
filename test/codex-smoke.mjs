#!/usr/bin/env node
// Linux + bubblewrap + Codex CLI. No model calls, credentials or network required.
// Bind disposable directories over Codex's state; never change HOME/CODEX_HOME.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux', 'This isolated smoke test requires Linux and bubblewrap');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'shady2k-codex-test-'));
const codexState = process.env.CODEX_HOME || join(homedir(), '.codex');
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const skillFiles = walk(join(root, 'skills')).map((p) => p.slice(root.length + 1));
const expectedNames = skillFiles.filter((p) => p.endsWith('/SKILL.md')).map((p) => `shady2k-skills:${dirname(p).split('/').pop()}`).sort();

function isolated(state, work, args) {
  const source = join(dirname(state), 'shady2k-skills');
  return ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--unshare-net',
    '--die-with-parent', '--bind', temp, temp, '--bind', state, codexState,
    '--tmpfs', join(homedir(), '.agents'), '--chdir', work,
    // Exercise Git marketplace refresh without accessing GitHub or the network.
    '--setenv', 'GIT_CONFIG_NOSYSTEM', '1', '--setenv', 'GIT_CONFIG_GLOBAL', '/dev/null',
    '--setenv', 'GIT_CONFIG_COUNT', '1',
    '--setenv', 'GIT_CONFIG_KEY_0', `url.file://${source}.insteadOf`,
    '--setenv', 'GIT_CONFIG_VALUE_0', 'https://example.invalid/shady2k-skills.git',
    'codex', ...args];
}
function run(state, work, args) {
  const result = spawnSync('bwrap', isolated(state, work, args), { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.error?.message || result.stderr}`);
  return result.stdout;
}
async function discovered(state, work, marketplaceRoot) {
  const child = spawn('bwrap', isolated(state, work, ['app-server']), { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let id = 0;
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += data; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let response;
    try { response = JSON.parse(line); } catch { return; }
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    clearTimeout(task.timer);
    if (response.error) task.reject(new Error(JSON.stringify(response.error)));
    else task.resolve(response.result);
  });
  const rejectAll = (error) => {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); }
    pending.clear();
  };
  child.on('error', rejectAll);
  child.on('exit', (code) => rejectAll(new Error(`app-server exited ${code}: ${stderr}`)));
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Timed out: ${method}\n${stderr}`));
    }, 20000);
    pending.set(requestId, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n');
  });
  try {
    await request('initialize', { clientInfo: { name: 'skills-smoke', version: '1.0.0' }, capabilities: { experimentalApi: true } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const plugin = await request('plugin/read', { pluginName: 'shady2k-skills', marketplacePath: join(marketplaceRoot, '.claude-plugin/marketplace.json') });
    writeFileSync(join(state, 'plugin-read.json'), JSON.stringify(plugin, null, 2));
    assert.ok(plugin.plugin.summary.installed && plugin.plugin.summary.enabled);
    assert.deepEqual(plugin.plugin.skills.map((s) => s.name).sort(), expectedNames);
    const result = await request('skills/list', { cwds: [work], forceReload: true });
    writeFileSync(join(state, 'skills-list.json'), JSON.stringify(result, null, 2));
    writeFileSync(join(state, 'app-server.log'), stderr);
    const entry = result.data.find((e) => e.cwd === work);
    assert.ok(entry, 'skills/list returned the requested working directory');
    assert.deepEqual(entry.errors, []);
    return entry.skills.filter((s) => s.pluginId === 'shady2k-skills@shady2k' || s.path.includes('/plugins/cache/shady2k/shady2k-skills/'));
  } finally {
    lines.close();
    child.stdin.end();
    child.kill();
  }
}

try {
  for (const format of ['dual-harness', 'codex-only']) {
    const base = join(temp, format);
    const source = join(base, 'shady2k-skills');
    const state = join(base, 'state');
    const work = join(base, 'work');
    for (const dir of [source, state, work]) mkdirSync(dir, { recursive: true });
    for (const path of ['.codex-plugin', '.claude-plugin', 'skills'])
      cpSync(join(root, path), join(source, path), { recursive: true });
    if (format === 'codex-only') {
      rmSync(join(source, '.claude-plugin/plugin.json'));
    }
    const git = (...args) => {
      const result = spawnSync('git', ['-c', 'user.name=Plugin smoke test', '-c', 'user.email=smoke@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
        cwd: source, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
      });
      assert.equal(result.status, 0, result.error?.message || result.stderr);
    };
    git('init', '-b', 'main');
    git('add', '.');
    git('commit', '-m', 'Initial plugin fixture');
    const marketplace = JSON.parse(run(state, work, ['plugin', 'marketplace', 'add', 'https://example.invalid/shady2k-skills.git', '--json']));
    assert.equal(marketplace.marketplaceName, 'shady2k');
    const install = () => JSON.parse(run(state, work, ['plugin', 'add', 'shady2k-skills@shady2k', '--json']));
    const installed = install();
    assert.equal(installed.version, version);
    assert.ok(installed.installedPath.startsWith(codexState + '/'), 'install stays in isolated state');
    const cache = join(state, installed.installedPath.slice(codexState.length + 1));
    for (const file of skillFiles)
      assert.deepEqual(readFileSync(join(cache, file)), readFileSync(join(root, file)), `cache preserved ${file}`);
    for (const script of ['check.mjs', 'check-commits.mjs', 'check-docs.mjs']) {
      const result = spawnSync(process.execPath, [join(cache, 'skills/backlog/setup-shady2k-skills', script), '--version'], { encoding: 'utf8' });
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), version);
    }
    const loaded = await discovered(state, work, marketplace.installedRoot);
    assert.deepEqual(loaded.map((s) => s.name).sort(), expectedNames, `${format}: every skill discovered exactly once`);
    assert.ok(loaded.every((s) => s.enabled && s.interface?.displayName), 'skills enabled with Codex presentation metadata');
    console.log(`PASS  ${format}: ${loaded.length} discovered skills, ${skillFiles.length} cached files, runnable checks`);

    // Exercise the documented refresh + reinstall in a new app-server session.
    for (const path of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
      if (format === 'codex-only' && path === '.claude-plugin/plugin.json') continue;
      const target = join(source, path);
      const manifest = JSON.parse(readFileSync(target));
      manifest.version = `${version}+smoke`;
      writeFileSync(target, JSON.stringify(manifest));
    }
    git('add', '.');
    git('commit', '-m', 'Updated plugin fixture');
    run(state, work, ['plugin', 'marketplace', 'upgrade', 'shady2k']);
    assert.equal(install().version, `${version}+smoke`);
    const refreshed = await discovered(state, work, marketplace.installedRoot);
    assert.deepEqual(refreshed.map((s) => s.name).sort(), expectedNames);
    assert.ok(refreshed.every((s) => s.path.includes(`${version}+smoke/`)), 'new session loads updated cache');
    console.log(`PASS  ${format}: upgrade + reinstall loads the updated version without duplicates`);
  }
} finally {
  // Keep diagnostics inspectable; the only writes are below this printed temp dir.
  console.log(`Isolated test state: ${temp}`);
}
