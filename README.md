# shady2k-skills

My agent skills. Seven keep a backlog an answer to "what do I work on next";
seven carry the work itself, from an idea talked through until nothing is assumed to
a task closed on evidence; one hands a conversation to a fresh session. They
work in any harness that reads `SKILL.md` files, with any issue tracker, and
for any engineering backlog, development or operations alike.

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
hard the gate should bind; writes the config, the tracker adapter and the
wiring; adds a "Backlog integration" section to the project's own tracker doc
and a pointer to it in the agent doc; and proves all of it, and lands it,
before it says it is done. The protocol itself is not copied into the project:
it ships inside each skill and updates with the set. The gate needs Node and nothing else. After
a plugin update, run it again to refresh the project's copy of the rules.

## The flow

```
/setup-shady2k-skills    once per project: the gate, and the backlog integration
        |
/to-milestone            a charter: outcomes in, what is out, a finding budget
        |
/to-spec                 one outcome: /brainstorming until nothing is assumed, then the spec
        |                   (a question talking cannot settle: /to-prototype)
/to-stages               the spec -> stages -> one-session tasks, vertical slices
        |                   (keep spec and stages in one conversation)
/take-task   ->  /close-out           red before green, reviewed against the spec;
        ^              |              evidence, release, walk up. One task per conversation
        +-- /to-backlog               a bug, an idea, a request: into its lane

/ask-shady2k             reads the state, answers with the one command to run now
/groom-backlog           the way in when a backlog exists and is no longer a queue
/diagnose-bug            something is broken and a glance did not find why
/to-research             reading that needs doing, done in the background
/model-domain            a word doing two jobs; a decision whose reason will be lost
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
- **[to-spec](skills/engineering/to-spec/SKILL.md)**: the spec of one outcome:
  the problem and the solution as their observer sees them, the decisions, the
  seams it will be checked at, what is out.
- **[to-stages](skills/backlog/to-stages/SKILL.md)**: one outcome of the current
  milestone, from its spec, into stages and one-session tasks: vertical slices
  with assertion-shaped criteria.
- **[take-task](skills/engineering/take-task/SKILL.md)**: one ready task from
  claim to close: watch its check fail, make it pass in thin slices, have it
  reviewed against the standards and the spec, close on evidence. What the spec
  does not settle goes back as an escalation, never as a guess.
- **[to-prototype](skills/engineering/to-prototype/SKILL.md)**: answer one design
  question with throwaway code: a state model to push through its hard cases,
  or several looks of one screen.
- **[to-research](skills/productivity/to-research/SKILL.md)**: a background agent
  reads the primary sources and leaves a cited note.
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
- **[brainstorming](skills/productivity/brainstorming/SKILL.md)**: think a plan
  through one question at a time, each put at the height of the role it
  belongs to (product owner, analyst, architect, or the product engineer who
  is all three and does not read the code) with the positions one could take
  and what each sets in motion. Facts and cheap choices are the agent's,
  and it says which it made.
- **[diagnose-bug](skills/engineering/diagnose-bug/SKILL.md)**: for the bug that
  resists a first look: a command that goes red on it before any theory, then
  minimise, rank hypotheses, probe, fix behind a check.
- **[model-domain](skills/engineering/model-domain/SKILL.md)**: the glossary and
  the decision records, changed the moment a term or a decision is settled.

## Status

Young. The installer has been run twice, and each run changed it; the backlog
skills have been reviewed twice by readers who did not write them. The seven
work skills are new in 0.6 and have not been run in anger at all. Designed and not built: harness hooks that name the
current milestone at session start and release holds at its end. Three rules
are still only advice: the next milestone is decomposed no further than
features, no blocking edge sits on a feature or a stage, a title is a sentence.

## Credits

The shape of the set, and the ideas behind the work skills (the design-tree
interview, the spec, vertical slices, red before green, the two-axis review,
the diagnosis loop, prototypes, the glossary and decision records) come from
[mattpocock/skills](https://github.com/mattpocock/skills), MIT:
[`docs/third-party/mattpocock-skills.LICENSE`](docs/third-party/mattpocock-skills.LICENSE).
They are rewritten here, not copied, so they can stand on this set's protocol
and move with it.

## Development

```bash
npm test                  # the gate's fixtures and command line, and the guard over every skill
scripts/link-skills.sh    # symlink the skills into ~/.claude/skills and ~/.agents/skills
```

[`AGENTS.md`](AGENTS.md) holds this repository's rules: layout, names,
invocation, and that no skill may name a project or a tracker.
