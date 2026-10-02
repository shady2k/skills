import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import jev from '../extensions/jev.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
const walk = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);

test('Pi exposes exactly the complete skill tree and bundled extension', () => {
  assert.deepEqual(pkg.pi, { skills: ['./skills'], extensions: ['./extensions/jev.ts'] });
  assert.ok(pkg.keywords.includes('pi-package'));
  const expected = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'))).skills
    .map((path) => fileURLToPath(new URL(`../${path}/SKILL.md`, import.meta.url))).sort();
  assert.deepEqual(walk(join(root, 'skills')).filter((path) => path.endsWith('/SKILL.md')).sort(), expected);
});

test('registers one session-owned MCP server with no credential/config writes or timers', () => {
  const calls = [];
  jev({ registerMcpServer: (...args) => calls.push(args) });
  assert.deepEqual(calls, [['jev', {
    command: 'node', args: [join(root, 'mcp/jev-server.mjs')],
    env: { CLAUDE_PROJECT_DIR: '' }, exposure: 'direct',
  }]]);
});

test('older hosts get actionable guidance instead of a TypeError', () => {
  assert.throws(() => jev({}), /automatic Jev registration requires Pi.*Skills still work/);
});

test('registration errors are visible (including a conflicting extension)', () => {
  const conflict = new Error('name already registered by another extension');
  assert.throws(() => jev({ registerMcpServer() { throw conflict; } }), (error) => error === conflict);
});

test('relocated package starts the real stdio server in a different project without calling a model', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'skills-pi-'));
  try {
    const installed = join(temp, 'installed package');
    const project = join(temp, 'project');
    mkdirSync(installed); mkdirSync(project);
    for (const path of ['package.json', 'extensions', 'mcp', 'skills'])
      cpSync(join(root, path), join(installed, path), { recursive: true });
    // No project config, key or model: the MCP call must report unavailability.
    assert.equal(spawnSync('git', ['init', '-q', project]).status, 0);
    writeFileSync(join(project, 'fixture.txt'), 'A public test fixture.\n');
    const { default: relocated } = await import(pathToFileURL(join(installed, 'extensions/jev.ts')));
    let config;
    relocated({ registerMcpServer(name, value) { assert.equal(name, 'jev'); config = value; } });
    assert.equal(config.args[0], join(installed, 'mcp/jev-server.mjs'));
    const messages = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'pi-fixture', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'jev', arguments: { file: 'fixture.txt', questions: [{ type: 'check', question: 'Is this a fixture?' }] } } },
    ];
    const result = spawnSync(config.command, config.args, {
      cwd: project, encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, HOME: temp, PWD: installed, CLAUDE_PROJECT_DIR: '/wrong-project', ...config.env },
      input: messages.map((message) => JSON.stringify(message)).join('\n') + '\n',
    });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    const responses = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(responses.length, 3);
    assert.equal(responses.find((r) => r.id === 1).result.serverInfo.version, pkg.version);
    assert.equal(responses.find((r) => r.id === 2).result.tools[0].name, 'jev');
    assert.match(responses.find((r) => r.id === 3).result.content[0].text, /Jev is unavailable here: this project has not agreed/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
