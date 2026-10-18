# The normalized backlog

The only thing the rules know. No rule mentions a tracker, a file path, a
project or a label that is not in its own config — if one does, it has stopped
being portable and the adapter should have absorbed the difference.

An adapter reads whatever the project's store holds and prints this. The
`source` line says what was read: the store and the place it was read from, and
the revision the state was read at — when the read is at a code revision, that
revision — so the state being judged says which revision it stands for:

```json
{
  "generatedAt": "2026-09-17T19:40:00Z",
  "source": "<store> <where it was read> @ <revision>",
  "issues": [
    {
      "id": "PRJ-101",
      "title": "A person can do the thing they could not do before",
      "type": "epic",
      "status": "active",
      "labels": ["transport", "milestone", "v1-2"],
      "parent": null,
      "blockedBy": ["PRJ-87"],
      "body": "…full description, for the checks that read it…",
      "updatedAt": "2026-09-17T17:05:00Z",
      "createdAt": "2026-08-30T09:12:00Z",
      "holder": "somebody",
      "comments": [
        { "id": "c-9031", "at": "2026-09-17T16:40:00Z", "author": "somebody", "body": "[shady2k-time v1] claim\n…" }
      ]
    }
  ]
}
```

| Field       | Values                                     | Notes                                                        |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| `type`      | `epic` `task` `bug` `chore` `other`        | Anything the tracker calls something else maps to `other`.   |
| `status`    | `open` `active` `submitted` `implemented` `deferred` `closed` | `submitted` awaits integration; `implemented` awaits stage acceptance. |
| `parent`    | an id, or `null`                           | One parent. A tracker with several picks one and says so.     |
| `blockedBy` | ids of concrete prerequisite leaves        | Required results or conflicts, never hierarchy or list order. |
| `body`      | free text, may be empty                    | Read by `epic-without-criterion` and by the outcome lines below. |
| `createdAt` | a timestamp, optional                      | Orders findings, so the ones over budget are the latest.      |
| `outcomes`  | `[{ "id": "O1", "title": "…", "serves": ["J1", "P1"] }]`, optional | The charter's gains with their stable ids, and the vision journeys and principles each serves. Absent means the project has not put ids on its charter yet, and no outcome check reports on it. |
| `holder`    | who holds it, `null` for nobody; optional  | Omit the key if the tracker cannot say. `null` on an active issue is a violation. |
| `integration` | `{ "revision": "...", "evidence": "..." } | Required on implemented leaves under a stage; coordinator records the integrated revision and related-check evidence. |
| `delivery` | `{ "revision": "...", "evidence": "..." } | Required on submitted leaves; durable result revision/location and local-check evidence, before integration. |
| `comments` | `[{ "id", "at", "author", "body" }]` | The item's comments whose body starts with `[shady2k-time` (the set's records of claims and time, in `time-format.mjs`) or with `<!-- shady2k-exec v1 -->` (the command runner's journal of durations, in `runs.mjs`). Others may be left out. |

## The outcome lines

The gate reads three one-line facts out of a body itself, case-insensitive,
each at the start of a line with an optional leading `-`, `*` or `>`, and each
declared only when its value is real text: a value that is only a placeholder
(TODO, TBD, TKTK, or something between angle brackets) declares nothing.

| Line, in the body of | Meaning |
| --- | --- |
| a stage (an issue that carries work: it has children, or it is the only child of its feature): `Serves: O1, O2` | the outcome ids this stage serves |
| a feature: `Seen at: signup-page, receipt-email` | the handles of the places a person reaches this feature's outcome |
| a stage: `Preparatory: <reason>` | this stage is prefactoring, and why |
| a charter or a feature: `Target: <date>` | the date this document promises |
| a charter or a feature: `Forecast: <duration>` | the duration it reports, in the same shape |

An outcome is reached when a live or closed stage serves it; deferred work
serves nothing (`orphaned-outcome`). A stage whose `Serves:` names an id the
charter does not declare is the same refusal, named by the unknown id. A
feature's first stage has a DONE WHEN that names one of its `Seen at:` handles,
and a stage declared Preparatory is allowed once with the next stage after it
still required to reach the person (`unobservable-first-stage`). Lines of this
syntax are stripped from the DONE WHEN text before anything is counted against
it. A feature that names no place is not judged: that is the rule's stated
limit, and declaring the place is the fix.

## The vision record, and the chain up to it

The owner's journeys and principles, each with a stable id and his own wording,
are read once into `vision: {journeys: [{id, title}], principles: [{id, title}]}`.
The list is the switch: a project that keeps no such record is judged by none of
the rules below, and its ids are added at setup with the owner's agreement,
without changing the document's text. Every outcome declares in its `serves`
list the vision ids it serves — the adapter reads them from a `Serves:` line
under the outcome line of the charter. An outcome that serves nothing the vision
declares, or names an id the vision does not declare, is refused
(`unserved-outcome`).

## Forecast records

A date or a duration a document promises stands beside a record the run script
computed: `forecasts: [{scope, stated, tasks: [id], digest, enough, runs, low,
high}]` — the issue it stands beside, the date or duration as the document says
it, the exact task set covering the outcomes that promise serves, and that set's
digest, sha256 over the sorted ids, one per line, the same definition the run
script uses. A promise with no record, or with a record for another date or a
set that has changed since, is refused (`unforecast-target`); a record computed
from fewer than three finished runs is accepted and its warning printed
(`unmeasured-forecast`), because a new project has no pace to measure and a date
computed from nothing would be a guess wearing a number.

## Execution mapping

A submitted or implemented leaf is live for horizon, label and budget checks,
but never ready to implement again. Preserve it at handoff without an active
worker hold. Submitted work resumes at integration and satisfies no prerequisite.
If the tracker lacks these statuses, store explicit durable metadata and have
the adapter emit them. The gate checks the presence of recorded evidence, not its
truth or the success of acceptance; the coordinator verifies those.

Ready selection is context-dependent: unheld open leaves in the requested
stage and checkout. Closed prerequisites are satisfied everywhere. Implemented
prerequisites are satisfied only in the same stage after their revision is
integrated and related checks pass there. In a later stage of the same
feature, they are satisfied once their stage is accepted and its accepted
revision is in the checkout, though the stage stays open until it lands. In
another feature, wait for closure. Missing prerequisites remain blocked. Containers are not
worker tasks; a coordinator may hold a stage separately from its workers.

## Commit-link input

`check-commits.mjs` reads a separate normalized object:

```json
{
  "issues": [{ "id": "T1", "type": "task", "parent": "S1" }],
  "commits": [{ "id": "pending-message-or-commit-hash", "taskIds": ["T1"] }]
}
```

The project adapter parses actual messages by the project's chosen convention;
the checker verifies nonempty links to existing non-container leaves. Include
all referenced tasks, even closed ones, and enough hierarchy to identify
containers. The commit list must not be empty. A local commit-msg hook checks
the pending message; CI enumerates every introduced commit. Failure to resolve
the tracker or enumerate the range fails, never supplies an empty success.
The checker cannot verify a dishonest parser, so setup must prove the parser
with linked, unlinked and unknown-task messages through the real entry points.

## What an adapter must get right

**`blockedBy` carries gating edges and nothing else.** A tracker that also
records provenance ("found while working on") must leave those out. On 2026-09-17 three
brainstorms reached a work queue because a provenance edge was read as a
dependency by a hand-written script; the tracker itself never blocked on them.

**`updatedAt` is the tracker's own last-modified**, honestly copied and never
improved. The gate knows it can be a lie after a bulk edit and says so itself —
see `bulk-clusters` in the report. An adapter that tries to guess "real" work
instead hides the problem where nothing can see it.

**An adapter can read the tracker at a code revision.** The store lives
outside the code branches, the way **State every branch shares is not versioned
inside one** has it, so the state of a code revision is recorded, not derived:
when a revision is cut or lands, the store records the state as it stands then
under that revision's own name, once, and never moves it. The read takes that
recording and nothing else. It is never "the newest snapshot that happens to
name this revision or one before it": a machine still on this revision keeps
publishing from it afterwards, and that later state is not the state of this
revision. Where no recording exists, the read fails loudly, like every other
duty in this section, and never comes back as an empty backlog nor as a guess
from the order of names or from a clock. It is where a baseline comes from —
what was already wrong before this change — and the only honest source of ages
once a bulk edit has rewritten them.

**A native milestone is emitted as a label.** The rules read labels and nothing
else, so a tracker with a milestone field of its own has the adapter add that
milestone's name to `labels`, spelled as the config's `milestoneLabels` spell it.

**Every record comment is exported, raw and whole.** A comment starting with
`[shady2k-time` goes out with the tracker's own stable comment id, its time,
its author and its body exactly as stored, damaged or not: the gate judges it,
and a damaged record the adapter dropped is time lost with nothing to say so.
A record is retired by a void that names its comment id, so the id must stay
the same in every export.
The run scripts read the same export, so the adapter is how every machine sees
the same records. Posting a record is the tracker's ordinary comment
operation, with the text the script printed, unchanged.

**An adapter emits closed issues too.** Several checks need to tell "closed" from
"absent", and an adapter that filters them makes a deleted issue and a finished
one indistinguishable.

**On a change the adapter publishes: commit the store's state to its own ref
and push it, so that the change is on the remote within seconds of it, never
when a branch lands and never when an agent remembers.** The debounce before
that push is seconds, not minutes, and a refused push is retried until it
lands; pushing that ref starts no code CI. While the remote cannot be reached
the change is kept locally and published within seconds of its return, and a
read that needs another machine's state says the remote is unreachable rather
than answering from this machine's store as if it were the whole state.

**On a short timer the adapter syncs: fetch that ref and merge the other
machines' snapshots before anything reads the store.** A read never meets
another machine's state unwritten. The timer is short enough that what a
machine reads is never older than the seconds a change takes to publish, and
both bounds are the project's to keep and setup's to prove.

**The merge is per item and never by text.** Records that only append keep both
sides. The same field changed twice takes the newer value, and the overwritten
value is recorded on the item. The ordering is the merge's own for that field;
where it cannot separate two values, the order they were published on the ref
decides, never a machine's clock.

**A refused push is not retried blind: fetch and merge, and push again.** Where
the push is refused because the remote moved, fetch and merge first. By **The
tracker stays in step across machines**, a claim or a status transition counts
only once it is on the remote — fetch, merge, write,
push — and where the remote now holds another holder, or the transition has
already moved, the pending write is discarded, said out loud, and the session
re-reads and takes other work.

**A claim lands through the remote's own ordering: the remote accepts a push
only on top of its own latest state, so of two simultaneous claims one lands.**
The other session re-reads and takes other work rather than holding an item
twice.
