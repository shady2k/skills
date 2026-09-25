# Checks and CI

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
How a run treats its checks: red checks, refusing gates, diagnostics, the
cheapest check, reaching the outcome, and CI.

**A red check is this run's work.** Every failure on the way to a merge is
diagnosed and fixed by the run, whoever wrote the code: all of it is written by
agents, and the branch cannot merge while it is red. "It was already broken"
and "our change does not touch that" are never reasons to stop; when a failure
appeared matters only as a clue to its cause. A failure that also breaks the
main line is fixed there by its own small pull request, since it blocks
everyone, and the report names it as a fixed earlier failure. Only a fix
that needs an architectural change or other decision the [**Autonomy**](running.md) rules
reserve for the owner stops for them. What the run fixes to make the check
green is filed as a repair the merge waits on, by the protocol's **Only what
the milestone chose is intake**, never as a finding.

**A check is never rerun to find out why it failed.** A failure is diagnosed by
root-cause analysis, not by repeating the experiment: a rerun answers only
whether it reproduces, which a check that has ever passed has already
answered, and it costs a whole run. A flaky check is a nondeterminism defect,
diagnosed like any other; its usual cause is a race window written into the
check itself (it waits for one thing and asserts another, or waits on the
clock), there on every run, with load deciding only whether a run lands in it.
The first move is to read the assertion that failed, at the file and line the
check names, and the code that moves each value it asserts on. A match with a
known issue is not a cause: it explains nothing and buys no pass.

**A gate that refuses is not routed around.** A check stands for work, and it is
satisfied only by doing that work: any move that changes the measurement instead
defeats it, which is Goodhart's law. A refusal names what this run still owes,
and that debt is this run's work like any red check. Read what it asks for
before naming any way forward: an option nobody has costed is not an option, and
the one named first is the one taken. The hook is not skipped, the check is not
switched off, its exemptions are not widened, what it counts is not relabelled,
deferred or narrowed until the number fits, and no record is written only to
satisfy it; the command that would skip it is never put in front of the person.
No argument that the verdict does not count — where the check runs, how much
newer it is than the work — is a reason, and a check nobody else enforces is
held to harder, not more lightly, and a skip is usually permanent, because what
a check never judged it does not judge later. Say what is missing and what it
costs in the person's words, and take the cheapest way that does the work; where
that cost would change what they decide, it is their decision, put as the work
to be done. A check's own remedy text does not outrank this rule: where it names
a way around, that text is a defect to report, and the work is still done. Where
the check demands what the work does not owe, the check is the defect, and
fixing it is the work, said with its cost. If the person orders a skip anyway,
say in one line what ships unproven, and file it as a finding.

**What a gate will demand is known before the work starts.** Shift left: the
checks the work must pass, and what each will ask of it — a record, a document,
an approval only the owner can give — are read when the work is prepared (at
setup's adoption, at a run's preflight), and what they need is planned or
asked for then. A demand first met at the push is met with no slack left, which
is where a way around starts to look reasonable.

**Failures explain themselves.** Time spent collecting diagnostics or rerunning
CI is a defect of the product and its checks. A failing test states what it
expected, what it got and the chain of causes; a failing CI job puts its cause
on the first screen of its log and keeps the logs and artifacts diagnosis
needs. The product is instrumented by ordinary observability practice, to its
nature: every level from debug to error, detailed in development and concise
in operation; each record names its module and carries the ids that join the
chain of calls, a trace id through every component and the request id where
one arrives from outside; errors wrapped in their causes. Secrets and personal
data never reach a log. The project decides
these conventions once, as a recorded decision, and every change follows them.
When a diagnosis stalls for lack of logs, adding them comes first, and the gap
is a finding.

**Cheapest check first.** Checks follow the test pyramid and narrow scope
outward from the failure: reading and static checks, then a unit test, then a
local integration or end-to-end run; the one failing test, then its file or
package, then what the change touches, then the full local check. Each question
gets the cheapest check that can answer it. Beyond that: CI and any remote
machine come last, only for what nothing local can show (another platform, the
real pipeline), because they spend runner time, money, the owner's wait and
limits shared with everyone; and where the behaviour has no unit test that
could catch it, one is written before an end-to-end run is reached for. A
failure at any step sends the work back to the cheapest check that shows it,
never to a rerun of the whole. Independent checks run in parallel, within what
the machine carries while other agents share it.
A change that cannot touch product code (documents, process tooling) does not
run the product's suites, and CI is configured to skip them for it.

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
log once, then reproduce it here, instrumented, recreating what CI has that
this machine lacks (load, timing, parallelism, environment). A fix is pushed
only when the local reproduction shows it removes the failure. Only a failure
that needs something truly unavailable here (another operating system) may
reach CI unproven: say so, add the instrumentation that makes its next failure
name its cause, and send it with the one push the work needs anyway. Never call
a green run proof that a guess was right.

**Know what a push starts, and push once.** Before the first push of a run,
read this repository's CI configuration, not a remembered habit: its triggers
(branches, pull requests and their draft state, labels, paths, manual starts),
the jobs each runs and how long they take. Then, with what it offers, work in
progress starts no expensive run, and a run starts once, when the local steps
are green and everything meant for it is in, not after each fix: where drafts
skip CI, a draft until ready; where every push runs everything, no push until
ready. A red run returns the work to in progress until the fix is proven
locally. Before starting a run, check that the configuration will run it for
this state of the pull request (open, unmerged, mergeable); a pull request
already merged is closed work and is never edited or reused. That a run started is
reported by [**A claim reaches only as far as its evidence**](deciding.md):
after seeing it start. Where nothing keeps unfinished work from a full run,
say so to the owner once, as a finding.
