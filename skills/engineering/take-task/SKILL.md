---
name: take-task
description: "Run a planned feature on its own, from preflight to one green pull request, deciding small gaps itself and stopping only for decisions that need the owner. Use when the user asks to run or take a feature, task or bug, or agrees to a proposed run; never start a run unprompted."
---

# Take task

The owner plans a feature with the agent, then leaves. This skill runs the
whole feature without them, as the protocol's
[**Autonomy**](references/running.md) describes: one coordinator carries it
through all its stages to one pull request, and each worker takes one task. It also takes a single bug or task when that is all the
owner asked for; the same rules apply at that size. Where this session hands
the run to a coordinator in another session and stays with the owner, it keeps
the owner's side by the protocol's **Whoever started a run answers for it to
the owner**, and the rest of this skill is that coordinator's.

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
never from scratch. Before an item is offered to a worker, read the main line's
history for a commit naming it, by the protocol's **Remaining work is counted
from what landed**: a commit there means its work is landed and the item is
merely unclosed, so it is closed rather than taken a second time — through
`close-out` where it has a stage, and by the protocol's **A leaf with no stage
closes at its merge** where it has none. A run already under way continues under a fresh claim of
the same feature rather than starting over; the run script's `stalled` (below)
shows the runs that left no summary and passed the time their result was
promised for, and one of those on this feature is taken over or ended with
`finish --item <feature> --result stopped`, never left open beside a new one. Where the owner
stopped a session on purpose to test recovery, ask them afterwards for a grade
and record it with `recovery`: R3 continued correctly, R2 recovered but redid
work, R1 needed explanations, R0 did not understand where the work stood.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

- **Trivial, reversible and understood** — a colour, a text, a constant: the
  change plus its check, and the life cycle's [**The shortest path is the
  default**](references/lifecycle.md): no spec, no stages, no design; the
  task's line and the commit are the whole record, and the preflight asks
  only what a run of that size still owes. Whether the change is one of those is
  decided by the life cycle's [**Depth is read off the change, not off the
  author's word**](references/lifecycle.md); where the reading is arguable,
  the deeper route is taken and the preflight says which and why.

Size the work by the protocol's
[life cycle](references/lifecycle.md), its [**Tailoring is the
rule**](references/lifecycle.md): which stages it passes — design included —
is chosen by size, uncertainty and risk and by what the project is, and each
skipped or narrowed stage is said with its reason, not silently left out. A
small irreversible change can need more design than a large routine one. The
route's depth is the life cycle's [**Depth is read off the change, not off the
author's word**](references/lifecycle.md), and the route the run takes is on
the preflight's list, so the owner accepts it with the rest or changes it by
name.

- **Small, understood change:** a short delta through `to-spec`, and one stage
  with only the needed tasks through `to-stages`. Reuse approved criteria.
- **Bug:** the existing requirement plus a regression scenario; change the spec
  only for a gap or an approved behaviour change. Use `diagnose-bug` when the
  cause is unclear. Attach the bug to its stage, or through `to-stages` to a
  minimal one; one that serves no stage of any feature stands where `to-backlog`
  filed it and needs neither, by the protocol's **A leaf with no stage closes at
  its merge**. A small bug needs no full spec.
- **Uncertain or substantial work:** `brainstorming`, then `to-research` or
  `to-prototype` where evidence is needed, then `to-spec`; where the change
  introduces or changes a building block, an interface, ownership of state,
  a runtime interaction, an external dependency or an interface surface,
  `to-design` before `to-stages`, by
  [`references/design.md`](references/design.md)'s **Design runs when the
  shape changes**.
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
  coordinator breaks them into tasks when it reaches them, within the spec.
  On the shortest path above, the task's line is both, and this step asks
  only what a run that size still owes: the frame's one line, the branch,
  the checks, the estimate;
- **the outcome frame exists**, by the protocol's
  [**The outcome frame comes before the work is specified**](references/lifecycle.md):
  for whom and why, what matters most, the main path, the success signal.
  A missing or inferred frame comes first, as one summary the owner accepts
  whole or corrects by part: the frame as found or inferred, and one
  recommendation per missing part — an autonomous run otherwise optimises an
  outcome nobody stated. A frame the spec or the issue already holds is named,
  not asked again;
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
- **whether the feature serves a date the owner set from outside the run**
  — a demo, a release, someone outside the project who waits. One question
  among them, and none is invented where the owner has none, by **A question
  is searched for before it is asked**; where there is one, it is recorded on
  the feature item, not only in conversation, with who set it and why, by the
  protocol's **A decision the owner gives is kept, not only obeyed** — not
  into the ledger's `--due`, which keeps the promised time of the run itself
  (below) — and the forecast is checked
  against it here, before the owner leaves. A target date stands beside the
  forecast record the run script computes over the exact task set covering
  the outcomes it serves (`unforecast-target`); with too little history the
  record says so and the date stands with that warning
  (`unmeasured-forecast`). Where the forecast passes it,
  these questions lead with what will be late, why, and the two levers, by the
  protocol's **A forecast is checked against the date it serves**;
- how long the run will likely take and when the pull request can be expected,
  said as a time the owner can hold it to: past it without word the run has
  stopped, by the protocol's **A run that never came back is found**. That
  time is also the supervising session's deadline, by the protocol's
  **Whoever started a run answers for it to the owner**. Give it
  in agent time, by the protocol's **Estimates** and **A time told to the owner
  is measured, and a dispute is answered with its basis**, starting from the
  measured pace: `pace --tasks <n>`, which also proposes the forecast by phase,
  with the absence named below. The clock past runs lasted, which it prints
  apart, is no forecast. If that is longer than the project lets a branch
  live, the feature is too big for one run: split it
  with the owner through `to-stages` (and `/to-milestone` if the outcome
  changes) first;
- **when the owner expects to be away, and for how long**, by the protocol's
  **The owner's time is the scarce one**;
- **what the checks will demand at the end**, by the protocol's **What a gate
  will demand is known before the work starts**: run the integration's gate
  against the work as it stands, the document side included; what it asks for
  that the project has never had is work with a cost among them, and an
  approval it needs is taken here, by **Autonomy**, put as one sentence of
  what will be true afterwards that is not true now;
- how to reach the owner when the run stops: the notification channel the
  project records for pushes, if any, naming it as setup proved it; and the
  **cadence** of the pushed progress digest while the run is in flight — the
  recommendation is once at the end of their working day, and they may pick
  another or none. The report itself is pushed at each point that changes the
  picture, not on each passing step, by the protocol's **Waiting is quiet**;

Everything above is settled before the owner leaves: the decisions are
gathered now and put now, so none is found waiting after they are gone. How
the open questions among them are put is the project's setting, by the
protocol's [**How an open question is put**](references/speaking.md); each comes
with a recommendation and its consequence, and every one is put before the owner
leaves. What is not a question is said once, in the message that carries it: the
frame found and named, the estimate and what it rests on, what the checks will
demand, the channel and the cadence. Every item comes as the agent's own position argued,
by the protocol's
[**A choice is met with a position and an argument**](references/deciding.md),
and any mechanism it proposes stands on the state of the practice, by the
protocol's
[**A proposal starts from the state of the practice**](references/deciding.md).
The first message opens with what the feature gives users and where it stands,
by the protocol's **Written for someone who was not there**: the owner may have
agreed to the run hours ago and read none of what preflight found. Record the
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

**Where the project agreed to Jev, it is in your tools**: `jev`, by the
protocol's [**Jev is a tool the agent sees, not a rule it must
recall**](references/judging.md), listed by name only where the harness defers
tools, and then loaded, not replaced; where it lists no such tool at all, run
[`jev.mjs`](jev.mjs) `status` once at the start instead. A run is where piles
arise, and a coordinator that does not use Jev reads every pile itself. Apply
the protocol's [**The agent decides where Jev helps**](references/judging.md)
every time you are about to read many items or a long text to answer one
question of each; the steps below name where a run meets that most. Where it
says Jev is unavailable, read for yourself and say nothing.

**Keep the run's record** in the tracker, by the protocol's [**How the work
went is kept on the item**](protocol.md): the run script,
[`runs.mjs`](runs.mjs), run with `node` from this skill's folder, reads the
adapter's export (`--backlog`) and prints each record to post, under the item
it goes on, in the format of [`time-format.mjs`](time-format.mjs); post it
through the integration's comment operation exactly as printed. The minutes are
measured from the transcripts beside the script ([`ledger.mjs`](ledger.mjs)),
never written by hand. Where the project agreed to Jev, give the script the gate config
(`--config`): a session whose working copy is gone and whose transcript never
names the item its record is on is then put to Jev, and placed only on a sure
yes, by the protocol's [**Its answer is taken only where it is
sure**](references/judging.md); the ones it is unsure of are named, and you
read those yourself. Without it the transcript naming the item decides alone.
It is how the owner learns whether runs get cheaper,
faster and safer, so write the records as things happen, not from memory at the
end:

- on "run": `claim --item <feature> --role coordinator` with the preflight's
  forecast by phase (`--forecast plan=30,build=120,...`), the absence the owner
  announced (`--away`, or the promised time itself as `--due`) and the numbers
  of tasks and stages, so the time the result was promised for is on record and
  `stalled` holds the run to it. A resumed or fresh coordinator claims the
  feature again, with no forecast;
- the coordinator's claim on the feature covers what its workers hand in, by
  the protocol's **A run's time is its coordinator's clock**. A worker that
  runs the set in a session of its own claims its own leaf with `--role
  worker`, and its brief says so, and its receipt comes with its result: that
  adds its effort by phase. A worker running in its coordinator's session (an
  in-process subagent, which some harnesses give their parent's session id)
  records nothing: its effort is inside the coordinator's span, and a
  `claim --role worker` from that session is refused rather than ending the
  coordinator's span. A worker that does not record (another harness, a bare
  agent in a pane) records nothing either, and nothing is recovered for it.
  Claiming the next item prints the receipt of the last one first;
- every stop: `event --event stop --reason owner` for a decision the owner must
  make, `--reason missing` for information the project did not have; every
  decision made alone: `event --event decision`; every CI run: `event --event
  ci`; each with a one-line note. A stage or feature keeps these records: its
  acceptance is judged from them. A small task does not: its one acceptance
  record names its CI run and its review, and what CI and the review already
  hold is read from them, never retyped as records — the records a task needs
  are proportionate to it;
- when the pull request is ready or the run ends without one: `finish --item
  <feature> --result ...`, which prints this session's receipt and the feature's
  summary: the forecast against the work by phase, and how long the work
  occupied, parallel sessions counted once. A summary that says it is partial
  had a session whose transcript is on another machine; say so. Put the numbers
  as they are measured; a run that went badly is measured the same as one that
  went well.

The records ride with the task's own landing: they are posted as comments on
the items the work lands with, and never as a commit of their own. Where the
store is off the branches there is nothing of a record for a branch to carry,
and where a project keeps the store in its branches the commit check refuses a
commit that carries only records, by the protocol's **How the work went is kept
on the item**.

Before `finish`, `gaps` names every span of the run that ended with no receipt:
it prints the receipts it can recover from this machine and names those whose
transcripts are elsewhere; post the first, and say the second to the owner.
Where no machine has a transcript (a machine wiped, a harness that keeps
none), close its span with `receipt --unknown` and the reason in its note, and
say so: the time stays unknown, never guessed. Where it is a worker's, it
leaves the run whole. A task handed in outside any claimed run gets `claim
--recovered`, dated by its transcript, or where there is none by the record
that shows when it was handed over (`--basis`).
`--help` lists the commands. The records are for measuring, not reading, and
are never shown to the owner as such. If one cannot be written, the run goes on
and its report says so.

Before dispatching implementation, run the integration's feature document check
against the actual baseline; the first product implementation also needs the
product check. Keep existing paths, and limit legacy baselines to the affected
capabilities. Refresh a stale requirement only after reconciling its meaning.

Read execution settings from the gate config and commands from the integration.
The feature has one coordinator on one branch, which owns every stage's
integration and acceptance and may also implement. A claim counts only once it
is on the remote,
by the protocol's **The tracker stays in step across machines**: fetch, merge,
write, push. Where the remote already holds another holder, the write is
dropped, said out loud, and the session re-reads and takes other work, rather
than reporting a claim that never landed. Claim tasks atomically, or
have the coordinator assign them one at a time if the tracker cannot. Every
claim names the agent that does the work in the protocol's full form (role,
person, machine, branch, session), never the person, and never a bare role;
the run script's `claim` prints that name with the record.

Take stages in the order their real dependencies allow, several at once where
they are independent. Two pieces of work that share no file and no dependency
start at once, by the protocol's **Parallelism**; serialising them is a reason
said to the owner when it happens — a shared file, a dependency, a budget that
holds only so many workers. Add dependencies only by the protocol's rules, never
from list order, hierarchy or a shared milestone.

Give each worker its task and criterion, the relevant spec, the glossary's
entries for the parts it touches, dependencies, base revision, owned scope,
local check commands, the TDD setting, the commands for its claim and its
receipt (this script's path and the adapter's export), and where its report
goes and what it holds. Every brief carries the output of the purpose
command for its task, so the vision items it serves, whom it serves and
where it is seen travel with the work, by **A started session answers to the one that started
it**; record in
the task, as it starts, how to resume it and where its log is. A worker's task fits one session; split one that will not. Use
isolated checkouts where concurrent writes could collide, and coordinate
shared generated files, migrations and dependency locks.

**The brief carries the bar the review will apply**, so the review finds what
a bar cannot catch instead of teaching it one round at a time. Fill it from the
integration and the project's recorded conventions: how errors and logs are
written here, the protocol's building rules the work touches (**A missing input
is an error**, **Same input, same output**, **A test fails when its behaviour
breaks**, whose strength the stage's mutation run will judge). A kind of
finding the review returns twice in this run goes into every later worker's
brief.

**Where the project agreed to Jev, the brief carries it too**: a worker that
does not run the set learns of it nowhere else, and the batches it is good at
(which search hits are real call sites, which failures share a cause, a long
test or bench log) arise mostly in a worker's task. Name the `jev` tool,
which a worker whose harness has the set installed sees in its list (by name
only where tools are deferred: say to load it, not to fall back), and for
one that does not, the command whole: [`jev.mjs`](jev.mjs) by its absolute
path in this skill's folder, `status` once before the first `ask`. Say that
the pile goes by name: the search or the run writes to a file, and the file
is what Jev gets. Then, in the brief's own words,
the protocol's [**The agent decides where Jev helps**](references/judging.md):
what Jev is (a few questions asked of each item or of one long text, yes or
no, one of the answers or a place on a scale, answered from lists given in
advance), the four conditions under which it pays, its test before reading a
pile, and the worker's moments of that shape in this task (the search before
a change, a failing suite, a long log), never a single call. Add **Its answer
is taken only where it is sure** and **Nothing hard to reverse rests on Jev's
word alone**. Where Jev is unavailable, the worker reads for itself and does not
report it.

The commit check binds this (`code-before-understanding`): a hand-written brief
is no substitute for an admitted record, because the record's own fields are
what the gate reads at the commit.

Workers commit by the protocol's **An agent commits only what it wrote**. A
coordinator that dispatches a worker
into its own checkout commits its own changes first, and each later write there
at once.

At dispatch, confirm the agent and model that will actually run each worker
match the agreed execution settings and the task's risk, and switch before it
starts where they do not.

Nothing runs unbounded: every worker, review or long command is bounded and
watched by the protocol's **Silence is not progress**. Long commands — tests,
checks and builds — run through the run journal's runner `runs.mjs exec`, which
keeps, in its own journal beside the time records, the durations it recorded
for every command it has run: from them it takes the command's bound, and back
there it records the duration with its result, so the bound is the command's
own history and nothing the agent remembers; a long command run outside `exec`
is missing its bound. Where nothing is recorded yet, the first run runs under
the default the runner carries, or the estimate named with `--first` before it
runs, by the protocol's **Estimates**.

Before a leaf is started, and whenever a decision of this run retires what
other open leaves are written against, apply the protocol's **What would make
the work obsolete is read before it is paid for**.

Anything put to the owner mid-run follows the protocol's [**Come with the
material**](references/deciding.md), and a design choice **A design decision
comes with its mechanism**. Once he has decided, the fork is not brought back,
by **A decision given is not reopened by better analysis** and **A message that
changes no next action is not sent**.

Every wait is filled, by **A wait is filled** and **A submitted branch is
frozen**. What the run's own process costs — the records, the rounds of review,
a worker idle, a command waited on — is said to the owner unasked, in their
terms and with a counted figure, by the protocol's **A cost of the process is
the owner's information**. When the owner writes mid-run, the run goes on and a
separate session takes the conversation, by **The owner's time is the scarce one**. The absence
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
Reaching green is the code's work and never the check's, by the protocol's
[**A check changes only with the requirement it
encodes**](references/checks.md).

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
test is iterated on alone, not with its suite. The full suite, the stage's
mutation run and the final review happen at stage acceptance. A shared change can
rightly widen a worker's related tests.

A worker's report holds the task, its linked commits, the changed behaviour, check
commands and results, open doubts, decisions it made and integration notes.
Record `submitted` with the result's revision or location and evidence before
releasing the worker's claim. A worker's "done" means ready to integrate, not
accepted. On a task taken alone, that evidence is its whole acceptance record:
name the CI run and the review in it, and what each of them holds is read from
them rather than retyped, by the protocol's **How the work went is kept on the
item**.

## 5. Integrate and handle what the spec did not foresee

Merge each result into the feature branch, resolve conflicts and rerun the
checks whose inputs merging changed, by the protocol's **A passing result holds
while what it covers is unchanged**. Record the merged revision and evidence, then
mark the task `implemented`. Its dependants in this stage can start now;
dependants in other stages wait for that stage's acceptance. Implemented work
never goes back to ready.

Then end the worker session that produced it, by the protocol's **A started
session answers to the one that started it**, and remove that worker's
checkout and its branch once the protocol's **A run removes the checkouts and
branches it created** permits it: here, at integration, so that a worker's
checkout does not outlive the result it produced. Work that comes back goes to
a fresh worker given the rework and that log, or to the old session resumed
from its log where the agent can do that.

- A gap you know how to close: decide, and record the decision and its
  assumptions in the decision log. It goes into the pull request.
- A decision the protocol's **Autonomy** says needs the owner: first search
  for the answer the owner may already have given, by **A question is searched for
  before it is asked**, and act on one found; otherwise stop only the
  affected work, send the ready decision it describes, and continue the
  independent rest. Resume when the answer comes, recording it. Where a
  worker's question is relayed by this session, it is worked first — the
  record and the code are read, the claims checked — by speaking.md's
  **A run's question is worked before it is passed on**; a question that
  arrives without its material is this session's homework, not the owner's.
- Unrelated bugs, debt and questions go through `to-backlog`; a question for the
  owner that blocks nothing is filed there as a decision they hold, and the
  pull request's report names it by title. Making this
  feature meet its own criteria is part of the work, not a finding.
- A stubborn failure goes to `diagnose-bug` within the current task. Where
  several checks fail after a merge, or the workers' reports hold more doubts
  and notes than you would read at once, sorting them by cause or by whether
  they touch this stage is Jev's shape, by **The agent decides where Jev
  helps**.
- A red check, including one that looks older than this work, follows the
  protocol's **A red check is this run's work** and **A check is never rerun to
  find out why it failed**. Its repair rides with this work by **A repair the
  merge waits on is not intake**, and a gate that refuses the commit carrying it
  is read by **A gate that refuses is not routed around**; where the gate itself
  demands what the work does not owe, it is the code under diagnosis, by **The
  gate is the project's code, and an agent wrote it**.
- An action the harness or a guard blocks — a command it refuses, a file it
  will not read, a write it will not let through — follows the protocol's
  **A blocked action is not handed over**.

## 6. Accept each stage

With a stage's results merged, run the project's full required checks and the
stage's DONE WHEN on the assembled revision, here, through the integration's
full-check command. Acceptance starts no CI: the pull request stays in progress
until step 7, and fixes merged after a review stay there too (the protocol's
**Know what a push starts, and push once**). Acceptance is a stage boundary:
the time by phase is read against the forecast the run claimed, and the
forecast is checked against the target date again, by the protocol's **A
forecast is checked against the date it serves**. Where the stage carries the spec's
place of observation, walk the happy path there yourself the way a person
reaches it, and record what you saw; a walk you could not make is recorded as
not made. Where the stage's result follows a reference, acceptance's
evidence is the comparison deciding.md's [**A claim reaches only as far as
its evidence**](references/deciding.md) asks for, at the breadth checks.md's
[**Reached, not just built**](references/checks.md) sets. Mutation testing on the stage's changed logic starts once, here, as soon as
the revision is assembled, and runs beside the walk and the review, off the
run's path: it measures how strong the tests are, not whether the change is
right, and no next step consumes its result, so nothing waits on it, by
**The path is what the next step consumes** — a worker reports without it
(step 4), and acceptance never holds the stage for it. A surviving mutant in changed logic
that is not an equivalent mutation is a missing test, filed as a task by this
run; where the logic a mutant survived in is high-risk (loss of data, access,
money), that task is taken first in this feature, before it closes, without
blocking landing. Many survivors, a long log of the full checks, or a review's
many findings (which are real, which repeat one already handled) are piles of
Jev's shape by **The agent decides where Jev helps**, and you read what it
leaves unsettled. Unsupported tools, timeouts and a run that did not finish
are reported as such, never as passed, and hold nothing up: the project's
agreed fallback is used where it exists, and where it does not, the gap in how
strong the tests have been proven to be is a finding filed against the
project's checks.

Check that the agent doc, the glossary, the current specs and the architecture
still describe the assembled revision, by the protocol's **What describes the
present is kept true**; what this stage made false is updated in it. Get a
review following [`review.md`](review.md), preferably from a reviewer on another
model the set can reach from here ([`agents.md`](references/agents.md)); the
review answers "matches the design: yes/no, divergences"
(`design-divergence`). The rounds converge by **One review, then approval with comments** — one full
review, then targeted verification under that rule, the rest held by the checks. Fix valid findings within scope and repeat the affected checks. If
a fix changes code after the full run, rerun the full checks on the final
revision. Review is repeated where a fix invalidated it. A later fix reuses
the mutation result by **A passing result holds while what it covers is
unchanged**: only a fix that changed the logic itself invalidates it, and
touching other code reruns nothing.

Record the stage's base and final revisions, included tasks, criteria, test and
mutation results, and review findings with what was done about each. For
non-code work, use the project's equivalent evidence and say which checks do
not apply. Get the evidence at the integration's level and run the acceptance
document check. At the protected level, "passed" written by an agent is not a
receipt; at the records level, say that records are trusted. The next stage
builds on an accepted one; the owner is not asked between stages. Accepting a
stage does not close it: the stage and its tasks stay open and accepted, and
dependants in the next stage are claimed through the integration's claim
operation as the protocol's **Ready** allows; they close through `close-out`
after the merge.

## 7. Open the pull request

When every stage is accepted, run the full checks and the feature's end-to-end
criterion once more on the final branch, and walk the feature's happy path once
more at the place the spec named: behaviour nothing reaches is not done, however
green the checks (the protocol's **Reached, not just built**). Run the
present-documents check against the merge base, by the protocol's **What
describes the present is kept true**: fix every path this branch left dead in
the documents, read each document it names to read against the code, and file
the older drift it lists through `to-backlog` as one debt item, unless one is
already open. Then bring the
feature's **one pull request** to review through the project's authorized
workflow, starting its CI once in the way this repository's CI allows (the
protocol's **Know what a push starts, and push once**). A stopped or resumed
run reads the branch, the pull request and the CI run from the forge before it
pushes or opens anything, by the protocol's **An effect outside this checkout
is asked of the system that took it**. Move the coordinator's
own checkout off that branch as soon as the run is submitted, by the protocol's
**A submitted branch is frozen**. Write its report as the protocol's
**Autonomy** describes: what users can now do, how to check it yourself as the
few steps of the walk you made, every decision and assumption made alone,
departures from the spec, review findings, what is not done, the checkouts and
branches this run created and left, each with why, and the risks left.
The yes waits for the owner's own look, by the
protocol's [**Autonomy**](references/running.md). Wait for its checks to go green, reading its state by the protocol's **A state
not yet known is not a good one**; fix a red one as part of the run, back in
progress until the fix is proven locally, by the protocol's **CI is not where
failures are diagnosed**. Review comments on it are handled by **A reviewer's
comment is judged, not obeyed**.

Finish the run's record with the pull request. The owner's acceptance is the
merge. A leaf with no stage is closed in the step that reads that merge, on it
and on the checks it ran, by the protocol's **A leaf with no stage closes at its
merge**: it has no acceptance of its own to wait for, so `close-out` must not
find it open afterwards. After it, close the tasks, stages and feature through
`close-out`, which also reads the run's own record and files what it teaches,
and remove the checkouts and branches this run created. Where the change reaches its users later than the merge — the
project deploys or publishes — the run ends by naming `ship-release` as the
next stage, the life cycle's transition, with what reaching them takes here:
the release is its own ask on the owner's word, and the work this run carried
is done. A run that stops or hands over settles its worker sessions by **A
started session answers to the one that started it**. Commit links and a clean
backlog are required but never replace checking the behaviour.