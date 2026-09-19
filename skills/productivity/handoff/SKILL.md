---
name: handoff
description: "Hand the current conversation and pending work to a fresh session, without committing by default. Use when the user asks to hand over or stop, or agrees to a proposed handoff."
argument-hint: "What will the next session be used for?"
---

# Handoff

The next agent knows only what you leave it. "Continue session X" is the worst
handoff: the transcript keeps every wrong turn next to the fix, with nothing to
tell them apart. Leave a short curated document instead: what is true now, what
to do first, and where everything else already lives.

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

## 2. Write the document, outside the repository

Save it in the harness's scratch directory, or else the system's temporary
directory, as `handoff-<what it is about>.md`. Never in the workspace: a
committed handoff becomes a stale instruction someone later follows.

Reference, do not copy. Anything already in a commit, issue, spec, decision
record or diff is named by path, hash or "Title" (id).

<handoff-template>

# Handoff: <what the next session is for>

## Do this first

The one next action, concrete enough to start without asking. Then the two or
three after it, if known.

## What is true now

What exists and **was verified in this session**, each with how: a command and
its result, a test, a file read. What was only reported, assumed or partly
checked goes in a separate list headed "not verified".

## Decisions

Decisions made, each with its reason in a clause, so they are not reopened.
Then the open ones and whose each is; the owner's stay the owner's.

Keep the user's role, accepted settings, named overrides and any permission to
use recommendations, with its limits, so the next agent does not ask again. For
open decisions, give a recommendation and its consequences.

## Traps

What cost time here and would again: the wrong turn that looked right, the
command that lies, the file that is not what its name says. One line each.

## Where things are

Commits by hash, issues as "Title" (id), files by path, uncommitted work by
where it sits. The source session's id and transcript path when the harness
keeps one, for looking up a detail, not for reading whole.

## Skills to reach for

Which skills the next agent should use, by name, and for what.

</handoff-template>

Leave out the story of the session, except where it is a trap.

**Remove** keys, passwords, tokens and personal data. The document may be
pasted anywhere.

Done when a stranger could take the first action from the document alone, and
every claim in "What is true now" names its evidence.

## 3. Pass it on

Print the document's path and, in a code block, **one sentence for the next
session**: read that file and do what it says. A pointer, never the whole
summary: long pastes get truncated or mangled.

If this harness can start a session with a prompt (a command-line flag, a new
terminal pane, a background agent), offer to start it with that sentence in the
work's directory. Start it only when the user agrees, and name it for what it
will do.
