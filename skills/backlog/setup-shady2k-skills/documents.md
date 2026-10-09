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

Suggested new-project paths (defaults, not mandatory names). Everything lives in
`docs/` beside the code, so a behaviour change and its spec travel in one pull
request:

```text
docs/vision.md                      # audience, problem, key journeys, success signal, exclusions
docs/roadmap.md                     # or a section of vision
docs/glossary.md                    # domain terms and the names of the system's own parts
docs/milestones/<milestone>.md      # the first one is the MVP
docs/system/index.md                # coverage and known unknowns
docs/system/architecture.md         # arc42 sections as needed, C4 diagrams in Mermaid
docs/system/capabilities/<name>.md  # by capability, named from the glossary, not by feature
docs/changes/<change>/change.md
docs/changes/<change>/design.md     # when needed
docs/decisions/NNNN-<slug>.md       # MADR-style decision records, never renumbered
docs/explorations/                  # only when retention is requested
docs/sources/S-NNN-<slug>.md        # product documents, when the product keeps them:
docs/hypotheses/H-NNN-<slug>.md     #   forms in the protocol's product.md
docs/stories/US-NNN-<slug>.md
docs/use-cases/UC-NNN-<slug>.md
docs/requirements/FR-NNN-<slug>.md
docs/questions/Q-NNN-<slug>.md
docs/prototypes/P-NNN-<slug>.md     # its code in prototypes/<folder>/
docs/results/R-NNN-<slug>.md
```

In a product repository these places are the layout's and none is asked: the
vision is `docs/vision.md`; the roadmap, charters, glossary, architecture,
current capabilities and change records sit under `docs/` at the paths above;
the product's own documents are `docs/` by their kinds ([the product's
documents](references/product.md)); and the code repositories the product
spans are `repos/`. A capability is still the unit a spec is kept by.

Specs are kept **by capability**, not by feature: a capability spec is the
current truth, and a feature is a change record whose requirement deltas are
merged into the capabilities it touches at acceptance. Kept by feature, specs
stop saying what the system does now.

**Diagrams are Mermaid** blocks in the Markdown, the format repository hosts
render natively; never diagrams drawn with characters. Architecture views follow
the C4 levels, drawn as Mermaid flowcharts (Mermaid's own C4 syntax is still
experimental); sequence, state and entity diagrams use Mermaid's own kinds.

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

Adoption happens at a moment, and work is already in flight at that moment. The
date the gate was adopted grandfathers commits, not work: a branch whose tasks
predate adoption lands its commits after it and meets the full contract at push
time, hours in, with the owner waiting. So adoption does three things before
enforcement starts, and refuses to start it until they are done.

- **List the work in flight** — open tasks, their descendants, and branches not
  yet merged — and record it as exempt. Enforcement that begins without that
  list is enforcement against work nobody costed.
- **Let the exemption follow the task tree.** A descendant of an exempt task is
  exempt, including one created by splitting it afterwards; otherwise splitting
  a bug silently voids its exemption, which is exactly how a branch ninety
  commits in first meets the contract at its push.
- **Seed the capability catalogue**, with its directory and one capability
  document from the template, so the first behaviour change pays for its own
  record and not for inventing the catalogue as well. Where the catalogue is
  still empty, the first behaviour change may add against an absent baseline:
  that is a bounded job, not a cliff discovered after the code is written,
  reviewed and green.

Say what all this costs when it is adopted, in hours and in what the first
change after it includes. A cost that arrives at the first push is a surprise,
and a gate whose cheapest exit at push time is a bypass will be bypassed.

## Templates

Use `templates/vision.md`, `roadmap.md`, `milestone.md`, `capability.md` and
`change.md` as editorial seeds. `design.md`, `architecture.md`, `decision.md` and
`exploration.md` are conditional. A capability states its requirements as EARS
statements with Given/When/Then scenarios, and its quality requirements by
category, writing "not applicable" for a category rather than leaving it out.
That section is editorial guidance: the document gate does not read it, so a
capability without it still passes, and review is what keeps it honest. The vision's optional sections (non-users, alternatives, key
journeys, success signal) scale with the stakes: a small tool may skip them, a
product for other people should not.
The product's own documents (sources, hypotheses, user stories, use cases,
product requirements, open questions, prototypes and results) have templates in
`templates/product/`, one per kind. Unlike the others, their form is not the
project's: it is fixed by the protocol's product documents, and
`check-product.mjs` refuses a document out of it.
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

## A refusal describes green

Every verdict the checker gives carries the shape the author must reach, and its
text leads with the change's kind and what that kind owes. The project's wrapper
answers to the same standard: a refusal names the kind implied by what changed,
the sections that kind requires, whether the capability document it asks for
exists, and the command that records each missing check. A refusal that names
only what is wrong turns every first encounter into hours of reading the rules,
and those are the hours in which a bypass starts to look reasonable.

## A commit owes a record for what it delivers

Where the wrapper judges a range of commits, it asks which change covers the
work the range **delivers**, not every task a commit names. Code, documents
and a tracker transition in the range that claims a result (submitted,
implemented or closed) deliver work: without a change behind them they are
refused. Where the tracker's transitions are read from — the commits, or the
store's own history over the range — is the integration's to say, by where the
store lives; the rule is the same either way. A commit
that touches only the tracker and files a task, comments on it or edits its
fields delivers nothing, and needs no change, whatever state the task is in
and whichever milestone it is on. Draw the line by the delivered states, all of
them: exempting everything except `closed` lets a tracker-only commit mark work
implemented with nothing behind it. Prove both sides on real commits, a filed
finding passing and a delivered state refused, before enforcement starts.

A change that has closed on the target is judged once. A later commit that
names one of its tasks (the closing note, a follow-up in the same area)
delivers nothing to it and does not bring it back into the range, where it
would owe fresh receipts for work landed hours before. Later work on the same
task is a change of its own.

A range that delivers several changes judges each where it was finished: at
its own last commit in the range, against the revision just before its first
one there. Judged at the tip, an earlier change owes receipts for code a later
one wrote, and judged against the target, a later change finds the earlier
one's requirements unknown; each is clean in its place, and the push carrying
both is refused with nothing to fix. A change whose commits interleave with
another's, or begin before the range, is judged as before, at the tip against
the target. Nothing is waived: a later commit that breaks an earlier change is
part of a change of its own, which brings its own receipts at its own last
commit.

A wrapper that demands a record for filing gets empty records ("found, filed,
nothing changed") signed so the push can pass, and a signature that stands
under nothing stops meaning anything under the next record. A record like that
is a defect of the wrapper, fixed there, never a form to fill.

## Documents that describe the present stay in step with the tree

`check-present.mjs` holds the protocol's **What describes the present is kept
true** where it can be computed. The config lists which documents describe the
present (`presentDocuments`, path patterns: the agent doc, the glossary, the
architecture, the current capability specs); nothing guesses them. It reads a
change's base and head from git and compares what those documents name with
what the tree has:

- **A dead reference the change made refuses it.** A link whose target the
  head does not have (a link says its target exists), or a path in a code
  span that the document named before the change, which the change removed.
  The document is fixed in the same change: pointed at what replaced the path,
  or the statement removed. A span the change adds about a path it removed
  ("`src/legacy/` was removed") is reported, not refused.
- **What predates the change is reported, never refused**: references already
  dead at the base, paths neither side ever had (a typo, a plan, or a
  statement that a path is absent), code areas no listed document mentions
  (`presentAreas`: the folders whose subfolders are areas, the top level by
  default), and a document untouched while files were added, removed or
  renamed under what it names in `presentChurnCommits` commits (20 by
  default; 0 turns it off). The run that meets older drift files it as debt;
  it is not fixed inside unrelated work.
- **What is not a path of this tree** (an API route, a generated folder) goes
  into `presentIgnores`; what git ignores is skipped by itself.

A reference is what is written as one: a link, or a code span with a slash
that starts with a name the tree has had; a bare file name once the tree has
had a file of that name. A span is read beside its document, then from the
root, then as the end of a longer path. Prose, code blocks, HTML comments and
placeholders are examples and are not read. It judges names, not claims: that a module still does what a
document says is found by reading, and the report says which documents to read.

```sh
node check-present.mjs --selftest
node check-present.mjs --config <project-config> --base <merge-base> [--head <rev>] [--json]
```

Exit 0 means no dead reference this change made (`new errors: 0`), 1 means
some, 2 means invalid input or invocation, an empty `presentDocuments` or none
of them at the head included. It runs when a pull request is opened and in CI
on every pull request, against its merge base, whoever opened it.

## Product documents are checked as they are written

`check-product.mjs` reads the product documents straight from the repository
(the working tree, the staged files, or a revision) and needs no export and no
setting. It refuses a document out of its form, a placeholder, a reused id, an
id or prototype folder that does not exist, a link to a kind a document does
not grow from, a use case's extension naming no step, a written status, a
product requirement that names code, and a quote not at the place it cites. It
resolves every id named anywhere under `docs/`, so a capability requirement
serving a product requirement that is gone is refused too. A quote from a
source kept outside the repository is reported, not refused. A repository with
no product document passes untouched.

```sh
node check-product.mjs --selftest
node check-product.mjs [--root <repository>] [--staged | --rev <revision>] [--json]
```

Each finding is `file:line: error|note rule: what is wrong — what green looks
like`. Exit 0 means no error, 1 means errors, 2 means misuse or a tree that
could not be read. `fixtures/product/good/` is a complete example product and
`fixtures/product/cases.json` breaks it once per rule, with every finding
expected; a tool that reads these documents tests against them.

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
| `checkRevisions` | optional; `{id, revision}` for each check whose policy entry names what it does not read: the digest of what it does read, by `checkRevision` in `document-format.mjs` |
| `project.mode` | `new` or `existing`, from established project setup, not inferred from an empty export |
| `project.vision` | strings `audience`, `problem`, `outcome`, `exclusions` |
| `project.milestone` | `id`, `outcomes` (strings), `exclusions`; export from charter/config, not another owner of current values |
| `tasks` | array of `{id, kind: "leaf" or "container"}`, resolved from the real tracker |
| `baseline`, `current` | arrays of capabilities `{id, title, requirements}` |
| `change` | the change below; may be null for `product` |

**What the revision binds.** It is a receipt's pin, so it is fixed by a rule,
never by judging what a change touches: a wrong judgement there weakens every
receipt silently. It covers the tree **except what this gate reads and verifies
itself on every run**: the tracker's state, the change records, the current
specs and their capability catalogue. Where the tracker's export sits in the
tree, that is a path left out; where the store lives outside the branches, the
integration says how the tracker at a revision is read (for example, the newest
snapshot published no later than it), and nothing in the tree stands for it. Those are checked by structure and
replay each time, so no receipt needs to cover them, and leaving them inside
means the closing commit that updates the catalogue, or a task filed during the
run, stales evidence that nothing about it touched. The wrapper names the
excluded paths in the integration and nothing else is left out.

**A receipt stands for what its check reads.** One revision for every check
makes a typo in a README stale a test suite no test of which reads it, and a
seventeen-minute suite then runs again on unchanged code; a discipline whose
honest path costs that on every edit breeds the bypass it exists to stop. So a
check's policy entry may say what it does **not** read (`ignores`: path
patterns, `docs/` or `*.md`), and its receipt is pinned to the digest of the
rest (`checkRevision(lsTree, {exclude, ignores})`, over `git ls-tree -r
--full-tree` at the revision, with the revision's own exclusions). The list
names what is left out, never what is read, and starts empty: an entry
forgotten costs one run, an entry wrong leaves a receipt standing on inputs
that changed, so an entry goes in only where the check's own command shows it
cannot read that path (a Go test suite and the Markdown beside it). It is part
of the policy, so changing it stales every receipt, and no run narrows it to
save itself a check. A check with no list reads the whole revision, as
before.

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

Policy: `{schemaVersion: 1, requireApproval, requiredChecks: [{id, kind, appliesTo?, ignores?}]}`.
Kinds: `static`, `test`, `mutation`, `review`, `manual`. The configured list must
not be empty; setup establishes actual full checks, mutation/review requirements
and approved fallbacks. Kind labels are descriptive, not proof of what ran.
Non-code work uses its corresponding checks; skipped/unsupported is never passed.

`appliesTo` lists the change kinds a check is required for; without it, every
kind. Required checks follow what a change can touch: a `supporting` change,
which may not touch product code, does not owe the product's test suites; it
owes review and the checks of what it does change (for example the tooling's
own tests). Every kind must still owe at least one check (`empty-policy`).

Evidence: `{schemaVersion: 1, revision?, policyDigest, approvals, checks}`.
Approval: `{changeDigest, reference}`. Check: `{id, status, reference,
revision?}` where status is `passed`, `failed`, `skipped` or `unsupported`, and
`revision` is the one its check read when it ran; a check without its own
falls back to the evidence's. A receipt is stale where that differs from the
check's pin in the export (`checkRevisions`, else `revision`), and only that
receipt: the others stand. A policy entry with `ignores` and no pin in the
export is `unpinned-check`. The wrapper retrieves
and verifies runner/approval records; references identify the actual evidence.
An approval's reference records the summary the owner was shown, since that is
what they approved, not the document text they were not asked to read.
`policyDigest = digest(policy)`; `changeDigest` is the digest of what the change
**decides** — `{kind, intent, outOfScope, deltas, preserves}` — and not of the
whole record, so the approval can be given in the preflight, before the record
is written, and survives the agent's own working on it afterwards: the
rationale, the coverage, the task ids, a rewrite after review. Changing what
the change decides invalidates its approval; changing checked inputs
invalidates evidence.
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
direct tracker writes. A skill cannot prevent somebody starting to type code. What
the check can and cannot stop says nothing about whether its verdict binds: a
refusal is owed work whoever could technically walk past it, and a check nobody
else enforces is one to hold to harder, not more lightly. Write both sentences
into the project's copy; the first one alone has been read as permission.

Setup proves real entry points using recoverable failures: missing vision on a
new product, missing scenario, invalid task, stale requirement, missing/stale
receipt, unmerged delta and unrelated parallel change. Verify the clean case
after restoring each violation. The integration records the gate as installed
only after this proof; at the records level, receipt forgery is not a proof case.
