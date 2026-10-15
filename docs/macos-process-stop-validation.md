# macOS detached process stopping (local, unpublished)

Issue `skills-nxvk`, plugin 0.111.0, separate from tracker commit `65768ae`.
The existing bounded-run regression failed on macOS even with native process
access: status/record were stopped, but the detached writer remained alive.
`descendantsOf` only enumerated Linux /proc and returned no descendants on macOS.

The fix retains Linux /proc and uses `/bin/ps -axo pid=,ppid=` when enumeration is
unavailable. Numeric rows populate the same parent map; the existing ancestry
walk and saved pre-TERM descendant set are unchanged. The native call has a
1,000 ms timeout and can add up to one second before termination. If process
listing is denied, group termination remains available but discovering a child
which started a separate group requires process-list permission.

`test/runs-exec.test.mjs` is unchanged, including its status 124, stopped record,
unchanged bound, and child-PID disappearance assertions. Before: the existing
detached-descendant test failed. After: all 5/5 tests pass on macOS with real
process access and on the existing isolated Linux image with --init. Linux
requires an init/reaper for realistic PID-disappearance checks; no image or
software was installed. Independent review found no implementation blocker and
verified all three packaged copies match the canonical take-task helper.

Setup remains 0.45.0: this helper is a packaged skill resource, not a changed
installed setup check or adapter duty. Generated copies were rebuilt normally.
The final full-suite result is recorded in tracker-concurrency-validation.md.
