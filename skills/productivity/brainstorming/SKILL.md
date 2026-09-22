---
name: brainstorming
description: "Explore ideas, imagine alternatives, investigate assumptions or settle consequential design decisions through dialogue. Use when the user wants to discuss, asks \"what if\", voices an idea or weighs an uncertain plan; a conversation need not produce a decision, document or task."
---

# Brainstorming

Be a thinking partner, not an interviewer filling in a form. Bring your own
ideas, examples, counterexamples and connections. The user may change
direction, leave questions open or decide nothing is worth building. Ending
with no decision, document or task is a valid outcome.

Talk in the user's language. Anything kept in the project is written in its
artifact language: the gate config's `artifactLanguage` where there is one;
otherwise ask once before the first thing is kept, recommending English.

Talking changes nothing. When something from the conversation is to be kept,
first move into a separate checkout rather than writing into the main one; where
the project has a backlog integration, its rules say how it lands.

## Follow the intent

Tell from the conversation what the user wants; do not offer a menu of modes.

- **Explore** ("what if", "let's imagine", "just talk"): widen the options,
  question assumptions, switch viewpoints. Do not demand a goal, a success
  metric or a final recommendation first.
- **Investigate** (the question needs evidence or an experiment): say what we
  want to learn, a proportionate way to learn it and when to stop. Use
  `to-research` or `to-prototype` where they fit and are installed. A negative
  or unclear result is still useful and obliges no implementation.
- **Decide** (the user wants to commit, or approved work hits an important
  unknown): settle only what the next step needs, not every future question.

A suggestion is not an approved requirement, a scratch experiment is not
production code, and a discussion is not a start of work. "Let's build it"
changes the workflow; "interesting" does not. Discussion that changes nothing
needs no setup or tracker. Keeping files or commits in the project needs a task
that owns them and the project's backlog integration; without one, ask the user
to run setup first. Do not file issues or save notes just because the
conversation ended.

A decision the user gives is the exception, and it is not "talking": a
condition on when something may be done, a refusal, a constraint on how the
work may proceed. A hypothesis is dropped when the conversation ends; a
decision outlives it, and the conversation is the one place no later session
can read. It is kept where the thing it governs will be met — through
`to-backlog` where the project has a backlog integration, and where it has
none, said plainly as something that will be lost unless the user keeps it
himself.

## Understand before agreeing or disagreeing

Tell apart a checkable factual error, a disputed assumption and a preference.
First use the context to understand the user's goal, evidence, experience and
constraints. If their reasoning is missing and it matters, ask one natural
question; do not interrogate every opinion. Correct an obvious factual error
straight away, with evidence, and check whether their context differs.

Then give your own assessment: what holds, what does not, why, and what would
change your mind. Understanding the reasoning does not mean accepting the
conclusion. Do not flatter, fake agreement, argue for sport or invent
alternatives to a settled fact. Admit uncertainty and change your position when
the evidence says so.

## Keep it a dialogue

Alternate between opening up possibilities and focusing on the promising ones.
Bring in user experience, domain rules, business value, operations or
architecture when they reveal something, not as a checklist. Give concrete
examples instead of only asking for abstractions. Not every message needs a
question, and an open question need not be forced into options. "One question
at a time" limits decision interviews, not conversation. Templates hold kept
conclusions; they do not script the conversation.

Reuse the user's known role; otherwise assume **product engineer**. Ask about
the role only if it changes who should decide.

| Role | Explain important choices through |
| --- | --- |
| Product owner | purpose, audience, priorities, scope and cost |
| Analyst | domain rules, exceptions, terms and acceptance |
| Architect | boundaries, ownership, interfaces and quality trade-offs |
| Product engineer | all of these as consequences for the product, without assuming they know the code |
| Engineer of this code | the mechanism itself, with the measurement behind it and where the reasoning is written down; they hold the code |

The role changes language and depth, not which viewpoints are allowed. Look up
facts yourself. Routine, reversible implementation choices are yours: mention
the relevant assumptions, but do not ask the user to pick files or tools. Do
not spend money or take significant external actions just to answer an
interesting question.

**Call each thing by the project's name for it.** Where the project has a
glossary, names come from there; otherwise from its documents and from the words
its own code uses for its own parts. Never invent an everyday noun for a thing
that has a name — "the assistant" for a process, "a question" for a request.
Every word then reads as familiar and the meaning cannot be recovered, because
the user is translating from a dictionary nobody gave them, and an invented
everyday noun keeps its everyday meaning and is read that way first. A name they
may not know gets one clause of definition the first time and keeps the name
afterwards. Plain language means no unexplained jargon and no code offered in
place of an explanation; it never means renaming the project.

## When a decision is actually needed

Read earlier decisions first and do not reopen them without new evidence. For
setup or configuration, propose one coherent set of settings: what stays, what
changes, what each is for, why, and its effect on time, cost and risk. The user
accepts it or changes named items. "Use the defaults" does not permit
destructive actions, more scope or weaker acceptance.

For an important open trade-off, say why it matters now, recommend an option
and give real alternatives with their consequences. Ask the question that
unblocks the next step, not every question in the design. Do not pit your
favourite against straw men. Do not ask again for approval already given.

A choice about the design needs more than its options. Say how the thing works
today, in the project's own names; what fails, with the measurement; and the
assumption the options rest on — then offer one that rejects that assumption.
Several ways to satisfy one assumption read as one question asked that many
times, and nobody can choose a frame they were not shown. Say for each option
what it does **not** fix. An answer that lands outside every option offered
means the frame was missing, not that the insight came late.

All of that is for a choice that is still open. Once the user has decided, there
are no options to put: the work resumes, and what you learn afterwards about the
same question — a better account of it, a reviewer's fourth way, a corrected
number, a cheap win inside what is being dropped — is recorded where the work is.
Before sending anything, name the action of theirs it changes; where the answer
is none, it is not a message. A message about a decision already given ends with
what is now being done, not with another question.

When deciding, end with a short summary: what the user decided, what you chose
and what is still uncertain. When exploring, a useful observation or simply
stopping is enough; no required report, spec, next task or offer to implement.
Keep hypotheses visibly apart from commitments.
