---
name: ask-shady2k
description: "Get oriented in the project, read-only: its picture, progress, where it stands and the ways forward with their consequences and rough durations. Use when the user asks where the project stands or what to do next, or comes back after a break; when they agree to a recommended action, start that skill."
---

# Ask shady2k

Give the owner what they need to decide what to do next: what the product is,
how far it has come, where it stands, and which ways forward exist with what
each costs and postpones. Then recommend one by name.

**Read-only** until the user asks for an action. When they agree to a
recommended action or ask for one, start that skill yourself and carry their
words into it; never tell them to run a command and repeat a phrase.

Change no files, tracker items, holds, branches or config, and
commit nothing. Reading the tracker and running the gate's report are reads.
Run a project check only if it is documented as side-effect-free; otherwise
report it as not run. Anything that needs a write is named as the skill that
would do it.

## 1. Choose the depth from the request

Do not make the user pick a mode.

- **"What next?"** from someone in the flow: the few facts behind one action,
  then the action.
- **Orientation** (back after a break, a new or unfamiliar project, "where are
  we", "what are our options"): the full picture of sections 3 and 4.
- **Free discussion**: `brainstorming`, with no setup or tracker needed.
  Evidence-only questions: `to-research`. Thinking commits to nothing.

## 2. Collect evidence

**Always:** README and agent doc; vision, roadmap, charters, current specs,
glossary and decision records where they exist; the shape of the code, its
checks and CI; git history, branches, worktrees and uncommitted changes. Git
history is progress evidence too. Handoff notes for this project in
`~/.local/state/shady2k-skills/handoff/<project>/`, newest first: what an
earlier session learned, to weigh against current evidence, not to obey.

**Where the project has a backlog integration** (its agent doc points to it):
read [`protocol.md`](protocol.md) and do its compatibility check. Run the gate
from this checkout. If it fails, name the real cause: an installation not yet
landed (check other worktrees), a missing runtime, a tracker outage or broken
wiring. Collect the gate's report, config, charter, outcomes, holds, submitted
and implemented tasks, stage acceptance records, the newest `Handoff` comment
on each feature in flight, and the tasks that can start now, using the
integration's stage- and checkout-aware operation. Where runs were recorded,
the run journal's `report` and `pace` ([`runs.mjs`](runs.mjs), run with `node`
from this skill's folder): how past runs went and how long work really takes
here. Where the owner asks where the project's hours go rather than how one run
went, the ledger beside it ([`ledger.mjs`](ledger.mjs)) answers over the whole
project and not only over runs: `time` splits each session's clock into the
model's, the tools', the waiting inside the agents' turns, the owner answering,
the owner away and nobody's, which add up to it, names what the agents were
doing and under which phase of the work where a record shows one, and says
which figures some sessions did not record (a harness that keeps no cost has
an unknown cost, not a free one); `sessions` lists what ran, including the
workers' own working copies and subagents, and how many were working at once. The journal is this machine's; where it is thin or missing, the
`Run measured` comments on closed features carry the same numbers from wherever
those runs happened. Its `stalled` names runs that recorded no end and
passed the time their result was promised for: report each with what it last did and when, next to the
hold it left on the work, and offer taking it over or ending its record. A run
still inside its forecast is not a reason to hold the owner: say when its result
is due and offer what their presence is worth now — a decision waiting, the next
feature to plan, something to think through — worked, by the protocol's
[**Come with the material**](references/deciding.md) and [**The owner's time is
the scarce one**](references/running.md). What waits on the owner, and whether
to ask about their time, follows **The session opens with the picture**. Tell
an owner actively running acceptance from abandoned work.

**Without an integration, or with an outdated one:** say so and continue from
the repository. Mark what you cannot know without it, such as task states and
acceptance; do not guess. Do not replace an unreachable tracker.

## 3. Build the picture

Include only sections with something to say. Speak in product terms: what a
user can do, not which files changed. Separate facts, inferences and unknowns,
with the evidence for each.

- **Product:** what it is for and for whom; what users can already do; how far
  it is from the vision.
- **Progress:** the milestone's outcomes as accepted, in work, not started or
  stalled; what recent work changed for users; the pace, where history shows it.
  Where runs were recorded, how they went in the owner's terms: how many were
  taken as they were, how often the owner had to step in, and how much of
  their time a feature cost.
- **Now:** work in progress, what waits for merging or acceptance, decisions
  filed for the owner and waiting on them (each by title, with the agent's
  recommendation), abandoned
  work, stranded branches or uncommitted results, and each real blocker with
  what would release it.
- **Health and risk:** failing, missing or unrun checks; specs or docs out of
  step with the code; handoff files committed to the repository, which read as
  instructions long after they stopped being true; deferred findings piling up; setup out of date. Say what
  each risks for the product.
- **Beyond the horizon:** deferred work and ideas worth a thought, marked as
  hypotheses. They are not tasks and do not widen the milestone.

## 4. Ways forward

**Ready is not a reason.** Before a leaf reaches the recommendation, check that
its result is still wanted, by the protocol's **Ready is not worth doing** and
**What would replace the ground is read before anything is built on it**: where
such work is open, the ground is settled first and the leaf waits, however
ready it is.

The recommendation is the first row below that applies; its order makes you
settle the ground and finish what is open before you start anything new. Then
give two or three real alternatives, each with what it achieves, what it
unblocks and what waits on it, how long it will roughly take in agent time and
what that rests on (the protocol's **Estimates**), its budget, what it
postpones, its risk and whether it can be undone. A way forward whose whole cost
is half an hour of the owner's attention and whose result is that the rest can
proceed is reported as that, not as time spent instead of writing code. Include
stopping (`/handoff`) when that is a real option. An alternative outside the
current milestone is labelled a scope change and goes to `/to-milestone` or
`to-backlog`; an open idea goes to `brainstorming`. Do not invent work to fill
the list.

| condition | next action |
| --- | --- |
| an empty folder: no code, no documents, perhaps not even an idea | the path in the protocol's [**Starting from nothing**](references/starting.md), from its first step: `brainstorming` to find the idea; setup only once something is to be kept |
| no tracker or integration, or setup missing or outdated | `/setup-shady2k-skills` before managed work, saying what is missing; still give the picture |
| the person's plugin is older than the repository's installation | update the plugin, not setup, which would roll the installation back |
| checks cannot run | the specific repair through setup; land a stranded installation if that is the cause |
| no current slice but live work exists | `groom-backlog` to agree and clean the slice (setup does this on first install) |
| no milestone, or no charter | `/to-milestone` |
| work marked as taken but abandoned | return it to the queue, keeping implemented results |
| new gate errors | their concrete fixes; `groom-backlog` for a broad cleanup |
| results await merging or acceptance | resume that stage with `/take-task`; do not redo its tasks |
| accepted work awaits closure | `close-out` with the acceptance record |
| all current outcomes accepted | `/to-milestone` |
| new product without direction or first charter | `/to-milestone`, drafted from known decisions |
| an open decision holds the ground the rest of the milestone stands on | that decision, worked, while the owner is here: `brainstorming`, or `to-spec` where its answer is a contract |
| a change is not ready by the document check | the concrete gap: missing contract, stale base or open decision; `to-spec` |
| an outcome needs design or breaking down | `/take-task` picks the route, or `to-spec` for design only |
| a planned feature is ready | `/take-task` to run the whole feature to one pull request, if its run fits how long the project lets a branch live; otherwise split it first; mention what can run in parallel |
| a feature is not yet planned enough to run alone | plan it with the owner (`brainstorming`, `to-spec`, `to-stages`), ending in `/take-task`'s preflight |
| everything left is blocked or held | the result or owner that would unblock it; do not widen the milestone or invent work |

If someone is already running a stage's acceptance, recommend other ready work
rather than duplicating it. A blocker in one stage does not block unrelated
stages or features.

The request itself can pick a helper: something new arriving is `to-backlog`, a
diagnosis is `diagnose-bug`, an open product decision is `brainstorming`,
gathering evidence is `to-research` or `to-prototype`, and a complaint about
these skills themselves is `/report-to-shady2k`.

## 5. Report

Follow the protocol's [**Speaking to the owner**](references/speaking.md),
with or without an integration: plain words, tasks by title, numbers with their
meaning. Open with one or two sentences on where the project stands. Then the picture, compact,
then the ways forward, recommendation first, as consequences for the product:
scope, time, cost, risk. Where a decision the remaining work rests on is open
and the owner is here, it leads the ways forward instead of closing the message,
by the protocol's **The session opens with the picture**. End with the
recommended action and, only if there is one, the single decision it needs. Do not ask about each finding, and do not
start the recommended action.

**A correction he gives is a write, not just a better answer.** When he answers
the picture with a condition, a refusal or a constraint the record does not
hold — "I will not do that until X", "we decided against Y", "I told you this
already" — say what is missing and where it belongs. This skill writes nothing
itself; the write that keeps it is `to-backlog`'s, done first once he agrees to
any action, by the protocol's **A decision the owner gives is kept, not only
obeyed**.

## Routes

- `setup-shady2k-skills`: choose or check the tracker, clean its queue, agree a
  recommended profile, prove the installation; rerun after updates.
- `to-milestone`: agree outcomes, scope and budget.
- `take-task`: preflight with the owner, then run a whole feature alone to one
  pull request, stopping only for decisions that need the owner.
- `brainstorming`: explore, investigate or decide in conversation; no required
  result.
- `to-spec`: a short or full change to the living specs, with scenarios.
- `to-stages`: stages as checkpoints, tasks sized for one worker, real
  dependencies and parallel tasks.
- `diagnose-bug`: find a cause with evidence; fixing needs a tracked task.
- `to-prototype`: a bounded runnable experiment.
- `to-research`: a bounded investigation of primary sources, with citations.
- `model-domain`: domain terms, the names of the system's own parts, and
  records of consequential decisions.
- `to-backlog`: file new work and findings in the right lane, and keep a
  condition the owner put on work that already exists.
- `close-out`: update current specs from accepted work, then close; keep
  pending work.
- `groom-backlog`: snapshot, agree the slice, clean up reversibly, verify.
- `handoff`: keep the work's state true and leave what only this conversation
  knows where the next session will look.
- `report-to-shady2k`: a skill of this set misbehaved or lacks something; send
  its author an anonymized issue after the user reads it word for word.
