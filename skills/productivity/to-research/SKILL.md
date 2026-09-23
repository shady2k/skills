---
name: to-research
description: "Investigate a bounded question using primary sources. Use when planning or take-task needs evidence for a decision, or the user asks for research; delegate independent reading when available."
---

# To research

Reading does not need this conversation's attention. Hand it to a **background
agent** where the harness has one and keep working; where it has none, say so
and read here.

Talk and keep things by the protocol's [**Language**](references/speaking.md).

Write the brief yourself from the request and earlier decisions. Recommend a
scope and effort, with the expected benefit and limits; do not ask the user to
pick sources, file paths or routine settings. Speak to the role the protocol's
**Speaking to the owner** assumes, and say which decision the evidence will
support. Ask only about a missing requirement or a real cost; "use
recommendations" does not permit paid access or more scope.

The brief:

1. **The question**, in one sentence, and what we hope to learn. Exploratory
   research needs no decision made in advance.
2. **Primary sources only:** official documentation, source code,
   specifications, first-party APIs. An article about them is a lead, not a
   source; trace each claim back to whoever owns it.
3. **A cited answer**, stating what could **not** be established as plainly as
   what could. It stays in the conversation unless the user wants it kept; a
   note file is optional.
4. **Where notes are kept:** the project's existing places, or the exploration
   template its integration provides. No new competing knowledge store.
5. **When to stop and how much to spend:** what evidence would settle it, how
   much digging is justified, and how an unresolved result is reported.

Keeping a note or committing it needs its owning task; without a backlog
integration, research stays read-only or in scratch space and asks for setup.
An unavailable source is a limitation, not a citation. Independent questions
can be researched in parallel without holding up the rest of the design.

When the answer comes back, check it before relying on it: a citation is a
claim about a source, so open the ones a decision rests on. The result feeds
the thinking, usually `brainstorming`; it does not replace it or require
`to-spec`. "No", "unclear" and "not worth pursuing" are valid results. Do not
create a task, document or offer to implement automatically.
