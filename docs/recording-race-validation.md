# Recording isolation validation

Issue skills-z4zm. The b19ca87 implementation fails the controlled refused-push
regression: an independent local publisher commits while record awaits push;
record then resets behind that committed write. It can also let that publisher
expose an unaccepted recording. Baseline failure is captured in
/tmp/record-before.log, using TRACKER_RACE_SOURCE with the exact old file.

Record now uses the same isolated-candidate preparation, push reconciliation and
accepted-result merge as claim/transition. No live reset remains. It captures
revision/state once before network retry, so later tracker writes or a later
code checkout HEAD do not change that recording. Existing local/remote content
identity checks and missing-runtime exit 2 remain. Unknown push outcomes retain
the candidate object and diagnostic, rather than claiming no external effect.

Affected tests: prior full race set plus record failure, accepted lost-ack,
concurrent remote update and code HEAD update pass (21/21); focused record tests
including missing dependency and installed tracker-sync.version provenance pass
5/5. Existing recording/record-hook cases and their deliberate mutations are
run separately; final aggregate result is recorded with the final review report.
Independent read-only review found no remaining runtime blocker.

Plugin 0.112.0 follows the existing behavior-version contract. Setup remains
0.45.0: only the separate layout hash changed; the 28 general installed-file
hashes did not. Setup writes the plugin provenance beside installed tracker code
in tracker-sync.version; the shipped source intentionally has no such file.

Historical proof arithmetic, audited against the original and final logs:

| Category | Historical | After the prior fixes |
| --- | --- | --- |
| Clean assertions | 53/61 | 68/68 |
| Mutation-proof verdicts | 10/15 | 15/15 |
| Intentional mutant observations | 20 pass / 24 fail | 20 pass / 24 fail |
| Raw aggregate | 83/120 | 103/127 |

The meaningful final verdict was 83/83, plus the same 44 mutant observations.
Seven clean assertions became reachable when earlier bring-up failures were
fixed. Assertions and failCount/exit-status logic were retained; presentation
alone stopped mixing observations from deliberately broken programs with the
proof that those breaks are detected.
