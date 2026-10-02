#!/usr/bin/env node
// Published Pi CLI, disposable configuration and fixture project. No model requests.
// PI_BIN may name a Pi executable outside PATH. Use Pi 1.0.0 or newer with native MCP.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'shady2k-pi-smoke-'));
const home = join(temp, 'home');
const work = join(temp, 'project');
const agentDir = join(home, '.pi/agent');
for (const dir of [home, work, agentDir]) mkdirSync(dir, { recursive: true });
const bin = process.env.PI_BIN || 'pi';
const env = {
  PATH: process.env.PATH, HOME: home, PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: '1',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  // Deliberately stale: the extension must clear this for the Jev process.
  CLAUDE_PROJECT_DIR: join(temp, 'wrong-project'),
};
function run(args) {
  const result = spawnSync(bin, args, { cwd: work, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout;
}
let child;
try {
  const version = run(['--version']).trim();
  run(['install', root]);
  assert.ok(run(['list']).includes(root.replace(/\/$/, '')), 'Pi saved the local package declaration');
  const probe = join(temp, 'probe.ts');
  const observation = join(temp, 'observation.json');
  writeFileSync(probe, `import { writeFileSync } from 'node:fs';
export default function (pi) {
  pi.on('session_start', (_event, ctx) => {
    // Do not block later session_start handlers (including built-in MCP).
    setTimeout(async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const tools = pi.getAllTools();
      const jev = tools.find(t => t.name.includes('jev'));
      if (jev) {
        writeFileSync(${JSON.stringify(observation)}, JSON.stringify({ cwd: ctx.cwd, tools, servers: pi.getMcpServers() }));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    writeFileSync(${JSON.stringify(observation)}, JSON.stringify({ error: 'Jev MCP handshake did not expose its tool', servers: pi.getMcpServers(), tools: pi.getAllTools() }));
    }, 0);
  });
}`);
  child = spawn(bin, ['--mode', 'rpc', '--no-session', '--offline', '--no-context-files', '-e', probe], {
    cwd: work, env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32',
  });
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const commands = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Pi RPC timed out: ${stderr}`)), 20000);
    const lines = createInterface({ input: child.stdout });
    child.once('error', error => { clearTimeout(timer); lines.close(); reject(error); });
    child.once('exit', code => { clearTimeout(timer); lines.close(); reject(new Error(`Pi exited ${code}: ${stderr}`)); });
    lines.on('line', line => {
      let response;
      try { response = JSON.parse(line); } catch { return; }
      if (response.id !== 'skills') return;
      clearTimeout(timer); lines.close();
      if (!response.success) reject(new Error(JSON.stringify(response)));
      else resolve(response.data.commands);
    });
    child.stdin.write(JSON.stringify({ id: 'skills', type: 'get_commands' }) + '\n');
  });
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  const expected = walk(join(root, 'skills')).filter(path => path.endsWith('/SKILL.md'))
    .map(path => `skill:${dirname(path).split('/').pop()}`).sort();
  assert.deepEqual(commands.filter(command => command.source === 'skill').map(command => command.name).sort(), expected);
  const deadline = Date.now() + 12000;
  while (!existsSync(observation) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(existsSync(observation), `No MCP observation: ${stderr}`);
  const observed = JSON.parse(readFileSync(observation, 'utf8'));
  assert.equal(observed.error, undefined, JSON.stringify(observed) + stderr);
  assert.equal(observed.cwd, work);
  assert.equal(observed.servers.length, 1);
  assert.equal(observed.servers[0].name, 'jev');
  assert.ok(observed.tools.some(tool => tool.name.includes('jev')));
  console.log(`PASS Pi ${version}: local package install, ${expected.length} skills, session MCP registration and live Jev stdio handshake; no model calls`);
} finally {
  if (child?.pid) {
    child.stdin.end();
    try {
      if (process.platform === 'win32') child.kill();
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  rmSync(temp, { recursive: true, force: true });
}
