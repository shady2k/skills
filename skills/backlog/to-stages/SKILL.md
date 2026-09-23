---
name: to-stages
description: "Decompose tracked work into independently acceptable stages and dependent or parallel tasks, each task sized for one worker's session. Use after a short or full spec, or when take-task needs stages for a feature run."
---

# To stages

Break one **outcome** into **stages**, and the stages that start now into
**tasks**. Routine decomposition is the agent's; the owner decides only scope,
cost or risk that matters. Afterwards work proceeds within those decisions,
and a material new problem comes back to the owner.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

## 1. Check the horizon

The outcome must belong to the current milestone. If it does not, do not
decompose it, however clear it looks: say so and stop.

## 2. Gather

Read the outcome's spec or short delta, the feature issue, the charter and the
code it lands in; the conversation the spec came from is best of all. Without
usable behaviour and criteria, use `to-spec`. For a bug, reuse its requirement
and regression scenario.

Before drafting, read the open work that would replace what these stages stand
on, by the protocol's **What would replace the ground is read before anything
is built on it**: found now, a collision is an edge and a reshaping.

A standalone task or bug joins the feature and stage it serves. If none exists,
create the minimal feature and stage in the current slice, with criteria from
the same small change, and attach the existing task. Do not duplicate it or add
unrelated scope. A short delta in the task body is enough input here. Adding
these containers needs no approval; changing the outcome or budget does.

Settle any question whose answer changes the breakdown first, through
`brainstorming`.

Look for the **prefactor**: the change that, made first, makes the rest easy.

## 3. Draft

An outcome that already has stages keeps them. Decompose only the **stages
starting now**, including independent ones that will run in parallel; leave
later stages coarse; the coordinator of a feature run breaks them down when it
reaches them, within the spec. Redesign approved outcomes only when scope
changes.

**Features.** A feature is built in one run and merges into the main line as
one pull request, so it must be small enough that its branch lives no longer
than the project allows. If the stages would not fit, split the outcome into
features that each merge on their own and keep the main line working, and say
so to the owner; changing the milestone's outcomes goes through `/to-milestone`.

**Stages.** Each finishes something observable with its own DONE WHEN: a
checkpoint that full checks, mutation testing and review accept before the
next stage builds on it. Observable means seen: carry the spec's place of
observation down to the stage that first makes the outcome reachable there, so
the walk happens inside the run and not only at its end. A stage has no
session limit; its tasks do. Together they meet the feature's end-to-end
criterion; they need not form a sequence, and independent stages and features
run concurrently. Add a dependency only for a real required result,
conflicting write or exclusive resource, on the affected task.

**Tasks**, for the stages starting now only:

- Small enough for one worker's session, including its local checks.
- A **vertical slice**: a narrow, complete path through every layer the outcome
  touches, never one layer across. Finished, it can be shown or checked alone.
- Prefactoring first, as its own tasks.
- Acceptance covers the spec's seams; local tests may use other stable interfaces.
- The title is a sentence the work can be understood from, naming each part by
  the glossary's name for it (the protocol's **One thing, one name**).
- The criterion is an **assertion** a stranger can run or look at and get yes
  or no. Every "fails when" has a paired "and normally it succeeds".
- Dependencies follow the protocol: the required result or conflict and what
  releases it. None from list order or parentage.
- Each result has an integration point and related checks, so dependants in
  the same stage can start before the stage is accepted.
- Parallel tasks have separate write scopes or isolated checkouts, and a named
  coordinator collects and verifies their results.

**A wide refactor is the exception.** A mechanical change across the whole
codebase (a renamed column, a retyped shared symbol) breaks every caller at
once, so no vertical slice of it lands green. Use **expand, migrate,
contract** (the protocol's **Levels**): add the new form beside the old; move callers in batches, one task
each; delete the old form in a last task once nothing uses it.

Stages and tasks each wear exactly one area label. Create stages as the type
the integration names for them; that is the type the gate checks for a DONE WHEN.

## 4. Present the breakdown

Show a numbered list: title, what it makes true, what it waits for. Explain
each stage's result, size, real prerequisites and what can run in parallel, in
terms of the outcome it enables and the cost or risk of changing it. The user
changes named entries; they do not approve every task or assignment. Ask about
open product, cost or risk decisions one at a time; do not re-ask approved scope.

## 5. Publish and prove

Create stages under the feature and tasks under their stages with the tracker's
verbs. Run the gate. It is done when the gate is clean and the ready tasks are
exactly the first ones you expect. Publish and name what is ready to take:
`take-task` for the stage, with the tasks that can run in parallel. When called
from an authorized execution workflow, return the breakdown to it and continue.
