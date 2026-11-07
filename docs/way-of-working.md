# Choosing how work reaches the main line

The set's design, 2026-11-07. Scope: the set stops assuming one way for work to
land. Setup records how this project's work reaches its main line, from
established named practices, with a recommendation; skills follow that record
instead of one assumed practice. No practice becomes the set's rule. This
document is the decision the changes are cut from; it names no project, and no
file outside it was changed by writing it.

Four things were decided with the owner and are not reopened by this document:
three practices are offered (one pull request per feature, a branch per change,
trunk-based); a project does not mix them; where a rule of the repository stops
a practice, the choice is recorded and the constraint named; the checks
increment lands first and the choice takes the next setup version. Stage size
stays a rule, not a setting.

## 1. For whom, and what a failure costs

The change serves the person who installs the set into their own project. What
becomes possible for them: work lands the way their project works, chosen with
what the set recommends, instead of the set landing it the one way it was
written for. A project that already works the way the set assumes loses nothing
and is asked nothing new; a project that works otherwise stops having every run
argue with its own rules.

What a failure costs them, in their own terms: setup that decides for them
wears down the trust the set runs on, and a run that lands against the
project's rules costs a review round on the wrong change, a protection rule
turned off to get past it, or a main line that no longer runs. The measures
below are read against that: nobody is asked a question they cannot answer, no
project that keeps today's practice behaves differently, and no project is
talked into a practice its own rules forbid.

## 2. Drivers before options

### 2.1 Quality scenarios

Each is a stimulus, the condition it arrives under, the set's response, and the
measure that says whether it held.

| # | stimulus | condition | response | measure |
| --- | --- | --- | --- | --- |
| S1 | the owner answers how their work should land | an empty repository, a full one, or one whose history cannot settle it — setup proposes the practices in all three | setup shows the practices with one recommendation and the assumptions behind it, records the answer before the first run | every setup proposes and records before the first run; a correction that changes the recommendation produces one more question, and silence is never taken as consent |
| S2 | the owner keeps today's practice, or never reruns setup | records a year old, checks configured, a review fallback recorded | every skill behaves as it did the day before the change | no step, no record and no gate verdict changes; the review fallback stays the project's, not a second model |
| S3 | a run works under another practice | the practice recorded, the project's checks and review rule as they are | it lands what that practice lands, when that practice lands it, and shows the revision that practice names | its transcript names the practice's landing and no step assumes another; a demo revision exists for every landing it made |
| S4 | the main line's own rules stop one thing the practice relies on | a protected branch, a required approval, a merge queue | setup says which rule stops which one thing, offers the nearest practice the rule allows, and never edits the rule | push, pull request and approval are resolved separately; no rule is edited; the recorded practice names the constraint |
| S5 | the owner changes the practice while a run is in flight | a coordinator resumed by another session | the run finishes under the practice it began with, and the resume reads the run's own record | one value has one owner; a resumed run never reads the live record for its ending |

### 2.2 Constraints, with where each comes from

- **Values that change are the gate config's, and are copied nowhere** — from
  the set's own protocol, the rule that a project's vocabulary, milestones and
  paths live in its config and are never restated in a skill.
- **A skill cites a rule by its name and does not restate it** — from the
  repository's authoring rules, which keep one owner per policy and fail a
  build that copies it.
- **One reference, sections by practice, no skill forked per practice** — the
  same authoring rule, applied to the mechanism below.
- **The gate assumes no pull request** — from the gate as it is: it reads the
  main line for a commit naming an item and reads a revision; both are
  practice-neutral already.
- **A practice carries no project's facts** — from the rule that no skill names
  a project or a tracker, and finds one here from the first commit.
- **Three practices, no mixing, three constrained facts resolved separately** —
  the owner's decision, recorded above.
- **The set's own budget**: one question, one config value, and a change small
  enough that a project that updates it needs no rerun for the words alone.

## 3. What exists today

Read before any option was drawn. The set states branch-per-feature-and-one-pull
request in about forty places, and those collapse into six things a practice
actually decides (§8). What exists to build on:

- **Two config values, and nothing reads them.** `execution.landing`
  (`push` | `pull-request`) and `execution.maxBranchDays` are written into the
  project config by setup and read by no rule and no check: they record a
  dialogue answer in prose. "Who merges" is not recorded at all.
- **The gate's landing assumptions are practice-neutral.** `merged-but-open`
  reads the main line for a commit naming the item, and the evidence rules read
  a revision. Neither names a pull request, a branch model or a merge.
- **The rules are already phrased one level above the pull request** in the
  places that matter least: "the project lets a branch live", "where the main
  line accepts a direct push", "released the way this project releases". The
  deepest hard-codes are narrower than they look: "the owner's acceptance is the
  merge", "named after the feature", and take-task's one-pull-request
  description.
- **A review already runs before a landing**, with a recorded preference, an
  agreed fallback and an acceptance policy, and a disclosed self-review where
  no other model is reachable. Any practice that needs a review before it lands
  is asking for something the set already does.
- **One precedent for a config-driven switch**: `agreementExempt`, a config
  key the gate reads, with its own section in the integration document.
- **The tests that bind text**: the authoring sources are the only editable
  ones; a build check refuses drifted output; the setup-version lock refuses an
  installed file changed under the same version; and one test pins exact
  clauses of two reference files.

What the change extends: the setup dialogue that already records how the main
line accepts changes, the one config file, one protocol reference. What it
replaces: the sentence that how a change lands is "decided this way, never
asked", and the forty prose statements that follow from it.

## 4. Prior art

Three axes separate the named practices: how long a branch lives, which
long-lived branches exist beside the main line, and whether a review gates the
main line. What a run obeys is the first and the third; the second is release
topology, which `ship-release` already takes from the project.

- **Feature branch, one pull request per feature** (Fowler, *Feature
  Branching*). What it does: "Put all work for a feature on its own branch,
  integrate into mainline when the feature is complete." What it costs the
  people who run it: the branch lives as long as the feature, and Fowler ties
  the integration cost to that interval, noting it "discourages refactoring".
  What it leaves out: nothing about review or release — a project adds those
  itself, which is why it fits a project that reads each change before it
  lands and a first project with nothing shipped.
- **GitHub Flow** (GitHub's own quickstart). What it does: "a lightweight,
  branch-based workflow" — branch, pull request, merge, delete, with the branch
  living hours to a couple of days. What it costs: one review-plus-checks cycle
  per change on the critical path, and with up-to-date branches required each
  update re-runs the checks; an author cannot approve their own pull request,
  so a second pair of eyes or a different model is needed. What it leaves out:
  releases — it ends at the main line and says nothing about what ships.
- **Trunk-based development** (DORA's research; trunkbaseddevelopment.com).
  What it does: work "merges … into trunk at least once (and potentially
  several times) a day", and off-trunk branches "should only last a couple of
  days". What it costs: review must be fast — "when code review is laborious
  and takes hours or days, developers avoid working in small batches" — so
  either a short-lived pull request with fast approval or a review that does
  not hold the landing; unfinished work hides behind switches someone must
  retire, and there is no whole-feature merge to revert. What it leaves out:
  who carries the review, and what a project does when its checks are slow: the
  doctrine names no reviewer authority and assumes the checks are fast.
- **GitFlow** (Driessen, 2010) — **not offered**. Two permanent branches plus
  release and hotfix ones, and a double merge per release. Its author, ten
  years on: for continuous delivery "adopt a much simpler workflow (like GitHub
  flow)"; its home is explicitly versioned software. What it leaves out: a
  single line to read — every rule here reads one main line, what landed and
  what a demo shows and what is fresh, and GitFlow has two. A project running
  it records the practice matching how its changes reach its integration
  branch, and names that branch its main line.
- **GitLab Flow** — **not offered**. Its landing is GitHub Flow's; what it adds
  is downstream environment or version branches, where merging into
  `production` *is* the deployment. That is release topology, which
  `ship-release` takes from the project, and it changes nothing before the main
  line. (GitLab's current strategies page suggests git-flow for one web
  service; where that page is cited, it is this one.)

**The exclusion test**: an offered practice must change what a run does — when
it lands, who may land it, what a demo shows. Two that differ only after the
landing are one practice plus a setting.

## 5. The three practices, as a person reads them

The six questions are the interface. No skill names a practice; the practices
are words in one reference, and a rule cites the reference.

| | **One pull request per feature, you merge** | **A branch per change, merged when its checks pass** (GitHub Flow) | **Trunk-based: it lands the day it is made** |
| --- | --- | --- | --- |
| how work goes | a branch per feature, alive as long as the feature; stages ride in it; one pull request at the end | a branch per change, alive hours to a couple of days; each stage opens its own | the day's work lands the day it is made, from a branch that lives a day or not at all; unfinished work behind a switch |
| who merges | the owner; their merge is the acceptance | the run, once the required review and checks are green; where approval is required, the owner's approval is the gate | the run, where the main line allows it; otherwise a short-lived pull request approved fast |
| what you see, when | nothing until the merge, then the feature whole; a demo shows the open pull request or the merge | the main line moves several times a day; a demo shows the newest landed increment | the main line always runs and moves daily; a demo any time |
| what it costs | the owner's attention per feature; a long branch, conflicts, nothing visible meanwhile | a review-plus-checks cycle per change, on the critical path; a bad change felt at once | fast, trusted checks; a habit of reverting a bad landing first where the checks were the only gate; switch debt; small steps instead of one review |
| what it suits | a person who reads each change before it lands; versioned or infrequent releases; a first project | a continuously delivered product, review required, a protected main line | continuous deployment, one production line, checks you trust |
| leaving it | cheapest: nothing on the main line is made false, and no switch or release branch to undo; the branches open at the change still wait for their one merge each | the habits, not the tools: nothing on the main line is undone, a branch per change stays in the history, and the main line's protection and review stay the project's own settings | a release branch to add where the next practice releases from one, its switches to retire, and less frequent landings |

**Leaving a practice is what it cannot carry, not what it must undo.** Each
practice's section of the reference says it in the section's own paragraph:
nothing another practice does makes false what this one left on the main line,
and what a change of practice cannot carry is the state it cannot undo — the
branches open at the moment of the change, the switches still open, a release
branch the next practice wants and this one never made. The main line's own
settings — its protection and the review that gates it — are the project's, and
no practice changes them, so a change of practice touches neither.

Nothing else in setup depends on this answer — not the tracker, not the
checks' commands, not the language, not the review model. That is why it is one
question.

## 6. The recommendation, from which facts

Four facts, and setup may read all four in one repository and none in an empty
one: who is there, whether a review gates the main line, how the project
releases, and what the checks cost. The look is kept and widened: what is found
informs the recommendation, and the answer is still the owner's.

| fact | empty repository | existing repository | what it decides |
| --- | --- | --- | --- |
| who is there | assumed: one person decides | commit authors, review settings | one owner → the run may land; several people → a review gates it |
| is a review required before landing | assumed: no | protection rules on the main line, a merge queue | required by a person → a practice that waits for that approval |
| how it is released | assumed: on every merge, once there is something to ship | deploy workflow, tags, release branches, the docs' release rule | continuously → a practice that lands daily; versioned → any of the three |
| what the checks cost | unknown; cheap and fast first | the last twenty runs' duration | above a few minutes, daily landing costs more than it returns yet |

**An empty repository recommends a branch per change, merged when its checks
pass.** On the three assumed facts the run may merge, nothing waits for an
approval, and a release follows each merge, so the choice turns on cost: this
practice's review is the one the set already runs before a change lands, and
its other requirement, green checks, is met by the checks the project
configures on the first day. Trunk-based is the practice to grow into, not to
start in: it asks for the one thing an empty repository cannot supply — checks
someone already trusts, and the habit of reverting before repairing — and its
costs, switch debt and a revert-first discipline, are paid from the first day.
That nothing shipped can be hurt yet argues that a mistake is cheap, not that
the practice with the least margin is the right one to learn on. One pull
request per feature is recommended where the owner wants to read each whole
change before any of it is visible, and it remains what an unanswered setup
keeps.

**Corrections that move the recommendation**: a second person deciding, or an
approval required before landing, makes the owner's approval the gate under
either of the first two practices; a release by tag every few weeks takes
nothing away, since no practice decides release topology; checks that take
minutes make daily landing cost more than it returns today, and the
recommendation moves to one pull request per feature.

**An existing repository recommends what the facts fit.** A branch per feature
merged by a person → one pull request per feature; short branches merged
several times a week with a review required → a branch per change; branches
dying within a day with no review gate and fast checks → trunk-based. A mixed
history gets what its last twenty merges show. Where the facts fit none
cleanly, the nearest practice is recommended and the fact that differs is
named.

**Constraints are resolved one at a time.** Setup settles three separately —
may the run push, must a change arrive as a pull request, must a person approve
— and says what the chosen practice becomes under each: the run lands its own
change; or opens a pull request and merges it when it has the right; or stops
at the approval. Only where the rules leave the practice nothing does setup say
it cannot be run here; it names the rule, offers the nearest practice the rule
allows, and offers to prepare the rule's own change as a task with the owner's
agreement. **Setup never edits protection, hooks or queue settings to make a
practice possible.**

## 7. Where the choice lives

One value, one owner: **`execution.wayOfWorking`** in the project's config,
`feature-branch-pr` (the retained practice) | `github-flow` | `trunk-based`.
Absent means `feature-branch-pr`, which is what makes S2 hold: a project that
never reruns setup behaves exactly as it did. `execution.landing` and
`execution.maxBranchDays` stay the config's too; the integration document holds
only what was found and where it was proved, and points at the config for
current values.

- **Derived values are proposed with the practice, not asked one by one.** The
  practice supplies its branch-bound default — trunk-based a day, a branch per
  change two, the retained practice the project's own rule or two — and any
  bound the project already set survives a change of practice. Setup shows the
  practice, its recommendation and the values derived from it as one profile,
  each entry marked as retained or proposed, so the owner accepts the profile
  or changes a named entry; a derived bound with no consequence at the owner's
  level is disclosed in that profile and is not a question of its own.
- **How a skill reads it.** One protocol rule, **How this project lands is
  recorded, and no skill assumes one way**, and one reference,
  `references/landing.md`, whose sections are named after the practices and
  answer the same six questions in the same order. A rule says "this project's
  way of landing" and cites the rule; the rule sends the reader to their
  practice's section. No skill names a practice, and none is forked.
- **A run pins what it began under.** It reads the value once, at the
  preflight, with the revision of the config it read it at, and writes both
  into the coordinator's own claim note on the feature — the run script's
  `claim --note`, which take-task's preflight names as the record a fresh
  coordinator needs — beside the forecast. That note is the record a resume
  already reads, and the pin belongs there because the run's record is the
  tracker comments the run script prints: no field of it carries a practice,
  and a structured field for one line would be a new adapter duty and a new
  setup version. The note is written once and read as the authority: a resume
  lands by what it holds, not by the live config, and says in one line where
  the live config now names another practice. No second editable copy of the
  value exists anywhere.
- **A rerun keeps it, and rechecks the facts.** The value is not asked again;
  the facts are read every run, because protection can change under a recorded
  answer, and setup says so in one line when one contradicts it. A change of
  practice goes through the ordinary bounded rerun — all its proofs, answers
  kept, no unrelated cleanup — never a mode that skips them.

## 8. Variation points, and what stays common

Six, not forty: the rules are already phrased one level above the pull request.

| variation point | what the practice decides | sites it moves |
| --- | --- | --- |
| the unit that lands | a feature, a stage, or the day's work | running.md **Sessions and landing**, take-task's landing step, to-stages **Features**, close-out, protocol **Levels** |
| who presses merge, and what their yes means | the run, the owner, or the forge's queue after an approval | running.md **Autonomy**, close-out, ship-release's opening |
| what a demo may show | the newest landed increment, the open pull request, or the change as it stands before it lands | checks.md **Reached, not just built**, take-task's landing walk, ask-shady2k |
| where unfinished work hides | a branch, a draft pull request, or a switch on the main line | landing.md, each practice's section, and checks.md **Reached, not just built** |
| what a red main line triggers | a repair by its own small landing, and a revert first only where nothing but the checks stood before the breaking landing | checks.md **A red check is this run's work**, and landing.md, each practice's section |
| what a landing waits for | the project's own review and checks, an approval, or the owner's merge | take-task's review rule and its recorded fallback, and landing.md, each practice's section |

**The reference's sections answer the last three variation points.** After the
six questions, every practice's section answers where unfinished work hides,
what a landing waits for, and what a red main line triggers, in its own words,
because those are what the rest of the protocol asks most often; checks.md and
take-task's landing step cite the section and leave the particulars to it.

**Where work hides decides how a landing is walked.** A practice that hides
unfinished work on a branch shows it as a draft pull request where the
visibility is wanted. Trunk-based hides it behind a switch on the main line, and
there the walk an acceptance needs is made with the switch on, in the
environment the spec named, on the revision that landed: the behaviour exists
only while the switch is on, and the switch is what keeps it off the main line
until the work is whole. checks.md's **Reached, not just built** names a switch
left off among the ways green checks lie, and carries the same rule. That is one
more site citing the reference, not a duty the reference cannot carry: the §10
assumption that forty prose sites are one paraphrase each is stretched by one
site, not broken.

**A red main line is repaired first, and reverted first only where nothing but
the checks stood before the breaking landing, with no person's approval among
them.** Every practice's section says
the main line's failure blocks everyone and is repaired by its own small
landing ahead of anything else, and checks.md's **A red check is this run's
work** has the run that meets it do the same. What differs by practice is the
landing that broke it: where nothing but the checks stood in front of it, it is
reverted first and repaired by a second landing, because a change is everyone's
the moment it lands and undoing it is the fastest way back; where a person's
approval stood in front of it, the repair is judged like any other change and
the revert is that person's to ask for. Revert-first is therefore a fact of a
landing nobody read first, not of the set, and no practice reverts a change a
person approved without that person's word.

**Common, unchanged**: one coordinator per stage; the project's own review
rule, with the preference, fallback and acceptance policy it records — a
project keeping today's practice acquires no second model; checks read a
revision; records ride the work's own landing; remaining work counted from what
landed; the preflight; the finding budget. Switches belong to trunk-based, and
expand and contract to a change whose data or clients must coexist.

**Stage size is not a setting.** "What one run can build and show in about one
working day of agent time" is what a coordinator can verify in a session; a
config value would invite a bigger batch, which is the cost the set exists to
avoid. The relation between a stage and a branch varies, and the practice
states it: trunk-based — a stage lands the day it is built; a branch per change
— its branch closes at its landing; the retained practice — a stage rides the
feature's branch, and the feature is what the bound applies to. The bound is
the project's; the stage's size is the set's.

## 9. The gate

The gate learns the value once and gains no rule per practice. `checkedConfig`
accepts `wayOfWorking` as one of the three and refuses any other, naming the
three; an absent value is the retained practice, so an old config keeps
working. The three evidence rules already read main-line commits and revisions:
a practice changes who and when, not what is recorded.

Fixtures in the gate's self-test and its fixture folders: three accepted
configs, one per practice; one refused (`"wayOfWorking": "git-flow"`); and for
`merged-but-open`, one delivered open leaf per practice — merged by the owner,
merged by the run, landed by a commit — plus a closed-leaf control, each
asserting the exact violation. That proves the rule reads the same shape under
each practice; it is not evidence of who pressed merge, since the export cannot
carry that.

## 10. Options for the mechanism, and the decision record

At least two options come from named patterns, not from habit.

**A — policy selection by reference** (Strategy, with the practice as the
strategy and the protocol rule as the context; the reference is the strategy's
table). The rules are the interface, one reference holds the practices, and the
recorded value dispatches between them. Cost: one reference every landing skill
carries, and one rule every landing skill cites; the value is inert unless a
rule cites it.
**B — a configuration profile**: `whoMerges`, `branchLifetime`, … as keys — the
parameterization the set already uses for `execution.landing`. Real, and
rejected on one owner per fact: it scatters a practice's content across six
keys, lets a project compose a practice no source describes and no test covers,
and makes the one question impossible.
**C — prose in the integration document.** Rejected because that document owns
facts and points at the config for values, so a covering choice there would be
a second owner — not because skills cannot read prose, since A's reference is
prose too, dispatchable because it is one file with sections named after rules
and practices.
**D — a skill per practice** (one variant per product line, copied). It rejects
what the others share, that one mechanism serves all three. It costs three
copies of a long skill and the protocol beneath it, shared rules drifting, the
router's list tripled — and a practice is a landing shape, not a workflow.

| option | steady state | at ten times the work | when a part fails | operability |
| --- | --- | --- | --- | --- |
| A | one reference read where landing matters | unchanged: one value, one reference | a wrong value is refused by the gate, naming the three | one file, one rule, one key |
| B | six keys to keep consistent | a composed practice nobody wrote | a half-changed profile lands wrongly and no rule notices | six keys, no owner of the whole |
| C | the integration document grows a second job | it becomes a policy document | values and facts disagree with no precedence | two owners of one answer |
| D | three copies to keep in step | drift between copies | a rule fixed in one copy only | three skills, three reviews |

**Decision: A.** What it makes hard later: a practice whose six questions do
not fit the reference's order needs the interface re-thought, not another
section — which is the intended pressure.

**The decision record** (MADR's fields). *Context*: as §1 and §3. *Drivers*:
§2. *Considered options*: §10, each with the reason it lost. *Decision*: A, one
config value, one rule, one reference. *Consequences*: §7 and §8, and the
rollout of §12. *Assumptions, each with what would invalidate it*: that the
gate's evidence rules stay revision- and main-line-based (invalidated by a rule
that reads a pull request's state, which would tie the gate to one practice);
that a run can read the profile without a model call (invalidated if the
practice ever needs live state, not a recorded value); that the review the set
already runs satisfies the practices that require one before landing
(invalidated by a practice whose review must be a person's); and that forty
prose sites are one paraphrase each rather than forty decisions (invalidated by
a site that states a duty the reference cannot carry). The values this decision
carries — a branch bound per practice, the six variation points — are read with
the mechanism that produced them: a bound is derived from the practice and
shown in the profile, and the variation points are the reference's six
sections, so neither is restated as a number somewhere else.

## 11. The review, and what it found

The frame and the four decisions reached the owner before the design was
written at length; then a different model reviewed the design before any code,
in the manner of an architecture review: the scenarios walked against the
chosen mechanism, findings given as the points the important scenarios turn on,
the trade-offs, and the risks. Its blocking findings, and how each was answered:

1. A protected main line was taken to forbid trunk-based work. Answered by
   resolving push, pull request and approval separately (§6): a practice the
   rules stop is recorded with the constraint named, never declared impossible
   on one fact.
2. The empty-repository question asserted facts it had no way to read.
   Answered by showing them as assumptions the owner corrects (§6, §13), and by
   the recommendation that follows from them.
3. A run's practice had no durable pin across a hand-over. Answered by §7's
   record and resume rule.
4. A retained project would silently acquire a second review model. Answered by
   keeping the project's own review rule common (§8).
5. Changing the practice could have used a setup mode that skips proofs.
   Answered: the ordinary bounded rerun, all proofs (§7).
6. One setup version could not carry both a finished check and a new setting.
   Answered by two increments and two versions (§12).
7. The scenarios were to be simulated after the choice shipped. Answered by
   making the scenario matrix the acceptance of the increment that ships the
   choice (§13).
8. One fact had two owners. Answered by §7's one owner per value.
9. A proposed fixture could pass without testing its rule. Answered by the
   delivered-open-leaf fixtures and their control (§9).
10. The mechanism options were not named patterns. Answered by §10.

Two findings stayed comments rather than changes: the reference is prose, and
prose is dispatchable only by a rule a reader follows — accepted, since the set
is prose read by an agent; and the six variation points are a claim that the
sites do collapse that way — kept, to be checked by the increment that cites
them to the reference.

## 12. Rollout: the increments that shipped, and the one that remains

**The checks increment shipped first and is finished**: it widened two existing
gate rules and added the one required line a feature's plan now carries, and it
shipped before this document was written, in 0.139.0 with setup 0.67.0. Then:

1. **Words, no choice — shipped in 0.140.0.** Every site of the inventory was
   rephrased over "this project's way of landing"; the retained practice was
   the only one written; `references/landing.md` held its section and no other
   heading. No key, no question, no change to any check rule and no new setup
   version: setup stayed at 0.67.0, a project that updated it reran nothing, and
   every run behaved as it did.
2. **The choice — shipped in 0.141.0, setup 0.68.0.** The other two sections;
   the six variation points cited to them; `wayOfWorking` in the config and in
   `checkedConfig`; setup's question and its facts table; the branch-bound
   defaults; the fixtures; both READMEs and both manifests. It took the next
   setup version, because a setting added under a released version reaches
   nobody, and a project that had just updated was not sent to setup twice for
   one change.
3. **What the first projects teach — the increment that remains.** Behaviour a
   first project's runs show to be wrong is fixed with its fixture, and the two
   versions answer different questions: every change to what a skill does raises
   the plugin version, while the setup version rises only where a project must
   redo its installation — a changed check rule, a new config setting, a new
   adapter duty or a new proof. A wording or dialogue change raises the plugin
   version and never the setup version; a fix that changes what an installed
   check decides raises both. This increment reads what the scenario matrix and
   the traces cannot: a practice met by a project whose facts nobody imagined.

## 13. The test, and the dialogue

**Proof, before the practices are offered.** The acceptance of increment 2 is
the scenario matrix below, each scenario held by the strongest thing that can
hold it: a check the set's own tests assert, or an independent agent's reading
of three short traces where no check can. The traces are written from the
shipped text only and judged against that practice's promises; all three passed
at the third round, and the verdicts are in the increment's record. What a test
can assert, the set's own test and the gate's self-test assert: the accepted and
refused configs; one delivered open leaf per practice with its closed-leaf
control; the practice and the config revision a run pinned, written through the
run script's `claim --note` and read back from the comment it posts; an absent
value read as the retained practice; and a retained config's review preference,
fallback and landing unchanged. The owner is given no reading: a few lines of
trade-offs and limits, and only the question.

| # | how it is held now |
| --- | --- |
| S1 | The set's own test holds the setup text's contract: the entry is asked for in every repository, empty ones included; an empty repository is told plainly which facts are assumed; a rerun says in one line when a fact now contradicts the record; and nothing is recorded from silence. The four facts read or assumed, and the owner's corrections, are left to a model evaluation over `test/dialogue-scenarios.md` cases 34, 35 and 38: an empty repository, one already working in another way, and a setup left unanswered. |
| S2 | The gate's self-test reads an absent practice as the retained one, and reads a retained config as keeping its review preference, fallback and landing; the gate's rules judge such a config exactly as before. |
| S3 | The three traces, one per practice, read by an independent agent against each practice's promises: PASS for all three, in the increment's record. |
| S4 | The set's own test asserts that setup names the rule, records the answer with the constraint named, and edits no protection, hook or queue setting; the conversation is read by case 36. |
| S5 | The set's own test holds the pin's text contract and the round trip: the run script's `claim --note` prints the practice and the config revision, and the comment it posts carries both, so a resume has them to read; the resume's one line is left to case 37. |

**The dialogue is the shape of one profile entry, not a script.** Setup owes the
owner one entry in the profile, never a questionnaire of its own, and the entry
has these parts in this order: the practice their work should reach the main
line by; one recommendation; the four facts the recommendation rests on, each
said as read or assumed, with what a correction would change; what the project's
own rules make of the choice, and the nearest practice a rule allows where one
stops part of it; and the values the practice derives, each marked as retained
or proposed. The owner accepts the profile whole or changes this entry by naming
another practice; a correction that moves the recommendation produces one more
question; and silence records nothing, so the config carries no practice, the
retained one stays in effect, and the question is put again at the next setup.
The words are the moment's, governed by the protocol's **Speaking to the owner**
and **How an open question is put**: a fixed script would age, and what must not
vary is the entry's content and its order, not its wording.

**What the owner hears about the rest**: the practice, its cost, what the
project's own rules make of it — and nothing about the mechanism, the
reference's shape or the config key, by the rule that the owner hears only the
trade.

## 14. What this makes hard later

A practice that does not fit the six questions needs the interface re-thought,
not another section; a project wanting half of one practice picks one, and
hears why; and a project whose rules stop a practice keeps a record that names
the constraint, so the next reader can see the choice that was made for it
rather than an assumption nobody wrote down.
