// The project's goal is one objective, two or three measured key results and the
// date the period closes, and every milestone, stage and task below it names the
// key result it moves. These are the contracts a check can hold: that the rule is
// stated once in the protocol, that each of the five skills carries its own step
// and links the rule, that the installed folder carries the copy its skill links
// to, and that each scenario below fails when its step or its link is deleted.
//
// What a check cannot hold is a run's behaviour under the rule: whether a
// milestone that moves no key result actually stops for the owner, whether a
// grooming session leaves an uncontributing root out of the slice, or whether a
// finding with no contribution is really filed deferred. Those are read by a
// model, and test/dialogue-scenarios.md case 39 is that case. This file proves
// the instruction and the link are present and go away together, nothing more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const SETUP = 'skills/backlog/setup-shady2k-skills';
const OKR = 'authoring/skills/backlog/setup-shady2k-skills/references/okr.md.in';
const PROTOCOL = 'authoring/skills/backlog/setup-shady2k-skills/protocol.md.in';
const RULE = 'A project\'s goal is its key results, and every piece of work names the one it moves';
const LINK = `[**${RULE}**](references/okr.md)`;

const SKILLS = {
  'define-product': 'authoring/skills/productivity/define-product/SKILL.md.in',
  'to-milestone': 'authoring/skills/backlog/to-milestone/SKILL.md.in',
  'to-stages': 'authoring/skills/backlog/to-stages/SKILL.md.in',
  'groom-backlog': 'authoring/skills/backlog/groom-backlog/SKILL.md.in',
  'to-backlog': 'authoring/skills/backlog/to-backlog/SKILL.md.in',
};

// Each scenario is the shape the plan was asked to hold, and the steps that make
// it hold. The steps are the skill's own; the rule's wording stays in one place.
const SCENARIOS = [
  {
    skill: 'to-milestone',
    scenario: 'a milestone from two or three key results and a date keeps the objective and names the key result on every outcome',
    needs: [
      'Read the project\'s goal with them, by the protocol\'s',
      'the objective, its two or three key results and the date the period closes',
      'Where the project has no goal yet, say so in one line and propose one with the draft rather than planning towards nothing',
      'It names in a `Moves:` line the key results it moves',
      'an outcome that moves none of the period\'s key results is a scope decision for the owner',
      'Set, charter file exists, and this is the running milestone',
      'no next milestone is planned over the running one',
      'Carried work is linked again',
      'The goal\'s `Due:` bounds the plan and is never copied as the milestone\'s own date',
      'a date the forecast over this milestone\'s own tasks supports',
      'every outcome names the key results it moves — read as unknown only where the project has no goal yet',
    ],
  },
  {
    skill: 'to-stages',
    scenario: 'every stage and task names the key result it moves, and a result bigger than one short pull request is cut',
    needs: [
      'It must also name the key results it moves',
      'An outcome written after the goal was agreed whose line names none is not decomposed',
      'An outcome, stage or task that was agreed before the goal, or before the line existed, is not that case',
      'An agreed record is not reopened for a missing link',
      'and the breakdown continues',
      'one short pull request and hours of agent work',
      'A result that is bigger is cut here until each piece is',
      'Names the key result it moves in its own `Moves:` line, and so does its stage',
      'every stage and task carries the key result it moves from the outcome\'s own line',
    ],
  },
  {
    skill: 'groom-backlog',
    scenario: 'the slice is the work that moves the key results, and a root with no stated contribution stays out of it',
    needs: [
      'Then read the project\'s goal',
      'The slice is the work that moves those key results',
      'leave a root whose contribution nobody can state outside the slice',
      'a link nobody can establish is written as unknown',
      'Where the project has no goal yet, say so in one line, propose one with the cleanup',
      'an unset goal defers nothing on its own, and an agreed slice stays agreed',
      'every root in the slice carries its label and says which key result it moves',
      'or says the link is unknown, where the project has no goal or nobody can state it',
    ],
  },
  {
    skill: 'to-backlog',
    scenario: 'a finding with a contribution is a finding and one without a contribution is not',
    needs: [
      'a bug or debt on the current milestone\'s path, and it moves or protects one of the goal\'s key results',
      'a bug on the current milestone\'s path that costs a person something now, and no key result can be shown',
      'It never reaches the deferred lane for want of a link',
      'a bug or debt that moves no key result and costs nobody anything now',
      'What a finding is worth reading is the key result it moves or protects',
      'Where the contribution cannot be stated, the item says so and the owner is asked',
      'Then read what it costs while it waits, before counting anything',
      'A required check that is green decided nothing about a defect people meet',
      'Then read the finding budget of the milestone the item would join from the config',
      'At or over budget the order is fixed',
      'the item is recorded where it waits',
      'Only that answer files it deferred or makes it ready',
      'a run that defers it on its own word has taken the decision',
      'no number is attached to qualify it for the queue',
      '**The key result it moves or protects**, in a `Moves:` line',
      'one short pull request and hours of agent work',
    ],
  },
  {
    skill: 'define-product',
    scenario: 'the conversation establishes the objective, two or three measured key results and the date they are read by',
    needs: [
      'what would prove the idea right — is its two or three key results',
      'Offer the smallest set of numbers that would show the objective reached',
      'The objective is the vision\'s `## Outcome`, in one sentence',
      'the objective in one sentence, and two or three key results with the value that counts as reached and the date the period closes',
      'that reading is the key result\'s own: the value against the date the goal promised',
    ],
  },
];

const requireAll = (text, needs, where) => {
  const t = norm(text);
  for (const need of needs) assert.ok(t.includes(norm(need)), `${where}: lost "${need}"`);
};

test('the rule is one objective, two or three measured key results and a date, and the owner sets it', () => {
  requireAll(read(OKR), [
    `**${RULE}.**`,
    'The direction is one objective in the owner\'s words',
    'two or three key results, never more',
    'each measured on the product or on its users, in a number, with the value that counts as reached and the date the period closes',
    'A key result is a target, not a status',
    'a target is never moved to meet what happened',
    'A goal nobody set is never written as an agreed one',
    'a project that has none yet says so in one line instead of inventing one',
    'In the vision\'s `## Success signal`',
    'the objective is the vision\'s `## Outcome`, in one sentence',
    'Due: <YYYY-MM-DD>',
    'K1: <what is measured> — <the value that counts as reached>',
    'Where a key result is a belief rather than a number someone already watches, it is written as [product.md](product.md)\'s hypothesis',
  ], 'okr.md');

  // The line the link is written on is the shape the set already writes into a
  // body, and the test says which: a rule that invented a second shape would
  // leave the tracker's own facts unread by whoever reads the rest of them.
  requireAll(read(OKR), ['in the same one-line shape the other facts a body carries use'], 'okr.md');
});

test('every level names the key result it moves, from the record and never from a title', () => {
  requireAll(read(OKR), [
    '**Every level names the key result it moves.**',
    'A charter\'s outcome line carries `Moves: K1, K2`, and so does each stage and each leaf under it',
    'the task\'s own line is the one that counts',
    'The link is read from the record, never inferred from a title',
  ], 'okr.md');
});

test('a key result\'s number belongs to its period, so a line resolves to one measurement', () => {
  requireAll(read(OKR), [
    '**A key result\'s id belongs to its period.**',
    'the next period\'s results continue the numbering rather than restart it',
    'a number is never given to a second measurement',
    'a `Moves: K1` line therefore names the one result written under its own `Due:` however old the record carrying it is',
    'Work carried into a new period is linked again before it continues',
    'each stage and each leaf under it confirms its line against the new period\'s results',
  ], 'okr.md');
});

test('the goal\'s date bounds the plan and is not the milestone\'s promise', () => {
  requireAll(read(OKR), [
    '**The goal\'s date bounds the plan; it is not the milestone\'s promise.**',
    'no milestone\'s forecast may pass it',
    'says in one line which key result it leaves for that date and what it delivers instead',
    'The goal\'s date is never copied into it',
  ], 'okr.md');
  requireAll(read(SKILLS['to-milestone']), [
    'The goal\'s `Due:` bounds the plan and is never copied as the milestone\'s own date',
    'a date the forecast over this milestone\'s own tasks supports',
  ], 'to-milestone');
});

test('an agreed record is not reopened for a missing link, and an unset goal defers nothing', () => {
  requireAll(read(OKR), [
    '**An agreed record is not reopened for a missing link.**',
    'The link is asked of a record being written, never of work already agreed',
    'their approved scope, plan and queue stand exactly as agreed',
    'never filled with a number chosen to keep the work live',
    'A project with no goal yet plans, breaks down and grooms from the agreement and the evidence it has',
    'an unset goal defers nothing on its own',
  ], 'okr.md');
});

test('work that moves no key result is not first priority, and the protocol\'s urgent work keeps its place', () => {
  requireAll(read(OKR), [
    '**Work that moves no key result is not first priority.**',
    'it takes a later milestone, the ideas lane with its review date, a deferred item under its feature, or a question for the owner',
    'What it never does is reach the front of the queue by being interesting, urgent in the agent\'s own reading, or cheap',
    'The exceptions stay the protocol\'s own, and each names what it protects',
    'a repair a landing waits on and upkeep of the installation are charged to the work they serve',
    'a fault that costs a person something now is a finding whatever budget is left',
    'A key result nobody can name does not decide that for them',
    '**A finding that does not fit is decided, not parked**',
  ], 'okr.md');

  // The urgent exceptions the rule leans on are the protocol's own headings, not
  // a new list invented here: a citation that names nothing would read as a rule.
  requireAll(read(PROTOCOL), [
    '**Only what the milestone chose is intake.**',
    '**A finding that does not fit is decided, not parked.**',
  ], 'protocol.md');
});

test('a contribution is a claim, and a link nobody can establish is not invented', () => {
  requireAll(read(OKR), [
    '**A contribution is a claim, and a claim carries its evidence.**',
    'What the work changes in the number, how that is observed, and what would show it moves nothing',
    'the item says the link is unknown, the owner is asked, and the answer is written where the item is read',
    'A key result named to qualify a piece of work is the measurement changed to suit the answer',
  ], 'okr.md');
});

test('the queue and the breakdown follow the key results, and a piece is one short pull request and hours', () => {
  requireAll(read(OKR), [
    '**The queue and the breakdown follow the key results.**',
    'Grooming\'s slice is the work that moves this period\'s key results',
    'a finding is on the queue when it moves one or protects one',
    'The breakdown cuts a result until each piece is one short pull request and hours of agent work',
    'a piece bigger than that is cut before it is filed',
    'one that cannot be cut without choosing between key results is the owner\'s decision, not the breakdown\'s',
  ], 'okr.md');

  // The size belongs to the levels, beside the session limit it narrows: one
  // owner for what a task is, and the same rule read from both places.
  requireAll(read(PROTOCOL), [
    'A task that will not fit one worker\'s session is split before it starts',
    'a session\'s worth of work is one short pull request and hours of agent work rather than a day',
    '[okr.md](references/okr.md)\'s **The queue and the breakdown follow the key results**',
    '- [okr.md](references/okr.md): the project\'s goal',
  ], 'protocol.md');
});

for (const { skill, scenario, needs } of SCENARIOS)
  test(`${skill}: ${scenario}`, () => {
    const text = read(SKILLS[skill]);
    assert.ok(norm(text).includes(LINK), `${skill} does not link the rule it rests on`);
    requireAll(text, needs, skill);
  });

// The over-budget sentence once read as an instruction to defer the finding, and a
// run followed it and took the owner's decision. The presence of a step cannot see
// that: what went wrong is a sentence telling the run to park the item itself.
test('an over-budget finding is never filed deferred on the run\'s own word', () => {
  const text = norm(read(SKILLS['to-backlog']));
  assert.ok(!text.includes('file it as deferred'),
    'to-backlog: an over-budget finding is filed deferred before the owner answers');
});

test('the installed folder carries the rule its skill links to', () => {
  const canonical = readFileSync(resolve(root, SETUP, 'references/okr.md'), 'utf8');
  assert.equal(canonical, read(OKR), 'the built rule is a copy of its source');
  for (const [skill, source] of Object.entries(SKILLS)) {
    const folder = dirname(source).replace(/^authoring\//, '');
    assert.ok(existsSync(resolve(root, folder, 'references/okr.md')), `${folder} carries no references/okr.md: npm run build`);
    assert.equal(read(`${folder}/references/okr.md`), canonical, `${folder}/references/okr.md differs from the rule: npm run build`);
    assert.ok(norm(read(`${folder}/SKILL.md`)).includes(LINK), `${folder}/SKILL.md lost the link the rule is read through`);
  }
});

test('every rule cited by name is a heading of the file the skill carries', () => {
  const headings = [...read(OKR).matchAll(/(?:^|\n\n)\*\*([^*]+?)\*\*/g)].map((m) => norm(m[1]).replace(/[.:,]$/, ''));
  for (const need of [
    RULE,
    'Where the goal is kept',
    'A key result\'s id belongs to its period',
    'The goal\'s date bounds the plan; it is not the milestone\'s promise',
    'Every level names the key result it moves',
    'An agreed record is not reopened for a missing link',
    'Work that moves no key result is not first priority',
    'A contribution is a claim, and a claim carries its evidence',
    'The queue and the breakdown follow the key results',
  ]) assert.ok(headings.includes(need), `the rule "${need}" is cited but is no heading of okr.md`);
});

// A fixture that passes whether or not its rule works certifies instead of
// checking. Each scenario is re-run on its own text with its first step deleted,
// and on the text with the link cut, and has to fail both times.
test('every scenario check fails when its step or its link is deleted', () => {
  for (const { skill, needs } of SCENARIOS) {
    const text = read(SKILLS[skill]);
    const step = needs[0];
    // The step is one passage of the file, whatever the wrapping: the deletion
    // is exact about the words and indifferent to where the line breaks fell.
    const passage = new RegExp(step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
    const withoutStep = text.replace(passage, '');
    assert.notEqual(withoutStep, text, `${skill}: the step "${step}" is not a single passage of the file, so deleting it proves nothing`);
    assert.throws(() => requireAll(withoutStep, needs, skill), `${skill}: a deleted step still passes`);
    const withoutLink = text.replaceAll('](references/okr.md)', ']()');
    assert.ok(!norm(withoutLink).includes(LINK), `${skill}: the link is not one passage, so cutting it proves nothing`);
    assert.throws(() => requireAll(withoutLink, [LINK], skill), `${skill}: a cut link still passes`);
  }
  const rule = read(OKR);
  const withoutRule = rule.replace('**Every level names the key result it moves.**', '');
  assert.notEqual(withoutRule, rule);
  assert.throws(() => requireAll(withoutRule, ['**Every level names the key result it moves.**'], 'okr.md'),
    'the rule can be deleted and the check still passes');
  for (const heading of ['**A key result\'s id belongs to its period.**',
    '**The goal\'s date bounds the plan; it is not the milestone\'s promise.**',
    '**An agreed record is not reopened for a missing link.**']) {
    assert.notEqual(rule.replace(heading, ''), rule, `${heading} is not one passage of the rule`);
    assert.throws(() => requireAll(rule.replace(heading, ''), [heading], 'okr.md'),
      `${heading} can be deleted and the check still passes`);
  }
});
