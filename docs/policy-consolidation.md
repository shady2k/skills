# Shared-policy ownership, second stage

The byte-identical migration remains in commits `3061023` and `cb0885d`.
`git diff --exit-code 1881a94 3061023 -- skills` proves the first stage changed
no installed file. This stage intentionally changes composition and packaged
reference paths while retaining obligations, conditions and authority.
Plugin 0.109.0 is a local version bump for delivery of the revised text; setup
stays 0.45.0 because installation contracts/check rules do not change. No release,
push or PR has been performed.

## Assertion inventory and equivalence

| Assertions before | Single authoring owner now | What the consumer retains |
| --- | --- | --- |
| Reviewer is another reachable model, not a particular product; same-model agents do not qualify | agents.md.in, “A reviewer on another model” | Setup chooses whether independent review is required for acceptance and links the exact policy heading |
| Subagent override where supported, external CLI or API; one real proof; record route/model; repair failures, tell owner, fallback only as agreed | The same agents section, unchanged | Setup applies that policy rather than repeating its route/proof/repair checklist |
| MODELDIR defaults to model/ beside code; alternate path comes from engine section in product agent doc | model-environment.md.in | Each model skill links the exact shared section; describe alone defines PRODUCT and manifest-based REPO |
| ENGINE is the engine checkout, with wiki/layout/model check; location comes from the product agent doc | The same model-environment section | Write alone retains both-checkouts/git requirements when an engine is installed, git -C and trusted check working directory/Bun preload requirements |
| With no engine, still write complete deliverables, do not run the check, disclose unchecked model and explain installation | The same model-environment section | Describe still requires the review report to record unchecked status; this report duty is not imposed on other skills by the shared definition |
| Worked decision material contains inspected/tried information, options and each cost, evidence for each option, recommendation and strongest objection; initiative/examples/counterexamples and approval evidence remain required | deciding.md.in, “Decision material” | Speaking links this material for supervised questions and in its outgoing-message check, instead of repeating the checklist |
| A question from a run in another session additionally says what/why now, time/risk/reversibility per option and cost of waiting | The same deciding section, explicitly scoped to that kind of run question | Speaking still requires the supervising session, reading run record/code and verifying claims; unworked material remains its homework |
| A pushed notification contains only a decision-waiting notice, topic and waiting cost; full question waits in the conversation | speaking.md.in, supervised-question section | Deciding owns no routing or notification behavior |
| Common integration prerequisite: find provided integration, follow project pointer before writing, stop backlog writes and suggest setup if absent | backlog-integration-prerequisite.md.inc | Existing permanent variant IDs include this common prefix, then keep their distinct protocol-reading/setup-check or protocol-description endings |

The original excerpts are retained in
`test/fixtures/policy-consolidation-before.json` at base `cb0885d` for review.
“Evidence behind them” is made explicit as evidence behind each option; this
retains the old supervised-question requirement “evidence for each”. The
no-engine rule's “every file required by the current skill” means describe's
full output and write-intended-model's model/report, not a reduced common subset.

Distinct conditions were deliberately not merged. Describe requires the whole
repository to be clean and names the folder/command on refusal. Write requires
cleanliness for the files described and preserves why commit/blob evidence
cannot name uncommitted text. Its no-execution rule, engine-installed checkout
conditions and Bun working-directory safety remain local. Speaking's generic
summary fields and product-facing presentation rule retain their separate
reporting purpose; the worked-question policy is linked rather than copied.

## Regression checks

`authoring/policy-ownership.json` enumerates retained policy assertions,
canonical definitions, exact consumer links and distinct local conditions.
`npm run build:check` enforces it on catalogued authoring sources only. It
rejects missing conditions, returned recognizable definitions outside their
owner, or duplicate definitions in the owner itself. Lexical guards cannot
prove equivalence for arbitrary future paraphrases; semantic review is still
required.

Negative fixtures reintroduce each original repeated block into its consumer;
remove each manifest condition/link; and duplicate each owner definition.
All must fail the gate. Standalone copying and real installer checks verify that
the new reference is packaged locally in both model skills. No runtime compiler
or config-specific generated SKILL.md was added.

## Validation and publication status

The focused build, ownership, model, plugin and Pi tests pass (29/29). Repository
contract passes for 24 skills/465 files and setup lock passes unchanged. Both
strict Claude manifest validations pass in disposable configuration. Build,
freshness, exact-prose duplicate checks and concrete local links pass.

The pinned official skills@1.7.2 installer smoke passes for all 24 entries and
standalone take-task, with resource bytes and local links preserved. The Linux
contract run in the existing image passes the same 29 tests, build freshness,
ownership, repository contract and setup lock. Independent read-only review
found no semantic/portability blocker and independently passed the 9 build/
ownership tests and build:check. It was not a different-model harness run.
The earlier full-suite limitations remain: tracker-sync proof 83/120, a baseline
macOS detached-descendant failure (162/163 in the Node-file run), and missing
Linux Codex/omp/Pi CLI/bubblewrap in the checked existing environments. Unrelated
tracker code is unchanged. A focused green run does not mean the full suite or
real harness acceptance is green.

The reviewed duplicate groups now have single policy owners. This is not a
claim that every assertion throughout the entire repository has been audited.
Ready for local review; publication still requires the missing harness smoke,
resolution or explicit accounting of baseline failures, and separate push/PR/
release agreement.
