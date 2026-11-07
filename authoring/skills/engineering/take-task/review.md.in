# Final review of a stage

Review the assembled stage after its tests and full checks, not each worker
separately. The stage's mutation run goes beside this review, not before it —
its results are a reading of test strength, not a gate the review waits
behind, by **The path is what the next step consumes**. Give reviewers the
base and final revisions, the combined diff, the
task criteria, the spec or short delta, the original bug symptoms and the
project's standards. They read the requirements and the change themselves,
not the implementer's conclusions.

Choose the independent reviewer by the canonical
[reviewer policy](references/agents.md#a-reviewer-on-another-model), using the
project's recorded preference, agreed fallback and acceptance policy. Without
an independent reviewer, do separate self-review passes, say so, and follow the
project's acceptance policy.

Cover both sides, with parallel reviewers where useful:

- **The frame the work serves:** whether the change still serves the outcome
  frame the work was specified from, the decisions the owner has given and the
  product reason behind it, by
  [`references/design.md`](references/design.md)'s **Review before building**,
  which is asked before the rest. A finding here goes to the owner as the
  frame to settle, not into another round of fixes.
- **The checks the change touched:** every changed test, expected value, skip
  mark and new suppression, read against the requirements the change moved, by
  [`references/checks.md`](references/checks.md)'s **A check changes only with
  the requirement it encodes**. A check that got weaker is a blocking
  finding.
- **Behaviour and requirements:** missing or wrong behaviour, unwanted scope,
  regression risk, interactions between tasks, failure handling, and whether
  the tests would catch the important failures. A bug or short change is
  reviewed against its criterion and source requirement. A changed signature,
  return value or behaviour is followed to every caller, in code the diff does
  not touch too: that is where a change breaks unseen.
- **Load:** what is right for one user and wrong for many: a check followed by
  a write that another process can slip between, a query per item, memory or a
  list that only grows, work every process repeats, state kept per process that
  must be shared. Judged against the load the project expects, which the
  reviewer finds in the project and states.
- **The design the change builds on:** where the change introduces or
  changes a building block, an interface, ownership of state, a runtime
  interaction, an external dependency or an interface surface, the review
  reads it against the design's decision records
  ([`references/design.md`](references/design.md)) and against the quality
  attribute scenarios the design recorded: whether the change still meets
  each scenario, and whether every scenario a machine could judge became a
  check instead of a hope. Where the change adds or replaces a mechanism, the
  reviewer does not take its description for it: they search the revision for
  every way that job is reached — entry points, stores, workers, commands,
  pipelines — and read the change against the project's recorded decisions, by
  [`references/building.md`](references/building.md)'s **One surface per
  capability** and **Find before writing**. A second way in beside the one a
  decision put there, or a retirement the plan promised and the revision does
  not carry, is a blocking finding, and so is a change that contradicts a
  recorded decision without saying so.
- **Diagnosability:** whether failures explain themselves: errors carry their
  causes, logs follow the project's levels and carry request and trace ids
  where requests cross components, no secrets or personal data are logged, and
  a failing test or CI job would say why without a rerun.
- **Standards and maintainability:** the project's documented rules, clear
  ownership and interfaces, unjustified coupling or duplication, needless
  complexity, and changes that make the next likely change harder. A style
  preference is not a blocker; two matching lines do not demand an abstraction.
- **Documents that describe the present:** whether the agent doc, the glossary,
  the current specs and the architecture are still true of the final revision.
  A statement this change made false is a finding that blocks acceptance.

Each actionable finding names its consequence, severity, location and evidence,
and its evidence is a concrete case: this input or situation gives this wrong
result. A worry with no case is not a finding; the reviewer rereads the lines
to confirm the case is real before reporting it.
Keep the original reports, then produce one deduplicated list with what happens
to each: fixed now, already addressed, rejected with a reason, or filed as
further work. Separate what blocks acceptance from optional improvements.
Where the list reaches the owner, its findings are numbered, so one can be
answered by its number, and each says in the owner's words what the code does,
what goes wrong, the fix, and what happens if it is left.

The rounds converge by the protocol's
[**One review, then approval with comments**](references/running.md), which
says what blocks acceptance, what a fix is verified against, how a round ends
and the decision its verification examples expect.
