---
name: to-stages
description: "Decompose tracked work into independently acceptable stages and dependent or parallel tasks, each task sized for one worker's session. Use after a short or full spec, or when take-task needs stages for a feature run."
---

# To stages

Break one **outcome** into **stages**, and the stages that start now into
**tasks**. Routine decomposition is the agent's; the owner decides only scope,
cost or risk that matters. Afterwards work proceeds within those decisions,
and a material new problem comes back to the owner.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

## 1. Check the horizon

The outcome must belong to the current milestone. If it does not, do not
decompose it, however clear it looks: say so and stop.

## 2. Gather

Read the outcome's spec or short delta, the feature issue, the charter and the
code it lands in; the conversation the spec came from is best of all. Without
usable behaviour and criteria, use `to-spec`. For a bug, reuse its requirement
and regression scenario. Decompose only once the outcome's frame is there, by
the protocol's
[**The outcome frame comes before the work is specified**](references/lifecycle.md);
where the spec or issue carries no frame, back to `to-spec` before any stage
is drafted.

Before drafting, read the open work that would replace what these stages stand
on, by the protocol's **What would make the work obsolete is read before it is
paid for**: found now, a collision is an edge and a reshaping.

A standalone task or bug joins the feature and stage it serves. If none exists,
create the minimal feature and stage in the current slice, with criteria from
the same small change, and attach the existing task. Where the change needs no
checkpoint of its own — one worker's session and its checks, which nothing after
it builds on — it may stand directly under its feature, or with no parent where
it serves no feature's outcome, and closes by the protocol's **A leaf with no
stage closes at its merge**; a stage is for a result that later work waits on.
Do not duplicate it or add unrelated scope. A short delta in the task body is enough input here. Adding
these containers needs no approval; changing the outcome or budget does.

Settle any question whose answer changes the breakdown first, through
`brainstorming`.

Look for the **prefactor**: the change that, made first, makes the rest easy.

Where [design.md](references/design.md)'s **Design runs when the shape
changes** holds for this outcome and no design is recorded, the breakdown does
not start: it goes to `to-design` first, whoever called this skill. A run
through `take-task` is no exemption, and what makes a design recorded is that
rule's own test: a direction agreed in conversation or sketched in a note is
not one until **The choice is recorded where it will be read again** holds it,
and the plan agreed here would otherwise be the second design, drawn by
whoever was breaking the work down. A small bug and a trivial change stay
outside this, as that rule and the life cycle's **Tailoring is the rule**
already say. Whichever way the reading goes, it leaves one line on the feature
before the first stage is created — `Design: <where the design is recorded>`,
or `Design: tailored past — <the reason the step was not owed>` — the same
one-line shape as the feature's other facts, so the next run, the reviewer and
the gate read where the design is instead of asking again.

## 3. Draft

An outcome that already has stages keeps them. Decompose only the **stages
starting now**, including independent ones that will run in parallel; leave
later stages coarse; the coordinator of a feature run breaks them down when it
reaches them, within the spec. Redesign approved outcomes only when scope
changes.

**Features.** A feature is built in one run and reaches the main line by this
project's way of landing (**How this project lands is recorded, and no skill
assumes one way**): as one landing where the practice lands a whole feature,
or stage by stage where it lands each change on its own. Either way nothing a
practice lands may keep a branch alive longer than the project allows: the
feature must be small enough for the branch it lands by, and, where the
practice lands each stage alone, each stage must be small enough for its own. If the stages would not fit, split the outcome
into features that each land on their own and keep the main line working, and
say so to the owner; changing the milestone's outcomes goes through
`/to-milestone`.

**Stages.** Each finishes something observable with its own DONE WHEN: a
checkpoint that full checks, mutation testing and review accept before the
next stage builds on it. Observable means seen: carry the spec's place of
observation down to the stage that first makes the outcome reachable there, so
the walk happens inside the run and not only at its end. A stage has a size:
what one run can build and show in about one working day of agent time, its
tasks and its acceptance inside that, by the protocol's
[**A time told to the owner is measured, and a dispute is answered with its basis**](references/running.md).
A plan whose stage forecast runs past that day is cut into stages here, at the
breakdown; a stage that turns out larger later is not lengthened to fit what
the work became, but re-cut by
[**A forecast is checked against the date it serves**](references/running.md).
Every stage but the one allowed Preparatory stage ends in something a person
can open, and its DONE WHEN names what they open and what they see there; a
step no one can reach is a task inside a stage, never the stage itself. Together they meet the feature's
end-to-end criterion; they need not form a sequence, and independent stages
and features run concurrently. Add a dependency only for a real required
result, conflicting write or exclusive resource, on the affected task — or
between two stages while the later one is not broken down: it has no task to
carry the order yet, and the tracker's ready list reads a stage that waits.
Breaking that stage down moves the order onto its tasks in the same step, and
the gate refuses an order left on a stage that already has tasks
(`nonleaf-dependency`). A dependency kept in a comment is one the ready list
never reads.

**The first increment is a walking skeleton.** The first stage whose result a
person can see is the thinnest path through every layer the outcome touches,
each part doing the least its job needs, joined end to end, and run on the
real input the product will meet — a fixture shows the path is
joined, and the real input shows it runs. This is the tracer bullet, and the
vertical slice below taken at the size of a stage: each later stage widens the
same path with the second case, the fuller result and the states that are not
the happy one. No stage takes all of one layer across with the next to follow,
which is a slice of the plan and not of the product, and no later stage is
where the path first meets reality. Where the spec says the outcome is
internal and a person sees nothing, the skeleton is that path walked by the
feature's end-to-end check on real input, and the stages after it widen what
that check covers. It sits beside **Prefactoring first**: what the path cannot
be built without is prefactoring, cut as its own task inside this stage, or
carried by the one Preparatory stage the gate allows and followed at once by
this one — a preparatory stage is ground moved before the path can run,
allowed once because the person sees nothing in it, and the stage after it is
this one. A path built only on fixtures, or one layer finished while the
layers behind it wait, is the breakdown to re-cut.

**Tasks**, for the stages starting now only:

- Small enough for one worker's session, including its local checks.
- A **vertical slice**: a narrow, complete path through every layer the outcome
  touches, never one layer across. Finished, it can be shown or checked alone.
- A stage or task that replaces a mechanism carries the old one's retirement in
  the same feature, by [building.md](references/building.md)'s **One surface per
  capability**: the new form beside the old, callers moved, the old form deleted
  in a last task of that same feature. "Removing the old one is out of scope" is
  the owner's decision in so many words, recorded; written by the breakdown
  itself, it is the second implementation with nobody left to remove it.
- Prefactoring first, as its own tasks.
- Acceptance covers the spec's seams; local tests may use other stable interfaces.
- The title is a sentence the work can be understood from, naming each part by
  the glossary's name for it (the protocol's **One thing, one name**).
- The criterion is an **assertion** a stranger can run or look at and get yes
  or no. Every "fails when" has a paired "and normally it succeeds". Choose it
  by [deciding.md](references/deciding.md)'s **A claim reaches only as far as
  its evidence**.
- Dependencies follow the protocol: the required result or conflict and what
  releases it. None from list order or parentage.
- Each result has an integration point and related checks, so dependants in
  the same stage can start before the stage is accepted.
- Parallel tasks have separate write scopes or isolated checkouts, and a named
  coordinator collects and verifies their results.

The gate binds this: `unobservable-first-stage` refuses a breakdown whose stage,
still open, names none of the feature's places in its DONE WHEN and is not the
one Preparatory stage placed before the first of them — every stage of the
breakdown, not the first one alone — and `orphaned-outcome` refuses a milestone
outcome no stage serves. Both read the feature's `Seen at:` line, a stage's
`Serves:` line and a `Preparatory:` line with its reason; the `Design:` line is
read by `started-without-agreement`, which refuses a feature whose work started
without one. A stage or task names the outcomes it serves, because the forecast
is computed over the exact task set covering them.

**A wide refactor is the exception.** A mechanical change across the whole
codebase (a renamed column, a retyped shared symbol) breaks every caller at
once, so no vertical slice of it lands green. Use **expand, migrate,
contract** (the protocol's **Levels**): add the new form beside the old; move callers in batches, one task
each; delete the old form in a last task once nothing uses it.

Stages and tasks each wear exactly one area label. Create stages as the type
the integration names for them; that is the type the gate checks for a DONE WHEN.

**The project's standing decisions come before the breakdown**, by
[deciding.md](references/deciding.md)'s **A question is searched for before it
is asked**: read the decision records, the glossary, the constraints the
charter names, and the design the change builds on. Where the breakdown would
contradict one, or stand a new mechanism beside the one a decision put there,
that is the owner's decision and not the agent's: put it, with what the
decision says and what the breakdown would do instead, before any stage is
created. A breakdown written against a recorded decision is the second design
the owner never agreed to.

## 4. Present the breakdown

For a feature that will be run, this presentation is the agreement the run
starts on, by [speaking.md](references/speaking.md)'s **An approval covers what
was shown**: what the owner agrees here is the plan — these stages, what each
makes true, their DONE WHEN and their order — and no caller stands in for them.
Record it on the feature in their words, with when they gave it, where the gate
reads it; then publish. Where the owner's own decision closes an option the
breakdown would otherwise have taken (the old mechanism retired inside this
feature or later), that decision is recorded with it, because the next reader
of the plan is a run that will not ask again.

Show a numbered list: title, what it makes true, what it waits for. Explain
each stage's result, size, real prerequisites, what can run in parallel and
roughly how long it will take, by the protocol's [**A time told to the owner is
measured, and a dispute is answered with its basis**](references/running.md), in
terms of the outcome it enables and the cost or risk of changing it. The user
changes named entries; they do not approve every task or assignment. Ask about
open product, cost or risk decisions as the protocol's [**How an open question
is put**](references/speaking.md) says; approved scope stays approved, by the
protocol's [**A decision given is not reopened by better
analysis**](references/deciding.md).

## 5. Publish and prove

Create stages under the feature and tasks under their stages with the tracker's
verbs. Run the gate. It is done when the gate is clean and the ready tasks are
exactly the first ones you expect. Publish and name what is ready to take:
`take-task` for the stage, with the tasks that can run in parallel. When called
from an authorized execution workflow whose feature already carries the agreed
plan, return the breakdown to that caller and continue; where the plan is not on
record, present it first — a workflow authorizes the work, not the plan the owner
has not seen.
