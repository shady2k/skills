# Fixture architecture

## Solution strategy

None: the owner confirmed there are no architecture principles, 2026-11-13.

- **One way in.** Every change reaches the store through the same door. In
  practice: a new write is only a command on that door, no second path.
  Carried by: [0009. One way in](../../references/design.md).
