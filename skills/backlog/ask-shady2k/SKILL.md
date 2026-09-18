---
name: ask-shady2k
description: Read the current work and recommend the next useful action, including setup revalidation, stage acceptance or independent ready work.
disable-model-invocation: true
---

# Ask shady2k

Read the state, then answer with the next useful action by name.

This project's **backlog integration** should have been provided to you: how
its gate is run, how its tracker is driven, where its vision and charters
live. Follow the project's agent-doc pointer. If it is missing, recommend
`/setup-shady2k-skills`. Read [`protocol.md`](protocol.md).

## 1. Verify compatibility and collect state

Compare the protocol version with config `setupVersion` and both installed
checks' versions and require `setupStatus: verified`. Missing or mismatched
versions or a pending/failed setup request setup, even when the
old gate runs. Matching versions do not bypass a user-requested setup rerun.

Run the gate from this checkout. If it fails to run, name the actual cause:
an unlanded installation, missing runtime, tracker outage or broken wiring.
Inspect other worktrees when an installation may be stranded there. Do not
replace an inaccessible tracker or restart the interview without evidence.

Collect the gate's JSON report, config values, charter, outcomes, holds,
submitted/implemented tasks and stage acceptance records, and ready leaves using the
integration's stage/checkout-aware operation. Distinguish an owner actively
coordinating acceptance from an abandoned hold.

## 2. Answer from the first applicable condition

| condition | next action |
| --- | --- |
| tracker/integration absent, setup version absent or incompatible | `/setup-shady2k-skills`: choose/install or reverify, explaining what is missing |
| checks cannot run | specific repair through setup; land a stranded installation when that is the cause |
| no current slice and existing live work | `groom-backlog` to agree and clean the slice; setup owns this during initial installation |
| no milestone or its charter is missing | `/to-milestone` |
| an abandoned active hold | release the actual abandoned work, preserving implemented results |
| new gate errors | report their concrete fixes; use `groom-backlog` for a broad cleanup |
| submitted results or implemented work await integration/acceptance | resume that stage with `/take-task`; do not reimplement its leaves |
| accepted work awaits closure | `close-out` with the acceptance record |
| current outcomes are all accepted | `/to-milestone` |
| an outcome needs design or decomposition | `/take-task` selects the route, or `to-spec` when the user wants design only |
| independent ready work exists | `/take-task` for the stage or requested work; mention parallel opportunities |
| all remaining work is genuinely blocked or held | state the required result/owner; do not widen the milestone or invent work |

For pending acceptance already owned by an active coordinator, recommend
independent ready work instead of duplicating its acceptance. One stage's
blocker does not block unrelated stages or features.

The user's immediate intent can select a helper: an arrival uses `to-backlog`,
a diagnosis uses `diagnose-bug`, an unresolved product decision uses
`brainstorming`, evidence gathering uses `to-research` or `to-prototype`.
Stopping suggests `/handoff`, with pending acceptance preserved.

## 3. Report briefly

Give the few state facts needed to justify the action, then that action.
Use "Title" (id), never identifiers alone. Explain what releases a real blocker;
do not present every skill unless the user asks for the map.
Use the established role, otherwise product engineer: say what the action
achieves, why it is recommended now and what it costs or postpones. Do not turn
routing into a configuration interview; setup presents a recommended profile,
and only material unresolved decisions need questions.

## Routes

- `setup-shady2k-skills`: choose/verify the tracker, clean its queue, configure
  execution through a role-aware recommended profile and fully prove setup;
  repeat after updates and whenever requested, preserving prior decisions.
- `to-milestone`: agree outcomes and scope/budget; independent outcomes may run together.
- `take-task`: route tracked work through proportional design, parallel local
  implementation where possible, integration and stage acceptance.
- `brainstorming`: role-aware recommendations; one genuinely unresolved
  consequential question at a time, not an interview about routine settings.
- `to-spec`: short behavioural delta or full spec, according to risk and uncertainty.
- `to-stages`: stages sized for a session including acceptance, with real
  dependencies and parallel-ready leaves.
- `diagnose-bug`: evidence-based diagnosis; fixing requires an authorized tracked task.
- `to-prototype`: a bounded runnable experiment, retained through its task.
- `to-research`: a bounded primary-source investigation with a cited result.
- `model-domain`: durable domain terms and consequential decision records.
- `to-backlog`: file work before implementation, preserve findings and agree admission.
- `close-out`: close accepted work; preserve integration and pending acceptance.
- `groom-backlog`: snapshot, agree the live slice, clean reversibly and verify.
- `handoff`: transfer state, revisions, evidence, workers and the next action.
