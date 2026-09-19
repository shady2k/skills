# shady2k-skills: light process skills, and the gate that makes them binding

**2026-09-17. Design conversation with the owner, recorded after the fact.** It
took place in nocx, the owner's terminal project, whose backlog is the evidence
throughout; "the origin" below means that repository.
Status: version 0.16.0 asks for setup only when the installation must change;
0.15 replaced reading assignments with summaries; 0.14
assigned tasks to the agents doing them; 0.13 added a
light evidence level to the document gate; 0.12
separated chat and artifact languages; 0.11 added
anonymized reports to the author; 0.10 made the
document gate a non-blocking stage; 0.9 made
the router a read-only orientation; 0.8.0 added
exploratory dialogue, living documents and a document gate to the revised
execution/setup workflow. Live
project validation of the new end-to-end workflow remains outstanding. §1 and
§2 preserve the original conversation; §§3–11 describe the current design;
§12 records the history through 0.6, §14 the 0.7 decisions, and §15 the 0.8 design.

## 1. The owner's idea, as stated

A set of skills for our terminal that is usable **in any harness, not only
ours**. Matt Pocock's skills are the reference for weight: superpowers and
spec-kit are too heavy, and a light set is wanted.

The problem with light skills as they exist: **they oblige nothing.** They can
be invoked at any moment or never, and when nobody invokes them no process is
followed. The evidence is in the origin's own tracker, where tasks are
scattered, half are stale, and so many epics were created in advance that they
could never all be built — many having lost their point precisely because they
were created ahead of time.

Two situations, and they need different treatment:

- **A new project**, started from nothing.
- **Digging out an existing mess.**

What the set has to carry:

- **Specifications, but not only specifications.** A spec alone is too narrow;
  business requirements and the vision belong with it.
- **Ideas.** They should reach the tracker without disturbing the main line of
  work: an idea may lose its point, and then it is closed and forgotten.
- **A flow with an order** — what stage follows what — because work jumps
  around. What has lost its point is closed or re-attached, which needs a real
  dependency graph rather than a pile.
- **Short epics.** Ours do not close in one session and sometimes run for days.
  They should be split by phase or some other criterion.
- **Milestones**, which the tracker does not have; labels were suggested for
  them.
- **Any tracker.** Working with the tracker is a separate skill we do not look
  inside.
- **Assignment to agents**, not just to a human author, because orchestration
  is nearly ready: agents will take free tasks and run them autonomously.
- **A flow for that autonomy**: the specification is written first, with the
  user; after that tasks are taken and done without them, and a problem is
  escalated to the coordinator, who takes it to the user.
- **A horizon.** Writing every spec up front is impossible — half would go
  stale. Decompose a short stretch in detail, keep a vision beyond it, and know
  what the next version contains.
- **Protection from the mistake that keeps happening**: bugs and architectural
  gaps found mid-flight are inserted at the front and push the feature out by a
  week or two. The user should be made to think about this in advance and be
  stopped from doing it.
- **Watching the tracker**, eventually from harness hooks, so the user and the
  model are reminded to keep issues current.
- **Names, never identifiers.** A person does not think in identifiers and
  cannot remember them; the model keeps assuming they can.
- **A wiki**: the system's current state, the stages it went through by
  feature, so one can look back. And **ADRs**, so the reason behind a decision
  survives.

Open at the time: whether we need our own tracker, a central one, or one built
into the product.

## 2. Diagnosis: skills are not the problem

Measured in the origin the same day: **933 issues open, 773 of them
reported ready to work**, across 665 independent roots. 82 of the 83 in progress
had not been touched in over two days. 399 open items had not been touched in
thirty. No milestone label existed; `mvp` and `phase-1/2/3` were the de-facto
roadmap.

773 of 933 "ready" is not a queue, it is a dump with an index. A status that is
false 99% of the time is not a status. Both say the same thing: **there is no
invariant that cannot be broken, and no moment at which anything is checked.** A
skill cannot fix that, because a skill is advice rather than a gate.

So the conclusion is not "heavier skills". It is: build the gate, and let the
skills stay light.

## 3. Levels, readiness and parallelism

The portable protocol is sourced beside the installer and copied into every
consuming skill folder; tests reject drift.

| Level | Role |
| --- | --- |
| Vision | Direction, people served and deliberate exclusions; a document |
| Milestone | Current slice, outcomes and finding budget |
| Feature | One observable outcome, possibly several independent stages |
| Stage | An independently acceptable result sized for one session including acceptance |
| Task / bug | A leaf within the stage, with observable criteria |

Only the current milestone is decomposed below features. Future work stays
coarse or deferred. This horizon does not serialize current work: independent
features, stages and tasks can run concurrently. A required result, conflicting
write or exclusive resource justifies an edge; list order and hierarchy do not.
Dependencies name the consuming and producing leaves, not entire containers.

An open unheld leaf is ready when its prerequisites are available in the
consumer's stage and checkout. A worker's returned result is **submitted**, with
a durable revision/location and local evidence. The coordinator integrates it,
checks affected behaviour and records **implemented**. Implemented prerequisites
may release consumers within that same stage, but cross-stage consumers wait
for acceptance and closure. Neither submitted nor implemented means ready to
implement again. Stopping preserves these states and their next action.

## 4. Ownership and executable guarantees

The set owns the protocol and three portable checks. The project owns the
tracker adapter, message parser, configuration, commands and local/CI wiring.
Tracker usage is documented once in the project's tracker doc, with the
integration section adding only what this protocol needs.

The backlog gate checks the horizon, ideas, finding budget, areas/vocabulary,
holds, criterion markers, parent and live-dependency cycles, edges involving
containers, and evidence presence for submitted/implemented work. Stale or
missing blockers produce warnings for review; age alone does not prove a
dependency invalid. The commit checker rejects missing links and references
to absent issues or containers, independently of backlog strength.

Backlog strength remains an explicit choice: block, block-new or report.
Invalid inputs fail in every mode. Block-new uses historical backlog and
historical config, with the appropriate CI baseline. It does not compare a
branch with itself. Every rule has fixtures; new checks must be deliberately
broken to prove that their fixtures fail.

The document gate checks product intent fields, feature task links and readiness,
requirement/scenario structure, pinned deltas, coverage links, revision/policy-bound
receipts and replayed current requirements at closure. Its normalized inputs come
from a deterministic project export, not a model-written assertion. Reference
Markdown readers ship for the default vision, charter and capability templates.

The gates cannot prove that a message parser is honest, evidence is truthful,
a requirement is good, or a referenced task really describes the commit.
Setup proves the project adapters; acceptance verifies behaviour. Meaningful
titles, session sizing and decomposition depth are instructions, not executable
guarantees. No claim of evidence-kind validation beyond implemented checks.

## 5. Setup starts with the tracker and always reconciles

An existing tracker is inspected and verified. If absent, the owner chooses a
suitable tracker, then setup installs and initializes it. The setup task exists
before repository modifications. Cleanup snapshots native state before any
bulk change; grooming receives a verified bootstrap context so it can operate
before the gate/adapter exists, without recursively demanding setup.

Cleanup retains the agreed current slice and independent active work, preserves
submitted/implemented results, resolves invalid dependencies and defers unrelated
work. It does not delete a backlog. A field-level before/after journal supports
rollback without overwriting later work. Paired snapshots correct only timestamps
still matching the bulk operation; later real work keeps its own age.

Then setup configures the adapter, workflow, checks, hooks and integration.
Every invocation runs the entire proof, even with a matching version: prior
answers survive, but prior assumptions are rechecked. This includes tracker
readiness semantics, atomic claims or serialized assignment, local/CI entry
points, message parsing, test commands and review/mutation capabilities.

When an update changes what setup installs, the skills request setup again
(see 0.16 below). Config holds the last fully proved and landed setup version;
tracker-writing skills compare that and installed script versions with their
protocol's setup version before mutations.
A first-use guard is not a universal automatic update hook. Explicit setup
never short-circuits on the stamp. Pending/failed attempts are recorded separately
from the last successful version, so a failed rerun cannot look verified.

## 6. Design scales with uncertainty; TDD is independent

Small, understood work records a short behavioural delta and acceptance
scenarios. A bug normally retains its source requirement and adds regression
coverage; only a gap or approved behaviour change updates the spec itself.
Substantial risk or unknowns call for brainstorming, research or a bounded
prototype before a full spec and stages. A small irreversible change may need
more design than a large routine one.

Setup asks for TDD or test-after. Both require tests. TDD runs a relevant
failing check, minimal implementation and local refactoring under green tests.
Test-after writes/updates checks after implementation. Acceptance boundaries
do not prohibit useful local behavioural tests at other stable interfaces.

The product engineer is the usual human role: product, analysis and architecture
in one person, without needing code details. Questions concern consequences.
Reversible technical choices belong to the agent; escalate changed requirements,
material cost/risk, irreversible choices and missing authority. Existing approval
is not reopened by each helper.

## 7. Local feedback, integration and final acceptance

One coordinator owns a stage; independent stages can have independent
coordinators. Workers receive bounded tasks, criteria, base revisions, ownership
and local commands. Use isolated checkouts for concurrent interfering writes
and explicit coordination of shared generated files or resources. Claim must
be atomic or assignments serialized; readback of last-write-wins is not a lock.

Workers run static and related tests, including affected neighbouring behaviour.
They submit results, not accepted tasks. The coordinator integrates incrementally,
so real same-stage dependants need not wait for the entire batch. Submitted
results survive a handoff before integration, and implemented results survive
a handoff before acceptance.

At the stage boundary: full required tests, mutation testing of changed logic
within its configured budget, then final review, preferably another model.
Meaningful surviving mutations require investigation; unsupported tools and
timeouts are not passes. Setup defines the fallback. Review covers both behaviour
and maintainability against original requirements and assembled changes, with
one disposition of findings.

Corrections invalidate affected evidence. A code change after the full run
requires full checks on the final revision before acceptance; repeat mutation
checks/review when their evidence changed. Then close included tasks and the stage.
A feature still has its own criterion, and unrelated features need not wait.

## 8. Documents, task links and names

Vision changes slowly; the charter records scope decisions; specifications record
behaviour; the glossary and occasional ADRs preserve concepts and rationale.
Current milestone, budget, vocabulary, execution settings and setup version live
only in config. An acceptance record identifies the actual base/final revision,
tasks, commands, results and unresolved limitations.

Every retained change and every commit belongs to tracked work, including setup,
research, prototypes and documentation. Read-only discussion can happen without
setup. Commit-msg and CI verify references; generated merge/revert messages must
retain links by the chosen convention.

A person sees "Title" (id), never identifiers alone. Current status is queried
from the tracker rather than copied into a hand-maintained roadmap.

## 9. Composition and routing

Setup, ask-shady2k, to-milestone, take-task and handoff remain user-invoked.
Planning/research/prototype helpers and grooming are model-invoked so an
authorized execution or setup request can compose them. Invocation does not
authorize unrelated work, a new service commitment or publication.

The router verifies compatibility, checks actual tracker state and recommends
the next useful action. Pending integration/acceptance is resumed, not
reimplemented. An actively owned stage does not prevent routing independent
ready work. Missing helpers are reported as installation dependencies.

Since 0.9 the router is also where the owner gets oriented, and it is strictly
read-only. One next action was enough for someone in the flow and too little
for someone returning after a break or opening an unfamiliar project. By the
depth of the request it gives the product, progress, the current state,
health and risk, and what lies beyond the horizon, then the ways forward with
what each achieves, costs, postpones and risks. The recommendation still comes
from the ladder, whose order protects finishing before starting; alternatives
outside the milestone are labelled as scope changes and ideas as hypotheses.
Without setup it still reads the repository and says what it cannot know,
instead of answering only "run setup".

In 0.10 the document gate stops blocking. Required for a verified setup in 0.8,
its wiring took several sessions, and until it was done the skills that change
tasks refused to run: an update stopped work for days. Now setup completes on
the backlog and commit checks; the document gate is its own stage in the
current milestone, recorded as not installed in the integration. Meanwhile a
skill that would run it checks the same readiness by reading and records that
the automatic check did not run. Migration rules for older installations were
dropped at the same time: the set has no installations to migrate.
For the same reason grooming no longer demands a backlog with no errors at all:
it is done when the gate is clean and the current slice has no errors, and older
debt outside the slice stays listed with a plan.

0.11 adds `report-to-shady2k`, because the fixes of this round all came from
reading real sessions where a skill went wrong. A user can now send that
evidence as a GitHub issue. The report describes the situation's shape, not the
project: no names, paths, issue numbers, hashes, code or quotes. A shipped scan
looks for the names the checkout and machine reveal and the project's own words
from its gate config; it knows shapes, not meaning, so the real safeguard is
that the user reads the exact text and says yes before anything is published.
It is user-invoked only: nothing is ever published on an agent's initiative.

0.12 separates two languages that had been one. The conversation follows the
user: whatever language they write in, the agent answers in it. What is kept in
the project follows the project: documents, tasks, commit messages and code
comments use its artifact language, recorded as `artifactLanguage`. Setup asks
for it explicitly, recommending English, because inferring it from the person's
chat language would write a team's shared files in one member's language.

0.13 comes from the first live update of a real project. Setup spent an hour
and a half building the document gate as tamper-proof: a runner, receipts and
three rounds of adversarial review closing forgery holes, in a project with no
server CI, where the agent itself called the result an audit. It also ran the
end-to-end suite "for completeness" and required the product's tests for a
change to process documents. So the gate now has two evidence levels: records,
the default without protected CI, check structure and trust the acceptance
record; protected keeps verified receipts for projects whose CI can enforce
them. Required checks can be scoped to change kinds (`appliesTo`), a setup
proves commands the cheapest way and reruns a full suite only when it was never
proved or changed, and it never deletes branches it did not create.

0.14 fixes two things the owner saw in use. Every task was assigned to him,
because the tracker fills in the local user; but he does not do the tasks, the
agents do. The holder is now whoever does the work, the agent under its own
name, and the person only for decisions, manual checks and approvals. And a
step ended without saying what next, so every skill that finishes a step now
names the next action, and recommends a fresh session in time: `/handoff` at a
natural boundary, the harness's compaction in the middle of the same work.

0.15 stops treating the owner as a reader. The skills assumed a product
engineer would read specs, charters and change records; there are many, they
are long, and reading them is not the owner's job. Documents stay the agents'
memory and the record. The owner gets a summary: substance, decisions, the
agent's own assumptions and guesses with what happens if they are wrong, risks,
the strongest case against, and what review found, in plain words without
code. An approval records the summary that was shown, a reviewer checks that
summary against the document, and a document too large to summarize fully is
split rather than approved blind.

0.16 separates two versions. One version had gated everything, and it rose
with every change to a skill's wording; after a day of about ten releases every
project stopped for setup again and again, though most releases changed nothing
installed. Now the plugin version rises with every change, and the setup
version, which the skills compare with the project, only when an installation
must be redone. A test records the files setup installs and fails when they
change under the same setup version, so the cheaper path cannot silently leave
projects on old checks.

## 10. Findings and cleanup

Registration and admission are separate. Preserve an over-budget discovery as
deferred while the owner decides whether to admit it. Replacing planned work
with another finding does not reduce the count of findings: the replacement
must explicitly update the config budget and record the charter decision.

A correction necessary to meet an existing criterion remains that work, not
automatically a budgeted finding. Genuine additional work follows the lane and
horizon rules. This prevents acceptance fixes from becoming a device for expanding
the milestone silently.

## 11. Proof and limits

Package tests check fixtures, input handling, portability, versions, invocation
metadata and identical protocol copies. Mutation tests deliberately disable new
rules and require the intended fixtures to fail. Independent forward simulation
checks how instructions handle small bugs, parallel dependencies, repeated setup
and a stop before acceptance.

These are not a live rollout. The adapter remains project-specific, and the new
complete setup/execution flow must still be tried in real projects. Harness
session/update hooks and a historical wiki renderer are not implemented.

## 12. What was built first, what was wrong with it, and what it became

The first draft was a skill called `gate`, inside the origin's own tree: rules
1–10 as ten checks over a normalized model, with an adapter, fixtures and a
self-test. It measured something: against the pre-grooming export, 321
violations across six checks; against the groomed tree, 27 across three.

Two things were wrong, and a third was claimed at the time and is not:

1. **`gate` was a name outside the set.** The gate is what the installer
   installs, not a skill of its own.
2. **The project lived inside the skill**: a config of the origin's labels and
   an adapter for the origin's tracker, both exempted from the guard meant to
   keep the project out. And the skill itself lived inside the project, which
   is the same mistake from the other side.
3. _Not wrong:_ that the rules are a fixed implementation. §4's own table says
   the rules ship identical everywhere; what is generated per project is the
   adapter and the wiring.

It is now [`setup-shady2k-skills`](../skills/backlog/setup-shady2k-skills/SKILL.md)
in this repository: the rules, the model and the fixtures unchanged in
substance, `SKILL.md` rewritten as the install process (explore, ask, write,
prove), the three strengths implemented in `check.mjs` and proved in its
self-test, and the guard widened so that neither a project's nor a tracker's
name may appear in any file of the skill. `npm test` runs that guard against
the origin's words, which are the ones most likely to leak.

What happened after that, in order. A reader who had not written the skills
walked a new project and a 900-issue mess through them and found the router
sending the mess to the wrong skill, `to-milestone` deferring the slice that
grooming had just declared, and a gate that let a parentless issue through. A
second reader, a different model, was asked to construct backlogs that prove a
check wrong: three rules the design called enforced were only warnings,
`block-new` judged the past by today's config, a typo in `--only` ran no check
and exited green. Then the first real install, in the origin, by a session that
had not written the installer: it left files staged in a shared checkout and
another session's commit carried the half-proved gate onto the main branch.
Then the second install, in another project, which followed the cure for that
(a branch in a worktree of its own) to the letter, reported "installed" with
nothing committed, and stopped: the next session, in the main checkout, found
no backlog doc and sent the owner to install again. The installer had no step
for landing what it wrote, so it got one, and "installed" now means the doc is
on the branch people work from. The same install wrote a reading verb it had
not run, with a flag that belongs to another subcommand.
Each of the four changed the text or the code, and the commits say how.

That install also put the question the owner then asked: why does the set hang
on a file at all? Every skill had opened by naming `docs/agents/backlog.md`, so
the session's first act was to list a directory, and a missing file was read as
"not installed" while the gate's hooks were already running in that very clone.
And the file held the protocol, which is the set's and not the project's: a
copy in every project that no update of the set would ever reach. A second
opinion from another model agreed on the direction and corrected the means: a
protocol spread by hand through six skills drifts, and a path out of a skill's
folder breaks where skills are installed one folder at a time. So since 0.5 the
protocol ships as an identical copy inside each skill that uses it, held by a
test; the project keeps only a "backlog integration" section in its own
tracker doc, reached through a pointer in its agent doc; changing values stay
in the gate's config alone; and "is it installed" is asked of the gate.

The same day the owner said the set felt as if it had lost its point, and
asked what had been lost from the reference. The answer was in §1. Every skill
built so far kept the **queue**; none helped think up the work or do it. The
`spec` of the first draft had vanished on the way to `to-stages`, which is the
reference's ticket-cutting and not its spec; the glossary and the decision
records were never built; and the autonomy flow had no skill to take a task at
all, the router ended on "take the first ready leaf" and said nothing about
how. The reference's set is exactly that missing half. The owner's decision:
take its ideas **into** this set, rewritten rather than installed beside it,
because this set will keep moving and needs something to move from. So 0.6
adds the work layer: `brainstorming`, `to-spec`, `take-task` (the reference's
implement, test-first and review folded into one road from claim to close),
`diagnose-bug`, `to-prototype`, `to-research`, `model-domain`. What makes them
this set's and not copies is where they stand: a spec is written only inside
the horizon and ends in the feature's DONE WHEN; a task's red-before-green
check **is** its assertion-shaped criterion, which is why it works for a drill
as well as for a test; what a task finds goes to a lane and spends a budget; a
task closes through `close-out`, on evidence; and an undecided question is an
escalation, released and taken to the owner, which is the first piece of the
autonomy flow to exist. The interview is the one that moved furthest from the
reference, on the owner's first reading of it. There it is a grilling: the
whole frontier of open questions in one round, each with one recommended
answer. The owner's objection was that a person is rarely inside the code and
is not there to be questioned about it: they are there as a product owner, an
analyst or an architect, or, most often, as a **product engineer**: one person
who answers for all three and builds through agents without reading the code,
which is the role to assume when nothing says otherwise. So `brainstorming` asks **one question at a time**, at
the height of the role it belongs to, translated from the technical fork into
its consequence, with two to four positions and what each sets in motion;
whatever has no consequence at that height is the agent's to decide, and the
summary lists those decisions so any can be overruled. Not taken: the reference's triage (ours is
`to-backlog`), its map of decision tickets for a foggy effort, and the rest.

## 13. Still open

- Validate the complete 0.8 workflow on real projects and tracker capabilities,
  including a project with no tracker and an older installed integration.
- Port all three checks on a project without Node and run their fixture corpus.
- Harness-specific session/update hooks; the current update instruction and
  compatibility guard do not claim to implement them.
- The historical wiki renderer and how expired deferred review dates should
  surface without automatically rebuilding an oversized queue.

## 14. The 0.7 revision

The owner rejected work outside the tracker and made TDD a project choice.
They clarified that workers run related tests, while the full suite, mutation
testing and review belong at the end of a stage. Independent tasks, features
and stages must remain parallelizable. This required distinguishing submission,
integration and acceptance, instead of closing each worker's task immediately.

The audit found contradictory autonomous-decision rules, excessive spec/test
restrictions, an untested commit-link requirement, dependency cycles that passed
the gate, and a finding-budget remedy that did not change the count. The revised
skills and checks address those issues together rather than adding more skills.

The owner additionally required setup to start with tracker selection/installation
or cleanup, and to recheck everything whenever invoked, even if already installed.
After updating the set, setup is requested again; valid answers survive while
every integration assumption is proved anew. The setup version is stamped only
after proof and landing, with matching protocol and installed checks.

## 15. Living specifications and exploratory dialogue (0.8)

The owner's next concern was not another mandatory planning ceremony: it was
keeping a reliable description of the accepted system, starting an empty product
without a document factory, and adopting existing workflows without a forced
migration. The reference ideas were current specs versus deltas from OpenSpec,
scenarios/traceability from Spec Kit, and proportional design/evidence from
Superpowers. Their processes are not installed as competing workflow owners.

Vision remains direction; roadmap expresses near outcomes and distant hypotheses,
not a duplicate status database. A charter admits a bounded milestone. Capability
specifications describe accepted mainline behaviour; change records pin old
requirements and propose complete replacements/additions/removals. A feature is
temporary work, a capability is a lasting part of the system. Significant design
and decision records explain why; optional exploration notes carry hypotheses.
New projects create only needed documents, with no fictional current features.
Existing projects adopt usable paths in place and baseline the affected area from
evidence, not from old plans. Unknown legacy coverage remains explicitly unknown.

The new document check has four phases: product, feature, acceptance and close.
It checks typed records and explicit references, not prose length as a substitute
for a good requirement. Closing replays deltas against the actual target baseline
and compares every requirement in the affected capabilities, including untouched
ones. Concurrent work on other requirements remains independent; a stale changed
requirement blocks its own change. Stage-sized changes can advance current docs
before the rest of a large feature finishes. Bug fixes preserve correct contracts
and link regression checks; no-behaviour work needs rationale and preserved refs.

Policy and receipts are separate inputs. Revision/policy/proposal digest binding
detects stale claims, not fraudulent ones: the project wrapper must verify actual
runner/approval records, full source enumeration and protected policy selection.
Required protected CI is a merge boundary; direct tracker closure needs a real
transition guard. No hook, Markdown heading or agent-written passed flag is a
security boundary. Schema validation, executable tests, mutation checks and
semantic review have different jobs. The shipped normalized fixtures, CLI tests,
Markdown reader tests and deliberate rule mutations do not claim a live rollout.

The dialogue change is equally important. Brainstorming now supports exploration,
investigation and decision without making the user select a mode. The agent
contributes ideas and different perspectives instead of only asking questions.
It understands the user's reasoning before giving an independent judgment;
agreement is not politeness, disagreement is not a performance. Facts, assumptions
and preferences are distinct. Obvious factual errors may be corrected directly.
Role changes language/depth, not the allowed range of viewpoints. Exploration
may stop without a conclusion or artifact; research may stay a cited chat answer,
and a scratch prototype does not automatically become production work. Gates
protect commitments, publication and acceptance, not the freedom to think.
