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

`docs/agents/backlog.md` should have been provided to you. If not, tell the
user to run `/setup-shady2k-skills`.

## 0. Which milestone is this?

- `currentMilestone` is **null and nothing is live**: a new project. You are
  chartering its first milestone; nothing is ending, so skip question 4.
- `currentMilestone` is **null and issues are live**: stop. Tell the user to run
  `/groom-backlog` first; a charter written over an undeclared slice leaves
  every unrelated root live and the gate red.
- `currentMilestone` is set and **has no charter file**: you are chartering the
  milestone already running, declared by the installer or by `/groom-backlog`.
  Nothing is ending: skip question 4, and defer nothing in step 3.
- Otherwise you are chartering the **next** one, and the current one is ending.

## 1. Read before asking

The vision document, the previous charter, and the state of the milestone that
is ending: which outcomes are done, which are not, how many findings it took
against its budget. If there is no vision document, interview the owner for one
first: where this is going, for whom, and what it deliberately is not, on one
page, at the path `docs/agents/backlog.md` names.

## 2. Interview the owner, one question at a time

Lead each question with your recommended answer.

1. **What ships?** The milestone is named for it, in the owner's words, and
   gets a label or the tracker's native milestone.
2. **The outcomes**, a handful at most. Each is what becomes possible or true
   and who observes it, with the one check that will watch it happen. An
   outcome you cannot name a check for is an area of work, and it gets split or
   sharpened until you can.
3. **What is out**, by name. The things somebody will assume are in.
4. **What carries over** from the ending milestone, and what of it is deferred
   instead. Carrying is a decision, never a default.
5. **The finding budget**: how many bugs and pieces of debt found along the way
   this milestone will absorb before something has to leave. Recommend from the
   ending milestone's count. Say the price out loud: every finding taken beyond
   it moves the ship date, and the gate will say so at the moment it happens.
6. **The next milestone**, as feature titles only. It is not decomposed.

Done when the owner has confirmed each of the six.

## 3. Write it

- The charter, at `<charters directory>/<milestone label>.md`: name, date
  declared, outcomes with their checks, out, carried over, finding budget, the
  next milestone's titles.
- One feature issue per outcome. **Search first**: a feature that already
  exists, live in the slice or created deferred by the previous charter, is
  adopted: undeferred, given the milestone's label and its DONE WHEN. Create
  only what is missing, as the type `docs/agents/backlog.md` names for
  features, with one area label and a body ending in a `## DONE WHEN` that
  stops being false exactly once. The next milestone's features are created
  **deferred**, under their own label.
- The gate config: `currentMilestone`, `milestoneLabels`, `findingBudget`.
- When a milestone is ending: everything still open under it that was not
  carried is deferred.

## 4. Prove it

Run the gate. Done when it is clean, every outcome has exactly one feature
issue wearing the milestone's label, and nothing outside the milestone is
live. Then publish, and tell the owner the next command: `/to-stages` for the
first outcome, by name.
