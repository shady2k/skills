---
name: groom-backlog
description: "Restore a usable backlog by snapshotting it, choosing the live slice and deferring the rest. Use during setup before gate installation, or when the backlog has stopped being a queue."
---

# Groom backlog

Reviewing a dumped backlog issue by issue never finishes. Instead, agree what
is being built now, keep that, and defer everything else in one pass. Deferring
is not a verdict, so it needs no review: what matters comes back through a bug,
a spec or a question.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

**When setup calls this** before the gate exists or while reinstalling it, use
the tracker operations, snapshot location and proposed config that setup has
verified, instead of the integration. Do not send the user back to setup. Do
the inventory and the agreed cleanup, then return to setup, which installs and
proves the gate. If the queue is already usable, say so and change nothing in
bulk. Work waiting for acceptance is live: keep it.

Everything the owner reads follows the protocol's **Speaking to the owner**.

## 1. Take the snapshot

**Before you change anything**, save the adapter's export beside the gate's
config (during setup, before the adapter exists, a native tracker export).
A bulk edit resets every timestamp it touches, and later analysis would read
month-old issues as active today. Save a second snapshot right after the bulk
edit. Run the gate with `--ages-from <before>` and `--ages-through <after>`: it
restores an old timestamp only while the current one still equals the bulk
edit's, so later real work keeps its new timestamp. Check that this holds for
the tracker's timestamp precision.

Done when the snapshot exists and can be read. Outside setup, check that the
installed gate reads it.

## 2. Measure

One table of numbers: open, ready, active, deferred, roots with live work,
active issues with no movement within the hold limit, open issues untouched
past the stale limit, and gate violations per check. Step 7 repeats it beside
the new numbers. During setup, use the tracker's own counts and read its
dependencies directly; mark gate counts unavailable until the adapter and rules
exist. Keep both native snapshots and normalize them once the adapter is ready.

## 3. Agree the slice with the owner

The slice is the current milestone: what is actually being built now. Gather
the evidence first: recently moved issue trees, tasks named in recent commits,
work genuinely in progress. Propose the features it points to, by name, and
reuse an agreed slice that still fits. Say what stays live and what waits. Do
not ask the owner to pick tracker labels or read dependency ids. The slice can
be confirmed together with step 4's proposal or setup's profile; do not ask
again for a choice already approved.

If the config has no current milestone, this step creates one: a label named
for what ships, written to `currentMilestone` and `milestoneLabels`, and put on
the root of every feature in the slice. Its charter comes later, from
`/to-milestone`.

Done when the owner has confirmed the slice by name, the config names the
milestone, and every root in the slice carries its label.

## 4. Propose the cleanup

Everything live outside the slice is deferred with a review date. Show the
proposal as **counts by kind**, not a list of issues:

- later-milestone features with their whole trees: deferred, keeping that
  milestone's label so they come back whole;
- bugs untouched past the stale limit: deferred;
- brainstorms and proposals: moved to the ideas lane;
- catch-all issues that absorb any new bug in their area: deferred, since they
  can never finish;
- tasks marked as taken that nobody is working on: returned to the queue;
- tasks held under the person's name that an agent is actually doing: moved
  to that agent, since the holder is whoever does the work.

For each kind, say what it means, why, how it affects current work and how to
undo it. The owner accepts the whole proposal or pulls items back by name.
**Nothing is closed or deleted.** Do not take work away from someone active,
and do not defer an independent feature because another one is running. Get
approval for the bulk scope unless the user already authorized exactly this
cleanup.

## 5. Apply it reversibly

For each issue, record prior and new values of status, labels, parent,
dependencies, holder and review date, plus config changes. Apply with the
tracker's operations, then record the results and the after snapshot. Rollback
restores exactly those fields; before restoring, compare current values with
the recorded results so later work by someone else is not overwritten. The
integration documents the restore operation and any field it cannot restore.

## 6. Mend the dependencies

Run the gate with both snapshots once it exists. Fix:

- a live issue **blocked by a deferred one**: bring the blocker into the slice,
  or defer the blocked issue too;
- a **stale dependency**: remove it, or move it to the task that really needs
  that result or conflicts with it;
- dependency cycles. Age alone does not make a real prerequisite unnecessary.

Investigate what each dependency really needs yourself and propose the repairs
as a group, with their consequences. Routine repairs within the approved
cleanup need no question each. Only an open scope or priority trade-off goes
to the owner, one at a time, with a recommendation and real alternatives.

Record the bulk edit's date and both snapshot paths under "The gate" in the
project's backlog integration.

Done when the gate is clean (`new errors: 0`) and the agreed slice, the current
milestone's live work, has no errors. Older errors outside the slice may remain:
list them by kind with a plan (fixed when their work enters a milestone, or
closed with it), so they stay visible without holding up work. During setup, hand the result back for gate
proof rather than claiming the proof. Then publish through the project's
authorized workflow.

## 7. Report

Step 2's table with an "after" column, the rollback file, and the slice by name
with the tasks that can start now. Then one line: what to run next, which is
`/to-milestone` if the slice has no charter.
