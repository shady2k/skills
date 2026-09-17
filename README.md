# shady2k-skills

My agent skills. Most of them keep a backlog an answer to "what do I work on
next", around a gate that binds; one hands a conversation to a fresh session.

Light skills oblige nothing: they can be invoked at any moment or never, and
when nobody invokes them no process is followed. Heavy process frameworks fix
that by owning the workflow. This set takes the third road: **the skills stay
light, and a gate is what binds.** The gate is a check over the backlog that
runs where the project's other gates run. It is installed per project, for
whatever tracker that project has, and proved on the spot against backlogs
known to be bad.

It works with any tracker, because no skill here knows one, and with any
engineering backlog, development or operations alike. The reasoning is in
[`docs/design.md`](docs/design.md).

## Installation

**Claude Code**, as a plugin from this repository's own marketplace:

```
/plugin marketplace add shady2k/skills
/plugin install shady2k-skills@shady2k
```

**Codex and other agents**, as editable files in your project:

```bash
npx skills@latest add shady2k/skills
```

Make sure `setup-shady2k-skills` is one of the skills you take.

Then run `/setup-shady2k-skills` once per project. It reads how the project
tracks work, asks about its label vocabulary, its current milestone and how hard
the gate should bind, writes the config, the tracker adapter and the wiring, and
proves all three before it says it is done.

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
```

`/ask-shady2k` reads the state and says which of these to run now.
`/groom-backlog` is the way in when the backlog already exists and has stopped
being a queue.

## Skills

### User-invoked

Reachable only when you type them.

- **[setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md)**:
  configure a project for the set by installing the backlog gate (config,
  tracker adapter, wiring) and proving all three. Once per project.
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

The agent reaches for these unprompted; you can type them too.

- **[to-backlog](skills/backlog/to-backlog/SKILL.md)**: an idea, a bug or a
  finding into the lane it belongs in. A finding beyond the milestone's budget
  goes to the owner, never silently to the front.
- **[close-out](skills/backlog/close-out/SKILL.md)**: close finished work with
  evidence a stranger can check, file what it found, release what is not held.

## Development

```bash
npm test                  # the gate's fixtures, and the guard over every skill
scripts/link-skills.sh    # symlink the skills into ~/.claude/skills and ~/.agents/skills
```
