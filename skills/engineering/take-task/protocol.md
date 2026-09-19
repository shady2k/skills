# The backlog protocol

Protocol version: 0.9.1

**Compatibility before writes.** Compare this version with the project's
config `setupVersion` and all three installed checks' `--version`, and require
`setupStatus: verified`. Missing or mismatched versions, or a pending/failed
setup, mean: ask the user to run `/setup-shady2k-skills` after the
update, and pause tracker/repository mutations. Read-only investigation may
continue. Setup itself and its explicitly supplied bootstrap context are exempt
while installing or migrating. No universal plugin-update hook is assumed.

The same in every project, and shipped with every skill of the set that uses
it, so that it updates when the set does. Where a project's own document
restates any of this, this file is the one that holds. What differs per project
(its tracker, its labels, its gate command, its documents) is not here: that is
the project's **backlog integration**, which its agent doc points at.

**Levels.** Each has one size and one author.

| level     | what it is                                                        | size              |
| --------- | ----------------------------------------------------------------- | ----------------- |
| Vision    | where this is going; a document, never an issue                   | rarely rewritten  |
| Milestone | a slice with a charter: what is in, what is out, a finding budget | what ships next   |
| Feature   | a root issue holding one **outcome**                              | one or more stages |
| Stage     | an issue under a feature, with its own DONE WHEN                  | one session, including acceptance |
| Task, bug | a leaf within an independently acceptable stage                   | part of that session |

An **outcome** is what becomes possible or true, and who observes it: "a person
creates a connection group", "a rollback is one command and one minute". Its
DONE WHEN names observable behaviour and the check that watches it. Regressions
can make it false again. A stage that will not fit is split before dispatch;
an unexpected overrun is handed off with its acceptance still pending.

**The horizon.** Only the current milestone is decomposed below features. The
next one exists as feature titles; anything further is the vision's business.
**Everything live belongs to the current milestone**: its root wears the
milestone's label. Whatever does not is deferred. The current milestone is
whatever the gate's config says it is, read from there each time.

**Ready** means an open **leaf**, unheld, whose required results are available.
A closed prerequisite is satisfied. An `implemented` prerequisite is satisfied
only within the same stage, after its recorded revision is integrated into the
consumer's checkout and its related checks pass. Across stages it must be
accepted and closed. The adapter's ready operation takes the stage and checkout
revision; it must not merely ask which blockers are closed.

**Execution and acceptance.** A worker claims a leaf, verifies its change and
records it as `submitted`, with a durable result revision/location and local
evidence, for the stage coordinator. Submitted work is neither ready to
reimplement nor available as a dependency. Only the coordinator marks it
`implemented`, with an integration revision and local-check evidence. It is
not ready to take again and not yet closed. A stage has one coordinator; workers
have distinct owners and an atomic claim or serialized assignment. Reading back
a last-write-wins claim is not a lock. If integration changes or fails, reopen
affected work and reassess consumers. The stage's full tests, scoped mutation
checks and final review run on the assembled result. Close its tasks and stage
only after acceptance on that revision; a parent has its own criterion too.

**Parallelism.** Independent leaves, stages and features may run concurrently.
Hierarchy, list order and a shared milestone never imply a blocking edge. Each
stage has its own integration and acceptance boundary; it need not wait for an
unrelated feature. Within one stage, integrate completed results as they arrive
so their dependants can start. Serialize only a real prerequisite, a conflicting
write or an exclusive resource. Use isolated checkouts where changes can collide;
shared files such as generated files and dependency locks count as conflicts.

**Two lanes outside the flow.**

- **Ideas**: deferred, no parent, no edges, a review date. Never in the ready
  queue, closed without regret.
- **Findings**: bugs and debt found mid-milestone. Each wears the finding label
  **and the label of the milestone it was filed in**, so a feature carried into
  the next milestone does not bring its old findings to the new budget. The
  charter declares that budget. A finding beyond the budget goes to the next milestone or displaces
  something by the owner's explicit decision; it never goes silently to the
  front.

**Labels.** Every live issue, features and stages included, wears exactly one
area label, by the area that owns the behaviour.

**Edges.** A blocking edge records a required result or a conflict, with its
reason and what releases it, on the consuming leaf. Point cross-stage edges at
the concrete producer leaf; its stage must accept before it releases outside
consumers. Never chain entire features or stages merely because they were listed
in order. Importance is priority; "later" is a milestone. Provenance is never a
blocker. Cycles in either hierarchy or live dependencies are invalid.

**Status is true.** Active means somebody is working on it now. Stopping means
releasing unfinished holds, preserving `submitted` and `implemented` work and
their evidence. Submitted results resume at integration, not implementation.
Acceptance pending is not abandonment. Handoffs name who owns the next action.

**Tracked work.** Before implementation or a repository change, resolve or file
its task. Every commit names one or more existing leaf tasks by the project's
convention, including research, documentation, prototypes and setup. Initial
setup creates its task through the chosen tracker before a gate exists. A
read-only discussion or investigation need not create an issue until it produces
work to retain. Commit links are verified by the separate commit check; a clean
backlog alone does not prove them.

**Exploration is not admission.** Free discussion, imagination and read-only
research can end with no result, task or document. Hypotheses are not approved
requirements. A scratch experiment does not authorize production adoption.
Product/feature gates begin at commitment to retained implementation, not thought.

**Living documents.** Vision gives direction; roadmap explains intended outcomes
and sequence without duplicating tracker status or creating blocking edges.
The charter bounds the current slice. Current capability specs describe accepted
mainline behaviour; change records describe proposals and pinned requirement
deltas. Design and decision records explain how and why only where useful.
Use project-provided paths/templates, adopting existing documents in place.

The document gate runs separately from backlog strength: product intent before
first implementation, feature readiness before dispatch, revision-bound evidence
at acceptance and synchronized current specs before closure. An accepted stage
updates its own requirements without waiting for unrelated features. Correct
requirements survive bug fixes; regression checks change instead. Independent
requirements may advance concurrently; a changed prerequisite requires refresh.
The integration supplies deterministic exports and verified receipts. Structural
validation cannot establish semantic correctness or authenticate a fabricated
receipt. CI/wrapper protection and actual tests are distinct responsibilities.

**Names, not identifiers.** Everything a person reads says "Title" (id), the id
in parentheses and only where somebody must act on it. A title is a sentence
the work can be understood from. A bare id, or a list of ids, is never an item
of a report: look the title up first. If the title does not explain the work,
say in a few words what it is about.

**Speaking to the owner.** The words of this protocol, the config, the tracker
and the tools are for the agent. The person reads what they mean for the work,
in their own language. Say instead:

| internal | what the person reads |
| --- | --- |
| an abandoned hold or claim | a task listed as taken, which nobody has touched for days |
| released | returned to the queue so anyone can take it |
| ready leaf / ready queue | tasks that can be started now |
| submitted | done by an agent, waiting to be merged into the stage |
| implemented | merged into the stage, waiting for the stage to be accepted |
| setup pending or failed, version mismatch | the update is not finished: skills that change tasks wait until it is |
| gate strength `block-new` | a commit may not add new backlog problems; old ones are listed but do not block |
| new errors: 0 | the backlog is in order: nothing broken was added |
| finding budget | how many new bugs and debts the current version takes in before the rest waits for the next |
| deferred | moved out of the current version, not lost |
| mutation testing | deliberately breaking changed code to check that the tests notice |

Terms outside the table get the same treatment: a plain phrase, or one clause
of definition the first time. Config keys, status values, labels, commands,
tool names, commit hashes and branch names do not appear unless the person must
type or find them. A number comes with what it means and whether to act on it.
Lead with the consequence for the work: what can be done now, what waits, and
what is needed from the person. Show what changes and what needs a decision;
what stays as it was takes one line. Diagnostics and proof belong with the
task that did the work, available on request, not in the message.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, which red and green do not: under `report` nothing
is ever red, and under `block` old debt is always red. Every skill that writes
to the backlog runs the gate **before** publishing, and a new error is fixed by
its own `fix` line before anything leaves this machine.
