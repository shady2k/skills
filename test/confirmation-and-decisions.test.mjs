// Before acting, the agent says back in its own words the goal the person wants
// made true and the way it will take, and waits for their confirmation of that
// statement; their yes answers those words and nothing read into them. A
// decision about the product, once given, is written where the next run reads
// it — the product's documents, with the line and the quote it came from. These
// are the contracts a check can hold: the rule is stated once in the protocol,
// each of the three skills carries its own step and links the rule, the
// recording step cites the product documents' own rule, and each scenario below
// fails when its step or its link is deleted.
//
// What a check cannot hold is what the agent does in the conversation: whether
// it really says the goal and the way back before the first action, whether a
// yes is read as covering only those words, and whether a decision agreed in the
// talk appears in the right document with a true citation. Those are read by a
// model, and `test/dialogue-scenarios.md` cases 46 to 48 are those cases. This
// file proves the instruction and the link are present and go away together,
// nothing more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const SETUP = 'skills/backlog/setup-shady2k-skills';
const SPEAKING = 'authoring/skills/backlog/setup-shady2k-skills/references/speaking.md.in';
const RULE = 'The goal and the way are said back before the work, and a yes answers those words';
const KEPT = 'A decision the owner gives is kept, not only obeyed';
const LINK = `[**${RULE}**](references/speaking.md)`;

const requireAll = (text, needs, where) => {
  const body = norm(text);
  for (const need of needs)
    if (!body.includes(norm(need))) assert.fail(`${where}: lost "${need}"`);
};

// Each skill's own step: what it says in its own words, where the rule lands in
// that skill, and the link the rule is read through. The rule's wording stays in
// speaking.md and is never copied into a skill.
const SKILLS = [
  {
    skill: 'define-product',
    source: 'authoring/skills/productivity/define-product/SKILL.md.in',
    needs: [
      'A decision taken is written then.',
      'in an orientation, a run\'s preflight, or any conversation that is not this one',
      'the kind it changes, the source line and the quote, and no wait for a shaping session',
      'What is derived is said back before it is written.',
      'the citation stays the line they spoke, never the restatement',
    ],
  },
  {
    skill: 'ask-shady2k',
    source: 'authoring/skills/backlog/ask-shady2k/SKILL.md.in',
    needs: [
      'Before it starts, say back in your own words the goal that action serves and the way it will take',
      'not a narrower or larger version of it read into the agreement',
      'belongs to the product\'s documents and is written by `define-product` in the same turn',
    ],
  },
  {
    skill: 'take-task',
    source: 'authoring/skills/engineering/take-task/SKILL.md.in',
    needs: [
      'Before that first write, say back in your own words the goal the feature serves and the way the run will take',
      'their yes to "run" agreed the plan, and this is how the run knows it read the same plan',
      'a decision about the product itself — what a user sees, one step of a journey, a limit or a term — goes into the product\'s documents in that same write',
    ],
  },
];

test('the rule is said once in the protocol: the goal and the way, and what a yes answers', () => {
  const speaking = read(SPEAKING);
  requireAll(speaking, [
    `**${RULE}.**`,
    'Understanding comes before acting: before the first action of a piece of work',
    'what the person wants to be true — the goal — and how you will get there — the way',
    'wait for their confirmation of that statement',
    'The yes covers the words that were said back and nothing read into them',
    'not a budget, a deadline or a requirement nobody named',
    'not a step that follows only in the agent\'s reading of the work',
    'The statement adds no constraint the person did not set',
    'Their correction is the decision, kept by',
  ], 'speaking.md');

  const catalog = JSON.parse(read('authoring/catalog.json'));
  const sources = [...new Set(Object.values(catalog.entries))];
  const owners = sources.filter((path) => norm(read(path)).includes(norm(`**${RULE}.**`)));
  assert.deepEqual(owners, [SPEAKING], `"${RULE}" is stated outside its owner: ${owners.join(', ')}`);
});

test('a product decision is written into the document kind it changes as it is taken', () => {
  const speaking = read(SPEAKING);
  requireAll(speaking, [
    `**${KEPT}.**`,
    'a product requirement, a use case, a user story or an open question',
    'with the line and the quote it came from',
    'It is written as it is taken, in the same turn, not at the next planning session',
    'a decision kept only in the conversation or a comment is one the next run cannot read',
  ], 'speaking.md');
});

test('each of the three skills carries its own step and links the rule', () => {
  for (const { source, needs } of SKILLS) {
    requireAll(read(source), [...needs, LINK], source);
  }
});

test('a deleted step, a deleted link or a deleted rule fails the check', () => {
  for (const { source, needs } of SKILLS) {
    const text = read(source);
    for (const step of needs) {
      const passage = new RegExp(step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
      const cut = text.replace(passage, '');
      assert.notEqual(cut, text, `${source}: "${step}" is not one passage of the file`);
      assert.throws(() => requireAll(cut, [step], source), `${source}: a deleted step still passes`);
    }
    const withoutLink = text.replaceAll('](references/speaking.md)', ']()');
    assert.throws(() => requireAll(withoutLink, [LINK], source), `${source}: a cut link still passes`);
  }

  // The rule's own sentences, not only its heading, are what a skill relies on;
  // removing any of them leaves a heading that promises more than the text says.
  const speaking = read(SPEAKING);
  for (const passage of [
    'wait for their confirmation of that statement',
    'The yes covers the words that were said back and nothing read into them',
    'The statement adds no constraint the person did not set',
    'It is written as it is taken, in the same turn, not at the next planning session',
  ]) {
    const pattern = new RegExp(passage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
    const cut = speaking.replace(pattern, '');
    assert.notEqual(cut, speaking, `"${passage}" is not one passage of speaking.md`);
    assert.throws(() => requireAll(cut, [passage], SPEAKING),
      `"${passage}" can be deleted and the check still passes`);
  }
});

test('every skill that cites the rule carries the file it is a heading of', () => {
  const canonical = read(`${SETUP}/references/speaking.md`);
  assert.ok(norm(canonical).includes(norm(`**${RULE}.**`)), 'the installed speaking.md lost the rule: npm run build');
  for (const { skill, source } of SKILLS) {
    const folder = dirname(source).replace(/^authoring\//, '');
    assert.ok(norm(read(`${folder}/SKILL.md`)).includes(norm(LINK)),
      `${folder} (${skill}) lost the link the rule is read through`);
    assert.equal(read(`${folder}/references/speaking.md`), canonical,
      `${folder}/references/speaking.md differs from the rule: npm run build`);
  }
});
