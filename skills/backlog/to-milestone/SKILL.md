---
name: to-milestone
description: "Turn the vision and the business requirements into the next milestone's charter: the outcomes in it, what is out, and a budget for findings. Use when the user asks to plan or change the milestone, or agrees to a proposed change; never start it unprompted."
---

# To milestone

A spec says how. A **charter** says what the milestone is for, what is out,
and how many unplanned findings it can take. It is short and written once per
milestone. The gate measures the horizon and the finding budget against it.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

## 0. Which milestone is this?

Read `currentMilestone` from the gate config.

- **Null, nothing live:** a new project's first milestone, its MVP, by the
  protocol's [**Starting from nothing**](references/starting.md): the outcomes
  are the vision's key journeys it carries end to end, plus the walking
  skeleton, and the owner makes the cut. Nothing ends, so skip carryover.
- **Null, issues live:** stop and ask the user to run `/groom-backlog` first.
  A charter over an undeclared slice leaves unrelated work live and the gate red.
- **Set, no charter file:** the running milestone, declared by setup or
  grooming. Nothing ends: skip carryover and defer nothing.
- **Set, charter file exists, and this is the running milestone:** its charter
  stands as the owner agreed it. Change only what they asked for. A breakdown
  that arrived here for a missing `Moves:` is given one by the owner here, or,
  where they do not give it, is written unknown by [okr.md](references/okr.md)'s
  **An agreed record is not reopened for a missing link** and goes back to
  `to-stages`; no next milestone is planned over the running one.
- **Set, and the owner is planning what comes next:** the next milestone; the
  current one is ending. Offer
  `refine-practices` first, by the protocol's [**A repeated failure is fixed as
  its class, not as its cases**](references/keeping.md): a look back over the
  work since the last retrospective, whose practices land before the next
  charter is planned. Start it if the owner agrees, and plan after it; if they
  decline, that is said once and the charter is proposed.

## 1. Read before asking

Read the vision, the previous charter and the ending milestone's state: which
outcomes are done and how many findings it took against its budget. Read the
project's goal with them, by the protocol's [**A project's goal is its key
results, and every piece of work names the one it moves**](references/okr.md):
the objective, its two or three key results and the date the period closes, and
how far the ending milestone moved each of them. Where the project has no goal
yet, say so in one line and propose one with the draft rather than planning
towards nothing. Where the project keeps its product documents, read too the
results its hypotheses recorded since the last charter: a confirmed one is
spent, and a refuted or inconclusive one is worked into the outcomes this
charter proposes — what the belief was, the measure read against its recorded
threshold, and what the answer changes for the direction. Without a
vision, draft its direction, audience and exclusions from known decisions and
recommend it. Ask only for missing requirements that matter. Record the agreed
vision on one page at the integration's path.

Use the integration's vision, roadmap and charter locations, adapting existing
documents rather than duplicating them; what each holds is the protocol's
**Living documents**. For a new project the roadmap can be a short section in
the vision. Future ideas need no dates, specs or tasks. Current capability specs
stay empty until something is implemented and accepted.

## 2. Propose the charter

Present one draft charter as the protocol's summary, not as a document to read:
retained decisions and recommended new values in product terms, what ships, for
whom, at what cost, risk and time, by the protocol's [**A time told to the owner
is measured, and a dispute is answered with its basis**](references/running.md),
and the assumptions it rests on. For each
meaningful choice say why it is recommended and what changing it would do; the
draft's choices — the outcomes, the finding budget, the target date — stand on
the state of the practice for each, by the protocol's [**A proposal starts
from the state of the practice**](references/deciding.md).
The user approves it as a whole or changes named items. Ask separately, one at
a time, only about material unknowns or conflicting priorities; what is
already decided stays decided, by the protocol's [**A decision given is not
reopened by better analysis**](references/deciding.md).

A question the conversation left open either stays open in the draft, with the
outcomes that rest on it saying so, or is answered as the agent's own, by
[**A decision belongs to whoever made it**](references/speaking.md). Each such
answer comes first in the summary, with what goes into the milestone because of
it.

The draft covers:

1. **What ships.** The milestone is named for it in the owner's words and gets
   a label or the tracker's native milestone.
2. **The outcomes**, a handful at most. Each says what becomes possible or true,
   who observes it, and the one check that watches it. An outcome without a
   check is still an area of work: sharpen or split it. Independent outcomes
   can progress in parallel; their order in the charter is not a dependency.
   Each outcome carries its success signal for users, by the protocol's
   [**The outcome frame comes before the work is specified**](references/lifecycle.md):
   how we will know the slice worked for the people it serves. It names in a
   `Moves:` line the key results it moves, by [okr.md](references/okr.md); an
   outcome that moves none of the period's key results is a scope decision for
   the owner, put with what it would postpone, and not a slice to plan quietly.
   Each outcome
   names in a `Serves:` line the vision journeys and principles it serves
   (`unserved-outcome`); charter acceptance carries the judgement record of
   a different model (`missing-judgement`), each of its entries an id the
   vision declares and a passage copied out of the charter (`unknown-vision-id`,
   `unfound-quote`). Where the
   project keeps hypotheses, each signal is tied to the hypothesis whose
   measure will read it, and the release that carries the outcome records
   which hypotheses now wait on their measures.
3. **What is out**, by name: an outcome somebody will assume is in, not an
   area nobody may touch.
4. **What carries over** from the ending milestone, and what is deferred.
   Carrying over is a decision, never a default. Carried work is linked again
   before it continues: the carried outcome, its stages and their leaves confirm
   their `Moves:` line against the new period's key results, because a number
   from the closed period named that period's measurement, by
   [okr.md](references/okr.md)'s **A key result's id belongs to its period**.
5. **The finding budget**: how many bugs and debts found along the way this
   milestone absorbs before something must leave. Recommend it from the ending
   milestone's count and the agreed scope, as the protocol's findings lane
   counts it. Raising it admits more unplanned work and can delay delivery; keeping it means deferring or trading off when it is reached.
6. **The date it promises**, where there is one. The goal's `Due:` bounds the
   plan and is never copied as the milestone's own date, by [okr.md](references/okr.md)'s
   **The goal's date bounds the plan; it is not the milestone's promise**: a plan
   whose forecast passes it says which key result it leaves for that date and
   what it delivers instead. The milestone's `Target:` is the owner's own date —
   a demo, a release, someone outside the work who waits — taken with who set it
   and why, or a date the forecast over this milestone's own tasks supports, by
   the protocol's **A forecast is checked against the date it serves**. None is
   invented where the owner has none, and none is owed where the goal already
   has a date: the run's forecast stays the agent's own, checked against the
   date it serves.
7. **The next milestone**, as feature titles only.

## 3. Write it

Write only after the owner's explicit yes to the summary, by the protocol's
[**A decision belongs to whoever made it**](references/speaking.md). Without
it the charter is kept as a draft and the vision and charter are not accepted.

- Give each outcome a stable id in the charter, one line each (`O1: <the
  outcome>`), which a stage names in its `Serves:` line: `orphaned-outcome`
  refuses an outcome no stage serves. Its `Moves:` line names the key results it
  advances, from the goal the charter serves.
- The charter at `<charters directory>/<milestone label>.md`: name, date,
  outcomes with their checks, out, carried over, the finding-budget decision
  with a pointer to its value in config, the target date with who set it and
  why, where there is one, and the next milestone's titles.
- One feature issue per outcome. **Search first**: adopt an existing feature,
  live or deferred by the previous charter, by undeferring it and giving it the
  milestone's label and a DONE WHEN. Create only what is missing, as the
  integration's feature type, with one area label and a body ending in
  `## DONE WHEN` that names observable behaviour. Create the next milestone's
  features **deferred**, under their own label.
- In the gate config: `currentMilestone`, `milestoneLabels`, `findingBudget`.
- When a milestone ends, defer everything still open under it that was not
  carried over.

## 4. Prove it

Run the gate. It is done when the gate is clean, every outcome has exactly one
feature issue with the milestone's label, every outcome names the key results it
moves — read as unknown only where the project has no goal yet — the slice
moves at least one of the period's, and nothing outside the milestone is live. Publish, then tell the owner that `take-task` picks the route for an
outcome by name, or `to-spec` does design alone. Do not impose an order on
independent outcomes. For a new product, run the product document check before
recommending implementation; its first feature also needs the feature check.
A charter does not approve a whole-system design or every roadmap idea.
