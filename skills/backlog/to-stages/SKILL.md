---
name: to-stages
description: "Decompose tracked work into independently acceptable stages and dependent or parallel tasks. Use after a short or full spec, or when take-task needs a stage sized for one session."
---

# To stages

Break one **outcome** into **stages**, and the first stages into **tasks**.
The agent owns routine decomposition; the owner settles only consequential
scope, cost or risk choices. After it, work proceeds within those decisions,
and a material new problem comes back as an escalation.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

## 1. Check the horizon

The outcome must belong to the current milestone. One that does not is not
decomposed, however clear it looks today: half of it will be stale before its
turn comes. Say so and stop.

## 2. Gather

Read the outcome's **full spec or short delta**, the feature issue, the charter,
and the code or system the outcome lands in. Without usable behaviour and
criteria, use `to-spec`; reuse an existing bug requirement and its regression
scenario. Best of all is the conversation the spec was written in: the breakdown
then stands on the thinking, not on its summary.

For a standalone task or bug, reuse the feature and acceptance stage it serves.
If none exists, create the minimal feature/stage containers in the current slice
with criteria derived from the same small change, and attach the existing leaf;
do not duplicate it or manufacture unrelated scope. A short task-body delta is
sufficient input for this path. The approval boundary is a changed outcome or
budget, not adding the containers the protocol requires.

A consequential question whose answer changes the breakdown is settled before
drafting: use "brainstorming" through the harness's available skill mechanism.

Look for the **prefactor**: what, changed first, makes the rest easy. Make the
change easy, then make the easy change.

## 3. Draft

An outcome that already has stages keeps them: decompose the **stages selected
to start now**, including independent stages that will run in parallel. Leave
later stages coarse. Redraw approved outcomes only when scope changes; routine
splitting to fit the session budget does not require redesigning the feature.

**Stages.** Each finishes something observable with its own DONE WHEN and fits
one session including integration, full checks, mutation testing and review.
Split a stage that does not fit. Together the stages satisfy the feature's
end-to-end criterion; they need not form a sequence. Independent stages and
features can execute concurrently. Add a dependency only for a concrete required
result, conflicting write or exclusive resource, on the affected leaf.

**Tasks**, for the stages that start now. Later stages stay as stages until
their turn; decomposing them early is the same mistake as decomposing the next
milestone.

- Small enough that the stage's tasks and acceptance fit its session budget.
- A **vertical slice**: a narrow but complete path through every layer the
  outcome touches, never one layer across. Finished, it can be shown or
  checked on its own.
- Prefactoring first, as tasks of its own.
- Acceptance covers the spec's seams; local tests may use other stable interfaces.
- The title is a sentence the work can be understood from.
- The criterion is an **assertion**: something a stranger can run or look at
  and get yes or no. For every "fails when" there is a paired "and on an
  ordinary day it succeeds".
- Edges per the protocol, with the required result or conflict and its release
  condition. No artificial chains from list order or parentage.
- An integration point and related checks for each result, so dependants in
  the same stage can start before final acceptance without closing it early.
- Parallel tasks have compatible write scopes or isolated checkouts, and a
  named coordinator collects and verifies their results.

**A wide refactor is the exception to slicing.** One mechanical change whose
blast radius is the whole codebase (a renamed column, a retyped shared symbol)
breaks every caller at once, and no vertical slice of it lands green. Sequence
it as **expand, migrate, contract**: add the new form beside the old; move the
callers over in batches sized by blast radius, each batch a task; delete the
old form in a last task, once no caller remains. The old form is what keeps
every batch green.

Stages and tasks alike wear exactly one area label. Stages are created as the
type the backlog integration names for them, which is the type the gate checks
for a DONE WHEN.

## 4. Present the recommended breakdown

Show the breakdown as a numbered list: title, what it makes true, blocked by.
Explain the stage result, size, real prerequisites and parallel opportunities.
Use the established role, otherwise product engineer: explain each recommended
boundary by the outcome it enables and the cost or risk of changing it. Let the
user change named entries, not approve every task, edge or worker assignment.
Ask about unresolved product, cost or risk decisions one at a time; do not
re-ask for already approved scope or routine implementation sequencing.

## 5. Publish and prove

Create stages under the feature and tasks under their stages, with the
tracker's verbs. Run the gate. Done when it is clean and the ready leaves are
exactly the first tasks you expect. Then publish, and report by name what is
ready to take: `take-task` for the stage, with its parallel-ready leaves. When
called from an authorized execution workflow, return the breakdown to it and
continue; do not force a new conversation or another manual command.
