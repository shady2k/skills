# Starting from nothing

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
The path from an empty folder, with not even an idea, to the first planned
feature. It is not a new skill: it orders the ones that exist.

**Starting from nothing is product discovery before engineering.** An empty
folder is met with the question of what to build, not with setup: the order is
the idea, its test, the evidence, the vision, the first milestone, the
architecture, the walking skeleton, and only then the first feature. Each step
is the ordinary practice of its kind — divergent then convergent ideation, an
idea pressure test (a pre-mortem, assumption mapping), market and domain
research, a product vision board, user journeys, an MVP cut, architecture
decision records, a walking skeleton — and what follows is only this set's
position on them. Depth follows the stakes: a tool for the owner alone may cross
the first five steps in one conversation, a product for other people should not
skip any of them. A step whose answer the owner already has is recorded, not
performed again.

1. **The idea** (`brainstorming`). One question opens it: where to look — a
   pain the owner has, a field they know, something they want to learn. Then
   diverge before judging anything: many ideas, from named ideation methods
   and not from one angle, the agent contributing its own; then converge, as a
   separate move, by clustering and weighing value against effort. The owner
   chooses; the agent argues but does not choose for them.
2. **The pressure test** (`brainstorming`). The chosen idea is attacked at its
   central claim: who has the problem, who pays and who uses, what they do
   today instead, what would have to be true for it to work. It ends killed,
   clarified or hardened, and killed is a result, not a failure: a vague idea
   left untested makes every later document vague.
3. **The evidence** (`to-research`, `to-prototype`). What the test left as
   assumptions is checked: competitors and alternatives, the domain's rules,
   whether a technical premise holds, each answered by the cheapest evidence
   that can.
4. **The vision.** From here something is kept, so the project gets its
   repository (created with the owner's agreement) and its setup, which on an
   empty repository needs no CI yet. The vision records the audience and who is
   not served, the problem and its evidence, the alternatives and the
   difference, the key journeys as the owner tells them with a named
   protagonist, the success signal with a counter-metric, and the exclusions.
5. **The first milestone is the MVP** (`to-milestone`). Its outcomes are the
   key journeys it carries end to end; its exclusions say what is out of the
   MVP. The owner makes the cut; the agent shows what each journey costs and
   what it proves.
6. **The architecture** (`brainstorming`, `to-research`, `model-domain`). The
   decisions that would clash if made separately — the paradigm, the stack or
   a current starter template (checked, not remembered), the main boundaries,
   who owns which data — are put to the owner by the protocol's [**A design
   decision comes with its mechanism**](deciding.md), recorded as decision records, and drawn
   in the architecture document. The glossary starts with the names these
   decisions gave the parts.
7. **The walking skeleton is the first feature** (`to-spec`, `to-stages`,
   `take-task`): the thinnest path through every part the architecture names,
   from the starter where there is one, built, tested and run by CI end to end,
   carrying no product behaviour worth mentioning. It is where the checks setup
   deferred get wired, and what every later feature is reached through.
8. **Then the ordinary flow:** a feature per key journey, run in parallel where
   they are independent and ordered only by a real prerequisite or conflict,
   which is recorded as an edge, never by the order the milestone lists them.

Nothing is written before step 4 unless the owner asks for it: steps 1 to 3
are conversation, and what they found enters the vision when there is one.
There is no product brief, PRFAQ or requirements document beside the vision,
the charter and the specs: each of those would be a second copy of them.
