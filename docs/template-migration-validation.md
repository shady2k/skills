# Template migration validation

Base: GitHub main `1881a94fee5aedcfd3212a93b1df0540772b6eca`, plugin
0.108.0, setup 0.45.0. Local branch: `build/skill-templates`.
Worktree: `/Users/shady/Documents/Codex/2026-10-15/task-2/implementation`.
Tracked task: `skills-iq2f`.

## Scope and compatibility

38 authoring templates cover 24 entries, the core protocol and 13 canonical
references. Three stable fragments share the two exact backlog prerequisites
and the speaking callout. The catalog assigns one owner to each fragment.
Authoring templates end in `.md.in`; fragments end in `.md.inc`. There is no
`SKILL.md` under authoring. Large rules remain relative references.

`npm run build` renders canonical texts, then runs the retained transitive
packager. `npm run protocol` invokes the same pipeline. The setup bump edits the
protocol's authoring source. `npm run build:check` checks rendered text, packaged
copies, unreached resources, include validity and concrete local-link targets.
It does not modify files. `npm test` runs these checks before existing tests,
so the existing CI workflow enforces freshness without installer changes.

Evidence: after repeated builds,
`git diff --exit-code 1881a94 -- skills` exits 0. All 462 existing installed
files, including all entry text and packaged resources, remain byte-identical.
Plugin/setup versions and all manifests are unchanged. This commit changes the
authoring pipeline, not installed skill behavior, so it does not bump versions.

The duplicate check uses authoring sources only, excluding outputs, examples,
headings, short text and fenced code. Current exact-paragraph debt inventory is
empty. Near-duplicates (MODELDIR/ENGINE variants, reviewer policy and owner
question rules) remain separate for semantic review; no semantic deletion was
performed. Whitespace variants and paraphrases are outside the exact checker.

The official installer source reviewed was vercel-labs/skills 1.7.2 at
`13e4063a1cf913f5606d57d42ab83a86f5001e04`: the command is
`npx skills add`, plural, and discovery searches for literal `SKILL.md`.
No downloaded installer was executed. All 24 skill folders were copied to
disposable directories and their concrete local Markdown links checked there.
This filesystem smoke is not a real installer/harness discovery run.

## Checks on Mac mini

| Check | Result |
| --- | --- |
| build, rebuild, freshness, duplicate inventory | Pass; 299 generated files |
| New build tests | 5/5 pass |
| Standalone folder/link and authoring discovery checks | Pass for all 24 skills |
| Existing repository contract | Pass: 24 skills, 462 files |
| Setup lock | Pass: 28 installed and 3 layout files |
| Pi contract/stdio | 5/5 pass with `TMPDIR=/private/tmp` |
| Existing Node test files after the selftests | 162/163 pass with `TMPDIR=/private/tmp` |
| Full npm test | Not green; tracker-sync proof fails before later Node tests |
| Codex/omp smoke | Blocked: tests require Linux and bubblewrap |
| Pi installation smoke | Blocked: Pi CLI absent |
| Prime smoke | Blocked: prepared `PRIME_AGENT_KERNEL_PYTHON` absent |
| Real skills installer smoke | Not run: source checkout has no built dist/dependency installation |

The new tests exercise byte preservation, deterministic includes, unknown IDs,
cycles, duplicate inclusion through nesting, malformed directives, stale manual
entry/copy edits, missing local links including anchors, untemplated entries,
new authored repetition, standalone folders, setup-version bump and packaging,
and anchored references in the retained transitive packager.

The one Node-test failure is the detached-descendant group-stop assertion.
It also fails in an unmodified base checkout (61/62 in the relevant two test
files). Default macOS temporary paths additionally cause realpath differences;
using `/private/tmp` removes those failures from Pi and the Node test files.

Tracker-sync's clean hooks-marker case and beads connect/settings cases fail
here; associated mutation proofs then fail because the clean case did not pass.
Targeted runs on unmodified base reproduce both families. The failures include
`/tmp` versus `/private/tmp` reachability and a br import reporting that beads
is uninitialized. They were recorded without modifying unrelated tracker code.
Raw `FAIL` lines within mutation runs include deliberate breaks, so they must
not be read as separate regressions. The full proof verdict remains failed.

Independent agent review found stale-copy and link-validation gaps; both were
fixed and regression-tested. Its anchored-link follow-up was also fixed in the
builder, retained packager and tests. It did not constitute a different-model
or actual harness acceptance run.

## Next step

Review the local implementation and the runtime-context proposal in
[skill-authoring.md](skill-authoring.md). Keep runtime compilation out of this
change. Run the real installer in isolated configuration and the preserved
Linux harness smoke tests before publication; resolve or explicitly account for
the existing baseline failures. Push, PR and release require separate agreement.
The old personal checkout and the cloned base checkout have no tracked changes.
