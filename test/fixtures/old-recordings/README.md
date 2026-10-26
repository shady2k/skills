# A mechanism that wrote whole-state recordings

`0.121.0/tracker-sync.mjs` is a **byte-for-byte copy** of
`skills/backlog/setup-shady2k-skills/tracker-sync.mjs` at commit `ca4f708`
(release 0.121.0), where it was published as version 0.121.0.

The proofs run it to write the recordings this mechanism used to write: a
recording file held the **whole state** of the store, taken from the store's
working tree, with no reference to a store commit. A recording written that way
carries a state file the store's git ignores (br's own `.beads/beads.base.jsonl`)
and can lack a declared file the commits hold, which is what issue #49 reported
after 0.127.0 converted none of a store's 1110 recordings.

A proof that built its "old" recordings with the current code proves nothing
about the code that wrote them, so this copy is used as it shipped.

Refresh it only from the same commit, and never edit it:

```sh
git show ca4f708:skills/backlog/setup-shady2k-skills/tracker-sync.mjs \
  > test/fixtures/old-recordings/0.121.0/tracker-sync.mjs
```
