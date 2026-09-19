---
name: handoff
description: "Hand the current conversation and pending work to a fresh session, without committing by default. Use when the user asks to hand over or stop, or agrees to a proposed handoff."
argument-hint: "What will the next session be used for?"
---

# Handoff

The next agent knows only what you leave it. "Continue session X" is the worst
handoff: the transcript keeps every wrong turn next to the fix, with nothing to
tell them apart. Leave it what it cannot find, where it will look.

**The state of the work is not handed over; it is kept.** Tasks, holds,
results, acceptance and what comes next live in the tracker and in version
control, where any session, checkout, machine or worker finds them. A handoff
keeps them true and adds only what exists nowhere else: what this conversation
learned. If a fresh session could not recover the work from those, that is a
defect to fix there and to report, not a gap to paper over with a document.

Never write a handoff into the workspace. A committed handoff becomes a stale
instruction someone later follows.

Talk in the user's language. Anything kept in the project is written in its
artifact language: the gate config's `artifactLanguage` where there is one;
otherwise ask once before the first thing is kept, recommending English.

If the user passed arguments, they say what the next session is for. Tailor
everything to that and leave the rest out.

For an exploratory conversation, keep its open questions, hypotheses and
disagreements. Do not invent decisions, tasks or an implementation step: the
user may just want to keep thinking. A backlog integration does not turn an
unrelated conversation into a cleanup task.

## 1. Settle what is in flight

Anything left half-done is a trap the next agent cannot see.

- **Uncommitted work:** list it (from version control's status), how ready it
  is and where it sits. By default hand it over uncommitted; do not ask about
  committing each piece. Say that another checkout will not see it and
  recommend a way to continue that keeps access. If the handoff really needs a
  commit or other new permission, ask once for that one action, with
  alternatives and consequences, in terms of the user's role (otherwise
  product engineer).
- **The backlog**, where the project's agent doc points at a backlog
  integration: use `close-out`. It closes only work whose stage was accepted,
  keeps agent results waiting to be merged or accepted, files findings, and
  returns unfinished tasks to the queue with a comment on where each stands.
  That comment is the handoff for work in an issue; point at it, do not repeat
  it. If `close-out` could not finish because the gate or tracker would not
  run, the document says which tasks were left taken and why.
- **Running things:** background commands, other agents, branches or worktrees
  you created. Say which still run and who collects them.
- **Stage acceptance:** keep where submitted results are, the base and merged
  revisions, merged tasks, local check results, open dependencies, and the full
  tests, mutation checks and review still to run. Name the next coordinator; do
  not offer already merged tasks as ready work. Independent workers may go on
  if their owner and how to collect them stay explicit.
- **Documents:** keep the proposal and baseline references, where verified
  receipts are, and whether current specs were synced and the change archived
  or published. A change already landed must not be applied twice; an
  unfinished sync must not look like closure.

Done when nothing the next agent needs exists only in this session's memory or
in an unnamed process.

## 2. Keep what only this conversation knows

Leave out the story of the session, and anything already in a commit, issue,
spec, decision record, decision log, pull request or diff: name it by path,
hash or "Title" (id) instead. What remains is the note.

**Where it goes:**

- **Work on a tracked feature**, where the project has a backlog integration:
  a comment on that feature, through the integration's comment operation,
  headed `Handoff` and dated. One note per feature the session touched, each
  about that feature. It is visible from every checkout, machine and worker,
  and it closes with the feature, so it cannot outlive what it describes. A
  newer note replaces an older one for the next agent; do not edit old ones.
- **Anything else** (an exploration, a conversation before setup, work with no
  feature): a file outside the repository that survives a restart, in the
  user's state directory: `~/.local/state/shady2k-skills/handoff/<project>/`,
  named `<date>-<what it is about>.md`. If the harness cannot write there, use
  its temporary directory and tell the user the note will not survive a
  restart or reach another machine.

**Lessons that outlive this work.** A trap belongs to the note; a lesson that
would cost time in other work too (a command that lies, a flaky test and its
cause, a step the build needs, a way the tools mislead) belongs in the
project's agent doc, which every agent reads. When the session met such
lessons, propose them to the user, one line each; when it met none, say
nothing, never ask "any lessons?" as a ritual. With their agreement, add them
where the session's tracked work can carry the change; otherwise put them in
the note under "Lessons for the agent doc", so the next session or
`close-out` lands them.

If the workspace already holds handoff files that were committed, do not add
to them. Name them to the user as stale instructions and recommend removing
them as tracked work.

Include only the sections with something to say; a note may be three lines.

<handoff-template>

# Handoff: <what the next session is for>, <date>

## Do this first

The one next action, concrete enough to start without asking, if it is not
already the tracker's next step. Then the two or three after it, if known.

## Not recorded elsewhere

What this session verified beyond what the tracker and the pull request say,
each with how: a command and its result, a test, a file read. What was only
reported, assumed or partly checked goes in a separate list headed "not
verified". Uncommitted work: where it sits and how ready it is.

## Decisions

Decisions made that no decision log or record holds yet, each with its reason
in a clause, so they are not reopened. Then the open ones and whose each is;
the owner's stay the owner's.

Keep the user's role, accepted settings, named overrides and any permission to
use recommendations, with its limits, so the next agent does not ask again. For
open decisions, give a recommendation and its consequences.

## Open threads

For an exploration: the questions, hypotheses and disagreements still open.

## Traps

What cost time here and would again: the wrong turn that looked right, the
command that lies, the file that is not what its name says. One line each.

## Where things are

What the next agent would not find by itself: a worktree, a running process
and who collects it, the source session's id and transcript path when the
harness keeps one, for looking up a detail, not for reading whole.

</handoff-template>

**Remove** keys, passwords, tokens and personal data. The note may be read by
anyone who sees the tracker.

Done when a fresh agent, starting from the tracker, version control and this
note, could take the next action without asking, and every verified claim
names its evidence.

## 3. Pass it on

Give the user, in a code block, **one sentence for the next session**. For
work on a tracked feature: continue that feature by name; the next agent gets
oriented with `ask-shady2k`, which reads the note. Otherwise: read the note at
its path and do what it says. A pointer, never the whole summary: long pastes
get truncated or mangled.

If this harness can start a session with a prompt (a command-line flag, a new
terminal pane, a background agent), offer to start it with that sentence in the
work's directory. Start it only when the user agrees, and name it for what it
will do.
