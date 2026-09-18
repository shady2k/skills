## Backlog integration

Maintained by `setup-shady2k-skills`. The protocol ships with the skills;
project facts and verified commands live here. Changing choices, including the
last verified setup version/time and the current pending/failed/verified status,
live only in the config.

- **Config:** <path; read current values there>
- **Vision, roadmap and charters:** <paths; roadmap may be a vision section; status comes from the tracker>
- **Current specifications:** <canonical capability docs for accepted mainline behaviour; coverage limits>
- **Changes:** <proposals/deltas and archive; short deltas may live on tasks with a spec pointer>
- **Document resources:** <installed templates and documents.md contract; preserved local format overrides>
- **Workflow ownership:** <existing tools retained; single authority per artifact and task status; detected conflicts>
- **Architecture and explorations:** <paths only where useful; exploratory notes are optional and not commitments>
- **Glossary and decisions:** <paths or none>
- **Acceptance records:** <where stage base/final revisions, included tasks,
  criteria, test/mutation/review evidence and pending limitations are retained>
- **Features and stages:** <native type mapped to epic; coordinator ownership>
- **Implemented:** <native status or durable metadata mapping, integration
  revision and local-check evidence; neither ready nor closed>
- **Submitted:** <native status or metadata, durable result revision/location
  and local evidence; pending integration, never ready to reimplement>
- **Commit task links:** <message convention and exact parsing rules>
- **Cleanup recovery:** <before/after snapshots, field-level change journal and
  restore command; preserve later independent changes>

### Checks and execution

- **Backlog adapter:** <path and export command; historical export when supported>
- **Rules:** <paths/provenance for check.mjs, check-commits.mjs and check-docs.mjs; verbatim copies or proved ports>
- **Document adapter and gate:** <deterministic export from real docs/tasks; product/feature/acceptance/close commands>
- **Document policy:** <config source for approval and required checks; protected policy selection>
- **Document baseline/scope:** <actual target revision, full affected capabilities and complete changed-file enumeration>
- **Verified receipts:** <runner/approval API verification, revision and digest binding; no author-asserted passes>
- **Document synchronization:** <prepare delta replay, verify final tree, publish, archive and close idempotently>
- **Enforcement boundary:** <protected required CI and tracker transition guard, or explicitly audit-only limits>
- **Backlog gate:** <exact command, config and baseline/config-revision selection>
- **JSON report:** <exact command>
- **Commit-link input and check:** <message/range parser, tracker resolution,
  normalized commits input and check-commits.mjs command>
- **Local entry points:** <pre-commit and commit-msg commands; installation in a fresh clone>
- **CI:** <backlog baseline selection and introduced-commit enumeration; empty
  or unreadable required ranges fail>
- **Bulk-edit age correction:** <paired --ages-from before and --ages-through after snapshots>
- **Static checks:** <commands>
- **Related tests:** <how workers select changed and affected behaviour>
- **Full stage checks:** <commands and required environment>
- **Mutation checks:** <changed-code selection and command; budget/fallback in config>
- **Reviewer:** <how to select another available model and detect availability;
  preference/fallback in config>
- **Parallel execution:** <isolated checkout mechanism, atomic claims or
  serialized assignment, integration ownership and shared-resource conflicts>

### Tracker operations

Point to the tracker's own doc/skill instead of copying its commands. Add only
what this protocol needs. Verify read operations and document unsupported
capabilities and their substitutes.

| operation | project implementation |
| --- | --- |
| create | <title, type, labels, parent, criterion> |
| link / unlink | <required-result or conflict edges on leaves, reason, release condition; provenance separate> |
| claim | <atomic owner assignment or a serialized coordinator; not last-write-wins readback> |
| release | <unfinished holds only; preserve implemented work> |
| implemented | <record integrated revision and local evidence; coordinator only> |
| submitted | <preserve the worker result and evidence pending integration; clear worker hold> |
| reopen | <invalidate obsolete integration/acceptance evidence and reassess consumers> |
| close | <accepted work with stage evidence, or explicit cancellation/duplicate disposition> |
| comment / edit | <notes, criteria, reparenting, state updates> |
| defer / undefer | <review date; reversible metadata changes> |
| milestone / label | <values read from config> |
| ready | <open unheld leaves in the stage and checkout; implemented prerequisites satisfied only within that same stage after integration, closed ones everywhere> |
| holds | <active issues and owners, including stage coordinators> |
| pending integration / acceptance | <submitted/implemented leaves and their stages with recorded revisions> |
| children | <all children in every status, including submitted, implemented and closed> |
| search / show | <behaviour search, area listing, complete issue and comments> |
| publish | <authorized synchronization after checks> |

After updating the skill set, run `setup-shady2k-skills` again. An explicit
setup invocation rechecks everything even if its recorded version matches.
