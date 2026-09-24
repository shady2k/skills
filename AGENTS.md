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
`.claude-plugin/plugin.json`. Both READMEs group entries into **started on the
user's request** and **started when the work calls for it**. Run `claude plugin validate . --strict` and the same on
`.claude-plugin/plugin.json` after touching a manifest.

Codex uses `.codex-plugin/plugin.json`, with `skills: "./skills/"`, and the same
`.claude-plugin/marketplace.json` catalog. All bucket folders under `skills/`
are shipped. Do not add a portable root `plugin.json` without rechecking nested
discovery: Codex 0.154.0 installs it but discovers no skills in this layout.
Run `npm run test:codex` (Linux, bubblewrap and Codex CLI) before every push, not only after
changing packaging;
it installs and updates an isolated Git marketplace without network or personal
configuration changes. See `docs/codex.md`.

**Two versions.** The **plugin version** (both plugin manifests and `package.json`)
goes up in every commit that changes what a skill does: an installed plugin
updates by version, so a change pushed under the old number reaches nobody.
Bump with `npm run bump -- <plugin-version> [--setup <setup-version>]`, never by
hand or a text replacement: it fails when a number would not rise, which a
silent replacement does not (0.21.0 to 0.22.5 all shipped as 0.20.2 that way).
The **setup version** (the source protocol's `Setup version` line and all three
checks' `RULES_VERSION`, then `npm run protocol` and `npm run setup-lock`) goes
up only when projects must redo their installation: changed check rules, a new
config setting, a new adapter duty or proof. Every setup version bump makes
every project stop and rerun setup, so a change to wording, reasoning or
dialogue never bumps it. `npm test` fails when a file setup installs changed
under the same setup version; decide the rest by that question.

## Names

A name says the action (`groom-backlog`, `close-out`) or names the result
(`to-milestone`). The installer is `setup-shady2k-skills` and the router is
`ask-shady2k`. No bare generic words (`setup`, `spec`, `next`): they collide with
everything, and a harness may have no namespaces.

## Invocation

Every skill can be started by the agent, because a user asks in words as often
as by command: "yes, do it" must be enough, never "run this command and say
this phrase". What differs is **who may start it**. Skills that change scope,
run work, install, hand over or publish (`ask-shady2k`, setup, `to-milestone`,
`take-task`, `handoff`, `report-to-shady2k`) start **only on the user's request
or agreement**, and their descriptions say so; the others start when the work
calls for them. Descriptions are model-facing with their triggers;
`disable-model-invocation` is not used, and `policy.allow_implicit_invocation`
in `agents/openai.yaml` stays `true` in step with it. When a skill recommends
another and the user agrees, start it; do not send them to type it.
The planning helpers (`to-spec`, `to-stages`, `to-prototype`, `to-research`) and
`groom-backlog` are model-invoked so an authorized `take-task` or setup can
compose them. That permits the workflow, not unrelated changes or new authority.
Use the harness's available skill mechanism, not an assumed tool name. If a
required helper was not installed, report that dependency rather than pretending
to have run it.

## User decisions: role-aware recommendations, not a questionnaire

Apply the role model across the whole set, including setup, configuration,
planning and acceptance: the protocol's **Speaking to the owner**
([`speaking.md`](skills/backlog/setup-shady2k-skills/references/speaking.md)) holds it, with the default role of
**product engineer**, and `brainstorming` holds its table of what each role is
told. Ask about the role only if the ambiguity materially changes who should
decide. The bullets below are how that model shapes setup and configuration.

- **Investigate before asking.** Read the project, current configuration and
  relevant prior decisions. Preserve valid choices; do not ask the user to
  rediscover facts the agent can inspect. A recommendation must not silently
  widen an agreed scope, add budget or replace an established workflow.
- **Propose a coherent profile, not one question per setting.** For setup or
  a configuration review, show a compact list or table of recommended values
  together. Distinguish retained values, proposed changes and genuinely unknown
  choices. Let the user accept the profile or change only named entries; do
  not require an answer for every row or another round for each unchanged value.
- **Explain each meaningful setting at the user's level.** Say what it controls,
  why it exists, which value is recommended and why, and the practical
  consequences of accepting or changing it: behaviour, time, cost, risk and
  reversibility. Define unfamiliar terms before using them. Prefer plain-language
  labels; config keys and implementation details are secondary, not the question
  the user must answer.
- **Own routine implementation choices.** Do not ask the user to select a file,
  library, internal command or cheap-to-reverse detail without a consequence at
  their level. Choose it from evidence and briefly disclose the choice. If they
  say "use recommended values", apply that to the remaining routine settings
  instead of asking for each one again; disclose what was selected.
- **Ask only about material unresolved decisions.** A missing requirement,
  conflicting prior choices or a consequential scope, cost, safety or irreversible
  trade-off may need the user. Explain why it needs a decision now, recommend an
  option and give real alternatives with their consequences. Ask one such question
  at a time; this is not a reason to turn every configuration field into an interview.
  The one exception is a feature run's preflight: before the owner leaves, every
  decision the run will need comes as one batch with recommendations, because
  asking later means stopping the run.
- **Keep consent meaningful and bounded.** Confirm consequential new choices
  together with the proposed profile where possible. Do not treat silence or a
  preselected value as approval, repeat an approval already given, or infer that
  "use defaults" authorizes destructive cleanup, publication or expanded scope.
- **Stop when the next step is decided.** Defer unrelated future choices. Close
  with what was retained, what the user changed, what the agent chose and any
  genuinely blocking unknowns; do not reopen settled decisions without new evidence.

What the person reads, and how a decision is put to them, follow
[`speaking.md`](skills/backlog/setup-shady2k-skills/references/speaking.md) (**Summarize; never assign reading**, **One
thing, one name**, never showing the set's own internals) and
[`deciding.md`](skills/backlog/setup-shady2k-skills/references/deciding.md) (**A design decision comes with its
mechanism**). When creating or revising a skill, check its dialogue against
these rules. A sequence
of technical yes/no questions is not role-aware guidance even if each question
contains a recommended number. Neither is a paraphrase that renames the
project's own parts: it is unreadable exactly because every word in it is easy.

## Language

What the user is told and what a project keeps follow the protocol's
**Language** ([`speaking.md`](skills/backlog/setup-shady2k-skills/references/speaking.md)): the user's language in
conversation, the project's recorded artifact language in everything kept. The
skills themselves, and reports to this repository, are written in English.

## Dialogue is not a requirements interview

Be a thinking partner: contribute ideas, examples, counterexamples and useful
perspectives, not only questions. Infer exploration, investigation or decision
intent from the conversation without a mandatory mode menu. Open-ended thought
may end with no decision, document or task. Do not promote hypotheses to approved
requirements or automatically move from discussion to implementation. Role
changes language and depth, not the viewpoints the conversation may explore.

Do not agree reflexively or contradict for sport. Distinguish facts, assumptions
and preferences; understand the user's reasoning, evidence, goals and constraints
from context before judging. Ask only for material missing context, then give an
independent assessment with evidence, uncertainty and what would change your
mind. Correct an obvious factual error directly without a motives interview.
Understanding the reasoning does not oblige agreement with its conclusion.

Questions are useful when they move thought forward, not to fill a template.
Not every turn needs a question or a recommendation. Decision-mode summaries
and configuration profiles must not become obligations in free exploration.

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

- **The protocol** is the set's. Its single source is
  `skills/backlog/setup-shady2k-skills/`: `protocol.md` is the core (setup
  version, compatibility, levels, lanes, the horizon, what a clean gate is),
  and `references/` holds the rest by topic (speaking to the owner, deciding,
  running alone, checks, building). A skill links what it uses, and every linked file,
  with whatever it links in turn, is copied **into the skill's own folder**,
  because a harness may install one folder at a time. `npm run protocol`
  writes and prunes the copies; `npm test` fails on one that drifted, and on a
  rule a skill cites that no file it carries holds. A skill cites a rule by its
  name and does not restate it: what stays in `SKILL.md` is only what is the
  skill's own (its step, its timing, its trigger). A skill that must work
  without setup links the references it needs and never `protocol.md`, which
  carries the compatibility check.
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
step that uses it, and carries neither the sentence nor the core protocol. The rest
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

## This repository's tracker

Problems and ideas for the set are kept in beads_rust (`br`, prefix `skills`),
in `.beads/`; `.beads/issues.jsonl` is committed. A problem met in real use is
filed first, with what happened and in which situation, and fixed after; the
fixing commit names the issue, so symptom and fix stay linked.
