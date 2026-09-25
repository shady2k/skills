# The normalized backlog

The only thing the rules know. No rule mentions a tracker, a file path, a
project or a label that is not in its own config — if one does, it has stopped
being portable and the adapter should have absorbed the difference.

An adapter reads whatever the project's tracker holds and prints this:

```json
{
  "generatedAt": "2026-09-17T19:40:00Z",
  "source": "<tracker> <where it was read> @ <revision>",
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
| `body`      | free text, may be empty                    | Read by `epic-without-criterion` and nothing else.            |
| `createdAt` | a timestamp, optional                      | Orders findings, so the ones over budget are the latest.      |
| `holder`    | who holds it, `null` for nobody; optional  | Omit the key if the tracker cannot say. `null` on an active issue is a violation. |
| `integration` | `{ "revision": "...", "evidence": "..." } | Required on implemented leaves under a stage; coordinator records the integrated revision and related-check evidence. |
| `delivery` | `{ "revision": "...", "evidence": "..." } | Required on submitted leaves; durable result revision/location and local-check evidence, before integration. |
| `comments` | `[{ "id", "at", "author", "body" }]` | The item's comments whose body starts with `[shady2k-time`: the set's records of claims and time, in `time-format.mjs`. Others may be left out. |

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
integrated and related checks pass there. Outside that stage, wait for closure
after acceptance. Missing prerequisites remain blocked. Containers are not
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

**An adapter can read an earlier revision**, by `--at <rev>` or whatever the
tracker offers. It is where a baseline comes from — what was already wrong before
this change — and the only honest source of ages once a bulk edit has rewritten
them.

**A native milestone is emitted as a label.** The rules read labels and nothing
else, so a tracker with a milestone field of its own has the adapter add that
milestone's name to `labels`, spelled as the config's `milestoneLabels` spell it.

**Every record comment is exported, raw and whole.** A comment starting with
`[shady2k-time` goes out with the tracker's own stable comment id, its time,
its author and its body exactly as stored, damaged or not: the gate judges it,
and a damaged record the adapter dropped is time lost with nothing to say so.
The run scripts read the same export, so the adapter is how every machine sees
the same records. Posting a record is the tracker's ordinary comment
operation, with the text the script printed, unchanged.

**An adapter emits closed issues too.** Several checks need to tell "closed" from
"absent", and an adapter that filters them makes a deleted issue and a finished
one indistinguishable.
