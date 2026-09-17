---
name: groom-backlog
description: Dig out a backlog that has stopped being a queue, by amnesty rather than review. Declare the slice, keep what is alive, defer the rest.
disable-model-invocation: true
---

# Groom backlog

A backlog with hundreds of ready issues is a dump with an index. Reviewing it
issue by issue is a project of its own that ends with a stale review. This is
an **amnesty**: declare what is being worked on, keep that, and defer
everything else in one pass. Deferring is no judgement about truth, so it needs
no review: what matters comes back by itself through a bug, a spec or a
question, and what has not come back in a quarter was not needed.

`docs/agents/backlog.md` should have been provided to you: the protocol, the
gate command and the tracker verbs. If not, tell the user to run
`/setup-shady2k-skills`.

## 1. Take the snapshot

Save the adapter's output to a file **before you touch anything**, beside the
gate's config. A bulk edit rewrites every timestamp it touches, and the next
analysis will read issues untouched for a month as active today. Every age in
this session and after it is read from that snapshot: `--ages-from <snapshot>`
on the gate command.

Done when the snapshot file exists and the gate runs with it.

## 2. Measure

Show one table, numbers only: open, ready, active, deferred, roots with live
work, active issues whose trees have not moved within the hold limit, open
issues untouched past the stale limit, and the gate's violations per check.
Keep it; step 7 prints it again beside the new numbers.

## 3. Declare the slice, with the owner

The slice is the current milestone: what is actually being built now. Find the
evidence before asking: issues whose trees moved recently (ages from the
snapshot), what recent commits name, what is genuinely held. Present the
features that evidence points at and ask the owner to confirm the slice by
**name**. No current milestone in the config means this step declares one: a
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

The owner may pull anything back by name. **Nothing is closed.**

## 5. Apply it, reversibly

Write the ids of every issue you are about to change to a file, one list per
kind, and tell the owner where it is. Then apply with the tracker's verbs, in
bulk. Rollback is that file: the undefer verb over its lists.

## 6. Mend the edges

Run the gate with `--ages-from` the snapshot. Two checks now matter, and each
violation is a decision of a few words for the owner, taken one at a time: a
live issue **blocked by a deferred one** (pull the blocker into the slice, or
defer the blocked one too), and a **stale edge** (unlink it, or move it onto
the leaf that really collides).

Record the bulk edit's date and the snapshot's path under "The gate" in
`docs/agents/backlog.md`.

Done when the gate's report shows no error-severity violation at all, old or
new: a dig-out that leaves errors behind has only moved the mess. Then publish.

## 7. Report

The table from step 2 with a second column, the rollback file, and the slice by
name with its ready queue. Then one line: what the owner runs next, which is
`/to-milestone` if the slice has no charter.
