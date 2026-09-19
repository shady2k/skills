---
name: take-task
description: "Run a planned feature on its own, from preflight to one green pull request, deciding small gaps itself and stopping only for decisions that need the owner. Use when the user asks to run or take a feature, task or bug, or agrees to a proposed run; never start a run unprompted."
---

# Take task

The owner plans a feature with the agent, then leaves. This skill runs the
whole feature without them, as the protocol's **Autonomy** describes: one
coordinator carries it through all its stages to one pull request, and each
worker takes one task. It also takes a single bug or task when that is all the
owner asked for; the same rules apply at that size.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. Read
[`protocol.md`](protocol.md), including its setup-version check.

## 1. Find the work and choose its route

Take the feature, stage, task or bug the user named; otherwise propose a ready
feature of the current milestone by name. Find or file the tracked work before
any implementation. Read its requirements, spec, charter and code. Work already
`submitted` resumes at integration and an `implemented` stage at acceptance,
never from scratch.

Everything the owner reads follows the protocol's **Speaking to the owner**.

Size the design by **size, uncertainty and risk**, not by the TDD setting. A
small irreversible change can need more design than a large routine one.

- **Small, understood change:** a short delta through `to-spec`, and one stage
  with only the needed tasks through `to-stages`. Reuse approved criteria.
- **Bug:** the existing requirement plus a regression scenario; change the spec
  only for a gap or an approved behaviour change. Use `diagnose-bug` when the
  cause is unclear. Attach the bug to its stage, or through `to-stages` to a
  minimal one. A small bug needs no full spec.
- **Uncertain or substantial work:** `brainstorming`, then `to-research` or
  `to-prototype` where evidence is needed, then `to-spec` and `to-stages`.
- **Research, setup or docs only:** the matching helper, with no invented
  product requirements. Export a `supporting` change with its scope reason and
  task, under the integration's check policy. This route never hides
  production code or a change to current specs.

If a required helper is not installed, name it and how to install it; never
pretend it ran. Do not quietly grow one task into a whole feature: name what it
needs and settle a real scope change with the owner.

## 2. Preflight, while the owner is here

Before the owner leaves, prepare the run so it needs nobody:

- the feature's spec and its stages exist; later stages may stay coarse, and the
  coordinator breaks them into tasks when it reaches them, within the spec;
- read the spec, the stages and the code the work lands in, and list every
  decision the run will meet: open forks, choices the spec leaves open, the
  assumptions you would otherwise make alone, the risks. Check what you can
  check instead of listing it;
- **how the work runs**, from the execution settings, confirmed for this run:
  inline in this session, subagents of this session, separate worker sessions
  (a terminal multiplexer or similar), or a cloud session, as the harness
  offers. Explain the consequence: inline and subagents stop when this session
  stops, so the owner cannot close it; separate sessions survive while the
  machine runs; a cloud session needs no machine of theirs. With no setting,
  recommend one and ask here;
- which agents and models do which tasks, against each task's risk;
- how long the run will likely take and when the pull request can be expected,
  in agent time with what the estimate rests on (the protocol's **Estimates**:
  the agents' work plus CI and review waits, from this project's history). If that is longer than the project lets a
  branch live, the feature is too big for one run: split it with the owner
  through `to-stages` (and `/to-milestone` if the outcome changes) first;
- how to reach the owner when the run stops, if the harness can notify.

Bring all of it as **one batch**, each item with a recommendation and its
consequence, for the owner to accept whole or change by item. Record the
answers in the feature's decision log. End by saying either "ready to run
alone" or exactly what is missing. Delegated choices cover routine details,
not new scope, spending or weaker acceptance.

## 3. Run the feature

On "run", land the conversation's general plan once and start the feature on
its own branch, named after it, as the protocol's **Sessions and landing**
says; do not wait for the owner to create or rename anything.

Before dispatching implementation, run the integration's feature document check
against the actual baseline; the first product implementation also needs the
product check. Keep existing paths, and limit legacy baselines to the affected
capabilities. Refresh a stale requirement only after reconciling its meaning.

Read execution settings from the gate config and commands from the integration.
The feature has one coordinator on one branch, which owns every stage's
integration and acceptance and may also implement. Claim tasks atomically, or
have the coordinator assign them one at a time if the tracker cannot. Every
claim names the agent that does the work in the protocol's full form (role,
person, machine, branch, session), never the person, and never a bare role.

Take stages in the order their real dependencies allow, several at once where
they are independent. Dispatch independent ready tasks in parallel where
resources allow. Add dependencies only by the protocol's rules, never from list
order, hierarchy or a shared milestone.

Give each worker its task and criterion, the relevant spec, dependencies, base
revision, owned scope, local check commands, the TDD setting and the return
format. A worker's task fits one session; split one that will not. Use
isolated checkouts where concurrent writes could collide, and coordinate
shared generated files, migrations and dependency locks.

Before any worker starts, check which agent and model will actually run it
against the task's risk and the agreed execution settings; a harness may pick
its own default. If it is weaker than the task needs, switch it before
starting; never find out after the worker is already writing.

The coordinator keeps its own context fresh: the run's state lives in the
tracker and the decision log, never only in the conversation. When its context
grows long, it compacts or hands itself over to a fresh coordinator session
through the harness, and continues without the owner.

## 4. Implement with local checks

**TDD:** watch a behaviour check fail for the intended reason, write the least
code that passes it, refactor while it stays green; one slice at a time.
**Test-after:** implement, then add or update the checks before returning.

The spec's seams define acceptance, not a ban on local tests. Test through
stable behaviour at a sensible level; take expected values from the requirement
or an independent example, not from a copy of the algorithm. For operations,
use a safe rehearsal or isolated environment; never cause a live outage to get
a failing check.

Workers run static checks and the tests related to their change, including
neighbouring behaviour it affects, from the narrowest scope outward as the
protocol's **Checks cost** says; a failing test is rerun alone, not with its
suite. The full suite, mutation testing and final
review happen at stage acceptance. A shared change can rightly widen a worker's
related tests.

A worker returns the task, its linked commits, the changed behaviour, check
commands and results, open doubts, decisions it made and integration notes.
Record `submitted` with the result's revision or location and evidence before
releasing the worker's claim. A worker's "done" means ready to integrate, not
accepted.

## 5. Integrate and handle what the spec did not foresee

Merge each result into the feature branch, resolve conflicts and rerun related
checks if merging changed it. Record the merged revision and evidence, then
mark the task `implemented`. Its dependants in this stage can start now;
dependants in other stages wait for that stage's acceptance. Implemented work
never goes back to ready.

- A gap you know how to close: decide, and record the decision and its
  assumptions in the decision log. It goes into the pull request.
- A decision the protocol's **Autonomy** says needs the owner: stop only the
  affected work, send the ready decision it describes, and continue the
  independent rest. Resume when the answer comes, recording it.
- Unrelated bugs, debt and questions go through `to-backlog`. Making this
  feature meet its own criteria is part of the work, not a finding.
- A stubborn failure goes to `diagnose-bug` within the current task.
- A red check, including one that looks older than this work, follows the
  protocol's **A red check is this run's work**: diagnose and fix it; never
  rerun it hoping for green.

## 6. Accept each stage

With a stage's results merged, run the project's full required checks and the
stage's DONE WHEN on the assembled revision. Then run mutation testing on
changed logic within the configured time budget. Investigate survivors that
matter, telling apart equivalent mutations, missing tests and tool failures.
Unsupported tools, timeouts and skipped checks are reported as such, never as
passed. Use the project's agreed fallback; without one, stop as for a decision
that needs the owner.

Get a review following [`review.md`](review.md), preferably from another
model. Fix valid findings within scope and repeat the affected checks. If a fix
changes code after the full run, rerun the full checks on the final revision.
Repeat mutation testing and review where a fix invalidated them; evidence whose
inputs did not change can be reused.

Record the stage's base and final revisions, included tasks, criteria, test and
mutation results, and review findings with what was done about each. For
non-code work, use the project's equivalent evidence and say which checks do
not apply. Get the evidence at the integration's level and run the acceptance
document check. At the protected level, "passed" written by an agent is not a
receipt; at the records level, say that records are trusted. The next stage
builds on an accepted one; the owner is not asked between stages.

## 7. Open the pull request

When every stage is accepted, run the full checks and the feature's end-to-end
criterion once more on the final branch and mark the feature's **one pull
request** ready through the project's authorized workflow; if it was opened
earlier, it was opened as a draft (the protocol's **Draft until ready**). Write its report as the
protocol's **Autonomy** describes: what users can now do, how to check it
yourself, every decision and assumption made alone, departures from the spec,
review findings, what is not done and the risks left. Wait for its checks to go
green; fix a red one as part of the run, back in draft until the fix is proven
locally.

The owner's acceptance is the merge. After it, close the tasks, stages and
feature through `close-out`, and remove the checkouts and branches this run
created. Commit links and a clean backlog are required but
never replace checking the behaviour.
