---
name: brainstorming
description: Think a plan, a design or an idea through with the user, one question at a time, each with the positions one could take and what each would cost, until nothing is left silently assumed. Use when the user wants to brainstorm or think something through, when a plan is about to be written down with decisions still open, or when another skill says to settle its questions first.
---

# Brainstorming

A plan fails on the decision nobody noticed was one. This is the conversation
that finds those decisions and puts each in front of **the person whose
decision it is**, at the height they think at. It is not an interrogation: the
person is here as an owner, an analyst, an architect, or all three at once,
not as a reference manual for their own code.

## 1. Who is deciding, and what is theirs

Settle it first, in one question if the conversation has not already said: in
which roles is this person here?

| role          | theirs to decide                                                                      |
| ------------- | ------------------------------------------------------------------------------------- |
| product owner | what for and for whom, what is in and what is out, what matters more, what it may cost |
| analyst       | the rules of the domain, the awkward cases, what a word means, what counts as done     |
| architect     | the shape: the boundaries, what owns which data, what locks in, which quality is traded for which |
| **product engineer** | all three of the above, alone. Answers for the whole thing and builds it through agents, without reading the code: knows what it must do and roughly how it hangs together, not what a given function does |

The product engineer is the usual case when one person is driving, and the one
to **assume when nothing says otherwise**. Every zone is theirs, so nothing may
be skipped as "somebody else's", and every question still arrives translated:
an architectural one as what it makes cheap, dear or irreversible, never as a
module, a function or a library's name. Holding all the roles does not mean
holding the code in their head; that part is yours.

Everything below that line is **yours**: what the code does today, which
library, which file, what to name a function, any choice that is cheap to
reverse. You do not ask about those. You find out, or you decide, and you say
so at the end.

A role nobody here holds does not make its questions disappear. Say whose
decision it is, decide it provisionally yourself with the reason, and mark it
for that person. With a product engineer there is no such role: ask.

## 2. One question at a time

Keep the **design tree** in your head: every decision branches into the ones
that hang off it, and the **frontier** is the set whose prerequisites are
settled. From the frontier, ask the **one** question that unblocks the most,
and wait for the answer before the next. A batch of questions gets a batch of
reflexes; one question gets thought.

## 3. Asked at their height

A question is put in the terms of the role it goes to: what a person will see,
what it will cost, what becomes hard later. **No file, no function, no
library** in a question to an owner, an analyst or a product engineer; to an
architect who works in the code, components and contracts, not lines.

A technical fork is translated into its consequence before it is asked. Not
"a queue or a cron job?" but "may this run up to a minute late, or must it be
immediate? Immediate costs a moving part we will have to watch." If a fork has
**no consequence visible at their height**, it is not their question: it is
yours, by the line in step 1.

## 4. Every question comes with positions

Never a bare question, and never one recommended answer dressed as a choice.
Two to four **positions a reasonable person could hold**, each with what it
sets in motion:

```
<the question, in their terms, and why it has to be decided now>

A. <position>. What follows: <for whoever uses it; for cost and time; what it
   makes easy or hard later>.
B. <position>. What follows: …
C. <position>. What follows: …

I would take <one>, because <the one reason that carries it>. <What would
change my mind.>
```

The positions are real alternatives, argued as their best advocate would, not
a preferred one between two straw men. Where the harness can present choices
to pick from, use it; the free answer always stays open, and "neither,
because…" is often the most useful reply there is.

## 5. Facts are yours

Never ask for what you could look up: what the code does, what the tool
supports, what the tracker holds. Find it, with a sub-agent where the harness
has them, and meanwhile ask a question that does not wait on it. Bring a fact
into a question only as far as it bears on the decision: "today a rollback
takes twenty minutes and three people", not how it is implemented.

## 6. While it runs

- A word doing two jobs, or two words doing one, is settled on the spot: call
  the Skill tool with "model-domain" where the project keeps a glossary.
- A question only something **runnable** can answer (does this model survive
  its awkward cases, what should this look like) is not settled by talking.
  Say so, and tell the user `/to-prototype` answers it; carry on with the
  branches it does not gate.
- A question that cannot be settled today and **blocks a build** is work, not a
  loose end: call the Skill tool with "to-backlog", and it goes under the stage
  it gates.

## 7. Done

When the frontier is empty. Say it back in three short lists:

- **Decided by you**, by the role each was decided in, one line each with the
  position taken.
- **Decided by me**, in my own zone, each with its reason: so that any of them
  can be overruled in a word. This list is not optional; a decision made
  silently on somebody's behalf is the thing this skill exists to prevent.
- **Still open**, with whose decision each is.

**Do not act on any of it until the user confirms.** Keep what follows (a spec,
stages) in this same conversation: the lists are a summary, and the reasons are
in the thread.
