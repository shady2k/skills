---
name: to-backlog
description: File a bug, an idea, a piece of debt or an outside request into the backlog lane it belongs in. Use when the user reports a bug or asks to create an issue, when a bug or debt turns up in the middle of other work, when the user voices an idea or a wish, or before creating any issue by hand.
---

# To backlog

Everything that arrives goes into exactly one **lane**, and the lane decides
whether it may touch today's queue. Filing straight to the front is how a
feature slips a fortnight without anybody deciding that it should.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. The
protocol (levels, lanes, the horizon, what a clean gate is) is
[`protocol.md`](protocol.md), beside this file.

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
| planned work the current milestone's charter already names        | use `to-stages` when decomposition is authorized; otherwise return that route. A correction needed to meet an agreed criterion remains that work, not automatically a budgeted finding |
| work for a later milestone                                        | deferred, under that milestone's label, as a feature title and nothing finer             |
| a question that blocks a build                                    | work, under the stage it gates. It was never an idea                                     |

A finding that needs its own feature is a scope decision for the owner. It can
join the current milestone by an explicit scope/budget change, or wait deferred.
Independent features do not acquire dependencies merely by joining the slice.

## 3. A finding spends the budget

Read the current budget from config and count the milestone's findings. Within
it, file and carry on. At or beyond it, preserve the discovery as deferred and
take the admission decision to the owner: leave it for later, or replace named
planned work and explicitly approve the new finding count. In the latter case,
update the config budget and record the charter decision together with the
displacement. Deferring planned work alone does not reduce a count of findings.
Do not make an unapproved finding ready; registration need not wait for admission.

## 4. Write it so it can be finished

- A **title that is a sentence**: the work can be understood from it alone.
- **Exactly one area label**, by the area that owns the behaviour.
- An observable criterion and what would falsify it. For a bug: what a person
  does, what happens, what should, and the source requirement where one exists.
- For anything larger than a task, **what is deliberately out**.

## 5. Publish and prove

Create it with the tracker's verbs and run the gate. Done when the gate is
clean; a new error is fixed by its own `fix` line, and a `finding-budget` error
means step 3 was skipped. Then publish. Report it as "Title" (id) with its
lane, and for a finding, the budget after it: "finding 4 of 5".
