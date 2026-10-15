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
files cannot become additional skills. `npm run test:skills:smoke` runs the pinned official package with an asserted
repository URL and npm integrity before installation. It uses disposable HOME,
XDG directories, target projects, source copies and npm cache, distinct empty
npm configs, no inherited credentials, disabled telemetry and lifecycle scripts.
It installs all 24 entries and a standalone take-task folder, checking every
installed resource byte and concrete Markdown link. It is an explicit network
smoke, not part of the offline test suite.
Every installed skill keeps its entry and reachable dependencies in its own
folder. Existing Claude/Codex/Pi/omp contracts and smoke tests remain in place.

## Coverage of reviewed duplication

The byte-identical first stage centralized the two prerequisite variants and the
nine-entry speaking callout. The second stage factors their shared prerequisite
prefix once, while preserving each variant's distinct ending. It also gives
reviewer policy one owner in agents, model/engine definitions and no-engine
behavior one owner in model-environment, and worked-question material one owner
in deciding. Consumers link those policies; unique step duties remain local.

See [policy-consolidation.md](policy-consolidation.md) for the individual
assertions, before/after comparison, consciously distinct conditions and
regression checks. This satisfies ownership for the reviewed groups, not a claim
of a complete semantic-duplication audit of the whole repository. An empty
exact-paragraph inventory alone never proves semantic deduplication.

## Project configuration at runtime: proposal only

Direct reading remains sufficient for static individual settings: project
language, configured check commands, document paths, selected reviewer/fallback
and a concurrency limit. A template would only repeat their JSON or integration
values, add cache invalidation and risk hiding an unresolved conflict.

| Existing step | Potential on-demand specialization | Why reading config alone is insufficient |
| --- | --- | --- |
| take-task preflight, worker dispatch and review | A short effective execution profile: configured concurrency, agreed reviewer/fallback and the route actually reachable in this harness | Policy comes from gate config/integration; executable availability is live harness state. Do not call a model just to render a profile |
| take-task resume and claim | Current coordinator/held items, run route and next permitted action | This comes from current ledger and tracker/remote state, not static config; never cache claims or infer permission from a summary |
| take-task / to-milestone finding budget | Remaining allowance and whether an owner decision is required | Config supplies policy; actual spending comes from current milestone/tracker data |
| setup rerun or compatibility preflight | Retained settings, incompatible setup versions, missing prerequisites and conflicts across integration/config | Requires comparing multiple sources and installed versions; simple reading is enough if no reconciliation is required |

These are candidates for a small read-only context command, not dynamically
rewritten SKILL.md files. If approved, call it through each harness's shell with
an explicit project root; without a shell, read the same sources directly. The
published Git installation remains usable without the helper. Key any static
cache by canonical project root, relevant content hashes, setup/plugin versions
and context schema version; refresh live availability, run/claim and budget
state on every use. Shared user config may supply preferences only under an
explicit precedence policy; conflicts require disclosure, not silent override.
Never mix projects, embed secrets, persist credentials or treat config as new
consent. No runtime generator, cache or new dependency is implemented here.
