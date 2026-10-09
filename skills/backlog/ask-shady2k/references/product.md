# The product's documents

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
What a product's own documents are, the form each is written in, and how they
link. The set owns these forms, their templates and their check, with or
without a product wiki that reads them.

**Product documents are the level above the specs.** What the product is for,
who needs what, and what a user can observe it do are product documents; how
the system does it is the specs' (capability requirements and their
scenarios). They do not copy each other: a capability requirement references
the product requirement it serves by its id, and a product requirement names no
part of the system. "User requirement" is not used as a name: standards and
books put it at different levels.

**The chain.** Each document names what it grew from, so every product
requirement can be followed up to a person's words:

| Kind | Id | Says | Grows from |
| --- | --- | --- | --- |
| Vision | `VISION` (`docs/vision.md`) | why, for whom, how we will know | — |
| Source | `S-001` | the record of a conversation the quotes come from | — |
| Hypothesis | `H-001` | a belief, its test, its metric, its threshold | the vision, a source, a question |
| User story | `US-001` | one slice of value for one role, with its acceptance | a hypothesis, the vision |
| Use case | `UC-001` | one goal, its main success scenario, its extensions | user stories |
| Product requirement | `FR-001` | one thing a user can observe, and how it is verified | use cases, user stories |
| Open question | `Q-001` | what is unknown, who can answer, what settles it | whatever it concerns |
| Prototype | `P-001` | the code that tests a hypothesis, and how to run it | hypotheses |
| Result | `R-001` | a prototype's prediction, what was observed, the verdict | its prototype |

**A product document's form.** A Markdown file under `docs/`, in the folder
of its kind by default (`docs/sources/`, `docs/hypotheses/`, `docs/stories/`,
`docs/use-cases/`, `docs/requirements/`, `docs/questions/`,
`docs/prototypes/`, `docs/results/`), its file name starting with its id. Its
first line is its identity, `# FR-012 — A cafe lists its leftovers until
18:00`: the id (the kind's prefix and at least three digits, never reused) and
a title, in the project's artifact language. Below it, before any section,
come its fields, one per line as `Name: value`; links are ids separated by
commas. Then its sections, `## Name`, each the kind's own; a list in a section
is a Markdown list. The field and section names are the set's, in English,
whatever the artifact language, so a reader can parse every project the same
way. Templates are in `templates/product/`.

**Status is computed, never written.** Whether a question is open, a
hypothesis tested or a requirement built follows from the links and the
checks; a `Status:` field is refused. A document replaced by another is not
edited into it: the new one says `Supersedes: <id>`.

**What is not known is a question, not a guess.** A gap the conversation left
is an open question (`Q-…`) with who can answer it and what would settle it;
a placeholder (`TODO`, `TBD`, angle brackets, `[NEEDS CLARIFICATION]`) in a
product document is refused. An answer closes a question, and so does
`Not applicable: <reason>`; an empty answer leaves it open.

**A quote names its place.** A document's `## Sources` lists what it was
written from, one citation per item: `S-001 L12-18 "the quote"`, or a time
range in a transcript, `S-001 00:12:30-00:13:05 "the quote"`. Lines are the
source file's own lines; a transcript marks time as `[hh:mm:ss]` at the start
of a line. The quote must stand at that place in a kept source. A source kept
outside the repository (`Kind: outside`, with its `Reference:`) has no record,
and its quotes are reported as not verified.

**A source is kept with consent.** The record of a conversation keeps the
person's words as they said them, and is kept only with their agreement. What
is redacted, and where transcripts may be kept, is the project's choice, made
once.

## The kinds

Fields and sections marked *optional* may be left out; every other one is
required and not empty.

**Source (`S-…`).** Fields: `Kind:` conversation, interview, transcript,
document or outside; `Date:` (YYYY-MM-DD); `With:` the people or roles
present; `Reference:` where an outside source is (required for outside, and
only there); *optional* `Redacted:` what was removed. Section: `## Record`, the
words themselves, absent for an outside source.

**Hypothesis (`H-…`).** Field: `Grew from:` the vision, sources or questions.
Sections: `## Belief` ("we believe that…"), `## Test` (what we will do),
`## Metric` (what we will measure), `## Threshold` (the value that would
confirm it), *optional* `## Result` (a result's id or what was learned),
*optional* `## Sources`.

**User story (`US-…`).** Field: `Grew from:` hypotheses or the vision.
Sections: `## Story`, three list items, `- As: <role>`, `- I want: <goal>`,
`- So that: <benefit>`; `## Acceptance`, a list of the use cases and
requirements that accept it or of criteria a person can check; *optional*
`## Sources`. A story is small enough to deliver on its own, valuable to its
role, and testable.

**Use case (`UC-…`).** Fields: `Serves:` user stories; `Level:` summary,
user goal or subfunction; `Primary actor:`; `Scope:` the product or system
that is used; *optional* `Scenario:` the name of the scenario that describes
this use case in an architecture model, where the project keeps one;
*optional* `Trigger:`. Sections: `## Preconditions`, `## Success end
condition`, `## Failed end condition`, `## Main success scenario` (a numbered
list of steps), *optional* `## Extensions` (list items `- 3a <condition>:
<what happens>`, each naming a step of the main scenario), *optional*
`## Open issues` (questions), *optional* `## Stakeholders and interests`,
*optional* `## Minimal guarantee`, *optional* `## Sources`. The fields are
Cockburn's.

**Product requirement (`FR-…`).** Fields: `Serves:` use cases or user
stories; `Verified by:` test, demonstration, inspection or analysis.
Sections: `## Requirement`, one thing a user can observe, naming no part of the
system (no code, module, service or table); *optional* `## Rationale`;
*optional* `## Sources`.

**Open question (`Q-…`).** Fields: `Concerns:` the documents it is about, or
`VISION`; `Who can answer:`. Sections: `## Question`, `## What settles it`,
*optional* `## Answer`.

**Prototype (`P-…`).** Fields: `Tests:` hypotheses; `Code:` the folder
under `prototypes/` that holds it. Sections: `## What it tries`, `## How to
run`.

**Result (`R-…`).** Fields: `Of:` the prototype; `Date:`. Sections:
`## Prediction` (in the form "X % of Y will do Z" where it can be), `## Observed`,
`## Verdict` (confirmed, refuted or unclear, then why).

## The check

`check-product.mjs` reads the product documents of a repository (its working
tree, its staged files or a revision) and refuses one out of form, naming the
file, the line and what is wrong. It also resolves every id any document under
`docs/` names, the specs and change records included, so a capability
requirement that serves `FR-012` is refused when no `FR-012` exists. A
repository with no product document passes it untouched. It is a commit gate
wherever the set is installed, and a product wiki runs the same check on a
change it accepts.
