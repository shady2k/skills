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
      "holder": "somebody"
    }
  ]
}
```

| Field       | Values                                     | Notes                                                        |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| `type`      | `epic` `task` `bug` `chore` `other`        | Anything the tracker calls something else maps to `other`.   |
| `status`    | `open` `active` `deferred` `closed`        | `active` is "somebody is holding it now".                    |
| `parent`    | an id, or `null`                           | One parent. A tracker with several picks one and says so.     |
| `blockedBy` | ids that must close first                  | ONLY edges that actually gate work. Provenance edges are not. |
| `body`      | free text, may be empty                    | Read by `epic-without-criterion` and nothing else.            |
| `createdAt` | a timestamp, optional                      | Orders findings, so the ones over budget are the latest.      |
| `holder`    | who holds it, `null` for nobody; optional  | Omit the key if the tracker cannot say. `null` on an active issue is a violation. |

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

**An adapter emits closed issues too.** Several checks need to tell "closed" from
"absent", and an adapter that filters them makes a deleted issue and a finished
one indistinguishable.
