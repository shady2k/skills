---
name: close-out
description: Close finished work with evidence and leave the backlog true. Use when an issue's work is done, when a session is ending with issues still held, or when stopping work on an issue for any reason.
---

# Close out

A backlog goes false at the end of a session, not at the start: work closed on
a feeling, holds left behind, findings kept in somebody's head. Close out is
what makes the next "what do I work on" an honest question.

`docs/agents/backlog.md` should have been provided to you: the protocol, the
kinds of evidence this project accepts, and the tracker verbs. If not, tell the
user to run `/setup-shady2k-skills`.

## 1. Evidence first, then the close

An issue closes on **evidence a stranger can check**, of a kind this project
declares. Produce it now, do not recall it: run the test, read the file, query
the dashboard. Then close with a reason that names it. "Done" and "duplicate"
are not reasons; for a duplicate, name the survivor and what makes the two one
behaviour.

An issue whose criterion is not met stays open, with a comment saying what is
left, however much of the work is done.

## 2. File what the work found

Everything noticed along the way that is still true and not fixed gets filed
now: call the Skill tool with "to-backlog", once per finding. A blocker
reported in prose evaporates by the next session; an issue with an edge does
not.

## 3. Release what you are not holding

Every issue you hold and are not going to touch in the next minutes is
released, with a comment on where it stands.

Done when the tracker shows nothing active under your name that you are not
working on.

## 4. Walk up

When the last child of a stage closes, check the **stage's own DONE WHEN**
against evidence. If it holds, close the stage the same way; if it does not,
the stage is missing a task, and that task is a finding. Do the same for the
feature above it. A parent never closes because its children did.

## 5. Publish and prove

Run the gate. Done when it is clean; a new error is fixed by its own `fix` line
first. Then publish the backlog writes with the work they describe. Report by
name what closed and on what evidence, what was filed, what was
released, and the milestone's standing: outcomes done of total, findings of
budget.
