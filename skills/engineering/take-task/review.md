# Final review of a stage

Review the assembled stage after its tests and mutation checks, not each worker
separately. Give reviewers the base and final revisions, the combined diff, the
task criteria, the spec or short delta, the original bug symptoms and the
project's standards. They read the requirements and the change themselves,
not the implementer's conclusions.

The reviewer is a reviewer on a different model that can be reached from this
harness, chosen by the ways the set's [agents.md](references/agents.md)
reference lists: a subagent with a model override, where the harness can start
one; an external agent CLI; an API. The project's config records the choice
(`reviewPreference`, `reviewFallback`), and the recorded fallback is used only
as agreed: a recorded way that stops working is a repair the owner is told
about, not a silent fallback. Two agents on the same model are not another
model. Without an independent reviewer, do separate self-review passes, say
so, and follow the project's acceptance policy.

Cover both sides, with parallel reviewers where useful:

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

Fix within scope, verify the final result and re-review what the fixes touched.
Never close on a review of an older revision. Say which tests and review checks
were repeated after the fixes and which still-valid evidence was kept.
