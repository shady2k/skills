# <System> architecture

<The current architecture on the main line, arranged as arc42. Fill only the
sections this system needs; a section that does not apply says so in one line.
Diagrams are Mermaid blocks drawn at the C4 levels: context, containers, and
components only where they help. Never draw diagrams with characters.>

## Goals and quality requirements
<The few quality attributes that shape the architecture, ranked, each with a
scenario that tests it.>

## Constraints
<Technical, organisational and legal constraints the design must accept.>

## Context and scope
<The system, its users and the external systems it talks to.>

```mermaid
flowchart LR
  user([Person: <role>]) -->|uses| system[<System>]
  system -->|calls| ext[(External system)]
```

## Solution strategy
<The project's target architecture: how the system is to work, as the owner
decided it, in a short list apart from the sections that follow, which describe
the present. Each principle is one entry: a short name, the owner's words for
it, its consequence in practice, and the decision record that carries it. The
list stays short, about ten to fifteen entries, because every piece of work
carries it whole. Where the code departs from a principle, the code is fixed;
the principle changes only by the owner's decision. A project with no
principles says so here in one line starting "None:".>

- **<A short name.>** <The owner's words for it.> In practice: a new <X> is only
  <Y>, no <Z>. Carried by: [<the decision's title>](<the decision record>).

## Building blocks
<Containers (deployable units and stores) and, where useful, their components:
each one's responsibility and the state it owns.>

```mermaid
flowchart TB
  subgraph system [<System>]
    app[<Container>: <technology>]
    db[(<Store>: <technology>)]
  end
  app --> db
```

## Runtime scenarios
<The few important flows, including what happens when a part fails.>

## Deployment
<Where each container runs and how it is released.>

## Cross-cutting concepts
<Conventions every part follows: errors, logging and tracing, security, data.>

## Decisions
<Links to the decision records.>

## Risks and technical debt
<Known risks and the debt deliberately taken, with what would trigger paying it.>

## Glossary
<Link to the project glossary; terms are not repeated here.>
