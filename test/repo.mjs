#!/usr/bin/env node
/**
 * What the gate's own self-test cannot see, because it looks at one skill:
 *
 *   - no file of ANY skill names the origin project or its tracker
 *     (test/origin-words.json), since that is where every rule here was
 *     bought and so the words most likely to leak;
 *   - every skill is listed in the plugin manifest, and nothing else is;
 *   - a skill is user-invoked in both harnesses or in neither;
 *   - a skill that links to the protocol, one of its references or the run
 *     journal, directly or through another of them, has it in its own folder,
 *     word for word the source's (test/sync-protocol.mjs writes the copies),
 *     and no copy lies in a folder that nothing it links to reaches;
 *   - every rule a skill cites as "the protocol's **Name**" is a heading in a
 *     file that skill carries.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginContract } from './plugin-contract.mjs';
import { SHARED, needs } from './sync-protocol.mjs';

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
  const needed = needs(s);
  for (const [name, owner] of Object.entries(SHARED)) {
    if (s === join(ROOT, owner)) continue;
    const source = readFileSync(join(ROOT, owner, name), 'utf8');
    let copy = null;
    try {
      copy = readFileSync(join(s, name), 'utf8');
    } catch {}
    const links = needed.has(name);
    if (links && copy === null) fail(`${relative(ROOT, s)} links to ${name} and has none: npm run protocol`);
    else if (links && copy !== source) fail(`${relative(ROOT, s)}/${name} differs from the source: npm run protocol`);
    else if (!links && copy !== null) fail(`${relative(ROOT, s)} has a ${name} nothing it links to reaches`);
  }
}

// A rule a skill cites by name is a rule it can read: the name is a heading of
// the protocol or of a reference that skill carries, whole or cut at a word
// boundary where the cut still names one rule ("A check is never rerun",
// "Estimates"). A rule dropped or renamed in a split is found here, not by the
// agent that looks for it.
const norm = (s) => s.split(/\s+/).join(' ').replace(/[.:,]$/, '');
const heading = (text) => [...text.matchAll(/(?:^|\n\n)\*\*([^*]+?)\*\*/g)].map((m) => norm(m[1]));
const resolves = (name, known) => {
  if (known.includes(name)) return true;
  const cut = known.filter((h) => h.startsWith(name) && /^[\s,.:;—-]/.test(h.slice(name.length)));
  return new Set(cut).size === 1;
};
for (const s of skills) {
  const carried = [...needs(s), ...(s === join(ROOT, 'skills/backlog/setup-shady2k-skills') ? Object.keys(SHARED) : [])]
    .filter((n) => n.endsWith('.md'));
  const known = carried.flatMap((n) => heading(readFileSync(join(ROOT, SHARED[n], n), 'utf8')));
  const text = readFileSync(join(s, 'SKILL.md'), 'utf8');
  for (const m of text.matchAll(/protocol's\s+\[?\*\*([^*]+?)\*\*/g)) {
    const name = norm(m[1]);
    if (!resolves(name, known))
      fail(`${relative(ROOT, s)} cites the protocol's "${name}", which no file it carries holds`);
  }
  const refs = join(s, 'references');
  if (s !== join(ROOT, 'skills/backlog/setup-shady2k-skills') && existsSync(refs))
    for (const n of readdirSync(refs))
      if (!(`references/${n}` in SHARED)) fail(`${relative(ROOT, s)}/references/${n} has no source: npm run protocol`);
}
const probes = ['A design decision comes with its mechanism', 'A check is never rerun to find out why it failed',
  'One thing, one name, and it is the project\'s', 'Levels'];
for (const [probe, want] of [['A', false], ['A design decision comes with its mechanis', false],
  ['A check is never rerun', true], ['One thing, one name', true], ['Levels', true], ['Level', false]])
  if (resolves(probe, probes) !== want)
    fail(`citation matching is wrong for "${probe}"`);

// The skills that work without setup never receive the core protocol, whose
// compatibility check would send a discussion to setup.
for (const n of ['productivity/brainstorming', 'engineering/model-domain', 'engineering/to-prototype',
  'productivity/to-research', 'engineering/diagnose-bug', 'productivity/handoff'])
  if (needs(join(ROOT, 'skills', n)).has('protocol.md')) fail(`skills/${n} reaches protocol.md, and must work without setup`);

const version = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8')).version;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (version !== pkg) fail(`plugin versions differ: plugin.json ${version}, package.json ${pkg}`);
// The plugin version moves with every change; the setup version only when a
// project's installation must be redone. The checks carry the setup version.
const setupVersion = (protocol.match(/^Setup version: (.+)$/m) || [])[1];
const rulesOf = (f) => (readFileSync(join(ROOT, 'skills/backlog/setup-shady2k-skills', f), 'utf8').match(/RULES_VERSION = '([^']+)'/) || [])[1];
for (const f of ['check.mjs', 'check-commits.mjs', 'check-docs.mjs'])
  if (rulesOf(f) !== setupVersion) fail(`${f} is version ${rulesOf(f)}, the protocol's setup version is ${setupVersion}`);
const semver = (v) => (v || '').split('.').map(Number);
const [a, b] = [semver(setupVersion), semver(version)];
if (!setupVersion || a.some(Number.isNaN) || a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))))
  fail(`setup version ${setupVersion} must be a version no later than the plugin's ${version}`);

console.log(failures ? `\n${failures} failure(s)` : `PASS  ${skills.length} skills, ${files.length} files: no origin words, manifest, invocation and protocol copies in step, plugin ${version}, setup ${setupVersion}`);
process.exit(failures ? 1 : 0);
