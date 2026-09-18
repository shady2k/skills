---
name: to-research
description: "Investigate a bounded question using primary sources. Use when planning or take-task needs evidence for a decision, or the user asks for research; delegate independent reading when available."
---

# To research

Reading is legwork, and it does not need this conversation's attention. Start a
**background agent** where the harness has one, and keep working; where it has
none, say so and do the reading here.

Derive the brief from the request and known decisions. Recommend a bounded
scope and effort with the expected benefit and limitations; do not ask the
user to choose sources, note paths or routine research settings. Use their
established role, otherwise product engineer, and explain what decision the
evidence will support. Ask only about material missing requirements or costs;
"use recommendations" does not authorize paid access or expanded scope.

Its brief:

1. **The question**, as one sentence, and what we hope to learn. A committed
   product decision is not required for exploratory research.
2. **Primary sources only**: the official documentation, the source code, the
   specification, the first-party API. A write-up about them is a lead, not a
   source; follow every claim back to whoever owns it.
3. **A cited answer**, with what could **not** be established as plain as what
   could. Keep it in the conversation unless retention is wanted; a Markdown
   note is optional, not a condition of useful research.
4. **If retaining notes**, use existing project locations or the integration's
   optional exploration template. Do not invent a competing knowledge store.
5. **A stopping condition and budget:** what evidence would settle the question,
   how much investigation is justified, and how to report an unresolved result.

Resolve the owning task before retaining repository changes or committing the
note. Without backlog integration, research may remain read-only or in scratch
space; request setup before turning it into retained project work. An unavailable
source is a limitation, not a citation. Independent questions can be investigated
in parallel without blocking the rest of the design.

When it comes back, read the answer before relying on it: a citation is a claim
about a source, and the ones a decision rests on are worth opening. The note
feeds the thinking, usually `brainstorming`; it does not replace it or mandate
`to-spec`. Negative, inconclusive and "not worth pursuing" results are valid
endings. Do not automatically create a task, document or implementation offer.
