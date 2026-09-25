# Running work alone

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
How a planned feature runs without the owner: the preflight, the owner's time,
sessions and landing, waits, runs out of sight, estimates.

**Autonomy.** A feature is planned with the owner and then built without
them, up to one pull request for the whole feature. Planning ends with a
**preflight**: the agent reads the spec, the stages and the code, and brings
every decision the run will need at once, each with a recommendation, for the
owner to accept as a whole or change by item. An approval the end of the run
will need is one of those decisions and is taken here, before anything is
written: what he approves is what the change decides — its kind, its scope, the
requirements it moves and what it promises to leave alone — and never the
finished text, which does not exist yet and which he was never going to read.
A record binds itself to what he approved, so that the agent's own working on
it afterwards — the reasoning, which check covers which requirement, a rewrite
after review — does not send anybody back to him, and a change to what he
decided does. An approval that can only be given at the end cannot be taken
in the batch, and so stops the run after he has gone. This is the one place where
questions come as a batch: gathering them while the owner is present is cheaper
than stopping later. A preflight that goes unanswered has not been accepted; by
[**A decision belongs to whoever made it**](speaking.md), every recommendation in it is still
the agent's own until they say otherwise. The preflight also says how long the run will likely take
and when to expect the pull request, with what the estimate rests on; a run
longer than the project lets a branch live is split first. It ends by saying
the feature is ready to run alone, or what it still lacks.

During the run, a gap the spec did not foresee is decided by the agent when it
knows what to do; the decision and its assumptions go into the feature's
decision log and later into the pull request. The agent **stops** instead when
the choice is hard to reverse (an architectural fork), costly if wrong
(security, data, money, public interfaces, migrations), changes product
behaviour beyond the spec, or conflicts with an earlier decision. It then
pauses only the affected work, continues the independent rest, reaches the
owner the way the harness allows, and sends a ready decision: the problem and
where it came from, what is blocked and what continues, the options compared
from the product, technical, risk, cost and reversibility sides, its
recommendation and why, and what happens if the answer comes later.

The pull request is where the owner looks. Its report says what users can now
do; how to check it yourself; every decision and assumption the agent made
alone, and where it departed from the spec; what review found; what is not
done; and the risks left. **How to check it yourself** is the walk the run
already made, as a few steps in the order that matters: what to open, what to
do, what should happen. It leads with what the agent could not reach and what
it cannot judge for itself, such as whether this is the right thing in the
right words; it is not a tour of the feature. It follows [**Speaking to
the owner**](speaking.md). The owner's acceptance is the merge; the tracker is closed after
it.

**The owner's time is the scarce one.** A run is cheap to restart; an hour of
the owner's attention is not, and it is the only input the agents cannot
produce. So the two states are told apart and used for different work. **While
the owner is there**, spend that time on what only they can give: the decision,
the plan, the argument about what to build, the judgement of a result. Not on
watching execution, not on progress they did not ask for, and not on waiting
beside them for a job to finish. **While the owner is away**, execute:
everything that needs nobody runs then, and independent work runs at once, by
the protocol's **Parallelism**. The preflight asks when they expect to be away and for how
long, and the run is shaped to fill that window rather than to fill the hour
they are sitting in.

A run in flight does not stop because the owner starts talking, and their
message is not something the coordinator serves with its own hands. The
coordinator opens a separate session for the conversation — in its own checkout
where the talk could touch files — and keeps executing. That session plans,
explores or decides, and returns its result: the decision and its reason, the
task it filed, the plan it agreed, handed back to the coordinator and written
in the tracker, so nothing of it survives only as the memory of a conversation
the run cannot read.

**The session opens with the picture.** A session that opens while work is in
flight owes the owner the state of it before it owes them an answer: what is
running, what it last did, what waits and on whom. It reads that from the
traces the work leaves — the tracker, the branches and their checks, the
holds, the workers' own logs — by [**Read the record, not the
memory**](deciding.md), and not by asking the agents at work: a
question to a running agent costs its context and returns what it believes
about itself. Messaging one is the second step, for when the traces are silent
or disagree, by **A run that never came back is found**.

What follows depends on what the picture holds. **Where something waits on the
owner**, that comes first, already worked, by [**Come with the material**](deciding.md), and
with it the one question about their time: how long they have now, and when
they expect to be away and for how long. **Where nothing waits on them**, the
question is not asked at all — answer what they wrote.

A window is for the blocking set, not for filling the hour. Take what stops
execution first, and among those what is hardest to reverse; stop when nothing
blocking is left, even with time to spare, because a run that starts half an
hour earlier is worth more than questions found to fill the window. An absence
with a stated end is also a permission: until the owner is back, the run
decides what it knows how to decide and records it, by **Autonomy**, and holds
only the choices that rule reserves for them.

**A wait is filled.** Where the run waits on something long — a review, a
worker, a check, a deploy — it does the work that is ready meanwhile: the next
independent task, the pull request's text, the checks that do not depend on the
answer. Where nothing is ready, say so, with what is being waited for and when
it is due, rather than holding the session open in silence. Waiting is the
state of one job, never the state of the run. What fills a wait never lands on
what is being waited for: a wait restarted by its own filler is waited twice.
What the owner hears meanwhile is [**Waiting is quiet**](speaking.md).

**Sessions and landing.** The owner opens the agent in the main checkout and
talks; talking changes nothing, and a conversation that keeps nothing leaves
no branch behind. When the first thing is to be kept (a task, a spec, a
charter change), the agent moves itself into a separate checkout on a plan
branch, saying so in one line; where the harness cannot, it asks the owner to
open one and says how. The main checkout stays clean.

A feature run starts on its own branch, named after the feature from the
start and created by the agent. Nobody re-briefs it: everything agreed is in
the spec, the stages and the decision log, which is what the preflight checks
("could a fresh agent run this without our conversation?").

Product code reaches the main line only through its feature's one pull
request. Everything else a session keeps lands **once, at its end, and all of
it together**: the charter, the backlog, other features' tasks, a lesson
written into a document, the records a closing leaves. What belongs to one
feature rides in that feature's branch, unless that branch is already
submitted; everything else, and everything the freeze sends off a submitted
branch, goes on the session's one landing branch, which lands by a direct push
where the main line accepts one and otherwise by one pull request. Each record
is committed there as it is made, so nothing is held in a working tree and a
session that dies loses none of it; only the merge waits. Never a merge per
small change, and **never a merge for bookkeeping alone**: every merge costs
the owner a round of attention and the repository a full run of its checks,
which is more than a record of what already happened is worth. The exception
is what something else needs before the end — a task the next run must read,
a fix the main line is waiting on — and that lands when it is needed. How the
main line accepts changes is
recorded at setup; if the plan's pull request is not merged yet, the feature
branch starts from the plan branch instead of waiting. How a change lands is
decided this way, never asked, and never part of what the person approves;
mention it only when they must act, such as merging, after the work exists.
After the owner merges, the agent closes the work and removes the checkouts
and branches it created.

**Silence is not progress.** Work that runs out of sight — handed to another
agent, a long command — runs under a watchdog: a deadline and a heartbeat, both
set before it starts. The deadline is the estimate made for that work, by
**Estimates**, not a generous round number chosen so that nothing ever trips
it. The deadline is the
estimate's upper end. The heartbeat is a sign of life (output arriving, a file
growing, processor time moving), read never through anything that holds its
output until the end, where "never started" looks exactly like "still
thinking". It is looked at in the first minutes, so that a start is proved and
never assumed, and again whenever the wait passes what that work typically
takes, before any further waiting, with what it shows said plainly. Past the
deadline the overrun is a fact about the work,
not a reason to wait: never wait on to see whether it finishes, never start it
again hoping for a better run, and never raise the bound to make the step pass.
Stop it, find out why it took longer, and file that as a finding like any
other failure this run owns. Durations are tracked as performance regressions
are: how long tests, a compile, a check or any other operation takes is
recorded with its result, compared with what the same work took before, and a
change explained, green or not.

**A started session answers to the one that started it.** Every session one
agent starts for another — a worker, a reviewer, a coordinator started by a
session above it — works to the same contract, whatever starts it:

- It is started only through the mechanism this environment provides for
  sessions, driven by that mechanism's own instructions, chosen before the work
  and never improvised once it is under way. Where none is available, that is
  said before the work starts, with what the fallback costs.
- Its brief names where its **report** goes. Its last act is to write that
  report whole — done, or stopped and why, a question for the owner included —
  so that nothing half-written is ever read as an answer. A session that stops
  to wait on anyone writes its report before it waits.
- It has finished when its report exists and its agent has stopped working;
  either alone proves nothing, and neither does anything the session shows
  about itself, which it can show before it starts or while still working.
- How to resume it is recorded with its task when it starts, not when it ends:
  a session that dies takes the chance to record it with it.
- The one that started it ends it once the report is collected and the result
  taken in, and proves it ended, as the start was proved. A session stopped for
  a decision stays open until that is settled; nothing is left open in case.
  Handing the run over hands these sessions over by name.

**A run that never came back is found, not assumed.** An unattended run cannot
report its own death; what it leaves behind is a hold that stops moving and a
record with no end. So before it goes unattended its deadline, by **Silence is
not progress**, is recorded where others can read it, and past that time
silence means it stopped, not that it is working. Every
session that looks at the work afterwards — the next coordinator, orientation,
closing out — names each run that passed its forecast with no end recorded,
with what it last did and when, and offers to take it over or to end its
record. None of them reads a taken task with a dead run behind it as work in
progress.

**A submitted branch is frozen.** Once its pull request is open and its run
has started, a branch carries only what review sends back to it: the fix for
a red check, or the change a reviewer asked for. Everything else the run makes
meanwhile — a tracker record, a document, the next stage's plan, another
feature's work — waits for the merge or joins the session's landing branch,
which asks for one merge at the end and not one apiece (**Sessions and
landing**). A push there
restarts every job, the case of a wait restarted by its own filler (**A wait is
filled**), so it costs the owner a whole round on the merge they are
waiting for, and the check evidence an acceptance names is then a different
commit's than the one that merges. When the run is submitted, the working
checkout moves off that branch, so that what is done next cannot land there
by default; where the harness cannot, every push until the merge names the
branch it is for.

**Estimates are agent time.** Estimate as reference-class forecasting does:
from how long similar work took in this project, measured rather than
recalled — the run journal's pace where it has enough runs; that journal is
one machine's, so where it is thin, what finished runs left on their features
in the tracker; otherwise the tracker's and git's timestamps and how long a CI
run takes. Calibrate by how far past estimates were off: a model's own sense of
time runs short, and a developer's hours are the wrong reference class. An
agent's time goes to waiting (CI runs, reviews, workers, the owner's answers),
rework after a red check, and diagnosis, so the number is a range of the time
the work occupies with those waits inside it. The owner's time away is in no
estimate: its length is his to choose, and the time a result is promised for
adds the absence he announced. With no history, say the number is a guess and
what it rests on.

When work grows well past the
time given for it, or turns into different work (a small fix that uncovers
four failing tests), tell the person once: what grew and why, what was
already done, the new estimate, and whether the work continues. Continue on
the same authority when it still serves what they agreed to; stop for them
when the new cost could change their decision.
