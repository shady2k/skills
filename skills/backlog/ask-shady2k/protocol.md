# The backlog protocol

Setup version: 0.26.0

These rules are the same in every project and ship with every skill that uses
them, so they update with the set. If a project's own document restates them,
this file wins. What differs per project (tracker, labels, gate command,
documents) is the project's **backlog integration**; its agent doc points to it.

The rest of the protocol lives in [`references/`](references/), one topic per
file, read when a step needs it:

- [speaking.md](references/speaking.md): how anything the person reads is
  written — names, plain words, summaries, asks, whose decision it was, the
  language, and how a step ends;
- [deciding.md](references/deciding.md): how a question reaches the person —
  worked material, design decisions, evidence, given decisions, corrections;
- [running.md](references/running.md): a feature run without the owner —
  preflight, the owner's time, sessions and landing, waits, estimates;
- [checks.md](references/checks.md): red checks, refusing gates, diagnostics,
  the cheapest check, reaching the outcome, CI;
- [building.md](references/building.md): how the product's code is shaped —
  one surface per capability, replaceable boundaries, screens from components
  and tokens, tests that survive a refactoring;
- [starting.md](references/starting.md): a project from an empty folder, with
  not even an idea, to its first planned feature;
- [tz-gost.md](references/tz-gost.md): drafting a ТЗ or a ПМИ by Russian
  standards from the living documents, when a customer requires one.

**Compatibility before writes.** Before changing the tracker or the repository,
compare this setup version with the repository's installation: the `--version`
of its three installed checks, which must agree with each other.

- **Equal:** go on, once this clone is connected (its hooks active, its runtime
  present). If it is not, ask the user to run `/setup-shady2k-skills`, which in
  an installed repository only connects the clone.
- **This one newer:** the repository's installation is out of date. Ask the
  user to run setup, which updates it for everyone through the project's normal
  review and merge; where others work in the repository, say it is a team change.
- **This one older:** someone already updated the installation. Ask the person
  to update their plugin; never run setup, which would roll it back for all.
- **No installed checks, or they disagree:** not installed or broken; setup.

Reading and investigating may continue meanwhile. Setup itself, and the
bootstrap context it hands over, are exempt while installing. Not landed means
not installed: an attempt that has not reached the main line leaves the
repository at its previous installation, whatever its branch holds. Nothing
about one person's machine or plugin is committed.
The setup version changes only when a project's installation must be redone:
new rules in the checks, a new config setting, a new adapter duty or proof. An
update that changes only how skills talk, reason or plan needs no setup; never
ask for one merely because the plugin was updated.

**Levels.** Each has one size and one author.

| level     | what it is                                                        | size              |
| --------- | ----------------------------------------------------------------- | ----------------- |
| Vision    | where the product is going; a document, never an issue           | rarely rewritten  |
| Milestone | the next slice, with a charter: what is in, what is out, a finding budget | what ships next   |
| Feature   | a root issue holding one **outcome**                              | one run, one branch, one PR |
| Stage     | an issue under a feature, with its own DONE WHEN                  | a checkpoint accepted inside the run |
| Task, bug | a leaf: an issue with no children, inside one stage               | one worker's session |

An **outcome** is what becomes possible or true, and who observes it: "a person
creates a connection group", "a rollback takes one command and one minute". Its
DONE WHEN names the observable behaviour and the check that watches it; a
regression can make it false again. A feature merges into the main line on its
own and soon: when its run would keep a branch open longer than the project
allows, it is split into features that each merge separately and leave the main
line working (a parallel change: expand, migrate, contract; behind a switch
where the project allows one). A task that will not fit one worker's session is
split before it starts. A stage has no session limit: it groups
tasks toward a checkpoint that is accepted by checks and review before the
next stage builds on it.

**The horizon.** Only the current milestone is broken down below features. The
next milestone exists as feature titles; anything further lives in the vision.
**Everything live belongs to the current milestone**, whose label its root
wears; everything else is deferred. The current milestone is read from the
gate's config each time.

**What would replace the ground is read before anything is built on it.** Before
a feature or a stage is planned, and again before its stage is accepted, read
the open work of this milestone and the next that would retire or replace what
it stands on: the component it extends, the representation it adds to, the
decision record it rests on. Where such work exists, the two are an edge with
its reason, and one of them is reshaped before either is built. The case this
catches is two pieces of open work each adding its own representation of the
same thing, and it is found by reading a sibling issue, never by building. A
stage whose result is replaced by work already in the queue is paid for twice:
once to build it, once to take it out.

**Ready** means an open leaf that nobody holds and whose required results are
available. A closed prerequisite counts. An `implemented` prerequisite counts
only inside the same stage, once its revision is merged into the consumer's
checkout and its related checks pass; across stages it must be accepted and
closed. So the adapter's ready operation takes the stage and checkout revision,
not just "are the blockers closed".

**Ready is not worth doing.** Ready says that nothing blocks a leaf. It does not
say its result is still wanted. Before work starts, check that what it produces
survives the decisions taken since it was filed. "Nothing depends on it" and "it
is independent of that question" are answers about order, never about worth; a
run that offers either as its reason to start has answered a question nobody
asked.

**Execution and acceptance.** A worker claims a leaf (takes a hold on it),
checks its change and records it as `submitted`, with where the result lives
and its local evidence. Submitted work is neither taken again nor used by
dependants yet. The stage's single coordinator merges it and marks it
`implemented`, with the merge revision and check evidence; it is not taken again
and not yet closed.
**The holder is whoever does the work.** A task an agent works on is held by
that agent, never by the person by default, even when the tracker would fill
in the person's name. The person holds only work they do themselves: a
decision, a manual check, an approval. An agent's name says who can find it:
its harness and role, the person it works for, the machine, the branch and its
session, as `<harness>-<role>:<person>@<machine>:<branch>#<session>`, for
example `claude-worker-2:alex@laptop:fix/login#528e03ed`. The claim's comment
adds when it started and the checkout's path. A role alone ("coordinator")
names nobody: several run at once on different machines and branches. Where
the tracker assigns only people's accounts, the person's account holds the task
and the claim's comment carries the agent's full name. This file wins over an
older integration doc that describes holders differently.
Workers have distinct owners and an atomic claim or a serialized assignment:
reading back a field that anyone can overwrite is not a lock. If a merge
changes or fails, reopen the affected work and recheck what depends on it. The
assembled stage gets full tests, mutation checks of changed logic and a final
review. Its tasks and the stage close only after acceptance on that revision; a
parent has its own criterion too.

**Parallelism.** Independent leaves, stages and features may run at once;
serialize only for a real prerequisite, a conflicting write or an exclusive
resource, and never for hierarchy, list order or a shared milestone. Each stage
has its own merge and acceptance and does not wait for unrelated features.
Inside a stage, merge results as they arrive so dependants can start. Use
separate checkouts where changes can collide; generated files and dependency
locks count as collisions.

**Two lanes outside the flow.**

- **Ideas**: deferred, no parent, no dependencies, a review date. Never ready,
  closed without regret.
- **Findings**: bugs and debt found during a milestone. Each wears the finding
  label **and the label of the milestone it was filed in**, so a feature
  carried forward does not bring old findings into the new budget. The charter
  sets that budget. A finding over budget goes to the next milestone, or
  displaces something only by the owner's explicit decision; it never jumps to
  the front silently.

**A repair the merge waits on is not intake.** The budget counts what the
milestone chose to absorb, and a defect a required check catches on the way to
a merge was chosen by nobody: the branch cannot land while it is red, no
version of the milestone skips it, and the time is spent whatever the item is
called. It is filed under the work whose merge it blocked and closed by the
change that lands with it, with no finding label and against no budget, and
the report names it as a repair that merge waited on. The finding is what the
run leaves behind: the wider fault the red check exposed, the part deliberately
not fixed, the fix that needs a decision the owner keeps. The test is the check
itself, red on this branch and green after this change, not how large the
repair felt. Counting a repair the rules ordered anyway buys nothing, and makes
doing it dearer than hiding it.

**A finding that does not fit is decided, not parked.** The budget is spent, or
the milestone it would join is already closed and the next one does not exist
yet: then there is no lane the run may pick on its own. Deferring it with a
review date is one of the answers to that question, not the way around asking
it, and the owner gives it. Put the answers that exist with what each costs:
displace named planned work and approve the new count, open the next slice now,
or hold it knowingly until one opens. What the finding costs while it waits
comes before any counting; where people or their data are living with the fault
now, that is the first sentence, and a counter that measures only intake never
decides urgency. A run that parks such a finding and reports the parking
afterwards has taken the owner's decision.

**A decision that retires something also decides what is filed against it.**
When a decision replaces a component, a representation or a form, every open
leaf and finding against the old one is settled in the same session instead of
staying in the queue: closed as moot, naming the decision that retired it, or
rewritten against the requirement that survives, which is different work at a
different cost. Filing a finding is not a promise to fix it; what filing buys is
that the fault is known and counted. A fix that lands in code already scheduled
for replacement is paid for twice and reviewed twice, and the behaviour it
repairs has to be repaired again in the replacement.

**Labels.** Every live issue, features and stages included, wears exactly one
area label: the area that owns the behaviour.

**Edges.** A blocking edge records a required result or a conflict, with its
reason and what releases it, on the leaf that needs it. A cross-stage edge
points at the concrete leaf that produces the result; that stage must be
accepted before outside consumers are released. Never chain features or
stages just because they were listed in order — which is about order, and
never about a thing that genuinely cannot be done yet. An outcome that waits
on another outcome is one of those, and it is recorded rather than left in
prose: the edge sits on the leaf that needs it and points at the leaf whose
result releases it, the one that puts the awaited thing in the person's hands.
Where no such leaf exists yet, it is written first — the acceptance of the
producing outcome — and the edge points at that. Importance is priority; "later"
is a milestone; where an issue came from is never a blocker. Cycles, in the
hierarchy or in live dependencies, are invalid.

**Status is true.** Active means somebody is working on it now. Stopping
releases unfinished holds and keeps `submitted` and `implemented` work with its
evidence; submitted results resume at merging, not implementation. Pending
acceptance is not abandonment. A handoff names who owns the next action.

**Tracked work.** Before implementing or changing the repository, find or file
the task. Every commit names one or more existing leaf tasks by the project's
convention, including research, documentation, prototypes and setup; initial
setup files its own task before any gate exists. Read-only discussion needs no
issue until it produces work to keep. The commit check verifies links; a clean
backlog does not.

**Nothing of value stays only in this session.** A conversation is the one
place work cannot be recovered from: its files are uncommitted, what it found
is unfiled, and what it learned is in nobody's memory but the agent's. Version
control's status is the test of that, and it is read rather than recalled. When
a piece of work ends, and always before offering to stop, hand over, compact or
start a fresh session, name what this session changed that no commit holds,
which task each change belongs to, and what would carry it; where there is no
task, filing one is the next step offered, as **Tracked work** says. What the
session learned and has nowhere else to live goes through `handoff` the same
way. Say each thing once, not in every message: this is a duty to leave nothing
behind, not a checklist to recite. A session that changed files and ended with
none of it said has lost the work, whatever stopped it.

**Exploration is not admission.** Discussion, imagination and read-only
research may end with no result, task or document. A hypothesis is not an
approved requirement, and a scratch experiment does not authorize production
use. Product and feature gates start at the commitment to keep an
implementation, not at thinking.

**Living documents.** The vision gives direction. The roadmap explains intended
outcomes and order, without copying tracker status or creating dependencies.
The charter bounds the current slice. Current capability specs describe
accepted behaviour on the main line; change records describe proposals as
pinned requirement deltas. Design and decision records explain how and why,
only where useful. Every project has a **glossary**: the words for its domain,
and the words it uses for its own parts, one line each. It is where a name is
taken from and not coined per message, by [**One thing, one name, and it is the
project's**](references/speaking.md); `model-domain` keeps it. Use the project's paths and templates and
adopt existing documents where they are. Documents are Markdown, and a diagram
in them is a Mermaid block, never one drawn with characters. A specification
required by a standard, such as a ТЗ, is drafted from these documents on
request by [tz-gost.md](references/tz-gost.md), never kept beside them.

**What describes the present is kept true.** The agent doc, the glossary, the
current capability specs and the architecture describe the main line as it is
now, and every agent acts on them without checking. So a change that makes one
of them false updates it in the same pull request, never in a later one: a
command renamed, a component moved, a behaviour changed, a lesson whose cause
was fixed. Review reads the diff against them as it reads it against the
tests, and a stage is not accepted while one of them is known to be wrong. A
statement found stale outside such a change is corrected by the work that found
it, as a repair, and named in its report. Keeping them short is part of keeping
them true: an entry nobody would miss is removed, not archived.

The document gate runs separately from the backlog's strength. It checks
product intent before the first implementation, feature readiness before work
starts, evidence tied to the revision at acceptance, and updated current specs
before closure. An accepted stage updates its own requirements without waiting
for unrelated features. A bug fix keeps correct requirements and changes the
regression check instead. Independent requirements may move at once; a changed
prerequisite needs a refresh. The integration supplies deterministic exports
and evidence at the level setup chose: honest records, or verified receipts
where protected CI can enforce them. A structural check cannot prove a requirement is right
or that a receipt is genuine; CI protection and real tests are separate jobs.

The document gate is installed as its own stage and never holds up setup or
work. Until it is installed, the integration says so and names its task. A
skill that would run it checks the same readiness by reading the documents,
records that the automatic check did not run, and never reports it as passed.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, unlike red and green: under `report` nothing is ever
red, and under `block` old debt is always red. Every skill that writes to the
backlog runs the gate **before** publishing, and fixes a new error by its own
`fix` line before anything leaves this machine.
