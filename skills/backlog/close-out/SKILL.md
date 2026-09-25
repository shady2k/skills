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

Neither `submitted` nor `implemented` means closed, by the protocol's
**Execution and acceptance**. If integration is pending, keep submitted work
for the next coordinator; if acceptance is pending, keep it implemented.
Name the next action and who owns it. A task that still fails its criterion
stays open or active, with what is missing. If asked to accept work directly,
run the missing checks and review first; a stage can be checked before its
children close.

A vision or a charter is accepted only on the owner's yes to its summary, by the
protocol's [**A decision belongs to whoever made it**](references/speaking.md);
otherwise its task stays open, with the summary still to be shown as what is
missing.

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
or release the coordinator's hold and name who resumes. The worker
sessions the work started are ended or handed over by [**A started session
answers to the one that started it**](references/running.md).

Every span this session holds ends here with its receipt, by the protocol's
[**How the work went is kept on the item**](protocol.md): the run script
([`runs.mjs`](runs.mjs), run with `node` from this skill's folder, over the
adapter's export, in the format of [`time-format.mjs`](time-format.mjs)) prints it with `receipt --end <end>`, the end being `finished`, `paused`,
`stopped` or `handed-over` as the work left it, measured from this session's transcript (by
the ledger beside it, [`ledger.mjs`](ledger.mjs)); post it exactly as printed.
The coordinator does the same for a worker session it started that ended
without writing its own. Then `gaps` names every other span that ended with no
receipt: post those it recovers from this machine, and tell the owner, in one
line each, the ones whose transcripts are on another machine, whose time stays
unknown until written there.

## 4. Ask how the run went, and keep its lessons

When a feature closes whose run was recorded (a coordinator's claim on it;
`list` shows them), close the run with `finish --item <feature> --result
<result>` if the run itself did not, and
ask the owner once, in one message, in plain words:

- did they take the result as it was, after changes of their own, or not at all;
- was there a question the agent could have answered itself from the project;
- was there a decision the agent took alone that it should have asked about;
- did they have to correct the agent, or finish the work for it.

A run that left no summary and passed the time its result was promised for
(`stalled`) is one that stopped: close it with `finish --item <feature>
--result stopped` and
say so, rather than leaving it counted as running.

Record the answer with `verdict`, as counts and a short note, posted on the
feature. Only the owner can judge these; never fill them in yourself. If they
skip it, record nothing and do not ask again for this feature.

Then look through its handoff notes, run notes and review findings for traps
that would cost time again, by the protocol's [**A lesson that outlives the work
is kept where every agent reads**](references/keeping.md): proposed to the owner
and, with their agreement, landed in the closing commit. So is the removal of an
existing lesson whose cause this feature removed, by **What describes the
present is kept true**.

## 5. Publish and prove

Before publishing, run the backlog gate, the applicable document gates, and the
commit-link check for any commits. Fix new errors without weakening the
configured strength, by the protocol's [**A gate that refuses is not routed
around**](references/checks.md). Publish only through the project's authorized
workflow.

The records, the lessons and the closing commit land as the protocol's
[**Sessions and landing**](references/running.md) says. A closing that
follows a merge and finds work left on the merged branch moves it there too,
rather than opening a second request for the remainder.

Report by name, following the protocol's [**Speaking to the
owner**](references/speaking.md): what was accepted and on which revision, what
now works, what remains pending or unproven, what was filed or returned, as the
ledger of [**End with the next step**](references/speaking.md), and the
milestone's outcomes and finding budget. If a decision is needed, recommend the
next action with its time and risk. Do not ask the owner to read check internals
or approve each routine closure. "Use defaults" does not waive an open
acceptance limitation.