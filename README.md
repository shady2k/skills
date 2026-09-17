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

Named and designed, not written yet. In the order they will be written:

- `ask-shady2k`: reads the backlog's state (the gate's report, the current
  milestone, what is being held, the finding budget) and answers with the one
  command to run next, not a map of routes. Absorbs "what do I take".
- `groom-backlog`: dig out a mess by amnesty rather than review: declare the
  slice, attach live work, defer the rest with a review date. Must carry the
  rule that a bulk edit forges its own evidence, so ages are read from a
  revision before it.
- `to-milestone`: vision and business requirements into a milestone charter: in,
  out, and a budget for findings. The next milestone exists at feature level
  only.
- `to-backlog` (model-invoked): an idea, a bug or a finding into the lane it
  belongs in. Carries the three checks a script cannot make: search the
  behaviour, not your name for it; write a criterion that stops being false
  exactly once; state what is deliberately out. A finding beyond the milestone's
  budget never goes silently to the front.
- `close-out` (model-invoked): close with evidence a stranger can check,
  re-parent what was found. What counts as evidence is the project's config.
- `to-stages`: one outcome into stages and tasks with assertion-shaped criteria.
  Last, and only if the gate alone turns out not to be enough.
