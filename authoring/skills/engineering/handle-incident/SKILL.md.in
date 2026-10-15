---
name: handle-incident
description: "Restore a product that is failing in use — then find its cause through diagnose-bug, then hold a blameless review whose actions become tracked work. Starts only on the user's request or agreement, because it changes what runs for users while it works; a prototype and a library carry none of it, and a service with users does."
---

# Handle incident

A product that is failing in use costs its users by the minute, whatever
its cause turns out to be, so the order is fixed and kept apart from the
bug work it runs later: restore first, the cause after, the review last.
What the skill carries is also proportionate by the life cycle's
[**Tailoring is the rule**](references/lifecycle.md): a prototype and a
library have no run to break, and where the product has users the whole
skill applies. Everything the owner reads
follows the protocol's [**Speaking to the owner**](references/speaking.md),
while the service is down too: what the matter is in users' words, what is
being done, and when the next word will come, by **Waiting is quiet**.

## 1. Restore first

Take the fastest reversible move that stops what is failing. A move that
reaches outside this checkout — a rollback, a switch turned off, a deploy — is
taken by [running.md](references/running.md)'s **An effect outside this
checkout is asked of the system that took it**, so a session taking the
incident over does not roll back what is already back. The evidence
about what changed — the last release, the last deploy, the last
migration, the last change of configuration — ranks the moves, and they
are applied in the order of what can be undone: the last change taken out
(a rollback, on the reverses `ship-release` named for its steps), the
failing feature switched off where the product can call one off in
flight, and what still runs degraded to what serves — a service on half
its breadth beats a second outage from a guessed fix. A move that would
destroy anything — wiping what the failing state touched, a store
emptied — is put to the owner first, by
[running.md](references/running.md)'s **Autonomy**. The cause is not
sought here; the notes the restore takes are a timeline — what was seen,
and when, from the alert and the measure — never a theory. The restore
ends on the measure, not on someone's say-so: the design's scenario for
the service holds again and the alert that fired comes back green, by
[design.md](references/design.md)'s **Scenarios become checks** — and
that return is said in what users now see.

## 2. Then the cause

Through `diagnose-bug`, whose rules run unchanged: a reproducible
symptom, ranked hypotheses, a probe that can show the cause by
[deciding.md](references/deciding.md)'s **A claim reaches only as far as
its evidence**. The restore gives this work more than it usually has: the
state that failed is preserved where it otherwise would be lost — the
logs, what was changed back, a copy of what was rolled away — so the loop
is built on what the service was really doing, not on what was remembered.
An approved fix is tracked work, by
[keeping.md](references/keeping.md)'s **Tracked work**; a fix that again
changes what runs for users goes out as a release does — its reverse named
before it runs, a check after it — through `ship-release` where the project
releases.

## 3. The review

Blameless, the way Google SRE's postmortems practice it: nothing in it
names a person, and what caused the incident is traced to the decision
that made it possible — the agent's own decisions included, by
[speaking.md](references/speaking.md)'s **A decision belongs to whoever
made it** — because a failure with an owner already assigned is a failure
nobody looks into. The review answers, from the timeline and the
measures, not from memory: what the incident cost users — the objective
and what it spent of its error budget, where the product holds one;
what made it possible; what made it harder to see or to stop; and what
now changes — the design, the checks, the alerts and the runbooks they
carry, the reverses a release keeps, the words the product says when it
fails.

The record is short: the timeline, the cost, what changed, what was
filed. What the review turns into is work, not prose: filed through
`to-backlog` where the project has a backlog integration, and named to
the owner with who keeps it where there is none. A lesson that would
cost time again lands where every agent reads it, by
[keeping.md](references/keeping.md)'s **A lesson that outlives the work
is kept where every agent reads**; the rest is tracked work like any
other, and the review closes by naming the next action over what it
filed.
