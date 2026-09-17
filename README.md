# shady2k-skills

My agent skills. Seven of them keep a backlog an answer to "what do I work on
next"; one hands a conversation to a fresh session. They work in any harness
that reads `SKILL.md` files, with any issue tracker, and for any engineering
backlog, development or operations alike.

## Why

Light skills oblige nothing: they can be invoked at any moment or never, and
when nobody invokes them no process is followed. Heavy process frameworks fix
that by owning the workflow. This set takes the third road: **the skills stay
light, and a gate is what binds.**

The gate is one script that reads the backlog and fails, in the project's own
pre-commit hook and CI. An agent may forget to call a skill; it cannot commit
an issue that belongs to no milestone. The rules are the same everywhere and
ship here. What knows your project (a config of your labels, an adapter for
your tracker, the hook wiring) is written into your project by the installer,
and proved on the spot against backlogs known to be bad.

The reasoning, and the case that bought each rule, is in
[`docs/design.md`](docs/design.md).

## Installation

**Claude Code**, as a plugin from this repository's own marketplace:

```
/plugin marketplace add shady2k/skills
/plugin install shady2k-skills@shady2k
```

To update later (a third-party marketplace does not update by itself):

```
/plugin marketplace update shady2k
/plugin update shady2k-skills@shady2k
```

**Codex and other agents**, as editable files in your project:

```bash
npx skills@latest add shady2k/skills
```

Make sure `setup-shady2k-skills` is one of the skills you take.

Then run **`/setup-shady2k-skills`** once per project. It reads how the project
tracks work; asks about the label vocabulary, the current milestone and how
hard the gate should bind; writes the config, the tracker adapter, the wiring
and `docs/agents/backlog.md`, the one file every other skill reads; and proves
all of it before it says it is done. The gate needs Node and nothing else. After
a plugin update, run it again to refresh the project's copy of the rules.

## The flow

```
/setup-shady2k-skills    once per project: the gate, and docs/agents/backlog.md
        |
/to-milestone            a charter: outcomes in, what is out, a finding budget
        |
/to-stages               one outcome -> stages -> one-session tasks
        |
   take work  ->  /close-out          evidence, release, walk up
        ^              |
        +-- /to-backlog               whatever arrives, into its lane

/ask-shady2k             reads the state, answers with the one command to run now
/groom-backlog           the way in when a backlog exists and is no longer a queue
/handoff                 stopping, or the conversation got too long: a fresh session
```

## What the gate enforces

Every rule has a fixture that violates it, and the self-test fails if a rule
stops catching its fixture.

| rule                     | what it refuses                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `off-milestone-open`     | anything live whose root does not belong to the current milestone: the **horizon**, and no orphans |
| `finding-budget`         | bugs and debt found mid-milestone beyond the number its charter allows                            |
| `idea-in-queue`          | an idea that is not deferred                                                                      |
| `idea-blocks-work`       | live work blocked by an idea                                                                      |
| `blocked-by-deferred`    | live work blocked by something deferred, which blocks for ever and silently                       |
| `stale-hold`             | an issue marked active that nobody holds, or whose tree has not moved in days                     |
| `epic-without-criterion` | a feature or a stage with no DONE WHEN, or with the heading and nothing under it                  |
| `area-label`             | none, or more than one, area label                                                                |
| `label-vocabulary`       | a label outside the declared vocabulary                                                           |
| `parent-cycle`           | a cycle in the parent chain                                                                       |
| `stale-edge` (warning)   | a blocker nobody has touched in weeks, or that does not exist                                     |

How hard it binds is asked at installation and never defaulted: `block-new`
fails only what a change introduced and prints the old debt every time, `block`
fails on any error, `report` fails nothing and still prints.

## Skills

### User-invoked

Reachable only when you type them.

- **[setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md)**:
  configure a project for the set by installing the backlog gate (config,
  tracker adapter, wiring) and proving all three. Once per project, and again
  after a plugin update.
- **[ask-shady2k](skills/backlog/ask-shady2k/SKILL.md)**: reads the backlog's
  state and answers with the one command to run next, not a map of routes.
- **[to-milestone](skills/backlog/to-milestone/SKILL.md)**: the vision and the
  business requirements into a milestone charter: outcomes, what is out, a
  budget for findings.
- **[to-stages](skills/backlog/to-stages/SKILL.md)**: one outcome of the current
  milestone into stages and one-session tasks with assertion-shaped criteria.
- **[groom-backlog](skills/backlog/groom-backlog/SKILL.md)**: dig out a mess by
  amnesty rather than review: declare the slice, defer the rest, reversibly.
- **[handoff](skills/productivity/handoff/SKILL.md)**: hand the conversation to a
  fresh session without committing anything: a document outside the repository,
  a note where the work lives, the first sentence for the next agent.

### Model-invoked

The agent reaches for these unprompted; you can type them too. Unprompted means
when the model judges the moment has come, which is advice, not a guarantee.
The guarantee is the gate.

- **[to-backlog](skills/backlog/to-backlog/SKILL.md)**: an idea, a bug or a
  finding into the lane it belongs in. A finding beyond the milestone's budget
  goes to the owner, never silently to the front.
- **[close-out](skills/backlog/close-out/SKILL.md)**: close finished work with
  evidence a stranger can check, file what it found, release what is not held.

## Status

Young. The installer has been run once, in the project the rules came from;
the other skills have been reviewed twice by readers who did not write them and
not yet run in anger. Designed and not built: harness hooks that name the
current milestone at session start and release holds at its end. Three rules
are still only advice: the next milestone is decomposed no further than
features, no blocking edge sits on a feature or a stage, a title is a sentence.

## Development

```bash
npm test                  # the gate's fixtures and command line, and the guard over every skill
scripts/link-skills.sh    # symlink the skills into ~/.claude/skills and ~/.agents/skills
```

[`AGENTS.md`](AGENTS.md) holds this repository's rules: layout, names,
invocation, and that no skill may name a project or a tracker.
