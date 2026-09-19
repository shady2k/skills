---
name: report-to-shady2k
description: Report a problem with these skills, or an idea for them, as a GitHub issue, anonymized and shown word for word before it is sent.
argument-hint: "What went wrong, or what would you like?"
disable-model-invocation: true
---

# Report to shady2k

Turn what just happened with a skill of this set into an issue its author can
understand, reproduce and fix, at https://github.com/shady2k/skills. The
report describes the situation, not the project: no names, no data, no quotes.
Nothing leaves the machine until the user has read the exact text and said yes.

This works in any project, with or without setup, and changes nothing in it.

## 1. Understand what to report

Take the user's words and this conversation. Decide whether it is a **problem**
(a skill did something wrong, confusing or harmful) or an **idea** (something
the set should do). If the problem itself is unclear, ask one question; do not
interview. Find out yourself:

- which skill and which of its steps; the set's version (the plugin's installed
  version, or the `Protocol version` line beside the skill); the agent and its
  version;
- what the skill did, and what the user expected instead;
- the settings that shaped it, from the project's gate config where there is
  one: strength, development mode, workers, review, whether setup is verified.
  Name the kind of tracker ("an issue store kept in the repository"), not the
  product;
- the shape of the situation, enough to rebuild it with made-up data: "about
  900 open issues, most marked ready; features without a done criterion;
  dependencies attached to features instead of tasks";
- where in the skill's text the cause probably is, and what change would fix it.

## 2. Write the draft

Write in English, in plain words, to a file in the system's temporary directory,
never inside the project.

**Problem:**

```markdown
Title: <skill>: <what goes wrong, in a sentence>

## What happened
## What was expected
## Where
Skill and step, set version, agent and version, setup state.
## Settings that matter
## How to reproduce
The situation's shape with made-up data, then the steps.
## Where to fix (suggestion)
File and section of the skill, and the proposed change.
## Evidence (optional)
A short excerpt of the skill's own output, anonymized.
```

**Idea:**

```markdown
Title: Idea: <what should become possible>

## The problem it solves
## Why the current skills do not cover it
## Proposal
## What changes for the user
## Alternatives considered
```

**Leave out**, replacing with neutral words ("the project", "a feature task",
"a service"): names of the project, product, company, people, repositories,
branches and hosts; paths, URLs and addresses; issue numbers and titles from
the user's tracker (describe their kind instead); commit hashes; code or
document text from the project; credentials of any kind. Paraphrase the
conversation; do not quote the user. Quote only the skill's own output, and
only after removing the same things. Leave out anything the user asks to keep
out, even if it looks harmless.

## 3. Check the draft

From this skill's folder run:

```sh
node scan.mjs --draft <file> [--config <project gate config>]
```

It looks for the names this checkout and machine reveal (directory, remote,
git user, host), the project's own words from its gate config, emails, home
paths, foreign URLs, addresses, commit hashes and common secrets. Replace every
hit and run it again until it prints `clean`. A hit that is a generic word
identifying nothing may be kept with `--allow <word>`; say so to the user.
Without Node, search the draft for the same things yourself and tell the user
the automatic check did not run. Either way, read the draft once more: the
scan knows shapes, not meaning.

## 4. Look for the same report

With the GitHub CLI signed in, search open and closed issues of
`shady2k/skills` for the key words. If one describes the same thing, offer to
add a comment to it instead of a new issue; the comment goes through the same
draft, check and showing.

## 5. Show it and ask

Show the title and the body **word for word**, in one block, exactly as they
will be sent. Say plainly that the repository is public: what is sent is
indexed and stays, even if deleted later. Ask: send, change or cancel.

Any change means check again and show the new text again. Send only after an
explicit yes to the text shown last; an earlier "sure" or silence is not
consent. Cancel deletes the draft and sends nothing.

## 6. Send

With the GitHub CLI signed in: `gh issue create --repo shady2k/skills --title
<title> --body-file <file>` (or `gh issue comment` for an existing issue).
Otherwise give a link to a new issue with the title and body filled in, when it
is short enough for a link; for a longer one, give the text to copy and the
link to https://github.com/shady2k/skills/issues/new. Never send attachments or
screenshots.

Then give the user the issue's link and delete the draft file.
