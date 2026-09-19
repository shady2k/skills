---
name: ask-shady2k
description: Get oriented in the project, read-only: its picture, progress, where it stands now and the ways forward with their consequences.
disable-model-invocation: true
---

# Ask shady2k

Read the project and give its owner what they need to decide what to do next:
what the product is, how far it has come, where it stands now, and which ways
forward exist with what each costs and postpones. Then recommend one by name.

**This skill is read-only.** It changes no files, tracker items, claims, holds,
branches or configuration, and it commits nothing. Reading the tracker and
running the gate's report are reads. Run a project check only when it is
documented as side-effect-free; otherwise report it as not run. Anything that
needs a write is named as the skill that would do it.

## 1. Read intent and choose depth

Infer depth from the request; do not make the user pick a mode.

- **"What next?"** from someone in the flow: the few facts that justify one
  action, then that action.
- **Orientation**: returning after a break, a new or unfamiliar project, "where
  are we", "what are our options": the full picture of sections 3 and 4.
- **Free discussion or imagination**: `brainstorming` directly, without setup
  or a tracker. Evidence-only questions can use `to-research`. No task,
  document or implementation step follows from thinking.

## 2. Collect evidence

**Always, with or without setup:** the README and agent doc; vision, roadmap,
charters, current specs, glossary and decision records where they exist; the
code's shape and its checks and CI; git history, branches, worktrees and
uncommitted changes. Recent history is progress evidence, not only the tracker.

**Where the project has a backlog integration** (the project's agent doc points
at it): read [`protocol.md`](protocol.md). Compare the protocol version with
config `setupVersion` and all three installed checks' versions and require
`setupStatus: verified`. Run the gate from this checkout; if it fails, name the
actual cause: an unlanded installation, missing runtime, tracker outage or
broken wiring, inspecting other worktrees when an installation may be stranded
there. Collect the gate's JSON report, config values, charter, outcomes, holds,
submitted/implemented tasks and stage acceptance records, and ready leaves
using the integration's stage/checkout-aware operation. Distinguish an owner
actively coordinating acceptance from an abandoned hold.

**Without an integration, or with an incompatible one:** state that as a fact
and continue from the repository. Mark what cannot be known without it, such as
task states and acceptance, instead of guessing. Do not replace an inaccessible
tracker or restart an interview without evidence.

## 3. Build the picture

Write only sections that have something to say. Speak in product terms: what a
user can do, not which files changed. Separate facts, inferences and unknowns,
and say what evidence each rests on.

- **Product:** what it is for and for whom; what users can already do; the
  distance to the vision.
- **Progress:** the milestone's outcomes as accepted, in work, not started or
  stalled; what recent work changed for users; the pace, where history shows it.
- **Where we are now:** active and pending work, what awaits integration or
  acceptance, holds, stranded branches or uncommitted results, and each real
  blocker with what releases it.
- **Health and risk:** failing, missing or unrun checks; specs or docs drifting
  from the code; deferred findings accumulating; setup out of date. Say what
  each risks for the product, not only that it exists.
- **Beyond the horizon:** deferred work and ideas worth thinking about, marked
  as hypotheses. They are not tasks and do not widen the milestone.

## 4. Ways forward

The recommendation comes from the first applicable condition below; the
ladder's order protects finishing before starting. Then give two or three real
alternatives. For each: what it achieves, what it costs in time and budget,
what it postpones, its risk and whether it is reversible. Include stopping
(`/handoff`) when that is a real option. An alternative outside the current
milestone is a scope change and is labelled as one, routed to `/to-milestone`
or `to-backlog`; an open idea goes to `brainstorming`. Do not invent work to
fill the list or present every skill.

| condition | next action |
| --- | --- |
| tracker/integration absent, setup version absent or incompatible | `/setup-shady2k-skills` before managed work: choose/install or reverify, explaining what is missing; the picture is still given |
| checks cannot run | specific repair through setup; land a stranded installation when that is the cause |
| no current slice and existing live work | `groom-backlog` to agree and clean the slice; setup owns this during initial installation |
| no milestone or its charter is missing | `/to-milestone` |
| an abandoned active hold | release the actual abandoned work, preserving implemented results |
| new gate errors | report their concrete fixes; use `groom-backlog` for a broad cleanup |
| submitted results or implemented work await integration/acceptance | resume that stage with `/take-task`; do not reimplement its leaves |
| accepted work awaits closure | `close-out` with the acceptance record |
| current outcomes are all accepted | `/to-milestone` |
| new product lacks direction/first charter | `/to-milestone`; draft from known decisions, not a field-by-field interview |
| a change fails document readiness | explain the concrete missing contract, stale base or unresolved decision; use `to-spec` |
| an outcome needs design or decomposition | `/take-task` selects the route, or `to-spec` when the user wants design only |
| independent ready work exists | `/take-task` for the stage or requested work; mention parallel opportunities |
| all remaining work is genuinely blocked or held | state the required result/owner; do not widen the milestone or invent work |

For pending acceptance already owned by an active coordinator, recommend
independent ready work instead of duplicating its acceptance. One stage's
blocker does not block unrelated stages or features.

The user's immediate intent can select a helper: an arrival uses `to-backlog`,
a diagnosis uses `diagnose-bug`, an unresolved product decision uses
`brainstorming`, evidence gathering uses `to-research` or `to-prototype`.

## 5. Report

Lead with the headline: one or two sentences on where the project stands. Then
the picture, compact, then the ways forward with the recommendation first. Use
"Title" (id), never identifiers alone. Use the established role, otherwise
product engineer: consequences for the product across scope, time, cost and
risk. End with the recommended action and, only if one exists, the single
material decision it needs. This is orientation, not a questionnaire: do not
ask about each finding, and do not start the recommended action.

## Routes

- `setup-shady2k-skills`: choose/verify the tracker, clean its queue, configure
  execution through a role-aware recommended profile and fully prove setup;
  repeat after updates and whenever requested, preserving prior decisions.
- `to-milestone`: agree outcomes and scope/budget; independent outcomes may run together.
- `take-task`: route tracked work through proportional design, parallel local
  implementation where possible, integration and stage acceptance.
- `brainstorming`: explore, investigate or decide through dialogue; offer ideas,
  understand reasoning before independent disagreement; no mandatory artifact.
- `to-spec`: short or full proposed change to living capability specs, with
  scenarios and document readiness checks; not a prerequisite for free discussion.
- `to-stages`: stages sized for a session including acceptance, with real
  dependencies and parallel-ready leaves.
- `diagnose-bug`: evidence-based diagnosis; fixing requires an authorized tracked task.
- `to-prototype`: a bounded runnable experiment, retained through its task.
- `to-research`: a bounded primary-source investigation with a cited result.
- `model-domain`: durable domain terms and consequential decision records.
- `to-backlog`: file work before implementation, preserve findings and agree admission.
- `close-out`: synchronize accepted behaviour into current specs before closure;
  preserve integration, pending acceptance and interrupted publication.
- `groom-backlog`: snapshot, agree the live slice, clean reversibly and verify.
- `handoff`: transfer state, revisions, evidence, workers and the next action.
