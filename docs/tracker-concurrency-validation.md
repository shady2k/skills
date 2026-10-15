# Tracker concurrency fixes (local, unpublished)

Branch `fix/tracker-sync-races` starts at `daa8399`; template work remains on
`build/skill-templates`. This is a bounded correctness change, not a new
cross-machine exclusivity guarantee. The accepted eventual-convergence behavior
and existing claim-race assertions remain unchanged.

## Conditional operation choice

Two implementations were considered: holding the store lock through a network
push, or preparing a separate candidate and integrating acceptance under a short
local lock. The owner chose the second. The first would block unrelated local
writers for network timeouts/retries. The chosen implementation snapshots under
the lock, imports the candidate database, evaluates the condition, and pushes an
immutable object outside the lock. Rejected candidates never replace live HEAD
or live database. Acceptance merges with current exported live state under the
lock. A lost acknowledgement triggers a fetch and ancestry check of the exact
candidate; if confirmation is unavailable the result is UNKNOWN, with its oid,
not a claim that no remote effect occurred.

Each attempt retains `candidate-<uuid>.result.json` beside the live store, with
phase, pid, creation time, oid and measured file/byte/snapshot/import costs.
Uncertain candidates also retain their object through an own Git ref. Diagnostics
contain no environment values or recipe output. Normal failures remove only the
attempt's own worktree. SIGKILL cannot run finally: it leaves the candidate and
its diagnostic for inspection; later attempts use fresh IDs and do not scavenge
or delete it. There is no automatic broad cleanup of other worktrees.

## Recipe compatibility and cost

The shipped br and fake recipes operate relative to the supplied store cwd and
`pointer.env`. Shell quoting, expansions, multiple assignments and unset remain
supported. Inherited routing is rebound before candidate import/claim/export.
Symlinks fail closed before conditional writes. Absolute live paths in declared
commands, routing values and conventional text configuration also fail closed.
This is not a sandbox for malicious recipe executables: custom recipes must obey
the existing store-scoped cwd/routing contract. SQLite binary contents are not
searched for path strings; br legitimately embeds local paths there.

Snapshot work is O(store bytes) and imports rebuild a separate database on every
attempt, including retries; it is not free. Per-attempt measurements include file
and byte counts, snapshot milliseconds and import milliseconds, excluding worktree
creation, export, merge, Git and network time. On the independent real-br fixture: 24 files / 370,663 bytes, 5 ms snapshot,
725 ms import, 2,112 ms whole claim. These are small-fixture measurements, not
a production latency promise.

Plugin version rises to 0.110.0. Setup remains 0.45.0: no installed check,
configuration or adapter duty changes; tracker-sync is one of the separately
hashed layout files. Projects using this layout update that helper through their
existing layout update path. Custom symlink/external DB recipes need review
before conditional operations; normal shipped recipes do not require new setup.

## Baseline classification

The historical 83/120 tracker summary combined intentional mutant failures with
real assertions. Of 37 raw FAIL observations, 24 were expected observations of
broken variants, eight were clean failures and five were mutation-proof failures
caused by those broken clean baselines. Reporting now separates mutant
observations from clean and mutation-proof verdicts without changing assertions.

Clean hooks-path and br settings/relink/deletion/pointer families exposed actual
macOS `/tmp` versus `/private/tmp` canonical-path bugs. Paths are now canonicalized
for store routing and hook containment. ENOBUFS after that correction came from
inherited verbose Rust logging overflowing the proof harness buffer; validation
uses explicit `RUST_LOG=error`, preserving command status and assertions. The
proof harness also killed watchers without awaiting child close, then blocked its
event loop in spawnSync: an unreaped zombie kept its PID alive and correctly
prevented lock recovery. Awaiting actual close fixes this test-ordering failure
without weakening lock safety. The separate detached-descendant failure is a
production macOS support bug: runs
only enumerated Linux /proc. It is handled in a separate commit.

The unrelated recordRun failure-reset race (`skills-z4zm`) remains known and outside this bounded
change, as do the deferred review/identity workflow findings.

## Validation results

Independent review found no remaining blocker for the supported br recipe and
verified inherited live BEADS_DB rebinding. macOS: 17/17 deterministic regression
tests pass on macOS and in the existing isolated Linux image. The Linux fixture
uses its own commit identity and makes no global configuration changes. Six original deterministic lock/HEAD/conditional regressions fail against
the prior implementation and pass after the fixes. Additional scenarios cover
successful and rejected push, lost acknowledgement, concurrent live writes,
fatal cleanup, crash preservation, shell routing and fail-closed isolation.
