# Living documents and the document gate

Read this during setup, including upgrades from an installation that only checked
the backlog and commit links. Install its templates as project resources or point
to accessible shipped resources; consuming skills discover them through the
project integration, never through a sibling skill's filesystem path.

## Intent, accepted state, change, evidence

- **Vision:** audience, problem, desired outcome, deliberate exclusions and
  constraints. A direction, not a promise to build every idea.
- **Roadmap:** intended outcomes and sequencing rationale. Near work is concrete;
  distant work stays hypothetical. A short section of vision is sufficient.
  Query task status from the tracker or generate the status view; do not keep a
  second editable task list. Roadmap order does not create dependencies.
- **Milestone charter:** agreed outcomes, observable criteria, exclusions and
  scope decisions. Current milestone and changing budget remain in gate config.
- **Current specifications:** accepted behaviour by capability, stable requirement
  identifiers, observable scenarios, constraints and errors. Current means the
  accepted mainline revision, not whichever deployment happens to be live.
- **Changes:** proposals/deltas against current requirements, linked to tracked
  leaves. A feature may affect several capabilities; a capability outlives a feature.
- **Architecture and decisions:** current system boundaries/ownership and the
  rationale behind consequential decisions. Add design, glossary or decision
  records only when they clarify real uncertainty or durable trade-offs.
- **Evidence:** checks and their results for exact inputs, separate from authored
  assertions of success. A generated wiki/index is a view, not another authority.
- **Exploration:** optional retained questions, hypotheses and observations, never
  automatically approved requirements. A conversation may leave no artifact.

Suggested new-project paths (defaults, not mandatory names):

```text
docs/vision.md
docs/roadmap.md                     # or a section of vision
docs/milestones/<milestone>.md
docs/system/index.md                # coverage and known unknowns
docs/system/capabilities/<name>.md
docs/system/architecture.md         # when useful
docs/changes/<change>/change.md
docs/changes/<change>/design.md      # when needed
docs/decisions/
docs/explorations/                   # only when retention is requested
```

Do not scaffold empty documents for every path. Start with vision, the first
charter and one useful change. Current capabilities may be empty before the first
accepted implementation. Discussion needs neither setup nor these documents;
only retained work and implementation cross those boundaries.

## Adopt, do not forcibly migrate

Inventory existing specifications, plans, commands, hooks and open work before
writing. Recommend one workflow owner and one canonical source for each role.
Keep existing paths and formats when usable. Existing plans describe intent;
do not relabel them as verified current state without code/test evidence.
Add only missing current-state coverage and checks. Do not disable another
plugin, delete documents, move active work or duplicate its task list as a setup
side effect. A full migration requires a separately authorized plan and recovery.

For a legacy system, baseline the capability being changed from evidence. Mark
unknown coverage explicitly; do not invent a full system specification. Enforce
new work without making unrelated undocumented history block every feature.
Multiple changes stay independent unless they consume the same result or compete
for the same resource. Pin the old content of each changed requirement, not a
single global spec revision that invalidates every parallel change.

## Templates

Use `templates/vision.md`, `roadmap.md`, `milestone.md`, `capability.md` and
`change.md` as editorial seeds. `design.md` and `exploration.md` are conditional.
Replace placeholders; do not publish empty scaffolds. Existing equivalent
documents take precedence over creating duplicates. A small change may live in
its task body, provided the deterministic export includes it and the accepted
behaviour eventually reaches the current specification. Templates do not script
the conversation or require an answer for every heading.

The Markdown format is project-owned. `document-format.mjs` supplies deterministic
`parseVision(text)`, `parseMilestone(text, id)` and `parseCapability(text)` readers
for the shipped templates. Reuse them for that format; missing mandatory content
reaches the gate as empty, ambiguous/unknown structural sections throw. They
ignore headings inside fenced examples. Custom/native formats and the project's
change/task/evidence storage still need a proved adapter. Setup must implement and prove a
**deterministic** adapter from the selected Markdown/structured format and tracker
to the JSON contract below. Do not ask a model to invent a passing JSON export.
Use explicit section/identifier parsing, reject ambiguous or unrecognized records,
and preserve complete requirement text and scenarios. Test the adapter against
real missing sections, duplicates and changed requirements, not only hand-written
JSON fixtures. The shipped checker is format-independent, not a universal
Markdown parser or an automatic converter for other workflows.

## Executable contract

`check-docs.mjs` is a third portable check. Once the project has wired it, it is
mandatory at admission/acceptance boundaries independently of backlog strength;
until then the protocol's reading fallback applies. Exit 0 means no violations, 1
means violations, 2 means invalid input or invocation. Unknown fields/options,
unsupported versions and malformed records fail closed. It makes no writes.

```sh
node check-docs.mjs --selftest
node check-docs.mjs --input exported-documents.json --policy document-policy.json --evidence verified-receipts.json --json
```

`fixtures/documents.json` contains a complete example and positive/negative cases.
The exported functions `checkDocuments(model, policy, evidence)` and `digest(value)`
allow a project wrapper to call the same rules without temporary files. Digest is
SHA-256 of recursively key-sorted JSON; array order remains significant.

All fields below are required unless explicitly nullable; empty arrays/strings
are valid only where their phase/meaning permits them. Identifiers use letters,
digits, dot, underscore, colon or dash, starting with a letter/digit.

### Model (`schemaVersion: 1`)

| Field | Source and meaning |
| --- | --- |
| `phase` | `product`, `feature`, `acceptance`, `close`; chosen by the wrapper for the actual transition, never author-selected to weaken a check |
| `revision` | checked source revision or reproducible content digest; changing checked inputs changes it |
| `project.mode` | `new` or `existing`, from established project setup, not inferred from an empty export |
| `project.vision` | strings `audience`, `problem`, `outcome`, `exclusions` |
| `project.milestone` | `id`, `outcomes` (strings), `exclusions`; export from charter/config, not another owner of current values |
| `tasks` | array of `{id, kind: "leaf" or "container"}`, resolved from the real tracker |
| `baseline`, `current` | arrays of capabilities `{id, title, requirements}` |
| `change` | the change below; may be null for `product` |

Requirement: `{id, title, statement, scenarios}`. Each scenario has
`{id, given, when, then}` strings. IDs are unique within capability/requirement.
Title, statement and all scenario parts must be filled, with no known scaffold
markers. This checks structure, not the quality of prose or completeness of cases.

Change:

- `id`, `title`, `intent`, `outOfScope`, `taskIds` (existing leaves).
- `kind`: `behavior`, `no-behavior` or `supporting`; `rationale` explains either
  non-behavioural kind. `supporting` is retained research, setup or documentation
  that does not change a product contract or implementation. It requires no
  deltas, preserved refs or coverage entries; do not invent a capability merely
  to save research. It still needs a task, required policy checks and any required
  approval. New-product vision/charter readiness is not a prerequisite for this
  preparatory work. The wrapper must verify this scope from actual changes;
  it cannot be used to exempt production implementation or a current-spec edit.
- `openQuestions`: unresolved **blocking** questions only. Exploration may keep
  arbitrary open questions; it does not run an admission gate.
- `deltas`: `{capability, requirement, before, after}`. Before/after are complete
  requirement objects or null: null before adds, null after removes, otherwise
  replaces. No double-null, no no-op, no mismatched IDs or duplicate operations.
  Rename uses explicit remove/add; do not silently rename stable IDs.
- `preserves`: `{capability, requirement}` references for unchanged contracts
  exercised by a bug fix/refactor. `no-behavior` requires these, a rationale and
  no deltas. Add regression coverage without rewriting a correct requirement.
- `coverage`: `{capability, requirement, checks: [check IDs]}` for every changed
  or preserved requirement, including removed behaviour. Tests may be planned
  at admission, but must resolve to successful receipts at acceptance.

Snapshots contain **all requirements in each affected capability**, including
unchanged ones. Read the baseline from the actual target before applying the
change (the merge parent at closure), not from the proposal's own copy. Read
current from the candidate tree. Use the same capability scope in both; include
entire additions/removals. CI must enumerate every changed current-spec file,
map it to owned changes, and reject omissions. Do not manufacture an empty scope
or silently skip unreadable sources. Unrelated legacy capabilities need not be
exported. At feature/acceptance phases, current equals baseline; at close it must
equal the replayed deltas, preserving every untouched requirement in that scope.

### Two levels of evidence

Setup recommends one, and it is recorded in the integration.

- **Records** (recommended where no protected CI or tracker guard exists, as on
  most solo projects): the gate checks structure exactly as below, and evidence
  comes from the stage's acceptance record: each check's status with a reference
  to where its output is kept, and the owner's approval as their recorded words.
  The wrapper assembles that evidence deterministically; nothing hardens it
  against forgery, because without protected CI nothing could. Say so: the
  records are trusted, not verified. Building a runner, receipt signing or
  tamper defences here is effort without a guarantee.
- **Protected** (only where protected required CI can block a merge): the
  receipts come from a trusted runner or API as described below, and the
  wrapper, policy and baseline selection are protected from the author.

Both levels use the same checker, export and phases, so a project can move from
records to protected when it gains CI, without rewriting its documents.

### Policy and receipts (separate trust domains)

Policy: `{schemaVersion: 1, requireApproval, requiredChecks: [{id, kind, appliesTo?}]}`.
Kinds: `static`, `test`, `mutation`, `review`, `manual`. The configured list must
not be empty; setup establishes actual full checks, mutation/review requirements
and approved fallbacks. Kind labels are descriptive, not proof of what ran.
Non-code work uses its corresponding checks; skipped/unsupported is never passed.

`appliesTo` lists the change kinds a check is required for; without it, every
kind. Required checks follow what a change can touch: a `supporting` change,
which may not touch product code, does not owe the product's test suites; it
owes review and the checks of what it does change (for example the tooling's
own tests). Every kind must still owe at least one check (`empty-policy`).

Evidence: `{schemaVersion: 1, revision, policyDigest, approvals, checks}`.
Approval: `{changeDigest, reference}`. Check: `{id, status, reference}` where
status is `passed`, `failed`, `skipped` or `unsupported`. The wrapper retrieves
and verifies runner/approval records; references identify the actual evidence.
`policyDigest = digest(policy)`, `changeDigest = digest(change)`. Changing the
proposal invalidates its approval; changing checked inputs invalidates evidence.
Where approval is required, the same bounded approval is reused, not requested
again per field or task. An author-written `approved: true` is not an approval.

The checker verifies relations and presence, **not authenticity**. A fabricated
export, receipt or policy can still lie. Setup must protect the wrapper, policy,
baseline selection and required CI checks from author-controlled bypass. Use
trusted runner/API results rather than a JSON file the implementation agent
asserts is true. If the environment cannot enforce that separation, report the
limitation; never claim tamper-proof acceptance. A review receipt proves that a
review occurred according to the wrapper, not that the reviewer was right.

## Boundaries and recovery

1. `product` checks a new product's intent and first outcomes. Run `feature` too
   before its first implementation; a product check alone admits no code.
2. `feature` checks readiness, task links, base requirements, coverage and the
   required approval receipt. Missing tests are plans, not acceptance evidence.
3. `acceptance` checks the assembled revision's policy and coverage receipts.
4. Prepare the updated current docs, regenerate the export, and run `close` on
   the final candidate. It verifies replay plus the same evidence requirements.
   If checked inputs changed, refresh evidence; do not falsely attach an old run
   to a new revision. Then publish docs/code and archive the change through the
   authorized workflow. Only then close accepted tracker work. Interrupted
   publication remains pending and resumes idempotently, not as a second delta.

Keep the proposal/delta and acceptance evidence as history. Do not rewrite an
old completed plan to pretend it predicted the final implementation. Split
long features into independently accepted change slices so current docs advance
with accepted stages rather than waiting for the entire feature.

Local commands are feedback, not a security boundary. Protected required CI can
block merge; tracker transition enforcement needs an adapter/server guard.
Without that, the checker detects an invalid closure but cannot stop arbitrary
direct tracker writes. A skill cannot prevent somebody starting to type code.

Setup proves real entry points using recoverable failures: missing vision on a
new product, missing scenario, invalid task, stale requirement, missing/stale
receipt, unmerged delta and unrelated parallel change. Verify the clean case
after restoring each violation. The integration records the gate as installed
only after this proof; at the records level, receipt forgery is not a proof case.
