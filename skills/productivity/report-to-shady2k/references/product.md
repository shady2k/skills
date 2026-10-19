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

**The links are declared, never hard-coded.** Each link lives in the
registry, under the kind whose documents carry the field: the field's
name, the names of the kinds its targets may be (the kinds' own words for
a reader, the way the engine matches them), the word its backlink
shows on the target's page, whether the field is one or many, and whether
a document of the kind has to carry it. The set's own declarations are
the table's: a hypothesis grows from the vision, a source or a question;
a user story grows from the vision or a hypothesis; a use case serves
user stories; a product requirement serves use cases and user stories;
an open question concerns the vision or any chain kind; a prototype
tests hypotheses; a result is of prototypes. The wiki draws links and
backlinks from these declarations alone, so a kind a product adds to its
registry — with its links — joins the chain with no code change on either
side. A link whose target names no kind of the registry, and a missing
required link, are findings — the structural rules, the registry's; what
the documents say is the check's word alone.

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

**Templates are overridable per product.** The set ships a default
template per kind (in the set, at `templates/product/`, beside the
product-documents check; a practice record's is `templates/practice.md`);
a project that installed them holds its copies under `.shady2k/templates/`
at its root, at the same relative names; a product may hold its own
template for the kind at the same relative name under its own `templates/`
at the product repository's root — a kind's document template under
`templates/product/`, the practice record's at `templates/practice.md` —
outside `docs/`, so the wiki never serves a template as a page of the
documents (the product's `folder` for a kind is only where its documents
go). The order of precedence: the product's own template for the kind,
when one stands; the project's installed copy, when none stands in the
product; the set's shipped default, when nothing is installed. A kind the
product renamed keeps the set's template name: what moves with the kind
is its prefix, in the registry, and the identity line of its template
must name that prefix. In the set's own repository, `node
kinds-registry.mjs --template <PREFIX> --root <product folder>` prints
the one to use and names where it came from (its `--json` carries the
same); a product's own template that does not name the prefix is refused,
with the file and the line, and nothing is fallen back from; its selftest
exercises the order all three ways and the refused override. A writing
skill applies the same order by reading the product's template first, and
never restate the form's rules — a product's own wording, and nothing in
a template, changes what `check-product.mjs` verifies.

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
Sections: `## Belief` ("we believe that…"), `## Test` (what we will do, and
what it waits on: research, a prototype, or the release that carries the
change), `## Metric` (what we will measure), `## Threshold` (the value that
would confirm it), *optional* `## Result` (a result's id or what was
learned; where the test waited on a release, the measure read against the
threshold once that release is with its users — confirmed, refuted, or
inconclusive with why), *optional* `## Sources`.

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

## The product repository

A product repository is a git repository that keeps a product's knowledge in
one place: its documents (`docs/`), its intended model (`model/`), the team's
own skills (`skills/`, never a copy of the set), its prototypes
(`prototypes/`) and the code repositories it spans (`repos/`). This layout
comes with the manifest's schema version; it is never read from the manifest.

**The manifest is `workspace.yaml`.** It carries `schemaVersion: 1`, the
product's `id` (given once and kept for its life) and its `name`; it may name
the pinned version of the set under `skills`, and the repositories under
`repos` as a list of `{ name, url, branch? }`, where a name is a folder name
and unique among them. Fields are only ever added beside these, so an unknown
field is ignored and a manifest from a later version still opens.

**Every kind has its place.** The kinds the set owns, their id prefixes
and where each kind's documents are written — the table the registry
writer renders, so a product's `docs/` answers the set's words in its
own language:

| Kind | Prefix | Place | Stage |
| --- | --- | --- | --- |
| Vision | `VIS` | `docs/vision.md` | idea |
| Roadmap | `ROA` | `docs/roadmap.md` | idea |
| Milestone | `MIL` | `docs/milestones` | idea |
| Source | `S` | `docs/sources` | idea |
| Hypothesis | `H` | `docs/hypotheses` | idea |
| Open question | `Q` | `docs/questions` | idea |
| Prototype | `P` | `docs/prototypes` | idea |
| Result | `R` | `docs/results` | idea |
| User story | `US` | `docs/stories` | requirements |
| Use case | `UC` | `docs/use-cases` | requirements |
| Product requirement | `FR` | `docs/requirements` | requirements |
| Decision | `DEC` | `docs/decisions` | design |
| Design record | `DES` | `docs/changes` | design |
| Architecture | `ARC` | `docs/system/architecture.md` | design |
| Capability | `CAP` | `docs/system/capabilities` | design |
| Change record | `CHG` | `docs/changes` | build |
| Exploration | `EXP` | `docs/explorations` | idea |
| Practice | `PRA` | `docs/practices` | operate |

**The kinds registry is `docs/kinds.yaml`, the product's own data.** The
set's kinds made data, for the wiki that serves the product. Its first
line carries `contract: 1` — the version the registry's words are written
against; the engine accepts the versions it knows, names a version it
does not support and degrades to plain pages rather than fail silently.
Then the stages of the set's life cycle in their order (`idea`,
`requirements`, `design`, `build`, `verify`, `release`, `operate`) as
`id:` entries, and per kind `name` (its word for a reader), `prefix` (its
documents' id prefix, one to four capitals, unique among the kinds),
`folder` (the place under `docs/` the kind's documents live in, the
folder of its kind by default), `stage` (one of those stages) and `hint`
(what a person mid-stage does next with the kind) — and, as a kind may
declare them, its `statuses` (the words its documents may carry; the
practice record's are `active` and `retired`, the only ones a chain
document's check reads: everything else on a chain document is computed,
never written) and its `links` (the declared links, above the forms at the
chain; each link's targets name the kinds by their word, the way the
engine's own examples write them). The stages hold no fixed kinds; verify,
release and operate keep their records where the set records them, and so
hold none of these pages. The contract's reserved places are read as data,
never refused and never dropped, and the set writes none of them: a kind
may carry `storage` (the form it is kept in; the set's kinds are
`document`) and, riding the reserved `fact` form, an `evidence` map
(source, ref, record) — an evidence shape without `storage: fact` is
refused, by the engine's own words — and the manifest may carry the
reserved `goals:` section of maturity levels. This engine version serves
documents only, so the set's reader reports each reserved place it reads
as a note that names it. Setup writes it where the
product holds none and reports one that stands; the product may rename
the kinds or retune the hints in its own language; the prefix and the
stage are the forms' words, and the folder is the default — a chain
document keeps its kind by its id wherever under `docs/` it stands, so a
described repository's derived documents are laid out beside the
repository they describe. Nothing beyond these fields, the stage ids and
the declarations is read there: the shape is the engine's published
contract schema at that version, and the set carries its own copy of the
published schema at the version it targets — in the set's own repository,
`test/schemas/product-registry.schema.json` — validating what it writes
with its own code, so no repository depends on another. The set's reader
refuses what it refuses (the shapes, the places, the words, a target that
names no kind of the registry, an evidence shape without its `storage:
fact`, a named version other than 1 with that version's name), and a
registry the writer renders is one the copy passes — and one the engine's
own contract check reads: the set's rendered registry was verified against
the engine's published schema at the version the set targets, once at
acceptance, by the engine's own check run outside this repository. The published example, written by the same writer, is this
repository's example product's `docs/kinds.yaml`
(`fixtures/product/good/`).

**The repositories are driven by the program `product.mjs`.** It creates the
draft for a product that has no repository yet (`new`, in a home the caller
gives it), reads and validates a folder against its manifest (`read`), names
the product in place without losing its id (`rename`), adds the code
repository as a remote without pushing (`remote`) and clones the repositories
the manifest declares, never replacing a checkout already there
(`bootstrap`). Skills create, rename, add a remote to and bootstrap a product
repository only through it.

## The check

`check-product.mjs` reads the product documents of a repository (its working
tree, its staged files or a revision) and refuses one out of form, naming the
file, the line and what is wrong. A repository with no product document passes
it untouched. It is a commit gate wherever the set is installed, and a product
wiki runs the same check on a change it accepts.

**It resolves an id only where the set's own documents name one.** A document
the set writes — a product document, a practice record, a spec, a change
record — names ids in its fields and its text, and every id it names resolves:
a capability requirement that serves `FR-012` is refused when no `FR-012`
exists. A document is one the set writes by its form, not by its folder: it
opens with its identity line, or with the `Capability:` field a spec carries or
the `Change:` field a change record does, or it stands where its kind collects
according to the product's registry (`docs/kinds.yaml`), the vision included.
Prose the set does not write — a decision record, an exploration, a roadmap, a
charter, a guide — is not searched for ids: a word there that merely looks like
one (`S-100`, `P-256`, `H-264`) is a word. In that prose a reference is written
as a Markdown link whose target is the document's own file, a path from the file
that holds it: `[the shape](../system/capabilities/<name>.md)`. A link to a file
that is not there is refused, wherever it stands. A token that is not a
reference anywhere stands in a code span, `` `P-256` ``, which the check never
reads.
