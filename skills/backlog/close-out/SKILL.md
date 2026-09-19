---
name: close-out
description: Record accepted work and preserve pending work. Use after a feature's pull request is merged, on a session ending, or when work is stopped or handed over.
---

# Close out

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. Read
[`protocol.md`](protocol.md), including its setup-version check.

## 1. Tell done from accepted

For work claimed complete, read the stage's acceptance record: the assembled
revision, included tasks, criteria, full checks, mutation results or the agreed
fallback, review and resolved findings. Check that it covers the exact result
being accepted. A green run remembered from before later changes is not
evidence.

A worker's local checks justify `submitted`, with its revision or location and
evidence kept. Only integration checked by the coordinator justifies
`implemented`. Neither means closed. If integration is pending, keep submitted
work for the next coordinator; if acceptance is pending, keep it implemented.
Name the next action and who owns it. A task that still fails its criterion
stays open or active, with what is missing. If asked to accept work directly,
run the missing checks and review first; a stage can be checked before its
children close.

Cancelling or closing as a duplicate is a stated decision, not success. Say
why; for a duplicate, name the issue that survives.

## 2. Close the accepted stage, then its parents

Before closing, merge the stage's requirement changes into the current
capability specs through the integration's sync workflow. Use the real target
baseline; keep untouched requirements and other accepted changes. Update
affected architecture or decision links where needed. Do not record the rest of
an unfinished feature as accepted behaviour. Research, setup and documentation
work leaves requirements unchanged: check its actual scope and checks instead of
inventing a spec. Run the close document gate on the final candidate with
verified receipts bound to its revision. Rerun checks whose inputs changed. A
fix that changes no behaviour keeps the requirement and records regression
evidence; a cancelled proposal never changes it.

Publish code and current docs, and keep the change record as history, through
the authorized workflow before marking the work accepted in the tracker. If
publishing, syncing or archiving is unfinished, keep closure pending and make
resuming safe to repeat. Do not reapply a change already landed, discard its
evidence or turn it back into ready work.

Once the stage's own DONE WHEN holds on the accepted revision, close its tasks
and the stage, referencing that evidence. If the tracker cannot update them
together, re-read after partial writes and finish.

Check the feature's criterion once its required stages are accepted. A feature
never closes only because its children did. Independent stages and features do
not wait for this one.

If the criterion fails, fix the existing work or file the missing task. A
defect against the agreed stage is not new scope or a budgeted finding; use
`to-backlog` only for genuinely new work.

## 3. File discoveries and return unfinished work

File discoveries that still matter through `to-backlog`, reusing existing
issues. Return unfinished tasks nobody will continue to the queue, with their
state and next action. Keep submitted results, implemented tasks, evidence and
pending acceptance; a session ending never makes them ready to redo. Hand over
or release the coordinator's hold and name who resumes.

## 4. Publish and prove

Before publishing, run the backlog gate, the applicable document gates, and the
commit-link check for any commits. Fix new errors without weakening the
configured strength. Publish only through the project's authorized workflow.

Report by name, following the protocol's **Speaking to the owner**: what was
accepted and on which revision, what now works, what remains pending or
unproven, what was filed or returned, and the milestone's outcomes and finding
budget. If a decision is needed, recommend the next action with its time and
risk. Do not ask the owner to read check internals or approve each routine
closure. "Use defaults" does not waive an open acceptance limitation.
