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
never from scratch. A run already under way continues its record in the run
journal (`node runs.mjs list`) rather than starting a new one; `stalled` shows
the runs that recorded no end and which passed their forecast, and one of those
on this feature is taken over or ended with `finish --result stopped` before a
new record is started, never left open beside it. When the owner
is testing recovery (they stopped a session on purpose and ask this one to
continue), ask them afterwards for a grade and record it with `recovery`:
R3 continued correctly, R2 recovered but redid work, R1 needed explanations,
R0 did not understand where the work stood.

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
  said as a time the owner can hold it to: past it without word the run has
  stopped, by the protocol's **A run that never came back is found**. Give it
  in agent time, with what the estimate rests on (the protocol's **Estimates**:
  the agents' work plus CI and review waits). Start from the measured pace:
  `node runs.mjs pace --tasks <n>`, run from this skill's folder, gives the
  range of **work** similar runs took here, the range of clock they ran over,
  and how far past estimates were off; quote the work range and correct your
  estimate by it. The two ranges differ because the clock holds the hours the
  owner was away, which no estimate is a forecast of; promise the result by
  the clock and size the work by the work. The journal is this machine's; where it says
  there is too little history, read the `Run measured` comments on features
  closed before, through the integration's comment operation, and estimate from
  those. Only with neither, say the number is a guess. If that is longer than
  the project lets a branch live, the feature is too big for one run: split it
  with the owner through `to-stages` (and `/to-milestone` if the outcome
  changes) first;
- **when the owner expects to be away, and for how long**, so execution falls
  into that window and what needs them is settled before it: every decision in
  this batch, and anything worth their presence offered now rather than while
  they wait, by the protocol's **The owner's time is the scarce one**;
- **what the checks will demand at the end, established now and not at the
  push**: run the integration's gate against the work as it stands and read
  what a refusal would ask for, the document side included. Where it wants
  something this project has never had — a first capability document, a record
  never written here, an approval only the owner can give — that is work with a
  cost, and it belongs in this batch. An approval is **taken** here, not merely
  foreseen: he decides the change's kind, its scope, the requirements it moves
  and what it promises to leave alone, in one sentence of what will be true
  afterwards that is not true now, and the record binds itself to that. Carrying
  it to the end instead guarantees stopping him after he has gone. A demand met
  at the push is met with no slack left, which is where the cheap way out starts
  to look reasonable;
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
decided in the conversation that the record does not yet hold — a condition on
other work, a refusal, a constraint — lands in that same first write, before
the branch starts, by the protocol's **A decision the owner gives is kept, not
only obeyed**. It is not carried along to be written when the run gets to it.

**Keep the run's record** in the run journal, [`runs.mjs`](runs.mjs), which
writes outside the repository. The minutes themselves are not written by hand:
the record keeps the forecast, the stops and the verdict, and the ledger
([`ledger.mjs`](ledger.mjs), beside it) reads back what the harness measured —
the model's minutes, the tools', what the owner answered, what a run cost and
how many lines it wrote, including the workers' own working copies. It is how
the owner learns whether runs get cheaper, faster and safer, so write the
record as things happen, not from memory at the end:

- on "run": `start` with the feature's title, the preflight's estimate as work
  and wait minutes, and the numbers of tasks and stages;
- every session that coordinates the run, a fresh coordinator or a resumed
  run: `session`; the current one is recorded by itself where the harness
  names it;
- every stop: `event --kind stop --reason owner` for a decision the owner
  must make, `--reason missing` for information the project did not have;
  every decision made alone: `event --kind decision`; every CI run:
  `event --kind ci`; each with a one-line note;
- when the pull request is ready or the run ends without one: `finish`, and
  then `summary`, whose numbers go on the feature in the tracker as a comment
  headed `Run measured`, written in the project's artifact language. That
  comment is the only part of the journal another machine, session or agent can
  read, and what a later estimate rests on when this machine's records are not
  there. Put the numbers as they are measured; a run that went badly is
  measured the same as one that went well.

Run it with `node` from this skill's folder; `--help` lists the commands. The
record is for measuring, not reading, and is never shown to the owner as such.
If it cannot be written, the run goes on and its report says so.

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

Nothing runs unbounded. Every worker, review or long command starts with a hard
timeout and writes where its progress can be seen as it goes, never through a
pipe that holds the output to the end. Confirm it actually started before
turning to other work, and when it passes the time that work took before, run
the cheap liveness check instead of waiting on, as the protocol's **Silence is
not progress** says. The timeout is the estimate for that work, not a round
number large enough never to trip: an overrun is stopped and diagnosed, never
restarted or given more time, and what caused it is filed. Keep what the
checks, builds and workers took; a step that got much slower is a finding even
when it passes, by **The bound is the forecast**.

Before a leaf is started, its result is checked against the decisions taken
since it was filed, by the protocol's **Ready is not worth doing**: a fix that
lands in code already scheduled for replacement is paid for twice. Where a
decision of this run retires what other open leaves are written against, they
are settled with it and not left ready.

Once the owner has decided, the run does not bring the same fork back in new
clothes: sharper detail about a settled question is recorded with the work, by
the protocol's **A decision given is not reopened by better analysis** and **A
message that changes no next action is not sent**.

Anything put to the owner mid-run is worked first: the cause found, the options
costed, a recommendation and what happens if the answer comes later, never a
question they must wait behind, by the protocol's **Come with the material**.
Where the choice is about the design, it carries how the thing works today in
the project's own names, the measurement of what fails and the assumption the
options rest on, by the protocol's **A design decision comes with its
mechanism** — a menu whose frame is invisible costs a round per message.

A wait is filled: while a review, a worker or a long check runs, take the next
independent task, write the pull request's text, or run what does not depend on
the answer. None of it lands on what is being waited for: a branch whose checks
are running takes nothing but their fixes (the protocol's **A submitted branch
is frozen**). When the owner writes while the run is going, do not stop it and do
not answer with the coordinator's own hands: open a separate session for that
conversation, in its own checkout where it could touch files, and let it hand
back what it settled — the decision and its reason, the task it filed, the plan
it agreed — to the coordinator and to the tracker.

The absence the preflight recorded is worked against: while the owner is away
until the time they named, decide what this run knows how to decide and record
it, and hold only what the class above reserves for them, by the protocol's
**The session opens with the picture**. A coordinator that takes the run over
mid-flight starts from what the work left behind — the tracker, the branches
and their checks, the holds, the workers' logs — before it asks a working agent
anything.

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
protocol's **Cheapest check first** says; a failing test is iterated on alone,
not with its suite. The full suite, mutation testing and final
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

Then end the worker session that produced it: an idle agent keeps its process
and memory for as long as it is left open, and nothing else ends it. Keep its
working copy until the stage is accepted, and record in the task where its log
is. Work that comes back goes to a fresh worker given the rework and that log,
or to the old session resumed from its log where the agent can do that, never
to a session kept running in case. A worker that failed or stopped for a
decision stays open until that is settled: its screen is the only record of
what it ran.

- A gap you know how to close: decide, and record the decision and its
  assumptions in the decision log. It goes into the pull request.
- A decision the protocol's **Autonomy** says needs the owner: stop only the
  affected work, send the ready decision it describes, and continue the
  independent rest. Resume when the answer comes, recording it.
- Unrelated bugs, debt and questions go through `to-backlog`. Making this
  feature meet its own criteria is part of the work, not a finding.
- A stubborn failure goes to `diagnose-bug` within the current task.
- A red check, including one that looks older than this work, follows the
  protocol's **A red check is this run's work**: read the assertion and the
  code behind each value it asserts on, then fix it. Never rerun it — not for
  green, not to show the change innocent, not because the failure already has
  a number in the tracker. The repair that makes it green rides with this work
  and spends no finding budget (**A repair the merge waits on is not intake**);
  a finding is only what you leave unfixed. If the gate refuses the commit that
  carries the repair, read what it asks for: the count is never made to fit by
  deferring the repair, whatever the refusal's own remedy line suggests.

## 6. Accept each stage

With a stage's results merged, run the project's full required checks and the
stage's DONE WHEN on the assembled revision. Where the stage carries the spec's
place of observation, walk the happy path there yourself the way a person
reaches it, and record what you saw; a walk you could not make is recorded as
not made. Then run mutation testing on changed logic within the configured
time budget. Investigate survivors that matter, telling apart equivalent mutations, missing tests and tool failures.
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
criterion once more on the final branch, and walk the feature's happy path once
more at the place the spec named: behaviour nothing reaches is not done,
however green the checks (the protocol's **Reached, not just built**). Then
bring the feature's **one pull request** to review through the project's
authorized workflow, starting its CI once in the way this repository's CI
allows (the protocol's **Know what a push starts**). Move the coordinator's own
checkout off that branch as soon as the run is submitted, so that the tracker
records, plans and documents the wait produces cannot land on it and restart
every job (the protocol's **A submitted branch is frozen**). They go on the
session's landing branch and wait there for one merge at the end, never a
request apiece. Write its report as the
protocol's **Autonomy** describes: what users can now do, how to check it
yourself as the few steps of the walk you made, every decision and assumption
made alone, departures from the spec,
review findings, what is not done and the risks left. Wait for its checks to go
green; fix a red one as part of the run, back in progress until the fix is
proven locally.

Finish the run's record with the pull request. The owner's acceptance is the
merge. After it, close the tasks, stages and feature through `close-out`, which
also asks the owner how the run went, and remove the checkouts and branches
this run created. A run that stops or hands over ends every worker session it
started that is not working now, and names the ones still running. Commit links and a clean backlog are required but
never replace checking the behaviour.
