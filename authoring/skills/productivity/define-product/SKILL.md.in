---
name: define-product
description: "Talk a raw product idea through with the person who has it, in plain words, until an engineer could start, and write the product's documents behind the scenes: the conversation's record, hypotheses, user stories, use cases, product requirements and open questions. Use when someone has an idea but no requirements vocabulary, when a product owner wants their idea shaped, when a product's documents are missing before its first feature, or when a hypothesis a release carried has its measure due and the result must be read onto the record."
---

# Define a product

A person with an idea knows their world and not the words of requirements.
This skill is the conversation that takes the idea to the point where an
engineer can start the first feature without asking them the basic questions
again, and writes what that engineer needs while it talks. The person reads a
plain summary; the documents are for the engineer.

Talk by the protocol's [**Speaking to the owner**](references/speaking.md) and
in their language. Be the thinking partner the protocol's [**Starting from
nothing**](references/starting.md) describes: contribute ideas, examples and
counterexamples, and test the idea rather than only recording it.

## 1. Say what this is, and ask to keep the words

Open with the promise in one sentence: we will talk your idea through until an
engineer can start, and I will write it down as we go. Then ask once whether
their words may be kept as the record the documents quote, and say where it
will be kept. Without that agreement, talk and write nothing that quotes them.

Where there is no idea yet, find it first by the steps of **Starting from
nothing**, then come back here. Where the ask is only a released
hypothesis's measure that has come due, start at step 5 and leave the
rest: the opening, the consent and the readiness check belong to shaping
an idea, and no measure needs them.

## 2. Walk the idea, one plain question at a time

In this order, skipping what the person has already said:

1. the problem, and who has it;
2. what they do about it today;
3. what changes for them when the product exists;
4. what would prove the idea right;
5. what matters most when time or effort runs short — what stays and what
   gives first;
6. the first thing a user can do with it, step by step;
7. what it will not do;
8. what is still unknown.

The walk is the outcome frame taken at its source, by the protocol's
[**The outcome frame comes before the work is specified**](references/lifecycle.md):
questions 1 and 3 say what the product is for and for whom, 4 its success
signal, 5 what matters most when something must give, and 6 the main path.
What you propose or advise during the walk — a belief to test, a thing to
look up, a way to do it — stands on the state of the practice, not on your
habit, by the protocol's [**A proposal starts from the state of the
practice**](references/deciding.md).

- **One question per message, with an example answer** to react to: "Who
  opens it first in the morning? For instance, the cafe owner before opening,
  to see yesterday's orders." Reacting is easier than inventing.
- **Situations, not abstractions.** "Tell me about the last evening you threw
  food away" finds more than "what are your requirements".
- **No requirement words.** "Use case", "requirement", "acceptance
  criterion" and "hypothesis" are the documents' names, not the conversation's,
  unless the person uses them first.
- **Doubt becomes a hypothesis, not a requirement.** "I think students would
  come" is a belief with a way to test it; say back what would show it true.
- **What nobody knows becomes a question**, with who can answer it, never a
  guess written as fact.

When a belief is cheaper to try than to discuss, say so and offer
`to-prototype`; when a fact can be looked up, `to-research`.

## 3. Write the documents as you go

By the forms of [the product's documents](references/product.md), in the
project's artifact language and where the project keeps them. Keeping files
is [**Tracked work**](references/keeping.md): where the project has a backlog
integration, the writing goes under its task; where there is no repository
yet, the conversation goes on and a draft is created with the person's
agreement through the program's `new`, under the products home they name, and
setup runs in that draft to find or file the task the writing is kept under.
The writing goes into the draft as it is made, and naming the product later
is the program's `rename`. When the first code repository comes — the
prototype that became the code, or a new one — the program's `repo add`
enters it in the manifest and `bootstrap` clones it into `repos/`, and setup
runs in it as the product's code repository.

- **The record first** (`S-…`): their words as they said them, one line per
  turn, prefixed by who spoke; nothing summarised into it.
- Then what the conversation established, each document citing the lines it
  came from: the vision, hypotheses with their test and threshold — a test
  that a user's behaviour settles only once they have the feature records
  which release it waits on, by the hypothesis's
  [form](references/product.md) — user
  stories for the first thing a user does, the use case with its steps and
  what can go wrong at each, the product requirements a user could observe,
  and an open question for each gap.
- A product requirement names no part of the system; how the system does it
  belongs to the specs, later.
- Write only what was said or agreed. An idea of yours the person did not take
  stays out; one they took is quoted from the line where they took it.

Run the product-documents check before keeping them and correct what it
refuses.

## 4. Know when it is done

It is done when an engineer could start the first feature. Check, and say what
is still missing rather than filling it in:

- who uses it, and the problem, with the person's own evidence;
- the first journey, its steps, and what can go wrong at each;
- the rules a user would notice (limits, times, prices, who sees what);
- what is out;
- every open question with who can answer it.

## 5. When a release has made a hypothesis's measure due

A hypothesis whose test waits on a release becomes readable once that
release is with its users. Read the measure as it stands and write it onto
the hypothesis's record, by its [form](references/product.md): confirmed
where the measure reaches the threshold the hypothesis recorded, refuted
where it does not, inconclusive with why it could not read cleanly — too
few using it, not the users the threshold assumed. A refuted hypothesis is
news to the owner by the protocol's [**A claim reaches only as far as its
evidence**](references/deciding.md): the belief, what it predicted, the
measure now read, and what the answer changes — the direction, a
requirement, a cost. The threshold is never moved to fit the measure's
answer; that asks the belief questions until one gives the wanted one.
Where the reading is asked for as part of planning the next slice,
`to-milestone` plans with the results; the reading and the record stay
this skill's.

## 6. Close in plain words

Tell the person, without document names or ids: what we now know, what we
still believe and how it will be tested, what is left open and who will
answer it, and what the engineer will start with. Their next step is a
decision of theirs (the first milestone's cut, a test of a belief, a name for
the product); recommend one and start the skill that does it when they agree.
