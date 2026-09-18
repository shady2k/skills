---
name: diagnose-bug
description: Find the cause of a bug that resists a first look, or of a slowdown, by building a command that goes red on it before theorising. Use when the user says "debug this" or "diagnose", reports something broken, failing, flaky or slow, or when a fix that should have worked did not.
---

# Diagnose bug

For the bug that did not yield to a glance. The whole discipline is one rule:
**no theory before there is a command that goes red on this bug.** Reading code
to build a story first is the failure this skill exists to prevent.

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

Cannot build one: **stop and say so**, with what you tried, and ask for access
to where it reproduces, a captured artifact, or leave to instrument
production. Do not go on without it.

## 2. Reproduce, then minimise

Watch it go red, on the failure the **user** described and not a neighbour of
it. Then cut inputs, callers, config and steps **one at a time**, re-running
after each, until removing anything more turns it green. What is left is the
hypothesis space, and later the regression check.

## 3. Hypotheses, plural

Three to five, ranked, before testing any: one hypothesis anchors on the first
plausible idea. Each states its prediction: "if X is the cause, changing Y
makes it disappear". No prediction, no hypothesis. Show the list to the user;
they often re-rank it in a sentence. Do not wait for them if they are away.

## 4. Probe

One variable at a time, each probe tied to one prediction. A debugger before
logs; logs only at the boundaries that tell hypotheses apart; never everything.
Tag every temporary line with one unique prefix, so removing them is one
search. For a slowdown, measure first: a baseline, then bisect.

## 5. Fix, behind a check

Turn the minimised repro into a failing check **at a seam where the bug really
occurs**, watch it fail, fix, watch it pass, then run the loop of step 1 on the
original, un-minimised case.

If no seam can hold the real pattern, a check at a shallower one is false
comfort. **That there is no seam is itself the finding**: say so.

## 6. Leave nothing behind

- The original loop is green; the regression check exists, or its absence is
  explained.
- Every tagged line is gone; throwaway harnesses are deleted.
- The commit says which hypothesis was right, so the next person learns it.
- Where the project has a backlog integration, what this found goes through
  it: call the Skill tool with "to-backlog" for the bug itself if it was never
  filed, and for a missing seam, which is debt. Its criterion is already
  written: the command of step 1.
