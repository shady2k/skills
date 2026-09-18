---
name: handoff
description: Hand the current conversation and pending stage acceptance to a fresh session, without committing by default.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

# Handoff

The next agent starts with nothing but what you leave it, and the cheapest
thing to leave, "continue session X", is the worst: a whole transcript carries
every wrong turn as faithfully as the fix, with nothing to tell them apart. A
handoff is the **curated** version: what is true now, what to do first, and
where everything else already lives.

If the user passed arguments, they say what the next session is for. Tailor
everything below to that and leave the rest out.

## 1. Settle what is in flight

Anything left half-done is a trap the next agent cannot see.

- **Uncommitted work.** List it (the version control's own status). For each
  piece say whether it is finished, and ask the user whether to commit it now
  or hand it over as it is. A fresh session in another checkout or worktree
  will not see it at all, so say where it sits.
- **The backlog**, if this project's agent doc points at a backlog
  integration: use "close-out". It closes only work covered by stage acceptance,
  preserves submitted results and implemented work awaiting acceptance, files findings and releases
  unfinished holds with a comment on
  where it stands. That comment is the handoff for work that lives in an
  issue; do not repeat it in the document, point at it. If it could not
  finish, because the gate or the tracker would not run, the document says
  which holds were left and why: optional does not mean silent.
- **Running things**: background commands, other agents, open branches or
  worktrees you created. Say which are still running and who is to collect them.
- **Stage acceptance:** retain submitted result locations, base and assembled revisions, integrated
  tasks, local check evidence, pending dependencies and remaining full tests,
  mutations and review. Name the next coordinator; do not reassign already
  implemented tasks as ready work. Independent workers may continue if their
  owner and collection path remain explicit.

Done when nothing the next agent needs exists only in this session's memory or
in an unnamed process.

## 2. Write the document, outside the repository

Save it to the harness's scratch directory if it has one, otherwise to the
operating system's temporary directory, as `handoff-<what it is about>.md`.
Never inside the workspace: a handoff is for one reader, once, and a committed
one becomes a stale instruction that the agent after next will follow.

Reference, do not restate. Whatever already lives in a commit, an issue, a
spec, an ADR or a diff is named by path, hash or "Title" (id), and not copied.

<handoff-template>

# Handoff: <what the next session is for>

## Do this first

The one next action, concrete enough to start without asking. Then the two or
three after it, if they are known.

## What is true now

What exists and **was verified in this session**, each with how: a command and
its result, a test, a file read. Keep what was only reported, assumed or
half-checked in a separate list under the words "not verified".

## Decisions

Made, with the reason in a clause, so they are not re-opened. Then the ones
still open, and whose each is: the owner's are named as the owner's, never
quietly decided here.

## Traps

What cost time here and would again: the wrong turn that looked right, the
command that lies, the file that is not what its name says. One line each. This
is the part no other artifact holds.

## Where things are

Commits by hash, issues as "Title" (id), files by path, uncommitted work by
where it sits. The source session's id, and its transcript's path when the
harness keeps one: for digging out a detail, not for reading whole.

## Skills to reach for

Which skills the next agent should call, by name, and for what.

</handoff-template>

Leave out the story of the session. The next agent needs the state, not how you
got there, except where how you got there is a trap.

**Redact** keys, passwords, tokens and personal data. The document leaves this
session's permissions behind and may be pasted anywhere.

Done when a stranger could take the first action from the document alone, and
every claim in "What is true now" names its evidence.

## 3. Pass it on

Print the document's path and, in a code block, the **first sentence for the
next session**: one line telling it to read that file and do what it says. A
pointer, never the whole summary: a long paste into a prompt is where text
gets truncated or mangled.

Then, if this harness can start a session seeded with a prompt (a command-line
flag, a new pane in a terminal multiplexer, a background agent), offer to start
it with that sentence, in the directory the work is in. Start it only when the
user says so, and name it for what it will do.
