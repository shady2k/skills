import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pluginContract } from './plugin-contract.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const current = {
  hasPortableManifest: existsSync(new URL('../plugin.json', import.meta.url)), codex: read('../.codex-plugin/plugin.json'),
  claude: read('../.claude-plugin/plugin.json'), marketplace: read('../.claude-plugin/marketplace.json'),
  pkg: read('../package.json'),
};
test('current distribution passes', () => assert.deepEqual(pluginContract(current), []));
for (const [label, mutate, expected] of [
  ...['codex', 'claude'].flatMap((format) => [
    [`${format} version drift`, (c) => { c[format].version = '0.0.0'; }, `${format}: version differs from package.json`],
    [`${format} name drift`, (c) => { c[format].name = 'wrong'; }, `${format}: plugin name differs from package.json`],
  ]),
  ['portable manifest with bucketed skills', (c) => { c.hasPortableManifest = true; }, 'portable: root plugin.json hides bucketed skills in Codex 0.154.0'],
  ['partial skill tree', (c) => { c.codex.skills = './skills/backlog/'; }, 'codex: must discover the complete skills/ tree'],
  ['unsupported array', (c) => { c.codex.skills = ['./skills/']; }, 'codex: must discover the complete skills/ tree'],
  ['wrong marketplace root', (c) => { c.marketplace.plugins[0].source = './missing'; }, 'marketplace: must expose this root plugin as shady2k-skills@shady2k'],
  ['missing marketplace entry', (c) => { c.marketplace.plugins = []; }, 'marketplace: must expose this root plugin as shady2k-skills@shady2k'],
]) {
  test(`rejects ${label}`, () => {
    const broken = structuredClone(current);
    mutate(broken);
    assert.deepEqual(pluginContract(broken), [expected]);
  });
}
