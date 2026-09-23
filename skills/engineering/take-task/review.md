# Final review of a stage

Review the assembled stage after its tests and mutation checks, not each worker
separately. Give reviewers the base and final revisions, the combined diff, the
task criteria, the spec or short delta, the original bug symptoms and the
project's standards. They read the requirements and the change themselves,
not the implementer's conclusions.

Prefer a different model where the harness and settings allow; different agents
on the same model are not that. Without an independent reviewer, do separate
self-review passes, say so, and follow the project's acceptance policy.

Cover both sides, with parallel reviewers where useful:

- **Behaviour and requirements:** missing or wrong behaviour, unwanted scope,
  regression risk, interactions between tasks, failure handling, and whether
  the tests would catch the important failures. A bug or short change is
  reviewed against its criterion and source requirement.
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

Each actionable finding names its consequence, severity, location and evidence.
Keep the original reports, then produce one deduplicated list with what happens
to each: fixed now, already addressed, rejected with a reason, or filed as
further work. Separate what blocks acceptance from optional improvements.

Fix within scope, verify the final result and re-review what the fixes touched.
Never close on a review of an older revision. Say which tests and review checks
were repeated after the fixes and which still-valid evidence was kept.
