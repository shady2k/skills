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

`docs/agents/backlog.md` should have been provided to you. If not, tell the
user to run `/setup-shady2k-skills`.

## 1. Check the horizon

The outcome must belong to the current milestone. One that does not is not
decomposed, however clear it looks today: half of it will be stale before its
turn comes. Say so and stop.

## 2. Gather

Read the feature issue, the charter, the vision, and the code or system the
outcome lands in. Settle with the owner every question whose answer changes the
breakdown, one at a time, before drafting.

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

- One session each, a narrow but complete path, verifiable on its own.
- The title is a sentence the work can be understood from.
- The criterion is an **assertion**: something a stranger can run or look at
  and get yes or no. For every "fails when" there is a paired "and on an
  ordinary day it succeeds".
- Edges per the protocol: a collision only, on the leaf.

Stages and tasks alike wear exactly one area label. Stages are created as the
type `docs/agents/backlog.md` names for them, which is the type the gate checks
for a DONE WHEN.

## 4. Quiz the owner

Show the breakdown as a numbered list: title, what it makes true, blocked by.
Ask whether the grain is right, whether each edge is a real collision, and what
is missing. Iterate until approved.

## 5. Publish and prove

Create stages under the feature and tasks under their stages, with the
tracker's verbs. Run the gate. Done when it is clean and the ready leaves are
exactly the first tasks you expect. Then publish, and report by name what is
ready to take.
