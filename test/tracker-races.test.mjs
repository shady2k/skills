import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, renameSync, readdirSync, utimesSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { newCtx,bringUp,mech,storeOf,post,storeItems,stopAllWatchers } from './tracker-sync-proof.mjs';
const root=resolve(import.meta.dirname,'..');
const source=process.env.TRACKER_RACE_SOURCE || join(root,'skills/backlog/setup-shady2k-skills/tracker-sync.mjs');
const src=()=>readFileSync(source,'utf8');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn) { const end=Date.now()+15000; while(Date.now()<end) {if(fn()) return;await delay(10);} throw new Error('barrier did not arrive'); }
const git=(cwd,args)=>{const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
function fixtureModule(dir,probe=false) {
  let s=src();
  if (!s.includes('if (process.argv[1]')) s=s.replace(/main\(\)\.catch\(\(e\) => die\(1,[^\n]+\n?/,'');
  // The old version has an empty publication window; the new version publishes
  // a complete directory. Probe exactly when the lock name becomes visible.
  if(probe) s=s.replace("const fd = openSync(p, 'wx');","const fd = openSync(p, 'wx'); globalThis.lockProbe?.();")
    .replace('renameSync(candidate, p);','renameSync(candidate, p); globalThis.lockProbe?.();');
  if(!s.includes('export function takeLock')) s+='\nexport {takeLock};\n';
  // A gated entrypoint left after removing its body still needs a statement.
  s=s.replace(/if \(process\.argv\[1\] === fileURLToPath\(import\.meta\.url\)\)\s*$/,'');
  const file=join(dir,'fixture.mjs');writeFileSync(file,s);return file;
}
test('lock is fully published before a contender can see its name',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lock-publish-'));
  try {
    const {takeLock}=await import(pathToFileURL(fixtureModule(dir,true)));
    let entered=false,other;
    globalThis.lockProbe=()=>{delete globalThis.lockProbe;try {other=takeLock({state:dir},dir);entered=true;} catch {}};
    const release=takeLock({state:dir},dir);delete globalThis.lockProbe;
    other?.();release();assert.equal(entered,false,'contender entered before owner publication finished');
  } finally {delete globalThis.lockProbe;rmSync(dir,{recursive:true,force:true});}
});
test('live owners cannot be stolen by mtime and old releases cannot remove a successor',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lock-owner-'));
  try {
    const {takeLock}=await import(pathToFileURL(fixtureModule(dir)));
    const release=takeLock({state:dir},dir),lock=join(dir,'lock');
    const file=statSync(lock).isDirectory()?readdirSync(lock).map(n=>join(lock,n))[0]:lock;utimesSync(file,new Date(0),new Date(0));
    assert.throws(()=>takeLock({state:dir},dir),/locked/);
    renameSync(lock,join(dir,'obsolete'));
    const next=takeLock({state:dir},dir);release();
    assert.throws(()=>takeLock({state:dir},dir),/locked/);next();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('sync reads HEAD and ancestry under the mutation lock, preserving a concurrent local commit',async()=>{
  const ctx=newCtx('race-stale-head');
  try {
    for(const machine of ['A','B']) {const r=bringUp(ctx,machine);assert.equal(r.code,0,r.out);}
    assert.equal(mech(ctx,'sync',[],{machine:'A'}).code,0);
    assert.equal(mech(ctx,'publish',[],{machine:'A'}).code,0);
    assert.equal(post(ctx,'B','i-1','remote-advance').code,0);assert.equal(mech(ctx,'publish',[],{machine:'B'}).code,0);
    git(ctx.remote,['merge-base','--is-ancestor',git(storeOf(ctx,'A'),['rev-parse','HEAD']),git(ctx.remote,['rev-parse','refs/tracker/state'])]);
    assert.equal(git(storeOf(ctx,'A'),['status','--porcelain','--','fake/items.jsonl','.tracker-sync']),'');
    const arrived=join(ctx.scratch,'arrived'),go=join(ctx.scratch,'go');
    const resetSnapshot=join(ctx.scratch,'reset-snapshot');
    const marker=`if (process.env.RACE_BARRIER && !globalThis.racePassed) {globalThis.racePassed=true;writeFileSync(process.env.RACE_BARRIER,'ready');while(!existsSync(process.env.RACE_GO)) await sleep(10);}`;
    const file=join(ctx.scratch,'barrier.mjs');writeFileSync(file,src().replace('async function locked(fn, waitMs = 120000) {','async function locked(fn, waitMs = 120000) {'+marker).replace("await gitOk(['reset', '--hard', remote.tip], { cwd: CURRENT.store });","await gitOk(['reset', '--hard', remote.tip], { cwd: CURRENT.store }); if(process.env.RACE_RESET) writeFileSync(process.env.RACE_RESET,await headOid());"));
    const child=spawn(process.execPath,[file,'sync','--recipe',ctx.recipe,'--repo',ctx.codeA,'--state',ctx.stateA],{env:{...process.env,RACE_BARRIER:arrived,RACE_GO:go,RACE_RESET:resetSnapshot},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
    const done=new Promise(r=>child.on('close',r));ctx.watchers.push(child);
    await until(()=>existsSync(arrived));
    assert.equal(post(ctx,'A','i-1','concurrent-local').code,0);assert.equal(mech(ctx,'publish',[],{machine:'A'}).code,0);
    const before=git(storeOf(ctx,'A'),['rev-parse','HEAD']);writeFileSync(go,'go');
    assert.equal(await done,0,output);
    git(storeOf(ctx,'A'),['merge-base','--is-ancestor',before,'HEAD']);
    if(existsSync(resetSnapshot)) git(storeOf(ctx,'A'),['merge-base','--is-ancestor',before,readFileSync(resetSnapshot,'utf8').trim()]);
    const item=storeItems(ctx,'A').find(i=>i.id==='i-1');assert.ok(item.comments.some(c=>c.text==='concurrent-local'));
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});
for(const mode of ['failed','timeout-no-ref','retried','retried-remote','accepted-timeout','accepted']) test(`conditional ${mode} push cannot publish speculation or erase concurrent local work`,async()=>{
  const rejected=mode==='failed'||mode==='timeout-no-ref';
  const ctx=newCtx(`race-conditional-${mode}`);
  try {
    const ready=bringUp(ctx,'A');assert.equal(ready.code,0,ready.out);
    if(mode==='retried-remote') {const readyB=bringUp(ctx,'B');assert.equal(readyB.code,0,readyB.out);}
    const arrived=join(ctx.scratch,'arrived'),go=join(ctx.scratch,'go');
    const marker=`if (process.env.RACE_BARRIER && !globalThis.racePassed) {globalThis.racePassed=true;writeFileSync(process.env.RACE_BARRIER,'ready');while(!existsSync(process.env.RACE_GO)) await sleep(10);${rejected?(mode==='timeout-no-ref'?"await gitOk(['push','origin',`:${CURRENT.ref}`],{cwd:CURRENT.store});return {unreachable:true};":'return {unreachable:true};'):mode==='accepted-timeout'?"await gitOk(['push','origin',`${oid}:${CURRENT.ref}`],{cwd:CURRENT.store});return {unreachable:true};":''}}`;
    const file=join(ctx.scratch,'barrier.mjs');writeFileSync(file,src().replace('async function pushOnce(oid) {','async function pushOnce(oid) {'+marker));
    const child=spawn(process.execPath,[file,'claim','--item','i-1','--holder','claiming-agent','--recipe',ctx.recipe,'--repo',ctx.codeA,'--state',ctx.stateA],{env:{...process.env,RACE_BARRIER:arrived,RACE_GO:go},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
    const done=new Promise(r=>child.on('close',r));ctx.watchers.push(child);
    await until(()=>existsSync(arrived));
    assert.equal(post(ctx,'A','i-1','independent-local-write').code,0);
    if(mode!=='accepted-timeout' && mode!=='accepted') {const published=mech(ctx,'publish',[],{machine:'A'});assert.equal(published.code,0,published.out);} else {
      // Commit the unrelated write locally without moving the remote.
      const live=storeOf(ctx,'A');const exp=spawnSync(process.execPath,[ctx.fake,'export'],{cwd:live,encoding:'utf8'});assert.equal(exp.status,0,exp.stderr);git(live,['add','fake/items.jsonl']);git(live,['-c','core.hooksPath=/dev/null','-c','user.name=proof','-c','user.email=proof@local','commit','-m','unrelated live write']);
    }
    if(mode==='retried-remote') {assert.equal(post(ctx,'B','i-1','remote-update-during-push').code,0);const p=mech(ctx,'publish',[],{machine:'B'});assert.equal(p.code,0,p.out);}
    const local=git(storeOf(ctx,'A'),['rev-parse','HEAD']);
    const remote=JSON.parse(git(ctx.remote,['show','refs/tracker/state:fake/items.jsonl']).split('\n')[0]);
    const speculativeHolder=remote.holder;
    writeFileSync(go,'go');assert.equal(await done,rejected?4:0,output);
    git(storeOf(ctx,'A'),['merge-base','--is-ancestor',local,'HEAD']);
    const current=storeItems(ctx,'A').find(i=>i.id==='i-1');assert.ok(current.comments.some(c=>c.text==='independent-local-write'));
    assert.equal(current.holder,rejected?'':'claiming-agent');
    if(rejected) assert.match(output,/outcome is unknown/);
    if(mode==='retried-remote') assert.ok(current.comments.some(c=>c.text==='remote-update-during-push'));
    assert.equal(speculativeHolder,'','another publisher exposed the unaccepted conditional write');
    const diagnostics=readdirSync(ctx.stateA).filter(n=>n.endsWith('.result.json')).map(n=>JSON.parse(readFileSync(join(ctx.stateA,n),'utf8')));
    assert.ok(diagnostics.length);assert.ok(diagnostics.every(d=>d.files>0 && d.bytes>0 && d.importMs>=0));
    if(mode==='accepted-timeout') {assert.ok(diagnostics.some(d=>d.phase==='accepted-reconciled'));assert.equal(git(storeOf(ctx,'A'),['for-each-ref','--format=%(refname)','refs/tracker-sync/candidates/']),'');}
    if(rejected) {assert.ok(diagnostics.some(d=>d.phase==='unknown' && d.retainedRef));assert.ok(git(storeOf(ctx,'A'),['for-each-ref','--format=%(refname)','refs/tracker-sync/candidates/']));}
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});
test('dead legacy and token owners recover, while an uninitialized legacy lock fails closed',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lock-recovery-'));
  try {
    const {takeLock}=await import(pathToFileURL(fixtureModule(dir)));
    const lock=join(dir,'lock');writeFileSync(lock,JSON.stringify({pid:2147483647,at:'old'}));
    takeLock({state:dir},dir)();assert.equal(existsSync(lock),false);
    // This empty file is exactly what a pre-upgrade process exposed between
    // exclusive creation and PID publication. Never treat unknown as dead.
    writeFileSync(lock,'');assert.throws(()=>takeLock({state:dir},dir),/verifiable owner/);rmSync(lock);
    const {mkdirSync}=await import('node:fs');mkdirSync(lock);
    writeFileSync(join(lock,'dead-token'),JSON.stringify({pid:2147483647,at:'old',token:'dead-token'}));
    takeLock({state:dir},dir)();assert.equal(existsSync(lock),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('candidate fatal errors clean only their worktree and preserve diagnostics and live data',async()=>{
  const ctx=newCtx('race-fatal-cleanup');
  try {
    const ready=bringUp(ctx,'A');assert.equal(ready.code,0,ready.out);
    const live=storeOf(ctx,'A'),before=readFileSync(join(live,'fake/db.json'),'utf8');
    const file=join(ctx.scratch,'fatal.mjs');
    writeFileSync(file,src().replace('return {oid:await commitState(`tracker store: ${kind} ${item}`,[before])};',"die(1,'injected candidate commit failure');"));
    const result=spawnSync(process.execPath,[file,'claim','--item','i-1','--holder','pending','--recipe',ctx.recipe,'--repo',ctx.codeA,'--state',ctx.stateA],{encoding:'utf8'});
    assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/injected candidate/);
    assert.equal(readFileSync(join(live,'fake/db.json'),'utf8'),before);
    const artifacts=readdirSync(ctx.stateA).filter(n=>n.startsWith('candidate-'));
    assert.equal(artifacts.length,1);assert.ok(artifacts[0].endsWith('.result.json'));
    const diagnostic=JSON.parse(readFileSync(join(ctx.stateA,artifacts[0]),'utf8'));
    assert.equal(diagnostic.phase,'error');assert.ok(diagnostic.files>0);assert.ok(diagnostic.bytes>0);
    assert.ok(!git(live,['worktree','list','--porcelain']).includes('candidate-'));
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});

for(const hazard of ['symlink','absolute-config','absolute-command','absolute-env']) test(`candidate refuses ${hazard} before changing the live database`,async()=>{
  const ctx=newCtx(`race-isolation-${hazard}`);
  try {
    const ready=bringUp(ctx,'A');assert.equal(ready.code,0,ready.out);
    const live=storeOf(ctx,'A'),before=readFileSync(join(live,'fake/db.json'),'utf8');
    if(hazard==='symlink') {
      const r=spawnSync('/bin/ln',['-s',join(live,'fake/db.json'),join(live,'shared-db')]);assert.equal(r.status,0);
    } else if(hazard==='absolute-config') writeFileSync(join(live,'local-config.json'),JSON.stringify({db:join(live,'fake/db.json')}));
    else {
      const custom=join(ctx.scratch,'recipe.mjs');
      writeFileSync(custom,`import original from ${JSON.stringify(pathToFileURL(ctx.recipe).href)};\nexport default {...original,${hazard==='absolute-command'?`import: ${JSON.stringify('cat '+JSON.stringify(join(live,'fake/db.json')))},`:`pointer: {...original.pointer,env: ${JSON.stringify('echo '+JSON.stringify('FAKE_STORE='+live))}},`}};`);
      ctx.recipe=custom;
    }
    const result=mech(ctx,'claim',['--item','i-1','--holder','pending']);
    assert.equal(result.code,1,result.out);assert.match(result.out,/cannot isolate/);
    assert.equal(readFileSync(join(live,'fake/db.json'),'utf8'),before);
    assert.ok(readdirSync(ctx.stateA).filter(n=>n.startsWith('candidate-')).every(n=>n.endsWith('.result.json')));
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});

test('pointer.env retains shell quoting, expansion, multiple assignments and unset semantics',async()=>{
  const ctx=newCtx('race-pointer-shell');
  try {
    const ready=bringUp(ctx,'A');assert.equal(ready.code,0,ready.out);
    const custom=join(ctx.scratch,'shell-recipe.mjs');
    const launcher='FAKE_STORE=<store>; ROUTE_A="two words"; ROUTE_B="$ROUTE_A quote"; unset ROUTE_POISON';
    const check='case "$PWD" in */candidate-*) test "$ROUTE_B" = "two words quote" && test "${ROUTE_POISON+x}" != x || exit 91;; esac; ';
    writeFileSync(custom,`import original from ${JSON.stringify(pathToFileURL(ctx.recipe).href)};\nexport default {...original,import:${JSON.stringify(check)}+original.import,pointer:{...original.pointer,env:${JSON.stringify("printf '%s\\n' "+JSON.stringify(launcher).replaceAll('$','\\$'))}}};`);
    ctx.recipe=custom;
    const result=mech(ctx,'claim',['--item','i-1','--holder','shell-agent'],{env:{ROUTE_POISON:'inherited'}});
    assert.equal(result.code,0,result.out);assert.equal(storeItems(ctx,'A')[0].holder,'shell-agent');
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});

test('SIGKILL leaves an inspectable own candidate and a subsequent attempt preserves it and live writes',async()=>{
  const ctx=newCtx('race-crash-cleanup');
  try {
    const ready=bringUp(ctx,'A');assert.equal(ready.code,0,ready.out);
    const arrived=join(ctx.scratch,'arrived');
    const file=join(ctx.scratch,'crash.mjs');
    writeFileSync(file,src().replace('async function pushOnce(oid) {',`async function pushOnce(oid) {writeFileSync(${JSON.stringify(arrived)},'ready');await new Promise(()=>{setInterval(()=>{},1000);});`));
    const child=spawn(process.execPath,[file,'claim','--item','i-1','--holder','crashed','--recipe',ctx.recipe,'--repo',ctx.codeA,'--state',ctx.stateA],{stdio:['ignore','pipe','pipe']});
    const done=new Promise(r=>child.on('close',r));ctx.watchers.push(child);
    await until(()=>existsSync(arrived));child.kill('SIGKILL');await done;
    const artifacts=readdirSync(ctx.stateA).filter(n=>n.startsWith('candidate-'));
    assert.equal(artifacts.length,2);
    const diagnostic=artifacts.find(n=>n.endsWith('.result.json'));
    const saved=readFileSync(join(ctx.stateA,diagnostic),'utf8');assert.equal(JSON.parse(saved).phase,'pushing');
    assert.equal(post(ctx,'A','i-1','survived-crash').code,0);
    const result=mech(ctx,'claim',['--item','i-1','--holder','after-crash']);assert.equal(result.code,0,result.out);
    assert.equal(readFileSync(join(ctx.stateA,diagnostic),'utf8'),saved);
    for(const name of artifacts) assert.ok(existsSync(join(ctx.stateA,name)));
    const item=storeItems(ctx,'A')[0];assert.equal(item.holder,'after-crash');assert.ok(item.comments.some(c=>c.text==='survived-crash'));
  } finally {await stopAllWatchers(ctx);rmSync(ctx.scratch,{recursive:true,force:true});}
});
