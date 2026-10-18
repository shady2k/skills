---
name: to-spec
description: "Write or update the behavioural spec of tracked work, with scenarios that will be checked. Use while planning a feature with the user, when take-task needs a design, when requirements need recording, or when the user asks for a spec; choose short or full by risk and uncertainty."
---

# To spec

A charter says what for and what not; stages say in what order. The spec says
**what exactly is being built, as its user sees it, and which decisions are
already taken**. It is written with the owner; after it, work is done without them.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

Everything the owner reads follows the protocol's [**Speaking to the
owner**](references/speaking.md).

## 1. Check the request and the horizon

"Just discuss" or an uncommitted idea goes to `brainstorming`: no setup, no
documents, no push into this workflow.

The outcome must belong to the current milestone. If it does not, say so and stop.

## 2. Choose the size, then draft

Resolve the tracked work first. Choose the form by risk, uncertainty and scope,
not by the project's TDD setting, by the life cycle's [**Depth is read off
the change, not off the author's word**](references/lifecycle.md). The form
is named in the approval summary, so the owner sees the depth they are
accepting.

- **Short delta**, for small, understood work: current and intended behaviour,
  relevant constraints, the frame as one line — what it is for and what
  matters most — acceptance scenarios and what is out. It may live in
  the task body, linked to the feature's spec. A small feature still records
  its own behaviour.
- **Bug:** keep the correct requirement and add a regression scenario. Change
  the spec only for a gap or an approved change of behaviour.
- **Full form** (step 4), when risk, uncertainty or scope justify it.

Establish the frame before drafting, by the protocol's
[**The outcome frame comes before the work is specified**](references/lifecycle.md):
for whom and why, what matters most when something must give, the main path,
and the signal that it succeeded for its users. Search for it in the feature
issue, the charter, the vision and the product's own documents; where part of
it is missing, propose it with a recommendation for the owner to confirm or
correct in the approval summary — one batch, not a questionnaire. Each part
is recorded once, in the section that carries it: for whom and why by Problem,
what matters most when something must give by Solution, the main path and the
success signal by DONE WHEN.

Read then: the feature issue, the charter, the vision, the product's own
documents where it keeps them (the user stories, use cases and product
requirements this feature serves), the code it lands in, the glossary and
decisions already recorded in the area. A missing conversation
is not proof a decision is missing. Draft from what is known, marking retained
choices and recommendations the user can change by name, explained as what
changes for users, why, and its cost and risk. Use `brainstorming` only for an
unknown that matters and blocks this stage, not to reapprove routine details.
Use the glossary's terms.

## 3. Agree where it will be checked

Name the **seams**: the places where the outcome's behaviour can be observed
without reaching inside. A public interface, an endpoint, a command; for
operations, the alert, the dashboard, the runbook's last line. Prefer existing
seams, at the level where the behaviour is visible, enough to cover the
important success and failure scenarios.

Recommend the coverage as one proposal: what is watched, why there, and what is
left unwatched. The coverage stands on what is established for that level of
checking, by the protocol's [**A proposal starts from the state of the
practice**](references/deciding.md), with the one the project already follows
preferred to a new arrangement. Only a real coverage or risk trade-off needs
the owner; the test level is the agent's choice. Seams bound acceptance; they do not forbid unit or
integration tests through other stable interfaces.

Include how failures will be seen, as the protocol's [**Failures explain
themselves**](references/checks.md) asks: which errors reach which log level, what carries the request
and trace ids, what a failing check will print. Follow the project's recorded
conventions; where the outcome needs one that does not exist, propose it by the
protocol's [**The project's form is decided once**](references/building.md)
instead of inventing it for one feature. The design keeps [**One surface per
capability**](references/building.md): it extends the way in that exists.

## 4. Write it

Use the document locations and templates from the integration, keeping existing
formats and paths. Keep the current capability spec separate from the proposed
change: read the current requirements, give new ones stable IDs, and record
each add, replace or remove against the old text it changes. Keep complete
observable scenarios (conditions, action, result) and planned check IDs. Never
overwrite accepted behaviour with an unimplemented proposal.

Where the product keeps its own documents, a capability requirement names the
product requirement it serves by its id ("Serves FR-012.") and says how this
part of the system does it; it never restates what the product requirement
already says, by [the product's documents](references/product.md)' **Product
documents are the level above the specs**. Behaviour a user would notice that
no product requirement holds is a gap in the product's documents: name it to
the owner as one, with the requirement it needs, and do not settle it inside
the spec.

The form below also works inside a task body; the project adapter exports the
same required fields. A full change may use separate change and design
templates; a small one does not need them all. Record blocking questions
explicitly. A fix or refactor with no behaviour change references the
requirements it preserves, says why no contract changes, and adds regression
checks instead of bending a correct requirement to the defect.

```markdown
## Problem
What is wrong or missing today, and why it is worth doing for the person who
has the problem, as that person tells it.

## Solution
What they will be able to do, or what will be true, told the same way; and
what matters most when something must give.

## Stories
The distinct behaviours and important boundary cases, without padding. Use
"As <who>, I want <what>, so that <why>" when it helps; a short delta may need
only a few concrete examples.

## Decisions
What has been decided: the modules or systems touched and their interfaces,
contracts, schema changes, what the owner clarified. Where the change
introduces or changes a building block, an interface, ownership of state, a
runtime interaction, an external dependency or an interface surface, the
architecture is not decided here: `to-design` decides it after this spec,
by the protocol's [architecture and design](references/design.md), and this
section records what it decided.
No file paths and no code: they go stale within the week. The one exception
is a snippet a prototype produced that says a decision more exactly than prose
can (a state machine, a schema, a type), trimmed to the part that decides.

## Checks
The seams agreed in step 3. What a good check is here: behaviour through the
seam, never the implementation behind it. What already exists in the project
that the new checks should look like.

## Out
What somebody will assume is in, by name.

## DONE WHEN
The outcome's own observable check; regressions can make it false again. With
it, **where the outcome is seen**: the place a person reaches it (a screen, a
command, a request, a log line) and the happy path through it, or that the
outcome is internal and a person sees nothing, as the protocol's **Reached,
not just built** requires. Where the frame carries a success signal for users, it is stated here as what
will be observed, so acceptance can read it later; where none was agreed,
nothing is invented.
```

`## DONE WHEN` stays last and belongs to the feature: the gate looks for it and
`/close-out` checks it.

## 5. Publish and prove

Put the spec where the integration says specs live; if it says nothing, in the
feature issue's body, keeping what the issue already says that is still true.
A decision that is hard to reverse, surprising without context and the result
of a real trade-off also gets its own record through `model-domain`.

Run the backlog gate and the integration's feature document check; a new
product also needs the product check for its vision and first charter, and
where the product keeps its own documents, the product-documents check, which
refuses a spec serving an id that does not exist. The document gate refuses the
change record without it (`missing-observation`, `missing-mockup`). An
incomplete draft may be kept as a draft but is never presented as ready to
implement. Seek only the approvals that are required, bound to this proposal;
never fake an approval flag. Ask for approval with the protocol's summary, not
by sending the owner to read the spec. Publish through the authorized workflow. If the
request includes execution or decomposition, continue with `to-design`
where the change changes the system's shape, by the protocol's
[architecture and design](references/design.md), then `to-stages`;
otherwise return the spec and recommend that step by name.
