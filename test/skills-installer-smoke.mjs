#!/usr/bin/env node
// Explicit network smoke only; not part of npm test. The package is pinned to
// the official vercel-labs/skills release, with no consumer build step.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'official-skills-smoke-'));
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const home=join(temp,'home'), work=join(temp,'project');
for (const d of [home,work]) mkdirSync(d,{recursive:true});
for (const name of ['user.npmrc','global.npmrc']) writeFileSync(join(temp,name),'');
const env={PATH:process.env.PATH,HOME:home,TMPDIR:temp,
  XDG_CONFIG_HOME:join(home,'config'),XDG_CACHE_HOME:join(home,'cache'),XDG_DATA_HOME:join(home,'data'),XDG_STATE_HOME:join(home,'state'),
  CODEX_HOME:join(home,'codex'),CLAUDE_CONFIG_DIR:join(home,'claude'),
  npm_config_registry:'https://registry.npmjs.org/',npm_config_cache:join(temp,'npm-cache'),npm_config_userconfig:join(temp,'user.npmrc'),npm_config_globalconfig:join(temp,'global.npmrc'),npm_config_ignore_scripts:'true',
  GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1',CI:'1',NO_COLOR:'1'};
function run(args,cwd=work) {
  const result=spawnSync('npx',['--yes','--package=skills@1.7.2','skills',...args],{cwd,env,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.error?.message || result.stderr || result.stdout);
  return result.stdout.replace(/\x1b\[[0-9;]*m/g,'');
}
function verify(source,installed) {
  for (const file of walk(source)) {
    const target=join(installed,relative(source,file));
    assert.ok(existsSync(target),`missing installed resource: ${relative(source,file)}`);
    assert.deepEqual(readFileSync(target),readFileSync(file),`resource drift: ${file}`);
  }
  for (const file of walk(installed).filter(p=>p.endsWith('.md'))) {
    for (const [,link] of readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'').matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link)||link.startsWith('/')||/[<>{}$]/.test(link)) continue;
      assert.ok(existsSync(resolve(dirname(file),link)),`broken installed link: ${file}: ${link}`);
    }
  }
}
try {
  const metadata=spawnSync('npm',['view','skills@1.7.2','name','version','repository.url','dist.integrity','--json'],{cwd:work,env,encoding:'utf8',timeout:120000});
  assert.equal(metadata.status,0,metadata.stderr);
  const provenance=JSON.parse(metadata.stdout);
  assert.equal(provenance.name,'skills'); assert.equal(provenance.version,'1.7.2');
  assert.equal(provenance['repository.url'],'git+https://github.com/vercel-labs/skills.git');
  assert.equal(provenance['dist.integrity'],'sha512-j+GzyF/oNahsjjjup6y3lJpFkC1lQjIkf4kAMXICA1hboBqi0fAGXAGoE4x9FRZiP1br/YE9+L3/Tqq6PIAe0A==');
  // A disposable source copy proves that no authoring input/build tool is
  // required by the installer, and prevents source mutation by the package.
  const source=join(temp,'source'); mkdirSync(source);
  for (const name of ['skills','authoring','.claude-plugin','.codex-plugin','package.json']) cpSync(join(root,name),join(source,name),{recursive:true});
  const entries=walk(join(source,'skills')).filter(p=>p.endsWith('/SKILL.md'));
  const names=entries.map(p=>readFileSync(p,'utf8').match(/^name: (.+)$/m)[1]);
  assert.equal(names.length,24);
  const list=run(['add',source,'--list']);
  assert.match(list,/Found 24 skills/);
  for (const name of names) assert.ok(list.includes(name),`not discovered: ${name}`);
  run(['add',source,'--skill','*','--agent','codex','--copy','--yes']);
  const installed=walk(work).filter(p=>p.endsWith('/SKILL.md'));
  assert.equal(installed.length,24,'authoring must not add discovered skills');
  for (const entry of entries) {
    const name=readFileSync(entry,'utf8').match(/^name: (.+)$/m)[1];
    const target=installed.find(p=>readFileSync(p,'utf8').match(/^name: (.+)$/m)?.[1]===name);
    assert.ok(target,`not installed: ${name}`); verify(dirname(entry),dirname(target));
  }
  const standalone=join(temp,'standalone'), singleProject=join(temp,'single-project');
  cpSync(join(source,'skills/engineering/take-task'),standalone,{recursive:true}); mkdirSync(singleProject);
  const singleList=run(['add',standalone,'--list'],singleProject); assert.match(singleList,/Found 1 skill/);
  run(['add',standalone,'--agent','codex','--copy','--yes'],singleProject);
  const single=walk(singleProject).filter(p=>p.endsWith('/SKILL.md')); assert.equal(single.length,1);
  verify(standalone,dirname(single[0]));
  console.log('PASS skills@1.7.2: discovery/install 24 skills, no authoring discovery, byte-identical resources and links; standalone take-task installed with all dependencies.');
} finally {rmSync(temp,{recursive:true,force:true});}
