# The backlog protocol

Protocol version: 0.7.2

**Compatibility before writes.** Compare this version with the project's
config `setupVersion` and both installed checks' `--version`, and require
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

**Names, not identifiers.** Everything a person reads says "Title" (id), the id
in parentheses and only where somebody must act on it. A title is a sentence
the work can be understood from.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, which red and green do not: under `report` nothing
is ever red, and under `block` old debt is always red. Every skill that writes
to the backlog runs the gate **before** publishing, and a new error is fixed by
its own `fix` line before anything leaves this machine.
