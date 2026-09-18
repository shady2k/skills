---
name: to-milestone
description: "Turn the vision and the business requirements into the next milestone's charter: the outcomes in it, what is out, and a budget for findings."
disable-model-invocation: true
---

# To milestone

A specification alone is too narrow a thing to steer by: it says how, and
nobody wrote down what for or what not. A **charter** is the missing page. It
is short, a person writes it once per milestone, and it is what the gate's
horizon and the finding budget are measured against.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

## 0. Which milestone is this?

- `currentMilestone` is **null and nothing is live**: a new project. You are
  chartering its first milestone; nothing is ending, so skip carryover in step 2.
- `currentMilestone` is **null and issues are live**: stop. Tell the user to run
  `/groom-backlog` first; a charter written over an undeclared slice leaves
  every unrelated root live and the gate red.
- `currentMilestone` is set and **has no charter file**: you are chartering the
  milestone already running, declared by the installer or by `/groom-backlog`.
  Nothing is ending: skip carryover in step 2, and defer nothing in step 3.
- Otherwise you are chartering the **next** one, and the current one is ending.

## 1. Read before asking

The vision document, the previous charter, and the state of the milestone that
is ending: which outcomes are done, which are not, how many findings it took
against its budget. If there is no vision document, draft its direction,
audience and exclusions from known decisions and show the recommendation.
Ask only for missing consequential requirements, not for answers already in
the conversation. Record the agreed vision on one page at the integration's path.

## 2. Propose the charter for review

Use the established role, otherwise product engineer: explain what ships,
for whom, at what cost and with what risk, not internal settings. Present a
coherent proposed charter with retained decisions and recommended new values.
For each meaningful choice, explain what it means, why it is needed, why this
recommendation and the consequences of changing it. The list below is coverage
for your draft, not six required questions. Let the user approve it together or
change only named items; ask separately, one at a time, only about material
unknowns or conflicting priorities. Existing approval needs no second vote.

1. **What ships?** The milestone is named for it, in the owner's words, and
   gets a label or the tracker's native milestone.
2. **The outcomes**, a handful at most. Each is what becomes possible or true
   and who observes it, with the one check that will watch it happen. An
   outcome you cannot name a check for is an area of work, and it gets split or
   sharpened until you can.
   Independent outcomes may progress in parallel. A shared charter or order in
   this list never creates a blocking dependency between their feature issues.
3. **What is out**, by name. The things somebody will assume are in.
4. **What carries over** from the ending milestone, and what of it is deferred
   instead. Carrying is a decision, never a default.
5. **The finding budget**: how many bugs and pieces of debt found along the way
   this milestone will absorb before something has to leave. Recommend from the
   ending milestone's count and the already agreed scope; never add a reserve
   merely because some findings have closed. Explain that raising it admits more
   unplanned work and can delay delivery; keeping it requires deferral or an
   explicit trade-off when the limit is reached.
6. **The next milestone**, as feature titles only. It is not decomposed.

Done when applicable consequential choices are settled; reuse previous answers
and skip questions already resolved in this conversation.

## 3. Write it

- The charter, at `<charters directory>/<milestone label>.md`: name, date
  declared, outcomes with their checks, out, carried over, the finding-budget
  decision and a pointer to its current value in config, the
  next milestone's titles.
- One feature issue per outcome. **Search first**: a feature that already
  exists, live in the slice or created deferred by the previous charter, is
  adopted: undeferred, given the milestone's label and its DONE WHEN. Create
  only what is missing, as the type the backlog integration names for
  features, with one area label and a body ending in a `## DONE WHEN` that
  names observable behaviour. The next milestone's features are created
  **deferred**, under their own label.
- The gate config: `currentMilestone`, `milestoneLabels`, `findingBudget`.
- When a milestone is ending: everything still open under it that was not
  carried is deferred.

## 4. Prove it

Run the gate. Done when it is clean, every outcome has exactly one feature
issue wearing the milestone's label, and nothing outside the milestone is
live. Then publish, and tell the owner `take-task` can select the appropriate
route for an outcome by name, or `to-spec` can be used for design alone. Do not
impose a sequence on independent outcomes.
