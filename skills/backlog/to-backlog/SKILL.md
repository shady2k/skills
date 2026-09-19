---
name: to-backlog
description: File a bug, an idea, a piece of debt or an outside request into the backlog lane it belongs in. Use when the user reports a bug or asks to create an issue, when a bug or debt turns up in the middle of other work, when the user voices an idea or a wish, or before creating any issue by hand.
---

# To backlog

Everything that arrives goes into exactly one **lane**, and the lane decides
whether it may touch the current queue. Filing straight to the front is how a
feature slips by weeks without anyone deciding it should.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

## 1. Look for it first

Duplicates are usually paraphrases, not copies. Search for the **behaviour** in
two different phrasings, then for the words. If you cannot phrase it two ways,
read the whole list for its area. If it exists, work on it or extend it; never
file a second issue beside it.

Done when both searches and the area list come back empty, or you found the
issue that already covers it.

## 2. Pick the lane

| what arrived | lane |
| --- | --- |
| an idea, a wish, a "what if" | the **ideas** lane, with a review date |
| a bug or debt on the current milestone's path | **finding**: under the stage it serves, with the finding label and the current milestone's label; step 3 first |
| a bug or debt off that path | deferred, under its feature, or with no parent if it has none |
| planned work the charter already names | `to-stages` when breaking it down is authorized; otherwise send it that way. A fix needed to meet an agreed criterion is part of that work, not a finding |
| work for a later milestone | deferred, with that milestone's label, as a feature title only |
| a question that blocks building | work, under the stage it blocks; it is not an idea |

A finding that needs its own feature is a scope decision for the owner: join
the current milestone by an explicit scope and budget change, or wait deferred.
Joining the slice gives a feature no dependencies on other features.

## 3. A finding spends the budget

Read the finding budget from the config and count the milestone's findings.
Within budget, file it and carry on. At or over budget, file it as deferred and
bring the decision to the owner: leave it for later, or replace named planned
work and approve the new count. If they replace, update the budget in the
config and record the decision in the charter with what was displaced.
Deferring planned work does not lower the count of findings. Do not make an
unapproved finding ready; filing it need not wait for the decision.

Recommend what to do: what would ship later, or what risk remains if it waits,
and how that fits the agreed scope. Group related decisions. Do not ask about
routine labels or fields. "Use defaults" does not allow raising the budget or
widening the milestone. Speak as the protocol's **Speaking to the owner** says.

## 4. Write it so it can be finished

- A **title that is a sentence**: the work is clear from it alone.
- **Exactly one area label**, for the area that owns the behaviour.
- An observable criterion and what would disprove it. For a bug: what a person
  does, what happens, what should happen, and the requirement it breaks, if any.
- For anything larger than a task, **what is deliberately left out**.

## 5. Publish and prove

Create it with the tracker's operations and run the gate. Done when the gate is
clean; fix a new error with its own `fix` line. A `finding-budget` error means
step 3 was skipped. Then publish. Report "Title" (id) with its lane and, for a
finding, the budget after it: "finding 4 of 5".
