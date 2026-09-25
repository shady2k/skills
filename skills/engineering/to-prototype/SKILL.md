---
name: to-prototype
description: "Answer a design question with a bounded throwaway prototype. Use when brainstorming or take-task needs runnable evidence that discussion cannot provide, or the user asks for a prototype."
---

# To prototype

Some questions talking does not settle: whether a state model survives its
awkward cases, what a screen should look like. A prototype is **throwaway code
that answers one such question**, and the question decides its shape.

Talk and keep things by the protocol's [**Language**](references/speaking.md).

## 1. Write the question down

The experiment runs in scratch space; anything kept is tracked work, by the
protocol's [**Tracked work**](references/keeping.md).

Put one paragraph at the top of the prototype: what is being asked, and which
answer would change the design. A prototype that answers the wrong question is
wasted. If it is genuinely unclear and nobody can be asked, follow the shape
the surrounding code suggests and state that assumption there.

Speak to the role the protocol's **Speaking to the owner** assumes. Recommend
the question, the shape of the experiment and its effort together: what it will
teach, why, and what it cannot prove. The user may correct named assumptions;
ask only when a missing requirement or a real cost or risk changes the
experiment, not which tool or file to use.

## 2. Pick the shape

**Does this logic hold?** One self-contained file that opens by double-click,
with nothing to install, so someone who does not code can use it.

- The logic is a small **pure module** inside it (a reducer, a state machine,
  a few functions over plain data) that does not touch the page. The page is
  throwaway; reusing the module later is a separate implementation decision.
- Buttons to play freely, and a few **guided walks** through the cases that are
  hard to reason about on paper.
- Every label in the domain's words, not the code's. After every action, the
  whole relevant state is visible.

**What should this look like?** Several **very different** variants of one
screen, switched from a bar at the bottom.

- **Inside the real page** wherever one exists: real header, data and density,
  variants switched by a URL parameter. On an empty page any variant looks
  fine.
- Its own route only when there is no page to put it in, following the
  project's routing and named so nobody mistakes it for production.

## 3. Rules for both

- **Throwaway from the first line**, and named so. Keep it near what it is
  for, so the context is obvious.
- **One command to run**, or one file to open.
- **No saved data** unless that is the question; then a scratch store whose
  name says "wipe me".
- **No production polish:** only the controls and checks needed to answer the
  question, including its hard cases. Record those checks and what you saw; no
  general test suite or abstractions.

## 4. Keep the answer, park the code

Report the answer you observed, its uncertainty and limits. A negative or
unclear result may end the session; no feature or spec has to follow. Put a
decision into a spec only when it was actually approved and a spec is being
kept. Production code goes through tracked work and its normal checks; lifting
the pure module is no exception.

The prototype itself is **evidence**. To keep it, store it as an artifact
linked to its task, or as an approved, task-linked commit on its own branch,
off the main line. Leave a pointer to it: where the project has a backlog
integration, a comment on the feature issue with the question and the verdict.
The main line keeps only the decision.

Return to the conversation that raised the question. Label scratch files
clearly and say where they are. Keeping or discarding them does not permit
production use or deleting unrelated files.
