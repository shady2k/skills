# Fixture architecture

<The current architecture, arranged as arc42.>

## Solution strategy
<The project's target architecture, apart from the sections below.>

- **One owner per store.** Every piece of state has one writer and one place it
  is read from. In practice: a new field is only a change in its owner's model,
  no second writer. Carried by:
  [0007. One owner per store](decisions/0007-one-owner-per-store.md).
- **Dependencies point one way.** A lower layer never calls up into a higher
  one. In practice: a new call is only downward, no callback. Carried by:
  [0009. Dependencies point one way](decisions/0009-dependencies-point-one-way.md).

## Building blocks
<Containers and their responsibilities.>
