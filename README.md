# shady2k-skills

Light process skills for agents, around a backlog gate that binds.

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

## Skills

### User-invoked

- **[setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md)**:
  configure a project for the set by installing the backlog gate and proving it.

### Planned

Named and designed, not written yet:

- `ask-shady2k`: reads the backlog's state and answers with the one command to
  run next.
- `to-milestone`: vision and business requirements into a milestone charter with
  a budget for findings.
- `to-backlog` (model-invoked): an idea, a bug or a finding into the lane it
  belongs in.
- `close-out` (model-invoked): close with evidence, re-parent what was found.
- `groom-backlog`: dig out a mess by amnesty rather than review.
- `to-stages`: one outcome into stages and tasks with assertion-shaped criteria.
  Last, and only if the gate alone turns out not to be enough.
