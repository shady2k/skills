# The backlog protocol

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
| Feature   | a root issue holding one **outcome**                              | several stages    |
| Stage     | an issue under a feature, with its own DONE WHEN                  | a few sessions    |
| Task, bug | a leaf                                                            | one session       |

An **outcome** is what becomes possible or true, and who observes it: "a person
creates a connection group", "a rollback is one command and one minute". Its
DONE WHEN stops being false exactly once, and names the check that watches it.

**The horizon.** Only the current milestone is decomposed below features. The
next one exists as feature titles; anything further is the vision's business.
**Everything live belongs to the current milestone**: its root wears the
milestone's label. Whatever does not is deferred. The current milestone is
whatever the gate's config says it is, read from there each time.

**Ready** means a ready **leaf**: a task or a bug nobody holds and nothing
blocks. Features and stages are finished, never taken.

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

**Edges.** A blocking edge records a collision, two issues changing the same
thing, and sits on the leaf that collides. Importance is priority; "later" is a
milestone. Provenance is never a blocker.

**Status is true.** Active means somebody is holding it now. Stopping means
releasing it in the same minute.

**Names, not identifiers.** Everything a person reads says "Title" (id), the id
in parentheses and only where somebody must act on it. A title is a sentence
the work can be understood from.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, which red and green do not: under `report` nothing
is ever red, and under `block` old debt is always red. Every skill that writes
to the backlog runs the gate **before** publishing, and a new error is fixed by
its own `fix` line before anything leaves this machine.
