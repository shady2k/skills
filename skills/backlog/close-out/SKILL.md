---
name: close-out
description: Record accepted work and preserve pending work. Use after stage acceptance, on a session ending, or when work is stopped or handed over.
---

# Close out

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. Read
[`protocol.md`](protocol.md), including its setup-version check.

## 1. Distinguish implementation from acceptance

For work claimed complete, inspect the stage's acceptance record: the assembled
revision, included tasks, criteria, full checks, mutation results or the agreed
fallback, review and resolved findings. Verify that the record covers the
actual result being accepted. Reuse evidence for that exact result; a remembered
green run from before later changes is not evidence.

A worker's local checks justify `submitted`, with the returned revision/location
and evidence preserved. Only integration verified by the coordinator justifies
`implemented`; neither means closed. If integration is pending, keep submitted
work for the next coordinator; if acceptance is pending, keep it implemented.
Name the next action and coordinator. A task
that still fails its criterion remains open or active with what is missing.
If called directly to accept work, produce the missing checks and review
before closing; do not wait for children to close before checking their stage.

Cancellation and duplicate closure are explicit dispositions, not successful
implementation. State why; for a duplicate, name the surviving issue.

## 2. Close the accepted stage and walk up

After its own DONE WHEN holds on the accepted revision, close the included
tasks and the stage with references to that evidence. Re-read partial writes
and finish idempotently if the tracker cannot update them together.

Check the feature's criterion once its required stages are accepted. A feature
never closes solely because its children did. Independent stages and features
need not wait for this one.

If the criterion fails, correct the existing work or file the missing task.
A defect against the agreed stage is not automatically new scope or a budgeted
finding; use `to-backlog` for genuinely additional work.

## 3. File discoveries and release unfinished holds

File still-relevant discoveries through `to-backlog`, reusing existing issues.
Release unfinished tasks nobody will continue, with their state and next action.
Preserve submitted results, implemented tasks, evidence and pending acceptance; never
make them ready to implement again merely because this session is ending.
Transfer or release the coordinator's hold and name who should resume.

## 4. Publish and prove

Run the backlog gate before publishing and the commit-link check for any
commits. Resolve new errors without bypassing the configured strength.
Publish only through the project's authorized workflow.

Report by name what was accepted and on which revision, what remains pending,
what was filed or released, and the milestone's outcomes and finding budget.
