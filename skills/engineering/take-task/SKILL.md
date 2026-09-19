---
name: take-task
description: Take tracked work through the right amount of design, parallel implementation where possible, and acceptance of a complete stage.
disable-model-invocation: true
---

# Take task

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. Read
[`protocol.md`](protocol.md), including its setup-version check.

## 1. Find the work and choose its route

Take the task, list, stage or outcome the user named; otherwise propose a ready
stage of the current milestone by name. Find or file the task before any
implementation. Read its requirements, spec, charter and code. Work already
`submitted` resumes at integration and an `implemented` stage at acceptance,
never from scratch.

Everything the owner reads follows the protocol's **Speaking to the owner**.

Present the recommended route and how it will run as one proposal, with the
assumptions it rests on: what it achieves, why it fits, and its effect on time, cost and risk. Keep setup
choices and earlier approvals. The user changes named items; do not ask them to
pick worker counts, commands or helpers. Delegated choices cover routine
details, not new scope, spending or weaker acceptance.

Size the design by **size, uncertainty and risk**, not by the TDD setting. A
small irreversible change can need more design than a large routine one.

- **Small, understood change:** a short delta through `to-spec`, and one stage
  with only the needed tasks through `to-stages`. Reuse approved criteria.
- **Bug:** the existing requirement plus a regression scenario; change the spec
  only for a gap or an approved behaviour change. Use `diagnose-bug` when the
  cause is unclear. Attach the bug to its stage, or through `to-stages` to a
  minimal one, before dispatch. A small bug needs no full spec.
- **Uncertain or substantial work:** `brainstorming`, then `to-research` or
  `to-prototype` where evidence is needed, then `to-spec` and `to-stages`.
  Continue through decisions already authorized; ask only about the owner's.
- **Research, setup or docs only:** the matching helper, with no invented
  product requirements. Export a `supporting` change with its scope reason and
  task, under the integration's check policy. This route never hides
  production code or a change to current specs.

If a required helper is not installed, name it and how to install it; never
pretend it ran. A stage's session includes implementation, integration, review
and fixes; split one that will not fit before dispatch. Do not quietly grow one
task into a whole feature: name the stage it needs and settle a real scope
change with the owner.

## 2. Coordinate and dispatch

Before dispatching implementation, run the integration's feature document check
against the actual baseline; the first product implementation also needs the
product check. Research and design tasks may prepare these without claiming
implementation is ready. Keep existing paths, and limit legacy baselines to the
affected capabilities. Refresh a stale requirement only after reconciling its
meaning; unrelated parallel changes do not invalidate this work.

Read execution settings from the gate config and commands from the integration.
Each stage has one coordinator, who owns its integration and acceptance and may
also implement. Claim tasks atomically, or have the coordinator assign them one
at a time if the tracker cannot. Every claim names the agent that does the work
(the coordinator, or the worker by its number), never the person.

Dispatch independent ready tasks in parallel where resources allow; independent
stages and features may run in parallel with their own coordinators and
acceptance. Add dependencies only by the protocol's rules, never from list
order, hierarchy or a shared milestone. Without parallel execution, follow the
same dependencies one at a time.

Give each worker its task and criterion, the relevant spec, dependencies, base
revision, owned scope, local check commands, the TDD setting and the return
format. Use isolated checkouts where concurrent writes could collide, and
coordinate shared generated files, migrations and dependency locks.

## 3. Implement with local checks

**TDD:** watch a behaviour check fail for the intended reason, write the least
code that passes it, refactor while it stays green; one slice at a time.
**Test-after:** implement, then add or update the checks before returning.

The spec's seams define acceptance, not a ban on local tests. Test through
stable behaviour at a sensible level; take expected values from the requirement
or an independent example, not from a copy of the algorithm. For operations,
use a safe rehearsal or isolated environment; never cause a live outage to get
a failing check.

Workers run static checks and the tests related to their change, including
neighbouring behaviour it affects. The full suite, mutation testing and final
review happen once, at stage acceptance. A
shared change can rightly widen a worker's related tests.

A worker returns the task, its linked commits, the changed behaviour, check
commands and results, open doubts and integration notes. Record `submitted`
with the result's revision or location and evidence before releasing the
worker's claim. A worker's "done" means ready to integrate, not accepted.

## 4. Integrate and handle discoveries

Merge each result into the stage checkout, resolve conflicts and rerun related
checks if merging changed it. Record the merged revision and evidence, then mark
the task `implemented`. Its dependants in this stage can start now; dependants
in other stages wait for acceptance. Implemented work never goes back to ready.

- Decide reversible implementation details yourself. Stop the affected work and
  bring to the owner a change of product behaviour, a material cost or risk, an
  irreversible choice or missing authority, with a recommendation and its
  alternatives. Continue independent authorized work meanwhile.
- File unrelated bugs, debt and blocked questions through `to-backlog`. Making
  this stage meet its own criterion is part of this work, not a finding.
- A stubborn failure goes to `diagnose-bug` within the current task.
- If the session will not fit, keep the merged revision and the pending
  acceptance and recommend `/handoff`. A partly checked stage is never accepted.

## 5. Accept the assembled stage

With all results merged, run the project's full required checks and the stage's
DONE WHEN on the assembled revision. Then run mutation testing on changed logic
within the configured time budget. Investigate survivors that matter, telling
apart equivalent mutations, missing tests and tool failures. Unsupported tools,
timeouts and skipped checks are reported as such, never as passed. Use the
project's agreed fallback; without one, resolve the gap before closing.

Get a final review following [`review.md`](review.md), preferably from another
model. Fix valid findings within scope and repeat the affected checks. If a fix
changes code after the full run, rerun the full checks on the final revision.
Repeat mutation testing and review where a fix invalidated them; evidence whose
inputs did not change can be reused.

Record the base and final revisions, included tasks, criteria, test and mutation
results, and review findings with what was done about each. For non-code work,
use the project's equivalent evidence and say which checks do not apply. Get
the evidence at the integration's level and run the acceptance document check.
At the protected level, "passed" written by an agent is not a receipt; at the
records level, say that records are trusted. Report the accepted stage to the
owner as the protocol's summary: what users can now do, decisions and
assumptions made on the way, what review found, and what remains unknown.
Then close the accepted tasks and stage through `close-out`. Commit links and a
clean backlog are required but never replace checking the behaviour.
