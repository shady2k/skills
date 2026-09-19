---
name: diagnose-bug
description: "Investigate a bug or slowdown through reproducible symptoms and distinguishing evidence. Use for diagnosis, stubborn failures or flaky behaviour; fixing requires an authorized tracked task."
---

# Diagnose bug

For the bug that a quick look did not solve. Look for a reproducible symptom
and testable hypotheses, not a plausible story. A request to diagnose permits
investigation, not a fix or a commit. Fix only when that was asked for or is
already part of the current tracked task.

Talk in the user's language. Anything kept in the project is written in its
artifact language: the gate config's `artifactLanguage` where there is one;
otherwise ask once before the first thing is kept, recommending English.

Hide every secret in anything you show. Read credentials from environment
variables so none reaches the transcript.

## 1. Build the loop

One command, already run once, that is:

- **red on this bug**: it drives the real path and checks the **user's exact
  symptom**, not "does not crash";
- **deterministic**, or for a flaky bug, failing at a known rate high enough to
  work with;
- **fast**: seconds;
- **runnable by you alone**.

Ways to get one, roughly in this order: a failing test wherever the bug can be
reached; a script against a running instance; a command with a fixed input,
compared with a known-good output; a headless browser; a **replayed capture**
(a saved request, payload or event log pushed through that path alone); a
throwaway harness around one module; a thousand random inputs for "sometimes
wrong"; bisection between a good and a bad state; the same input through the
old and new version, compared. A person clicking is the last resort, and then
a script tells them what to click.

Then **tighten** it: faster (skip unrelated setup), sharper (check the
symptom), steadier (fix the clock, seed randomness, isolate the filesystem).
For a flaky bug, aim for a **higher failure rate**, not a clean repro: loop it,
run it in parallel, add load, narrow the timing. One in two is workable; one in
a hundred is not.

If you cannot build one, say what is missing and narrow the options with
existing logs, captures, code reading or small experiments. Keep facts apart
from hypotheses; do not call a cause proved without evidence that rules out
the others. Ask for a missing artifact or access when needed; adding
instrumentation to production needs permission. A slow or rare failure is
still worth pursuing even if it never fits a seconds-long loop.

Ask the user only for evidence you cannot get yourself. Use their known role,
otherwise product engineer: say what the observation will tell apart, recommend
the least disruptive way to get it, and its effort and risk. Do not make them
pick debugging tools or repeat known facts.

## 2. Reproduce, then minimise

See it fail on the failure the **user** described, not a similar one. Then
remove inputs, callers, config and steps **one at a time**, re-running after
each, until removing anything more makes it pass. What is left is where the
cause hides, and later becomes the regression check.

## 3. Several hypotheses

Rank the plausible explanations before choosing one; do not invent extras to
fill a quota. Each makes a prediction: "if X is the cause, changing Y makes it
disappear". No prediction, no hypothesis. Show the ranking in terms the user
can judge, with the next probe you recommend and why. Invite corrections of
fact, not approval of each hypothesis, and keep investigating safely without
waiting for it.

## 4. Probe

Change one thing at a time, each probe testing one prediction. Prefer a
debugger to logs; log only where it tells hypotheses apart, never everywhere.
Mark every temporary line with one unique prefix so one search removes them
all. For a slowdown, measure first: a baseline, then bisect.

## 5. Fix, behind a check

For diagnosis only, return the cause or the remaining hypotheses, the evidence
and the proposed fix. For an approved fix, find or file its task through the
backlog integration **before** implementing; without an integration, ask for
setup before keeping changes. The original symptom stays the fix's criterion.

Turn the minimised repro into a failing check **at the boundary where the bug
really happens** (a public interface, endpoint or command where the behaviour
can be observed). See it fail, fix, see it pass, then run the step 1 loop on
the original, full case.

If no such boundary can reproduce the real pattern, a check at a shallower one
gives false comfort. **The missing boundary is itself the finding**: say so.

## 6. Leave nothing behind

- The original loop passes; the regression check exists, or why it does not is
  explained.
- Every marked line is gone; throwaway harnesses are deleted.
- Any approved commit names its task and says which hypothesis was confirmed.
- Passing local checks do not close the task: hand the result to the stage's
  merge and final acceptance.
- Where the project has a backlog integration, file other findings, such as a
  missing boundary, through `to-backlog`. The original bug's task existed
  before the fix; its criterion is the step 1 command.
