---
name: setup-shady2k-skills
description: "Install or recheck the set in a project, or connect a new clone of it: tracker, queue, working settings and checks. Use when the user asks to set up, update or connect, or agrees to it after a skill reported the installation out of date; never start it unprompted."
---

# Setup shady2k-skills

Every run is a **full reconciliation**, also for an existing installation: a
matching version does not prove the tracker, commands, hooks or settings still
work. Keep valid earlier choices, inspect the real state, repair drift and
prove the result. Never reduce an update to copying one script.

Find technical facts yourself; never ask the user for commands or config keys.
Everything the user reads, and the role it is pitched at, follows the
protocol's [**Speaking to the owner**](references/speaking.md).

The set owns [the protocol](protocol.md), [the backlog rules](check.mjs),
[the commit check](check-commits.mjs), [the present-documents
check](check-present.mjs), [the product-documents check](check-product.mjs)
with the forms it checks ([the product's documents](references/product.md))
and [the normalized model](model.md).
The project owns its config, tracker adapter, check commands and wiring.

## Show progress

The user always knows how long this takes and when they are needed. After
reading the project, before changing anything, size the announcement to the run:

- **A short run**, typically a rerun after an update, where the user is needed
  only for the settings and the landing: say it in one or two sentences: what
  changes for their work, roughly how long, and at which moments they are
  needed. Not what changed inside the set. No
  step list: a table where most rows say "not needed, a few minutes" is noise.
- **A long run**, such as a first setup or a large cleanup: show the plan as the
  six steps below, each with what it does, whether the user is needed, and a
  rough duration with its basis ("about 900 open issues: the cleanup is the
  long part, likely more than one session").

Durations are estimates; say so once, revise them when they turn out wrong, and
answer a doubt by the protocol's **A time told to the owner is measured, and a
dispute is answered with its basis**.

1. **Look around**: read the project, tracker and existing installation. Agent only.
2. **Tidy the queue**: agree with the user what is current, what waits and what
   was abandoned, then clean up reversibly. Needs the user; the long step for a
   large backlog, short for an empty one.
3. **Agree the settings**: one recommended profile. Needs the user once.
4. **Connect the checks**: so that they run on every commit. Agent only.
5. **Prove it works**: plant violations, watch them rejected, undo. Agent only.
6. **Finish**: bring the installation into the main line. May need the user's
   approval to merge.

Give a progress line only where it tells the user something: when a step that
takes a while finishes or runs long, and when they are needed now. One line:
what finished, what comes next, whether they are needed. When a session has to end, say which step is next, so a later run
resumes there. Where the harness shows a task or plan list, keep these steps
in it. Progress lines follow the same plain-words rule as everything else.

## 1. Get a working tracker and a usable queue

Read the agent docs and their tracker references, any existing installation,
hooks, CI, runtime, current work and worktrees. An installation left on another
branch is reconciled and landed by this run, not duplicated, and not handed
back to the session that left it, by the protocol's **Read the record, not the
memory**.

**Run `node product.mjs where` before a tracker is chosen.** It says what this
folder is, and setup differs by the answer:

- **A product repository**: this repository holds the product's knowledge and
  none of its code, so its document places are the layout's and are asked
  about nowhere: they are the ones [documents.md](documents.md) gives a
  product repository. The kinds registry is written here, and only here: run
  this skill's `kinds-registry.mjs` with `--root` set to the product's root —
  it writes `docs/kinds.yaml` where the product holds none ([the kinds
  registry](references/product.md): every kind's id prefix, folder, stage and
  next-step hint) and verifies one that stands, never resetting it. When it
  refuses the one that stands, tell the user in plain words what it named,
  leave the file as it is and go on with setup: the wiki serves its plain
  pages until the registry is fixed. The tracker lives here, and the
  product-documents check is wired as the commit gate as it is wherever this
  set is installed.
- **A code repository of a product** (a git repository under a product's
  `repos/`): a product has one tracker and it is the product repository's, so
  no tracker is chosen or installed here and no queue is cleaned; every task
  of this repository, the setup task included, is the product tracker's. This
  repository's commits carry task ids that name the product's tasks, and the
  commit check resolves them against that tracker, whose repository is `../..`
  from here, never an absolute path. This repository's hooks run the commit
  check and this repository's own code checks; the backlog gate runs in the
  product repository. Setup here needs the product repository set up first:
  where it is not, say so and stop, naming what is missing.
- **Neither**: an ordinary project, as the rest of this skill says.

**An existing tracker:** verify reading, export and writing through its own
documentation. **No tracker:** recommend one, weighing portability, offline
use, collaboration, history, ownership and dependencies, with its costs, and
get the user's choice before installing it unless that was already authorized.
This may be the one decision needed before the rest of the profile. A tracker
stored in the repository is a valid choice for a small project; no product is
required. Check it can represent the protocol, natively or through documented
adapter metadata. Where the store lives in the repository, an existing one
included, its layout is part of the choice, by the protocol's [**State every
branch shares is not versioned inside one**](protocol.md). For a product
repository the store lives outside the branches by default: one copy per
machine, on a dedicated ref no code branch contains, with every checkout and
worktree of that machine pointed at it, and no code branch carrying a tracker
record at all. A store a branch commits is chosen only by the owner, and setup
says its cost first, in the owner's terms: records on an item two branches
work on collide by construction, and the merge that follows is not the code's.
Before recommending either, verify the tool can be pointed at such a store
from every checkout of the machine and can export and merge there; where it
cannot, say so and what is instead. Record the choice in the integration,
whose field this is. Never treat an unreachable tracker as absent or replace
one without a decision.

**Where the store lives outside the branches, setup installs the means, not the
duties alone.** By the protocol's [**State every branch shares is not versioned
inside one**](protocol.md) and [**The tracker stays in step across
machines**](protocol.md), the layout is one store per machine on a ref no branch
contains, every checkout and worktree of that machine pointed at it, a publish
within seconds of a change, a sync on a short timer with a per-item merge that
records the overwritten value, a claim and a status transition that count only
once they are on the remote, a state recorded under each code revision's own
name, and a supervisor that survives a reboot. Those are the duties; the shipped
mechanism is what meets them, and this skill installs it:

- **Choose the tracker's recipe.** The shipped recipes declare which tracker
  they serve; `node tracker-sync.mjs recipes` lists them by their own names and
  paths, and the project's own tracker doc says which tracker this project
  keeps. Where one declares this project's tracker, use it. Where none does, the
  tracker-neutral mechanism is still installed, and the project supplies the
  recipe's declarations — its store folder and export, import and merge
  commands, its pointer and its proof — from its own tracker's documentation, or
  the owner is told plainly that this project must supply them and what they
  must do. Never name one tracker's commands as a default for another's, and
  never leave the duties stated with nothing installed.
- **Copy what the project runs.** Copy the mechanism, the chosen recipe and the
  supervisor template into the project at the path the other installed script
  and check copies live, byte for byte, and record in the integration's
  **Tracker synchronization** field their paths, the plugin version they came
  from, the launch command, the supervisor and the bounds (the debounce, the
  maximum batch age, the sync timer, the network timeout). The copy is what a
  supervisor runs: the plugin's own folder changes with every version. A setup
  run compares the installed copies byte for byte and reports the version the
  installed mechanism reports about itself, written into a `tracker-sync.version`
  file beside the copy: the copy reports it (`node <mechanism> status`, and
  `--expect-version <the set's version>` says whether this project's copy is older
  than the set it came from), so a project that chose this layout learns that its
  copy is behind and reruns setup to refresh it, without a setup version rise.
  Record the version and the copy's provenance in the integration's **Tracker
  synchronization** field beside the launch command, and update both when a setup
  run replaces the copy.
- **Start it, and prove it, as a change to the machine.** The packaged unit is a
  systemd `--user` service; keeping it after logout and reboot needs
  `loginctl enable-linger` for that user. Enabling a background process is the
  owner's decision and may need privilege, so it is agreed, never assumed. macOS
  gets the same mechanism run by hand or by the project's own launch agent: the
  shipped text describes a LaunchAgent, which starts at the user's login and not
  necessarily at machine boot, so automatic supervision there is **not shipped**.
  Nothing in this setup installs into a user's systemd or launchd directory
  without being asked.
- **Keep one machine's paths out of every machine's checkout, and know what a
  remote that answers is.** The record and relink steps are composed onto the
  checkout's own hooks, never written into a folder inside the repository: where
  `core.hooksPath` names a folder in the tree, connect writes nothing there. A
  folder of the project's own that carries, in every hook the layout needs, the
  marker line connect writes for that step is accepted as it is, so a project that
  keeps its hooks tracked by design and shared by every clone connects on every
  clone and rerun. A hook that is missing or lacks its marker is refused (exit 1),
  named with the line for the project to add to that hook, because the line
  carries this machine's state directory and the recipe's path, which no other
  machine can use. Every command the mechanism runs runs without git's own hook
  environment (`GIT_DIR`,
  `GIT_INDEX_FILE`, `GIT_WORK_TREE` and the rest of it): a step started from a hook
  must read and write the store, never the code checkout the hook came from.
  A revision that is already recorded is success — the command says so and writes
  nothing — because a hook runs again after a merge. Reachability is whether the
  remote answers: a remote whose `HEAD` names a branch that does not exist answers
  and is reachable, and only a remote that does not answer makes a read refuse (or
  connect says to pass `--offline` and publish when it does).
- **Say what the no-code-CI property is.** The ref is not a branch and not a
  tag, which is why a push to it is expected to start no code CI; the host's
  documented behaviour is cited in the mechanism's own notes, and the proof that
  counts is this project's run list after the first push, read by the owner or
  by `gh run list` where the project uses it. Where the host refuses a ref
  outside `refs/heads/` and `refs/tags/`, say plainly that this hosting is
  unsupported for the layout and what must change.
- **Say the claim's residual.** Two machines claiming one item inside the same
  seconds can both come away believing they hold it: the remote's own ordering
  decides which change lands first, and after the next sync every machine shows one
  holder, so the second session learns at its next read that the item is not its.
  That is the cost the set accepts for not making a claim wait for the other
  machine; every other part of a claim, a transition and a record is unchanged, and
  the proofs run the two-machine case with that allowance.
- **Move an existing project without losing a record.** The move is a copy of
  the tracker's own store files into the machine's store, never a re-creation
  through the tracker's create command, because a record is retired by a void
  that names its comment id and ids must not move. Record the branch's last
  in-tree revision from that revision's own committed state
  (`record --revision <revision> --from-tree`) before the store leaves the tree,
  so a read at that revision still answers; take the initial copy only while the
  ref holds no store, and let every machine import and merge instead of copying
  once it does; carry the tracker's own settings with the items, so a setting such
  as exclusive claims survives the move and a second machine's connect instead of
  silently becoming the tracker's default; remove the in-branch store and the hook
  that narrowed what a branch commits of it in one change that names the move. Say
  what a checkout of a branch from before the move does: it replaces the pointer
  with that branch's own tracker folder, so the next connect — and the step
  installed for a checkout — relinks it; a leftover folder that holds nothing but
  locks is moved aside and the pointer put back, a folder that holds a tracker is
  refused and named, and the pointer check refuses a real folder where the link
  belongs rather than reading it as reaching the store.

**The setup task comes first.** Before any repository change, find or create
the setup task in the tracker; it owns installation, cleanup and their commits
even before the gate exists. It is live work of the current milestone:
it carries that milestone's label and never the finding label, so what is filed
with it is in the slice and spends no budget. It stays a leaf: what is found
during setup is filed beside it, by the protocol's **Only what the milestone
chose is intake**. An interrupted or failed run leaves its work on
its branch and its task; the main line keeps its previous installation until
landing. If tracker access fails even for this task, stop, report the failure
and say setup must be rerun.

**A repository already installed at this setup version** needs only this clone
connected: hooks active, runtime present, the person's plugin at the same
setup version. Run the integration's connect command, prove the hooks fire, and stop: no queue cleanup, no
profile, nothing committed. Announce it as the short run it is.

**Clean the queue with the owner.** Inventory statuses, labels, milestones,
dependencies and holders. Save a snapshot **before any cleanup**. Hand
`groom-backlog` the verified tracker operations, the snapshot location and a
proposed config as its bootstrap context. With the owner: keep the active slice
and work that is really running, release abandoned holds, fix invalid
dependencies, defer unrelated work, and keep implemented work that awaits
acceptance. No bulk deletion; write a field-level rollback that does not
overwrite later work. If the queue is already usable, prove it and leave it.
Cleanup happens before the gate is installed; it does not need the gate.

## 2. Agree the settings

Read earlier answers, charters and decision history, and compare them with the
real state. Keep valid choices, including limits written in prose; a missing
config key is not an unanswered product decision. Never silently reset a
setting or add a reserve to an agreed budget.

Present **one recommended profile**, not a series of questions. Open with what
the update means for the user's work now, including what waits until it
finishes. Then a compact table of only the entries that change or need a
decision: a plain name, the current and recommended value, what it controls,
and what accepting or changing it means in behaviour, time, cost and risk.
Retained settings take one line, detailed on request, saying what they mean in
plain words ("new backlog problems block a commit, old ones do not"), never
their values or labels. Cleanup lists tasks by
title, grouped by what will happen to them.

The user accepts the profile or names the entries to change. Approval settles
all its choices at once; do not confirm rows again. "Use the recommended
values" means: choose defaults from evidence, say what you chose and continue;
it authorizes only that, by the protocol's **A decision belongs to whoever
made it**.
Base capacity and budgets on real resources, review capacity, observed test
times and the project's risk policy, not invented numbers.

Ask separately only about unresolved scope, a material cost or risk,
conflicting decisions or missing authority, put as the protocol's [**How an
open question is put**](references/speaking.md) gives, with a recommendation,
real alternatives and their consequences. Approval of the
profile does not permit undisclosed bulk cleanup, publication, weaker
acceptance or wider scope. Reuse approval already given; leave settings unrelated to this setup for later.

The profile covers the following. It is the agent's checklist, **not a
questionnaire**.

- **Who works this way:** only the person running setup, or everyone who works
  in the repository. Always a question on first setup, asked before the rest,
  because it decides what binds other people; show who else committed recently.
  **Personal:** the plugin for this person only, the hooks active only in their
  clone, no CI enforcement; the shared files are committed but bind nobody
  else, and the tracker changes stay visible to all. **Team:** the plugin also
  offered at the project level where the harness has one (in Claude Code the
  plugin's source becomes known to anyone who trusts the folder; each person
  still installs it once), the install line in the agent doc for every other
  harness, written from [agents.md](references/agents.md), the set's one list
  of install and connect commands, hooks connected in every clone, and CI
  enforcing the checks on everyone's commits. Team is a decision for the
  team, not only for this person: say so. A rerun keeps the recorded answer.
  Check the plugin's own
  installation scope where the harness shows it: every checkout and worktree of
  this repository should see the skills at one version, so the install is made
  at the scope that covers them all (in Claude Code, `project` from the main
  checkout, or `user` for everywhere; in omp, `user`, since its `project` is
  kept per checkout; in Pi and Prime Agent, a personal package install covers
  every project and worktree). An install that reaches only some
  checkouts is drift: recommend removing it by the harness's own instructions,
  leaving the shared settings as they were, and restarting sessions after
  installing or updating.
- **Artifact language:** the language of documents, tasks, commit messages
  and code comments. Always a question on first setup, even inside an accepted
  profile: recommend English and show which language the existing files and
  commits use. A rerun keeps the recorded answer. Conversation always follows
  the user's own language, whatever this is.
- **How open questions are put:** whether the questions the owner must answer
  arrive one at a time (recommended) or as one batch. Say what changes in
  their words: how many questions one message carries, and nothing else — the
  same questions are worked and asked either way, and a summary they accept
  whole or correct by item stays one message. A rerun keeps the recorded
  value, and an existing project that has none is asked once, by the
  protocol's [**How an open question is put**](references/speaking.md).
- **Scope and horizon:** labels, areas, the current milestone and its finding
  budget. Compare documented labels with real ones; never erase live work to
  fit a list. Establish the current slice during cleanup if needed. A missing
  charter is written later through `/to-milestone`, but the first budget is
  agreed now, profile approval included. Only the current milestone is broken
  down; its independent features may run at once.
- **Gate strength:** keep the agreed one or recommend one. `block-new`
  (recommended where history exists) stops new problems and shows old debt;
  `block` stops every problem; `report` only prints. Explain each one's cost.
  Age thresholds may keep their defaults: staleDays 14, holdDays 2,
  bulkCluster 20.
- **Development:** test-first (`tdd`) or `test-after`, whatever the size of the
  work. Both need related worker tests and final stage acceptance. For
  non-code work name equivalent checks; never force a disruptive live drill.
- **How work runs:** inline in the owner's session, subagents of that session,
  separate worker sessions (a terminal multiplexer or similar), or a cloud
  session, as the harness offers, and how a stopped run reaches the owner.
  Explain what each means for leaving: inline and subagents end with the
  session; separate sessions survive while the machine runs; a cloud session
  needs no machine of theirs. The preflight of each feature run confirms it.
- **How the owner is told when away:** the channel that carries a run's
  messages when the owner is not at the screen. Its values: none; the
  harness's own notification where it has one; or a command the owner
  already uses — a push service, a messenger bot, a webhook, any command
  that takes a short text — named exactly as they invoke it. Setup looks for
  what this machine already has (an installed notification command or skill)
  before asking, and recommends that; recommend none where it finds nothing
  and the owner does not name one. Say in plain words what the channel is
  for: the run's progress digest, a point the run could not settle by
  itself, a decision waiting on the owner. What the push carries is the same
  summary the protocol's **Summarize; never assign reading** already holds
  every message the owner reads to, sent on the measure the protocol's
  **Waiting is quiet** gives, while the protocol's **The owner's time is the
  scarce one** governs what a run does in their absence: the channel carries
  no second format of report and none of the kitchen. The channel is the
  person's, not the project's: the command is kept outside the repository,
  per machine, in the set's per-user config folder, in a file beside the one
  `jev.json` already defines, which the run script's `notify` command reads;
  tokens and keys are never written into the repository or the extension —
  they stay where the owner's command already reads them, its own config or
  an environment variable. The project's config records only that pushes
  are on, in `notifyPushes`, which turns on only with the owner's yes at
  setup, together with the channel being proved (proof 4). A rerun keeps
  the recorded answer.
- **How changes reach the main line:** whether it accepts a direct push or
  requires a pull request, which checks it requires and how long they take.
  Found by looking, recorded, never asked again. Where CI runs product checks
  on changes that cannot touch the product (documents, the tracker, the set's
  own hooks and scripts), or gives unfinished work no way to skip a full run,
  recommend fixing it as a task filed with the setup task, by the protocol's **Only
  what the milestone chose is intake**, by the protocol's
  **Cheapest check first** and **Know what a push starts, and push once**.
- **Diagnosability:** whether the project has recorded conventions for log
  levels, request and trace ids and error causes, and whether its CI shows a
  failure's cause on the first screen and keeps logs and artifacts. Where not,
  recommend recording them, as separate tasks.
- **How long a branch may live:** read the project's own rule where its docs
  state one (many prefer merging into the main line often); otherwise recommend
  a day or two. Feature runs are sized to it.
- **Execution:** which agents and models may do which work (for example, a
  light model only for low-risk tasks, a strong one for security, data or
  concurrency), how many agents work at once, atomic claims or one-at-a-time
  assignment, how an agent's claim names that agent instead of the person, separate checkouts, who merges, and how the tracker stores
  `submitted` and `implemented` work. No artificial chains between features,
  stages or tasks; record only real conflicts and prerequisites.
- **Verification:** commands for static checks, related tests and full checks;
  mutation testing of changed logic, its time budget and what to do with a
  meaningful survivor. Without tooling, agree an explicit alternative and its
  budget at setup; where none is agreed and none exists, a mutation check that
  cannot run is reported as never made, never used as "passed", and holds
  nothing up.
  Required checks follow what a change can touch, by **Cheapest check first**.
  Show the cost of each long check, so the owner sees what it buys.
- **Jev:** whether this project's text may be sent to Jev, a fast decision
  model the agent can hand a batch of judgements to, and where its key is, by
  the protocol's [**A project's text goes to Jev only with that project's
  consent**](references/judging.md). Always a question on first setup and
  whenever the config has no answer, asked of each project on its own; a rerun
  keeps the recorded answer. Say what it buys (long logs, transcripts and many
  items sorted in seconds for cents, the agent reading only what Jev is unsure
  of), what it costs (a key, cents per batch), and where the text goes: through
  OpenRouter to TypeSafe, or to TypeSafe directly, and TypeSafe keeps what it
  receives unless the project has a zero-retention agreement with it. Say what
  is masked before sending and that masking goes by shape and misses what has
  none. Recommend no where the code is not the owner's to send out; otherwise
  the owner's call. Find where the key is and ask only if it cannot be found;
  never read the key into the conversation. Where it is, is this machine's, not
  the project's, and a project cannot name its own: with the owner's agreement,
  write it to the file [`jev.mjs`](jev.mjs) reads it from,
  `$XDG_CONFIG_HOME/shady2k-skills/jev.json`
  (`~/.config/shady2k-skills/jev.json` by default), which wins whenever it
  exists and holds the key's place in one of three forms:
  `{"key": {"env": "MY_JEV_KEY"}}` (a variable's name),
  `{"key": {"file": "/path/to/key"}}`, or
  `{"key": {"command": ["program", "args"]}}`. A file that is there but
  broken is an error that names it, and a config with a `key` is refused. When
  there is no file, the key is the variable `JEV_API_KEY`, which must reach the
  process that runs the Jev MCP server (the harness that starts it, not only
  the owner's shell), and the MCP connection is restarted after that
  environment changes (in Claude Code, `/mcp`). Where the
  tracker's item ids have one shape, record it so ids are masked. In team
  scope each person keeps their own key's place, and a person without one
  simply works without Jev. Where the project agrees, also how sure Jev must
  be for its answer to be used, and which Jev, by the protocol's [**Its answer
  is taken only where it is sure**](references/judging.md): recommend 0.9 on
  jev-1.13, the set's own measure, and say it is a trade-off the owner may
  move (higher: fewer wrong answers get through, less reading is saved) and
  that a replay on this project's history gives the numbers to move it on.
  A config without them keeps those values, so a rerun asks only where the
  owner wants to change them.
- **Review:** decide whether independent review is required for acceptance.
  Apply [**A reviewer on another model**](references/agents.md#a-reviewer-on-another-model)
  for reviewer selection, the setup proof and recording, and repair/fallback.
- **Documents and commit links:** read [documents.md](documents.md) for the
  lifecycle, templates, document gate and its trust limits. Map vision,
  roadmap, charters, current capabilities, changes, optional design and
  decision records, and exploration notes onto the project's existing
  documents; propose defaults only for missing roles, not an empty directory
  tree. Pick one workflow owner; do not move other tools' documents or disable
  their hooks without saying so. The profile states document policy, where
  evidence and approvals come from, and what enforcement cannot guarantee.
  Recommend the gate's evidence level from [documents.md](documents.md):
  **records** where no protected CI or tracker guard exists, which keeps the
  gate to a structural check and honest acceptance records; **protected** only
  where CI can really block a merge. Recommend wiring it in this setup only if
  it fits; otherwise it becomes its own stage, and work continues meanwhile
  with documents checked by reading.
  Name the documents that **describe the present** (the agent doc, the
  glossary, the architecture, the current capability specs) for the
  present-documents check in [documents.md](documents.md), found from the
  project, not asked: a pull request that leaves one naming a path it removed
  is refused, and older drift is reported and filed as debt. Say what that
  means for the owner: a stale document shows up when a pull request is opened,
  with the paths it names that are gone, instead of months later. Where the
  first run already finds old drift, say how much, and that it becomes debt,
  not part of setup.
  Choose how **every commit** names its task, setup, documentation, research
  and prototypes included, and how merge and revert commits keep that link;
  they are not silent exemptions.

## 3. Write or repair the integration

Where other agents share a checkout, install on a separate branch or worktree,
by the protocol's **An agent commits only what it wrote**. Never delete
branches, worktrees or files this run did not create, even merged ones; list
them and propose it instead.

**Config:** one project JSON file holds the changing choices. A starting shape:

```json
{
  "strength": "block-new",
  "currentMilestone": "<label>",
  "milestoneLabels": ["<labels>"],
  "areaLabels": ["<areas>"],
  "roadmapLabels": [], "triageLabels": [],
  "ideaLabels": ["idea"], "ideaTitlePrefixes": [],
  "findingLabels": ["finding"], "findingBudget": null,
  "staleDays": 14, "holdDays": 2, "bulkCluster": 20,
  "timeRecordsExempt": [],
  "codePaths": ["<the paths in this project that are code>"],
  "presentDocuments": ["<the agent doc, glossary, architecture, current specs>"],
  "presentAreas": [""], "presentIgnores": [], "presentChurnCommits": 20,
  "execution": {
    "development": "<tdd | test-after>",
    "runMode": "<inline | subagents | worker-sessions | cloud>",
    "maxBranchDays": 2,
    "landing": "<push | pull-request>",
    "maxWorkers": 1,
    "mutationBudgetMinutes": 10,
    "mutationFallback": "<agreed alternative or escalate>",
    "reviewPreference": "different-model",
    "reviewFallback": "<same-model independent reviewer | disclosed self-review | escalate>"
  },
  "jev": {
    "consent": false,
    "route": "<openrouter | typesafe>",
    "idPattern": "<the tracker's item id shape, as a regular expression>",
    "maskPatterns": [],
    "sure": 0.9,
    "model": "jev-1.13"
  },
  "notifyPushes": false,
  "scope": "<personal | team>",
  "artifactLanguage": "en",
  "openQuestions": "one-at-a-time",
  "projectWords": ["<project names>"],
  "trackerWords": ["<tracker names>"]
}
```

`maskPatterns` adds the project's own `{name, pattern}` to what is masked
and can only add; a pattern that could hang on a long text is refused. With
`consent` false the rest may be absent.
The execution numbers are examples, not choices. `findingBudget` and
`currentMilestone` stay null only while no live slice is admitted.
`timeRecordsExempt` is written once, when time records are adopted (step 2 of
the proofs), and only shrinks after.
`codePaths` is what the commit check counts as code: the adapter copies it into
that check's input, so a path outside it — a document, a tracker export, a
change record — is never code and no commit that touches one is refused. An
empty list counts nothing as code, which is the honest answer for a project
that has not decided yet.

`notifyPushes` is the project's only note about the owner's channel: the
channel itself — the command and wherever it keeps its token — is the
person's, kept in the set's per-user config folder, beside `jev.json`, and
the key stays out of the repository. It turns on only with the owner's yes
at setup, together with the channel being proved.

The config holds only choices the whole team shares. It records no
installation state: the installed checks' versions on the main line are the
repository's installation, and each person's plugin, hooks and runtime are
their own, checked directly. An older config's `setupStatus`,
`setupVersion` and `setupVerifiedAt` are removed in this setup's landing,
silently, by the protocol's **Speaking to the owner** (never show the kitchen).

**Adapter:** read [model.md](model.md) in full before writing or changing it.
It exports every status, closed, `submitted` and `implemented` included, real
dependency edges, holders, recorded merge evidence and every work record
comment, raw, by the protocol's **How the work went is kept on the item**. Its ready operation
takes the stage and checkout, and whatever it returns can be claimed atomically
and exclusively with the dependency edges kept; where the tracker's own claim
refuses some of it (a blocker it does not know is satisfied, for example), the
adapter records a way that keeps both. A tracker without native `implemented` or
`submitted` statuses gets an explicit, stored mapping, never a silent mapping
to ready or closed. Where the store lives outside the branches, by the
protocol's **The tracker stays in step across machines**, verify its reads
before agreeing any strength: the store as it is now, and the store at a code
revision through the state it recorded under that revision's own name when the
revision was cut or landed, never through the code revision's tree. Verify that
a change is published within seconds and that each machine takes the others'
snapshots on a timer short enough to match, and that pushing the store's ref
starts no code CI. For
`block-new`, verify that history can be exported and the historical config
retrieved; otherwise agree an honest supported strength.

**Checks:** run all five shipped checks in place where they are in the
project, or copy them unchanged (the backlog rules with
[`time-format.mjs`](time-format.mjs) beside them, which they read records by,
the present-documents check with [`document-format.mjs`](document-format.mjs),
and every check with [`regular-file.mjs`](regular-file.mjs) beside it, which
they ask before opening a path the command line or a folder walk named), and
record where they came from in the
integration, not inside the copies. Without Node, port all five and prove the
same fixtures. A matching version does not replace a byte comparison or port
proof.

Wiring follows the agreed scope: in personal scope the hooks run only in the
owner's clone and nothing is added to CI; in team scope every clone connects the
hooks and CI enforces them. Every rejection says in plain words what is wrong
and how to fix it, readable by a contributor who has never heard of the set.

**Connecting a clone** is one committed command, written with the wiring and
named in the integration: it sets the hooks, filters and tracker import a clone
needs and checks every local file a hook reads, is safe to rerun, and fails with
what is missing instead of connecting half. Where the store lives off the
branches, the connect command also points the checkout at the machine's store
and brings its background sync up, starting it where it is not running, proves
the sync is up, and fails with what is missing rather than connecting half —
the same rule this paragraph already states for hooks and files a hook reads.
Every hook this setup writes, and
every guard the project adds beside them (a privacy guard in a public
repository, say), follows the protocol's [**A missing input is an
error**](references/building.md): one that cannot find its patterns, config or
runtime refuses the commit and names the connect command.

**Wiring the backlog gate:** it runs in the project's local hook and in CI.
For `block-new`, compare the working export with the store's own state at the
base revision and that revision's config; where the store lives off the
branches, "the last committed revision" names nothing, and the baseline is the
store's snapshot published at or before the base revision. CI uses the PR
merge-base or the previous head of a push, never a branch's merge-base with
itself. Misuse fails loudly (exit 2); `report` relaxes
only policy violations (exit 1), not a broken command. Where the project keeps
time records, the local hook recovers before it judges: every span that has
ended and whose receipt this machine can recover is posted exactly as the run
script's recovery prints it, so a receipt one session left unwritten stops
nobody else's commit, and the time is still recorded. A quiet transcript is not
an ended session: whether a session is still running is asked of the harness's
own list of live sessions, by the protocol's [**Read the record, not the
memory**](references/deciding.md), and a span whose session is still there is
left to it. It invents no end, and a recovery that fails leaves the verdict as
the gate gave it.

**Wiring the commit check:** it runs in commit-msg and CI. The project adapter
turns the chosen message convention into the input of `check-commits.mjs`.
Locally it checks the pending message; CI checks every newly introduced commit
and fails if it unexpectedly finds none. The same parser feeds the backlog
gate's `landed` list, the commits on the main line at the revision the gate
judges: one convention, read once, so a project cannot pass the commit check by
one reading and have the gate judge another. It is a local read of history at
that revision, never a network call.

**What a push introduces** is what the range checks read (the commit check, the
document gate's range, the backlog gate's baseline), in the pre-push hook and
in CI alike: for each pushed ref, the commits of its tip, a tag peeled to its
commit, that no ref the remote already has reaches, never a merge-base taken
as a baseline for a ref the remote does not have yet. A ref the remote has
whose object is not in this clone bounds nothing here and is skipped, by the
pattern and never by a namespace: an object this clone does not hold cannot
reach a local commit from here, so excluding it changes no answer, and it
never makes the range uncomputable. Where the store lives
off the branches, the code refs carry no tracker records and none is looked
for in them: the tracker transitions over a pushed range are read from the
store's own history over that range, by the protocol's **The tracker stays in
step across machines**, and the code range checks are unchanged.
A tag, or a new branch,
on a commit the remote already holds introduces nothing: the entry point says
"introduces no commits: nothing to check" for that ref and passes, by the
protocol's [**A missing input is an error**](references/building.md), which
refuses only what could not be read. Refused as before: a hook given no ref
lines, a range git cannot compute, and a pull request or push whose CI
enumeration comes back empty although its head differs from its base. Links resolve against all relevant
tasks, closed ones included. This check is mandatory whatever the backlog's
strength. Test the parsing on real linked and unlinked messages.

**Wiring the present-documents check:** it runs where a pull request is
opened and in CI on every pull request, against the merge base, so one opened
outside the set is checked too; a refusal names each path and what fixes it.
Run it once over the main line's history to see what it already reports:
paths that are not this tree's (routes, generated folders) go into
`presentIgnores` now, and the older drift it lists is filed as one debt item,
not fixed in setup.

**Wiring the product-documents check:** it runs in the commit hook on what
is staged (`--staged`) and in CI on the revision a push or pull request
brings (`--rev`), whatever the project's scope or strength, since a
repository with no product document passes it untouched. Its refusals name the
file and the line. It needs no setting: the forms and where they live are
the protocol's [product documents](references/product.md), and a project that
writes them starts from the templates in `templates/product/` — a product's
own template for a kind, when it holds one at its own `templates/product/`,
goes first, by [the protocol's precedence](references/product.md).

**Wiring the document gate:** build the deterministic export and the wrapper
for the agreed evidence level, described in [documents.md](documents.md).
Before enforcement starts, do what adoption owes there: record the work already
in flight as exempt, with its descendants inheriting the exemption when it is
split later; seed the capability catalogue with its directory and one document
from the template; and tell the owner what the gate costs and what the first
behaviour change after it includes, in hours, by the protocol's **What a gate
will demand is known before the work starts**. Run `product` and `feature`
before the first product implementation, `feature` for new changes,
`acceptance` for stage evidence and `close` before current docs are accepted.
CI picks the actual transition and lists every affected document; neither a
weaker phase nor an empty export supplied by the author gets through. It is
required whatever the backlog's strength. Prove real file parsing, baseline
choice and that each phase rejects its planted violations. At the protected
level also prove receipt verification, policy origin and enforcement at tracker
closure; at the records level disclose that records are trusted, and build no
forgery defences. JSON alone proves no evidence is genuine.
If it is not wired in this setup, file its task in the current milestone and
record in the integration that the gate is not installed yet, naming that
task. Setup still completes; wiring the gate later reruns proof 7.

**New projects:** conversation may come before setup with no files or issues,
by the protocol's [**Starting from nothing**](references/starting.md). In a
folder that is not yet a repository, create it with the owner's agreement,
saying where its remote will be or that there is none yet. An empty repository
has no CI to prove against: prove the local hooks, and record the CI checks as
wired by the walking skeleton, the first feature. Once work is to be kept,
create the setup task first, then seed only the agreed
vision, current slice and resource locations. The charter comes from
`/to-milestone` when the user runs it. Setup may finish with no admitted work,
no current capabilities and nothing beyond a vision section; never invent a
product to turn the admission gate green. Prove the gate on recoverable
fixtures and report product readiness separately from installation readiness.

**Tracker doc:** update the project's own tracker doc from
[integration.md](integration.md), without a rival table of tracker commands.
Run every read operation, including ready, holds and children of every status.
Test writes in reversible scratch state or read their documented behaviour.
Verify claim concurrency: rereading a field anyone can overwrite is not a lock.
In a code repository of a product the agent doc points at the product's
integration, by the relative path `../..`.
Point every harness's loaded agent doc at the integration with:

> All retained work and commits belong to tracked tasks. File discoveries through
> `to-backlog`; implement through `take-task`; close only after stage acceptance
> through `close-out`. Read Backlog integration in <path> before writes. When a
> skill reports the installation is out of date, run `setup-shady2k-skills`.

In team scope add one line for people who do not have the skills yet, in their
harness's syntax: this repository works through the shady2k-skills plugin, and
how to install it. Take that install command for each agent from
[agents.md](references/agents.md), the set's one list of install and connect
commands; it is the one command the pointer carries.

Use the real path and invocation syntax. Do not copy settings, milestone values
or commands into the pointer.

Put the pointer near the top of the agent doc, where it is read first, not at
the end of a long file. Then look through the agent doc for instructions that
compete with the skills, such as creating issues or committing directly with
the tracker's or version control's commands ("no issue? just create one"). An
always-loaded project doc beats a skill's description, so such a line quietly
bypasses the skill. Propose replacing each with a pointer to the skill that
does it, and change them with the owner's agreement.

## 4. Prove the whole installation, every time

An existing setup runs all of these too, even when versions match. In a code
repository of a product the proofs that read the queue are the product
repository's installation's, and here the shipped checks, the commit check on
real commits and this repository's own checks are proved.

1. **Shipped checks:** from this skill's directory run
   `node check.mjs --selftest --config <project-config>`,
   `node check-commits.mjs --selftest`, `node check-docs.mjs --selftest`,
   `node check-present.mjs --selftest` and `node check-product.mjs --selftest`
   (the first uses its fixture config for the rules and the project config for
   portability). Compare installed copies byte for byte; ports run the corpus.
2. **Tracker and adapter:** compare counts per status and ready leaves with the
   tracker; explain every difference. On an empty tracker use recoverable
   proof issues. Exercise claim (the holder must be the agent in the protocol's
   full name, not the person or a bare role),
   release, `implemented`, readiness and an actual claim of a
   dependant in the same stage, and of a dependant in the next stage of the same feature after its prerequisite's stage is accepted but still open, through the integration's own claim operation, acceptance across stages and independent ready
   work. Check that `submitted` results survive a handoff without being redone.
   Check dependency cycles and the exact task-reference parser. Prove the main
   line the gate reads: leave a leaf open, land a commit naming it, and see the
   gate report it with that commit; close it with that revision and see the
   report clear. A `landed` list that names nothing is a failed proof, not a
   green gate. Post a claim
   record the run script printed on a proof issue, read it back through the
   adapter's export and see it byte for byte; edit one number in a copy, post
   it, and see the gate name it damaged; then post the run script's `void` of
   it and see the gate clear it.
   Where the store lives off the branches, prove the layout with each broken
   case seen caught, and prove the mechanism itself with the shipped proofs
   script (this skill's own repository, `node test/tracker-sync-proof.mjs`),
   which runs them with two simulated machines: one local remote, two clones,
   two stores, a neutral fake tracker, and the project's own tracker's recipe
   where its command is on `PATH` — a named skip, never a pass, where it is not.
   It proves the ref's namespace and says that a namespace alone does not prove a
   host starts no run, so the run list stays yours to read. It cannot prove a
   real reboot or a second real machine: name those as not yet proved here, and
   prove them at installation on the machines that run the layout. Read every
   bound it prints as measured on this machine, not as a promise about the
   project's. **Read at a revision:** through the adapter, read the
   tracker at a code revision the store has a recording for, and see the read
   return that recording and say which one it is; then read at a revision the
   store never recorded, and see the read refuse and say so instead of showing
   an empty queue; then let a machine still on that revision publish a later
   snapshot naming it, read the revision again, and see the read still return
   the recording and not the later state — a read that picks the newest name
   instead fails here. **Publish and sync:** through the adapter, write a
   record while the sync runs and see it on the remote within seconds, counted
   from the write; take away the publish's retry and see a refused push leave
   the change local rather than lost, and see it land once the remote answers;
   make the remote unreachable, write again, and see the write kept and readable
   here while a read that needs another machine's state says the remote is
   unreachable rather than showing this store as the whole state; make the
   remote reachable again and see the write published within seconds of its
   return; stop the sync, write again, and see the write readable from the store
   and on no other machine yet; start the sync again and see the write
   published; then take the sync's runtime away, run the connect command in a
   scratch clone, and see it fail loudly naming what is missing instead of
   connecting half. **Claim on the remote:** push
   a snapshot the remote's newer state refuses, and see the sync merge it per
   item and push again; then hold one proof item on two machines, claim it on
   both, and see one claim land on the remote and the other discarded and
   said, with the session taking other work.
   Where the project kept run records on a machine before (a state directory
   of the set's), they are this machine's only: say so to the owner once, and
   leave them; nothing reads them now.
   **Adopting time records**, on the first installation that carries them:
   work is in flight that sessions on the older set took, and they wrote no
   claims. Find every active, submitted or implemented leaf with no claim
   record on it or on the feature or stage above it. Where the transcript of the session that took it is on this
   machine, read it for when the item was taken, write the claim with the run
   script's `claim --recovered` at that start and post it, then post its
   receipt from `gaps`. A transcript whose working copy was removed is found
   by the item it names, or, where the project agreed to Jev and the run
   script is given the config, by Jev's sure judgement; one the script still
   refuses is not "missing", and
   the owner is told which. The script reads the harnesses it has an adapter
   for: `node skills/engineering/take-task/ledger.mjs adapters` lists them
   and says what each cannot do, and a harness with no adapter is named
   unsupported here, never counted with the times no machine knows. List the
   items the rest leaves unread in `timeRecordsExempt`, and tell the owner
   once that this copy cannot measure their time: not that the transcript is
   lost, only that it is unread here. This happens at adoption only: an
   exemption follows the task tree, and work handed in unclaimed later gets
   the rule's own fix, never a place on the list.
3. **Real entry points:** plant a recoverable backlog violation and run the real
   hook; see it fail (or report, at `report` strength), undo, see it clean. Run
   the real commit-message entry point with a missing task, an unknown task and
   a valid leaf. Verify both CI range calculations on representative
   revisions. Through the real pre-push entry point, on a scratch remote: a
   tag, and a new branch, on a commit the remote already holds pass with
   "nothing to check"; a ref outside the heads and tags namespaces that points
   to a commit this clone does not hold leaves a linked push passing, because
   such a ref bounds nothing here; a tag or branch carrying a new commit
   without a task link is refused; a hook given no ref lines is refused. Run the connect command in a scratch clone and see its hooks
   fire; take away a file a hook reads and see the commit refused. On a
   scratch branch, move a file a present document names and see the
   present-documents check refuse it with that path; move it back, see it
   clean. Stage a product document with a `Status:` field and see the commit
   refused with its file and line; unstage it, see it clean. Never publish
   test commits.
4. **Execution commands:** each configured command exists and starts in the
   declared environment, proved the cheapest way that shows it works. Run a
   full suite only when that command has never been proved here, or it or its
   environment changed since; otherwise the earlier proof stands. Before any
   run longer than a few minutes, say what it proves and how long it takes.
   Never run anything only "for completeness". Check a bounded mutation sample
   and the reviewer or its fallback. Where `notifyPushes` is on, prove the
   channel the way the reviewer is proved, with one real call: the run
   script's `notify` command sends one real test message, and the owner's
   word that it arrived is the proof — nothing sent and nothing confirmed is
   a channel not proved, and pushes stay off until it is. A channel that
   stops working later is said plainly the moment it is found: the `notify`
   command reports a failure rather than pretending, and the run falls back
   to the conversation until the channel is repaired or retired with the
   owner's agreement, never silently dropped.
   Report every proof not performed. A failure needs a repair or an agreed,
   supported change of settings, not a success stamp.
5. **Jev**, where the project consented: from this skill's directory,
   `node jev.mjs status --config <project-config>` says it is available, and
   says which source it used — the machine's file, with its path, or
   `JEV_API_KEY` — proved by one call about a fixed sentence that carries no
   project text (its refusal names what is missing: consent, the key, or the
   route; for the `typesafe` route this is the first proof it works at all).
   With neither source, its refusal names both ways to give the key, with the
   file's path and its JSON; a file that is there but broken is refused by its
   own path. This is also the proof that reaches the agent: a key only in the
   owner's shell, not in the server's own environment, leaves the tool
   unavailable, and nothing is fixed until the file is written or the variable
   reaches that process. The connection is restarted after that environment
   changes, where a changed file is read on the next call. Run `jev.mjs mask` over a
   real sample holding an item id and a name, and see both replaced. A failed
   proof leaves consent recorded and says Jev is unavailable until it is fixed.
   Without consent, see `status` refuse. Where the owner runs Claude Code,
   Jev's tool server (the rule `mcp__plugin_shady2k-skills_jev`) needs an allow rule
   in the machine's own Claude Code settings, never the project's: without
   it every call waits for approval, a worker stalls on it and a headless one
   is refused. Propose adding it, with the owner's agreement, and say why it
   is safe: the tool sends nothing where a project has not agreed. Codex lets
   it through as read-only and omp approves tools by default. In Pi, check
   `/mcp` for the bundled `jev` server; its registration lasts only for the
   session. Pi does not use Claude Code's allow rule. Prime Agent 0.9.8 loads
   the same skills but cannot register Jev through the package: with the owner's
   agreement, connect it once through Prime's personal `mcp add`, then verify
   the tool. A host without native MCP registration needs its own MCP support;
   installing skills alone is not proof Jev is connected.
6. **Current state:** run the gate on the cleaned live backlog. Keep the age
   snapshots from before and after cleanup and use their bounded correction.
   Show the result, remaining debt, the strength and any limits.
7. **Documents**, once the document gate is wired: run the recoverable
   entry-point proofs in documents.md: a
   missing scenario in the real format, a stale source requirement, a wrong
   task, stale or missing receipts and an unsynchronized closure. Check that
   independent changes still pass, that a task split from an exempt one is
   still exempt, and that each refusal names what would make it green. Adopt only the legacy scope affected now;
   an old plan or a model's summary is not verified state.
   What each required check does not read is the agent's to find from the
   check's own command, not the owner's to supply, and is shown with the
   profile as a routine choice: an entry only where the command cannot reach
   the path. Prove it on two commits: a prose edit leaves that check's receipt
   standing, an edit to a file it reads stales it. On a scratch branch, finish
   two changes one after the other and judge the range that carries both: it
   passes, and breaking the earlier change's receipt refuses it.

Keep the proof evidence with the setup task. A tracker outage, missing runtime,
stale integration or failed hook is a specific repair, not a reason to discard
earlier answers.

## 5. Land and record the verified version

Land through the project's authorized workflow and check from the checkout
people use: docs reachable, all five checks run, hooks installed in that
clone. A separate branch alone is **written and proved, not installed**. Ask
only for landing steps not already authorized.

Shared hooks may already run in checkouts without the new files. Let through,
visibly, only a tree that never had this installation; a missing or broken
gate in a configured tree is an error, not a bypass.

A required check red on the setup's own pull request is a repair that merge
waits on, filed with the setup task, by the protocol's **Only what the
milestone chose is intake**.

Land once, only after all required proofs (proof 7 only when the document
gate is wired). The landed checks carry the setup version, so nothing is
committed after landing: check the target checkout, record the proof on the
setup task, and the installation is done.

Report first whether work can continue and through which skill; then what
changed for the user, what was cleaned (tasks by title), and each limitation
with its practical consequence. What was retained and the proof details go to
the setup task, summarized in one line. On failure leave the main line as it
was, keep the work on its branch and task, say what failed and never report the
project as reverified.

## Updating

Run this skill again when a skill reports the repository's installation is out
of date, that is, when the plugin's setup version is newer than the installed
checks'. When the plugin's is older, the person updates their plugin instead.
A plugin update that leaves the setup version alone needs no setup. Matching versions never skip a setup the user asked for, and
a rerun redoes only what the new setup version needs plus the proofs.

An update reconciles config, adapter statuses, commands, hooks and documents
like any other run. Keep earlier answers; put new settings into the recommended
profile instead of restarting an interview.

**What an update to this setup version changes, in the owner's terms.** Four
rules are new. The two backlog rules follow the gate's strength: under
`block-new` the state that already existed is printed as debt, and only new
work is refused — `orphaned-outcome`, a milestone outcome no stage serves, and
`unobservable-first-stage`, a feature's first stage that shows a person nothing
where the feature said they would see it. The other two are switches of their
own, and say so rather than promising a debt path they have not got: the commit
rule is off until the config declares `codePaths`, and a change record already
admitted for work in flight must gain the **Where it is seen** section before
its next gate run, so add it with the owner rather than letting the next
acceptance find it. Three things this run does, with the owner's agreement, so
nothing old is rewritten behind their back: give each outcome of the current
charter a stable id in front of its text, without changing that text; add the
`codePaths` list; and say which admitted change records of work in flight need
the new section.

**What an update to this setup version changes, in the owner's terms.** Nine
refusals are new, in three groups, and each is turned on by the value it reads
rather than by the upgrade itself, so a project that has not adopted one is not
stopped the day it arrives. *The build answers to its design*: a design record
lists its constraints in one closed section, each a requirement with a check, a
constraint that names a size is proved only by a check whose fixture declares at
least that size, and the review that admits a change answers whether the build
matched the design. *What the owner says reaches whoever does the work*: the
vision keeps his journeys and principles with stable ids, every milestone outcome
names in a `Serves:` line the ones it serves, a design names the principles of
its area and carries each as a constraint, and a different model's judgement
record answers at charter acceptance and design acceptance which of them the
document serves and which it breaks, with quotes, on the document's current
revision. *A forecast is computed, not written*: a date a charter or a feature
promises stands beside the record the run script computes over the exact task set
covering the outcomes it serves, and a record whose task set has changed is
refused. With the owner's agreement this run adds the ids to an existing vision
and charter without changing their text, records the principles he has already
stated in his own words, and puts the new switches into the recommended profile:
`requireDesignMatch` for the review's answer, and the constraints, principles,
fixture sizes and forecast records the adapter must carry. The run script's new
`forecast` command computes a record, and the gate's `--purpose <task>` prints
what a task serves, whom it serves and where a person sees it, for the brief
handed to whoever does the work.

**What an update to this setup version changes, in the owner's terms.** A
judgement record is now read from the document it judges. Each of its entries
names one of your journeys or principles by id and quotes a passage copied out of
the document — a clause, not a word, and not a description of one — and the gate
finds that passage in the same text the record is bound to, so a quote it cannot
find stops the record (`unknown-vision-id`, `unfound-quote`) and a document
edited since it was given stops it as before (`missing-judgement`). With your
agreement this run rewrites the judgement records a live charter or an admitted
change already carries; a record already in the new shape is left alone. The
vision's journeys now travel in the export beside its principles, since a
judgement may name either: an adapter reading the vision with the shipped reader
gets them, and one that builds the vision itself adds the list. A project with no
judgement record is not stopped.

**What an update to this setup version changes, in the owner's terms.** A piece
of work no longer stays open after the change that delivers it reaches the main
line. A bug or a task that waits for no stage — filed on its own, or hanging
directly under its feature — was a shape these skills file and then had nothing
that could close it: it could not be recorded as handed in, because that state
promises an acceptance, and no stage was going to accept it. It is now closed by
whoever merges its change, in that same step, with the merge revision and the
checks the merge ran. The gate gains one rule, `merged-but-open`: an open or
held item that a commit already on the main line names is reported with that
commit, so what is already in that state in your backlog surfaces by itself
instead of being offered to a worker a second time. The rule reads the main line
from the export, so this run adds that list to the adapter — the commits on the
main line at the revision the gate judges, parsed by the message convention the
commit check already uses, read here and never from the network. Until that list
is there the rule reports nothing; once it is, the next gate run lists what
landed and was never closed, and each is closed with its revision.

An update that brings the store out of the branches tells the owner the move
is coming and why, in their terms, and how it is done without losing a record:
snapshot the old state first; start the store; take what is written during the
move from both the old place and the store and reconcile it; settle or carry
work in flight; and remove the old export from the branches only after a proof
shows the store holds every record it held, naming any it does not. The agent
doc's end-of-session step follows the layout the integration records, over the
tracker's own generic advice.
