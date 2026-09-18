---
name: groom-backlog
description: "Restore a usable backlog by snapshotting it, choosing the live slice and deferring the rest. Use during setup before gate installation, or when the backlog has stopped being a queue."
---

# Groom backlog

A backlog with hundreds of ready issues is a dump with an index. Reviewing it
issue by issue is a project of its own that ends with a stale review. This is
an **amnesty**: declare what is being worked on, keep that, and defer
everything else in one pass. Deferring is no judgement about truth, so it needs
no review: what matters comes back by itself through a bug, a spec or a
question, and what has not come back in a quarter was not needed.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

**Bootstrap exception:** when setup invokes this before the gate exists or while
migrating it, use setup's verified tracker operations, snapshot location and
proposed config as the integration. Do not send the user back to setup in a loop.
Perform the inventory and agreed cleanup first; return to setup to install and
prove the gate. For an already usable queue, report that fact and make no bulk
changes. Implemented work waiting for acceptance is live work to preserve.

## 1. Take the snapshot

Save the adapter's output (or a native tracker export during bootstrap, before
the adapter is available) **before you touch anything**, beside the
gate's config. A bulk edit rewrites every timestamp it touches, and the next
analysis will read issues untouched for a month as active today. Save a second
snapshot immediately after the bulk edit. Use `--ages-from <before>` together
with `--ages-through <after>`: restore an old timestamp only while the current
timestamp still equals the bulk edit's timestamp. Later real work keeps its
new timestamp. Revalidate this mechanism for the tracker's timestamp precision.

Done when the snapshot exists and can be read; during bootstrap, gate proof
follows cleanup. Outside bootstrap, verify the installed gate can read it.

## 2. Measure

Show one table, numbers only: open, ready, active, deferred, roots with live
work, active issues whose trees have not moved within the hold limit, open
issues untouched past the stale limit, and the gate's violations per check.
Keep it; step 7 prints it again beside the new numbers. During bootstrap, use
the tracker's own counts and inspect its dependencies directly; mark gate
counts unavailable until setup builds the adapter and runs the rules. Retain
native before/after snapshots and normalize both once the adapter is ready.

## 3. Declare the slice, with the owner

The slice is the current milestone: what is actually being built now. Find the
evidence before asking: issues whose trees moved recently (ages from the
snapshot), what recent commits name, what is genuinely held. Present the
features that evidence points at and reuse a still-valid agreed slice. If it
needs a decision, recommend it by **name**, explaining what stays live and what
would wait. Use the established role, otherwise product engineer; do not ask
the user to choose tracker labels or interpret raw dependency identifiers.
The slice can be confirmed together with the cleanup proposal in step 4 or
setup's profile; do not ask again if that exact choice is already approved.
No current milestone in the config means this step declares one: a
label named for what ships, written to the config's `currentMilestone` and
`milestoneLabels`, and put on the root of every feature in the slice with the
tracker's milestone verb. Its charter is `/to-milestone`'s job, afterwards.

Done when the owner has confirmed the slice by name, the config carries the
milestone, and every root in the slice wears its label.

## 4. Propose the amnesty

Everything live outside the slice is deferred with a review date. Show the
proposal as **counts by kind**, never as a list of issues:

- features and their whole trees belonging to a later milestone: deferred with
  that milestone's label intact, so they come back whole;
- bugs not touched past the stale limit: deferred;
- brainstorms and proposals: into the ideas lane;
- catch-all issues that can absorb any new bug of their area: deferred; they
  can never finish;
- holds nobody is holding: released.

Explain what each proposed action means, why it is recommended, how it affects
current work and how to reverse it. Let the owner accept the proposal together
or pull anything back by name. **Nothing is closed or deleted.**
Do not steal live assignments or defer independent features merely because
another feature is executing. Get approval for the proposed bulk scope unless
the user already authorized that exact cleanup.

## 5. Apply it, reversibly

Record each issue's prior and proposed values for status, labels, parent,
dependencies, holder and review date, plus config changes. Apply with the
tracker's verbs, then record resulting values and the after snapshot. Rollback
restores those changed fields, not just undefer; compare current values with
the recorded result first so a later person's work is not overwritten. The
integration must document the restore operation and any non-restorable fields.

## 6. Mend the edges

Run the gate with both age snapshots once it is available. Two checks now matter: a
live issue **blocked by a deferred one** (pull the blocker into the slice, or
defer the blocked one too), and a **stale edge** (unlink it, or move it onto
the leaf that really needs the result or conflicts). Also resolve dependency
cycles; age alone does not make a genuine prerequisite unnecessary. Investigate
the required results yourself and group evidence-backed repairs into a proposal
with their consequences. Routine metadata repairs within approved cleanup need
no per-edge question. Only an unresolved scope or priority trade-off goes back
to the owner, one at a time, with a recommendation and real alternatives.

Record the bulk edit's date and both snapshot paths under "The gate" in the
project's backlog integration.

Done when the gate's report shows no error-severity violation at all, old or
new: a dig-out that leaves errors behind has only moved the mess. During setup,
return the cleanup result for gate proof instead of claiming that proof already
happened. Then publish through the authorized project workflow.

## 7. Report

The table from step 2 with a second column, the rollback file, and the slice by
name with its ready queue. Then one line: what the owner runs next, which is
`/to-milestone` if the slice has no charter.
