# Final review of a stage

Review the assembled stage after its tests and mutation checks, not each worker
in isolation. Give reviewers the base and final revisions, the combined diff,
task criteria, relevant full or short spec, original bug symptoms, and project
standards. They must inspect the requirements and change themselves, without
being led by the implementer's conclusions.

Prefer a different model when the harness and project settings permit it.
Different agents do not necessarily mean different models. Without an
independent reviewer, use separate self-review passes and disclose that limit;
follow the project's acceptance policy rather than claiming independence.

Cover both axes, with independent reviewers in parallel where useful:

- **Behaviour and requirements:** missing or incorrect behaviour, unwanted
  scope, regression risks, task interactions, failure handling and whether
  the tests would detect the important failures. A bug or short change is
  reviewed against its criterion and source requirement even without a full spec.
- **Standards and maintainability:** documented project rules, clear ownership
  and interfaces, unjustified coupling or duplication, unnecessary complexity
  and changes that make the next likely change harder. A stylistic preference
  is not a blocker; do not prescribe an abstraction just because two lines match.

Each actionable finding names its consequence, severity, location and evidence.
Keep original reports available, then produce one deduplicated disposition:
fix now, already addressed, rejected with reason, or additional work filed.
Separate acceptance blockers from optional improvements.

Fix within scope, verify the final result and re-review affected areas.
Do not close on a review of an older revision. Retain evidence that is still
valid, and state which tests or review checks were repeated after corrections.
