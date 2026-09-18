# shady2k-skills

Fifteen skills for tracked work, from an idea to an accepted result. They work
with a project's chosen tracker and any harness that reads `SKILL.md`.
The reasoning and history are in [docs/design.md](docs/design.md).

Skills guide decisions; portable checks enforce the backlog's shape and commit
links. The project owns its tracker adapter and wiring, proved during setup.
A green backlog is not evidence that the code works.

## Installation and updates

**Claude Code**, as a plugin:

```
/plugin marketplace add shady2k/skills
/plugin install shady2k-skills@shady2k
/setup-shady2k-skills
```

After updating:

```
/plugin marketplace update shady2k
/plugin update shady2k-skills@shady2k
/setup-shady2k-skills
```

**Codex**, as a plugin (verified with Codex CLI `0.154.0`):

```bash
codex plugin marketplace add shady2k/skills
codex plugin add shady2k-skills@shady2k
```

Start a new Codex session in the target project and run:

```text
$shady2k-skills:setup-shady2k-skills
```

After updating:

```bash
codex plugin marketplace upgrade shady2k
codex plugin add shady2k-skills@shady2k
```

Start a new session and run setup again. Plugin skills are namespaced: for
example, `$shady2k-skills:take-task`. Installation, compatibility and isolated
test details are in [docs/codex.md](docs/codex.md).

**Codex and other skill-compatible agents**, alternatively as files:

```bash
npx skills@latest add shady2k/skills
```

Install the complete set for composed workflows, including the installer.
Run `setup-shady2k-skills` in the harness's skill syntax after installation
and every update. Individually installed folders remain self-contained, but a
workflow that needs another skill must have that skill installed too.

Choose one installation method per agent: plugin **or** standalone skill files
(including development symlinks), not both. Otherwise the same skills appear
twice. When switching, inspect and remove only the previous installation of
this set; preserve any locally edited skill files. Standalone Codex skills use
unprefixed names, for example `$setup-shady2k-skills`. Update those files with
`npx skills update`, then rerun setup.

Every setup invocation rechecks the entire installation, including one whose
version matches. It selects and initializes a tracker if needed, snapshots and
cleans an existing queue with the owner, preserves valid prior choices, verifies
adapters and execution commands, proves local/CI hooks and lands the result.
New settings are asked; existing answers are not needlessly asked again.

The config records setup status and the last fully verified version. A failed
rerun remains failed even at the same version. Before writes, the
skills compare it and the installed checks with their protocol version and
request setup when they differ. This is a first-use guard and an update
instruction, not a claim that every harness runs an automatic update hook.

## The flow

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
`close-out` closes the tasks and stage only with evidence for the accepted
revision. A handoff preserves implemented work and unfinished acceptance.

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

The backlog strength is chosen at setup: `block-new` blocks introduced errors
and reports old debt, `block` blocks every error, `report` only reports policy
violations. Invalid input fails in all modes. Commit links are mandatory
independently of that choice. Project adapters parse messages and select commit
ranges; setup must prove those parts as well as the shipped checks.

The checks do not prove behavioural correctness, truthful test evidence,
semantic task relevance or that the right scope was chosen. Session sizing,
next-milestone decomposition and understandable titles are still instructions,
not executable checks.

## Skills

### User-invoked

- [setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md): install
  or fully reverify tracker, workflow and checks.
- [ask-shady2k](skills/backlog/ask-shady2k/SKILL.md): next useful action from actual state.
- [to-milestone](skills/backlog/to-milestone/SKILL.md): agree outcomes, scope and budget.
- [take-task](skills/engineering/take-task/SKILL.md): coordinate tracked work to stage acceptance.
- [handoff](skills/productivity/handoff/SKILL.md): transfer the current work and pending acceptance.

### Model-invoked

Also directly callable by the user. Availability does not authorize unrelated
changes, new scope or external publication.

- [brainstorming](skills/productivity/brainstorming/SKILL.md): decisions one at
  a time, at the owner's role; default product engineer.
- [to-spec](skills/engineering/to-spec/SKILL.md): short or full behavioural spec.
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

## Credits

The original shape and work-skill ideas come from
[mattpocock/skills](https://github.com/mattpocock/skills), MIT:
[license](docs/third-party/mattpocock-skills.LICENSE). They are rewritten here
around this set's tracker protocol.

## Development

```bash
npm test                  # backlog/commit fixtures, CLI and package invariants
npm run test:mutation     # deliberately break checks and observe failures
npm run protocol          # synchronize folder-local protocol copies
scripts/link-skills.sh    # link into local skill directories
```

[AGENTS.md](AGENTS.md) defines layout, invocation, portability and versioning.
