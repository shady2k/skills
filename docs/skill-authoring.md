# Authoring and publishing skills

Installed files remain ready to read. Installation never runs a build or needs
Node for templating. Public paths, manifests and update versions are unchanged.

Edit `authoring/skills/**/SKILL.md.in`, not published `skills/**/SKILL.md`.
The setup owner's reference Markdown is authored there too. The protocol core is authored there as well; `npm run bump -- … --setup …`
updates its source before `npm run protocol`. Other resources
(executables, seeds and fixtures) retain their existing owners.
`authoring/catalog.json` maps each generated output to exactly one source.
Each fragment has a permanent ID, a source and one owning skill. Keep IDs stable
when wording changes. Use `{{include:ID}}` for short mandatory text; keep large
rules and phases as ordinary relative Markdown references, loaded on demand.
Includes preserve every byte and add no whitespace. Cycles, unknown IDs and
repeated IDs within one output fail, including repetition through nesting.

Run `npm run build` before reviewing/publishing. It renders canonical texts
first and then invokes the existing `test/sync-protocol.mjs` transitive packager.
`npm run protocol` remains an alias for this pipeline. `npm run build:check`
checks generated text and shared copies without writing; `npm test` runs it in
CI. Manual output edits fail this check: move intentional edits into the source.
Generated headers are deliberately absent to preserve the migration's bytes.

The exact-prose duplicate check reads catalogued authoring sources and fragments
only, never installed outputs or examples. Short text, headings and fenced code
are excluded. `duplicate-baseline.json` records existing repetition that needs
human semantic review; do not automatically delete or consolidate it. New or
expanded repetition fails. Review any inventory change explicitly. This check
cannot recognize paraphrases. The MODELDIR/ENGINE, reviewer-policy and owner
question near-duplicates remain separate in this structural migration.

## Installer compatibility

The official command is `npx skills add shady2k/skills` (plural). The upstream
[README](https://github.com/vercel-labs/skills#readme) also documents installation
from a skill-folder URL. Source inspected: vercel-labs/skills commit
`13e4063a1cf913f5606d57d42ab83a86f5001e04`, package 1.7.2.
`src/skills.ts` discovers literal `SKILL.md`; authoring `.md.in` and `.md.inc`
files cannot become additional skills. No downloaded installer was executed.
Every installed skill keeps its entry and reachable dependencies in its own
folder. Existing Claude/Codex/Pi/omp contracts and smoke tests remain in place.

## Project configuration at runtime: proposal only

Keep publish-time common rules separate from current project state. `take-task`
needs the project's integration, reviewer route, execution policy, budget and
current run state; setup already records these choices. Reading JSON or the
integration directly remains sufficient for isolated settings. A small computed
preflight summary could help only where multiple sources must be reconciled:
chosen reviewer and reachable route, permitted concurrency, remaining budget,
setup compatibility and resumed run status. It should cite the sources and
report conflicts instead of inventing defaults or permissions.

If later approved, make that summary a read-only command callable from any
harness's shell, with explicit project root; harnesses without a shell read the
same source files. Never mutate the installed SKILL.md. Scope any cache by
canonical project root, relevant config content hashes, setup/plugin versions
and command schema version; live budget/run state must be refreshed each time.
Do not embed secrets. Configuration changes invalidate summaries and never grant
new authority. This needs no change to today's Git or skills installation.
No runtime compiler, cache or new invocation requirement is implemented here.
