# Fixture architecture

<The current architecture, arranged as arc42.>

## Solution strategy

- **One owner per store.** Every piece of state has one writer and one place it
  is read from. In practice: a new field is only a change in its owner's model,
  no second writer. Carried by:
  [0007. One owner per store](../../decisions/0007-one-owner-per-store.md).

## Building blocks
<Containers and their responsibilities.>
