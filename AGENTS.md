# AGENTS.md

The owner's own set of agent skills, **shady2k-skills**. Its reference for shape
is [mattpocock/skills](https://github.com/mattpocock/skills); its reason for
existing is [`docs/design.md`](docs/design.md). Read that before adding a skill.

## Layout

Skills live in bucket folders under `skills/` (`backlog/`, `productivity/`), one folder per skill:
`skills/<bucket>/<skill-name>/SKILL.md`. Every skill has an entry in the top-level
`README.md`, in its bucket's `README.md`, and in the `skills` array of
`.claude-plugin/plugin.json`. Both READMEs group entries into **User-invoked**
and **Model-invoked**. Run `claude plugin validate . --strict` after touching a
manifest.

## Names

A name says the action (`groom-backlog`, `close-out`) or names the result
(`to-milestone`). The installer is `setup-shady2k-skills` and the router is
`ask-shady2k`. No bare generic words (`setup`, `spec`, `next`): they collide with
everything, and a harness may have no namespaces.

## Invocation

A skill is **user-invoked** unless an agent must reach it unprompted. User-invoked
means `disable-model-invocation: true` in the frontmatter, a one-line human-facing
description, and `policy.allow_implicit_invocation: false` in the skill's
`agents/openai.yaml`; keep the two in step. Model-invoked skills carry a
model-facing description with their triggers. A user-invoked skill can never be
called by another skill: where one is a precondition, tell the user to run it.

## A skill knows no project and no tracker

Nothing under `skills/` may name a project or a tracker. A project's vocabulary
lives in that project's config; its tracker is reached through that project's
adapter and its own tracker doc. The rules were bought in one repository with
one tracker, so those are the words most likely to leak, and they are listed in
`test/origin-words.json`:

```bash
npm test
```

It runs the gate's self-test: every rule's fixture fires exactly the checks it
declares, clean backlogs fire nothing, the three strengths give their verdicts,
and no file of the skill contains a listed word. Add a rule, add its fixture in
the same commit.

## Every skill reads one file

`setup-shady2k-skills` writes `docs/agents/backlog.md` into the project from its
seed, and every other skill opens with the same sentence: that file should have
been provided, and if not, tell the user to run the installer. The protocol
(levels, lanes, the horizon, names over identifiers) has its single source of
truth in that seed; a skill uses its words and does not restate it.

## The router lies when it is stale

Whenever a skill is added, renamed, removed or changes how it fits the flow,
update `ask-shady2k` in the same commit: its ladder and its list of routes.
