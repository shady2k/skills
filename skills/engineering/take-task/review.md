# The two reviews

Both read the same change: the diff from where the task started, and the list
of its commits. Neither sees the other's findings, and their reports are shown
side by side, not merged or reranked: picking one winner across the two is the
mistake the separation exists to prevent.

## Standards

Give the reviewer the diff command, the files in this project that document
how code is written (a contributing guide, coding standards, the agent doc),
and the baseline below pasted in full, since it has no other way to see it.

> Report, per file and hunk: (a) every place the change breaks a documented
> standard, citing the file and the rule; (b) any baseline smell, named, with
> the hunk quoted. A documented breach can be a hard finding; a smell is always
> a judgement call, and a documented standard overrides the baseline. Skip
> whatever tooling already enforces. Under 400 words.

**The baseline**, for a project that documents nothing (Fowler, _Refactoring_,
ch. 3). Each is what it is, then the way out:

- **Mysterious name**: a name that does not say what it does or holds. Rename
  it; if no honest name comes, the design is murky.
- **Duplicated code**: the same shape of logic in more than one place in the
  change. Extract it, call it from both.
- **Feature envy**: a method that reaches into another object's data more than
  its own. Move it onto the data it envies.
- **Data clumps**: the same few fields travelling together. Make them one type.
- **Primitive obsession**: a string or a number standing in for a concept.
  Give the concept its own small type.
- **Repeated switches**: the same cascade on the same type, again. One
  polymorphic seam, or one map both sites share.
- **Shotgun surgery**: one logical change, edits scattered over many files.
  Gather what changes together.
- **Divergent change**: one module edited for several unrelated reasons. Split
  it so each part changes for one.
- **Speculative generality**: hooks and parameters for needs the spec does not
  have. Delete them.
- **Message chains**: `a.b().c().d()`. Hide the walk behind one method.
- **Middle man**: a thing that mostly delegates. Cut it out.
- **Refused bequest**: a subclass ignoring most of what it inherits. Compose
  instead.

## Spec

Give the reviewer the diff command, the task with its criterion, and the
feature's spec.

> Report: (a) what the task or the spec asked for that is missing or partial;
> (b) behaviour in the change that nobody asked for; (c) what looks implemented
> and looks wrong. Quote the line of the spec for each. Under 400 words.

No spec: skip this review and say so in the report, rather than reviewing
against a guess.
