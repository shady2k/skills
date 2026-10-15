---
name: write-intended-model
description: Write or check a repository's intended model — the YAML architecture model in the repository's model folder, with its review report and evidence. Use when asked to write, check, review or update an intended model for a repository.
---

# Write the intended model of a repository

You will write the **intended model** of a repository: what its architecture
is declared to be — elements, interfaces, relations, zones, data categories —
as YAML in the repository's model folder (`$MODELDIR`), with a review report
`$MODELDIR/review.md` beside it, every fact backed by **evidence** naming the
exact text it was read from, at a commit and a blob.

Work for a reader who was not in this conversation: every claim in the report
names where it came from, so a person can check it without asking you.

## Before you start

- `$REPO` is the repository to model.
- Read [**Model and engine locations**](references/model-environment.md#model-and-engine-locations)
  for `$MODELDIR`, `$ENGINE` and the procedure when no engine is installed.
- Where the engine is installed, both checkouts
  must exist; `$REPO` must be a git checkout. The git commands below
  take `-C`, so they run from anywhere; every command that runs the check
  runs from `$ENGINE` — `bun` loads the current directory's `bunfig.toml`
  and its `preload` runs, so the check must not run beside a `bunfig` it
  does not know.
- `git -C "$REPO" status --porcelain` must print nothing for the files you
  will describe. Evidence names committed text and the check resolves it in
  git, not in the working tree — if the code is uncommitted, the pin misses
  what you read. If it is not clean, stop and ask for the code to be
  committed first.
- Confirm claims by reading: the code, its tests and its configuration — do
  not run the repository's code, start its services or probe it with stubs.
  Evidence is text at a commit, and running someone's code has effects
  nobody asked for. A defect you suspect from reading goes into Problems as
  a question, with the lines that raise it.
- Read `reference.md` (beside this file) before writing anything. It holds
  the field names of every construct with one YAML example each, and the
  exact shape of the review report's tables, which the model check parses
  strictly.
- Words to use (the glossary): **intended model** (the YAML in the model folder),
  **element** (a part with a stable id), **interface** (a capability a part
  offers, identified by its **contract id**), **relation** (a dependency of
  one element on another, declared by its initiator), **interaction** (a
  relation that names an interface or carries data transfers), **action**
  (`send` or `receive`, only through a topic or queue), **data transfer**
  (data moving in one direction of an interaction), **zone** (a boundary an
  element belongs to other than its parent), **evidence** (the files and
  lines a thing was written from).

## Procedure

### 1. Survey the repository

Run, and keep the outputs:

```sh
git -C "$REPO" rev-parse HEAD
git -C "$REPO" ls-tree -r --name-only HEAD
```

The commit from the first command is **the commit every evidence item pins**.
The second lists every tracked file.

Then survey the tree, and keep a note of what you found and where:

- **Documents**: `README*`, anything under `docs/` (architecture documents,
  decision records, specifications), contract and schema files (OpenAPI,
  protobuf, GraphQL).
- **Entry points and build manifests**: `package.json`, `go.mod`,
  `Cargo.toml`, `pom.xml`, `build.gradle`, `Dockerfile`, `docker-compose`,
  Makefiles, and the files they name as entries.
- Anything that looks like a deployment boundary: separate processes,
  binaries, daemons, remote helpers, data folders, configuration for
  external services.

### 2. Read the documents first; write the claims ledger

Claims come from the documents that describe the architecture: the README,
architecture documents, accepted decision records, specifications, contract
descriptions. Research notes, working plans and release notes are read for
parts the code confirms, but not transcribed.

Write one row per architectural claim **about a part of the model or a
connection between parts** — not one row per sentence. A document that
makes many claims about one part gets one row per part it describes, its
claims summarised; a decision record's status bookkeeping (supersedes,
amended) is not a claim. Why: the report is read by a person deciding which
documents are out of date, and a table that transcribes every sentence
buries the decisions.

Keep the rows in a working ledger, not yet the report. The ledger lives
outside the repository, in a temporary folder (`$(mktemp -d)` will do), and
is not part of the result — only the model and the report in the model folder
land in the repository. Read each of these documents top to bottom. For
every **architectural claim** it makes — a part, what it holds or does,
what it talks to, its technology, a plan — write its row:

- the claim, in one sentence;
- the document's path and the line or lines it is written on;
- what kind of source it is:
  - an **accepted decision record or a specification** states *intent* —
    it enters the model even where the code disagrees, and the disagreement
    is reported;
  - **descriptive prose** is a *hypothesis* — it enters the model only
    where the code confirms it;
  - an **announced plan** ("in phase 2", "we will move to") is *planned* —
    it is reported, never modelled.

A claim is architectural when it says a part exists, that a part holds or
does something, that A talks to B, what technology a part uses, or what is
planned. Style, licensing, contribution rules and build instructions are not
claims. Why: the model describes architecture, and a ledger of claims is what
makes the comparison with the code checkable by a reader later.

### 3. Confirm each claim in the code

Look for each claim in the code: entry points, wiring, imports, call sites,
registrations, schemas. Give every claim one verdict:

- `confirmed` — the code shows it;
- `contradicted` — the code shows the opposite: a part the document names is
  gone or was replaced by another, or behaves differently than written;
- `stale` — the claim was true of an earlier state and the code has outgrown
  it as stated (counts, versions, sizes that no longer hold, nothing opposite
  in their place);
- `planned` — an announced plan (you searched, and the code does not have it
  yet);
- `unconfirmed` — you searched the code and found nothing either way.

Judge a claim that makes several statements per statement: a count that
still holds beside a part the code replaced is `confirmed`, and the
statement naming the replaced part is `contradicted`; a count that no
longer holds with nothing in its place is `stale`. Why: one verdict for
the whole claim would say the code agrees with all of it or with none.

What enters the model:

- intent enters even where the code disagrees, and the disagreement goes to
  the report — why: the documents are what the owners decided;
- a hypothesis enters only where the code confirms it — why: prose is not a
  decision;
- a plan never enters the model — why: the model describes what is, not what
  is announced;
- the code the documents have outgrown is what the model describes, and the
  claim is reported with the code it was checked against.

### 4. Write down what the code shows that no document says

While you survey, note every architecturally significant part the documents
never claim: processes and binaries, stores, packages the core imports,
helpers on remote hosts, external systems the code calls. Each one enters the
model and is reported as **undocumented**. Do not model every file — a
repository's classes, utilities and tests are not architecture. Why: the
reader needs the parts that change the shape of the system, not an inventory.

### 5. Shape the model: three levels, kinds, ids

The model has three levels:

1. **Context**: the people, the external systems, and the system itself (one
   `system` element for the repository).
2. **The system's parts**: its applications, processes, services, stores,
   brokers, helpers on remote hosts — children of the system.
3. **The modules of its core**, **grouped by concern**: for a large core,
   8–10 groups. A group is a `module` element whose children are modules, or
   which stands for several packages. Do not model every package — the
   assignment table accounts for each file, the model does not have to.
   For a small core, model its modules directly.

At the third level, relations **between the groups** are the point of the
page: for each pair of groups where code of one imports code of the other,
write one relation from the importer to the imported group, named for what
the importer uses from the imported group — from the imported package's
role: "reads settings", "opens SSH sessions", "stores notes". A bare
"uses" or "depends on" is not a name: the table under the diagram is how a
reader learns what an arrow means. Give the relation one import line as its
evidence (more lines optional). Derive the pairs from the language's import
graph, not by guessing — for Go, run in `$REPO`:
`GOTOOLCHAIN=local GOFLAGS=-mod=readonly GOPROXY=off go list -e -f '{{.ImportPath}} {{join .Imports " "}}' ./...`,
mapped onto the groups by the assignment table — the variables keep `go`
from downloading modules or a toolchain, and where that fails without the
network, the import pairs come from reading the import statements instead;
for TypeScript, the import statements. Why:
a page of groups with no arrows between them says nothing, and the pairs
the import graph shows are exactly the ones evidence can support.

A page holds about five boxes and about twenty arrows at most — the
landscape is the exception, at about ten boxes: one per person, external
system and the system itself, nothing smaller. When a core
has more than about five groups, or its groups' relations would put more
than about twenty arrows on the service's page, nest: group the groups into
three or four **layers** — module elements, children of the service, each
holding two or three groups — by what they are for: the entry and the
features users reach, the local runtime, the remote side, the stores and
platform underneath, whatever fits the code. Relations stay written between
the groups; the views collapse them onto the layers. Count a page's arrows
as the rows of the table under its diagram. Why: GitHub shrinks a wide
diagram until its labels cannot be read.

Element kinds: `person`, `external`, `domain`, `system`, `service`, `module`,
`store`, `broker`. Pick the kind from what the part is, not from where it
sits in a folder tree.

`store` is for where the system keeps its data of record, whatever holds it
— a database, a file folder, or an in-memory register playing that role; a
cache, or a helper holding data briefly, is a `module`. Why: the reader
looks for where the data lives.

Ids are stable: letters, digits, dots, dashes, underscores, starting with a
letter or a digit (`orders-api`, `checkout.cart`). Never encode a path or a
kind in an id — ids must survive moves and renames unchanged.

An element's **name** is a reader's label of two to four words: "Model
endpoint", "OS keystore". The detail behind the name goes into the review
report, not into the name. Why: every level is drawn with every name at
once, and one long name shrinks the whole page.

### 6. Interfaces by capability

One interface per **capability** a part offers — an API, a topic, a table,
a gRPC service. Size them by capability, not by method or namespace: a large
RPC surface becomes about 10–15 interfaces, not one per route. Why: the model
is read at capability grain; a reader asks "what does this offer", not "which
methods".

Contract ids have the form `kind::rest`, the kind one of `http`, `grpc`,
`topic`, `queue`, `data`, `rpc`. The compiler normalizes what you write —
HTTP methods to upper case, path parameters to `{}` — so
`http::GET::/api/orders/{orderId}` and `http::GET::/api/orders/{}` are the
same contract id; keep the parameter's name, as the reference system does.
See `reference.md` for one example of each kind.

Every contract file (an OpenAPI document, a `.proto`, a schema) is assigned
to an element or excluded in the assignment table, like every other tracked
file.

### 7. Relations

Every relation is written from the **initiator** to what it depends on, and
has a `name` saying what it does in a few words ("places orders"). A
relation through a topic or queue carries `action: send` (the initiator
publishes or sends) or `action: receive` (it subscribes or receives); the
ends stay initiator → what it depends on, usually the broker. A relation
whose ends are known in more detail than another's may `refine` it. Where
the code shows the data crossing, give the interaction **data transfers**
with a direction, a confidentiality and categories.

A relation to a store, an external system or another part starts at the
**group whose code makes the call**, not at the service that contains it.
Why: the views collapse the relation back to the service at the level
above, so nothing is lost there, and the group's page keeps the arrow its
own code earns.

A relation from a neighbour **into** the service ends at the **group that
serves it** — the group whose code receives it, the handler's group — not
at the service itself, as relations out of it start at the group that
makes the call. Why: an arrow ending on the service's own frame overlaps
the arrows that end on its groups.

Before finishing, open the core's page: a level whose boxes have no arrows
between them is not finished. A hidden-coupling problem between two groups
is a prompt to look for a relation the model lacks — add it with evidence
if the code shows one, otherwise report it.

Model the dependencies you found evidence for, no more. Why: a relation
without evidence cannot be checked, and one the code does not show is
invented.

### 8. Write the evidence

Every element, every interface and every relation carries at least one
evidence item, and the model check refuses the model without one. What
evidence names, by the kind of thing (these rules are exact):

| The thing | Its evidence names |
| --- | --- |
| an element | its entry point, where it is wired together, or its public contract |
| a person element | the document line naming who uses the system |
| an external element | the text that names or reaches it — the client's construction, the configured address or variable, the call site (an external system has no code in the repository) |
| a dependency found in imports | the import line |
| an interaction at run time | both the call or send site and the handler registration when both sides are in the repository; the side that is in the repository when only one is — never an import alone |
| an interface | its contract file and where its provider registers it; where the repository has no contract file (no OpenAPI, protobuf or schema), where the provider registers it and the handler that serves it |
| an interface whose provider is external | the client's call site, and the external's documented contract where the repository holds one |
| a group of modules | where its members are wired, not a list of folders |

Each evidence item names `file` (path from the repository root), `line`, and
`endLine` for a range; plus `commit` — the HEAD from step 1 — and `blob`:

```sh
git -C "$REPO" rev-parse "<commit>:<path/to/file>"
```

Never type a blob by hand: it is 40 hexadecimal digits, and one wrong
character makes the check fail — or worse, pins the wrong text. Compute it.
The code being described must be committed before you pin: evidence names
committed text.

### 9. Write the review report `review.md`

It holds, in this order, each section under its heading written verbatim:
`## Claims`, `## Undocumented`, `## Assignment`, `## Problems`. The check
finds each table by its exact heading and parses the table strictly (the
exact shapes are in `reference.md`):

- an opening line naming the commit the model describes (the HEAD from
  step 1);
- `## Claims` — one row per document claim from your ledger: the claim, its
  document, its line or range, the commit and blob **of the document file**,
  the code you checked it against (`file:lines`), the verdict (one of the
  five words), and what the model does with it (a model id — an element, an
  interface or a relation — or `—` when nothing);
- `## Undocumented` — the findings from step 4, each with the code that shows
  it and the element or elements it became;
- `## Assignment` — one row per path: a file, or a folder (path ending in
  `/`, covering everything under it), and the element it belongs to or
  `excluded` with a reason. Every tracked file must be covered; the deepest
  row covering a file decides it. Give the model's own folder the row
  `model/ | excluded | the model and its review`. Documents go to the
  element they describe (usually the system) with the reason "read for
  claims".
- `## Problems` — every problem, each with the method that defines it, its
  source, and the ids of the elements and relations involved; then the
  questions only a reader can raise — a risk, a threat — written as
  questions, with their source, never as defects.

Why a report beside the model and not marks inside it: an element holds
several claims (that it exists, its parent, its kind) that the documents and
the code can confirm differently.

### 10. Run the check with views, and read what it rendered

```sh
(cd "$ENGINE" && bun scripts/check-model.ts "$REPO" --views "$MODELDIR/views")
```

Run it from `$ENGINE`, as "Before you start" says: `bun` reads the current
directory's `bunfig.toml`, and its `preload` runs.

Exit code 0 is a pass, 1 means something failed, 2 means the repository or
its model could not be read. `--json` prints the same report as one JSON
object if you need to read it programmatically.

Fix every error it reports and run it again — a line past the end of its
file, a missing commit or blob, a tracked file no assignment row covers —
until it exits 0. Stale items and problems do not fail the check; you
report them, you do not fix them silently.

One note is not silent material: on a repository that has documents, the
note `the review report has no "## Claims" section` means the claims table
was not read — the run is not finished. Write the table under its exact
heading and run the check again.

When it passes, open every page in `$MODELDIR/views/mermaid/` and read
each as a reader would:

- does the landscape hold about ten boxes or fewer?
- does each level say something, or is it a list?
- are the names readable at the size they are drawn?
- does a page hold about five boxes of its own and about twenty rows in
  its table at most? A page with more is not finished — nest or regroup.

Copy the check's problems into the report's Problems section, each with its
method and source and the ids it named (the check prints them). Add the
questions a reader of the pages raises — risks, threats — as questions with
their source.

### 11. Finish only on a passing check

Finish only after a run that exits 0 with the views read. Then tell the
person what the check still lists as **stale** (files changed since the
evidence was read) and as **problems**, and where the model and report are.
Leave the commit of the model and report to them — the report is what they
read to accept the work. When they commit: the model and the report, never
`views/` under the model folder — the check generates the views, and every run renders
them again.

The check reads the model from the working folder; you do not need to commit
it to run the check.

### 12. Send the model to a server, when one is named

When the person's request names the engine's server address, or
`ENGINE_SERVER` is set to one, send the checked model to it:

```sh
(cd "$ENGINE" && bun scripts/send-model.ts "$REPO" --server "$ENGINE_SERVER")
```

Run it from `$ENGINE`, as step 10 does; an address from the request goes
in place of `"$ENGINE_SERVER"`. The send runs the model check itself and
sends only a passing check's model — read from the working folder, so it
can be sent before anyone commits it.

Report what it printed: the source name and the commit the server holds,
whether `stored` or `already stored`; or the server's refusal, with its
message and field; or what exit 2 names as missing. Exit 1 is the check
failing and nothing was sent — fix and re-check as step 10 says, then run
the send again. Do not retry a refusal unchanged: the server has refused
that exact model.

Without an address, send nothing, and say in the report how to send later:
the command above, with the server's address in `--server`.

## If a run fails

A failed run leaves the previous model and report as they were in git. Your
files are worktree changes, never commits: until the check passes, an old
one is one `git -C "$REPO" restore model` away — restore puts back
only the tracked files — and a repository with no model yet must not keep a
half-written one. So stop only in one of two states — the check passes and
the new model and report stand, or the previous state is restored:
`git -C "$REPO" restore model`, then `git -C "$REPO" clean -fd model`
for the files this run created — name them, and never clean a file the run
did not create. Write nothing outside
the model folder (`model/`): the views go to `$MODELDIR/views`.

## Updating the model for a pull request

The model is updated inside each pull request, by the author's agent,
from the branch's changes: small increments are cheaper than a later
catch-up, and the reviewer reads the model's change next to the code's.
The update is committed in the same pull request as the code.

### 1. Read the inputs

```sh
git -C "$REPO" merge-base <base branch> HEAD
git -C "$REPO" diff --stat <base>..HEAD
git -C "$REPO" log --oneline <base>..HEAD
```

The first command prints **the base**; the branch's changes are every
commit after it. Read the branch's diff (`git -C "$REPO" diff
<base>..HEAD`), the pull request's description when one is given — the
author's words say why the change exists — and the model and report as
they stand. The code must already be committed on the branch: evidence
pins the branch's HEAD, and uncommitted work cannot be pinned (see
"Before you start").

### 2. Run the model check first

```sh
(cd "$ENGINE" && bun scripts/check-model.ts "$REPO" --rev HEAD --views "$MODELDIR/views")
```

Pass or fail, it lists **stale** items and **unassigned files** — exactly
the places where the branch touched the model's evidence and its
assignment. That list, with the diff, is the update's work list.

### 3. Decide per changed area: architectural or not

- **Architectural** — a part added, removed or moved, a new dependency
  between groups, a new interface or contract file, a new store or
  external — change the model: add, remove or change the element, its
  relations and its assignment rows, every new evidence item pinning the
  branch's HEAD.
- **Not architectural** — a function body, a test, a comment — leave the
  element alone and only re-pin its stale evidence whose text still
  supports the claim: read the new lines, write the new line numbers,
  the branch's commit and the new blob. Move an item whose supporting
  text moved.

Why: the model describes architecture, and re-pinning is how the update
says the file changed and the fact stands.

### 4. Change nothing the branch does not concern

Keep every id, name and assignment the changes do not concern; never
renumber or rename to tidy. A removed part whose intent a decision record
or specification still states keeps its element — intent enters even where
the code disagrees, as in the first run, and the disagreement goes to the
report. Any other removed part: remove its element, its relations and its
assignment rows. A new folder: an assignment row — to an element, or
`excluded` with a reason.

Why: the report, the views and later updates cite these ids; churn the
branch did not ask for buries the change that matters.

### 5. Re-read what the branch touched

For each document changed on the branch, re-read its claims and update
their rows in the claims table — the verdict where the code moved, the
branch's commit and the document's new blob. Then re-judge every other row
the branch touched: a row whose "Checked in code" file the branch changed
or removed, and a row whose "In the model" id the update removed — their
verdicts may no longer hold though their documents stand. Every
`file:line` citation in the report — "Checked in code", Undocumented,
Problems, the reader questions — naming a file the branch changed is
re-read and written at the file's new lines, and the report's opening line
names the branch's HEAD: a citation to a line that moved points a reader
at text it no longer says. A row and a citation nothing touched stand.

### 6. Write the update section

`## Update <base short>..<head short>` — the short hashes from
`git -C "$REPO" rev-parse --short=7 <commit>`, never sliced by hand —
newest last, one per update: the range; the pull request's title, if known;
and what changed in the
model and why — elements, relations, interfaces added, removed or
changed, how many evidence items were re-pinned, new assignment rows —
naming ids. A branch with no architectural change says so in one line.

### 7. Run the check with views, and finish

```sh
(cd "$ENGINE" && bun scripts/check-model.ts "$REPO" --rev HEAD --views "$MODELDIR/views")
```

Fix every error until it exits 0, and read each page the update touched
the way step 10 above reads a page. Then commit the model's change —
the model's `*.yaml` files and `review.md`, never the `views/` under it: the views
are generated by the check, and the next run renders them again — in the
same pull request as the code's.
