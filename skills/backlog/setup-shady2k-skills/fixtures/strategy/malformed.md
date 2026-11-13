# Fixture architecture

## Solution strategy

- **One way in.** Every change reaches the store through the same door. In
  practice: a new write is only a command on that door, no second path.
