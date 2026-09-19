# The backlog protocol

Protocol version: 0.10.0

These rules are the same in every project and ship with every skill that uses
them, so they update with the set. If a project's own document restates them,
this file wins. What differs per project (tracker, labels, gate command,
documents) is the project's **backlog integration**; its agent doc points to it.

**Compatibility before writes.** Before changing the tracker or the repository,
compare this version with the config's `setupVersion` and with the `--version`
of all three installed checks, and require `setupStatus: verified`. If a value
is missing or different, or setup is pending or failed, stop changing things
and ask the user to run `/setup-shady2k-skills`. Reading and investigating may
continue. Setup itself, and the bootstrap context it hands over, are exempt
while installing or migrating. No automatic update hook is assumed.

**Levels.** Each has one size and one author.

| level     | what it is                                                        | size              |
| --------- | ----------------------------------------------------------------- | ----------------- |
| Vision    | where the product is going; a document, never an issue           | rarely rewritten  |
| Milestone | the next slice, with a charter: what is in, what is out, a finding budget | what ships next   |
| Feature   | a root issue holding one **outcome**                              | one or more stages |
| Stage     | an issue under a feature, with its own DONE WHEN                  | one session, including acceptance |
| Task, bug | a leaf: an issue with no children, inside one stage               | part of that session |

An **outcome** is what becomes possible or true, and who observes it: "a person
creates a connection group", "a rollback takes one command and one minute". Its
DONE WHEN names the observable behaviour and the check that watches it; a
regression can make it false again. A stage that will not fit one session is
split before work starts; one that overruns is handed off with acceptance
still pending.

**The horizon.** Only the current milestone is broken down below features. The
next milestone exists as feature titles; anything further lives in the vision.
**Everything live belongs to the current milestone**, whose label its root
wears; everything else is deferred. The current milestone is read from the
gate's config each time.

**Ready** means an open leaf that nobody holds and whose required results are
available. A closed prerequisite counts. An `implemented` prerequisite counts
only inside the same stage, once its revision is merged into the consumer's
checkout and its related checks pass; across stages it must be accepted and
closed. So the adapter's ready operation takes the stage and checkout revision,
not just "are the blockers closed".

**Execution and acceptance.** A worker claims a leaf (takes a hold on it),
checks its change and records it as `submitted`, with where the result lives
and its local evidence. Submitted work is neither taken again nor used by
dependants yet. The stage's single coordinator merges it and marks it
`implemented`, with the merge revision and check evidence; it is not taken again
and not yet closed.
Workers have distinct owners and an atomic claim or a serialized assignment:
reading back a field that anyone can overwrite is not a lock. If a merge
changes or fails, reopen the affected work and recheck what depends on it. The
assembled stage gets full tests, mutation checks of changed logic and a final
review. Its tasks and the stage close only after acceptance on that revision; a
parent has its own criterion too.

**Parallelism.** Independent leaves, stages and features may run at once.
Hierarchy, list order or a shared milestone never make one wait for another.
Each stage has its own merge and acceptance and does not wait for unrelated
features. Inside a stage, merge results as they arrive so dependants can start.
Serialize only for a real prerequisite, a conflicting write or an exclusive
resource. Use separate checkouts where changes can collide; generated files and
dependency locks count as collisions.

**Two lanes outside the flow.**

- **Ideas**: deferred, no parent, no dependencies, a review date. Never ready,
  closed without regret.
- **Findings**: bugs and debt found during a milestone. Each wears the finding
  label **and the label of the milestone it was filed in**, so a feature
  carried forward does not bring old findings into the new budget. The charter
  sets that budget. A finding over budget goes to the next milestone, or
  displaces something only by the owner's explicit decision; it never jumps to
  the front silently.

**Labels.** Every live issue, features and stages included, wears exactly one
area label: the area that owns the behaviour.

**Edges.** A blocking edge records a required result or a conflict, with its
reason and what releases it, on the leaf that needs it. A cross-stage edge
points at the concrete leaf that produces the result; that stage must be
accepted before outside consumers are released. Never chain features or
stages just because they were listed in order. Importance is priority; "later"
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
only where useful. Use the project's paths and templates and adopt existing
documents where they are.

The document gate runs separately from the backlog's strength. It checks
product intent before the first implementation, feature readiness before work
starts, evidence tied to the revision at acceptance, and updated current specs
before closure. An accepted stage updates its own requirements without waiting
for unrelated features. A bug fix keeps correct requirements and changes the
regression check instead. Independent requirements may move at once; a changed
prerequisite needs a refresh. The integration supplies deterministic exports
and verified receipts. A structural check cannot prove a requirement is right
or that a receipt is genuine; CI protection and real tests are separate jobs.

The document gate is installed as its own stage and never holds up setup or
work. Until it is installed, the integration says so and names its task. A
skill that would run it checks the same readiness by reading the documents,
records that the automatic check did not run, and never reports it as passed.

**Names, not identifiers.** Everything a person reads says "Title" (id), with
the id in parentheses and only where somebody must act on it. A title is a
sentence the work can be understood from. A bare id, or a list of ids, is never
an item of a report: look the title up first. If the title does not explain the
work, say in a few words what it is about.

**Speaking to the owner.** The words of this protocol, the config, the tracker
and the tools are for the agent. The person reads what they mean for the work,
in their own language. Use the person's established role, otherwise **product
engineer**: someone who owns the product and its trade-offs and builds through
agents, without holding the code or tool settings in their head. Explain in
consequences for users, time, cost and risk. Say instead:

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
same under every strength, unlike red and green: under `report` nothing is ever
red, and under `block` old debt is always red. Every skill that writes to the
backlog runs the gate **before** publishing, and fixes a new error by its own
`fix` line before anything leaves this machine.
