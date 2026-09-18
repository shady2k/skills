---
name: model-domain
description: Keep the project's glossary and its record of decisions. Use when a term is fuzzy, overloaded or contradicts the glossary, when writing or editing the glossary, or when a decision is hard to reverse and its reason would otherwise be lost.
---

# Model domain

Two small documents with long lives. The **glossary** says what this project's
words mean, so that a spec, an issue and the code call one thing by one name.
The **decision records** say why something surprising is the way it is, so that
nobody "fixes" it in a year. Neither says where the project stands: that is a
command over the tracker, never a page somebody maintains.

This is for **changing** them. Reading the glossary before naming something is
a habit every skill has, not this skill.

Resolve the owning task before retaining repository changes or committing them.
Where the project has a backlog integration, follow it. Without one, discuss
terms read-only and request setup before retained work. A code/glossary mismatch
is evidence to investigate, not permission to redefine the domain to fit a bug.

## Where they live

Where the project already keeps them. Otherwise `CONTEXT.md` at the root and
`docs/adr/`, numbered `0001-slug.md`, each created **lazily**: with the first
term resolved, the first decision worth recording. Not before.

## The glossary, while a design is being discussed

- **Challenge against it.** Show the conflicting meanings with a concrete
  scenario, recommend the one supported by domain evidence and explain what
  behaviour each implies. Use the established role, otherwise product engineer;
  ask only if the semantic difference needs their decision, not for every term.
- **Sharpen.** A word doing three jobs gets three words, or one job. Propose
  the canonical term.
- **Probe with scenarios** that sit on the boundary between two concepts, until
  the boundary is exact.
- **Check the code.** When what was said and what the code does disagree, say
  so: one of them is wrong.
- **Write it down the moment it is settled**, not at the end:

```markdown
**Order**:
One or two sentences: what it IS, not what it does.
_Avoid_: purchase, transaction
```

Be opinionated: one word wins, the rest go under _Avoid_. Only terms particular
to this project; a timeout is not a domain concept however much it is used. No
implementation in it, ever: it is a glossary and nothing else.

## A decision record, sparingly

Offer one only when **all three** hold:

1. **hard to reverse**: changing your mind later costs something real;
2. **surprising without its context**: a reader will ask why on earth;
3. **a real trade-off**: there were alternatives, and reasons.

Easy to reverse: you will just reverse it. Not surprising: nobody will ask. No
alternative: nothing to record. What qualifies: the architecture's shape, how
two parts talk, a technology that locks in, who owns which data, a deliberate
step off the obvious path, a constraint the code cannot show, an alternative
rejected for a reason that is not obvious.

```markdown
# <the decision, as a short title>

One to three sentences: the situation, what was decided, and why.
```

That can be the whole record. A status, the options considered, the
consequences: only when they carry something the paragraph does not.
