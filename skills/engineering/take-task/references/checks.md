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
green is filed as the protocol's **A repair the merge waits on**, never as a finding.

**A check is never rerun to find out why it failed.** A flaky check is a bug,
diagnosed like any other; its usual cause is a race window written into the
check itself (it waits for one thing and asserts another, or waits on the
clock), there on every run, with load deciding only whether a run lands in it.
A rerun answers only whether it fails every time, which a check that has ever
passed has already answered, and it costs a whole run. The attribution ritual —
the check alone, then on the main line, then once more, to show the change is
not the cause — costs the same and says as little: whose change caused it is
not this run's question, since the failure is its work either way. The first
move is to read the assertion that failed, at the file and line the check names,
and the code that moves each value it asserts on. A flake that already has a number has a name, not a diagnosis:
matching one explains nothing and buys no pass, and the reading it still needs
costs less than the repeats.

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
work is not there. A way the check itself names is not exempt. A refusal states
what is owed, and its remedy line was written before this case: where it names
a way that shrinks what is counted, this rule outranks it, and what the check
printed is a defect to report rather than an instruction to follow. So is a
demand for something the work does not owe: a record written only so the check
passes, saying nothing was done, and the person's signature asked for under
it, route around the check as surely as skipping it, and teach them to sign
without reading. The way that makes the gate pass is then fixing the check,
said as that work with its cost. A skip is
usually permanent rather than deferred: where a check judges only what is new,
what it never judged is never judged again. If
the person orders one anyway, say that in one line with what ships unproven,
and file it as a finding.

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

**Know what a push starts.** Before the first push of a run, read this
repository's CI configuration, not a remembered habit: its triggers (branches,
pull requests and their draft state, labels, paths, manual starts), the jobs
each runs and how long they take. Then, with what it offers, work in progress
starts no expensive run, a run starts once when the work is ready, and a red
run returns the work to in progress until the fix is proven locally: where
drafts skip CI, a draft until ready; where every push runs everything, no push
until ready. Where nothing keeps unfinished work from a full run, say so to the
owner once, as a finding.

**Push once.** Start the run only when the local steps are green and
everything meant for it is in, not after each fix. Before starting it, check
that it will run: the pull request is open, not merged and has no conflicts (a
pull request with conflicts runs no CI, so its push proves nothing). A merged
pull request is never edited or reused. Report a CI run as started only after
seeing it start.
