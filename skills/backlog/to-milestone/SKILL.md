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

- **Null, nothing live:** a new project's first milestone. Nothing ends, so
  skip carryover.
- **Null, issues live:** stop and ask the user to run `/groom-backlog` first.
  A charter over an undeclared slice leaves unrelated work live and the gate red.
- **Set, no charter file:** the running milestone, declared by setup or
  grooming. Nothing ends: skip carryover and defer nothing.
- **Otherwise:** the next milestone; the current one is ending.

## 1. Read before asking

Read the vision, the previous charter and the ending milestone's state: which
outcomes are done and how many findings it took against its budget. Without a
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
whom, at what cost and risk, and the assumptions it rests on. For each
meaningful choice say why it is recommended and what changing it would do.
The user approves it as a whole or changes named items. Ask separately, one at
a time, only about material unknowns or conflicting priorities. Do not re-ask
what is already decided.

The draft covers:

1. **What ships.** The milestone is named for it in the owner's words and gets
   a label or the tracker's native milestone.
2. **The outcomes**, a handful at most. Each says what becomes possible or true,
   who observes it, and the one check that watches it. An outcome without a
   check is still an area of work: sharpen or split it. Independent outcomes
   can progress in parallel; their order in the charter is not a dependency.
3. **What is out**, by name: what somebody will assume is in.
4. **What carries over** from the ending milestone, and what is deferred.
   Carrying over is a decision, never a default.
5. **The finding budget**: how many bugs and debts found along the way this
   milestone absorbs before something must leave. Recommend it from the ending
   milestone's count and the agreed scope; do not add a reserve because some
   findings closed. Raising it admits more unplanned work and can delay
   delivery; keeping it means deferring or trading off when it is reached.
6. **The next milestone**, as feature titles only.

## 3. Write it

- The charter at `<charters directory>/<milestone label>.md`: name, date,
  outcomes with their checks, out, carried over, the finding-budget decision
  with a pointer to its value in config, and the next milestone's titles.
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
feature issue with the milestone's label, and nothing outside the milestone is
live. Publish, then tell the owner that `take-task` picks the route for an
outcome by name, or `to-spec` does design alone. Do not impose an order on
independent outcomes. For a new product, run the product document check before
recommending implementation; its first feature also needs the feature check.
A charter does not approve a whole-system design or every roadmap idea.
