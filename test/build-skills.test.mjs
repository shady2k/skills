import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import * as awaitFs from 'node:fs';
import { build, render, ROOT } from '../scripts/build-skills.mjs';
import { duplicates } from '../scripts/check-authoring-duplicates.mjs';
import { needs } from './sync-protocol.mjs';
const fragments = {a:{source:'a'}, b:{source:'b'}};
const expand = (text, sources) => render(text,fragments,p=>sources[p]);
test('nested includes preserve whitespace and reject ambiguity', () => {
  assert.equal(expand('x\n{{include:a}}\ny',{a:'A{{include:b}}',b:'B\n'}),'x\nAB\n\ny');
  assert.throws(()=>expand('{{include:missing}}',{}),/Unknown/);
  assert.throws(()=>expand('{{include:a}}',{a:'{{include:b}}',b:'{{include:a}}'}),/cycle/);
  assert.throws(()=>expand('{{include:a}}{{include:b}}',{a:'{{include:b}}',b:'B'}),/Duplicate/);
  assert.throws(()=>expand('{{include:a',{}),/Malformed/);
});
test('every published entry has an identical deterministic source; manual edits fail', () => {
  const dir=mkdtempSync(join(tmpdir(),'skill-build-'));
  try {
    cpSync(join(ROOT,'authoring'),join(dir,'authoring'),{recursive:true});
    cpSync(join(ROOT,'skills'),join(dir,'skills'),{recursive:true});
    const first=build(dir,true); assert.deepEqual(build(dir,true),first);
    const target=join(dir,first.keys().next().value);
    writeFileSync(target,readFileSync(target,'utf8')+'manual edit');
    assert.throws(()=>build(dir,true),/Stale generated output/);
    build(dir); assert.deepEqual(build(dir,true),first);
    const packaged=join(dir,'skills/engineering/take-task/references/speaking.md');
    writeFileSync(packaged,'manual copy edit');
    assert.throws(()=>build(dir,true),/Stale generated output/);
    cpSync(join(ROOT,'skills'),join(dir,'skills'),{recursive:true});
    const source=join(dir,'authoring/skills/engineering/take-task/SKILL.md.in');
    const original=readFileSync(source,'utf8');
    writeFileSync(source,original+'\n[x](references/speeking.md)');
    assert.throws(()=>build(dir,true),/Unknown shared reference/);
    writeFileSync(source,original+'\n[x](missing.md#section)');
    assert.throws(()=>build(dir,true),/Missing local link/);
    writeFileSync(source,original);
    const repeated='An added canonical instruction repeated in two authoring entries must be reported for review rather than silently copied forever. This sentence is intentionally long enough to exercise the prose check.';
    const other=join(dir,'authoring/skills/backlog/close-out/SKILL.md.in');
    writeFileSync(source,original+'\n\n'+repeated);
    writeFileSync(other,readFileSync(other,'utf8')+'\n\n'+repeated);
    assert.ok(Object.values(duplicates(dir)).some(paths=>paths.length===2));
    writeFileSync(source,original);
    cpSync(join(ROOT,'authoring'),join(dir,'authoring'),{recursive:true});
    const catalog=JSON.parse(readFileSync(join(dir,'authoring/catalog.json'),'utf8'));
    delete catalog.entries[first.keys().next().value];
    writeFileSync(join(dir,'authoring/catalog.json'),JSON.stringify(catalog));
    assert.throws(()=>build(dir,true),/no template|owner/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
test('authoring cannot be discovered as skills and each installed folder is standalone', () => {
  const {readdirSync,existsSync}=awaitFs;
  const walk = d => readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
  assert.equal(walk(join(ROOT,'authoring')).filter(p=>p.endsWith('/SKILL.md')).length,0);
  const entries=walk(join(ROOT,'skills')).filter(p=>p.endsWith('/SKILL.md'));
  assert.equal(entries.length,24);
  for (const entry of entries) {
    const dir=mkdtempSync(join(tmpdir(),'standalone-skill-'));
    try {
      const source=entry.slice(0,-'/SKILL.md'.length);
      cpSync(source,join(dir,'skill'),{recursive:true});
      for (const file of walk(join(dir,'skill')).filter(p=>p.endsWith('.md'))) {
        const text=readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
        for (const [,link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(link)||link.startsWith('/')||/[<>{}$]/.test(link)) continue;
          assert.ok(existsSync(resolve(dirname(file),link)),`${entry}: ${link}`);
        }
      }
    } finally {rmSync(dir,{recursive:true,force:true});}
  }
});
test('setup bump edits the authoring source and the build packages its new version', () => {
  const dir=mkdtempSync(join(tmpdir(),'skill-bump-'));
  try {
    for (const folder of ['authoring','skills','scripts','test','.claude-plugin','.codex-plugin']) cpSync(join(ROOT,folder),join(dir,folder),{recursive:true});
    cpSync(join(ROOT,'package.json'),join(dir,'package.json'));
    const increment = v => { const parts=v.split('.').map(Number); parts[2]++; return parts.join('.'); };
    const nextPlugin=increment(JSON.parse(readFileSync(join(dir,'package.json'),'utf8')).version);
    const protocolSource=join(dir,'authoring/skills/backlog/setup-shady2k-skills/protocol.md.in');
    const nextSetup=increment(readFileSync(protocolSource,'utf8').match(/^Setup version: (.+)$/m)[1]);
    const bump=spawnSync(process.execPath,['scripts/bump.mjs',nextPlugin,'--setup',nextSetup],{cwd:dir,encoding:'utf8'});
    assert.equal(bump.status,0,bump.stderr);
    assert.ok(readFileSync(protocolSource,'utf8').includes(`Setup version: ${nextSetup}`));
    const built=spawnSync(process.execPath,['scripts/build-skills.mjs'],{cwd:dir,encoding:'utf8'});
    assert.equal(built.status,0,built.stderr);
    assert.ok(readFileSync(join(dir,'skills/engineering/take-task/protocol.md'),'utf8').includes(`Setup version: ${nextSetup}`));
    assert.doesNotThrow(()=>build(dir,true));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('the retained transitive packager follows anchored references', () => {
  const dir=mkdtempSync(join(tmpdir(),'skill-anchor-'));
  try {
    writeFileSync(join(dir,'SKILL.md'),'[Speaking](references/speaking.md#language)');
    assert.ok(needs(dir).has('references/speaking.md'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
