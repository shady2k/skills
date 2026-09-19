---
name: setup-shady2k-skills
description: "Install or recheck the set in a project: tracker, queue, working settings and checks. Use when the user asks to set up or update the installation, or agrees to it after a skill reported it out of date; never start it unprompted."
---

# Setup shady2k-skills

Every run is a **full reconciliation**, also for an existing installation: a
matching version does not prove the tracker, commands, hooks or settings still
work. Keep valid earlier choices, inspect the real state, repair drift and
prove the result. Never reduce an update to copying one script.

Use the user's established role, otherwise **product engineer**: they own
product outcomes and trade-offs, not code or tool configuration. Find technical
facts yourself; never ask the user for commands or config keys. Everything the
user reads follows **Speaking to the owner** in [the protocol](protocol.md).

The set owns [the protocol](protocol.md), [the backlog rules](check.mjs),
[the commit check](check-commits.mjs) and [the normalized model](model.md).
The project owns its config, tracker adapter, check commands and wiring.

## Show progress

The user always knows how long this takes and when they are needed. After
reading the project, before changing anything, size the announcement to the run:

- **A short run**, typically a rerun after an update, where the user is needed
  only for the settings and the landing: say it in one or two sentences: what
  changes for their work, roughly how long, and at which moments they are
  needed. Not what changed inside the set. No
  step list: a table where most rows say "not needed, a few minutes" is noise.
- **A long run**, such as a first setup or a large cleanup: show the plan as the
  six steps below, each with what it does, whether the user is needed, and a
  rough duration with its basis ("about 900 open issues: the cleanup is the
  long part, likely more than one session").

Durations are estimates; say so once, and revise them when they turn out wrong.

1. **Look around**: read the project, tracker and existing installation. Agent only.
2. **Tidy the queue**: agree with the user what is current, what waits and what
   was abandoned, then clean up reversibly. Needs the user; the long step for a
   large backlog, short for an empty one.
3. **Agree the settings**: one recommended profile. Needs the user once.
4. **Connect the checks**: so that they run on every commit. Agent only.
5. **Prove it works**: plant violations, watch them rejected, undo. Agent only.
6. **Finish**: bring the installation into the main line. May need the user's
   approval to merge.

Give a progress line only where it tells the user something: when a step that
takes a while finishes or runs long, and when they are needed now. One line:
what finished, what comes next, whether they are needed. When a session has to end, say which step is next, so a later run
resumes there. Where the harness shows a task or plan list, keep these steps
in it. Progress lines follow the same plain-words rule as everything else.

## 1. Get a working tracker and a usable queue

Read the agent docs and their tracker references, any existing installation,
hooks, CI, runtime, current work and worktrees. An installation left on another
branch is reconciled and landed, not duplicated.

**An existing tracker:** verify reading, export and writing through its own
documentation. **No tracker:** recommend one, weighing portability, offline
use, collaboration, history, ownership and dependencies, with its costs, and
get the user's choice before installing it unless that was already authorized.
This may be the one decision needed before the rest of the profile. A tracker
stored in the repository is a valid choice for a small project; no product is
required. Check it can represent the protocol, natively or through documented
adapter metadata. Never treat an unreachable tracker as absent or replace one
without a decision.

**The setup task comes first.** Before any repository change, find or create
the setup task in the tracker; it owns installation, cleanup and their commits
even before the gate exists. An interrupted or failed run leaves its work on
its branch and its task; the main line keeps its previous installation until
landing. If tracker access fails even for this task, stop, report the failure
and say setup must be rerun.

**A repository already installed at this setup version** needs only this clone
connected: hooks active, runtime present, the person's plugin at the same
setup version. Do that, prove the hooks fire, and stop: no queue cleanup, no
profile, nothing committed. Announce it as the short run it is.

**Clean the queue with the owner.** Inventory statuses, labels, milestones,
dependencies and holders. Save a snapshot **before any cleanup**. Hand
`groom-backlog` the verified tracker operations, the snapshot location and a
proposed config as its bootstrap context. With the owner: keep the active slice
and work that is really running, release abandoned holds, fix invalid
dependencies, defer unrelated work, and keep implemented work that awaits
acceptance. No bulk deletion; write a field-level rollback that does not
overwrite later work. If the queue is already usable, prove it and leave it.
Cleanup happens before the gate is installed; it does not need the gate.

## 2. Agree the settings

Read earlier answers, charters and decision history, and compare them with the
real state. Keep valid choices, including limits written in prose; a missing
config key is not an unanswered product decision. Never silently reset a
setting or add a reserve to an agreed budget.

Present **one recommended profile**, not a series of questions. Open with what
the update means for the user's work now, including what waits until it
finishes. Then a compact table of only the entries that change or need a
decision: a plain name, the current and recommended value, what it controls,
and what accepting or changing it means in behaviour, time, cost and risk.
Retained settings take one line, detailed on request, saying what they mean in
plain words ("new backlog problems block a commit, old ones do not"), never
their values or labels. Cleanup lists tasks by
title, grouped by what will happen to them.

The user accepts the profile or names the entries to change. Approval settles
all its choices at once; do not confirm rows again. "Use the recommended
values" means: choose defaults from evidence, say what you chose and continue.
Base capacity and budgets on real resources, review capacity, observed test
times and the project's risk policy, not invented numbers.

Ask separately only about unresolved scope, a material cost or risk,
conflicting decisions or missing authority: one question at a time, with a
recommendation, real alternatives and their consequences. Approval of the
profile does not permit undisclosed bulk cleanup, publication, weaker
acceptance or wider scope, and silence is not approval. Reuse approval already
given; leave settings unrelated to this setup for later.

The profile covers the following. It is the agent's checklist, **not a
questionnaire**.

- **Who works this way:** only the person running setup, or everyone who works
  in the repository. Always a question on first setup, asked before the rest,
  because it decides what binds other people; show who else committed recently.
  **Personal:** the plugin for this person only, the hooks active only in their
  clone, no CI enforcement; the shared files are committed but bind nobody
  else, and the tracker changes stay visible to all. **Team:** the plugin also
  offered at the project level where the harness has one (in Claude Code the
  plugin's source becomes known to anyone who trusts the folder; each person
  still installs it once), the install line in the agent doc for every other
  harness, hooks connected in every clone, and CI enforcing the checks on
  everyone's commits. Team is a decision for the team, not only for this
  person: say so. A rerun keeps the recorded answer.
- **Artifact language:** the language of documents, tasks, commit messages
  and code comments. Always a question on first setup, even inside an accepted
  profile: recommend English and show which language the existing files and
  commits use. A rerun keeps the recorded answer. Conversation always follows
  the user's own language, whatever this is.
- **Scope and horizon:** labels, areas, the current milestone and its finding
  budget. Compare documented labels with real ones; never erase live work to
  fit a list. Establish the current slice during cleanup if needed. A missing
  charter is written later through `/to-milestone`, but the first budget is
  agreed now, profile approval included. Only the current milestone is broken
  down; its independent features may run at once.
- **Gate strength:** keep the agreed one or recommend one. `block-new`
  (recommended where history exists) stops new problems and shows old debt;
  `block` stops every problem; `report` only prints. Explain each one's cost.
  Age thresholds may keep their defaults: staleDays 14, holdDays 2,
  bulkCluster 20.
- **Development:** test-first (`tdd`) or `test-after`, whatever the size of the
  work. Both need related worker tests and final stage acceptance. For
  non-code work name equivalent checks; never force a disruptive live drill.
- **How work runs:** inline in the owner's session, subagents of that session,
  separate worker sessions (a terminal multiplexer or similar), or a cloud
  session, as the harness offers, and how a stopped run reaches the owner.
  Explain what each means for leaving: inline and subagents end with the
  session; separate sessions survive while the machine runs; a cloud session
  needs no machine of theirs. The preflight of each feature run confirms it.
- **How long a branch may live:** read the project's own rule where its docs
  state one (many prefer merging into the main line often); otherwise recommend
  a day or two. Feature runs are sized to it.
- **Execution:** which agents and models may do which work (for example, a
  light model only for low-risk tasks, a strong one for security, data or
  concurrency), how many agents work at once, atomic claims or one-at-a-time
  assignment, how an agent's claim names that agent instead of the person, separate checkouts, who merges, and how the tracker stores
  `submitted` and `implemented` work. No artificial chains between features,
  stages or tasks; record only real conflicts and prerequisites.
- **Verification:** commands for static checks, related tests and full checks;
  mutation testing of changed logic, its time budget and what to do with a
  meaningful survivor. Without tooling, agree an explicit alternative or an
  escalation at acceptance; a skipped mutation check is never "passed".
  Required checks follow what a change can touch: a change that cannot touch
  product code (documents, process tooling) does not run the product's test
  suites. Show the cost of each long check, so the owner sees what it buys.
- **Review:** another model where available, a stated fallback otherwise, and
  whether independent review is required for acceptance. Two agents on the
  same model are not another model.
- **Documents and commit links:** read [documents.md](documents.md) for the
  lifecycle, templates, document gate and its trust limits. Map vision,
  roadmap, charters, current capabilities, changes, optional design and
  decision records, and exploration notes onto the project's existing
  documents; propose defaults only for missing roles, not an empty directory
  tree. Pick one workflow owner; do not move other tools' documents or disable
  their hooks without saying so. The profile states document policy, where
  evidence and approvals come from, and what enforcement cannot guarantee.
  Recommend the gate's evidence level from [documents.md](documents.md):
  **records** where no protected CI or tracker guard exists, which keeps the
  gate to a structural check and honest acceptance records; **protected** only
  where CI can really block a merge. Recommend wiring it in this setup only if
  it fits; otherwise it becomes its own stage, and work continues meanwhile
  with documents checked by reading.
  Choose how **every commit** names its task, setup, documentation, research
  and prototypes included, and how merge and revert commits keep that link;
  they are not silent exemptions.

## 3. Write or repair the integration

Where other agents share a checkout, install on a separate branch or worktree:
a shared index lets another agent commit your staged files. Never delete
branches, worktrees or files this run did not create, even merged ones; list
them and propose it instead.

**Config:** one project JSON file holds the changing choices. A starting shape:

```json
{
  "strength": "block-new",
  "currentMilestone": "<label>",
  "milestoneLabels": ["<labels>"],
  "areaLabels": ["<areas>"],
  "roadmapLabels": [], "triageLabels": [],
  "ideaLabels": ["idea"], "ideaTitlePrefixes": [],
  "findingLabels": ["finding"], "findingBudget": null,
  "staleDays": 14, "holdDays": 2, "bulkCluster": 20,
  "execution": {
    "development": "<tdd | test-after>",
    "runMode": "<inline | subagents | worker-sessions | cloud>",
    "maxBranchDays": 2,
    "maxWorkers": 1,
    "mutationBudgetMinutes": 10,
    "mutationFallback": "<agreed alternative or escalate>",
    "reviewPreference": "different-model",
    "reviewFallback": "<same-model independent reviewer | disclosed self-review | escalate>"
  },
  "scope": "<personal | team>",
  "artifactLanguage": "en",
  "projectWords": ["<project names>"],
  "trackerWords": ["<tracker names>"]
}
```

The execution numbers are examples, not choices. `findingBudget` and
`currentMilestone` stay null only while no live slice is admitted.
The config holds only choices the whole team shares. It records no
installation state: the installed checks' versions on the main line are the
repository's installation, and each person's plugin, hooks and runtime are
their own, checked directly. An older config's `setupStatus`, `setupVersion`
and `setupVerifiedAt` are removed in this setup's landing, silently: the set's
own bookkeeping is never news for the owner.

**Adapter:** read [model.md](model.md) in full before writing or changing it.
It exports every status, closed, `submitted` and `implemented` included, real
dependency edges, holders and recorded merge evidence. Its ready operation
takes the stage and checkout. A tracker without native `implemented` or
`submitted` statuses gets an explicit, stored mapping, never a silent mapping
to ready or closed. For `block-new`, verify that history can be exported and
the historical config retrieved; otherwise agree an honest supported strength.

**Checks:** run all three shipped checks in place where they are in the
project, or copy them unchanged, and record where they came from in the
integration, not inside the copies. Without Node, port all three and prove the
same fixtures. A matching version does not replace a byte comparison or port
proof.

Wiring follows the agreed scope: in personal scope the hooks run only in the
owner's clone and nothing is added to CI; in team scope every clone connects the
hooks and CI enforces them. Every rejection says in plain words what is wrong
and how to fix it, readable by a contributor who has never heard of the set.

**Wiring the backlog gate:** it runs in the project's local hook and in CI.
For `block-new`, compare the working export with the last committed revision and
its config; CI uses the PR merge-base or the previous head of a push, never a
branch's merge-base with itself. Misuse fails loudly (exit 2); `report` relaxes
only policy violations (exit 1), not a broken command.

**Wiring the commit check:** it runs in commit-msg and CI. The project adapter
turns the chosen message convention into the input of `check-commits.mjs`.
Locally it checks the pending message; CI checks every newly introduced commit
and fails if it unexpectedly finds none. Links resolve against all relevant
tasks, closed ones included. This check is mandatory whatever the backlog's
strength. Test the parsing on real linked and unlinked messages.

**Wiring the document gate:** build the deterministic export and the wrapper
for the agreed evidence level, described in [documents.md](documents.md). Run `product` and `feature`
before the first product implementation, `feature` for new changes,
`acceptance` for stage evidence and `close` before current docs are accepted.
CI picks the actual transition and lists every affected document; neither a
weaker phase nor an empty export supplied by the author gets through. It is
required whatever the backlog's strength. Prove real file parsing, baseline
choice and that each phase rejects its planted violations. At the protected
level also prove receipt verification, policy origin and enforcement at tracker
closure; at the records level disclose that records are trusted, and build no
forgery defences. JSON alone proves no evidence is genuine.
If it is not wired in this setup, file its task in the current milestone and
record in the integration that the gate is not installed yet, naming that
task. Setup still completes; wiring the gate later reruns proof 6.

**New projects:** conversation may come before setup with no files or issues.
Once work is to be kept, create the setup task first, then seed only the agreed
vision, current slice and resource locations. The charter comes from
`/to-milestone` when the user runs it. Setup may finish with no admitted work,
no current capabilities and nothing beyond a vision section; never invent a
product to turn the admission gate green. Prove the gate on recoverable
fixtures and report product readiness separately from installation readiness.

**Tracker doc:** update the project's own tracker doc from
[integration.md](integration.md), without a rival table of tracker commands.
Run every read operation, including ready, holds and children of every status.
Test writes in reversible scratch state or read their documented behaviour.
Verify claim concurrency: rereading a field anyone can overwrite is not a lock.
Point every harness's loaded agent doc at the integration with:

> All retained work and commits belong to tracked tasks. File discoveries through
> `to-backlog`; implement through `take-task`; close only after stage acceptance
> through `close-out`. Read Backlog integration in <path> before writes. When a
> skill reports the installation is out of date, run `setup-shady2k-skills`.

In team scope add one line for people who do not have the skills yet, in their
harness's syntax: this repository works through the shady2k-skills plugin, and
how to install it. That install line is the one command the pointer carries.

Use the real path and invocation syntax. Do not copy settings, milestone values
or commands into the pointer.

## 4. Prove the whole installation, every time

An existing setup runs all of these too, even when versions match.

1. **Shipped checks:** from this skill's directory run
   `node check.mjs --selftest --config <project-config>`,
   `node check-commits.mjs --selftest` and `node check-docs.mjs --selftest`
   (the first uses its fixture config for the rules and the project config for
   portability). Compare installed copies byte for byte; ports run the corpus.
2. **Tracker and adapter:** compare counts per status and ready leaves with the
   tracker; explain every difference. On an empty tracker use recoverable
   proof issues. Exercise claim (the holder must be the agent in the protocol's
   full name, not the person or a bare role),
   release, `implemented`, readiness of a
   dependant in the same stage, acceptance across stages and independent ready
   work. Check that `submitted` results survive a handoff without being redone.
   Check dependency cycles and the exact task-reference parser.
3. **Real entry points:** plant a recoverable backlog violation and run the real
   hook; see it fail (or report, at `report` strength), undo, see it clean. Run
   the real commit-message entry point with a missing task, an unknown task and
   a valid leaf. Verify both CI range calculations on representative
   revisions. Never publish test commits.
4. **Execution commands:** each configured command exists and starts in the
   declared environment, proved the cheapest way that shows it works. Run a
   full suite only when that command has never been proved here, or it or its
   environment changed since; otherwise the earlier proof stands. Before any
   run longer than a few minutes, say what it proves and how long it takes.
   Never run anything only "for completeness". Check a bounded mutation sample
   and the reviewer or its fallback. Report every proof not performed. A
   failure needs a repair or an agreed, supported change of settings, not a
   success stamp.
5. **Current state:** run the gate on the cleaned live backlog. Keep the age
   snapshots from before and after cleanup and use their bounded correction.
   Show the result, remaining debt, the strength and any limits.
6. **Documents**, once the document gate is wired: run the recoverable
   entry-point proofs in documents.md: a
   missing scenario in the real format, a stale source requirement, a wrong
   task, stale or missing receipts and an unsynchronized closure. Check that
   independent changes still pass. Adopt only the legacy scope affected now;
   an old plan or a model's summary is not verified state.

Keep the proof evidence with the setup task. A tracker outage, missing runtime,
stale integration or failed hook is a specific repair, not a reason to discard
earlier answers.

## 5. Land and record the verified version

Land through the project's authorized workflow and check from the checkout
people use: docs reachable, all three checks run, hooks installed in that
clone. A separate branch alone is **written and proved, not installed**. Ask
only for landing steps not already authorized.

Shared hooks may already run in checkouts without the new files. Let through,
visibly, only a tree that never had this installation; a missing or broken
gate in a configured tree is an error, not a bypass.

Land once, only after all required proofs (proof 6 only when the document
gate is wired). The landed checks carry the setup version, so nothing is
committed after landing: check the target checkout, record the proof on the
setup task, and the installation is done.

Report first whether work can continue and through which skill; then what
changed for the user, what was cleaned (tasks by title), and each limitation
with its practical consequence. What was retained and the proof details go to
the setup task, summarized in one line. On failure leave the main line as it
was, keep the work on its branch and task, say what failed and never report the
project as reverified.

## Updating

Run this skill again when a skill reports the repository's installation is out
of date, that is, when the plugin's setup version is newer than the installed
checks'. When the plugin's is older, the person updates their plugin instead.
A plugin update that leaves the setup version alone needs no setup. Matching versions never skip a setup the user asked for, and
a rerun redoes only what the new setup version needs plus the proofs.

An update reconciles config, adapter statuses, commands, hooks and documents
like any other run. Keep earlier answers; put new settings into the recommended
profile instead of restarting an interview.
