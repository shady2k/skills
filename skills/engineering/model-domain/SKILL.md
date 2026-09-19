---
name: model-domain
description: Keep the project's glossary and its record of decisions. Use when a term is fuzzy, overloaded or contradicts the glossary, when writing or editing the glossary, or when a decision is hard to reverse and its reason would otherwise be lost.
---

# Model domain

Two small documents that live long. The **glossary** says what the project's
words mean, so a spec, an issue and the code call one thing by one name. The
**decision records** say why something surprising is the way it is, so nobody
"fixes" it a year later. Neither tracks progress: that comes from the tracker,
never from a page someone maintains.

This skill is for **changing** them. Every skill reads the glossary before
naming things.

Keeping changes in the repository or committing them needs the owning task
first. Where the project has a backlog integration, follow it. Without one,
discuss terms without changing files and ask for setup before kept work. If
the code and the glossary disagree, investigate; do not redefine the domain to
fit a bug.

## Where they live

Use existing paths or the project's document integration. Otherwise
`CONTEXT.md` at the root and `docs/adr/`, numbered `0001-slug.md`. Create each
only when the first term is settled or the first decision is worth recording.

## The glossary, while a design is discussed

- **Test terms against it.** Show conflicting meanings with a concrete
  scenario, recommend the one the domain supports and say what behaviour each
  implies. Use the known role, otherwise product engineer; ask only when the
  difference in meaning needs their decision, not for every term.
- **Sharpen.** A word with three meanings gets three words, or one meaning.
  Propose the preferred term.
- **Probe the boundary** between two concepts with scenarios until it is exact.
- **Check the code.** When what was said and what the code does disagree, say
  so: one of them is wrong.
- **Write it down once settled**, when keeping definitions is in scope. Free
  exploration may leave tentative meanings in the conversation; do not turn a
  hypothetical term into a definition or create files automatically.

```markdown
**Order**:
One or two sentences: what it IS, not what it does.
_Avoid_: purchase, transaction
```

Be decisive: one word wins, the rest go under _Avoid_. Only terms specific to
this project; a timeout is not a domain concept however often it appears. No
implementation details, ever.

## A decision record, sparingly

Offer one only when **all three** hold:

1. **hard to reverse**: changing your mind later costs something real;
2. **surprising without context**: a reader will ask why;
3. **a real trade-off**: there were alternatives, and reasons.

What qualifies: the architecture's shape, how two parts talk, a technology that
locks you in, who owns which data, a deliberate step off the obvious path, a
constraint the code cannot show, an alternative rejected for a non-obvious
reason.

```markdown
# <the decision, as a short title>

One to three sentences: the situation, what was decided, and why.
```

That can be the whole record. Add status, options or consequences only when
they say something the paragraph does not.
