# shady2k-skills

**English** · [Русский](README.ru.md)

Sixteen skills for exploring ideas and taking tracked work to accepted results. They work
with a project's chosen tracker and any harness that reads `SKILL.md`.
The reasoning and history are in [docs/design.md](docs/design.md).

Skills guide dialogue and decisions; portable checks enforce the backlog's shape,
commit links and document lifecycle. The project owns its adapters and wiring, proved during setup.
A green backlog is not evidence that the code works.

## Contents

- [Why it exists](#why-it-exists)
  - [Start with `ask-shady2k`, almost every time](#start-with-ask-shady2k-almost-every-time)
- [How your work changes](#how-your-work-changes)
  - [The path of work, end to end](#the-path-of-work-end-to-end)
  - [What reaches you, and what does not](#what-reaches-you-and-what-does-not)
  - [Bugs, ideas and interruptions](#bugs-ideas-and-interruptions)
  - [What you no longer do](#what-you-no-longer-do)
  - [How a day with it looks](#how-a-day-with-it-looks)
- [Skills](#skills)
  - [Started on your request](#started-on-your-request)
  - [Started when the work calls for it](#started-when-the-work-calls-for-it)
- [Installation and updates](#installation-and-updates)
  - [Claude Code](#claude-code)
  - [Codex](#codex)
  - [Other agents / standalone skills](#other-agents--standalone-skills)
  - [Joining a repository that already uses the set](#joining-a-repository-that-already-uses-the-set)
  - [What setup takes](#what-setup-takes)
  - [What setup verifies](#what-setup-verifies)
- [How the flow works inside](#how-the-flow-works-inside)
- [What the checks enforce](#what-the-checks-enforce)
- [Documents: direction, current state and changes](#documents-direction-current-state-and-changes)
- [Changelog](#changelog)
- [Credits](#credits)
- [Development](#development)

## Why it exists

The set grew out of the owner's own project, built through agents, and the
problems it had there.

- **Light skills oblige nothing.** A skill can be invoked at any moment or
  never, and when nobody invokes it no process is followed. Heavier frameworks
  did not fix that; they only made each step more expensive.
- **The tracker became a dump.** Most open issues were marked ready, and most
  of those "in progress" had not been touched for days. A status that is false
  almost every time is not a status, and a queue where nearly everything is
  ready cannot tell anyone what to do next.
- **Work planned too far ahead went stale.** Many epics were created in advance
  and lost their point before their turn came. Epics did not fit a session and
  ran for days.
- **Findings jumped the queue.** Bugs and architectural gaps found mid-feature
  were put at the front and pushed the feature out by weeks.
- **Names, not identifiers.** A person does not remember issue numbers; agents
  kept talking as if they did.
- **Losing the thread.** After a break, or in an unfamiliar project, nobody
  could say at a glance what the product already does, how far the milestone has
  come, what is stuck and what the sensible next step is. The tracker holds the
  facts but not that picture.

So the set keeps the skills light and puts the obligations in checks: a gate
that fails on a broken backlog, commits that must name their task, documents
that must be ready before work starts. The details and the history of each
decision are in [docs/design.md](docs/design.md).

### Start with `ask-shady2k`, almost every time

`ask-shady2k` answers the question behind the last problem: where are we, and
what now? It reads the project, the tracker when there is one and the git
history, then gives the product's picture, progress, the current state, risks
and the ways forward with their consequences, and recommends one action by
name. It is read-only, so running it costs nothing but a moment and never
changes anything.

Run it at the start of a session, after a break, after a stage is accepted,
when you open a project you have not seen in a while, and whenever you are not
sure what comes next. Ask "what next?" for a short answer, or "where are we?"
for the full picture. Skip it only when you already know the exact task
(`take-task`) or just want to think something through (`brainstorming`).

## How your work changes

You stop driving the agent step by step and start working as the owner of a
product that agents build: you decide what to build and whether the result is
right; they plan with you, build without you, and report in plain words. The
repository, not the chat, holds everything agreed, so any session can pick the
work up.

### The path of work, end to end

| step | what you do | what the agents do | skills | how much of you |
| --- | --- | --- | --- | --- |
| **Start from nothing** (an empty folder) | pick where to look, choose the idea, tell the key journeys of your users | generate and challenge ideas, check the market and the domain; nothing is written yet | `brainstorming`, `to-research`, `to-prototype` | a few conversations |
| **Keep it** | agree to create the repository and the tracker | create them, connect the checks, write down the vision | `setup-shady2k-skills` | once, under an hour for an empty project |
| **Or join an existing project** | agree what is current, what waits and what was abandoned | read the code, the tracker and the history; clean up the queue reversibly | `setup-shady2k-skills`, `groom-backlog` | once, from half an hour to a few sessions for a neglected backlog |
| **Agree the next version** (the first one is the MVP) | accept or change the outcomes, what is out, and how many new bugs it may absorb; cut the MVP | propose the charter from the vision and what is done | `to-milestone` | one conversation per version |
| **Decide the architecture** | choose between options shown with their consequences | show the parts, the options and what each costs; record the decisions | `brainstorming`, `model-domain` | when a hard-to-reverse choice comes up |
| **Plan a feature** | settle the behaviour and the open decisions; answer the preflight once | write the spec with checkable scenarios, split it into stages and tasks, collect every decision the run will need into one list with recommendations and a time estimate | `to-spec`, `to-stages`, `take-task` | an evening conversation |
| **The run** | nothing; you are away | build the whole feature on its own branch with parallel workers, tests first where agreed, independent review (by another model where one is available), fix every red check; stop only for a real fork (architecture, expensive mistakes, behaviour beyond the spec) and reach you with a ready decision | `take-task`, `diagnose-bug` | only if a fork comes up |
| **Acceptance** | try it the way the pull request says; merging is your acceptance | a green pull request: what users can now do, how to check it yourself, every decision taken without you, what review found, what is not done | `take-task` | the time it takes to try it |
| **Close** | nothing | update the current specs from the accepted work, close the tasks, remove branches and checkouts | `close-out` | none |

Between those: `ask-shady2k` tells you where the project stands and what to do
next whenever you come back; `handoff` keeps the thread when a session ends.

### What reaches you, and what does not

- **Decisions, already worked.** A question comes with what was looked at, the
  options with their cost, the agent's recommendation and the strongest case
  against it. Design choices come with the architecture they live in: the parts,
  who owns what, what happens when one fails.
- **Summaries, not documents.** You are never asked to read a spec to approve
  it: you get its substance, the decisions and assumptions, the risks and cost,
  in your language and your project's own names. The documents are for the
  agents and the record.
- **Estimates in agent time**, measured from this project's history, with what
  they rest on, and a word when work outgrows them.
- **Not the kitchen:** no task ids without titles, no internal statuses, no
  progress chatter while a run is healthy.

### Bugs, ideas and interruptions

A bug you mention is filed at once in the right place and does not jump the
queue: the current version has a budget for new bugs, and anything beyond it
waits for your decision, never for the agent's. A bug found mid-run that blocks
the merge is fixed by the run itself. An idea you want kept goes to a separate
lane with a review date, not into the work; one only discussed stays in the
conversation. If you start talking while a run is going, the
run does not stop: your conversation happens in a separate session, and what it
decides is written where the run will read it.

### What you no longer do

You do not create branches or name them, merge a pull request for every change
of plan, re-explain the context to a new session, remember issue numbers, chase
a stuck agent, or keep a document in step with the code by hand. Checks, not
good intentions, keep the tracker honest: a commit without its task or a change
that breaks the backlog is rejected before it lands, and once the document
check is installed, so is a feature whose spec is not ready.

### How a day with it looks

**In the evening, planning.** Open the agent in the project's main folder and
just talk: "what next?" or "I have an idea". Talking changes nothing; if it
leads nowhere, close the session and nothing is left behind. When something is
worth keeping, the agent moves into a separate working copy by itself, so your
main branch stays clean. You shape the idea, the spec and the stages together.
Before you leave, the agent brings every decision the work will need as one
list with recommendations, and says roughly how long the run will take and
when to expect the pull request. You answer, say "run", and go.

**While you are away.** The agent builds the whole feature on its own branch.
Small gaps it decides itself and writes down; a real fork stops that part of
the work and reaches you with a ready decision to make.

**The next day, acceptance.** A green pull request says what was built, how to
try it yourself and what the agent decided without you. You try it; merging is
your acceptance, and the agent closes the tasks and cleans up.

## Skills

Sixteen skills. You can start any of them by command or just by asking in
words; when the agent recommends one and you agree, it starts it itself. The
first group starts only on your request or agreement; the agent starts the
second group on its own when the work calls for it.
In Claude Code the plugin prefixes them: `/shady2k-skills:ask-shady2k`.

### Started on your request

| skill | what it does | when to use it |
| --- | --- | --- |
| [ask-shady2k](skills/backlog/ask-shady2k/SKILL.md) | Reads the project and tells you where it stands, how far it has come, what is stuck and which ways forward exist, with one recommendation; or, for the team's daily sync, what was done over a period, what got in the way, the questions for others and whether the work fits by a date. Changes nothing. | At the start of a session, after a break, in an unfamiliar project, whenever you are unsure what comes next, before a standup. |
| [setup-shady2k-skills](skills/backlog/setup-shady2k-skills/SKILL.md) | Connects the project's tracker, cleans its queue with you, proposes settings as one profile and proves the checks work. | Once per project, and again when a skill says the installation is out of date. |
| [to-milestone](skills/backlog/to-milestone/SKILL.md) | Agrees what the next version delivers, what is left out and how many new bugs it can absorb. | When the current version is done, or a project has no agreed next step. |
| [take-task](skills/engineering/take-task/SKILL.md) | Before you leave, gathers every decision a planned feature will need in one list; then builds the whole feature without you up to one pull request, deciding small gaps itself and stopping only for decisions that need you. | When a feature is planned and you want it built while you are away. |
| [handoff](skills/productivity/handoff/SKILL.md) | Keeps the work's state in the tracker and leaves what only this conversation knows where a fresh session will look. | Before you stop, or when a session gets too long. |
| [report-to-shady2k](skills/productivity/report-to-shady2k/SKILL.md) | Sends a problem or idea about these skills to their author as a GitHub issue, anonymized and shown to you word for word first. | When a skill confused you, did something wrong, or is missing something. |

### Started when the work calls for it

Available to you directly as well. The agent starting one does not authorize
unrelated changes, new scope or publishing anything.

| skill | what it does | when to use it |
| --- | --- | --- |
| [brainstorming](skills/productivity/brainstorming/SKILL.md) | Thinks an idea through with you: offers its own ideas and counterexamples, disagrees with reasons. Nothing has to come out of it. | "Let's discuss", "what if", an open product decision. |
| [to-research](skills/productivity/to-research/SKILL.md) | Answers a question from primary sources, with citations. | When a decision depends on facts nobody has checked. |
| [to-prototype](skills/engineering/to-prototype/SKILL.md) | Builds a small throwaway experiment that answers one design question. | When arguing takes longer than trying. |
| [to-spec](skills/engineering/to-spec/SKILL.md) | Writes down what exactly is being built, as the user will see it, with scenarios that will be checked. | Before building something whose behaviour is not yet agreed. |
| [to-stages](skills/backlog/to-stages/SKILL.md) | Splits a feature into stages, checkpoints that are each checked before the next builds on them, and tasks small enough for one agent. | When planning a feature before it runs. |
| [diagnose-bug](skills/engineering/diagnose-bug/SKILL.md) | Finds the cause of a bug with evidence: reproduces it, tests hypotheses one at a time. | When a bug did not yield to a quick look. |
| [model-domain](skills/engineering/model-domain/SKILL.md) | Keeps the glossary — domain terms and the names of the system's own parts — and records of hard-to-reverse decisions. | When words start meaning different things, when a part had to be explained instead of named, or when a decision needs its reason kept. |
| [to-backlog](skills/backlog/to-backlog/SKILL.md) | Files new work, bugs and ideas in the right place, without pushing them to the front. | When something new turns up in the middle of other work. |
| [close-out](skills/backlog/close-out/SKILL.md) | Updates the current specs from accepted work, then closes its tasks. | After you merge a feature's pull request. |
| [groom-backlog](skills/backlog/groom-backlog/SKILL.md) | Cleans up the queue reversibly with you: what is current, what waits, what was abandoned. | When the tracker has become a dump, and during setup. |

## Installation and updates

Choose your agent: [Claude Code](#claude-code) · [Codex](#codex) ·
[Other agents / standalone skills](#other-agents--standalone-skills).

If you use both Claude Code and Codex, install the plugin separately in each.
Within one agent, use either the plugin or standalone skill files (including
development symlinks), not both: otherwise the same skills appear twice.

### Claude Code

#### Install

First choose who gets the skills. Claude Code installs a plugin at one of three
scopes:

| scope | who gets it | where it is recorded | choose it when |
| --- | --- | --- | --- |
| **project** | this repository and all its worktrees, for whoever opens it | the project's shared settings, committed | the usual choice: you want the skills in this repository, including every worktree |
| **user** | you, in every repository | your own settings | you want the skills everywhere you work |
| **local** | you, in this one folder only | a settings file that is not committed | trying it in one folder first |

Install `project` **from the main checkout**, not from inside a worktree: then
every worktree of the repository loads it (Claude Code 2.1.200 or later). An
install made inside a worktree covers only that worktree, so each new one
starts without the skills or on an old version. Others who open the repository
see that it uses the plugin and install it once themselves. In a terminal, from
the main checkout:

```bash
claude plugin marketplace add shady2k/skills
claude plugin install shady2k-skills@shady2k --scope project   # or --scope user
```

Inside Claude Code, `/plugin marketplace add shady2k/skills` and then
`/plugin install shady2k-skills@shady2k` do the same and ask for the scope.

To replace installations made inside worktrees, install from the main checkout
as above, then remove each worktree's own. `claude plugin list` shows where each
one was made. In each such worktree, with the scope it was installed at:

```bash
claude plugin uninstall shady2k-skills@shady2k --scope local     # or --scope project
```

Two catches:

- **An installation in a worktree that no longer exists** stays in Claude Code's
  list. Recreate the empty folder, run the uninstall there, then delete the folder.
- **Uninstalling at `project` scope inside a worktree rewrites the repository's
  shared `.claude/settings.json` there.** Restore it afterwards with
  `git checkout -- .claude/settings.json`, so the repository keeps declaring the
  plugin for everyone.

Start a new Claude Code session in the target project, then run setup. Set
aside time for it: see [What setup takes](#what-setup-takes).

```text
/shady2k-skills:setup-shady2k-skills
```

Invoke other plugin skills the same way, for example
`/shady2k-skills:take-task`.

#### Update

Inside Claude Code:

```text
/plugin marketplace update shady2k
/plugin update shady2k-skills@shady2k
```

An update applies to the scope you installed at: once for `project` (from the
main checkout) or `user`, per folder for `local`. Restart running sessions after
installing or updating: a session sees the skills it started with.

Start a new session. If a skill then says the project's installation is out of
date, run `/shady2k-skills:setup-shady2k-skills` there; most updates need no setup.

### Codex

#### Install

Run these commands in your terminal (verified with Codex CLI `0.154.0`):

```bash
codex plugin marketplace add shady2k/skills
codex plugin add shady2k-skills@shady2k
```

Start a new Codex session in the target project, then run setup in the chat.
Set aside time for it: see [What setup takes](#what-setup-takes).

```text
$shady2k-skills:setup-shady2k-skills
```

Invoke other plugin skills the same way, for example
`$shady2k-skills:take-task`.

#### Update

In your terminal:

```bash
codex plugin marketplace upgrade shady2k
codex plugin add shady2k-skills@shady2k
```

Start a new session. If a skill then says the project's installation is out of
date, run `$shady2k-skills:setup-shady2k-skills` there; most updates need no setup.

See [Codex installation details](docs/codex.md) for local checkouts,
compatibility notes and isolated installation tests.

### Other agents / standalone skills

Use the universal installer if your agent reads `SKILL.md` files. This is also
an alternative to the plugin for Claude Code and Codex, not an extra step.

```bash
npx skills@latest add shady2k/skills
```

Select your agent and install the complete set, including the installer.
Run `setup-shady2k-skills` in your agent's skill syntax: standalone Claude Code
uses `/setup-shady2k-skills`; standalone Codex uses `$setup-shady2k-skills`.

To update:

```bash
npx skills update
```

Run setup again only when a skill says the installation is out of date.
Individually installed folders remain self-contained, but a
workflow that needs another skill must have that skill installed too.
When switching installation methods, inspect and remove only the previous
installation of this set; preserve any locally edited skill files.

### Joining a repository that already uses the set

If the repository works this way for the whole team, its agent doc says so and
gives the install line. In Claude Code the plugin's source is already known once
you trust the folder; install the plugin once, then run setup, which only
connects your clone (a few minutes). Without the plugin you can still commit:
the hooks tell you in plain words what a commit is missing.

### What setup takes

The first setup is not a five-minute step. It reads the project, connects or
chooses a tracker, goes through the existing queue with you, agrees the working
settings and then proves that every check really fires: it plants a violation,
watches the hook reject it and undoes it. The agent does the work, but it needs
you for the decisions: which work is current, what waits, what was abandoned,
which settings to change.

Setup shows its progress as six steps, telling you at each one where it is,
what comes next, whether it needs you, and a rough time estimate with its
reason:

1. **Look around**: reads the project and tracker. No input from you.
2. **Tidy the queue**: agrees with you what is current, waits or was
   abandoned. Needs you; the long step on a large backlog.
3. **Agree the settings**: first, whether the process is for you alone or for
   everyone in the repository; then one recommended profile to accept or adjust, and
   an explicit question about which language documents, tasks, commit messages
   and code comments are written in (English recommended). Needs you once.
4. **Connect the checks**: hooks, CI and the tracker adapter. No input from you.
5. **Prove it works**: makes the checks fire on planted problems. No input from you.
6. **Finish**: lands the installation; may ask your approval to merge it.

How long depends on the project. A new project with an empty tracker usually
fits into one session. An existing project with a large, neglected backlog can
take several: the cleanup is agreed with you step by step and is reversible,
and nothing is deleted in bulk. The document check is often its own stage
after setup; work does not wait for it.

A rerun after an update is shorter: earlier answers are kept, and only new
settings and the proofs are redone.

### What setup verifies

Every setup invocation rechecks the entire installation, including one whose
version matches. It selects and initializes a tracker if needed, snapshots and
cleans an existing queue with the owner, preserves valid prior choices, verifies
adapters and execution commands, proves local/CI hooks and lands the result.
New settings are presented as one recommended profile: what each controls, why
it is recommended and the consequences of changing it. Accept the profile or
change only named entries. Explanations match your role (product engineer by
default); only material unresolved decisions need separate questions. Existing
answers and delegated routine choices are not needlessly asked again.

The repository's installation is what landed: the checks, the shared settings
and the integration doc. Setup lands it with one merge and commits nothing after
it; a failed or unfinished attempt stays on its branch. Your plugin, hooks and
runtime are yours and never committed. Before changing anything, a skill
compares your plugin's setup version with the repository's: equal means work
on (connecting your clone first if needed, a few minutes); newer means the
repository's installation needs updating through setup; older means you update
your plugin. Most plugin updates change no setup version and need nothing. This is a first-use guard and an update
instruction, not a claim that every harness runs an automatic update hook.

## How the flow works inside

"Let's imagine" or "just discuss" starts `brainstorming`, not a setup interview.
The agent contributes ideas, explores other perspectives and tests assumptions.
It understands your reasoning before independently agreeing or disagreeing.
Discussion and read-only research may end without a decision, file or task.
Scratch experiments do not become production work automatically.

Setup establishes the tracker and a usable queue; a milestone charter sets the
current scope. `take-task` then selects the route from size, risk and unknowns:
a short behavioural delta for small work, or discussion, research/prototype,
specification and decomposition where needed. TDD is a separate project choice.

A stage has its own observable result and fits one session **including
acceptance**. Independent tasks, stages and features may execute in parallel.
Dependencies name required results or conflicts, never list order or hierarchy.

Workers run static checks and related tests, including affected neighbouring
behaviour. In TDD mode they work red → green → local refactor; in test-after
mode checks follow implementation. Workers preserve returned results as
**submitted**, with their revision/location and evidence. The coordinator integrates each result and
records it as **implemented**, making it available to dependants in the same
stage. It is not yet closed. Across stages, prerequisites wait for acceptance.

The assembled stage receives full checks, scoped mutation testing and final
review, preferably by another model. Corrections receive fresh verification.
`close-out` synchronizes the accepted change into current capability specs and
closes the tasks and stage only with evidence for the accepted revision. A
handoff preserves implemented work, unfinished acceptance and pending publication.

Every commit belongs to existing leaf tasks, including documentation,
research, prototypes and setup. The commit-message hook and CI enforce links;
the separate backlog gate enforces structure.

## What the checks enforce

| check | rejects |
| --- | --- |
| `off-milestone-open` | live work outside the current milestone |
| `finding-budget` | admitted findings beyond the explicit budget |
| `idea-in-queue`, `idea-blocks-work` | ideas offered as work or blocking it |
| `blocked-by-deferred` | live work waiting for deferred work |
| `stale-hold` | active work unheld or apparently abandoned |
| `epic-without-criterion` | a live feature/stage without a meaningful DONE WHEN marker |
| `area-label`, `label-vocabulary` | missing/multiple areas or unknown labels |
| `parent-cycle`, `dependency-cycle` | cycles in hierarchy or live prerequisites |
| `nonleaf-dependency` | blanket blocking edges involving containers |
| `implemented-without-evidence` | implemented work without recorded integration and local-check evidence |
| `submitted-without-evidence` | submitted work without a durable result and local-check evidence |
| `stale-edge` (warning) | absent or long-untouched prerequisites needing review |
| `check-commits.mjs` | unlinked commits or links to absent issues/containers |
| `check-docs.mjs` | unfinished required fields, missing scenarios/task links, conflicting or stale deltas, missing coverage, stale/missing receipts and unsynchronized current requirements |

The backlog strength is chosen at setup: `block-new` blocks introduced errors
and reports old debt, `block` blocks every error, `report` only reports policy
violations. Invalid input fails in all modes. Commit links are mandatory
independently of that choice. Project adapters parse messages and select commit
ranges; setup must prove those parts as well as the shipped checks. Document
readiness/acceptance checks are also mandatory independently of backlog strength.
They consume deterministic exports, a separately selected policy and verified
runner/approval receipts. The checker does not authenticate those inputs itself.

The checks do not prove behavioural correctness, truthful test evidence,
semantic task relevance or that the right scope was chosen. Session sizing,
next-milestone decomposition and understandable titles are still instructions,
not executable checks.

## Documents: direction, current state and changes

Everything lives in `docs/` beside the code, in Markdown, so a behaviour change
and its spec travel in one pull request. For a new repository, begin with the
vision, the first milestone and one useful change; the rest appears when needed:

```text
docs/vision.md                      # audience, problem, key journeys, success signal, exclusions
docs/roadmap.md                     # or a section of the vision
docs/glossary.md                    # domain terms and the names of the system's own parts
docs/milestones/<milestone>.md      # agreed scope; the first one is the MVP
docs/system/architecture.md         # arc42 sections as needed, C4 diagrams in Mermaid
docs/system/capabilities/<name>.md  # current behaviour by capability, requirements in EARS
docs/changes/<change>/change.md     # a feature's proposed requirement changes
docs/changes/<change>/design.md     # optional technical design
docs/decisions/NNNN-<slug>.md       # decision records (MADR)
docs/explorations/                  # optional retained research
```

Specs are kept by capability, not by feature: they always say what the system
does now, and a feature's changes are merged into them at acceptance. Diagrams
are Mermaid blocks, which GitHub, GitLab and Gitea render as they are; never
drawn with characters. Where a customer requires a ТЗ or a test programme by
Russian standards (ГОСТ 34.602-2020, ЕСПД), the agent drafts it from these
documents on request, asks for what they do not hold (the parties, dates,
financing), and leaves its formal approval to the contract; it is never a
second copy kept by hand.
The templates follow established practice: ISO/IEC/IEEE 29148, arc42 and C4,
MADR, EARS, OpenSpec.

These are defaults, not required paths. Setup maps existing documents in place,
including projects using Superpowers, Spec Kit or OpenSpec. It does not uninstall
them, move their files or create a rival task list. Choose one workflow owner and
one canonical source per artifact. An old plan is intent, not proof of current
behaviour. Baseline only the legacy capabilities being changed, then grow coverage
through accepted work. Independent changes do not acquire blanket dependencies.

The [document contract and templates](skills/backlog/setup-shady2k-skills/documents.md)
define four checkpoints: product intent, feature readiness, stage evidence and
current-spec synchronization. The project adapter parses its chosen document
format deterministically; there is no universal Markdown importer. Protected CI
can block merges; blocking direct tracker closure requires an actual transition
guard. A local hook or prose instruction is not a tamper-proof boundary.

## Changelog

- **0.59.0** keeps work that keeps the set itself working (its checks, hooks and the CI wiring that decides which checks a change owes) out of your milestone's finding budget: it belongs to the setup, as does a red check blocking the setup's own pull request, so you are no longer asked a budget question about it. The checks' messages also lose the counts left over from the cases that prompted them. Projects rerun setup once.
- **0.58.0** keeps each rule the skills follow as one general practice, named and written once, instead of a retelling of the case that prompted it: overlapping rules are merged, a skill points to the rule rather than repeating it, and nothing an agent did before is lost in the merge. It also stops a tracker kept inside the repository from carrying one branch's task states into another: setup now asks where the tracker lives when work runs on several branches at once, recommends keeping it outside the branches, and the checks read it from there. Projects rerun setup once.
- **0.57.3** puts one principle behind every conclusion that reaches you: it goes only as far as the evidence behind it, and one not yet checked comes to you as a guess with what would settle it, rather than as a fact.
- **0.57.2** stops a test the agent wrote from being reported as someone else's bug before it is checked against how your system really runs: until then it reaches you as a guess with the missing check named, nothing is proposed to file with another project on it, and a decision that rests on a single earlier measurement says so.
- **0.57.1** looks for your earlier answer before asking you anything: the whole feature's tasks, closed work, decision records and past sessions are searched first, a decision found is acted on and written down with where it came from, and a question that does reach you says where the search looked.
- **0.57.0** connects a fresh clone of your repository with one command instead of a list of manual steps, makes every local guard refuse a commit when it cannot find what it checks against, lets a task start as soon as the task it waits for is built within the same stage even where the tracker blocks it, and stops closing a task from invalidating check results that nothing in it touched. Projects rerun setup once.
- **0.56.0** gives every worker the bar the review will apply before it starts (no silent fallback on a missing input, stable output, tests that fail when the behaviour breaks, a mutation run on changed files), has workers commit only their own files, and keeps a charter from answering an open question of yours silently: each such answer is shown first and needs your yes.
- **0.55.0** stops the document check from demanding a signed record for merely filing a task: a commit owes a record for work it delivers, and an empty record written only to get past a check counts as going around it. Projects rerun setup once, so their check is proved on both sides.
- **0.54.0** gives, from `ask-shady2k`, a report for the team's daily sync over the period you name: what was done, what got in the way, the questions for others and whether the work fits by a date such as the sprint's end.
- **0.53.0** says how the product's code is shaped: one way in per capability, outside dependencies behind interfaces the logic owns, screens built from shared components and tokens, tests that survive a refactoring, and log records that name their module and trace.
- **0.52.1** brings each design decision with a worked example of what it decides, one per decision when several come together; a report about the skills keeps your product's design out of it.
- **0.52.0** makes a started agent session answer to the one that started it: its report lands whole in a known place, it counts as finished only once stopped, it can be resumed, and its starter ends it.
- **0.51.1** makes the time ledger report only measured facts: every session adds up to its clock, what a record lacks is unknown rather than zero, and one run's sessions cannot be counted by another.
- **0.51.0** keeps what describes the present true: a change that makes the agent doc, glossary, specs or architecture wrong fixes them in the same pull request; a question for you that blocks nothing is kept for you instead of stopping a run.
- **0.50.0** adds the path from an empty folder, with not even an idea, to the first feature (discovery, a pressure test, the vision with key journeys, the MVP, the architecture, a walking skeleton), and checks the document templates against established practice: arc42 and C4, MADR, EARS, Mermaid diagrams, and a ТЗ by ГОСТ drafted on request. Projects rerun setup once for the new templates.
- **0.49.0** splits the protocol into a core and topic references that skills cite instead of restating.
- **0.48.3** opens a design question with the parts it touches and their boundaries, and looks names up in the glossary before using them.
- **0.48.2** ends a worker's session once its result is merged instead of leaving it running.
- **0.48.1** puts time under the phase of the work actually done, not under whichever skill spoke first.
- **0.48.0** reads the project's hours from what the harness measured instead of guessing from gaps between messages, across all sessions, workers and subagents.
- **0.47.0** takes every approval a run will need in the preflight, before you leave, and names it in your words.
- **0.46.0** keeps a decision or condition you give on record, so no later session recommends what you already refused.
- **0.45.0** fixes a red check the merge waits on as part of the work, without charging it to the milestone's finding budget.
- **0.44.0** never recommends work just because it is ready: work whose ground is being replaced waits for it.
- **0.43.0** leaves a decision with whoever made it: an unanswered question is not your answer, and the agent's own recommendation is not your ban.
- **0.42.0** checks a reading's edges before calling it a fact: when it starts, when it stops and what else happened then.
- **0.41.0** puts the substance in every request for your approval, never a reference to a report you did not get.
- **0.40.0** does not reopen a decision you gave because a later analysis looks better.
- **0.39.0** reads the neighbouring work that would replace a piece's ground before building on it.
- **0.38.0** talks about your project with its own names for its parts instead of renaming them into everyday words.
- **0.37.0** reads and instruments a red check instead of rerunning it in the hope it turns green.
- **0.36.0** never asks for a separate merge just for tracker records or notes; they ride with the work.
- **0.35.0** opens a session with the state of the work in flight and asks how long you have, so you need not ask what is going on.
- **0.34.1** repairs the preflight's estimate item, which 0.34.0 had split in two.
- **0.34.0** keeps a branch waiting on its checks untouched, so other work does not restart them.
- **0.33.1** brings everything that reaches you already worked: options, costs, evidence, a recommendation and the case against it.
- **0.33.0** treats your time as the scarce one: runs parallelize, fill waits with useful work and do not stop for decisions you already left with them.
- **0.32.0** makes adopting the checks pay for itself at setup rather than at the first push, and has every refusal say what green looks like. Projects rerun setup once.
- **0.31.0** notices a run that stopped in silence: each run says when its result is due, and past that time the silence is reported.
- **0.30.1** bounds out-of-sight work by its estimate; overrunning it is a defect to find, not a reason to wait longer.
- **0.30.0** carries measured time on the work itself in the tracker, so any machine or session can estimate from it, and silence is no longer read as progress.
- **0.29.1** leaves nothing of value only in the session: edits, findings and decisions are committed, filed or noted before it ends.
- **0.29.0** hands a finding that does not fit the milestone's budget to you to decide, instead of parking it to make the checks pass.
- **0.28.0** has you see an outcome working before it is accepted; green tests alone do not prove a feature can be reached.
- **0.27.1** works out what a refusing check will demand at preflight, not at the push.
- **0.27.0** satisfies a refusing check instead of bypassing it.
- **0.26.1** has `handoff` propose lessons that outlive the session for the project's agent doc, only when there are some.
- **0.26.0** measures runs instead of guessing: `take-task` keeps a run journal outside the repository, estimates from the pace it measures, and `close-out` asks the owner once how each run went (taken as is, questions it need not have asked, decisions it should have, corrections), with owner attention and cost counted from the session transcripts. Memory and code indexes are leads to confirm, and lessons that outlive a feature go to the project's agent doc.
- **0.25.0** keeps a handoff out of the repository and out of temporary files: the work's state stays in the tracker, and what only the conversation knows goes on the feature, or to the user's state directory, where `ask-shady2k` reads it.
- **0.24.4** answers each question with the cheapest check that can: a local unit test before an end-to-end run, this machine before CI, one test before the suite.
- **0.24.3** reads what starts CI from the repository itself: unfinished work starts no expensive run, and ready work starts it once, by whatever means that repository offers (a draft pull request, holding the push, a label).
- **0.24.1** treats CI and end-to-end runs as expensive: tests run from the one failing test outward, a CI failure is reproduced and instrumented locally, and the branch is pushed once when everything local is green.
- **0.24.0** never pushes a guessed fix for CI to judge: a failure seen only in CI first gets what makes it explain itself. Waiting on CI is quiet until a result matters, and estimates are in agent time (the work plus the waits), said again once when the work outgrows them.
- **0.23.0** publishes everything described below from 0.21.0 on: those releases were pushed but their version number never rose, so no installed plugin updated. Bumps now go through a script that fails if the number does not rise.
- **0.22.0** treats every red check as the run's own to fix, never "someone else's", and asks that failures explain themselves: clear test output, CI causes on the first screen, log levels and trace ids by project conventions.
- **0.21.0** separates talking from building: the agent opens a working copy only when something is kept, lands plans with as few merges as possible, and starts each feature on its own branch without you.
- **0.20.0** starts a skill when you ask in words or agree, instead of asking you to type its command; runs are sized to how long your branches may live, and every option carries a rough duration.
- **0.19.0** runs a whole feature without you: plan it together, answer one batch of questions, leave, and come back to one pull request that says what was built, how to try it and what the agent decided alone.
- **0.18.0** asks whether the process is for you alone or the whole team, and tells contributors how to get the plugin.
- **0.17.0** keeps installation state out of the repository: setup lands with one merge, and each contributor's plugin and hooks stay their own.
- **0.16.0** stops asking for setup after every update: only a change that needs the installation redone does.
- **0.15.0** never asks you to read documents: the agent tells you the substance, its decisions and assumptions, risks, other views and what review found, in plain words, and your approval covers what you were shown.
- **0.14.0** assigns tasks to the agent doing them, not to you, and every step ends with the next action, recommending a handoff or compaction in time.
- **0.13.0** adds a light "records" level for the document gate, recommended without protected CI, scopes required checks by what a change touches, and stops setup from rerunning full suites that were already proved.
- **0.12.0** separates languages: the agent talks in yours, and files are written in the project's artifact language, asked at setup (English by default).
- **0.11.0** adds `report-to-shady2k` for anonymized reports and ideas.
- **0.10.0** no longer holds setup and work until the document gate is wired: it becomes its own stage, and documents are checked by reading meanwhile.
- **0.9.0** turns `ask-shady2k` into a read-only orientation: the project's picture, progress and ways forward with consequences, also before setup.
- **0.8.0** adds open-ended dialogue, living-document templates and a portable document gate. Its fixture and CLI tests do not replace project adapter/CI proof or demonstrate conversational quality; live rollout remains a separate validation.
- **0.7.2** replaces per-setting interviews with role-aware recommendations across the set; consequential decisions and explicit authorization remain required.
- **0.7.0** revises execution and setup. Fixtures and package checks run locally; the new complete workflow still needs validation in real projects. Earlier installation runs informed the protections around proof, isolated staging and landing. Harness-specific automatic update/session hooks are not shipped.

## Credits

The original shape and work-skill ideas come from
[mattpocock/skills](https://github.com/mattpocock/skills), MIT:
[license](docs/third-party/mattpocock-skills.LICENSE). They are rewritten here
around this set's tracker protocol.

The 0.8 document lifecycle draws on [OpenSpec](https://github.com/Fission-AI/OpenSpec)
(current specs versus deltas), [Spec Kit](https://github.com/github/spec-kit)
(scenarios and traceability), and [Superpowers](https://github.com/obra/superpowers)
(proportional design and evidence before completion). Templates and checks here
are original implementations, not bundled copies of those tools.

## Development

```bash
npm test                  # backlog/commit/document fixtures, CLI and package invariants
npm run test:mutation     # deliberately break checks and observe failures
npm run protocol          # synchronize folder-local protocol copies
scripts/link-skills.sh    # link into local skill directories
```

[AGENTS.md](AGENTS.md) defines layout, invocation, portability and versioning.
Role-aware dialogue evaluation cases are in
[test/dialogue-scenarios.md](test/dialogue-scenarios.md); automated package
checks do not establish conversational quality.
