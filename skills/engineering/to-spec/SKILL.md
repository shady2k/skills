---
name: to-spec
description: "Write the spec of one outcome of the current milestone: the problem, the solution as its observer sees it, the decisions, where it will be checked, what is out."
disable-model-invocation: true
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

The outcome must belong to the current milestone. A spec written for a later
one is stale before its turn comes. Say so and stop.

## 2. Settle before you write

A spec records decisions, it does not make them. If the decisions are not
already in this conversation, call the Skill tool with "brainstorming" and
come back when nothing is left open. Read the feature issue, the charter and
the vision first, and the code or system the outcome lands in: the
conversation is for what they do not say. Use the project's glossary for every term, and respect the
decisions already recorded in the area.

## 3. Agree where it will be checked

Name the **seams**: the boundaries at which this outcome's behaviour can be
observed without reaching inside. A public interface, an endpoint, a command;
for operations, the alert, the dashboard, the runbook's last line. Prefer a
seam that exists to a new one, and the highest one that still sees the
behaviour: the fewer seams, the better, and the ideal number is one.

This is an architect's decision. Put it to whoever holds that role here, as
what will be watched and what that leaves unwatched, not as a list of modules;
where nobody does, choose, and say so in the spec. Every task's check will be
written at one of them, and nowhere else.

## 4. Write it

```markdown
## Problem
What is wrong or missing today, as the person who has the problem tells it.

## Solution
What they will be able to do, or what will be true, told the same way.

## Stories
A long numbered list. "As <who>, I want <what>, so that <why>." Extensive on
purpose: a story nobody wrote is a behaviour nobody will build or check.

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
The outcome's own check, the one that stops being false exactly once.
```

`## DONE WHEN` stays last and stays the feature's: it is what the gate looks
for and what `/close-out` walks up to.

## 5. Publish and prove

The spec goes where the backlog integration says specs live; where it says
nothing, into the body of the outcome's feature issue, with the tracker's edit
verb, keeping what the issue already said that is still true. A decision that
is hard to reverse, surprising without its context, and the result of a real
trade-off also gets its own record: call the Skill tool with "model-domain".

Run the gate. Done when it is clean. Then publish, and tell the owner the next
command: `/to-stages` for this outcome, by name, **in this same conversation**,
so the breakdown is built on the thinking and not on its summary.
