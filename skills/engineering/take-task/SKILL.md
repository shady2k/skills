---
name: take-task
description: "Run a planned feature on its own, from preflight to one green pull request, deciding small gaps itself and stopping only for decisions that need the owner. Use when the user asks to run or take a feature, task or bug, or agrees to a proposed run; never start a run unprompted."
---

# Take task

The owner plans a feature with the agent, then leaves. This skill runs the
whole feature without them, as the protocol's
[**Autonomy**](references/running.md) describes: one coordinator carries it
through all its stages to one pull request, and each worker takes one task. It also takes a single bug or task when that is all the
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
never from scratch. A run already under way continues under a fresh claim of
the same feature rather than starting over; the run script's `stalled` (below)
shows the runs that left no summary and passed the time their result was
promised for, and one of those on this feature is taken over or ended with
`finish --result stopped`, never left open beside a new one. Where the owner
stopped a session on purpose to test recovery, ask them afterwards for a grade
and record it with `recovery`: R3 continued correctly, R2 recovered but redid
work, R1 needed explanations, R0 did not understand where the work stood.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

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
- **how the work runs**, the execution settings' run mode confirmed for this
  run, with its consequence: inline and subagents stop when this session
  stops, so the owner cannot close it; separate sessions survive while the
  machine runs; a cloud session needs no machine of theirs. With no setting,
  recommend one and ask here. For separate sessions, find the mechanism this
  environment provides for starting them and read its instructions now, by the
  protocol's **A started session answers to the one that started it**; where
  there is none, say so here with the fallback and its consequence;
- which agents and models do which tasks, against each task's risk;
- how long the run will likely take and when the pull request can be expected,
  said as a time the owner can hold it to: past it without word the run has
  stopped, by the protocol's **A run that never came back is found**. Give it
  in agent time, by the protocol's **Estimates**, starting from the measured
  pace: `pace --tasks <n>`, which also proposes the forecast by phase, with
  the absence named below. If that is longer than the project lets a branch
  live, the feature is too big for one run: split it
  with the owner through `to-stages` (and `/to-milestone` if the outcome
  changes) first;
- **when the owner expects to be away, and for how long**, by the protocol's
  **The owner's time is the scarce one**;
- **what the checks will demand at the end**, by the protocol's **What a gate
  will demand is known before the work starts**: run the integration's gate
  against the work as it stands, the document side included; what it asks for
  that the project has never had is work with a cost in this batch, and an
  approval it needs is taken here, by **Autonomy**, put as one sentence of
  what will be true afterwards that is not true now;
- how to reach the owner when the run stops, if the harness can notify.

Bring all of it as **one batch**, each item with a recommendation and its
consequence, for the owner to accept whole or change by item. Record the
answers in the feature's decision log. End by saying either "ready to run
alone" or exactly what is missing. Delegated choices cover routine details,
not new scope, spending or weaker acceptance.

## 3. Run the feature

On "run", land the conversation's general plan once and start the feature on
its own branch, named after it, as the protocol's **Sessions and landing**
says; do not wait for the owner to create or rename anything. Anything he
decided in the conversation that the record does not yet hold lands in that
same first write, before the branch starts, by the protocol's **A decision the
owner gives is kept, not only obeyed**.

**Keep the run's record** in the tracker, by the protocol's [**How the work
went is kept on the item**](protocol.md): the run script,
[`runs.mjs`](runs.mjs), run with `node` from this skill's folder, reads the
adapter's export (`--backlog`) and prints each record to post, under the item
it goes on, in the format of [`time-format.mjs`](time-format.mjs); post it
through the integration's comment operation exactly as printed. The minutes are
measured from the transcripts beside the script ([`ledger.mjs`](ledger.mjs)),
never written by hand. It is how the owner learns whether runs get cheaper,
faster and safer, so write the records as things happen, not from memory at the
end:

- on "run": `claim --item <feature> --role coordinator` with the preflight's
  forecast by phase (`--forecast plan=30,build=120,...`), the absence the owner
  announced (`--away`, or the promised time itself as `--due`) and the numbers
  of tasks and stages, so the time the result was promised for is on record and
  `stalled` holds the run to it. A resumed or fresh coordinator claims the
  feature again, with no forecast;
- every claim of a task is made the same way, by the session that will do the
  work: a worker claims its own leaf with `--role worker`, and its brief says
  so, and its receipt comes with its result. Claiming the next item prints the
  receipt of the last one first;
- every stop: `event --event stop --reason owner` for a decision the owner must
  make, `--reason missing` for information the project did not have; every
  decision made alone: `event --event decision`; every CI run: `event --event
  ci`; each with a one-line note;
- when the pull request is ready or the run ends without one: `finish --item
  <feature> --result ...`, which prints this session's receipt and the feature's
  summary: the forecast against the work by phase, and how long the work
  occupied, parallel sessions counted once. A summary that says it is partial
  had a session whose transcript is on another machine; say so. Put the numbers
  as they are measured; a run that went badly is measured the same as one that
  went well.

Before `finish`, `gaps` names every span of the run that ended with no receipt:
it prints the receipts it can recover from this machine and names those whose
transcripts are elsewhere; post the first, and say the second to the owner.
`--help` lists the commands. The records are for measuring, not reading, and
are never shown to the owner as such. If one cannot be written, the run goes on
and its report says so.

Before dispatching implementation, run the integration's feature document check
against the actual baseline; the first product implementation also needs the
product check. Keep existing paths, and limit legacy baselines to the affected
capabilities. Refresh a stale requirement only after reconciling its meaning.

Read execution settings from the gate config and commands from the integration.
The feature has one coordinator on one branch, which owns every stage's
integration and acceptance and may also implement. Claim tasks atomically, or
have the coordinator assign them one at a time if the tracker cannot. Every
claim names the agent that does the work in the protocol's full form (role,
person, machine, branch, session), never the person, and never a bare role;
the run script's `claim` prints that name with the record.

Take stages in the order their real dependencies allow, several at once where
they are independent. Dispatch independent ready tasks in parallel where
resources allow. Add dependencies only by the protocol's rules, never from list
order, hierarchy or a shared milestone.

Give each worker its task and criterion, the relevant spec, the glossary's
entries for the parts it touches, dependencies, base revision, owned scope,
local check commands, the TDD setting, the commands for its claim and its
receipt (this script's path and the adapter's export), and where its report
goes and what it holds, by **A started session answers to the one that started
it**; record in
the task, as it starts, how to resume it and where its log is. A worker's task fits one session; split one that will not. Use
isolated checkouts where concurrent writes could collide, and coordinate
shared generated files, migrations and dependency locks.

**The brief carries the bar the review will apply**, so the review finds what
a bar cannot catch instead of teaching it one round at a time. Fill it from the
integration and the project's recorded conventions: how errors and logs are
written here, the protocol's building rules the work touches (**A missing input
is an error**, **Same input, same output**, **A test fails when its behaviour
breaks**), and the mutation command for changed files with the time it may
take. A kind of finding the review returns twice in this run goes into every
later worker's brief.

Workers commit by the protocol's **An agent commits only what it wrote**. A
coordinator that dispatches a worker
into its own checkout commits its own changes first, and each later write there
at once.

At dispatch, confirm the agent and model that will actually run each worker
match the agreed execution settings and the task's risk, and switch before it
starts where they do not.

Nothing runs unbounded: every worker, review or long command is bounded and
watched by the protocol's **Silence is not progress**.

Before a leaf is started, and whenever a decision of this run retires what
other open leaves are written against, apply the protocol's **What would make
the work obsolete is read before it is paid for**.

Anything put to the owner mid-run follows the protocol's [**Come with the
material**](references/deciding.md), and a design choice **A design decision
comes with its mechanism**. Once he has decided, the fork is not brought back,
by **A decision given is not reopened by better analysis** and **A message that
changes no next action is not sent**.

Every wait is filled, by **A wait is filled** and **A submitted branch is
frozen**. When the owner writes mid-run, the run goes on and a separate session
takes the conversation, by **The owner's time is the scarce one**. The absence
the preflight recorded, and a coordinator taking the run over mid-flight,
follow **The session opens with the picture**.

The coordinator keeps its own context fresh: the run's state lives in the
tracker and the decision log, never only in the conversation. When its context
grows long, it compacts or hands itself over to a fresh coordinator session
through the harness, and continues without the owner.

## 4. Implement with local checks

**TDD:** watch a behaviour check fail for the intended reason, write the least
code that passes it, refactor while it stays green; one slice at a time.
**Test-after:** implement, then add or update the checks before returning.

The spec's seams define acceptance, not a ban on local tests. Code and tests
are shaped by the protocol's [building rules](references/building.md): **Find
before writing**, **One surface per capability**, **Doubles only at the
boundaries**, **Test data comes from factories**. Test through
stable behaviour at a sensible level; take expected values from the requirement
or an independent example, not from a copy of the algorithm. For operations,
use a safe rehearsal or isolated environment; never cause a live outage to get
a failing check.

Workers run static checks and the tests related to their change, including
neighbouring behaviour it affects, from the narrowest scope outward as the
protocol's [**Cheapest check first**](references/checks.md) says; a failing
test is iterated on alone, not with its suite. Where the project's mutation
tool runs on the changed files within the brief's time, the worker runs it
before reporting and deals with what survives. The full suite, mutation testing
of the stage and final review happen at stage acceptance. A shared change can
rightly widen a worker's related tests.

A worker's report holds the task, its linked commits, the changed behaviour, check
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

Then end the worker session that produced it, by the protocol's **A started
session answers to the one that started it**. Keep its working copy until the
stage is accepted, beside the resume record its task already holds. Work that
comes back goes to a fresh worker given the rework and that log, or to the old
session resumed from its log where the agent can do that.

- A gap you know how to close: decide, and record the decision and its
  assumptions in the decision log. It goes into the pull request.
- A decision the protocol's **Autonomy** says needs the owner: first search
  for the answer the owner may already have given, by **A question is searched for
  before it is asked**, and act on one found; otherwise stop only the
  affected work, send the ready decision it describes, and continue the
  independent rest. Resume when the answer comes, recording it.
- Unrelated bugs, debt and questions go through `to-backlog`; a question for the
  owner that blocks nothing is filed there as a decision they hold, and the
  pull request's report names it by title. Making this
  feature meet its own criteria is part of the work, not a finding.
- A stubborn failure goes to `diagnose-bug` within the current task.
- A red check, including one that looks older than this work, follows the
  protocol's **A red check is this run's work** and **A check is never rerun to
  find out why it failed**. Its repair rides with this work by **A repair the
  merge waits on is not intake**, and a gate that refuses the commit carrying it
  is read by **A gate that refuses is not routed around**.

## 6. Accept each stage

With a stage's results merged, run the project's full required checks and the
stage's DONE WHEN on the assembled revision, here, through the integration's
full-check command. Acceptance starts no CI: the pull request stays in progress
until step 7, and fixes merged after a review stay there too (the protocol's
**Know what a push starts, and push once**). Where the stage carries the spec's
place of observation, walk the happy path there yourself the way a person
reaches it, and record what you saw; a walk you could not make is recorded as
not made. Then run mutation testing on changed logic within the configured
time budget. Investigate survivors that matter, telling apart equivalent mutations, missing tests and tool failures.
Unsupported tools, timeouts and skipped checks are reported as such, never as
passed. Use the project's agreed fallback; without one, stop as for a decision
that needs the owner.

Check that the agent doc, the glossary, the current specs and the architecture
still describe the assembled revision, by the protocol's **What describes the
present is kept true**; what this stage made false is updated in it. Get a
review following [`review.md`](review.md), preferably from another model. Fix valid findings within scope and repeat the affected checks. If a fix
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
criterion once more on the final branch, and walk the feature's happy path once
more at the place the spec named: behaviour nothing reaches is not done, however
green the checks (the protocol's **Reached, not just built**). Then bring the
feature's **one pull request** to review through the project's authorized
workflow, starting its CI once in the way this repository's CI allows (the
protocol's **Know what a push starts, and push once**). Move the coordinator's
own checkout off that branch as soon as the run is submitted, by the protocol's
**A submitted branch is frozen**. Write its report as the protocol's
**Autonomy** describes: what users can now do, how to check it yourself as the
few steps of the walk you made, every decision and assumption made alone,
departures from the spec, review findings, what is not done and the risks left.
Wait for its checks to go green; fix a red one as part of the run, back in
progress until the fix is proven locally, by the protocol's **CI is not where
failures are diagnosed**.

Finish the run's record with the pull request. The owner's acceptance is the
merge. After it, close the tasks, stages and feature through `close-out`, which
also asks the owner how the run went, and remove the checkouts and branches this
run created. A run that stops or hands over settles its worker sessions by **A
started session answers to the one that started it**. Commit links and a clean
backlog are required but never replace checking the behaviour.