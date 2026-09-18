---
name: to-spec
description: "Write or update the behavioural spec of tracked work. Use when take-task selects a design route, when requirements need recording, or when the user asks for a spec; choose short or full by risk and uncertainty."
---

# To spec

A charter says what for and what not. Stages say in what order. Between them
sits the page nobody writes and everybody then argues about: **what exactly is
being built, as the person who will use it sees it, and which decisions are
already taken**. That page is the spec. It is written with the owner; after it,
work is taken and finished without them.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

## 1. Check the horizon

First distinguish a request to retain a specification from free exploration.
For "just discuss" or an idea without commitment, use `brainstorming`; do not
require setup, create documents or push the user into this workflow.

The outcome must belong to the current milestone. A spec written for a later
one is stale before its turn comes. Say so and stop.

## 2. Settle before you write

Resolve the tracked work first. Small, understood work needs a short delta:
current and intended behaviour, relevant constraints, acceptance scenarios and
what is out. It may live in the task body, linked to the feature's existing spec.
A small feature still records its own behaviour; do not require a long template.
For a bug, retain a correct source requirement and add the regression scenario;
change the spec only for a gap or an approved change of behaviour.

Use the full form below when risk, uncertainty or scope justifies it. TDD is
an independent project setting, not a reason to choose a larger document.

A spec records decisions; a missing conversation is not proof they are missing.
Read existing decisions first. Draft from what is known, identifying retained
choices and recommendations the user can change by name. Use the established
role, otherwise product engineer: explain what changes for users, why it is
recommended and its cost/risk, not internal implementation choices. Use
"brainstorming" only for consequential unknowns blocking this stage, not to
reapprove routine details. Read the feature issue, the charter and
the vision first, and the code or system the outcome lands in: the
conversation is for what they do not say. Use the project's glossary for every term, and respect the
decisions already recorded in the area.

## 3. Agree where it will be checked

Name the **seams**: the boundaries at which this outcome's behaviour can be
observed without reaching inside. A public interface, an endpoint, a command;
for operations, the alert, the dashboard, the runbook's last line. Prefer a
seam that exists to a new one, at the level that makes the behaviour observable.
Use enough boundaries to cover the important success and failure scenarios.

Recommend the coverage together: what will be watched, why these boundaries
and what they leave unwatched. Only a material unagreed coverage or risk trade-off
needs the decision-maker; routine choices of test level are the agent's, not a
separate architecture question. These are acceptance boundaries, not a restriction on related
unit or integration tests through stable interfaces.

## 4. Write it

Use the document resources supplied through integration. Separate the current
capability contract from the proposed change: read current requirements, give
new ones stable IDs, and record explicit add/replace/remove operations pinned to
their old contents. Keep complete observable scenarios (conditions, action,
result) and planned check IDs. Preserve existing formats and document paths.
Do not overwrite current accepted behaviour with an unimplemented proposal.

The short form below remains useful inside a task body; the project adapter
must export its same required fields. A full form may use separate change and
design templates; do not require all templates for a small change. Record
blocking questions explicitly. No-behaviour fixes/refactors reference preserved
requirements, explain why no contract changes, and add regression checks rather
than rewriting a correct requirement to fit a defect.

```markdown
## Problem
What is wrong or missing today, as the person who has the problem tells it.

## Solution
What they will be able to do, or what will be true, told the same way.

## Stories
The distinct behaviours and important boundary cases, without padding. Use
"As <who>, I want <what>, so that <why>" when it helps; a short delta may need
only a few concrete examples.

## Decisions
What has been decided: the modules or systems touched and their interfaces,
contracts, schema changes, the architecture, what the owner clarified.
No file paths and no code: they are stale within the week. The one exception
is a snippet a prototype produced that says a decision more exactly than prose
can (a state machine, a schema, a type), trimmed to the part that decides.

## Checks
The seams agreed in step 3. What a good check is here: behaviour through the
seam, never the implementation behind it. What already exists in the project
that the new checks should look like.

## Out
What somebody will assume is in, by name.

## DONE WHEN
The outcome's own observable check; regressions can make it false again.
```

`## DONE WHEN` stays last and stays the feature's: it is what the gate looks
for and what `/close-out` walks up to.

## 5. Publish and prove

The spec goes where the backlog integration says specs live; where it says
nothing, into the body of the outcome's feature issue, with the tracker's edit
verb, keeping what the issue already said that is still true. A decision that
is hard to reverse, surprising without its context, and the result of a real
trade-off also gets its own record: use "model-domain".

Run the backlog gate and the integration's feature document gate; a new product
also needs its vision/first charter product check. An incomplete draft may be
retained as draft, but must not be represented as implementation-ready. Only
required consequential approval is sought, bound to the actual proposal; do not
manufacture an approval flag. Then publish through the authorized workflow. Continue with
`to-stages` when the request includes execution or decomposition; otherwise
return the spec and recommend that next step by name. Keep the reasoning in
this conversation where useful, without making a fresh session a blocker.
