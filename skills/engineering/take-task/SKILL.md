---
name: take-task
description: Take tracked work through the right amount of design, parallel implementation where possible, and acceptance of a complete stage.
disable-model-invocation: true
---

# Take task

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. The project's agent doc points at it; follow the pointer before you
write anything. If there is none, tell the user to run
`/setup-shady2k-skills`, and leave the backlog as it is until then. Read
[`protocol.md`](protocol.md), including its setup-version check.

## 1. Establish the work and choose its route

Resolve the task, list, stage or outcome the user named; otherwise inspect the
current milestone and propose a ready stage by name. Resolve or file the task
before implementation. Read its requirements, existing spec, charter and code.
Resume submitted results at integration and implemented stages at acceptance,
not from scratch.

Use the user's established role, otherwise product engineer. Present the
recommended route and execution profile together, explaining what they achieve,
why they fit, and effects on time, cost and risk. Preserve setup choices and
prior approvals; let the user change named entries without asking them to
select worker counts, commands or every helper. Delegated recommendations cover
routine choices, not new scope, spending or weaker acceptance requirements.

Assess **size, uncertainty and risk**, independently of the project's TDD
choice. A small irreversible change can need more design than a large routine one.

- **Small, understood change:** use `to-spec` for a short behavioural delta and
  `to-stages` for a single stage with just the necessary leaves. Reuse existing
  approved criteria rather than manufacturing documents or another interview.
- **Bug:** use the existing requirement and a regression scenario. Update the
  spec only for a discovered gap or an approved behaviour change. Use
  `diagnose-bug` when the cause needs investigation. Reuse its acceptance stage,
  or use `to-stages` to attach even a root-level bug to a minimal stage before
  dispatch; a small bug does not need a full feature-spec interview.
- **Uncertain or substantial work:** use `brainstorming`, then `to-research`
  or `to-prototype` where evidence is needed, followed by `to-spec` and
  `to-stages`. Continue automatically through already authorized decisions;
  ask only about consequences that belong to the owner.

Use installed skills through the harness's available mechanism. If a required
helper is missing, name it and the installation action; do not pretend it ran.
A stage includes implementation, integration, review and corrections in its
session budget. Split an oversized stage before dispatch. Do not quietly
expand a request for one task into an entire feature: describe the necessary
stage boundary and resolve a material scope change with the owner.

## 2. Coordinate and dispatch

Read the execution settings from the gate config and commands from the
integration. One coordinator owns integration and acceptance of each stage;
it may implement too. Claim leaves atomically, or serialize assignment through
the coordinator if the tracker has no atomic claim.

Dispatch independent ready tasks in parallel where resources and tools permit.
Independent stages and features may also proceed in parallel, with distinct
coordinators and acceptance records. Do not add dependencies because of list
order, hierarchy or a shared milestone. Use the protocol's required-result and
conflict rules; if parallel execution is unavailable, use the same dependency
graph sequentially without rewriting it into a chain.

Each worker receives its task and criterion, the relevant spec, dependencies,
base revision, owned scope, local check commands, TDD choice and return format.
Use isolated checkouts for concurrent writes that could interfere. Coordinate
shared generated files, migrations and dependency locks explicitly.

## 3. Implement with local feedback

In **TDD** mode, watch a behaviour check fail for the intended reason, write
the least that passes it, then refactor locally while it stays green. Repeat
one slice at a time. In **test-after** mode, implement and add or update the
relevant checks before returning the work. Both modes require verification.

The spec's observable seams define acceptance, not a ban on local tests.
Choose stable behavioural interfaces at an appropriate level; expected values
come from the requirement or an independent example, not a copy of the algorithm.
For operations, use a safe rehearsal or isolated environment; do not cause a
live outage merely to manufacture a failing check.

Workers run static checks and tests related to their change, including affected
neighbouring behaviour. They do not each run the full suite, mutation campaign
or final review. A shared change can legitimately widen their related tests.

Return the task, commits linked to it, changed behaviour, check commands and
results, remaining uncertainty and integration notes. Record `submitted` with
the durable result revision/location and evidence before releasing the worker
hold. A worker's "done" means ready to integrate, not accepted or closed.

## 4. Integrate and handle discoveries

Integrate each completed result into the stage checkout, resolve conflicts and
run related checks again when integration changes the result. Record the
integrated revision and evidence before marking the task `implemented`.
Its dependants within this stage may now start against that result; dependants
in other stages wait for acceptance. Never release implemented work into ready.

- Decide reversible implementation details yourself. Escalate changed product
  behaviour, material cost/risk, irreversible choices or missing authority.
  Pause the affected branch, recommend an option with its reason and explain
  alternatives in the user's terms, and continue
  independent authorized work.
- File unrelated bugs, debt and blocked questions through `to-backlog`.
  Fixing this stage's failure to meet its agreed criterion is still this work;
  it does not automatically consume the finding budget.
- A stubborn failure uses `diagnose-bug` within the current task.
- If the session will not fit, preserve the assembled revision and pending
  acceptance and recommend the user-invoked `/handoff`; never call a partly
  checked stage accepted.

## 5. Accept the assembled stage

Once its results are integrated, run the project's full required checks and
the stage's own DONE WHEN on the assembled revision. Then run mutation testing
on changed logic under the configured time budget. Investigate meaningful
survivors; distinguish equivalent mutations, missing tests and tool failures.
Unsupported tooling, timeouts and skipped checks are reported as such, never
as passed. Use the project's agreed fallback; if none exists, resolve the
acceptance limitation before closing.

Obtain final review using [`review.md`](review.md), preferably with another
model when available. Fix valid findings within scope and repeat the affected
checks. If a correction changes the assembled code after its full run, rerun
the required full checks on the final revision before acceptance. Repeat
mutation checks and review where their evidence was invalidated; unchanged
evidence tied to the same inputs can be reused.

Record the base and final revision, included tasks, criteria, test and mutation
results, review findings and their disposition. For non-code work, use the
project's corresponding evidence and explain inapplicable checks. Then use
`close-out` to close the accepted tasks and stage. Commit links and clean
backlog are necessary checks, not substitutes for behavioural acceptance.
