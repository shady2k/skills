# AGENTS.md

The owner's own set of agent skills, **shady2k-skills**. Its reference for shape
is [mattpocock/skills](https://github.com/mattpocock/skills); its reason for
existing is [`docs/design.md`](docs/design.md). Read that before adding a skill.

## Layout

Skills live in bucket folders under `skills/` (`backlog/` keeps the queue,
`engineering/` carries the work, `productivity/` is the work around the work), one
folder per skill: `skills/<bucket>/<skill-name>/SKILL.md`, with its Codex
metadata beside it in `agents/openai.yaml`. Every skill has an entry in the top-level
`README.md`, in its bucket's `README.md`, and in the `skills` array of
`.claude-plugin/plugin.json`. Both READMEs group entries into **User-invoked**
and **Model-invoked**. Run `claude plugin validate . --strict` and the same on
`.claude-plugin/plugin.json` after touching a manifest.

Codex uses `.codex-plugin/plugin.json`, with `skills: "./skills/"`, and the same
`.claude-plugin/marketplace.json` catalog. All bucket folders under `skills/`
are shipped. Do not add a portable root `plugin.json` without rechecking nested
discovery: Codex 0.154.0 installs it but discovers no skills in this layout.
Run `npm run test:codex` (Linux, bubblewrap and Codex CLI) after changing packaging;
it installs and updates an isolated Git marketplace without network or personal
configuration changes. See `docs/codex.md`.

**Bump the version** in both plugin manifests, `package.json`, both checks'
`RULES_VERSION` and the source protocol (then `npm run protocol`) in every commit that
changes what a skill does. An installed plugin updates by version, so a change
pushed under the old number reaches nobody.

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
The planning helpers (`to-spec`, `to-stages`, `to-prototype`, `to-research`) and
`groom-backlog` are model-invoked so an authorized `take-task` or setup can
compose them. That permits the workflow, not unrelated changes or new authority.
Use the harness's available skill mechanism, not an assumed tool name. If a
required helper was not installed, report that dependency rather than pretending
to have run it.

## A skill knows no project and no tracker

Nothing under `skills/` may name a project or a tracker. A project's vocabulary
lives in that project's config; its tracker is reached through that project's
adapter and its own tracker doc. The rules were bought in one repository with
one tracker, so those are the words most likely to leak, and they are listed in
`test/origin-words.json`:

```bash
npm test
```

It runs two things. The gate's self-test: every rule's fixture fires exactly
the checks it declares (and, where it lists them, exactly those violations),
clean backlogs fire nothing, the three strengths give their verdicts, and the
command line exits 2 on every kind of misuse. Then `test/repo.mjs`, over every
skill: no file contains a listed word, the plugin manifest lists exactly the
skills that exist, each is user-invoked in both harnesses or in neither, and
every copy of the protocol is word for word its source.

Add a rule, add its fixture in the same commit, **and break the rule once to
see the fixture catch it**: a fixture that passes whether or not its rule works
is how a gate certifies instead of checking.

## A skill depends on what it was given, not on a file

Three kinds of knowledge, three owners:

- **The protocol** (levels, lanes, the horizon, names over identifiers, what a
  clean gate is) is the set's. Its single source is
  `skills/backlog/setup-shady2k-skills/protocol.md`; every skill that uses it
  links to a copy **in its own folder**, because a harness may install one
  folder at a time. `npm run protocol` writes the copies and `npm test` fails
  on one that drifted. A skill uses its words and does not restate it.
- **The backlog integration** (the gate's command and files, how the tracker
  is driven, where the vision and charters are) is the project's. The installer
  writes it as a section of the project's own tracker doc, from the seed
  `integration.md`, and points the project's agent doc at it. How a tracker is
  driven is said once, by whoever owns that tracker's doc or skill; the section
  adds only what the protocol needs on top.
- **Values that change** (the current milestone, the budget, the vocabulary)
  are the gate config's and are copied nowhere.

A skill that **writes to the tracker** depends on the integration hard: the
backlog skills, `to-spec`, `take-task`. Each opens with the same sentence: the
backlog integration should have been provided, and if not, tell the user to
run the installer. It names no path, and the skill links its own copy of the
protocol. A skill that merely does better with one (`handoff`, `diagnose-bug`,
`to-prototype`) says "where the project has a backlog integration" at the one
step that uses it, and carries neither the sentence nor the protocol. The rest
(`brainstorming`, `to-research`, `model-domain`) work in an empty directory.
Research and discussion can be read-only without setup; retained repository
changes and commits still require a task. Setup provides a verified bootstrap
context to `groom-backlog` before installing the gate; this is the explicit
exception to its usual integration prerequisite.

**Whether the set is installed is asked of the gate**, which either runs in
this checkout or does not; a file's presence proved nothing the one time it was
relied on.

## The router lies when it is stale

Whenever a skill is added, renamed, removed or changes how it fits the flow,
update `ask-shady2k` in the same commit: its ladder and its list of routes.
