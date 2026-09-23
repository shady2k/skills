---
name: model-domain
description: Keep the project's glossary — its domain terms and the names of its own parts — and its record of decisions. Use when a term is fuzzy, overloaded or contradicts the glossary, when writing or editing the glossary, when a design conversation had to explain the name of a part or the agent caught itself paraphrasing one, or when a decision is hard to reverse and its reason would otherwise be lost.
---

# Model domain

Two small documents that live long. The **glossary** says what the project's
words mean, so that a spec, an issue, the code and a conversation with the owner
call one thing by one name; it holds two lists, the domain's terms and the names
of the system's own parts. The **decision records** say why something surprising
is the way it is, so nobody "fixes" it a year later. Neither tracks progress: that comes from the tracker,
never from a page someone maintains.

Talk and keep things by the protocol's [**Language**](references/speaking.md).

This skill is for **changing** them. Every skill reads the glossary before
naming things, and takes its names from there rather than coining one.

Keeping changes or committing needs the owning task; without a backlog
integration, discuss terms without changing files and ask for setup. If
the code and the glossary disagree, investigate; do not redefine the domain to
fit a bug.

## Where they live

Use existing paths or the project's document integration. Otherwise
`CONTEXT.md` at the root and `docs/adr/`, numbered `0001-slug.md`. Create each
only when the first term is settled, the first part had to be named, or the
first decision is worth recording. Every project ends up with a glossary,
because every project eventually names something to its owner; it is written
when that happens and not scaffolded empty beforehand.

## The glossary, while a design is discussed

- **Test terms against it.** Show conflicting meanings with a concrete
  scenario, recommend the one the domain supports and say what behaviour each
  implies, to the role the protocol's **Speaking to the owner** assumes; ask
  only when the difference in meaning needs their decision, not for every term.
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
this project; a timeout is not a domain concept however often it appears.

## The parts of the system have names too

A second list, under its own heading: the words this project uses for its own
moving parts — its processes, its channels, its stores, its records, whatever a
conversation about the design cannot get through without naming. One line each,
saying what the thing **is**, spelled the way the code spells it, with the
project's word for it beside that spelling where they differ. Not fields,
options, signatures or API shapes: those live in the code and change with it.

```markdown
**The ledger** (`ledger`):
The append-only store every balance is derived from. The only part that decides
what a correction does to a total already reported.
```

This list is what lets the owner and the agent discuss a design in one
vocabulary, as the protocol's **One thing, one name** requires. The signal that
something belongs here is plain: a name the conversation had to explain, or one
the agent caught itself paraphrasing. Add it in that same session, in one line,
and then use it.

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
