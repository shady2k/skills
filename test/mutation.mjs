#!/usr/bin/env node
// Break real checks in isolated copies; require the intended fixture to fail.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = join(dirname(fileURLToPath(import.meta.url)), '../skills/backlog/setup-shady2k-skills');
const root = mkdtempSync(join(tmpdir(), 'skill-gate-mutations-'));
const mutations = [
  ...['dependency-cycle', 'nonleaf-dependency', 'submitted-without-evidence', 'implemented-without-evidence',
    'merged-but-open',
    'time-record-damaged', 'time-span-conflict', 'time-span-unclaimed', 'time-span-overlap', 'time-span-unreceipted',
    'time-work-unclaimed', 'time-void-idle'].map((id) => ({
    name: id, file: 'check.mjs', failure: `FAIL  bad/${id}.json`,
    change: (code) => {
      const at = code.indexOf(`id: '${id}'`);
      const before = code.slice(0, at);
      const after = code.slice(at).replace(/run: \((m(?:, cfg)?)\) =>/, 'run: ($1) => [] ||');
      return before + after;
    },
  })),
  { name: 'time-table-sums', file: 'time-format.mjs', runs: 'check.mjs', failure: 'FAIL  bad/time-record-damaged.json',
    change: (code) => code.replaceAll('if (s !== table.rows', 'if (false && s !== table.rows') },
  { name: 'time-retry-is-one-record', file: 'time-format.mjs', runs: 'check.mjs', failure: 'FAIL  good/time-records.json',
    change: (code) => code.replace('if (!distinct.has(canon(r.body))) distinct.set(canon(r.body), r);', 'distinct.set(r.comment, r);') },
  { name: 'time-void-retires', file: 'time-format.mjs', runs: 'check.mjs', failure: 'FAIL  good/time-void-corrects.json',
    change: (code) => code.replace('else voided.add(target.comment);', 'else;') },
  { name: 'time-void-of-void', file: 'time-format.mjs', runs: 'check.mjs', failure: 'FAIL  bad/time-void-idle.json',
    change: (code) => code.replace(": target.kind === 'void' ?", ': false ?') },
  { name: 'time-running-span', file: 'check.mjs', failure: 'FAIL  good/time-records.json',
    change: (code) => code.replace(": item && item.status !== 'active' ? `${s.item} is ${item.status}` : null;", ": `${s.item} is ${item?.status}`;") },
  { name: 'age-correction', file: 'check.mjs', failure: 'FAIL  ages-from: later real work',
    change: (code) => code.replace('old.has(i.id) && after.get(i.id) === i.updatedAt', 'old.has(i.id)') },
  { name: 'commit-missing', file: 'check-commits.mjs', failure: 'FAIL  commits/unlinked.json',
    change: (code) => code.replace('if (!commit.taskIds.length)', 'if (false)') },
  { name: 'commit-unknown', file: 'check-commits.mjs', failure: 'FAIL  commits/unknown.json',
    change: (code) => code.replace("if (!issue) violations.push", "if (!issue) continue; else if (false) violations.push") },
  { name: 'commit-container', file: 'check-commits.mjs', failure: 'FAIL  commits/container.json',
    change: (code) => code.replace("issue.type === 'epic' || parents.has(id)", 'false') },
  ...['unfinished-content', 'duplicate-id', 'missing-scenario', 'empty-capability',
    'empty-policy', 'missing-outcome', 'missing-change', 'open-question',
    'untracked-change', 'change-kind', 'invalid-delta', 'stale-base',
    'unknown-requirement', 'unsynced-current', 'uncovered-requirement',
    'missing-approval', 'stale-evidence', 'unproved-check'].map((id) => ({
    name: `documents-${id}`, file: 'check-docs.mjs', failure: `FAIL  documents/${id}:`,
    change: (code) => code.replace('if (condition) violations.push', `if (condition && id !== '${id}') violations.push`),
  })),
  // Each of these rules is muted in its own copy, and the fixture it was written
  // for has to catch it: a fixture that passes whether or not its rule works is
  // how a gate certifies instead of checking.
  ...[['unknown-constraint', 'constraint-unknown-requirement'],
    ['small-fixture', 'scale-check-on-a-small-fixture'],
    ['unknown-principle', 'design-names-a-principle-the-vision-does-not-declare'],
    ['principle-without-constraint', 'principle-named-without-a-constraint'],
    ['missing-principle', 'missing-principle'],
    ['missing-design-match', 'review-without-a-design-match'],
    ['design-divergence', 'review-that-found-a-divergence'],
    ['missing-judgement', 'no-judgement-record'],
    ['unknown-vision-id', 'a-judgement-names-an-undeclared-id'],
    ['unfound-quote', 'a-judgement-quote-is-not-in-the-document']].map(([id, fixture]) => ({
    name: `documents-${id}`, file: 'check-docs.mjs', failure: `FAIL  documents/${fixture}:`,
    change: (code) => code.replace('if (condition) violations.push', `if (condition && id !== '${id}') violations.push`),
  })),
  ...['unserved-outcome', 'unforecast-target', 'unmeasured-forecast'].map((id) => ({
    name: id, file: 'check.mjs', failure: `FAIL  bad/${id}.json`,
    // The rule answers to another id, so nothing fires it and its fixture says
    // so: this works whatever shape the rule's body has, which a body-level
    // edit does not once the body is an expression.
    change: (code) => code.replace(`id: '${id}',`, `id: '${id}-not-a-rule',`),
  })),
  { name: 'purpose-command', file: 'check.mjs', failure: 'FAIL  purpose/T3',
    change: (code) => code.replace('const lines = [`${p.id}: ${p.title}`];', 'const lines = [];') },
  { name: 'documents-mutation-not-made', file: 'check-docs.mjs', failure: 'FAIL  documents/a-mutation-run-that-is-not-made-is-not-a-refusal:',
    change: (code) => code.replace("kindOf.get(id) === 'mutation'", 'false') },
  { name: 'documents-applies-to', file: 'check-docs.mjs', failure: 'FAIL  documents/check-for-other-kind:',
    change: (code) => code.replace('!c.appliesTo || c.appliesTo.includes(change.kind)', 'true') },
  // A receipt stands for its own check's definition, not the whole policy: bound
  // back to the whole policy, the honest range that adds a check loses every
  // receipt it already held.
  { name: 'documents-receipt-stands-for-its-own-check', file: 'check-docs.mjs',
    failure: 'FAIL  documents/a-range-that-adds-a-check-keeps-the-other-receipts:',
    change: (code) => code.replace('? receipt.policyDigest === policyScope(policy, receipt.id)',
      '? evidence.policyDigest === digest(policy)') },
  // A refusal that names the cause the state shows: muted, its own case says so.
  { name: 'documents-stale-base-cause', file: 'check-docs.mjs',
    failure: 'FAIL  documents/stale-base-when-the-requirement-already-exists:',
    change: (code) => code.replace('!d.before && baseline.has(key) ? STALE_BASE_ALREADY_THERE : null', 'null') },
  { name: 'documents-unsynced-current-cause', file: 'check-docs.mjs',
    failure: 'FAIL  documents/premature-current:',
    change: (code) => code.replace('atTheEnd ? UNSYNCED_CURRENT_AT_THE_END : null', 'null') },
  ...[['old-debt', "was && was.how === false ? 'old-dead'", "false ? 'old-dead'", 'older-drift-is-debt'],
    ['removed-path', 'const dead = v.how === false ||', 'const dead =', 'change-removed-what-it-names'],
    ['a-link-says-it-exists', "v.ref.kind === 'link' || ", '', 'change-added-a-broken-link'],
    ['not-a-path', "if (first !== '..' && !seen.segments.has(first)) return null;", '', 'slashed-words-that-are-not-paths'],
    ['fences', 'if (mark && !comment) { fence = mark[1]; continue; }', '', 'fences-and-placeholders-are-examples'],
    ['ignores', 'ignored.some((m) => m(r.text)) || ', '', 'ignored-names'],
    ['untracked', " || placesOf(r, doc).some((p) => untracked.has(p))", '', 'what-git-ignores'],
    ['uncovered', 'if (!inside && ', 'if (false && ', 'uncovered-area'],
    ['aged', 'c.commits >= limit', 'false', 'aged-document'],
    ['exact-then-tail', "(was?.how === 'exact' && v.how === 'tail')", 'false', 'the-root-folder-gone-a-nested-one-left'],
    ['spans-before-links', 'line = line.replace(/(`+)([^`]+?)\\1(?!`)/g', 'line.replace(/(`+)([^`]+?)\\1(?!`)/g', 'examples-are-not-links'],
    ['comments', "const open = rest.indexOf('<!--');", 'const open = -1;', 'examples-are-not-links'],
    ['indented-code', '(indented || (blank && !listed))', 'false', 'examples-are-not-links'],
    ['list-continuation', '(indented || (blank && !listed))', '(indented || blank)', 'a-list-item-continues-with-four-spaces'],
    ['note-of-removal', "(was && was.how === 'exact') ? 'dead-reference'", "true ? 'dead-reference'", 'a-note-that-the-change-removed-a-path']].map(([id, from, to, fixture]) => ({
    name: `present-${id}`, file: 'check-present.mjs', failure: `FAIL  present/${fixture}`,
    change: (code) => code.replace(from, to),
  })),
  // The product-documents check: prose the set does not write is not searched
  // for references, and a document the set writes still has every id checked.
  ...[
    ['all-prose-is-owned', 'return { identity, written: path === VISION || Boolean(identity) || field || inFolders(path, folders) };',
      'return { identity, written: true };', 'product/decision-record-prose-that-looks-like-an-id'],
    ['no-prose-is-owned', 'return { identity, written: path === VISION || Boolean(identity) || field || inFolders(path, folders) };',
      'return { identity, written: false };', 'product/bare-missing-id-in-a-product-document'],
    ['a-link-is-a-reference', 'for (const target of linkTargets(l.raw, path))', 'for (const target of [])',
      'product/decision-record-link-to-a-missing-document'],
    ['a-comment-is-an-example', ").replace(/<!--[\\s\\S]*?-->/g, '')", ')',
      'product/link-inside-an-html-comment-is-an-example'],
  ].map(([id, from, to, fixture]) => ({
    name: `product-${id}`, file: 'check-product.mjs', failure: `FAIL  ${fixture}`,
    change: (code) => code.replace(from, to),
  })),
  { name: 'product-irregular-registry', file: 'check-product.mjs', failure: 'FAIL  product/registry-that-is-not-a-regular-file',
    change: (code) => code.replace('if (source.irregular?.includes(registry) || (st && !st.isFile())) {', 'if (false) {') },
  { name: 'documents-schema', file: 'check-docs.mjs', failure: 'FAIL  documents/unknown-field:',
    change: (code) => code.replace("schema(model, modelSchema, 'model');", '// model schema deliberately disabled') },
];

let failures = 0;
for (const mutation of mutations) {
  const dir = join(root, mutation.name);
  cpSync(source, dir, { recursive: true });
  const path = join(dir, mutation.file);
  const original = readFileSync(path, 'utf8');
  const changed = mutation.change(original);
  if (changed === original) throw new Error(`mutation no longer applies: ${mutation.name}`);
  writeFileSync(path, changed);
  const run = spawnSync(process.execPath, [join(dir, mutation.runs || mutation.file), '--selftest'], { encoding: 'utf8', timeout: 15000 });
  const killed = run.status === 1 && run.stdout.includes(mutation.failure);
  console.log(`${killed ? 'PASS' : 'FAIL'}  mutation ${mutation.name}: ${killed ? 'caught by intended fixture' : run.error?.message || run.stderr || run.stdout}`);
  if (!killed) failures++;
}
console.log(`Isolated mutation copies: ${root}`);
process.exitCode = failures ? 1 : 0;
