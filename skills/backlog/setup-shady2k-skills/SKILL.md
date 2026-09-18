---
name: setup-shady2k-skills
description: Configure this project for shady2k-skills by installing the backlog gate — its config, its tracker adapter, its wiring — and proving all three. Run once before first use of the other skills in the set.
disable-model-invocation: true
---

# Setup shady2k-skills

A backlog stops being a queue quietly: issues accumulate until "what do I work
on next" has hundreds of answers, which is none. Skills cannot prevent that,
because a skill is advice. **The gate is what binds**, and this skill installs
it.

Four pieces, and only the first ships here:

| piece       | what it is                                                     | lives                  |
| ----------- | -------------------------------------------------------------- | ---------------------- |
| the rules   | [`check.mjs`](check.mjs) over the backlog of [`model.md`](model.md) | here, identical everywhere |
| the config  | this project's vocabulary, milestone, thresholds, strength     | the project            |
| the adapter | this project's tracker → the normalized backlog                | the project            |
| the wiring  | the hook and the CI step that run the three above              | the project            |

You write the last three, for the environment you find. This is a prompt-driven
skill, not a deterministic script: explore, present, ask, write — and then
**prove**, because a generated gate that passes everything does not merely fail
to catch, it certifies.

## 1. Explore

Read, don't assume:

- **The tracker.** The project's agent docs (`AGENTS.md`, `CLAUDE.md`, a tracker
  doc they point at) and the tracker's own skill or `--help`. You need: how to
  list every issue with status, type, labels, parent and blocking edges; how it
  tells a blocking edge from a provenance one; whether an export is tracked in
  version control.
- **The labels actually in the tree**, counted, beside any list the docs
  declare. They differ more often than not.
- **The milestones**: a native field, a label convention, or nothing yet.
- **Where gates already live**: a hooks directory, a pre-commit framework, the CI
  config. The gate goes where this project's other gates are.
- **The runtime.** `check.mjs` needs Node and nothing else. No Node means
  porting it — see step 3.
- **The tracker's own doc or skill**: whatever already tells an agent how this
  tracker is driven. The set adds a section to it and never a rival to it.
- **Which agent docs each harness loads here**: `AGENTS.md`, `CLAUDE.md`, one
  importing the other, or both standing alone. The pointer of step 3 has to
  reach a session in every harness the project is worked from.
- **A prior install**: a "Backlog integration" section, the gate's config, or,
  from before 0.5, a `docs/agents/backlog.md`. Any of them means you are
  changing an installation, not making one: read it first, then go to
  "Updating" below. None here, look in the other worktrees and branches before
  concluding there is none: an install that was written and never landed is
  invisible from this checkout, and the answer to it is step 6, not a second
  install.

## 2. Present and ask

Say what you found, then take the sections in order — one section, one answer,
then the next. Lead with the recommended answer so it can be accepted in a word.
A, B and D are each asked alone: they are the three that change what the gate
does, and an answer given in a batch is an answer nobody weighed.

**A. Vocabulary.** Show declared against in-tree. Recommend the declared list
plus whatever in-tree labels carry live work; the rest is what
`label-vocabulary` will report. No labels anywhere: recommend areas from the
project's top-level layout, its modules or its services. Exactly one **area**
label per issue is a rule, so say which labels are areas (`areaLabels`) and
which are other axes the project already uses (`roadmapLabels`,
`triageLabels`). Show the three thresholds with their defaults and let them
stand unless the owner objects: `staleDays` 14, `holdDays` 2, `bulkCluster` 20.

**B. The current milestone**, and the labels of the others. None yet? Recommend
declaring one now, named for what ships in it: without a current milestone
there is no horizon, and the horizon is what keeps next quarter out of today's
queue.

**C. The two lanes outside the flow**: the label that marks an **idea** (ideas
stay deferred, block nothing, and are closed without regret), and the label
that marks a **finding**, a bug or a piece of debt found mid-milestone. The
finding budget itself is the charter's number and `/to-milestone` sets it; a
project with a milestone already running is asked for it now.

**D. Strength. Always ask this one, with the price of each** — a setting nobody
was asked about is one everybody has without knowing they chose it.

- `block-new` (**recommended**): fails only a violation this change introduced.
  Old debt is printed every time and fails nothing. Costs: needs the backlog in
  version control, for a baseline to compare against.
- `block`: any error-severity violation fails. Honest on a clean backlog; on an
  existing one it is red on day one, and a gate that is always red teaches
  `--no-verify`.
- `report`: fails nothing, prints always. The cheapest, and the one that decays:
  nothing forces anybody to read it.

**E. Where it runs**: which hook, which CI job. Recommend both the fast local
gate and CI — local alone is skippable, CI alone reports after the fact.

**F. Documents and evidence.** Where the vision lives and where milestone
charters go (recommend what exists, else `docs/vision.md` and
`docs/milestones/`); where an outcome's spec lives (recommend the body of its
feature issue, unless the project already keeps specs as files); where the
glossary and the decision records are, if it keeps any; and **what may be
cited when closing work**. Recommend by
the kind of backlog: for development a commit, a test, a file or symbol; for
operations a runbook that ran, an alert that fired in a drill, a dashboard
showing a value.

## 3. Write

**Where other agents commit into this checkout, install on a branch in a
worktree of your own.** Proving the hook means staging files, and a staged file
belongs to whoever commits next: in a shared checkout another session's commit
swept a half-proved gate onto the main branch under its own unrelated message.

**The config** — one JSON file, beside the project's other gate files:

```json
{
  "strength": "block-new",
  "currentMilestone": "<label>",
  "milestoneLabels": ["<every milestone label, current included>"],
  "areaLabels": ["<exactly one of these per issue>"],
  "roadmapLabels": [], "triageLabels": [], "ideaLabels": ["idea"],
  "ideaTitlePrefixes": [],
  "findingLabels": ["finding"], "findingBudget": null,
  "staleDays": 14, "holdDays": 2, "bulkCluster": 20,
  "projectWords": ["<the project's own names>"],
  "trackerWords": ["<the tracker's names>"]
}
```

`findingBudget` stays `null`, which switches its check off, until a charter
sets it: a number nobody chose is worse than none. `currentMilestone` may be
`null` the same way on a project that has not declared one; the horizon check
waits for it.

**The adapter** — a script printing [`model.md`](model.md)'s shape on stdout.
Read everything under "What an adapter must get right" there before writing a
line: `blockedBy` carries gating edges only, `updatedAt` is copied and never
improved, a native milestone becomes a label, closed issues are emitted. Emit
the optional `holder` and `createdAt` wherever the tracker can say them: the
first turns "nobody holds this" from an inference into a fact, the second
decides which findings are the ones over budget. It **must be able to read an
earlier revision** (`--at <rev>` or the
tracker's equivalent): that is where a baseline comes from, and the only honest
source of ages after a bulk edit has rewritten every timestamp.

**The rules.** If this skill sits inside the project's tree, the wiring calls
`check.mjs` in place. Otherwise copy it **verbatim** next to the adapter and
never edit the copy, not even to say where it came from: its first line is the
line that makes it runnable, and a copy that differs by one byte can no longer
be compared with its source. Where it came from goes in the project's backlog
doc. It knows its own version: `check.mjs --version`. No Node:
port it to what the project has, and then step 4a is not optional colour but
the only evidence the port is the same rules.

**The wiring** — for `block-new`, in whatever the project's hooks are written in:

```
adapter --at <last committed revision>             > baseline.json
<the config as of that same revision>              > baseline-config.json
adapter | check --config <config> --baseline baseline.json \
                --baseline-config baseline-config.json -
```

In CI the baseline is the **merge-base for a pull request and the previous head
for a push**. The merge-base of a branch with itself is its own head: the
baseline then equals the backlog, nothing is ever new, and the job is green for
ever.

The baseline is judged by the config of its own day. Without that, lowering a
budget or renaming the current milestone creates violations that look like old
debt, and `block-new` waves them through.

Exit 1 fails the hook; exit 2 is misuse and must fail it too, loudly — a gate
that cannot run is red, not green. For `report`, print the output and ignore
exit 1 only.

**The backlog integration** — a section, not a file of the set's own, and the
only thing the other skills know about this project. It goes into the doc that
already says how this tracker is driven; where there is none, create
`docs/agents/issue-tracker.md` and put it there. Copy the seed
[`integration.md`](integration.md) and fill every `<placeholder>` with what you
found and what was answered. [The protocol](protocol.md) is not copied: it ships
with the skills and updates with them, and a project's copy would only go
stale. Values the gate's config holds are not copied either.

Its **tracker operations** table is the adapter's counterpart for writes, and
it does not say twice what the project already says once: a row points at the
tracker's own doc or skill where that covers it, and adds only what the
protocol needs on top. Fill the rest from the tracker's own skill or `--help`.
**Run every verb that only reads** (ready, holds, children, search, show),
whether the command is yours or one the project's doc already had: reading
leaves no mark, so none of them goes in untried, and a command written from
memory is how a flag of one subcommand ends up on another. Check that it
answers the question the table asks and not a neighbouring one: children means
every child in every status, which a listing of ready children is not, and
closing a parent is decided on exactly that difference. A verb that writes is
tried where it can be undone and otherwise checked against its own `--help`.
Where the tracker cannot do one, write what stands in.

**The pointer** — a few lines in the project's agent doc, the only part of the
set a session always has in context, so it is what routes a bug when no skill
has fired:

```markdown
## Backlog

Every bug, idea or piece of debt is filed through `/to-backlog`, and work that
is finished or dropped goes through `/close-out`. Before touching the backlog,
read "Backlog integration" in <path>: the gate, how the tracker is driven, where
the vision and the charters are.
```

It carries no value that changes (no milestone, no budget, no counts) and no
command: a summary that can be acted on is a pointer nobody follows. Put it
where **every harness the project is worked from** will load it: the one agent
doc when the other imports it, both when each stands alone. Another set's
block in that doc is left as it is, and this one is kept outside it, where that
set's installer will not rewrite it.

## 4. Prove

Three proofs, each shown as its table — not "I wired it in".

**a. The rules.** `check.mjs --selftest --config <config>`, run on the
`check.mjs` beside this file: the fixtures live here and are not copied, so the
project's copy cannot test itself. Every rule's fixture must fire exactly the
checks it declares, the clean backlogs nothing, the three strengths their
verdicts, and no file here may contain a `projectWords` or `trackerWords`
entry. Then show that the project's copy is byte for byte the one that passed.
A port has no such shortcut: it runs the fixture corpus itself.

**b. The adapter, against the tracker's own numbers.** Fixtures cannot see an
adapter, so count: issues per status from the adapter beside the tracker's own
counts; and the ids the tracker calls ready beside the model's
open-and-unblocked-by-anything-live. Explain every difference or fix the
adapter. A provenance edge read as a blocker shows up exactly here. An empty
tracker proves nothing this way: create one throwaway issue per status, one
blocking edge and one provenance edge, run the comparison, then remove them by
whatever the tracker allows: delete, or close with a reason naming this proof.

**c. The wiring, through the real entry point.** Plant one error-severity
violation in the backlog (an idea left open is the cheapest), run the actual
hook — not the command inside it — and watch it go red. Undo it (defer the idea,
or remove it as in 4b), watch it go green. Under `report`, watch the violation get printed.

## 5. The first report

All checks but one are errors. `stale-edge` is a warning, because it measures
the blocker's age and not the edge's: few trackers date an edge.

Run the gate on the live backlog and show it. **Do not fix anything**: a large
first report is a grooming job with its own decisions, not a setup step, and
under `block-new` it blocks nobody. Two lines of it need saying out loud:

- **`AGES MAY BE CONTAMINATED`** — many issues share one minute, so a bulk edit
  rewrote their timestamps and every age-based check is reading the edit, not
  the work. Run the adapter against a revision from before it and pass the
  result as `--ages-from`.
- A violation somebody can defend is closed by **amending the config**, never by
  editing the backlog to please a script.

## 6. Land it

**The set is installed when it works in the checkout people work from**, and
not a minute before: the files are on that branch, the line in the agent doc is
there, and the gate runs from there. Every other skill looks in the checkout it
runs in: an install left on a branch is, for all of them, no install, and the
next session is told to run this skill again.

So the report of step 5 ends with the question, not with "installed": land what
was written the way this project lands work (a commit and a merge, or its pull
request), and install the hooks in the clone people use. What the owner has not
already allowed is asked for in the same message, by name, and done on a yes.
Until then say, in these words, that the set is **written and proved, not
installed**, and where it lies. After landing, run the gate once from the
target checkout: a merged file does not prove a hook was installed.

A worktree shares its hooks directory with the clone it came from, so a hook
proved in step 4c is already running against the main branch, whose tree has no
gate yet. The hook lets through only a tree that **never had** the gate, and
says so; a tree that has the config and cannot run the gate is broken, and
stays red like any other exit 2. "No gate here" as a blanket pass is a bypass
that outlives the install.

Then tell the user the set is installed, and that `/ask-shady2k` answers what
to do next from here on.

## Updating

The project's copy of `check.mjs` does not update with the set; it is a file in
the project. After the set is updated, compare `--version` of the project's
copy with `--version` of the one beside this file. If they differ: copy `check.mjs` again, verbatim; read `model.md`
for fields the adapter could now emit and flags the wiring could now pass; then
run proofs 4a and 4c again and show the first report again. A newer set may
turn warnings into errors, so the report can grow; under `block-new` that is
old debt and blocks nobody. Ask nothing that was already answered unless the
user wants it changed. An update lands the same way an install does: step 6.

**An install from before 0.5** has a `docs/agents/backlog.md` of its own: the
protocol copied in, the project's facts, the gate and a verbs table. It keeps
working, since the agent doc points at it and the skills follow the pointer,
but its protocol is a copy that no update reaches. Move it: the project's facts
and the gate into a "Backlog integration" section as in step 3, each verb
checked against the tracker's own doc and kept only where that doc is silent,
the copied protocol dropped, the pointer in the agent doc rewritten, the old
file removed. One commit, so that no revision has two documents disagreeing.
Where another harness still runs an older set against this project, say so and
leave the old file until that one is updated too.
