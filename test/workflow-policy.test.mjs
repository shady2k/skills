import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const fixture=JSON.parse(readFileSync(resolve(root,'test/fixtures/workflow-policy-cases.json'),'utf8'));
const normalize=s=>s.replace(/\s+/g,' ').trim();
function contractErrors(group,text) {
  const errors=[];
  for(const clause of group.clauses) if(!normalize(text).includes(normalize(clause))) errors.push('lost rule: '+clause);
  for(const example of group.cases) {
    // A case is pinned either as a Markdown table row or as the plain-word
    // worked case a rule states in prose; both must appear as written.
    const found=example.phrase
      ? normalize(text).includes(normalize(example.phrase))
      : text.includes(`| ${example.id} | ${example.situation} | ${example.expected} |`);
    if(!found) errors.push('lost behavioral case or expected disposition: '+example.id);
  }
  return errors;
}
for(const group of fixture.groups) {
  const source=readFileSync(resolve(root,group.source),'utf8');
  test(`${group.id}: canonical rules retain the behavioral reference cases`,()=>{
    assert.deepEqual(contractErrors(group,source),[]);
    assert.ok(group.cases.length>=6);
  });
  test(`${group.id}: removing each rule or reversing a case fails the contract`,()=>{
    for(const clause of group.clauses) {
      const changed=normalize(source).replace(normalize(clause),'REMOVED');
      assert.ok(contractErrors(group,changed).some(e=>e.startsWith('lost rule:')),clause);
    }
    for(const example of group.cases) {
      const changed=example.phrase
        ? normalize(source).replace(normalize(example.phrase),'Arbitrary success')
        : source.replace(`| ${example.id} | ${example.situation} | ${example.expected} |`,`| ${example.id} | ${example.situation} | Arbitrary success |`);
      assert.ok(contractErrors(group,changed).some(e=>e.endsWith(example.id)),example.id);
    }
  });
}
test('fixtures cover both new blockers and unrelated nits, plus identity and terminal-result failures',()=>{
  const ids=new Set(fixture.groups.flatMap(g=>g.cases.map(c=>c.id)));
  for(const id of ['introduced-regression','exposed-regression','unrelated-nit','twice-failed','older-revision','matching-version','wrong-tag-commit','wrong-pr-base','wrong-migration','wrong-environment','queued-deploy','open-pr-merge','open-pr-create','unreadable-result','failed-deploy','cancelled-deploy']) assert.ok(ids.has(id),id);
});
// This checks explicit policy contracts and reference scenarios. It does not
// execute a language model or claim to measure agent adherence to these rules.
