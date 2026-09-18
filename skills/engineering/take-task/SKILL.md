---
name: take-task
description: "Take one ready task and finish it: claim it, watch its check fail, make it pass in thin slices, have it reviewed against the spec, close it on evidence."
disable-model-invocation: true
---

# Take task

One ready leaf, from taken to closed, in one session. Everything the owner had
to decide was decided in the spec; what is left is done without them, and what
turns out undecided goes back to them as an escalation, never as a guess.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

## 1. Take it

The task the user named; otherwise the first ready leaf of the current
milestone, by the tracker's ready verb. **Claim it before reading further**, and
where the tracker lets two claims through, read it back to see that the holder
is you.

Then read upward: the task and its criterion, its stage's DONE WHEN, the
feature's spec. A task with no criterion a stranger could run, or a feature
with no spec for anything larger than a fix, is not ready whatever the tracker
says: release it, say what is missing, and tell the user `/to-stages` or
`/to-spec` owns that.

## 2. Red before green

The task's criterion is an assertion. **Make it executable and watch it fail**
before writing anything that could make it pass: a check that was never red
proves nothing when it is green. For operations the same: run the drill, see
the alert not arrive, then build the alert.

- **At the agreed seam, and only there.** The spec names the seams. A check
  written against internals breaks on the next refactor and says nothing about
  behaviour. No seam agreed: agree one with the owner before the first check.
- **One slice at a time**: one check, the least that passes it, then the next,
  each shaped by what the last one taught. Writing every check first tests an
  imagined design.
- **The expected value comes from somewhere else**: a known literal, a worked
  example, the spec. A check that recomputes the answer the way the code does
  can never disagree with it.
- Tidying is not part of the loop. It belongs to the review.

Run the project's fast gates as you go (the type-checker, the single check you
are on) and its full suite once, at the end.

## 3. What you find on the way

- A decision the spec does not settle: **stop, do not pick**. Comment on the
  task with the question and what hangs on it, release the task, and take the
  question to the owner, or to whoever dispatched you. That is an escalation,
  and it is the only way a task comes back.
- A bug or a piece of debt that is not this task: call the Skill tool with
  "to-backlog". It is not fixed here "while we are at it".
- Something broken that resists a first look: call the Skill tool with
  "diagnose-bug".

## 4. Have it reviewed

By eyes that did not write it: two sub-agents in parallel where the harness has
them, otherwise two separate passes, and never one merged list. The briefs,
and the baseline of smells the first one carries, are in
[`review.md`](review.md).

- **Standards**: does the change follow what this project documents about how
  its code is written?
- **Spec**: does it do what the task and the spec asked, no less and no more?

A change can pass one and fail the other, which is why they are not merged.
Fix what they find that belongs to this task; file the rest.

## 5. Close it

Commit the way this project commits. Then call the Skill tool with
"close-out": the evidence is the check of step 2, now green, and the commit.

**One task per conversation.** The next task starts in a fresh one: it is
self-contained by construction, and this one's context is weight.
