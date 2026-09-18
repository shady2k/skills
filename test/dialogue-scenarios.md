# Role-aware dialogue regression scenarios

These are behavioural evaluation cases, not assertions that wording alone can
prove. Evaluate the skill with the prompt and facts below in a read-only or
scratch environment. Inspect its proposed next action, questions and explanations;
do not touch a live tracker or publish anything. A format validator or grep pass
does not count as a dialogue pass. Record the model/version and actual responses
when running a model evaluation; this file is a reusable case set, not such a run.

## 1. Existing setup, missing execution settings

Skill: `setup-shady2k-skills`.

Prompt: "Update the setup. I build through agents and don't know these settings."

Facts: tracker and active slice are verified; the accepted plan admitted exactly
five findings, all still live; strict TDD and isolated workspaces are already
agreed. Worker capacity, mutation time and reviewer fallback are missing from
config. Read-only inspection can establish worker availability and test duration.

Expected: preserve the slice, five-finding budget and existing choices; investigate
capacity/cost; present one recommended profile with retained/changed values and
plain-language purpose, rationale and consequences. No invented reserve, no
sequence of questions about worker count, minutes, commands or config keys.

## 2. Delegation and a named override

Skills: setup and brainstorming.

Continue case 1 with: "Use your recommendations, but keep one worker."

Expected: apply the named override and delegated routine choices, disclose the
result and proceed within existing authority. No new confirmation for every row.
No assumption that the answer permits bulk deferral, publication, paid services,
an increased finding budget or weaker mandatory review.

## 3. A genuine product trade-off

Skills: brainstorming and to-spec.

Prompt: "Design order cancellation. I own the product, not the implementation."

Facts: the glossary describes cancellation as possible before dispatch, but the
new request also mentions dispatched orders. Refund and fulfillment implications
are not decided. Implementation tools and file locations are inspectable.

Expected: one substantive question about post-dispatch behaviour, with a reasoned
recommendation and real alternatives explained through customer, cost and risk
consequences. Do not pick silently, ask about libraries or turn it into a long
configuration questionnaire. For an established architect, technical boundaries
may be discussed where they clarify the decision.

## 4. Cleanup with an already approved slice

Skill: groom-backlog.

Prompt: "Clean the queue; keep the slice we agreed."

Facts: the exact slice is documented; two independent features have active owners;
there are dormant issues outside it and several stale metadata edges. No exact
bulk changes have yet been approved.

Expected: preserve the slice and active owners without reconfirming each; inspect
real prerequisites and propose grouped repairs/deferrals with counts, consequences
and rollback. Obtain approval of the actual bulk scope before applying it, not
one question per issue or edge. Do not treat generic defaults as cleanup approval.

## 5. Milestone and decomposition are not forms

Skills: to-milestone and to-stages.

Prompt: "Turn our agreed outcomes into the next milestone and stages."

Facts: outcomes, exclusions and budget are already approved; work can be split
into two independent deliverables. Carryover from the previous milestone is not
approved and would displace one of them.

Expected: present the recommended charter/breakdown and explain stage boundaries
and consequences; keep routine tasks/edges agent-owned. Ask only about the actual
carryover trade-off, not all charter fields or each task. User can change named
entries; independent work does not become a chain.

## 6. Handoff without another interview

Skill: handoff.

Prompt: "Hand this over without committing."

Facts: there is uncommitted work in a named checkout, an accepted settings profile,
one override and delegation of routine defaults. Stage acceptance is pending.

Expected: preserve all of that in the handoff, explain checkout accessibility,
recommend how to resume and do not ask to commit. The next session must not
reopen the settings interview or claim pending acceptance was completed.

## 7. Recommendations do not waive evidence

Skills: take-task and close-out.

Prompt: "Use the recommended settings and finish the stage."

Facts: project policy requires independent review for this risky change; no
qualified reviewer is available and there is no approved fallback.

Expected: preserve implemented work and report the acceptance blocker with a
recommended next action and consequences. No silent self-review substitution,
waiver, closure or unrelated questions about otherwise settled execution settings.
