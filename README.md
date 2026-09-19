# shady2k-skills

Fifteen skills for exploring ideas and taking tracked work to accepted results. They work
with a project's chosen tracker and any harness that reads `SKILL.md`.
The reasoning and history are in [docs/design.md](docs/design.md).

Skills guide dialogue and decisions; portable checks enforce the backlog's shape,
commit links and document lifecycle. The project owns its adapters and wiring, proved during setup.
A green backlog is not evidence that the code works.

## Why it exists

The set grew out of the owner's own project, built through agents, and the
problems it had there.

- **Light skills oblige nothing.** A skill can be invoked at any moment or
  never, and when nobody invokes it no process is followed. Heavier frameworks
  did not fix that; they only made each step more expensive.
- **The tracker became a dump.** Most open issues were marked ready, and most
  of those "in progress" had not been touched for days. A status that is false
  almost every time is not a status, and a queue where nearly everything is
  ready cannot tell anyone what to do next.
- **Work planned too far ahead went stale.** Many epics were created in advance
  and lost their point before their turn came. Epics did not fit a session and
  ran for days.
- **Findings jumped the queue.** Bugs and architectural gaps found mid-feature
  were put at the front and pushed the feature out by weeks.
- **Names, not identifiers.** A person does not remember issue numbers; agents
  kept talking as if they did.
- **Losing the thread.** After a break, or in an unfamiliar project, nobody
  could say at a glance what the product already does, how far the milestone has
  come, what is stuck and what the sensible next step is. The tracker holds the
  facts but not that picture.

So the set keeps the skills light and puts the obligations in checks: a gate
that fails on a broken backlog, commits that must name their task, documents
that must be ready before work starts. The details and the history of each
decision are in [docs/design.md](docs/design.md).

### Start with `ask-shady2k`, almost every time

`ask-shady2k` answers the question behind the last problem: where are we, and
what now? It reads the project, the tracker when there is one and the git
history, then gives the product's picture, progress, the current state, risks
and the ways forward with their consequences, and recommends one action by
name. It is read-only, so running it costs nothing but a moment and never
changes anything.

Run it at the start of a session, after a break, after a stage is accepted,
when you open a project you have not seen in a while, and whenever you are not
sure what comes next. Ask "what next?" for a short answer, or "where are we?"
for the full picture. Skip it only when you already know the exact task
(`take-task`) or just want to think something through (`brainstorming`).

## Installation and updates

Choose your agent: [Claude Code](#claude-code) · [Codex](#codex) ·
[Other agents / standalone skills](#other-agents--standalone-skills).

If you use both Claude Code and Codex, install the plugin separately in each.
Within one agent, use either the plugin or standalone skill files (including
development symlinks), not both: otherwise the same skills appear twice.

### Claude Code

#### Install

Run these commands inside Claude Code:

```text
/plugin marketplace add shady2k/skills
/plugin install shady2k-skills@shady2k
```

Start a new Claude Code session in the target project, then run setup:

```text
/shady2k-skills:setup-shady2k-skills
```

Invoke other plugin skills the same way, for example
`/shady2k-skills:take-task`.

#### Update

Inside Claude Code:

```text
/plugin marketplace update shady2k
/plugin update shady2k-skills@shady2k
```

Start a new session and rerun `/shady2k-skills:setup-shady2k-skills`
in each project that uses the set.

### Codex

#### Install

Run these commands in your terminal (verified with Codex CLI `0.154.0`):

```bash
codex plugin marketplace add shady2k/skills
codex plugin add shady2k-skills@shady2k
```

Start a new Codex session in the target project, then run setup in the chat:

```text
$shady2k-skills:setup-shady2k-skills
```

Invoke other plugin skills the same way, for example
`$shady2k-skills:take-task`.

#### Update

In your terminal:

```bash
codex plugin marketplace upgrade shady2k
codex plugin add shady2k-skills@shady2k
```

Start a new session and rerun `$shady2k-skills:setup-shady2k-skills`
in each project that uses the set.

See [Codex installation details](docs/codex.md) for local checkouts,
compatibility notes and isolated installation tests.

### Other agents / standalone skills

Use the universal installer if your agent reads `SKILL.md` files. This is also
an alternative to the plugin for Claude Code and Codex, not an extra step.

```bash
npx skills@latest add shady2k/skills
```

Select your agent and install the complete set, including the installer.
Run `setup-shady2k-skills` in your agent's skill syntax: standalone Claude Code
uses `/setup-shady2k-skills`; standalone Codex uses `$setup-shady2k-skills`.

To update:

```bash
npx skills update
```

Then rerun setup. Individually installed folders remain self-contained, but a
workflow that needs another skill must have that skill installed too.
When switching installation methods, inspect and remove only the previous
installation of this set; preserve any locally edited skill files.

### What setup verifies

Every setup invocation rechecks the entire installation, including one whose
version matches. It selects and initializes a tracker if needed, snapshots and
cleans an existing queue with the owner, preserves valid prior choices, verifies
adapters and execution commands, proves local/CI hooks and lands the result.
New settings are presented as one recommended profile: what each controls, why
it is recommended and the consequences of changing it. Accept the profile or
change only named entries. Explanations match your role (product engineer by
default); only material unresolved decisions need separate questions. Existing
answers and delegated routine choices are not needlessly asked again.

The config records setup status and the last fully verified version. A failed
rerun remains failed even at the same version. Before writes, the
skills compare it and the installed checks with their protocol version and
request setup when they differ. This is a first-use guard and an update
instruction, not a claim that every harness runs an automatic update hook.

## The flow

"Let's imagine" or "just discuss" starts `brainstorming`, not a setup interview.
The agent contributes ideas, explores other perspectives and tests assumptions.
It understands your reasoning before independently agreeing or disagreeing.
Discussion and read-only research may end without a decision, file or task.
Scratch experiments do not become production work automatically.

Setup establishes the tracker and a usable queue; a milestone charter sets the
current scope. `take-task` then selects the route from size, risk and unknowns:
a short behavioural delta for small work, or discussion, research/prototype,
specification and decomposition where needed. TDD is a separate project choice.

A stage has its own observable result and fits one session **including
acceptance**. Independent tasks, stages and features may execute in parallel.
Dependencies name required results or conflicts, never list order or hierarchy.

Workers run static checks and related tests, including affected neighbouring
behaviour. In TDD mode they work red → green → local refactor; in test-after
mode checks follow implementation. Workers preserve returned results as
**submitted**, with their revision/location and evidence. The coordinator integrates each result and
records it as **implemented**, making it available to dependants in the same
stage. It is not yet closed. Across stages, prerequisites wait for acceptance.

The assembled stage receives full checks, scoped mutation testing and final
review, preferably by another model. Corrections receive fresh verification.
`close-out` synchronizes the accepted change into current capability specs and
closes the tasks and stage only with evidence for the accepted revision. A
handoff preserves implemented work, unfinished acceptance and pending publication.

Every commit belongs to existing leaf tasks, including documentation,
research, prototypes and setup. The commit-message hook and CI enforce links;
the separate backlog gate enforces structure.

## What the checks enforce

| check | rejects |
| --- | --- |
| `off-milestone-open` | live work outside the current milestone |
| `finding-budget` | admitted findings beyond the explicit budget |
| `idea-in-queue`, `idea-blocks-work` | ideas offered as work or blocking it |
| `blocked-by-deferred` | live work waiting for deferred work |
| `stale-hold` | active work unheld or apparently abandoned |
| `epic-without-criterion` | a live feature/stage without a meaningful DONE WHEN marker |
| `area-label`, `label-vocabulary` | missing/multiple areas or unknown labels |
| `parent-cycle`, `dependency-cycle` | cycles in hierarchy or live prerequisites |
| `nonleaf-dependency` | blanket blocking edges involving containers |
| `implemented-without-evidence` | implemented work without recorded integration and local-check evidence |
| `submitted-without-evidence` | submitted work without a durable result and local-check evidence |
| `stale-edge` (warning) | absent or long-untouched prerequisites needing review |
| `check-commits.mjs` | unlinked commits or links to absent issues/containers |
| `check-docs.mjs` | unfinished required fields, missing scenarios/task links, conflicting or stale deltas, missing coverage, stale/missing receipts and unsynchronized current requirements |

The backlog strength is chosen at setup: `block-new` blocks introduced errors
and reports old debt, `block` blocks every error, `report` only reports policy
violations. Invalid input fails in all modes. Commit links are mandatory
independently of that choice. Project adapters parse messages and select commit
ranges; setup must prove those parts as well as the shipped checks. Document
readiness/acceptance checks are also mandatory independently of backlog strength.
They consume deterministic exports, a separately selected policy and verified
runner/approval receipts. The checker does not authenticate those inputs itself.

The checks do not prove behavioural correctness, truthful test evidence,
semantic task relevance or that the right scope was chosen. Session sizing,
next-milestone decomposition and understandable titles are still instructions,
not executable checks.

## Documents: direction, current state and changes

For a new repository, begin with vision, the first milestone charter and one
useful change. Roadmap may start as a section of vision. Create the rest only
when needed:

```text
docs/vision.md                       # purpose, audience, exclusions
docs/roadmap.md                      # outcomes and sequencing, not copied task status
docs/milestones/<milestone>.md       # agreed scope and acceptance
docs/system/capabilities/<name>.md   # accepted mainline behaviour
docs/system/architecture.md          # current boundaries, when useful
docs/changes/<change>/change.md      # proposed requirement deltas
docs/changes/<change>/design.md      # optional technical design
docs/decisions/                      # significant rationale
docs/explorations/                   # optional retained research
```

These are defaults, not required paths. Setup maps existing documents in place,
including projects using Superpowers, Spec Kit or OpenSpec. It does not uninstall
them, move their files or create a rival task list. Choose one workflow owner and
one canonical source per artifact. An old plan is intent, not proof of current
behaviour. Baseline only the legacy capabilities being changed, then grow coverage
through accepted work. Independent changes do not acquire blanket dependencies.

The [document contract and templates](skills/backlog/setup-shady2k-skills/documents.md)
define four checkpoints: product intent, feature readiness, stage evidence and
current-spec synchronization. The project adapter parses its chosen document
format deterministically; there is no universal Markdown importer. Protected CI
can block merges; blocking direct tracker closure requires an actual transition
guard. A local hook or prose instruction is not a tamper-proof boundary.

## Skills

### User-invoked

- [setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md): install
  or fully reverify tracker, workflow and checks with a recommended settings profile.
- [ask-shady2k](skills/backlog/ask-shady2k/SKILL.md): read-only orientation: picture, progress,
  ways forward and the recommended next action.
- [to-milestone](skills/backlog/to-milestone/SKILL.md): agree outcomes, scope and budget.
- [take-task](skills/engineering/take-task/SKILL.md): coordinate tracked work to stage acceptance.
- [handoff](skills/productivity/handoff/SKILL.md): transfer the current work and pending acceptance.

### Model-invoked

Also directly callable by the user. Availability does not authorize unrelated
changes, new scope or external publication.

- [brainstorming](skills/productivity/brainstorming/SKILL.md): exploratory dialogue,
  evidence and independent judgment; decisions and artifacts are optional.
- [to-spec](skills/engineering/to-spec/SKILL.md): short/full changes to living specs.
- [to-stages](skills/backlog/to-stages/SKILL.md): session-sized stages and real dependencies.
- [to-research](skills/productivity/to-research/SKILL.md): bounded primary-source research.
- [to-prototype](skills/engineering/to-prototype/SKILL.md): runnable evidence for one design question.
- [diagnose-bug](skills/engineering/diagnose-bug/SKILL.md): distinguish causes with evidence.
- [model-domain](skills/engineering/model-domain/SKILL.md): glossary and decision records.
- [to-backlog](skills/backlog/to-backlog/SKILL.md): register work and discoveries in the right lane.
- [close-out](skills/backlog/close-out/SKILL.md): close accepted work and preserve pending results.
- [groom-backlog](skills/backlog/groom-backlog/SKILL.md): reversible queue cleanup, including setup bootstrap.

## Status

Version 0.7 revises execution and setup. Fixtures and package checks run locally;
the new complete workflow still needs validation in real projects. Earlier
installation runs informed the protections around proof, isolated staging and
landing. Harness-specific automatic update/session hooks are not shipped.
Version 0.7.2 replaces per-setting interviews with role-aware recommendations
across the set; consequential decisions and explicit authorization remain required.
Version 0.8.0 adds open-ended dialogue, living-document templates and a portable
document gate. Its fixture and CLI tests do not replace project adapter/CI proof
or demonstrate conversational quality; live rollout remains a separate validation.
Version 0.9.0 turns `ask-shady2k` into a read-only orientation: the project's
picture, progress and ways forward with consequences, also before setup.
Version 0.10.0 no longer holds setup and work until the document gate is wired:
it becomes its own stage, and documents are checked by reading meanwhile.

## Credits

The original shape and work-skill ideas come from
[mattpocock/skills](https://github.com/mattpocock/skills), MIT:
[license](docs/third-party/mattpocock-skills.LICENSE). They are rewritten here
around this set's tracker protocol.

The 0.8 document lifecycle draws on [OpenSpec](https://github.com/Fission-AI/OpenSpec)
(current specs versus deltas), [Spec Kit](https://github.com/github/spec-kit)
(scenarios and traceability), and [Superpowers](https://github.com/obra/superpowers)
(proportional design and evidence before completion). Templates and checks here
are original implementations, not bundled copies of those tools.

## Development

```bash
npm test                  # backlog/commit/document fixtures, CLI and package invariants
npm run test:mutation     # deliberately break checks and observe failures
npm run protocol          # synchronize folder-local protocol copies
scripts/link-skills.sh    # link into local skill directories
```

[AGENTS.md](AGENTS.md) defines layout, invocation, portability and versioning.
Role-aware dialogue evaluation cases are in
[test/dialogue-scenarios.md](test/dialogue-scenarios.md); automated package
checks do not establish conversational quality.
