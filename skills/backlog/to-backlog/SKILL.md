---
name: to-backlog
description: "File a bug, a piece of debt, an outside request or an idea to keep into the backlog lane it belongs in. Use as soon as the user reports a problem in any words (\"I think I found a bug\", \"X does not work\", \"make dev fails\"), before investigating it; when they ask to create an issue or to keep an idea or wish for later; when a bug or debt turns up during other work; and before creating any issue by hand. An idea only being discussed stays in the conversation."
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

Then look the other way: is there open work that retires the thing this is in?
Where there is, settle it by the protocol's **What would make the work obsolete
is read before it is paid for**, and tell the owner once what it costs
while the replacement is built.

Done when both searches and the area list come back empty, or you found the
issue that already covers it.

## 2. Pick the lane

| what arrived | lane |
| --- | --- |
| an idea, a wish, a "what if" | the **ideas** lane, with a review date |
| a bug or debt on the current milestone's path | **finding**: under the stage it serves, with the finding label and the current milestone's label; step 3 first |
| a defect a required check caught on the way to a merge, fixed to make it green; or a fault in the set's own checks, hooks, connect command or their CI wiring | not a finding, by the protocol's **Only what the milestone chose is intake**: with the work whose merge it blocks, or with the setup task: under it where it is a container, beside it where it is a leaf. What the work leaves unfixed is a finding |
| a bug or debt off that path | deferred, under its feature, or with no parent if it has none |
| planned work the charter already names | `to-stages` when breaking it down is authorized; otherwise send it that way. A fix needed to meet an agreed criterion is part of that work, not a finding |
| work for a later milestone | deferred, with that milestone's label, as a feature title only |
| a question that blocks building | work, under the stage it blocks; it is not an idea |
| a question for the owner that blocks nothing now, often met by a run working alone | a decision the owner holds: a leaf under the feature it concerns, open and never active, with no finding label and no budget; its body says what it affects, the agent's recommendation and what holds meanwhile. One about work beyond this milestone goes to the ideas lane, worded as the question |
| a condition the owner put on when something may be done | onto the thing it governs, by the protocol's [**A decision the owner gives is kept, not only obeyed**](references/speaking.md) |

A finding that needs its own feature is a scope decision for the owner: join
the current milestone by an explicit scope and budget change, or wait deferred.
Joining the slice gives a feature no dependencies on other features.

## 3. A finding spends the budget

First check it is one: a repair a merge waits on, or upkeep of the installation,
spends no budget, by the protocol's **Only what the milestone chose is
intake**. Then read the finding budget from the config and count the
milestone's findings. Within budget, file it and carry on. At or over budget,
file it as deferred and bring the decision to the owner: leave it for later, or
replace named planned work and approve the new count. If they replace, update
the budget in the config and record the decision in the charter with what was
displaced; the count is of what the milestone took in, as the protocol's
findings lane says. Do not make an unapproved finding ready; filing it need
not wait for the decision.

Where the milestone it would join is already closed and the next one does not
exist, the protocol's **A finding that does not fit is decided, not parked**
holds: the next slice, opened now through `to-milestone` or knowingly waited
for, is the third option. The deferred issue holds the finding while the owner
decides; the gate going clean is never the reason it was made.

Recommend what to do: what would ship later, or what risk remains if it waits,
and how that fits the agreed scope. Group related decisions. Do not ask about
routine labels or fields. "Use defaults" does not allow raising the budget or
widening the milestone. Speak as the protocol's [**Speaking to the
owner**](references/speaking.md) says.

## 4. Write it so it can be finished

- A **title that is a sentence**: the work is clear from it alone, and each
  part is called by the glossary's name for it.
- **Exactly one area label**, for the area that owns the behaviour.
- An observable criterion and what would disprove it. For a bug: what a person
  does, what happens, what should happen, and the requirement it breaks, if any.
- For anything larger than a task, **what is deliberately left out**.

## 5. Publish and prove

Create it with the tracker's operations and run the gate. Done when the gate is
clean; fix a new error with its own `fix` line. A `finding-budget` error means
step 3 was skipped: satisfy it with step 3's decision, never around it (the
protocol's [**A gate that refuses is not routed around**](references/checks.md)).
Then publish by the protocol's [**Sessions and landing**](references/running.md):
the record waits for the session's one merge. Report "Title" (id) with its
lane, read back from the tracker as in the ledger of [**End with the next
step**](references/speaking.md), and, for a finding, the budget after it:
"finding 4 of 5". A finding held for the owner's
decision says so and what it is waiting on.
