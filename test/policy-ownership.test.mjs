import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/build-skills.mjs';
import { policyInputs,checkPolicies } from '../scripts/check-policy-ownership.mjs';
const manifest=JSON.parse(readFileSync(resolve(ROOT,'authoring/policy-ownership.json'),'utf8'));
const before=JSON.parse(readFileSync(resolve(ROOT,'test/fixtures/policy-consolidation-before.json'),'utf8'));
const normalize=s=>s.replace(/\s+/g,' ').trim();
test('policy definitions have one owner and consumers retain links and distinct duties',()=>{
  assert.deepEqual(checkPolicies(policyInputs(),manifest),[]);
});
test('returning each original repeated policy to its consumer fails the ownership gate',()=>{
  const cases=[
    ['reviewer-policy','reviewer-setup'],
    ['model-environment','describe-repository'],
    ['model-environment','write-intended-model'],
    ['decision-material','supervised-question'],
  ];
  for (const [id,fixture] of cases) {
    const group=manifest.groups.find(g=>g.id===id);
    const path=id==='model-environment'?`authoring/skills/engineering/${fixture}/SKILL.md.in`:Object.keys(group.consumers)[0];
    const texts=policyInputs(); texts[path]+='\n\n'+before.excerpts[fixture];
    assert.ok(checkPolicies(texts,manifest).some(e=>e.includes(id)&&e.includes('repeated policy')),fixture);
  }
});
test('every retained policy condition and distinct step requirement has a negative fixture',()=>{
  for (const group of manifest.groups) {
    for (const required of group.required) {
      const texts=policyInputs(); texts[group.owner]=normalize(texts[group.owner]).replaceAll(normalize(required),'REMOVED');
      assert.ok(checkPolicies(texts,manifest).some(e=>e.includes(group.id)&&e.includes('lost condition')),required);
    }
    for (const [path,conditions] of Object.entries(group.consumers)) for (const required of conditions) {
      const texts=policyInputs();texts[path]=normalize(texts[path]).replaceAll(normalize(required),'REMOVED');
      assert.ok(checkPolicies(texts,manifest).some(e=>e.includes('lost link or distinct step condition')),required);
    }
  }
});
test('repeating a definition in its own reference fails too',()=>{
  for (const group of manifest.groups) {
    const texts=policyInputs();texts[group.owner]+='\n\n'+texts[group.owner];
    assert.ok(checkPolicies(texts,manifest).some(e=>e.includes(group.id)&&e.includes('occur once')));
  }
});

test('returning an individual canonical assertion to a consumer fails too',()=>{
  for (const group of manifest.groups) for (const assertion of group.required) {
    const texts=policyInputs(),path=Object.keys(group.consumers)[0];
    texts[path]+='\n\n'+assertion;
    assert.ok(checkPolicies(texts,manifest).some(e=>e.includes(group.id)&&e.includes('repeated policy')),assertion);
  }
});
