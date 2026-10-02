#!/usr/bin/env node
// Official Prime Agent CLI in disposable settings and project. No model calls.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const python = process.env.PRIME_AGENT_KERNEL_PYTHON;
if (!python || !existsSync(python)) {
  console.error('test:prime:smoke requires PRIME_AGENT_KERNEL_PYTHON pointing to a prepared Prime runtime Python');
  process.exit(2);
}
const temp = mkdtempSync(join(tmpdir(), 'shady2k-prime-smoke-'));
const home = join(temp, 'home');
const project = join(temp, 'project');
const socket = join(temp, 'daemon.sock');
for (const dir of [home, project, ...['config', 'data', 'state', 'cache', 'tmp'].map((name) => join(home, name))])
  mkdirSync(dir, { recursive: true });
const bin = process.env.PRIME_BIN || 'prime-agent';
const env = {
  PATH: process.env.PATH, HOME: home, TERM: 'dumb', NO_COLOR: '1', CI: '1',
  XDG_CONFIG_HOME: join(home, 'config'), XDG_DATA_HOME: join(home, 'data'),
  XDG_STATE_HOME: join(home, 'state'), XDG_CACHE_HOME: join(home, 'cache'), TMPDIR: join(home, 'tmp'),
  PRIME_AGENT_KERNEL_PYTHON: python,
};
const run = (args, options = {}) => spawnSync(bin, args, {
  cwd: project, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...options,
});
const check = (result, where) => assert.equal(result.status, 0,
  `${where}: ${result.error?.message || result.stderr || result.stdout}`);
const quote = (s) => `'${s.replaceAll("'", String.raw`'\''`)}'`;
let passed = false;
try {
  const version = run(['--version']);
  check(version, 'Prime version');
  check(run(['package', 'install', root]), 'install package');
  const server = join(root, 'mcp/jev-server.mjs');
  check(run(['mcp', 'add', 'jev', '--', 'node', server]), 'configure native Jev');
  const settings = JSON.parse(readFileSync(join(home, '.prime/agent/settings.json'), 'utf8'));
  assert.ok(settings.packages?.some((source) => typeof source === 'string' && resolve(join(home, '.prime/agent'), source) === resolve(root)),
    'package was not saved to isolated personal settings');
  assert.deepEqual(settings.mcpServers?.jev?.args, [server]);

  const response = run(['--mode', 'rpc', '--offline', '--no-session', '--cwd', project,
    '--daemon-socket', socket], { input: JSON.stringify({ id: 'skills', type: 'get_commands' }) + '\n' });
  check(response, 'RPC skill discovery');
  const commands = response.stdout.split('\n').filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line)).find((line) => line.id === 'skills')?.data?.commands;
  assert.ok(commands, `Prime did not answer get_commands: ${response.stdout} ${response.stderr}`);
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  const expected = walk(join(root, 'skills')).filter((path) => path.endsWith('/SKILL.md'))
    .map((path) => `skill:${path.split('/').at(-2)}`).sort();
  const actual = commands.filter((item) => item.sourceInfo?.path?.startsWith(join(root, 'skills/')))
    .map((item) => item.name).sort();
  assert.deepEqual(actual, expected);

  // RPC may recover from an extension error; only the real TUI caught the Prime 0.9.8 crash.
  const log = join(temp, 'tui.log');
  const command = [bin, '--offline', '--no-session', '--cwd', project, '--daemon-socket', socket]
    .map(quote).join(' ');
  const tui = spawnSync('script', ['-q', '-e', '-c', command, log], {
    cwd: project, env, input: '/exit\r', encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  check(tui, 'Prime TUI');
  const output = readFileSync(log, 'utf8');
  assert.doesNotMatch(output, /Failed to load extension/);
  assert.match(output, /Welcome to PRIME Agent|Log in with Prime Intellect/,
    'TUI did not reach its welcome screen');
  // Use the Prime release's own Python MCP client, not just the saved CLI config.
  const executable = bin.includes('/') ? bin : spawnSync('which', [bin], { env, encoding: 'utf8' }).stdout.trim();
  const runtime = join(dirname(realpathSync(executable)), 'prime-agent-runtime/src');
  assert.ok(existsSync(join(runtime, 'rlm/mcp.py')), `Prime runtime not found beside ${executable}`);
  const code = [
    'import asyncio, json, sys',
    'sys.path.insert(0, sys.argv[1])',
    'from rlm.mcp import _Generation',
    'async def main():',
    '    config = json.load(open(sys.argv[2], encoding="utf-8"))["mcpServers"]["jev"]',
    '    gen = _Generation("jev", config)',
    '    try:',
    '        await gen.open()',
    '        print(json.dumps(sorted(gen.tools)))',
    '    finally:',
    '        await gen.close()',
    'asyncio.run(main())',
  ].join('\n');
  const native = spawnSync(python, ['-c', code, runtime, join(home, '.prime/agent/settings.json')], {
    cwd: project, env, encoding: 'utf8', timeout: 30000,
  });
  check(native, 'Prime native Jev MCP handshake');
  assert.deepEqual(JSON.parse(native.stdout.trim()), ['jev']);
  console.log(`PASS Prime ${version.stdout.trim()}: ${expected.length} skills, TUI and native Jev tools/list; no model calls`);
  passed = true;
} finally {
  run(['--daemon-socket', socket, 'shutdown', '--force'], { timeout: 10000 });
  // Prime can leave its idle supervisor after shutdown. Stop only our unique socket.
  const processes = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  for (const line of (processes.stdout || '').split('\n')) {
    if (!line.includes(`--mode daemon --daemon-socket ${socket}`)) continue;
    const pid = Number(line.trim().split(/\s+/)[0]);
    if (pid && pid !== process.pid) try { process.kill(pid, 'SIGTERM'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  if (passed) rmSync(temp, { recursive: true, force: true });
  else console.error(`Prime smoke evidence kept at ${temp}`);
}
