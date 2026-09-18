# Productivity

Skills for the work around the work.

## User-invoked

Reachable only when you type them (Claude Code: `disable-model-invocation: true`;
Codex: `policy.allow_implicit_invocation: false` in `agents/openai.yaml`).

- **[handoff](./handoff/SKILL.md)**: hand the current conversation to a fresh
  session without committing anything: a document outside the repository, a note
  where the work lives, and the first sentence for the next agent.
- **[to-research](./to-research/SKILL.md)**: a background agent reads the primary
  sources and leaves a cited note, while the conversation carries on.

## Model-invoked

Model- or user-reachable.

- **[brainstorming](./brainstorming/SKILL.md)**: think a plan through one question
  at a time, by role, each with its positions and what they cost. The other
  skills call it to settle their questions.
