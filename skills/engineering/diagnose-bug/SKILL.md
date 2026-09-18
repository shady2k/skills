---
name: diagnose-bug
description: "Investigate a bug or slowdown through reproducible symptoms and distinguishing evidence. Use for diagnosis, stubborn failures or flaky behaviour; fixing requires an authorized tracked task."
---

# Diagnose bug

For the bug that did not yield to a glance. Seek a reproducible symptom and
testable hypotheses rather than a plausible story. A diagnosis request permits
investigation, not an automatic fix or commit. Implement a fix only when that
was requested or is already part of the current tracked task.

Redact every secret in anything you show, and build the loop against the
environment's variables so a credential never reaches the transcript.

## 1. Build the loop

One command, already run once, that is:

- **red on this bug**: it drives the real path and asserts the **user's exact
  symptom**, not "does not crash";
- **deterministic**, or for a flake, red at a pinned rate high enough to work
  against;
- **fast**: seconds;
- **runnable by you alone**.

Ways to get one, roughly in this order: a failing test at whatever seam reaches
the bug; a script against a running instance; a command line with a fixture
input, diffed against a known-good output; a headless browser; a **replayed
capture** (a saved request, payload or event log pushed through the path in
isolation); a throwaway harness around the one module; a loop of a thousand
random inputs for "sometimes wrong"; a bisection between two known states; the
same input through the old and the new version, diffed. A person clicking is
the last resort, and then a script drives the person.

Then **tighten** it: faster (skip unrelated setup), sharper (assert the
symptom), steadier (pin the clock, seed the randomness, isolate the
filesystem). For a flake the aim is not a clean repro but a **higher rate**:
loop it, parallelise it, add load, narrow the window. One in two is workable;
one in a hundred is not.

Cannot build one: say what is missing and use existing logs, captures, code
inspection or bounded experiments to narrow the possibilities. Separate facts
from hypotheses and do not claim a cause is proved without distinguishing
evidence. Request the missing artifact or access when necessary; instrumenting
production requires appropriate authorization. A slow or rare failure need
not be abandoned just because it cannot be reduced to a seconds-long loop.

## 2. Reproduce, then minimise

Watch it go red, on the failure the **user** described and not a neighbour of
it. Then cut inputs, callers, config and steps **one at a time**, re-running
after each, until removing anything more turns it green. What is left is the
hypothesis space, and later the regression check.

## 3. Hypotheses, plural

Rank the plausible alternatives before committing to one; do not invent extra
hypotheses to meet a quota. Each states its prediction: "if X is the cause, changing Y
makes it disappear". No prediction, no hypothesis. Show the list to the user;
they often re-rank it in a sentence. Do not wait for them if they are away.

## 4. Probe

One variable at a time, each probe tied to one prediction. A debugger before
logs; logs only at the boundaries that tell hypotheses apart; never everything.
Tag every temporary line with one unique prefix, so removing them is one
search. For a slowdown, measure first: a baseline, then bisect.

## 5. Fix, behind a check

For diagnosis only, return the cause or remaining hypotheses, evidence and the
proposed repair here. For an authorized fix, resolve or file the owning task
through the backlog integration **before** implementation; without integration,
request setup before retained changes. Keep the original symptom as its criterion.

Turn the minimised repro into a failing check **at a seam where the bug really
occurs**, watch it fail, fix, watch it pass, then run the loop of step 1 on the
original, un-minimised case.

If no seam can hold the real pattern, a check at a shallower one is false
comfort. **That there is no seam is itself the finding**: say so.

## 6. Leave nothing behind

- The original loop is green; the regression check exists, or its absence is
  explained.
- Every tagged line is gone; throwaway harnesses are deleted.
- Any authorized commit links the task and says which hypothesis was supported.
- Local regression checks do not close the task: return the result to the
  stage's integration and final acceptance workflow.
- Where the project has a backlog integration, what this found goes through
  it: use "to-backlog" for additional findings such as a missing seam.
  The original bug was resolved before implementing its fix. Its criterion is
  written: the command of step 1.
