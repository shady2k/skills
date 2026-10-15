---
name: describe-repository
description: Describe one code repository of this product for the wiki — its intended model with evidence, its architecture page, the capabilities found in the code as requirements and use cases marked derived from code, and the decisions found in the code or its ADRs. Use after the repository is connected to the product — the engine's `repo add`, or any way the manifest gained the entry — or when asked to describe a repository under `repos/`.
---

# Describe a repository of this product

You will describe one code repository under this product's `repos/` so the
product's wiki shows it the same way it shows the product's own pages: a
model in the repository, prose and linked documents in the product's `docs/`.
Work for a reader who was not in this conversation: every statement you
write about the code names the file and the lines it was read from.

## Before you start

- `$REPO` is the repository to describe: a folder under `repos/`, named in
  the manifest `workspace.yaml`.
- `$PRODUCT` is this product's folder (the working folder when you run at
  its root). `$MODELDIR` is the repository's model folder, `model/` beside
  the code; where the engine reads the model from another folder, the
  engine's section in the product's agent doc names it.
- `$ENGINE` is a checkout of the engine, the product's own program that
  serves the product's wiki, makes its layout and runs the model's check;
  the engine's section in the product's agent doc names it. Where no engine
  is installed, describe still writes every file; run no check and tell the
  person the model stands unchecked, and how to install the engine.
- `git -C "$REPO" status --porcelain` must print nothing. Evidence names
  committed text; if the checkout is not clean, stop and ask for the code
  to be committed first. A refused description names the folder and the
  command that showed the changes.
- If the repository already holds a model (`*.yaml` in the model folder), update it for
  what changed instead of rewriting it, by the model-writing skill's update
  procedure; keep every id the changes do not concern.

## Procedure

### 1. Write the intended model with its evidence

Run the model-writing skill (the set's `write-intended-model`) on the
repository:

- read the repository's documents first and confirm each claim in the code;
- write the model as YAML under `$MODELDIR`, every element, interface
  and relation carrying evidence — the file, the line or range, and the
  commit and blob it was read at;
- write the review report `$MODELDIR/review.md` beside it: the claims
  table, what the code shows that no document says, the assignment table
  and the problems;
- where the engine is installed, run the model check from `$ENGINE` and
  finish only on a run that exits 0, its views read:

```sh
(cd "$ENGINE" && bun scripts/check-model.ts "$REPO" --views "$MODELDIR/views")
```

  Where no engine is installed, describe finishes the same way with the
  model unchecked: the report says so — the model and the review report
  stand, the check has not run, and the check is how the engine proves a
  written model.
- The model lives in the repository's own model folder and is kept with
  that repository's history; never commit the generated `views/` under the
  model folder.

### 2. Write the architecture page

Write `$PRODUCT/docs/repositories/<name>/architecture.md` — prose, not a
diagram dump. It says, in the product's artifact language: what the
repository is for in the product; its elements and what each holds, from
the model's second level; the relations between them, each named for what
crosses; and which decisions shape it, linking the decision pages of step 4.
Reference the model's views by name (`landscape`, the service's own page)
and link the model's folder relatively (`../../../repos/<name>/model/`
from the page — three levels up from `docs/repositories/<name>/` to the
product's root, then into `repos/`; relative links only, a product's folder
may be renamed). Link the review report the same way.

### 3. Write the capabilities found in the code, as requirements and use cases

Read the repository's entry points, contracts and handlers, and write what
it can do as documents of the product's kinds, under
`$PRODUCT/docs/repositories/<name>/`:

- one user story per role the code serves (`US-…` in `stories/`);
- one use case per capability a part offers (`UC-…` in `use-cases/`),
  its `Primary actor` and its main success scenario from the code's own
  flow;
- one product requirement per observable behaviour (`FR-…` in
  `requirements/`), `Serves:` naming the use case it realises.

Mark every such document **derived from code**, in two places:

- the title carries the mark: `# FR-901 — A stored note is found by its
  key (derived from code)`;
- the provenance stands in the document's `## Sources` section, as the two
  lines the reader follows:

        Source: code
        Evidence: notes.py L6-11, notes.py L10

The forms are the set's; its check reads the documents field by field, so
the provenance lives in the `Sources` section,
never in the field zone a `Source:` field there would refuse.

Two refusals the check writes most often on the documents this step
produces, avoided form-first:

- a field or a citation line holding a placeholder rather than a thing —
  `<name>`-shaped values read as unfinished text (`unfinished-content`);
  write the concrete example the document walks (`runs repo add
  fieldnote-core https://example.com/fieldnote/fieldnote-core.git`), the
  parameter's name belongs to the code citation beside the sentence;
- a requirement or a use case whose prose names code — files, commands,
  classes, technology names (`system-part-in-requirement`); the behaviour
  stands in the reader's words, and the code it rests on lives only in the
  per-sentence citations and the `## Sources` section.


Every statement in the document is traceable: each sentence of a scenario
or a requirement carries its own citation — `(notes.py:8-9)` beside the
sentence — and the `Evidence:` line gathers the document's citations into
one place. A document that names no file and line is not finished. The ids
continue the product's own numbering: take the next free number, never
reuse one.

A capability the documents of the repository already claim, confirmed in the
code, is written the same way and its citation names both the code and the
document; a claim the code contradicts or has outgrown is not written as a
capability — it is already a row of the review report's claims table.

### 4. Write the decisions the code or its ADRs show

Write one decision record (`docs/repositories/<name>/decisions/NNNN-slug.md`,
MADR, `Status: accepted` taken from the source) per decision you find:

- a decision record in the repository's own `docs/adr/` or `docs/` — carry
  its content across, and cite the file and lines you carried it from, at
  the commit read;
- a decision only the code shows — a technology a build file pins, a
  boundary an import rule keeps, a store only one part writes — state it
  from the code, its context and decision sections carrying the citations,
  and a `Source: code` line with an `Evidence:` line naming the file and
  lines in the record's `## Sources` section (the same shape step 3 uses).

Link each record to the model elements it shapes: name their ids in the
record's context or decision section (for example `affects:
checkout-api, orders-store`), and link the record from the architecture
page. The ids let a later reader lay the record on the model's pages.

### 5. Check the pages and finish

- Every page you wrote stands under `$PRODUCT/docs/`, so the wiki serves it;
  save each file and it appears live.
- Run the product's document check (the set's `check-product`, installed in
  the product repository as its commit gate) on what you wrote; fix every
  refusal it names, file and line.
- Report, one fact per line: the repository, the model and its check's
  verdict (or the model standing unchecked, where no engine is installed),
  the pages written with their paths, the capabilities and decisions with
  their ids, and anything stale or contradictory the review report lists.
  Leave committing to the person.

## If the repository holds no buildable shape

A repository too small to model — a single script, a folder of documents —
is described honestly small: one `system` element, the architecture page,
the use cases its entry points show, no invented structure. Say so in the
report; never pad the model to look complete.
