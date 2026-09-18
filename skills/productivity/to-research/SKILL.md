---
name: to-research
description: Hand a question to a background agent that reads the primary sources and leaves a cited note in the repository, while this conversation carries on.
disable-model-invocation: true
---

# To research

Reading is legwork, and it does not need this conversation's attention. Start a
**background agent** where the harness has one, and keep working; where it has
none, say so and do the reading here.

Its brief:

1. **The question**, as one sentence, and what decision hangs on the answer.
2. **Primary sources only**: the official documentation, the source code, the
   specification, the first-party API. A write-up about them is a lead, not a
   source; follow every claim back to whoever owns it.
3. **One Markdown file**, every claim beside its source, and what could **not**
   be established said as plainly as what could.
4. **Where notes already live** in this repository; if nowhere, somewhere
   sensible, and say where.

When it comes back, read the note before relying on it: a citation is a claim
about a source, and the ones a decision rests on are worth opening. The note
feeds the thinking, usually `/brainstorming` or `/to-spec`; it does not
replace it.
