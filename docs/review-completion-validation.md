# Ready for review: bounded review completion

Local branch fix/tracker-sync-races, based on the preserved template branch.
No push, pull request or release is authorized or performed.

## Runtime fix

Commit 2e5616b closes skills-z4zm. The old b19ca87 record failure was reproduced
with a controlled push barrier, not a timing sleep: rollback removed an unrelated
committed live write. Record now shares isolated preparation, lost-ack
reconciliation and accepted integration with conditional writes. A rejected
record is never exposed by an ordinary live publisher. Captured revision/state
are reused across retries even when code HEAD moves. Identity checks, dependency
exit 2, immutable recordings and eventual convergence remain.

The extended fixture also verifies tracker-sync.version generated beside an
installed copy. No such file belongs in the shipped source. Plugin 0.112.0
recorded the runtime change; layout hashes were refreshed; setup stays 0.45.0.
Exact historical proof accounting is in recording-race-validation.md.

## Normative fixes

Skills-u9vy: one full review still suffices. Targeted verification blocks a new
regression introduced or exposed by the repair in affected behavior/dependencies.
Unrelated nits do not restart review; two failed verifications still return to
design/owner; an older reviewed revision cannot close the current one.

Skills-chs5: an already-exists reply prompts authoritative lookup, then comparison
of immutable identity and the expected result of that action. Same-name wrong
commit/digest/head/base/checksum/environment is a conflict, incomplete is pending,
failed/cancelled is failure, unreadable is unknown. None is arbitrary success or
permission to overwrite/repeat. PR creation and PR merge have different expected
results. Message intent/outcome handling stays unchanged.

Both edits are in authoring sources. The previously untemplated take-task
review.md now has a .md.in owner in the catalog; its existing duplicated reviewer
setup paragraph was replaced with the canonical agents reference, retaining the
self-review/acceptance duty and enforcing that consumer in the ownership gate.
No output paths or installer discovery change. Plugin 0.113.0 records this
behavior change; no setup checks, config or adapter duties changed.

## Evidence and limits

There are 6 review and 11 external-effect reference scenarios, including positive,
conflict, pending, failed/cancelled and unknown cases. Deterministic tests guard
the normative clauses and expected scenario dispositions, and fail when clauses
are removed or dispositions reversed. They are source-contract tests and
behavioral reference cases, not model execution or model adherence evaluations.
No model eval was run or claimed.

Independent read-only reviews covered record isolation, retry and identity;
normative scope, recovery semantics, ownership and links. Identified missing
runtime mapping, retry recapture and terminal-failure coverage were corrected.
Affected existing recording/hook proof: 22/22 real assertions, plus 16 separate
mutant observations. Extended tracker races 22/22 and workflow contract 5/5 passed
in the existing isolated Linux image (27/27 together). The pre-existing process
stop assertions remain unchanged.

Final full Mac suite: exit 0. Build/ownership/workflow tests 15/15; tracker
races 22/22; tracker proof 83/83 across 43 cases plus 44 intentional mutant
observations (20 pass, 24 expected fail); Node contracts/product/model/runs 163/163;
Pi contract/stdio 5/5. Freshness/links/duplicates/ownership cover 303 generated
files; setup-lock matches 28 general installed files and 3 layout files. Command:
`RUST_LOG=error TMPDIR=/private/tmp npm test`, with native process-list access.
Full log: `/tmp/review-completion-full.log`. The final failed/cancelled scenarios
also passed the Linux source-contract run 5/5. No production code or policy changed
after this final full run. Claude strict validations
passed in disposable HOME/config directories. No new tools/images installed.

## Publication blockers

Before push, required Linux Codex and omp install/update smoke need bubblewrap
and their Linux CLIs; those were absent in inspected environments. Actual Pi CLI
and Prime startup smoke also lack supported runtimes (Prime additionally needs
its prepared kernel environment). Local Node/Pi contract/stdio tests are not
substitutes. Obtain an agreed prepared environment or authorization to provision
these dependencies, run those checks, then separately authorize push/PR/release.
Mutation async policy, timeout forecasts and cross-machine claim guarantees were
not changed.
