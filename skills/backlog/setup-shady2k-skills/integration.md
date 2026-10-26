## Backlog integration

Maintained by `setup-shady2k-skills`. The protocol ships with the skills;
project facts and verified commands live here. Changing choices live only in
the config. No installation state is recorded: the installed checks' versions
are the repository's installation, and each person's plugin and hooks are theirs.

- **Config:** <path; read current values there>
- **Scope:** <personal or team, from the config; how others get the plugin in team scope>
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

- **Charter outcomes:** <the current charter's outcomes with the stable id each
  carries in front of its text (`O1: <the outcome>`), exported in the normalized
  backlog as `outcomes`; a project whose charter has no ids yet exports none,
  and the two rules that read them report nothing there>
- **Backlog adapter:** <path and export command; where the export command reads
  the store: the ref, so every read is historical by nature — the store's state
  at a code revision is what the store recorded under that revision's own name
  when it was cut or landed, and the adapter takes that recording, never the
  tree and never a later snapshot that happens to name the same revision>
- **Rules:** <paths/provenance for check.mjs with time-format.mjs beside it, check-commits.mjs, check-docs.mjs, check-present.mjs with document-format.mjs beside it, and check-product.mjs, each check with regular-file.mjs beside it, and argv.mjs beside every check and recipe (a recipe imports it as ../argv.mjs); verbatim copies or proved ports>
- **Present documents:** <the check-present.mjs command a pull request's opening and CI run, and how CI finds the merge base; the documents themselves are in the config>
- **Product documents:** <the check-product.mjs commands the commit hook (`--staged`) and CI (`--rev <revision>`) run>
- **Work records:** <how the adapter exports each item's `[shady2k-time` comments raw with the tracker's comment id, time and author; the command the run script reads as `--backlog`, which reads the store on the ref, so a record another machine published is present once it is fetched and merged; how a record is posted unchanged>
- **Document adapter and gate:** <deterministic export from real docs/tasks; product/feature/acceptance/close commands; or "not installed yet" and the "Title" (id) of its task; the change record's **Where it is seen** — the place a person reaches the outcome, the steps of the happy path through it, or `internal` with the reason a person sees nothing — and the mockup files that exist in the tree at this revision as `mockups`: image, HTML or prototype document, each non-empty>
- **Document policy:** <config source for approval and required checks; protected policy selection>
- **Document baseline/scope:** <actual target revision, full affected capabilities and complete changed-file enumeration>
- **Tracker layout:** <for a product repository, the default **State every branch shares is not versioned inside one** states: the store lives outside the branches — one copy per machine, on a ref no code branch contains, with every checkout and worktree of that machine pointed at it, and no code branch carrying a tracker record at all; the ref's name and where the per-machine copy lives. A store a branch commits stays possible only where the owner chooses it, after this cost is said: records on an item two branches work on collide by construction — then, where the file stays in the branches, the hook that narrows what a commit carries of it to that branch's own writes. How the tracker at a code revision and its transitions over a commit range are read: from the store's snapshots on the ref, never from a code tree. The agent doc's end-of-session step follows this layout, over the tracker's own generic advice>
- **Evidence revision:** <how it is computed; nothing in the tree stands for the tracker — the read path is the ref, so the export is left out of the revision without being named as a tree path; the exact paths left out of it: change records, current specs and their catalogue, and nothing else. For each check whose policy says what it does not read, how its own revision is exported (`checkRevision` over `git ls-tree`), and what its command shows it cannot read>
- **Evidence level:** <records (acceptance record, trusted not verified) or protected (runner/API receipts, revision and digest binding)>
- **Document synchronization:** <prepare delta replay, verify final tree, publish, archive and close idempotently>
- **Enforcement boundary:** <protected required CI and tracker transition guard, or explicitly audit-only limits>
- **Main line for the gate:** <the command that enumerates the commits on the
  main line at the revision the gate judges — the local history, never a
  network read — parsed by the same convention as **Commit-link input and
  check**, and exported as the normalized backlog's `landed` list,
  `[{ "id": "<commit>", "taskIds": [...] }]`; the rule that names an item whose
  change already landed reads it, and a project whose export carries no
  `landed` list is judged by none of it>
- **Backlog gate:** <exact command, config and baseline/config-revision selection; the gate is given the code revision it judges (`--at <code revision>`) and refuses with exit 2 an input read for another revision or one that names none — the store is off the branches, so the declared revision is the only thing tying the report to a code state, and the adapter's export is what must fill it>
- **JSON report:** <exact command>
- **Commit-link input and check:** <message/range parser, tracker resolution
  from the store on the ref — task ids resolve against the store, never a code
  tree, and an id that is absent there fails, never supplies an empty success;
  how the parser marks a commit that carries only records of what already
  happened (`recordsOnly`), which the check refuses: the records ride with the
  landing they describe and are never a commit of their own; the changed paths
  of each commit, the `codePaths` the config marks as code, and, per commit,
  the verdict the document gate returned for the change record naming each task
  it links (`changes`: the rule ids that gate returned, empty when admitted),
  read at that commit's own revision from a run whose model carries a non-null
  change record — the product phase admits nothing;
  normalized commits input and check-commits.mjs command>
- **Product repository:** <for a code repository under a product's `repos/`, the product repository, as the relative path `../..`; for a product repository, "this repository holds the product, and its schema version fixes the document places">
- **Task ids of this repository's commits resolve against:** <the tracker that holds them: the product repository's for a code repository, this repository's for a product repository, and where it is read from here>
- **Local entry points:** <pre-commit and commit-msg commands>
- **Connecting a clone:** <the one committed command that connects a fresh
  clone: hooks, filters, tracker import, every local file a hook reads; safe to
  rerun, and failing with what is missing rather than half-connecting>
- **CI:** <backlog baseline selection and introduced-commit enumeration; empty
  or unreadable required ranges fail>
- **Bulk-edit age correction:** <paired --ages-from before and --ages-through after snapshots>
- **Tracker synchronization:** <the process that publishes and syncs the store, keeping **The tracker stays in step across machines**: started by which command, kept by which supervisor, and the proof that it runs, survives a reboot and fails loudly when its runtime is missing; what it does while it cannot reach the remote — writes continue locally, are published within seconds of its return, and a read that needs another machine's state says the remote is unreachable rather than presenting this machine's store as the whole state; the merge is per item and never by text: records that only append keep both sides, the same field changed twice takes the newer value and the overwritten value is recorded on the item, and where the field's own order cannot separate two values the order they were published on the ref decides; a claim counts only once it is on the remote; the seconds within which a change is published and the timer on which the other machines take its snapshot, and the proof of both; how the store records the state of a code revision under that revision's own name when it is cut or lands, once and never moved, so a read at a revision takes that recording and is refused where there is none; pushing the store's ref starts no code CI>
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
| publish | <the store's own publish: on a change, after a short debounce, commit the store's state to its ref and push; the process that runs it, how it is kept and proved; pushing that ref starts no code CI> |
| sync | <on a short timer, fetch the store's ref and merge the other machines' snapshots per item before anything reads the store; the same field changed twice takes the newer value and records the overwritten one on the item; what it does while it cannot reach the remote> |
| link / unlink | <required-result or conflict edges on leaves, reason, release condition; provenance separate> |
| claim | <counts only once it is on the remote: fetch, merge, write, push; where the push is refused because another session won, its write is discarded, said out loud, and the session re-reads and takes other work; atomic owner assignment or a serialized coordinator; not last-write-wins readback; the holder is the agent doing the work (coordinator or numbered worker), never the person by default; how a dependant of an implemented prerequisite in the same stage, or of an accepted, still-open stage of the same feature, is claimed where the tracker refuses claims on blocked issues, keeping the edge> |
| release | <unfinished holds only; preserve implemented work> |
| implemented | <record integrated revision and local evidence; coordinator only> |
| submitted | <preserve the worker result and evidence pending integration; clear worker hold> |
| reopen | <invalidate obsolete integration/acceptance evidence and reassess consumers> |
| close | <accepted work with stage evidence, or explicit cancellation/duplicate disposition> |
| comment / edit | <notes, criteria, reparenting, state updates; a work record posted exactly as the run script printed it, never reflowed, edited or deleted; a wrong one is voided by the run script's record> |
| defer / undefer | <review date; reversible metadata changes> |
| milestone / label | <values read from config> |
| ready | <open unheld leaves in the stage and checkout; implemented prerequisites satisfied only within that same stage after integration; accepted stages satisfy later stages of the same feature once their accepted revision is in the checkout; closed ones everywhere> |
| holds | <active issues and owners, including stage coordinators> |
| pending integration / acceptance | <submitted/implemented leaves and their stages with recorded revisions> |
| children | <all children in every status, including submitted, implemented and closed> |
| search / show | <behaviour search, area listing, complete issue and comments> |
| authorized sync | <publish to the shared remote after the project's checks; distinct from the store's own publish> |

When a skill reports the installation is out of date, run `setup-shady2k-skills`. An explicit
setup invocation rechecks everything even if its recorded version matches.
