# Pi distribution

Pi reads `package.json`: `pi.skills` exposes the complete nested `skills/`
tree, and `pi.extensions` loads the bundled Jev MCP registration. Claude Code,
Codex and omp keep their existing manifests and installation methods.

## Requirements

Verified with the published `@earendil-works/pi-coding-agent` **1.0.0** and
Node **24.19.0**. Pi 1.0.0 requires Node **22.19.0 or later**; `node` must also
be on `PATH` to start Jev, including when using a standalone Pi binary.
Automatic MCP registration requires `ExtensionAPI.registerMcpServer`.
Older Pi releases and forks are not assumed to provide it: the extension
leaves Jev unregistered without stopping the host or its skills. Use that
host's native MCP setup if Jev is needed.
No Pi dependency is bundled or installed by this package.

The contract was checked against the published package's extension types,
loader and built-in MCP implementation, as well as the official
[package documentation](https://pi.dev/docs/latest/packages) and
[MCP extension API](https://pi.dev/docs/latest/extensions#mcp-servers).

## Install and update

Once this change is published to the repository:

```bash
pi install git:github.com/shady2k/skills
```

This is a personal install, available in all projects and worktrees. Use
`--local` only when you want a project declaration in `.pi/settings.json`;
project packages load after project trust. Do not also install standalone
copies of these skills in the same Pi configuration.

For an unpublished local checkout, use its absolute path instead:

```bash
pi install /absolute/path/to/skills
```

Local packages are loaded in place. Keep the entire checkout: Jev imports its
implementation from `skills/backlog/setup-shady2k-skills/` and reads the root
`package.json`; copying only `extensions/` or `mcp/` is not sufficient.

Start a new Pi session in the project you want to work on, then invoke:

```text
/skill:setup-shady2k-skills
```

Other skills use the same syntax, for example `/skill:ask-shady2k`.
Update a Git install with:

```bash
pi update --extensions
```

Restart the session (or use `/reload`) after an update. A pinned Git tag or
commit stays pinned; update its package source explicitly to change versions.
A local install follows that checkout, so pull/update the checkout instead.

## Jev: session-scoped, project-local

The extension registers `jev` once when it loads; Pi starts and closes the MCP
connection with the session. The server path is resolved relative to the
installed extension, while the working directory is supplied by Pi's session.
No machine-specific path is shipped, and a stale `CLAUDE_PROJECT_DIR` inherited
from another harness is cleared for this subprocess. The extension does not
write `mcp.json`, settings, consent, credentials or an allow rule.

`exposure: "direct"` makes Jev available in the model's tool list. Check `/mcp`
for connection errors, such as Node missing from `PATH`. A configured `jev`
entry in `mcp.json` takes precedence over this registration: inspect that
entry if Jev points to an older checkout. If another extension registers the
same name, Pi reports the conflict; keep only one registrar. Replacing or
disabling Pi's built-in MCP extension requires a replacement that handles
registered MCP servers.

Loading the package and listing tools do not call Jev's model. Calls still go
through the existing server's project-consent, credentials and masking checks.
The extension does not create credentials, grant project consent, schedule
replays or run periodic work. Configure Jev through the existing setup flow
only with the project's approval. Jev's key is read from
`$XDG_CONFIG_HOME/shady2k-skills/jev.json` (`~/.config/shady2k-skills/jev.json`
by default), or, when there is no file, from `JEV_API_KEY` in the server's own
environment. Pi's registration inherits the environment the Pi session
started with, so `JEV_API_KEY` must be set before that session starts.

## Time accounting

The run time records read Pi's and Prime's session transcripts as they read
Claude Code's, Codex's and omp's: from `~/.pi/agent/sessions` and
`~/.prime/agent/sessions`, or the folders their own variables name
(`PI_CODING_AGENT_DIR`, `PI_CODING_AGENT_SESSION_DIR`;
`PRIME_AGENT_CODING_AGENT_DIR`, `PRIME_AGENT_SESSION_DIR`,
`PRIME_AGENT_CODING_AGENT_SESSION_DIR`). omp kept Pi's variable names, so a
folder they name is counted as Pi's inside a Pi session and as omp's elsewhere.

Pi tells its tools which session they run in (`PI_SESSION_ID`), so a claim from
Pi names its own session. Prime and omp do not: pass `--harness prime-agent`
or `--harness omp` with `--session <id>`. Every Prime tool call is a Python
cell; it is classified by what the cell runs (shell commands, file writes and
reads, subagents). A Prime subagent keeps no transcript of its own, so its
cost and tokens are counted in the session that started it.

On a host without `registerMcpServer`, use that host's native MCP configuration
with `command: "node"` and one argument: the absolute path to this checkout's
`mcp/jev-server.mjs`. Keep the server's working directory at the target project,
not at the plugin checkout. Clear any inherited `CLAUDE_PROJECT_DIR`, or set
it to that same target project. Use the host's documented MCP setup command;
Pi package metadata alone does not connect Jev on such a fork.

## Prime 0.9.8 compatibility

Prime 0.9.8 uses the same package format but has no `registerMcpServer` API.
The extension leaves Jev unregistered without stopping Prime; all sixteen skills
load. Install the package for all your projects:

```bash
prime-agent package install git:github.com/shady2k/skills
```

Start Prime in your project, then use `/skill:setup-shady2k-skills`.
If you also want Jev, add its server **once** from the target project with the
path to the installed Git checkout's `mcp/jev-server.mjs`:

```bash
prime-agent mcp add jev -- node "$HOME/.prime/agent/git/github.com/shady2k/skills/mcp/jev-server.mjs"
```

A local checkout can be installed with
`prime-agent package install /absolute/path/to/skills` instead; use that same
absolute path for the Jev server. Keep the checkout at the path used by Jev.
Prime's native stdio transport inherits the session working directory and does
not forward
`CLAUDE_PROJECT_DIR` by default. Package and MCP commands write personal
settings unless `package install --local` is requested. Project MCP settings
are ignored for execution, so Jev needs the personal `mcp add` even when the
package is installed locally. Installing skills does not grant project consent,
store credentials, call a model or automatically connect Jev in Prime 0.9.8.

The Prime 0.9.8 release was tested with package install, RPC discovery of all
sixteen skills, and ordinary TUI startup in an isolated home. Its native MCP
client initialized the separately configured Jev server and listed its tool
without a model call. Interactive Jev use still needs Prime login and the
project's own Jev consent and credentials.

## Verification

```bash
npm run test:pi
npm run test:pi:smoke
npm run test:prime:smoke
npm test
```

`test:pi` uses Node's built-in test runner and no dependencies. It checks the
package contract, the non-fatal missing-API path and registration errors, and
relocates the full package to a path containing spaces. It starts the real
stdio server in a separate fixture project, initializes MCP, lists tools and verifies that an
unconfigured call refuses before any model request.

`test:pi:smoke` requires a supported Pi executable on `PATH` (or set `PI_BIN`
to its path). It installs the local package in disposable Pi configuration,
uses the real CLI's RPC mode to verify all sixteen skills, and checks live
Jev tool discovery through Pi's built-in MCP connection. It runs offline with
a minimal environment, a temporary home and no provider keys or model prompts.
It does not install this package in the developer's own Pi configuration.

`test:prime:smoke` requires Prime Agent, Linux `script` on `PATH` (or set
`PRIME_BIN` to the Prime executable), and `PRIME_AGENT_KERNEL_PYTHON` pointing
at a prepared Prime runtime Python. For example, after a regular Prime login:

```bash
PRIME_AGENT_KERNEL_PYTHON="$HOME/.prime/agent/kernel-venv/bin/python" npm run test:prime:smoke
```

It installs into disposable personal
settings, configures Jev through Prime's native `mcp add`, checks all sixteen
skills through RPC, starts the actual TUI to catch extension startup errors,
and initializes Jev through Prime's Python MCP client to list its tool.
A clean unauthenticated TUI does not create a kernel in the temporary home,
so the test uses only that explicitly supplied Python. It makes no model calls;
without a login, TUI use of Jev remains untested.
