# shady2k-skills: light process skills, and the gate that makes them binding

**2026-09-17. Design conversation with the owner, recorded after the fact.** It
took place in nocx, the owner's terminal project, whose backlog is the evidence
throughout; "the origin" below means that repository.
Status: the protocol below is decided. The seven backlog skills and `handoff`
are written; the installer has been run once, in the origin; layer 3, the
harness hooks, is not built. §1 and §2 are the record of the conversation and
are left as they were said; from §3 on the document is kept current.

## 1. The owner's idea, as stated

A set of skills for our terminal that is usable **in any harness, not only
ours**. Matt Pocock's skills are the reference for weight: superpowers and
spec-kit are too heavy, and a light set is wanted.

The problem with light skills as they exist: **they oblige nothing.** They can
be invoked at any moment or never, and when nobody invokes them no process is
followed. The evidence is in the origin's own tracker, where tasks are
scattered, half are stale, and so many epics were created in advance that they
could never all be built — many having lost their point precisely because they
were created ahead of time.

Two situations, and they need different treatment:

- **A new project**, started from nothing.
- **Digging out an existing mess.**

What the set has to carry:

- **Specifications, but not only specifications.** A spec alone is too narrow;
  business requirements and the vision belong with it.
- **Ideas.** They should reach the tracker without disturbing the main line of
  work: an idea may lose its point, and then it is closed and forgotten.
- **A flow with an order** — what stage follows what — because work jumps
  around. What has lost its point is closed or re-attached, which needs a real
  dependency graph rather than a pile.
- **Short epics.** Ours do not close in one session and sometimes run for days.
  They should be split by phase or some other criterion.
- **Milestones**, which the tracker does not have; labels were suggested for
  them.
- **Any tracker.** Working with the tracker is a separate skill we do not look
  inside.
- **Assignment to agents**, not just to a human author, because orchestration
  is nearly ready: agents will take free tasks and run them autonomously.
- **A flow for that autonomy**: the specification is written first, with the
  user; after that tasks are taken and done without them, and a problem is
  escalated to the coordinator, who takes it to the user.
- **A horizon.** Writing every spec up front is impossible — half would go
  stale. Decompose a short stretch in detail, keep a vision beyond it, and know
  what the next version contains.
- **Protection from the mistake that keeps happening**: bugs and architectural
  gaps found mid-flight are inserted at the front and push the feature out by a
  week or two. The user should be made to think about this in advance and be
  stopped from doing it.
- **Watching the tracker**, eventually from harness hooks, so the user and the
  model are reminded to keep issues current.
- **Names, never identifiers.** A person does not think in identifiers and
  cannot remember them; the model keeps assuming they can.
- **A wiki**: the system's current state, the stages it went through by
  feature, so one can look back. And **ADRs**, so the reason behind a decision
  survives.

Open at the time: whether we need our own tracker, a central one, or one built
into the product.

## 2. Diagnosis: skills are not the problem

Measured in the origin the same day: **933 issues open, 773 of them
reported ready to work**, across 665 independent roots. 82 of the 83 in progress
had not been touched in over two days. 399 open items had not been touched in
thirty. No milestone label existed; `mvp` and `phase-1/2/3` were the de-facto
roadmap.

773 of 933 "ready" is not a queue, it is a dump with an index. A status that is
false 99% of the time is not a status. Both say the same thing: **there is no
invariant that cannot be broken, and no moment at which anything is checked.** A
skill cannot fix that, because a skill is advice rather than a gate.

So the conclusion is not "heavier skills". It is: build the gate, and let the
skills stay light.

## 3. Four layers, and only one of them is skills

### Layer 1 — the schema: what cannot be created

```
Vision          a document, not an issue
Milestone       a slice; a label in a tracker without milestones; has a date and a budget
Feature         a root epic: what someone can do that they could not before
Stage           an epic; a few sessions at most; its own DONE WHEN
Task / Bug      one session
```

Plus two lanes **outside** the flow:

- **Ideas** — no parent, no edges, deferred, with a review date. Never in the
  ready queue. Closed without regret when they stop being interesting.
- **A budget for findings** — a declared slice of each milestone for bugs and
  architectural debt. This is the answer to "found work pushes the feature out":
  work found beyond the budget does not silently go to the front; it goes to the
  next milestone or displaces something explicitly, and that is the owner's
  decision rather than a side effect.

### Layer 2 — the gate

One check that reads the tracker's export and fails. In pre-commit and in CI.
**This is what binds.** What it enforces today, each rule with a fixture that
violates it:

- everything live belongs to the current milestone, and what does not is
  deferred: that is the **horizon**, and it is also "no orphans";
- ideas stay deferred and block nothing;
- findings stay within the milestone's budget;
- exactly one area label, and no label outside the declared vocabulary;
- a feature or a stage has a DONE WHEN;
- nothing is held that nobody is holding;
- no edge onto a deferred issue, no cycle in the parent chain;
- and, as a warning only, an edge onto a blocker nobody has touched in weeks or
  that no longer exists. It measures the blocker and not the edge, because few
  trackers date an edge.

Designed and **not yet enforced**, so still advice: that the next milestone is
decomposed no further than features, that no blocking edge sits on a feature or
a stage, and that a title is a sentence. Each needs a rule and a fixture before
this document may call it a gate.

### Layer 3 — harness hooks

Session start injects the current milestone **by name**, what you are holding,
how much has gone stale. Stop and pre-compact release holds. This is the
"remind the user and the model" the owner asked for. **Not built.** Until it
is, the reminder is a few lines in the project's agent doc pointing at the
project's backlog integration and naming `/to-backlog` as the way a new issue
gets in, which the installer adds.

### Layer 4 — the skills

Light, each with one entry and one exit:

| skill                  | in → out                                                                     | invoked by |
| ---------------------- | ---------------------------------------------------------------------------- | ---------- |
| `setup-shady2k-skills` | configures a project for the set: installs the gate, then proves it          | the user   |
| `ask-shady2k`          | state → the one command to run next; absorbs "what do I take"                | the user   |
| `to-milestone`         | vision and business requirements → a milestone charter with a finding budget | the user   |
| `to-stages`            | one outcome → stages and tasks with assertion-shaped criteria                | the user   |
| `to-backlog`           | incoming → a lane (work / bug under a stage / idea)                          | the model  |
| `close-out`            | close with evidence, re-parent findings, publish                             | the model  |
| `groom-backlog`        | dig out a mess                                                               | the user   |
| `handoff`              | this conversation → a fresh session, with nothing committed                  | the user   |

`handoff` is the one skill outside the backlog: it lives in its own bucket, uses
the project's backlog integration when the agent doc points at one (it calls
`close-out`) and works without it.

**The set is `shady2k-skills`** — the owner's own, as `mattpocock-skills` is its
author's, and that set is the reference for shape: a name says the action or
names the result (`to-*`), the installer is `setup-<set>`, the router is
`ask-<set>`. Almost everything is user-invoked and so costs no context; the
router cures the memory load. Only what an agent must reach unprompted —
filing a finding, closing work — is model-invoked.

The first draft had eight, under bare names (`setup`, `shape`, `spec`, `next`,
`land`, `triage`, `groom`, a router). `next` went into the router, which already
reads the state and says what to take. `land` already means merging a branch
here. `triage` became `to-backlog`: the name says where a thing ends up, and
sorting is only how it gets there. `to-stages` is written last and only if needed: the gate checks the shape
of a result whoever produced it.

Names are English, like everything committed here. `spec` is not "too narrow"
once `shape` holds the business and the vision and an ADR holds the why: three
documents with three lifetimes.

## 4. The gate is generated, and proved by fixtures

**The owner's decision:** the gate is a skill, because we do not know the user's
environment. The skill explains what must be validated and the model writes the
wiring for that project's specifics.

**The trap, and it is worse than having no gate:** a generated validator that
silently passes everything does not merely fail to catch — it certifies. The
origin has the lesson twice already: a criterion written on `deadcode
-filter` is unfalsifiable, and a gate people learn to skip with `--no-verify`
protects nothing.

So the installer ships a **corpus**, not just a spec:

```
check.mjs         the rules, each with why it exists and the move that clears it
model.md          the normalized backlog — the only thing the rules know
fixtures/bad/     backlogs that violate exactly the rule they are named for
fixtures/good/    backlogs that must pass
protocol.md       the protocol; copied into every skill that uses it, never into a project
integration.md    the seed of the project's backlog integration: the gate, the tracker operations
```

The rules stay in one file rather than one per rule: a project without Node
ports one file, and the fixtures are what prove the port.

The last step of installation is not "I wired it in" but **running the fixtures
and showing the table**. If the generated wiring passes a backlog known to be
bad, that is visible in the minute of installation rather than in a month.

Three layers of ownership, or three projects grow three validators with three
bugs:

| layer                                   | written by            | lives          |
| --------------------------------------- | --------------------- | -------------- |
| the rules                               | the plugin, identical | update with it |
| the adapter (tracker → normalized JSON) | the model at setup    | in the project |
| the wiring (pre-commit, CI, hook, cron) | the model at setup    | in the project |

### Gate strength is the user's choice

The owner's decision: let the user pick. Three values, not two, or "non-blocking"
becomes "off":

- `block` — a red gate fails the commit;
- `block-new` — fails only what this commit created or changed; old debt is a
  report. **Recommended, never defaulted**: the rules refuse to run with no
  strength chosen.
- `report` — never fails, but the result is always visible.

Two conditions. It is **asked once at setup, with the price of each explained** —
a setting nobody was asked about is a setting everyone leaves at its default
without knowing they chose. And `report` never means silent: the gate can be
switched off, the report cannot, or in a month there is a red gate nobody
remembers.

## 5. The tracker adapter

One skill is the **only** place that knows the tracker's verbs — roughly twelve
capability verbs: create, link, claim, release, close, ready, children, label,
rollup, search, defer, export. The other skills call only those.

The abstraction is by **capability**, not by command: the adapter declares what
the tracker can do — hierarchy? a dependency graph? labels? — and the protocol
either maps onto it (milestone → a label here, a milestone there, a cycle
elsewhere) or refuses honestly. Porting is one file.

As built, that place has two halves. Reading is the project's adapter script,
proved by counting against the tracker's own numbers. Writing is the "tracker
operations" table of the project's backlog integration, and it was first built
as a table of commands of our own, which is exactly the looking inside that §1
ruled out: in the second install it sat beside the project's own tracker doc
and disagreed with it, and ours was the wrong one. So the table now says what
the skills ask for, points at the tracker's own doc or skill for how, and
carries a command only where nothing else does; and every reading verb is run,
and checked for answering the question asked, before it is written down.

## 6. Domain-agnostic: this is not only for development

The owner wants the same protocol for DevOps backlogs. That costs one renaming:

> **Outcome — what becomes possible or true, and who observes it.**

Development: "a person creates a connection group". Operations: "a rollback is
one command and one minute", "a disk-full alert reaches the on-call within five
minutes". The same shape, and it stops being false exactly once just the same.
Assertion-shaped criteria carry over too: for operations the evidence is a
runbook that ran, an alert that fired in a drill, a dashboard showing a value.

**What counts as evidence at close is the project's config, not the protocol's
rule.** Everything project-specific lives in one file:

```yaml
vocabulary: [...] # area labels — this project's, whatever they are
evidence: [...] # what may be cited when closing
horizon: 1 # how many slices ahead may be decomposed
```

The rules know none of those words. They check "exactly one label from the
declared set", "evidence of one of the declared kinds".

## 7. The map: three artifacts, three authors, three rates of rot

| what                                | author              | rots      | where         |
| ----------------------------------- | ------------------- | --------- | ------------- |
| Vision — where we are going         | human, rarely       | slowly    | a document    |
| Milestone charter — in, out, budget | human, per slice    | medium    | a document    |
| **Where we stand, and the front**   | **machine, always** | **never** | **a command** |

A hand-written "what's next" is a lie within a week: 399 stale open items are
that lie materialised. A purely generated forecast cannot say why. So the
forecast is **charter (human intent) + rollup (machine truth), rendered by one
command**. A hand-maintained roadmap file does not exist in any form.

The origin already holds the rule — "where it stands is a command, not a
paragraph" — as a status script computed from the tracker's edges, and its
planned status screen is the graphical form of the same command, reading the
tracker rather than a document.

**No own tracker.** The split is already chosen and half built: the tracker
stores, the product displays. Building a tracker replaces a protocol with a
product.

## 8. Names, not identifiers

Not cosmetic: it is an output rule. **Everything a human reads is "Title" (id)**,
with the id in parentheses and only where someone must act on it. The gate
rejects a title you cannot understand the task from.

## 9. The router

The owner asked for the equivalent of `ask-matt`: ask which skill fits the
situation. Ours should be better than its model in one respect — `ask-matt` is
static prose describing every route. **Ours reads the state first and answers
with one command:**

```
> the slice was declared 12 days ago, its finding budget is spent (7 of 5)
> you are holding 3 issues older than a day
> the gate reports 2 new errors: two features with no DONE WHEN
>
> first:  release  — let go of what you are not holding
> then:   groom    — the budget is blown; decide what leaves the slice
```

One answer, not a map of routes. It is also where a red gate surfaces: not "here
are eight skills" but "fix this first".

## 10. Digging out is not a review of 933 issues

Declare the current slice, attach what is actually being worked on, and **defer
everything else with a review date**. Not close — deferring is not a judgement
about truth, and a defect nobody reproduced in a fortnight describes a build
that no longer exists rather than an imaginary defect. What is needed comes back
by itself, through a bug, a spec, or a question. What has not come back in a
quarter was not needed.

Executed the same day: ready 773 → 28, open 933 → 71, deferred 23 → 963, zero
unheld holds, 665 live roots → 4. Nothing closed; every move reversible.

## 11. The rules, each bought by a case

1. **An idea does not block a build.** Five brainstorms were holding live epics;
   that makes them undecided questions, not ideas.
2. **An idea does not reach the work queue.** Three arrived there through
   provenance edges, which gate nothing and so never stopped them.
3. **A bug rots faster than a feature.** 306 open bugs described a build that no
   longer existed.
4. **An edge outlives its reason.** One epic held live work for 45 days while
   sharing no file with it. Nothing expires edges.
5. **An edge onto an epic whose remaining children are deferred blocks for ever,
   silently.**
6. **A milestone that is not current is deferred, not open**, or the queue
   offers next quarter's feature as today's work.
7. **An epic that can absorb any new bug in its area is not an epic.**
8. **A vocabulary held up by prose drifts.** A closed list was declared in the
   contract; about seventy labels were in the tree.
9. **A bulk edit forges its own evidence.** Deferring 802 issues rewrote 802
   timestamps, and the next analysis reported epics untouched for 45 days as
   active today. Ages must be read from a snapshot in version control. **This is
   a rule about the gate itself**: its first bulk operation would otherwise
   blind the next run.
10. **Search the behaviour, not your name for it.** A split-panes epic was filed
    twice because the searches were "split", "pane" and "panes" while the
    existing issue was titled "Drag one tab onto another and watch both at once".

11. **A finding spends a budget, or it spends the ship date.** Bugs and debt
    found mid-flight went to the front one at a time, each reasonable, and
    pushed features out by a week or two that nobody decided on. This one was
    the owner's from the start; it became a rule when the skills needed it to
    be checkable.

## 12. What was built first, what was wrong with it, and what it became

The first draft was a skill called `gate`, inside the origin's own tree: rules
1–10 as ten checks over a normalized model, with an adapter, fixtures and a
self-test. It measured something: against the pre-grooming export, 321
violations across six checks; against the groomed tree, 27 across three.

Two things were wrong, and a third was claimed at the time and is not:

1. **`gate` was a name outside the set.** The gate is what the installer
   installs, not a skill of its own.
2. **The project lived inside the skill**: a config of the origin's labels and
   an adapter for the origin's tracker, both exempted from the guard meant to
   keep the project out. And the skill itself lived inside the project, which
   is the same mistake from the other side.
3. _Not wrong:_ that the rules are a fixed implementation. §4's own table says
   the rules ship identical everywhere; what is generated per project is the
   adapter and the wiring.

It is now [`setup-shady2k-skills`](../skills/backlog/setup-shady2k-skills/SKILL.md)
in this repository: the rules, the model and the fixtures unchanged in
substance, `SKILL.md` rewritten as the install process (explore, ask, write,
prove), the three strengths implemented in `check.mjs` and proved in its
self-test, and the guard widened so that neither a project's nor a tracker's
name may appear in any file of the skill. `npm test` runs that guard against
the origin's words, which are the ones most likely to leak.

What happened after that, in order. A reader who had not written the skills
walked a new project and a 900-issue mess through them and found the router
sending the mess to the wrong skill, `to-milestone` deferring the slice that
grooming had just declared, and a gate that let a parentless issue through. A
second reader, a different model, was asked to construct backlogs that prove a
check wrong: three rules the design called enforced were only warnings,
`block-new` judged the past by today's config, a typo in `--only` ran no check
and exited green. Then the first real install, in the origin, by a session that
had not written the installer: it left files staged in a shared checkout and
another session's commit carried the half-proved gate onto the main branch.
Then the second install, in another project, which followed the cure for that
(a branch in a worktree of its own) to the letter, reported "installed" with
nothing committed, and stopped: the next session, in the main checkout, found
no backlog doc and sent the owner to install again. The installer had no step
for landing what it wrote, so it got one, and "installed" now means the doc is
on the branch people work from. The same install wrote a reading verb it had
not run, with a flag that belongs to another subcommand.
Each of the four changed the text or the code, and the commits say how.

That install also put the question the owner then asked: why does the set hang
on a file at all? Every skill had opened by naming `docs/agents/backlog.md`, so
the session's first act was to list a directory, and a missing file was read as
"not installed" while the gate's hooks were already running in that very clone.
And the file held the protocol, which is the set's and not the project's: a
copy in every project that no update of the set would ever reach. A second
opinion from another model agreed on the direction and corrected the means: a
protocol spread by hand through six skills drifts, and a path out of a skill's
folder breaks where skills are installed one folder at a time. So since 0.5 the
protocol ships as an identical copy inside each skill that uses it, held by a
test; the project keeps only a "backlog integration" section in its own
tracker doc, reached through a pointer in its agent doc; changing values stay
in the gate's config alone; and "is it installed" is asked of the gate.

## 13. Still open

- How agent assignment is expressed in the protocol — the owner named it as a
  requirement and it has not been designed. The model carries an optional
  `holder`, and the seed asks what happens when two claim at once; that is all.
- What the review date on a deferred idea does when it arrives, given that an
  automatic return would rebuild the swamp.
- Layer 3, the harness hooks, and whether the installer can generate them for
  harnesses other than the one it runs in.
- The three rules that are still advice (§3, layer 2).
- A project with no Node: the port has never been attempted.
