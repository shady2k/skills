# Architecture and design

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
How a design is made, compared and reviewed before code is written, and
what is kept of it. The method is Attribute-Driven Design (SEI ADD 3.0).
Each standard is named once below, at the rule that uses it; elsewhere the
rules are cited by name. `to-design` carries the step; `to-spec`,
`take-task`'s review and `brainstorming` cite this file's rules.

**Design runs when the shape changes.** A design step is made when a change
introduces or changes a building block, an interface, the ownership of
state, a runtime interaction, an external dependency or an interface
surface. A small bug and a trivial change make none of those and skip the
step by the life cycle's **Tailoring is the rule**; a change that makes one
of them runs it however small it looks, because the shape is what the next
ten changes build on.

**Drivers before options.** The design is driven by three things, gathered
before any option is drawn: the functional requirements the change serves;
quality attribute scenarios — a stimulus, the condition it arrives under,
the response, and a measure — the project's standing ones and the work's
own, with ISO/IEC 25010:2023's categories read as the list of what might be
missing; and the constraints, technical, organisational and legal, the
design must accept. A constraint says where it comes from — a record, the
person, the product's target platform or its users, a standard or a law — by
requirements provenance and traceability; one with no source is a guess
wearing the name, and the guess is the agent's, not the product's. A fact
about the environment the work is done in — the agent's machine, its disk
and memory, its tools, its network — is not a constraint of the product: the
product is built for the people and platforms the frame names, and this
environment is not one of them. Where such a fact bites — the design will
not run here, or not be shown here — the person hears it as a consequence of
the choice, with what it costs and the ways out (change the design, use
another environment, accept what cannot be shown here), never as an input the
design was quietly fitted to. A scenario without a measure is a wish, not a
driver.
Every driver the design gathers, and every option it draws from them, is
traced to the life cycle's [**The outcome frame comes before the work is
specified**](lifecycle.md): what the change is for, for whom, and what a
failure costs them. A driver that serves no outcome in the frame is a wish
too. A design taken from the technical drivers alone — what is faster,
tidier or more correct in itself — is a decision taken from the wrong point
of view. Where the frame is missing or ambiguous, the frame comes first,
got by that rule: that is the first question to the person, with a
recommendation, before any option is drawn. The product question a
technical choice actually answers is put to the person, not answered by
the design.

**Inventory before options.** Before any option, read what exists: the
building blocks and the state each owns, the interfaces between them, the
runtime interactions the change would touch, the design-system components
and the patterns already in use. This is [building.md](building.md)'s
**Find before writing** and **One surface per capability** applied to the
design before code: a new block beside one that could serve says why the
existing one cannot.

**Options from named patterns.** At least two options are built from named
patterns and tactics, not from habit: the patterns of enterprise
application architecture (PoEAA) and of integration (EIP, and POSA) for
structure and messages, the stability and operations tactics of Release
It!, the twelve factors for deployment, STRIDE and OWASP ASVS where
security is a driver, WCAG 2.2 and W3C design tokens where an interface is.
This list is the architectural case of [deciding.md](deciding.md)'s **A
proposal starts from the state of the practice** — a proposal stands on
what is established for its problem.
Each option is evaluated against the scenarios on steady state, growth,
failure, security and operability — what it does all day, at ten times the
load, when a part of it fails, and what it costs to operate. Among them is
at least one that rejects the assumption the others share, by
[deciding.md](deciding.md)'s **A design decision comes with its
mechanism**.

**The choice is recorded where it will be read again.** The chosen design
goes into a decision record, MADR's fields: context and problem, decision
drivers, considered options, the decision and its consequences — each
rejected option with the reason it lost, each assumption with what would
invalidate it. The values the decision carries — a number, a limit, a
timeout — are read with the mechanism they belong to: when the frame or the
mechanism is replaced, each is derived again from the new one or marked as
inherited with where it came from and the decision that carried it, since a
value restated in a new design reads as the new one's decision while it
still measures the old. What reaches the person about such a value is
[speaking.md](speaking.md)'s **A decision belongs to whoever made it**. The
builder's convenience — fewer moving parts, easier to test, one client
assumed — is not a reason: it prices the next week against the scenarios,
and the scenarios win. The views the decision needs are
drawn or updated where the project keeps its architecture (arc42's layout,
C4's levels, under 42010's contract), never all of them: the views this
decision turns on, and elsewhere what the change made false, by the
protocol's **What describes the present is kept true**.

**Review before building.** The review's order is validation before
verification, as V&V and ATAM both have it: first whether the design serves
the outcome frame the work was specified from — what the change is for, for
whom, and what a failure costs them — the decisions the person has given,
and the product reason behind the work; only then whether the design does
what it promises. The frame and the chosen direction reach the person for
confirmation before the record is written at length and before this review,
not after, by the life cycle's [**The outcome frame comes before the work is
specified**](lifecycle.md): a review of a direction they have not seen
argues about a frame nobody confirmed, and each round that hardens such a
frame costs more to undo. So a design that does not serve the frame, and one
whose frame the person has never confirmed, are the review's blocking
finding, taken to them as the frame to settle; no fix round runs before it
is settled, and a round that would only add mechanism to an unconfirmed
frame is not run. With the frame settled, a different model reviews the
design in ATAM's manner before code is written: the scenarios are walked
against the chosen design, and the findings are its sensitivity points —
the decisions the important scenarios turn on — its trade-offs, the
qualities exchanged for each other, and its risks, what could still fail
with the scenario that shows it. The pillars of a well-architected system —
cost, reliability, operations, performance, security — are prompts for what
the scenarios did not cover, not a second checklist. Findings change the
design or are answered with evidence, and the review converges as a stage
review does: blocking findings fixed on their own diffs, the rest as
comments, no third round. Where no other model can be reached from this
harness, the review is self-review against the scenarios, and the record
says so.

**Scenarios become checks.** Every quality attribute scenario a machine can
judge becomes an executable check — a fitness function, run with the
project's other checks — and is handed to `to-stages` as a task's
criterion, so the attribute is owned by a check and not by hope. The
scenarios that cannot be automated are named with who will judge them and
how, by [deciding.md](deciding.md)'s **A claim reaches only as far as its
evidence**.

The same scenarios are what the system is guarded by in use: what is
logged, measured and alerted on comes from them, built with the feature
and not after it, and each alert carries its runbook — one page of what to
check first and how to stop the failure it fires on. Where the product has
users, an alert a person answers is held to a service level as Google
SRE's define them: an objective for the scenario, a measure over the
indicator it is judged by, and an error budget; what is owed once the
budget is spent — making the service more reliable first, building nothing
new on it — is the design's own trade, decided before it becomes an
emergency.

**The owner hears only the trade.** By [deciding.md](deciding.md): what
reaches the owner is a quality attribute traded for another — speed against
clarity, cost against resilience — with its mechanism, its options and what
each costs; patterns, structure, views and the record's form are the
agent's own work.
