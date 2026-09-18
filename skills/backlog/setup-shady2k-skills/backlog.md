# Backlog: how work is tracked here

Written by `/setup-shady2k-skills` on <date>. The skills of the set read this
file first and nothing else about the tracker. Edit it freely; re-run the
installer only to change the tracker or the gate's strength.

## The protocol

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
milestone's label. Whatever does not is deferred.

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

**Edges.** A blocking edge records a collision, two issues changing the same
thing, and sits on the leaf that collides. Importance is priority; "later" is a
milestone. Provenance is never a blocker.

**Status is true.** Active means somebody is holding it now. Stopping means
releasing it in the same minute.

**Names, not identifiers.** Everything a person reads says "Title" (id), the id
in parentheses and only where somebody must act on it. A title is a sentence
the work can be understood from.

## This project

- **Vision:** <path>
- **Milestone charters:** <directory>/<milestone label>.md
- **Current milestone:** read `currentMilestone` from the gate config, never from here.
- **Evidence that may be cited at close:** <a commit, a test, a file or symbol | a runbook run, an alert fired in a drill, a dashboard value | …>
- **Features and stages are created as:** <the tracker's type that the adapter maps to `epic`>. The gate looks for a DONE WHEN on that type only.
- **Labels:** every live issue, features and stages included, wears exactly one area label. Ideas wear `<idea label>`, findings wear `<finding label>`.

## The gate

- **Config:** <path>
- **Adapter:** <path>
- **Rules:** <path of `check.mjs`: called in place, or a verbatim copy of version <version>, never edited>
- **Strength:** <block | block-new | report>, chosen <date>
- **Run it:** `<the exact command, as the hook runs it>`
- **Every violation as JSON:** `<the same with --json>`
- **Ages from before a bulk edit:** add `--ages-from <snapshot>` to the command
  above. Snapshots so far: <date of the bulk edit, path of the adapter output
  saved before it>.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, which red and green do not: under `report` nothing
is ever red, and under `block` old debt is always red. Every skill that writes
to the backlog runs the gate **before** publishing, and a new error is fixed by
its own `fix` line before anything leaves this machine.

## Tracker verbs

How this project's tracker does each thing the skills ask for. Where the tracker
cannot, say so here and say what stands in.

| verb     | how                                                     |
| -------- | ------------------------------------------------------- |
| create   | <title, type, labels, parent, body>                     |
| link     | <blocking edge; parent; how provenance is kept apart>   |
| claim    | <hold an issue: status and holder in one step. What happens when two claim at once: the tracker refuses the second, or last write wins and the claimer re-reads after claiming> |
| release  | <give it back>                                          |
| close    | <with a reason>                                         |
| comment  | <add a note to an issue>                                |
| edit     | <retitle, rewrite the body, move to another parent>     |
| unlink   | <remove a blocking edge>                                |
| defer    | <with a review date, or where the date is recorded>     |
| undefer  | <bring a deferred issue back>                           |
| milestone | <put an issue in a milestone: a label, or the native field> |
| ready    | <ready leaves only; how features and stages are left out> |
| holds    | <every active issue with who holds it>                  |
| children | <of an issue, with a rollup by status if there is one>  |
| label    | <add, remove>                                           |
| search   | <by phrase; and the listing of one area>                |
| show     | <one issue whole, with its comments>                    |
| publish  | <how a backlog write reaches everybody else; after the gate is clean> |
