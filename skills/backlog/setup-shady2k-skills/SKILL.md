---
name: setup-shady2k-skills
description: Choose or verify the tracker, clean its queue, configure execution and prove the full installation; run again after every plugin update.
disable-model-invocation: true
---

# Setup shady2k-skills

Every invocation is a **full reconciliation**, including an existing installation.
A matching version is not proof that its tracker, commands, hooks or settings
still work. Preserve valid prior choices, inspect actual state, repair drift
and prove the resulting installation. Missing settings call for recommendations,
not an interview per field. Never reduce an update to copying one script.

Use the user's established role; otherwise assume **product engineer**: they
own product outcomes and trade-offs, not the code or tool configuration. Explain
choices as behaviour, time, cost and risk. An owner needs outcomes and priorities,
an analyst domain rules, an architect boundaries and constraints. Investigate
technical facts yourself; do not ask the user to supply commands or config keys.

The set owns [the protocol](protocol.md), [the rules](check.mjs),
[the commit check](check-commits.mjs) and [the normalized model](model.md).
The project owns its config, tracker adapter, verification commands and wiring.

## 1. Establish a usable tracker

Read agent docs and their tracker references, existing installations, hooks,
CI, runtime, current work and worktrees. An installation on another branch
needs reconciliation and landing, not a second unrelated installation.

If a tracker exists, verify access, export and write capabilities using its own
documentation. If none exists, present suitable choices based on portability,
local/offline use, collaboration, history, ownership and dependencies. Recommend
an option, explain its costs and get the user's choice before installing and
initializing it, unless that choice and installation were already authorized.
This prerequisite may need a decision before the rest of the profile; it does
not justify a separate question for every later setting. A repository-backed
issue store is a valid small-project choice; no particular product is required.
Verify that it can represent the
protocol, natively or through documented adapter metadata. Do not pretend an
inaccessible tracker is absent or replace an existing one without a decision.

Before repository changes, resolve or create the setup task through that tracker.
It owns installation, cleanup and their commits even before the gate exists.
For an existing config, mark this attempt `setupStatus: pending` before cleanup
or proof so an interrupted attempt cannot masquerade as verified. If tracker
access prevents even establishing that task, stop with the access failure and
explicitly require setup to be rerun; do not report the old stamp as current proof.

Inventory statuses, vocabulary, milestones, dependencies and ownership. Save
a snapshot **before any cleanup**. Supply verified tracker operations, snapshot
location and a proposed config to `groom-backlog` as its bootstrap context.
With the owner, retain the active slice and independently running work, release
abandoned holds, resolve invalid dependencies and defer unrelated work. Preserve
implemented work pending acceptance. No bulk deletion; document a field-level
rollback that does not overwrite later work. If the queue is already usable,
prove that and leave it alone. Cleanup comes before final gate installation;
it is not blocked by needing the gate it is preparing to install.

## 2. Reconcile project choices

Read previous answers, charters and relevant decision history first. Reconcile
them with actual state before recommending changes. Preserve valid choices,
including limits set in prose; an absent config key is not an unanswered product
decision. Do not silently reset settings or add a reserve to an agreed budget.

Present **one recommended profile**, not a sequence of questions. Use a compact
table or list with plain-language setting names, current/recommended values,
whether each is retained or changed, what it controls and why it matters, and
the practical consequence of accepting or changing it. Explain unfamiliar terms:
for example, mutation testing deliberately breaks changed logic to check whether
tests catch it; its budget trades extra confidence against acceptance time.
Put commands and config keys in implementation details, not in the user's quiz.

Everything the user reads follows **Speaking to the owner** in the protocol.
Open with what the update means for their work now, including what waits until
it finishes. The table holds only entries that change or need a decision, each
in plain words; retained settings are one line, detailed on request. Tasks in a
cleanup proposal are listed by title, grouped by what will happen to them.

Invite the user to accept the profile or name only the entries to change.
Approval of the displayed profile settles its choices together; do not confirm
each row again. If the user delegates remaining routine choices with "use the
recommended values", choose evidence-based defaults, disclose them and continue.
Do not manufacture capacity or arbitrary budgets: respect actual resources,
review headroom, observed test costs and the project's risk policy.

Only genuinely unresolved scope, material cost/risk, conflicting decisions or
missing authority need a separate question. Ask one such question at a time,
with a recommendation, real alternatives and consequences at the user's level.
Profile approval is not permission for undisclosed bulk cleanup, publication,
weaker acceptance or expanded scope; silence is not approval. Reuse approval
already given, and defer settings unrelated to completing this setup.

Cover the following in the profile; this is a checklist for the agent, **not a
questionnaire for the user**:

- **Vocabulary and horizon:** labels, areas, current milestone and finding
  budget. Compare documented and actual labels; do not erase live work to fit
  a list. If needed, establish the current slice during cleanup. A missing
  charter is written through `to-milestone` when the user invokes it; the
  initial budget is still explicitly agreed, including through profile approval.
  Only the current milestone
  is decomposed, but its independent features may run concurrently.
- **Gate strength:** retain the agreed choice or recommend one in the profile. `block-new`
  is recommended where historical snapshots exist: introduced errors block,
  old debt remains visible. `block` rejects every error; `report` prints
  errors without rejecting a commit. Explain each cost. Defaults for age
  thresholds may be retained: staleDays 14, holdDays 2, bulkCluster 20.
- **Development:** choose `tdd` or `test-after`, independently of work size.
  Both require related worker tests and final stage acceptance. For non-code
  work identify equivalent checks; never force a disruptive live drill.
- **Execution:** parallel capacity, atomic claims or serialized assignment,
  isolated workspaces, integration ownership, and how the tracker represents
  submitted and implemented-but-unaccepted work. No artificial chains between features,
  stages or tasks; describe real conflicts and prerequisites.
- **Verification:** commands for static checks, related tests, full checks,
  mutation testing of changed logic, its time budget and handling of meaningful
  survivors. Where tooling is unavailable, agree an explicit alternative or
  an acceptance escalation; never label skipped mutation checks as passed.
- **Review:** prefer another model when available. Choose the documented
  fallback if it is unavailable and whether independent review is required
  for acceptance. Two agents using the same model are not another model.
- **Documents and commit links:** read [documents.md](documents.md) for the
  lifecycle, templates, normalized document gate and trust boundary. Map vision,
  roadmap, charters, current capabilities, changes, optional architecture/decisions
  and exploration notes onto existing project documents. Recommend defaults only
  for missing roles, not a mandatory empty directory tree. Choose one workflow
  owner; do not move other tools' documents or disable their hooks implicitly.
  Include document policy, verified evidence/approval sources and their practical
  enforcement limits in the profile. Choose the
  project's task-reference convention for **every commit**, including setup,
  documentation, research and prototypes. Decide how generated merge/revert
  commits retain that link; they are not silent exemptions.

## 3. Write or repair the integration

Where other agents share a checkout, use an isolated branch/worktree for
installation. Staging in a shared index risks another agent committing it.

**Config:** keep changing choices in one project JSON file. A starting shape:

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
    "maxWorkers": 1,
    "mutationBudgetMinutes": 10,
    "mutationFallback": "<agreed alternative or escalate>",
    "reviewPreference": "different-model",
    "reviewFallback": "<same-model independent reviewer | disclosed self-review | escalate>"
  },
  "setupStatus": "pending",
  "setupVersion": null,
  "setupVerifiedAt": null,
  "projectWords": ["<project names>"],
  "trackerWords": ["<tracker names>"]
}
```

The execution numbers above are examples, not choices to impose. A profile
approval counts as a decision; delegated routine defaults need no per-field
answer. Consequential unknowns without agreement remain unresolved. `findingBudget` and
`currentMilestone` may remain null only when no live slice has been admitted.
`setupVersion` is the version last fully proved and landed, not the version
currently being attempted.

Record `setupStatus: pending` when beginning a reconciliation and `failed` if
it cannot complete, retaining the last successful version/time as history.
This prevents a failed rerun at the same version from looking currently verified.

**Adapter:** read [model.md](model.md) completely before writing or updating it.
It exports all statuses, including closed, submitted and implemented, real dependency
edges, holders and recorded integration evidence. Its ready operation is
stage- and checkout-aware. A tracker without a native implemented status must
persist an explicit mapping; never silently map it to ready or closed.
Submitted results likewise need a durable pending-integration mapping.
For `block-new`, verify historical export and historical config retrieval;
otherwise choose an honest supported strength with the owner.

**Rules:** call all three shipped checks in place when they are in the project, or
copy them verbatim. Record provenance in the integration, not inserted into the
copies. No Node: port all three checks and prove the same fixtures. A matching version
does not replace byte comparison or port proof.

**Wiring:** the backlog gate runs in the project's local hook and CI. For
`block-new`, compare the working export with the last committed revision and
its config; CI uses the PR merge-base or the previous head of a push, never a
branch's merge-base with itself. Fail loudly on misuse (exit 2); `report`
only relaxes policy violations (exit 1), not a broken command.

The **commit-link check** runs in commit-msg and CI: the project adapter parses
the selected message convention into the normalized input of
`check-commits.mjs`. Local verification checks the pending message; CI checks
every newly introduced commit and fails if that enumeration unexpectedly yields
none. Resolve links against all relevant tracker tasks, including closed ones.
This mandatory check is separate from the backlog's selectable strength.
Verify project-specific parsing with both linked and unlinked real messages.

**Document gate:** implement the deterministic export and protected wrapper
described in [documents.md](documents.md). Wire `product` plus `feature` before
first-product implementation, `feature` for new changes, `acceptance` for stage
evidence and `close` before accepting synchronized current docs. CI selects the
actual transition and enumerates all affected documents; neither a weaker phase
nor an empty export supplied by the author is a bypass. Require it independently
of backlog strength. Prove actual file parsing, baseline selection, receipt
verification, policy provenance and tracker closure enforcement or disclose the
remaining audit-only limitation. No evidence authenticity claim from JSON alone.

**New projects:** conversations may precede setup without files or issues. Once
retaining work, create the setup task first, then seed only agreed vision/current
slice and resource locations. The user-invoked `to-milestone` establishes the
charter when requested. Setup may finish with no admitted implementation, no
current capabilities and no roadmap beyond a vision section; do not invent a
product to make its admission gate green. Prove the gate using recoverable
fixtures, and report product readiness separately from installation readiness.

**Documents:** update the project's own tracker doc using
[integration.md](integration.md); do not create a rival table of tracker verbs.
Run every read operation (including ready, holds and children of every status).
Test writes in reversible scratch state or inspect their documented behaviour.
Verify claim concurrency; rereading a last-write-wins field is not mutual exclusion.
Point every harness's loaded agent doc at this integration. The pointer says:

> All retained work and commits belong to tracked tasks. File discoveries through
> `to-backlog`; implement through `take-task`; close only after stage acceptance
> through `close-out`. Read Backlog integration in <path> before writes. After
> updating the skill set, run `setup-shady2k-skills` to reverify this project.

Use the actual path and harness invocation syntax. Do not duplicate settings,
milestone values or commands in that pointer.

## 4. Prove the whole installation, every time

An existing setup runs all these proofs too, even when versions match.

1. **Shipped checks:** run all three scripts' self-tests beside this skill, where
   fixtures exist. Compare installed copies byte for byte; ports run the corpus.
   Commands: `node check.mjs --selftest --config <project-config>` and
   `node check-commits.mjs --selftest` and `node check-docs.mjs --selftest`, from this skill's directory. The first
   uses its fixture config for rules and the project config for portability.
2. **Tracker and adapter:** compare counts per status and ready leaves with
   actual tracker state; explain every difference. On an empty tracker use
   recoverable proof issues. Exercise claim, release, implemented, same-stage
   dependent readiness and cross-stage acceptance, plus independent ready work.
   Check pending submitted results survive a handoff without reimplementation.
   Check dependency cycles and the exact task-reference parser.
3. **Real entry points:** plant a recoverable backlog violation and run the
   actual hook; observe failure (or visible reporting at report strength), undo,
   observe clean. Exercise the real commit-message entry point with a missing
   task, an unknown task and a valid leaf. Verify both CI range/baseline
   calculations with representative revisions. Do not publish test commits.
4. **Execution commands:** verify that configured commands exist and operate in
   the declared environment. Exercise static, related and full checks; use a
   bounded mutation sample and verify reviewer availability/fallback. Clearly
   report unperformed proofs. A failure requires repair or an explicit supported
   change of settings, not a successful setup stamp.
5. **Current state:** run the gate on the cleaned live backlog. Preserve both
   pre/post cleanup age snapshots and use their bounded correction. Show the
   actual result, unresolved debt, chosen strength and remaining limitations.
6. **Documents:** run the recoverable real-entry-point proofs in documents.md,
   including a missing scenario in the actual selected format, stale source
   requirement, wrong task, stale/missing receipts and unsynchronized closure.
   Verify independent changes still pass. Adopt only the currently affected
   legacy scope; do not treat an old plan or a model's summary as verified state.

Keep durable proof evidence with the setup task. A detected tracker outage,
missing runtime, stale integration or failed hook is a specific repair, not
a reason to discard every prior answer.

## 5. Land and record the verified version

Land through the project's authorized workflow and verify from the checkout
people use: docs reachable, all three checks run, hooks installed in that clone.
An isolated branch alone is **written and proved, not installed**.
Ask only for landing actions not already authorized.

Shared hooks may already run in checkouts without the new files. Let through
only a tree that never had this installation, visibly; a missing or broken
gate in a configured tree is an error, not a blanket bypass.

Only after all required proof and target-checkout verification, write the
current protocol version to `setupVersion`, the proof time to
`setupVerifiedAt` and `setupStatus: verified`, linked to the setup task. Persist that final stamp through
the same authorized workflow and recheck the target. Until it is present there,
report setup as pending. This final metadata write does not invalidate proofs
whose checked inputs did not change; any other intervening change does.

Report to the owner by the protocol's **Speaking to the owner**: first whether
work can continue and through which skill; then what changed for them, what was
cleaned (tasks by title), and any limitation with its practical consequence.
What was retained and the proof details go to the setup task, summarized in a
line. On failure keep the previous successful version/time but set
`setupStatus: failed`, state what failed, and never report the project reverified.

## Updating and migration

After **every plugin or skills update**, run this skill again. The install/update
instructions and the agent-doc pointer request it; do not claim a universal
automatic update hook. Tracker-writing skills compare the protocol version with
`setupVersion` and the installed rules versions before proceeding. Missing or
mismatched values request this user-invoked setup. Matching values still do not
short-circuit an explicit setup invocation.

For old installs, migrate configuration, adapter statuses, commands, hooks and
documents as part of the full reconciliation. Keep answered preferences;
include newly introduced settings in the recommended profile rather than
restarting an interview about development mode, capacity and mutation policy.
A pre-0.5 standalone backlog document is merged into the project's tracker doc,
with references updated and duplicated protocol removed. Retain compatibility
until other harnesses using the old installation can migrate. Never claim
0.7 execution semantics work against an unproved old adapter.
