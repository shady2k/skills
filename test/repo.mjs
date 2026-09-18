#!/usr/bin/env node
/**
 * What the gate's own self-test cannot see, because it looks at one skill:
 *
 *   - no file of ANY skill names the origin project or its tracker
 *     (test/origin-words.json), since that is where every rule here was
 *     bought and so the words most likely to leak;
 *   - every skill is listed in the plugin manifest, and nothing else is;
 *   - a skill is user-invoked in both harnesses or in neither;
 *   - a skill that links to the protocol has it in its own folder, word for
 *     word the source's (test/sync-protocol.mjs writes the copies), and no
 *     copy lies in a folder that does not link to it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginContract } from './plugin-contract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

const files = walk(join(ROOT, 'skills'));
const words = Object.values(JSON.parse(readFileSync(join(ROOT, 'test/origin-words.json'), 'utf8'))).flat();
let failures = 0;
const fail = (line) => {
  console.log(`FAIL  ${line}`);
  failures++;
};

const json = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
for (const error of pluginContract({
  hasPortableManifest: existsSync(join(ROOT, 'plugin.json')), codex: json('.codex-plugin/plugin.json'),
  claude: json('.claude-plugin/plugin.json'), marketplace: json('.claude-plugin/marketplace.json'),
  pkg: json('package.json'),
})) fail(error);

for (const f of files) {
  const text = readFileSync(f, 'utf8').toLowerCase();
  for (const w of words) if (text.includes(w.toLowerCase())) fail(`${relative(ROOT, f)} names the origin ("${w}")`);
}

const skills = files.filter((f) => f.endsWith('/SKILL.md')).map((f) => dirname(f));
const listed = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8')).skills.map((p) => join(ROOT, p));
for (const s of skills) if (!listed.includes(s)) fail(`${relative(ROOT, s)} is not in plugin.json`);
for (const l of listed) if (!skills.includes(l)) fail(`plugin.json lists ${relative(ROOT, l)}, which has no SKILL.md`);

for (const s of skills) {
  const front = readFileSync(join(s, 'SKILL.md'), 'utf8').split('---')[1] || '';
  if (!front.includes(`name: ${s.split('/').pop()}\n`)) fail(`${relative(ROOT, s)}: frontmatter name differs from its folder`);
  const userOnly = /disable-model-invocation:\s*true/.test(front);
  let codex = '';
  try {
    codex = readFileSync(join(s, 'agents/openai.yaml'), 'utf8');
  } catch {
    fail(`${relative(ROOT, s)} has no agents/openai.yaml`);
    continue;
  }
  if (userOnly !== /allow_implicit_invocation:\s*false/.test(codex))
    fail(`${relative(ROOT, s)} is user-invoked in one harness and model-invoked in the other`);
}

const protocol = readFileSync(join(ROOT, 'skills/backlog/setup-shady2k-skills/protocol.md'), 'utf8');
for (const s of skills) {
  const links = readFileSync(join(s, 'SKILL.md'), 'utf8').includes('](protocol.md)');
  let copy = null;
  try {
    copy = readFileSync(join(s, 'protocol.md'), 'utf8');
  } catch {}
  if (links && copy === null) fail(`${relative(ROOT, s)} links to protocol.md and has none: npm run protocol`);
  else if (links && copy !== protocol) fail(`${relative(ROOT, s)}/protocol.md differs from the source: npm run protocol`);
  else if (!links && copy !== null) fail(`${relative(ROOT, s)} has a protocol.md its SKILL.md never links to`);
}

const version = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8')).version;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const rules = (readFileSync(join(ROOT, 'skills/backlog/setup-shady2k-skills/check.mjs'), 'utf8').match(/RULES_VERSION = '([^']+)'/) || [])[1];
if (version !== pkg || version !== rules) fail(`versions differ: plugin.json ${version}, package.json ${pkg}, check.mjs ${rules}`);
const commitRules = (readFileSync(join(ROOT, 'skills/backlog/setup-shady2k-skills/check-commits.mjs'), 'utf8').match(/RULES_VERSION = '([^']+)'/) || [])[1];
const protocolVersion = (protocol.match(/^Protocol version: (.+)$/m) || [])[1];
if (version !== commitRules || version !== protocolVersion)
  fail(`compatibility versions differ: plugin ${version}, commit check ${commitRules}, protocol ${protocolVersion}`);

console.log(failures ? `\n${failures} failure(s)` : `PASS  ${skills.length} skills, ${files.length} files: no origin words, manifest, invocation and protocol copies in step, version ${version}`);
process.exit(failures ? 1 : 0);
