# The life cycle of a piece of work

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
Where a piece of work stands in its life, what must hold before the next
stage starts, and which skill of the set carries each stage. The stages are
ISO/IEC/IEEE 12207's technical processes, reduced to what this set carries:
business and stakeholder needs, requirements, architecture and design,
implementation, integration, verification, transition, validation,
operation, maintenance. A skill holds its stage's step and says so in its
own file; this file says when each stage is due and what settles it.

**The stages.** A stage is left when its question is answered on record,
not when the work feels far enough along; what each one settles, what must
hold before the next, and the skills that do it:

| stage | the question it settles | what must hold before the next | skills |
| --- | --- | --- | --- |
| Business and stakeholder needs | whose problem this is, and why it is worth solving | the need is written where the next stage reads it, and someone who has the problem recognizes theirs in it | `define-product` where the idea is raw, `brainstorming`; the vision and the charter bound it |
| Requirements | what the system must do, as its user sees it | the behaviour is agreed, with the scenarios that will be checked and the seams they are checked at | `to-spec`, drafting from the product's own documents where the product keeps them |
| Architecture and design | how the system will do it | the shape of the change is decided against quality attributes and recorded, by [design.md](design.md); or the work is tailored past this stage with its reason | `to-design` |
| Implementation | the code exists | workers hand in results with their local checks, on the feature's branch | `take-task` |
| Integration | the results are one change | every submitted result is merged and the checks its merge touched are rerun on the merge | `take-task` |
| Verification | the change does what the requirements say | the full checks, mutation where the project has one, review and the DONE WHEN hold on the assembled revision | `take-task` |
| Transition | the change reaches its users | the work lands on the main line and is released the way this project releases | `ship-release` |
| Validation | it is the right thing | before release, the outcome is seen at the place the spec named, by [checks.md](checks.md)'s **Reached, not just built**; after release, that it solved the need | before release, that check; after release, the release marks the hypotheses its outcomes settle as waiting on their measures, and their results are read by `define-product` and planned with by `to-milestone` |
| Operation | it keeps working for its users | the alerts and their runbooks the design's **Scenarios become checks** produced, and, where the product has users, the service level it is judged by | `handle-incident` for what fails in use |
| Maintenance | faults and debt are taken as they are found | a fault is diagnosed on evidence, and what matters is filed | `diagnose-bug` and `to-backlog`; what runs it looks after itself on `check-upkeep`'s pass |

Release, operation and upkeep carry skills of the set now — `ship-release`,
`handle-incident` and `check-upkeep` — and the validation that follows
release takes no skill of its own: a hypothesis's measure is read onto the
record the hypothesis keeps, by [product.md](product.md)'s hypothesis form,
and the next milestone is planned with the results. Each stage keeps the
tailoring above: the skill a stage carries is offered and sized by what the
piece of work and the project call for, never by the stage's existence.

**Tailoring is the rule.** The standard above tails its own processes, and
so does this set: the stages a piece of work passes are chosen by its
scale, uncertainty and risk, and by what the project is. So are its records:
what the work must write about how it went is proportionate to it. A small
task is one acceptance record naming its CI run and its review; what CI and
the review already hold is read from them, never retyped as records. What
stays at every size is what the owner's time figures count — the claim and
the span receipt — and what a stage's or feature's acceptance is judged
from. The records ride with the work's own landing, never as a commit of
their own. What the project
is narrows first — a library publishes and does not deploy; a prototype has
no operation; an internal tool narrows transition to what reaches its users, often only a merge — and scale,
uncertainty and risk narrow the rest: a small understood bug goes from
requirement to regression check; a colour goes to the change and its check
alone. A skipped or narrowed stage is a stated choice with its reason, said
in one line where the work is planned — the spec, the charter or the task —
never a silent omission. This generalizes what `take-task` said of design
alone: sizing by size, uncertainty and risk was one stage's tailoring, and
this is the cycle's.

**Depth is read off the change, not off the author's word.** How far a piece
of work is carried — which stages it passes, whether its spec is short or
full, whether the design step runs, how deep the review and the acceptance go,
and which of its choices stop for the owner — is decided from what the change
is and where it lands, never from the account of the agent that made it: from
the project's config and recorded conventions, from what the diff touches (a
building block, a public interface, an owned state, an external dependency, a
migration, people's data), and from what the work's own record already says. A
depth argued from a predicate that a machine or another agent can apply is the
rule; "it looked small to me" is the cheap path wearing a reason, and the
author is the one least able to see its own blind spot. Where a setting and a
predicate leave it open, the choice is written where the work is planned, with
its reason and what being wrong would cost, and read by someone other than its
author — the owner when the plan is accepted, the reviewer of the assembled
revision, a check — and where the two sizes disagree, the deeper one is taken
and the disagreement recorded. This is [design.md](design.md)'s **Design runs
when the shape changes** written for the whole cycle, and what keeps
**Tailoring is the rule** from becoming the agent's own permission to do less.

**The outcome frame comes before the work is specified.** Before work is
specified or run, its frame is established: what it is for and for whom, what
matters most when something must give, the main path through it, and the
signal that it succeeded for its users. This is outcome-based planning: jobs
to be done, success metrics, and priority set under trade-off. The frame is
searched for first — the product's documents, the charter, the issue, the
conversation — by [deciding.md](deciding.md)'s **A question is searched for
before it is asked**; a frame already stated is not asked again. What the
search leaves missing is proposed with a recommendation and confirmed or
corrected as one batch, by [speaking.md](speaking.md)'s **An ask carries its
own substance**, never question by question — for work already being specified
or run. A raw idea's frame is not confirmed but discovered: `define-product`
walks it out of the person one plain question at a time, and what that walk
gathers is the frame every later piece of work searches for. A small bug or a
trivial change carries a one-line frame, by **Tailoring is the rule**: its
size is one line, not zero. What a frame holds is what later stages read: an
outcome's success signal is the frame's, measured by [product.md](product.md)'s
hypothesis form where one exists, and seen in use by
[checks.md](checks.md)'s **Reached, not just built**.

**The shortest path is the default.** A stage is added because the work's
scale, uncertainty or risk calls for it, never because it exists. A
trivial, reversible, understood change — a colour, a text, a constant — is
the change plus its check, with no document; at most a line on the task.
Documents scale with the decision, not with a template: a section with
nothing to say is left out, not filled. The same measure cuts the other
way, and tailoring never drops acceptance: every piece of work ends in
evidence someone else can check, at a size its risk justifies, and a stage
carried for ceremony is as wrong as a stage skipped in silence.

**The next stage is offered, not the queue's top.** Where a piece of work
is live, its router and its run's route read which stage it stands in and
offer the next one by this model, tailored by **Tailoring is the rule**:
design before building where the change changes the system's shape, by
[design.md](design.md)'s **Design runs when the shape changes**; no design
for a small bug, with the tailoring's reason; release for merged work in a
project that deploys. A stage whose skill does not exist yet is offered
none the less, named with what it needs and that no skill does it yet;
nothing is invented to fill the place, and the work is not blocked by the
gap.
