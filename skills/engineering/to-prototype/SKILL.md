---
name: to-prototype
description: Answer one design question with throwaway code, when talking cannot settle it. A state model to push through its hard cases, or several looks of one screen side by side.
disable-model-invocation: true
---

# To prototype

Some questions are not settled by talking: whether a state model survives its
awkward cases, what a screen should look like. A prototype is **throwaway code
that answers one such question**, and the question decides its shape.

## 1. Write the question down

One paragraph, at the top of the prototype where whoever opens it sees it: what
is being asked, and what answer would change the design. A prototype that
answers the wrong question is pure waste. Genuinely ambiguous and nobody to
ask: take the shape the surrounding code suggests and state that assumption in
the same place.

## 2. Pick the shape

**Does this logic hold?** One self-contained file that opens by double-click,
nothing to install, so that somebody who does not code can drive it.

- The logic itself is a small **pure module** inside it (a reducer, a state
  machine, a few functions over plain data), with no reach into the page. The
  page is throwaway; this part lifts into the real code once it is right.
- Buttons to play freely, and a few **guided walks** through the cases that are
  hard to reason about on paper.
- Every label in the domain's words, not the code's. After every action, the
  whole relevant state, visible.

**What should this look like?** Several **radically different** variants of one
screen, switched from a bar at the bottom.

- **Inside the real page** wherever one exists: real header, real data, real
  density, the variants swapped by a parameter in the address. A variant on an
  empty route looks fine whatever it is.
- A route of its own only when there is truly no page to live in, following the
  project's routing, and named so that nobody takes it for production.

## 3. Rules for both

- **Throwaway from the first line**, and named so. It sits near what it
  prototypes for, so the context is obvious.
- **One command to run**, or one file to open.
- **No persistence** unless persistence is the question, and then a scratch
  store with a name that says "wipe me".
- **No polish**: no tests, no error handling beyond running, no abstractions.

## 4. Keep the answer, park the code

Fold the validated decision into the spec or the real code. The prototype
itself is a **primary source**: commit it to a branch of its own, out of the
main line, and leave a pointer to that branch where the work lives. Where the
project has a backlog integration, that is a comment on the feature issue,
with the question and the verdict. The main line keeps the decision only.

Then tell the user where the thread goes back: the conversation that raised the
question, usually `/to-spec`.
