# The backlog protocol

Setup version: 0.19.0

These rules are the same in every project and ship with every skill that uses
them, so they update with the set. If a project's own document restates them,
this file wins. What differs per project (tracker, labels, gate command,
documents) is the project's **backlog integration**; its agent doc points to it.

**Compatibility before writes.** Before changing the tracker or the repository,
compare this setup version with the repository's installation: the `--version`
of its three installed checks, which must agree with each other.

- **Equal:** go on, once this clone is connected (its hooks active, its runtime
  present). If it is not, ask the user to run `/setup-shady2k-skills`, which in
  an installed repository only connects the clone.
- **This one newer:** the repository's installation is out of date. Ask the
  user to run setup, which updates it for everyone through the project's normal
  review and merge; where others work in the repository, say it is a team change.
- **This one older:** someone already updated the installation. Ask the person
  to update their plugin; never run setup, which would roll it back for all.
- **No installed checks, or they disagree:** not installed or broken; setup.

Reading and investigating may continue meanwhile. Setup itself, and the
bootstrap context it hands over, are exempt while installing. Not landed means
not installed: an attempt that has not reached the main line leaves the
repository at its previous installation, whatever its branch holds. Nothing
about one person's machine or plugin is committed.
The setup version changes only when a project's installation must be redone:
new rules in the checks, a new config setting, a new adapter duty or proof. An
update that changes only how skills talk, reason or plan needs no setup; never
ask for one merely because the plugin was updated.

**Levels.** Each has one size and one author.

| level     | what it is                                                        | size              |
| --------- | ----------------------------------------------------------------- | ----------------- |
| Vision    | where the product is going; a document, never an issue           | rarely rewritten  |
| Milestone | the next slice, with a charter: what is in, what is out, a finding budget | what ships next   |
| Feature   | a root issue holding one **outcome**                              | one run, one branch, one PR |
| Stage     | an issue under a feature, with its own DONE WHEN                  | a checkpoint accepted inside the run |
| Task, bug | a leaf: an issue with no children, inside one stage               | one worker's session |

An **outcome** is what becomes possible or true, and who observes it: "a person
creates a connection group", "a rollback takes one command and one minute". Its
DONE WHEN names the observable behaviour and the check that watches it; a
regression can make it false again. A feature merges into the main line on its
own and soon: when its run would keep a branch open longer than the project
allows, it is split into features that each merge separately and leave the main
line working (expand, then migrate, then contract; behind a switch where the
project allows one). A task that will not fit one worker's session is split
before it starts. A stage has no session limit: it groups
tasks toward a checkpoint that is accepted by checks and review before the
next stage builds on it.

**The horizon.** Only the current milestone is broken down below features. The
next milestone exists as feature titles; anything further lives in the vision.
**Everything live belongs to the current milestone**, whose label its root
wears; everything else is deferred. The current milestone is read from the
gate's config each time.

**Ready** means an open leaf that nobody holds and whose required results are
available. A closed prerequisite counts. An `implemented` prerequisite counts
only inside the same stage, once its revision is merged into the consumer's
checkout and its related checks pass; across stages it must be accepted and
closed. So the adapter's ready operation takes the stage and checkout revision,
not just "are the blockers closed".

**Execution and acceptance.** A worker claims a leaf (takes a hold on it),
checks its change and records it as `submitted`, with where the result lives
and its local evidence. Submitted work is neither taken again nor used by
dependants yet. The stage's single coordinator merges it and marks it
`implemented`, with the merge revision and check evidence; it is not taken again
and not yet closed.
**The holder is whoever does the work.** A task an agent works on is held by
that agent, never by the person by default, even when the tracker would fill
in the person's name. The person holds only work they do themselves: a
decision, a manual check, an approval. An agent's name says who can find it:
its harness and role, the person it works for, the machine, the branch and its
session, as `<harness>-<role>:<person>@<machine>:<branch>#<session>`, for
example `claude-worker-2:alex@laptop:fix/login#528e03ed`. The claim's comment
adds when it started and the checkout's path. A role alone ("coordinator")
names nobody: several run at once on different machines and branches. Where
the tracker assigns only people's accounts, the person's account holds the task
and the claim's comment carries the agent's full name. This file wins over an
older integration doc that describes holders differently.
Workers have distinct owners and an atomic claim or a serialized assignment:
reading back a field that anyone can overwrite is not a lock. If a merge
changes or fails, reopen the affected work and recheck what depends on it. The
assembled stage gets full tests, mutation checks of changed logic and a final
review. Its tasks and the stage close only after acceptance on that revision; a
parent has its own criterion too.

**Parallelism.** Independent leaves, stages and features may run at once.
Hierarchy, list order or a shared milestone never make one wait for another.
Each stage has its own merge and acceptance and does not wait for unrelated
features. Inside a stage, merge results as they arrive so dependants can start.
Serialize only for a real prerequisite, a conflicting write or an exclusive
resource. Use separate checkouts where changes can collide; generated files and
dependency locks count as collisions.

**Two lanes outside the flow.**

- **Ideas**: deferred, no parent, no dependencies, a review date. Never ready,
  closed without regret.
- **Findings**: bugs and debt found during a milestone. Each wears the finding
  label **and the label of the milestone it was filed in**, so a feature
  carried forward does not bring old findings into the new budget. The charter
  sets that budget. A finding over budget goes to the next milestone, or
  displaces something only by the owner's explicit decision; it never jumps to
  the front silently.

**A finding that does not fit is decided, not parked.** The budget is spent, or
the milestone it would join is already closed and the next one does not exist
yet: then there is no lane the run may pick on its own. Deferring it with a
review date is one of the answers to that question, not the way around asking
it, and the owner gives it. Put the answers that exist with what each costs:
displace named planned work and approve the new count, open the next slice now,
or hold it knowingly until one opens. What the finding costs while it waits
comes before any counting; where people or their data are living with the fault
now, that is the first sentence, and a counter that measures only intake never
decides urgency. A run that parks such a finding and reports the parking
afterwards has taken the owner's decision.

**Labels.** Every live issue, features and stages included, wears exactly one
area label: the area that owns the behaviour.

**Edges.** A blocking edge records a required result or a conflict, with its
reason and what releases it, on the leaf that needs it. A cross-stage edge
points at the concrete leaf that produces the result; that stage must be
accepted before outside consumers are released. Never chain features or
stages just because they were listed in order. Importance is priority; "later"
is a milestone; where an issue came from is never a blocker. Cycles, in the
hierarchy or in live dependencies, are invalid.

**Status is true.** Active means somebody is working on it now. Stopping
releases unfinished holds and keeps `submitted` and `implemented` work with its
evidence; submitted results resume at merging, not implementation. Pending
acceptance is not abandonment. A handoff names who owns the next action.

**Tracked work.** Before implementing or changing the repository, find or file
the task. Every commit names one or more existing leaf tasks by the project's
convention, including research, documentation, prototypes and setup; initial
setup files its own task before any gate exists. Read-only discussion needs no
issue until it produces work to keep. The commit check verifies links; a clean
backlog does not.

**Nothing of value stays only in this session.** A conversation is the one
place work cannot be recovered from: its files are uncommitted, what it found
is unfiled, and what it learned is in nobody's memory but the agent's. Version
control's status is the test of that, and it is read rather than recalled. When
a piece of work ends, and always before offering to stop, hand over, compact or
start a fresh session, name what this session changed that no commit holds,
which task each change belongs to, and what would carry it; where there is no
task, filing one is the next step offered, as **Tracked work** says. What the
session learned and has nowhere else to live goes through `handoff` the same
way. Say each thing once, not in every message: this is a duty to leave nothing
behind, not a checklist to recite. A session that changed files and ended with
none of it said has lost the work, whatever stopped it.

**Exploration is not admission.** Discussion, imagination and read-only
research may end with no result, task or document. A hypothesis is not an
approved requirement, and a scratch experiment does not authorize production
use. Product and feature gates start at the commitment to keep an
implementation, not at thinking.

**Living documents.** The vision gives direction. The roadmap explains intended
outcomes and order, without copying tracker status or creating dependencies.
The charter bounds the current slice. Current capability specs describe
accepted behaviour on the main line; change records describe proposals as
pinned requirement deltas. Design and decision records explain how and why,
only where useful. Use the project's paths and templates and adopt existing
documents where they are.

The document gate runs separately from the backlog's strength. It checks
product intent before the first implementation, feature readiness before work
starts, evidence tied to the revision at acceptance, and updated current specs
before closure. An accepted stage updates its own requirements without waiting
for unrelated features. A bug fix keeps correct requirements and changes the
regression check instead. Independent requirements may move at once; a changed
prerequisite needs a refresh. The integration supplies deterministic exports
and evidence at the level setup chose: honest records, or verified receipts
where protected CI can enforce them. A structural check cannot prove a requirement is right
or that a receipt is genuine; CI protection and real tests are separate jobs.

The document gate is installed as its own stage and never holds up setup or
work. Until it is installed, the integration says so and names its task. A
skill that would run it checks the same readiness by reading the documents,
records that the automatic check did not run, and never reports it as passed.

**Names, not identifiers.** Everything a person reads says "Title" (id), with
the id in parentheses and only where somebody must act on it. A title is a
sentence the work can be understood from. A bare id, or a list of ids, is never
an item of a report: look the title up first. If the title does not explain the
work, say in a few words what it is about.

**Speaking to the owner.** The words of this protocol, the config, the tracker
and the tools are for the agent. The person reads what they mean for the work,
in their own language. Use the person's established role, otherwise **product
engineer**: someone who owns the product and its trade-offs and builds through
agents, without holding the code or tool settings in their head. Explain in
consequences for users, time, cost and risk. Say instead:

| internal | what the person reads |
| --- | --- |
| an abandoned hold or claim | a task listed as taken, which nobody has touched for days |
| released | returned to the queue so anyone can take it |
| ready leaf / ready queue | tasks that can be started now |
| submitted | done by an agent, waiting to be merged into the stage |
| implemented | merged into the stage, waiting for the stage to be accepted |
| the repository's installation is older than the plugin | the project's setup needs updating: skills that change tasks wait until it is |
| the plugin is older than the repository's installation | your copy of the skills is out of date: update the plugin |
| gate strength `block-new` | a commit may not add new backlog problems; old ones are listed but do not block |
| new errors: 0 | the backlog is in order: nothing broken was added |
| finding budget | how many new bugs and debts the current version takes in before the rest waits for the next |
| deferred | moved out of the current version, not lost |
| mutation testing | deliberately breaking changed code to check that the tests notice |
| stage 2, the second stage | the stage's name, by what it delivers ("the backend keeps command output") |

Terms outside the table get the same treatment: a plain phrase, or one clause
of definition the first time. Config keys, status values, labels, commands,
tool names, commit hashes and branch names do not appear unless the person must
type or find them. A number comes with what it means and whether to act on it.
Lead with the consequence for the work: what can be done now, what waits, and
what is needed from the person. Show what changes and what needs a decision;
what stays as it was takes one line. Diagnostics and proof belong with the
task that did the work, available on request, not in the message.

Never show the kitchen: how this set works inside is not the person's
concern: versions of the set or its checks, what changed inside the skills,
the gate, adapter, hooks, receipts, config or integration doc, paths of the
process tooling, branches and pull requests of the installation, the setup
task's own id, open questions about how agents split their work. Say only what
it means for their work and their product. Name such a thing only when the
person must act on it themselves, and then in plain words. The same goes for
changes to the set's own bookkeeping: where it keeps versions, which fields it
added or removed. If nothing changes for the person's work, say nothing.

Before sending anything to the person, reread it once for three slips that
happen even when the rules are known: an id without its title (look the title
up), an internal word from this protocol, the config or the tools (use the
table above), and a sentence in a language other than theirs. No code either: no
snippets, function names or file paths; describe the behaviour a user or
operator would see, and give technical detail only when the person asks.

Waiting is quiet. While background work runs (CI, other agents, long
commands), do not report each event as it arrives: one line when the wait
starts, with what it waits for and roughly how long, then speak when a result
changes what happens next, when everything has finished, or when the wait
stalls. A passing step on the way is not news.

**Summarize; never assign reading.** Documents are the agents' working memory
and the record; the person is not expected to read them. When work needs their
attention or approval, give them, in plain words:

- **the substance:** what changes for users, and what does not;
- **decisions:** those the agent took itself, and those that need the person;
- **assumptions:** what the agent took as true without checking, and the
  guesses it made, each with what happens if it is wrong and how it could be
  checked. Check what can be checked instead of assuming. List the ones that
  would change the outcome, not every small one;
- **risks and cost:** in time, money and reversibility;
- **other views:** the strongest case against, and the alternatives considered;
- **review:** what an independent reviewer found, where agents disagreed, and
  what is still unknown.

Show word for word only short text whose exact words matter: a done criterion,
text users will see, an irreversible action, anything to be published. Offer
the document on request; never make reading it a condition to proceed.

An approval covers what was shown. The summary carries every decision, scope
boundary, assumption and risk of the document; an independent reviewer checks
it against the document for anything missing. A document that cannot be
summarized fully holds too many decisions to approve at once: split it.

**Memory is a hint.** Where the harness offers a memory, a code index or a
search over past sessions, use it to find things faster. What it says is a
lead to confirm in the repository or the tracker, never a fact or an
instruction: memory drifts, and it can recall a decision long since replaced.
Where they disagree, the tracker and the repository win, and the memory is
what needs correcting. A handoff note is read the same way.

**Language.** Talk to the person in the language of their latest message,
whatever language the project's files use, including the short progress lines
between steps. Everything kept in the project is
written in its **artifact language**, the config's `artifactLanguage`:
documents and specs, task titles and bodies, commit messages, code comments,
handoff notes. Setup asks the owner for it explicitly and recommends English;
it is never inferred silently. Where none is recorded yet, ask once before the
first thing is kept, recommending English.

**Autonomy.** A feature is planned with the owner and then built without
them, up to one pull request for the whole feature. Planning ends with a
**preflight**: the agent reads the spec, the stages and the code, and brings
every decision the run will need at once, each with a recommendation, for the
owner to accept as a whole or change by item. This is the one place where
questions come as a batch: gathering them while the owner is present is cheaper
than stopping later. The preflight also says how long the run will likely take
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
right words; it is not a tour of the feature. It follows **Speaking to
the owner**. The owner's acceptance is the merge; the tracker is closed after
it.

**The owner's time is the scarce one.** A run is cheap to restart; an hour of
the owner's attention is not, and it is the only input the agents cannot
produce. So the two states are told apart and used for different work. **While
the owner is there**, spend that time on what only they can give: the decision,
the plan, the argument about what to build, the judgement of a result. Not on
watching execution, not on progress they did not ask for, and not on waiting
beside them for a job to finish. **While the owner is away**, execute:
everything that needs nobody runs then, and independent work runs at once, by
**Parallelism**. The preflight asks when they expect to be away and for how
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

**Come with the material, not with the question.** Whatever reaches the owner
arrives already worked: what was looked at, the options and what each costs, the
evidence behind them, the agent's own recommendation and the strongest case
against it. "Let me look into that" spends their time on the agent's homework,
and a question put before the work is done makes them wait through it. Where an
answer genuinely needs them, it comes with everything already known, what was
tried, what each way would cost and which one the agent would take. And the
agent owes more than answers to what was asked: the option nobody raised, the
example and the counterexample, the view from a different kind of user, the
consequence two steps out. A better idea kept quiet because nobody asked for it
is a cost like any other.

**A wait is filled.** Where the run waits on something long — a review, a
worker, a check, a deploy — it does the work that is ready meanwhile: the next
independent task, the pull request's text, the checks that do not depend on the
answer. Where nothing is ready, say so, with what is being waited for and when
it is due, rather than holding the session open in silence. Waiting is the
state of one job, never the state of the run. What fills a wait never lands on
what is being waited for: a wait restarted by its own filler is waited twice.

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
request. Plans land with as few merges as possible: what belongs to one
feature rides in that feature's branch; the rest of a conversation's plan
(charter, backlog, other features' tasks) lands once, at its end, by a direct
push where the main line accepts one and otherwise by one pull request.
Tracker records kept in the repository ride with the branch where the work
happens, unless that branch is already submitted. Never a merge per small
change. How the main line accepts changes is
recorded at setup; if the plan's pull request is not merged yet, the feature
branch starts from the plan branch instead of waiting. How a change lands is
decided this way, never asked, and never part of what the person approves;
mention it only when they must act, such as merging, after the work exists.
After the owner merges, the agent closes the work and removes the checkouts
and branches it created.

**A red check is this run's work.** Every failure on the way to a merge is
diagnosed and fixed by the run, whoever wrote the code: all of it is written by
agents, and the branch cannot merge while it is red. "It was already broken"
and "our change does not touch that" are never reasons to stop; when a failure
appeared matters only as a clue to its cause. A failure that also breaks the
main line is fixed there by its own small pull request, since it blocks
everyone, and the report names it as a fixed earlier failure. Never rerun a
check hoping it passes: a flaky check is a bug and is diagnosed. Only a fix
that needs an architectural change or other decision the **Autonomy** rules
reserve for the owner stops for them.

**A gate that refuses is not routed around.** A check that says no has named
what this run still owes, and that debt is this run's work like any red check.
Read what the refusal asks for before naming any way forward: an option nobody
has costed is not an option, and the one named first is the one taken. The hook
is not skipped, the check is not switched off, its exemption list is not
widened to buy silence, and the command that would skip it is never put in
front of the person — not as a suggestion, not as the quick option, not as
something for them to type. "It only runs on this machine", "the server does
not have it" and "the check is newer than this work" all argue that the verdict
does not count; none of them is a reason, and a check nobody else enforces is
one to hold to harder, not more lightly. Say what is missing and what it costs
in their words, name the ways that make the gate pass, and take the cheapest
one; where that cost is large enough to change what they would decide, it is a
decision for them, put as the work to be done and never as a way past the
check. A gate that counts what the slice takes in refuses by counting, and the
cheapest way is chosen among the ways that do the work, never among the ways
that shrink what is counted: dropping the label that puts an item in the slice,
deferring it or narrowing it until the number fits is the same manoeuvre as
switching the check off, and it costs more, because the record then says the
work is not there. A skip is usually permanent rather than deferred: where a
check judges only what is new, what it never judged is never judged again. If
the person orders one anyway, say that in one line with what ships unproven,
and file it as a finding.

**Failures explain themselves.** Time spent collecting diagnostics or rerunning
CI is a defect of the product and its checks. A failing test states what it
expected, what it got and the chain of causes. A failing CI job puts its cause
on the first screen of its log and keeps the logs and artifacts diagnosis
needs. The product is instrumented to its nature: log levels (detailed in
development, concise in operation), and where requests cross components, a
request and trace id carried through the chain, with errors wrapped in their
causes; secrets and personal data never reach a log. The project decides these
conventions once, as a recorded decision, and every change follows them. When
a diagnosis stalls for lack of logs, adding them comes first, and the gap is a
finding.

**Silence is not progress.** Work handed to another agent, a long command, or
anything else that runs out of sight is given a hard time bound before it
starts, taken from what similar work took. That it began is proved, not
assumed: output arriving, a file growing or processor time moving, looked at
once in the first minutes. Never send such work through something that holds
its output until the end, which makes "never started" look exactly like "still
thinking". When the wait passes what that work has taken before, the cheap
liveness check comes before any further waiting, and what it shows is said
plainly. An agent that takes a hung worker for a slow one waits until the owner
asks, and that hour is spent by both of them.

**A run that never came back is found, not assumed.** An unattended run cannot
report its own death; what it leaves behind is a hold that stops moving and a
record with no end. So before it goes unattended it says when its result is
due, and past that time silence means it stopped, not that it is working. Every
session that looks at the work afterwards — the next coordinator, orientation,
closing out — names each run that passed its forecast with no end recorded,
with what it last did and when, and offers to take it over or to end its
record. None of them reads a taken task with a dead run behind it as work in
progress.

**The bound is the forecast, and an overrun is a defect.** The time given to
work that runs out of sight is the estimate made for that work, by
**Estimates**, not a generous round number chosen so that nothing ever trips
it. Passing it is a fact about the work: never wait on to see whether it
finishes, never start it again hoping for a better run, and never raise the
bound to make the step pass. Stop it, find out why it took longer, and file
that as a finding like any other failure this run owns. How long tests, a
compile, a check or any other operation takes is a measurement like its result:
recorded, compared with what the same work took before, and a change in it
explained. A suite that was four minutes and is now eleven has said something,
green or not.

**Cheapest check first.** Checks cost: CI and end-to-end runs take runner
time, money and the owner's wait, and use up limits shared with everyone
(runner minutes, image downloads, the queue). So each question gets the
cheapest check that can answer it, and a dearer one only for what the cheaper
cannot show:

- by kind: reading and static checks, then a local unit test, then a local
  integration or end-to-end run, and CI only for what nothing local can show
  (another platform, the real pipeline). What a unit test can prove is proved
  by one, and where the behaviour has no unit test that could catch it, writing
  one comes before reaching for an end-to-end run;
- by breadth: the one failing test, then its file or package, then what the
  change touches, then the project's full local check;
- by place: this machine before a remote one.

A failure at any step sends the work back to the cheapest check that shows it,
never to a rerun of the whole. Use the machine well: run independent checks in
parallel, within what it can carry while other agents share it.

**Reached, not just built.** Green checks say the code does what its tests
assert. They do not say the new behaviour can be reached: code nothing calls, a
route nobody registered, a switch left off, a command never wired and a screen
with no way into it all pass every test they have. So an outcome is **seen**
before it is accepted. At the place the spec named for it, walk the happy path
once on the accepted revision, the way a person reaches it and not the way a
test does, and record what was seen in the words of the outcome. A spec that
named no place said there is nothing a person can see, and acceptance repeats
that. A walk that needs what this machine has not got is reported as not made,
never as passed, and becomes the first thing the owner is asked to check.

**CI is not where failures are diagnosed.** A CI failure is a clue: read its
log once, then instrument the code and reproduce the failure here, recreating
what CI has that this machine lacks (its load, timing, parallelism,
environment). A fix is pushed only when the local reproduction shows it
removes the failure. Only a failure that needs something truly unavailable here
(another operating system) may reach CI unproven: then say so, add the
instrumentation that makes its next failure name its cause, and send it with
the one push the work needs anyway. Never call a green run proof that a guess
was right.

**Know what a push starts.** Before the first push of a run, read the
repository's CI configuration, not a remembered habit: what starts a run
(a push to which branches, a pull request, its draft state, a label, changed
paths, a manual trigger), which jobs each start runs and how long they take.
Then meet the criteria with what this repository offers: work in progress
starts no expensive run, a run starts once when the work is ready, and a red
run returns the work to in progress until the fix is proven locally. Where
drafts skip CI, that means a draft until ready; where every push runs
everything, it means not pushing until ready. Where the repository offers no
way to keep unfinished work from a full run, say so to the owner once, as a
finding.

**Push once.** Start the run only when the local steps are green and
everything meant for it is in, not after each fix. Before starting it, check
that it will run: the pull request is open, not merged and has no conflicts (a
pull request with conflicts runs no CI, so its push proves nothing). A merged pull
request is never edited or reused. Report a CI run as started only after
seeing it start.

**A submitted branch is frozen.** Once its pull request is open and its run
has started, a branch carries only what review sends back to it: the fix for
a red check, or the change a reviewer asked for. Everything else the run makes
meanwhile — a tracker record, a document, the next stage's plan, another
feature's work — waits for the merge or goes on its own branch. A push there
restarts every job, so it costs the owner a whole round on the merge they are
waiting for, and the check evidence an acceptance names is then a different
commit's than the one that merges. When the run is submitted, the working
checkout moves off that branch, so that what is done next cannot land there
by default; where the harness cannot, every push until the merge names the
branch it is for.

**Estimates are agent time.** An agent writes in minutes what takes a
developer hours; its time goes to waiting (CI runs, reviews, the owner),
rework after a red check, and diagnosis. Estimate from this project's own
history, measured rather than recalled: the run journal's pace where it has
enough runs (how long similar runs took, and how far past estimates were off);
that journal is one machine's, so where it is thin the same numbers are read
from what finished runs left on their features in the tracker; otherwise the
tracker's and git's timestamps and how long a CI run takes.
Correct an estimate by how far past ones were off; a model's own sense of time
runs short. Give the number as a range, the agent's work plus the waits
("about twenty to forty minutes of work, then two CI runs of half an hour").
Never estimate by how long a developer would take; with no history, say the
number is a guess and what it rests on.

When work grows well past the
time given for it, or turns into different work (a small fix that uncovers
four failing tests), tell the person once: what grew and why, what was
already done, the new estimate, and whether the work continues. Continue on
the same authority when it still serves what they agreed to; stop for them
when the new cost could change their decision.

**End with the next step.** Every skill that finishes a step ends by naming the
next useful action and the skill that does it, so the person never has to ask
what now. Offer work at the level the owner runs it: a feature to plan or to
run, not a single task. Every option offered carries a rough duration and what
it rests on (how many tasks, their size, the pace the history shows), in
agent time as **Estimates** says; say that it is an estimate. When the
session has grown long, recommend a fresh one: at a natural
boundary (a stage accepted, a switch to unrelated work) through `/handoff`;
in the middle of the same work, through the harness's context compaction (for
example `/compact`), saying what must survive it. Recommend it before the
context is exhausted, not after. An offer to end the session carries its
ledger, read back from the tracker and not from the session's memory: what this
session found, each item as "Title" (id) with the lane it landed in, what was
discussed and deliberately not filed, and what still waits on the owner. A
count recalled instead of read is how a session that filed everything as it
went reads to the owner as a session that filed nothing.

**The gate is clean** when its report says `new errors: 0`. That line means the
same under every strength, unlike red and green: under `report` nothing is ever
red, and under `block` old debt is always red. Every skill that writes to the
backlog runs the gate **before** publishing, and fixes a new error by its own
`fix` line before anything leaves this machine.
