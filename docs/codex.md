# Codex distribution

The same skill source files serve Claude Code, Codex and standalone installation.
Codex metadata lives beside each skill in `agents/openai.yaml`; user-only skills
set `policy.allow_implicit_invocation: false`. The repository test keeps that
policy aligned with Claude's `disable-model-invocation` frontmatter.

## Install and update

From a published revision containing the Codex manifest:

```bash
codex plugin marketplace add shady2k/skills
codex plugin add shady2k-skills@shady2k
```

Open a new session in the project and explicitly invoke
`$shady2k-skills:setup-shady2k-skills`. A plugin install does not configure a
project's tracker or install its project hooks. Setup does that per project,
with the owner's choices and approval, and fully rechecks previous setups.

To update a Git-backed installation:

```bash
codex plugin marketplace upgrade shady2k
codex plugin add shady2k-skills@shady2k
```

Use a new session, then invoke setup again. The first command refreshes the Git
marketplace; the second installs its current plugin version. There is no assumed
automatic post-update setup hook. The protocol's version guard requests setup
before tracker writes when the project wiring is stale.

For a local checkout, use `codex plugin marketplace add /absolute/path/to/skills`
instead of the GitHub source. Do not register both sources under the same
marketplace name. A local marketplace does not support `marketplace upgrade`:
update the checkout, bump the release version, and rerun `plugin add` instead.
Use a fresh session to pick up the new installed cache.

Alternatively, `npx skills@latest add shady2k/skills` installs standalone skills;
choose Codex and the full set. Those use `$setup-shady2k-skills` without the
plugin namespace, and `npx skills update` updates them. Never combine plugin,
standalone files and development symlinks for the same set in one agent.
Inspect the previous installation before removing it and preserve local edits.

## Why the compatibility manifest

Codex CLI **0.154.0** was tested with this repository's bucket layout:

- `.codex-plugin/plugin.json` with `skills: "./skills/"` discovers all 16 skills
  recursively, including their `agents/openai.yaml` metadata.
- The existing `.claude-plugin/marketplace.json` is accepted. Its `source: "./"`
  points to the repository root, so no second catalog or copied skill tree is needed.
- A portable root `plugin.json` installs successfully but discovers **zero**
  skills in the nested buckets. Its presence overrides compatibility discovery;
  adding both manifests does not fix it. Do not introduce it without a passing
  end-to-end discovery test on a newer Codex version.

The [official plugin packaging documentation](https://developers.openai.com/plugins/build/plugins)
recommends portable packages for new layouts and still supports the compatibility
manifest used here. We preserve this repository's existing layout and choose the
format verified by the actual runtime. The plugin-creator helper validator assumes
flat skill folders and incorrectly treats `backlog`, `engineering` and
`productivity` as skills missing `SKILL.md`; its result is not a substitute for
the recursive runtime check.

## Verification

```bash
npm test
npm run test:mutation
npm run test:codex
claude plugin validate . --strict
claude plugin validate .claude-plugin/plugin.json --strict
```

The Codex smoke test requires Linux, bubblewrap, Git, Node and Codex CLI. It uses
temporary Git repositories and state directories, a read-only host mount and no
network. A Git URL rewrite routes the test-only remote to its temporary repository.
It does not alter `HOME`, `CODEX_HOME`, personal configuration, installed plugins
or authentication, and makes no model requests. Diagnostics remain under the
temporary path printed by the test.

The test exercises both dual-harness packaging and a Codex-only manifest,
while retaining the shared marketplace. It checks install, plugin details,
actual `skills/list` discovery, namespaced names without duplicates, metadata,
byte-for-byte preservation of every skill resource, runnable check scripts,
Git marketplace upgrade, reinstall, and updated-cache pickup in a new session.

`npm test` also rejects manifest name/version drift, incomplete skill selection,
marketplace target drift and introduction of the currently incompatible portable
manifest. The checks' versions and protocol copies remain synchronized across
both distributions.
