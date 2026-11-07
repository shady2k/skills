# How this project lands

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
The practice this project's work reaches the main line by, in that practice's
own words. A rule that depends on how a change lands cites the protocol's
[**How this project lands is recorded, and no skill assumes one way**](running.md)
and leaves the particulars here; no rule restates them, and none is the set's
own choice for every project.

How this project's work reaches the main line is below, in the words of the
practice itself, answering six questions in this order: **how work goes**,
**who merges**, **what you see and when**, **what it costs**, **what it
suits**, and **how hard it is to leave**. Three practices have a section here,
each named after itself and carrying the config value that selects it; the
project's config says which one it lands by, the section carrying that value is
the project's, and the other two are what another project would read. Nothing
here is preferred: the set recommends one from a project's own facts at setup,
and a recommendation is not a requirement.

After the six questions every section says where unfinished work hides, what a
landing waits for, and what a red main line triggers, because those are what
the rest of the protocol asks most often. Where a project's rules leave a
practice nothing — a protected branch, a required approval, a merge queue it
may not change — the choice is recorded with that constraint named, never
quietly replaced by another practice.

## One pull request per feature, and the owner merges it (`feature-branch-pr`)

**How work goes.** A branch per feature, named after the feature, alive as long
as the feature and no longer than this project lets a branch live; its stages
ride in that branch, so a stage has no branch of its own and the whole bound
applies to the feature. The feature reaches the main line once, as one pull
request, when it is whole. A feature whose run would keep its branch open longer
than that is split into features that each land separately. Unfinished work
hides on that branch, and nothing of it is on the main line until the merge;
where the work must be visible sooner, a draft pull request shows it without
landing it.

**Who merges.** The owner. The run opens the pull request and stops there: it
merges nothing into the main line itself, and nobody else merges the feature
either. Their merge is the acceptance — the tracker is closed after it, a leaf
with no stage closes at that merge, and the run's report ends at it. Once the
merge is there, the agent closes the work and removes the checkouts and
branches it created. Where the project's rules require an approval before
landing, that approval comes first and the owner's merge after it; the practice
is unchanged, and neither the acceptance nor the closure is written before the
merge itself is there.

**What you see and when.** The main line shows nothing until the merge, then
the feature whole. The work is not hidden meanwhile: a demo shows the open pull
request — its diff, its checks, the walk already made on it — and after the
merge, the revision the merge put on the main line, with what is built and what
is not in one change.

**What it costs.** The owner's attention once per feature, at the merge, and a
review of the whole change in one sitting. A branch that lives as long as a
feature drifts from the main line while it waits, and the longer it lives the
dearer its merge is; the pull request's checks run again after every push to
it, and no value of the feature reaches anyone before the merge.

**What it suits.** A person who reads each change before it lands; versioned or
infrequent releases; a first project, with nothing yet worth landing often and
a change that cannot be shown until it is whole.

**How hard it is to leave.** The cheapest of the three: nothing it left on the
main line is made false by another practice, since one commit group per feature
reads the same whichever practice puts the next change beside it, and no switch
has to be retired and no release branch added. What a change of practice cannot
carry is the one thing it cannot undo: the branches open at that moment still
wait for the one merge each.

**Where unfinished work hides, and what a landing waits for.** On the feature's
branch, and on a draft pull request where the visibility is wanted. A landing
waits for the owner's merge, and the review and checks before it are this
project's own rule, unchanged by the practice. A red main line blocks
everyone, so it is repaired first, by its own small landing ahead of anything
else; a change not yet merged fails on its own checks and stops the owner's
merge before it is made.

## A branch per change, merged when its checks pass (`github-flow`)

**How work goes.** A branch per change, alive hours to a couple of days and no
longer than this project lets a branch live; each stage of a feature opens its
own branch and closes it at its own landing, so the stage's bound is the
bound and a feature's stages reach the main line one after another as each is
finished. A branch is named after the change it makes. Unfinished work hides on
that branch, and a draft pull request is where a change not yet ready is shown,
so the work is visible while it is still being made.

**Who merges.** The run, once the review this project records and its required
checks are green. Where the project's rules require an approval, that approval
is the gate and the run merges when it has it; where they require a change to
arrive as a pull request, the run opens one and merges it when it has the
right. An approval and a merge stay two things: the run never presses a merge
it has not been given the right to press.

**What you see and when.** The main line moves several times a day, once per
change; a demo shows the newest landed increment, and a change not yet landed is
shown as its open pull request. Nothing waits for the feature to be whole.

**What it costs.** A review-and-checks cycle per change, on the critical path,
and with a protected main line each update to a branch re-runs what the main
line requires. A bad change is felt at once by everyone, and is reverted or
fixed by the next small landing. Somebody has to review each change: where a
person must approve, landings are as fast as they are, and a run that cannot
get its approval stops there and says so rather than waiting out of sight.

**What it suits.** A continuously delivered product, a review required before
anything lands, a protected main line, and checks green in minutes.

**How hard it is to leave.** The habits, not the tools: nothing on the main
line has to be undone, and a project that moves to a branch per feature keeps
one branch per change in its history. The protected main line and its review
are the project's own settings, which no practice changes.

**Where unfinished work hides, and what a landing waits for.** On the change's
branch, or behind a draft pull request. A landing waits for this project's
review and its required checks, and for an approval where the project's rules
require one. A red main line blocks everyone, so it is repaired first,
by its own small landing. Where the landing that broke it reached the main line
with nothing but the checks in front of it, it is reverted first and the repair
follows as a second landing, because a change is everyone's the moment it lands
and undoing it is the fastest way back; where a person's approval stood in
front of that landing, the repair is judged like any other change and the
revert is theirs to ask for.

## Trunk-based: the day's work lands the day it is made (`trunk-based`)

**How work goes.** The day's work lands the day it is made, from a branch that
lives a day or not at all — and not at all where the main line accepts the
commit straight. A stage lands the day it is built, as one small landing of its
own, so a feature's stages reach the main line within days of each other.
Unfinished work hides behind a switch rather than on a branch: the code is on
the main line and changes nothing until the switch is on, and the switch is
retired when the work is whole. A change whose data or clients must coexist
while it is made is landed by expanding and contracting, since nothing arrives
whole. A branch bound of a day is this practice's default, and the project's
own rule wins where it has one.

**Who merges.** The run, where the main line allows it. Where the project's
rules require an approval or a pull request, the run opens one per landing and
waits for the approval it needs; that does not stop the practice — landings are
then as fast as the approvals are — and it never makes them whole-feature
landings.

**What you see and when.** The main line always runs and moves daily; whatever
has landed is in it, and a demo can be made at any time from it. What is
unfinished is not visible as behaviour, because nothing of it behaves until its
switch is on. The walk an acceptance needs is made with the switch on, in the
environment the spec named for it, on the revision that landed: the walk needs
the behaviour, and the switch is what keeps that behaviour off the main line
until the work is whole.

**What it costs.** Checks fast enough to be trusted, since nobody waits at a
landing; the habit of reverting a bad landing first and repairing it after
where nothing but the checks stood in front of it, and, where a person's
approval stood in front of it, of judging the repair like any other change,
the revert theirs to ask for; switch debt, with each switch opened to be
retired by someone; and small steps instead of one review of a whole change.

**What it suits.** Continuous deployment, one production line, checks that
finish in minutes and are believed, and a project that would rather revert than
hold a change.

**How hard it is to leave.** A release branch to add where the next practice
releases from one, the switches still open to retire, and landings that become
less frequent; nothing on the main line contradicts another practice.

**Where unfinished work hides, and what a landing waits for.** Behind a switch
on the main line, not on a branch, and behind a draft pull request where one is
used to carry the review. A landing waits for this project's required checks,
and for an approval or a pull request where the project's rules require one. A
red main line blocks everyone, so it is repaired first, by its own small
landing. Where the landing needed no person's approval, it is reverted first and
repaired by a second landing: it is everyone's the moment it lands, so it must
not stand while the project works on top of it.
