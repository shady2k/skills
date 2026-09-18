# Engineering

Skills for the work itself: from a settled idea to a closed task. The ideas
come from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT),
rewritten here to stand on this set's protocol: the horizon, DONE WHEN, lanes
for what is found on the way, closing on evidence.

## User-invoked

Reachable only when you type them (Claude Code: `disable-model-invocation: true`;
Codex: `policy.allow_implicit_invocation: false` in `agents/openai.yaml`).

- **[to-spec](./to-spec/SKILL.md)**: the spec of one outcome of the current
  milestone: problem, solution, decisions, where it is checked, what is out.
- **[take-task](./take-task/SKILL.md)**: one ready task from claim to close: red
  before green, thin slices, reviewed against the spec.
- **[to-prototype](./to-prototype/SKILL.md)**: answer one design question with
  throwaway code.

## Model-invoked

Model- or user-reachable.

- **[diagnose-bug](./diagnose-bug/SKILL.md)**: the cause of a bug that resists a
  first look: a command that goes red on it, before any theory.
- **[model-domain](./model-domain/SKILL.md)**: keep the glossary and the
  decision records.
