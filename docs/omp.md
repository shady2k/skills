# omp distribution

omp installs Claude Code plugins as they are: it reads the same
`.claude-plugin/marketplace.json` catalog and the skill list in
`.claude-plugin/plugin.json`. No omp-specific manifest is needed, and none is
added: `.omp-plugin/marketplace.json` would take precedence over the shared
catalog in omp and have to be kept in step with it.

## Install and update

```bash
omp plugin marketplace add shady2k/skills
omp plugin install shady2k-skills@shady2k
```

Install at `user` scope, the default. omp keeps `project` scope per checkout
(the nearest `.omp/` or `.git`), so a worktree would not see a project install
made in the main checkout. omp names a plugin's skills without the plugin's
prefix: `/skill:setup-shady2k-skills`, `/skill:take-task`.

To update:

```bash
omp plugin marketplace update shady2k
omp plugin upgrade shady2k-skills@shady2k
```

`omp plugin upgrade` without a name, and omp's own update check at startup,
compare only catalog entries that declare `version`. That is why the catalog
entry carries the plugin's version: without it every release reached omp users
only through the named upgrade above. Claude Code reads `plugin.json`'s version
first and refuses (under `claude plugin validate --strict`) an entry that
disagrees with it, so `npm run bump` writes both and `npm test` fails when they
differ.

For a local checkout, `omp plugin marketplace add /absolute/path/to/skills`.
Refresh it with `marketplace update` and upgrade as above; a fresh session picks
up the new cache.

omp can also load plugins from Claude Code's own registry when that source is
turned on. Install through omp anyway: those copies follow Claude Code's
updates, not omp's, and the same skill name from two sources loads once, from
whichever omp ranks first.

## Jev's tool server

omp reads the plugin's root `.mcp.json` as Claude Code does and fills in
`${CLAUDE_PLUGIN_ROOT}` itself; the server starts in the session's directory,
which is how it finds the project. omp approves tool calls by default. The
plugin's `bin/` is not put on omp's `PATH`, so a worker there calls `jev.mjs`
by its path when it needs Jev from a shell.

## Verification

```bash
npm run test:omp
```

Requires Linux, bubblewrap, Git, Node and omp (verified with 18.1.17). It binds
a temporary directory over `~/.omp`, hides `~/.agents`, `~/.claude` and
`~/.codex` so no other skill stands in for the plugin's, runs without network,
and routes the published `shady2k/skills` source to a temporary Git repository.
It checks that all skills are discovered once, that the cached checks run at the
setup version, and that `omp plugin upgrade` with no name reaches a new release.
Skill discovery is read over omp's RPC mode with a placeholder key; no model is
called.
