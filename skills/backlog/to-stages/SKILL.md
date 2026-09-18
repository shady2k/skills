---
name: to-stages
description: Break one outcome of the current milestone into stages and one-session tasks, each with a criterion written as an assertion.
disable-model-invocation: true
---

# To stages

Break one **outcome** into **stages**, and the first stages into **tasks**.
This is where the owner is needed. After it, work is taken and finished without
them, and a problem comes back as an escalation, not as a question that should
have been asked here.

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

Read the outcome's **spec**, the feature issue, the charter, and the code or
system the outcome lands in. An outcome with no spec: tell the user `/to-spec`
owns that, and stop, unless the owner says this one is small enough to need
none. Best of all is the conversation the spec was written in: the breakdown
then stands on the thinking, not on its summary.

A question whose answer changes the breakdown is settled before drafting: call
the Skill tool with "brainstorming".

Look for the **prefactor**: what, changed first, makes the rest easy. Make the
change easy, then make the easy change.

## 3. Draft

An outcome that already has stages keeps them: decompose only its **next open
stage** into tasks, and redraw the stages only if the owner says the plan
changed.

**Stages.** Each is a few sessions at most, finishes something observable on
its own, and has its own DONE WHEN. The last stage's DONE WHEN is the feature's
check, watched end to end. A stage that cannot be finished in a few sessions is
two stages.

**Tasks**, for the stages that start now. Later stages stay as stages until
their turn; decomposing them early is the same mistake as decomposing the next
milestone.

- One session each, sized to fit one fresh conversation.
- A **vertical slice**: a narrow but complete path through every layer the
  outcome touches, never one layer across. Finished, it can be shown or
  checked on its own.
- Prefactoring first, as tasks of its own.
- Checked at one of the seams the spec agreed, and nowhere else.
- The title is a sentence the work can be understood from.
- The criterion is an **assertion**: something a stranger can run or look at
  and get yes or no. For every "fails when" there is a paired "and on an
  ordinary day it succeeds".
- Edges per the protocol: a collision only, on the leaf.

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

## 4. Quiz the owner

Show the breakdown as a numbered list: title, what it makes true, blocked by.
Ask whether the grain is right, whether each edge is a real collision, and what
is missing. Iterate until approved.

## 5. Publish and prove

Create stages under the feature and tasks under their stages, with the
tracker's verbs. Run the gate. Done when it is clean and the ready leaves are
exactly the first tasks you expect. Then publish, and report by name what is
ready to take: `/take-task`, one task per fresh conversation.
