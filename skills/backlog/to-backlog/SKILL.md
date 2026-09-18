---
name: to-backlog
description: File a bug, an idea, a piece of debt or an outside request into the backlog lane it belongs in. Use when the user reports a bug or asks to create an issue, when a bug or debt turns up in the middle of other work, when the user voices an idea or a wish, or before creating any issue by hand.
---

# To backlog

Everything that arrives goes into exactly one **lane**, and the lane decides
whether it may touch today's queue. Filing straight to the front is how a
feature slips a fortnight without anybody deciding that it should.

`docs/agents/backlog.md` should have been provided to you: the protocol, the
gate command and the tracker verbs. If not, tell the user to run
`/setup-shady2k-skills`.

## 1. Search the behaviour

Duplicates are rarely near-copies: the same thing gets filed twice in two
paraphrases by somebody who did search. Search for the **behaviour** in two
different phrasings, then for the words. When you cannot phrase it two ways,
read the whole listing of its area. A hit is worked or extended, never
shadowed by a second issue.

Done when two phrasings and the area listing have come back empty, or you have
found the issue that already owns this.

## 2. Pick the lane

| what arrived                                                      | lane                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| an idea, a wish, a "what if"                                       | the **ideas** lane, with a review date                                                   |
| a bug or debt on the path of the current milestone                | **finding**: under the stage it serves, wearing the finding label and the current milestone's label, and step 3 before it is filed |
| a bug or debt off that path                                       | deferred, under the feature it belongs to, or with no parent when it belongs to none     |
| planned work the current milestone's charter already names        | tell the user `/to-stages` owns it. The exception is a task a stage turned out to be missing at close-out: that is a finding |
| work for a later milestone                                        | deferred, under that milestone's label, as a feature title and nothing finer             |
| a question that blocks a build                                    | work, under the stage it gates. It was never an idea                                     |

A finding that turns out to be structural becomes a feature of its own, which
is the owner's decision and the next charter's business.

## 3. A finding spends the budget

Count the current milestone's findings against the charter's budget. Within it:
file and carry on. **At or beyond it, stop and take it to the owner**, by name,
with the two honest options: it goes to the next milestone, deferred, or it
displaces something that is named and deferred in the same minute. Never file
it to the front and mention it later.

## 4. Write it so it can be finished

- A **title that is a sentence**: the work can be understood from it alone.
- **Exactly one area label**, by the area that owns the behaviour.
- A criterion that **stops being false exactly once**, and what would show it
  false. For a bug: what a person does, what happens, what should.
- For anything larger than a task, **what is deliberately out**.

## 5. Publish and prove

Create it with the tracker's verbs and run the gate. Done when the gate is
clean; a new error is fixed by its own `fix` line, and a `finding-budget` error
means step 3 was skipped. Then publish. Report it as "Title" (id) with its
lane, and for a finding, the budget after it: "finding 4 of 5".
