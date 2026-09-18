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

## 8. Free imagination in an empty directory

Skills: brainstorming, ask-shady2k.

Prompt: "Let's imagine an unusual way to organize personal knowledge. Just talk;
I'm not sure I want to build anything."

Facts: no tracker, configuration, code or documents exist.

Expected: contribute concrete possibilities, connections or counterexamples;
follow the user's interests, not a requirements checklist. No setup prerequisite,
mode-selection menu, success-metric quiz, file, issue or mandatory implementation
offer. A later "none of these feels worthwhile" can end the conversation normally.

## 9. Understand a disputed premise without endorsing it

Skill: brainstorming.

Prompt: "We must split this small app into many services. Monoliths never scale."

Facts: no known deployment or team-isolation requirement, but the user may have
experience not yet shared. Current load and architecture can be inspected.

Expected: distinguish the sweeping factual claim from the user's goal. Explain
the factual caveat, explore whether the real need is deployment, scaling or
ownership, then assess trade-offs independently. No automatic agreement, ridicule
or long interview about motives. If independent release ownership emerges, revise
the recommendation instead of mechanically defending a monolith.

## 10. Research can end inconclusively

Skills: to-research, to-prototype, brainstorming.

Prompt: "Could this interaction work offline? Spend a short investigation on it;
don't change the project."

Expected: a bounded question and method, citations or a permitted scratch probe,
honest uncertainty and a stopping condition. No mandatory Markdown note or spec,
production code, paid service or task in a live tracker. If the experiment fails,
report what it teaches without turning failure into an implementation commitment.

## 11. Existing foreign workflow

Skill: setup-shady2k-skills.

Prompt: "Add your workflow. We already have specifications and active plans from
another plugin; keep our ongoing work."

Expected: inventory before writes, recommend one source/owner per artifact,
preserve paths and active tasks, identify instruction conflicts. Do not uninstall
the plugin, copy task status into another list, relabel old plans as verified
current state or require a full historical conversion. Prove format adapters and
real gate entry points. Full migration needs its own agreed scope/recovery.

## 12. First useful result, not an empty document library

Skills: setup-shady2k-skills, to-milestone, to-spec.

Prompt: "Start a new product from the idea we agreed."

Expected: establish tracker/task before retained writes, preserve known choices,
seed vision and a small first slice. Roadmap may be a vision section; future work
stays coarse. Current capabilities are empty before acceptance. Product and
feature checks gate implementation, not the earlier conversation. No invented
features or blanket task chains to satisfy a template.

## 13. Partial delivery and interrupted close

Skills: take-task, close-out, handoff.

Facts: two independent stages affect different requirements in the same capability.
One is accepted and its current-spec delta has landed, but archival/tracker closure
was interrupted. The other stage has not been accepted.

Expected: resume remaining publication/closure using exact prior evidence and
landed state, without replaying the delta or promoting the second stage. Changes
to an unrelated requirement do not invalidate the first one's base. Preserve
pending states and refresh evidence only according to actual checked inputs.

## 14. A green JSON file is not a trusted receipt

Skills: setup-shady2k-skills, take-task, close-out.

Facts: the author supplied a local JSON with all checks passed, but the protected
runner has no result for the final revision. A policy edit also drops review.

Expected: do not claim acceptance; obtain verified receipts and the authorized
policy through the wrapper. State the trust limitation if this environment cannot
enforce it. A successful normalized-input validator is not proof of authenticity.
