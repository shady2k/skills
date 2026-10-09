# The agents this set runs in

The set installs through each agent's own package commands, listed below, and
works the same in every one of them. What the set needs from an agent is
listed at the end, by capability, not by product.

## Installing and connecting

Every command here is quoted from the set's README or the installation
document named beside it; scopes, updates, removal and local checkouts live
there, and only what a person needs to begin is repeated here. Install in the
project's main checkout, then run setup in a new session of that agent.

- **Claude Code.** Install from the project's main checkout, not from inside
  a worktree, so every worktree of the repository loads it:

  ```
  claude plugin marketplace add shady2k/skills
  claude plugin install shady2k-skills@shady2k --scope project
  ```

  Then start a new Claude Code session in the project and run
  `/shady2k-skills:setup-shady2k-skills`. The three scopes (`project`,
  `user`, `local`), the worktree catches and the removal commands are in the
  set's README, the "Installation and updates" section.

- **Codex.**

  ```
  codex plugin marketplace add shady2k/skills
  codex plugin add shady2k-skills@shady2k
  ```

  Then start a new Codex session in the project and run
  `$shady2k-skills:setup-shady2k-skills`. Local checkouts and updates are in
  the set's `docs/codex.md`.

- **omp.**

  ```
  omp plugin marketplace add shady2k/skills
  omp plugin install shady2k-skills@shady2k
  ```

  The install covers every repository (`user` scope, omp's default): what the
  set needs, because omp's `project` scope is kept per checkout. Then start a
  new omp session in the project and run `/skill:setup-shady2k-skills`. Local
  checkouts and updates are in the set's `docs/omp.md`.

- **Pi.**

  ```
  pi install git:github.com/shady2k/skills
  ```

  Then start Pi in the project and run `/skill:setup-shady2k-skills`. Local
  checkouts, project scope and hosts without the native MCP registration API
  are in the set's `docs/pi.md`.

- **Prime Agent.**

  ```
  prime-agent package install git:github.com/shady2k/skills
  ```

  Then start Prime Agent in the project and run
  `/skill:setup-shady2k-skills`. If you want Jev too, connect it once as a
  user action outside the install:

  ```
  prime-agent mcp add jev -- node "$HOME/.prime/agent/git/github.com/shady2k/skills/mcp/jev-server.mjs"
  ```

  Local checkouts and the limits of automatic Jev support are in the set's
  `docs/pi.md`, the Prime Agent section.

Installing any of these grants no project consent, stores no credential and
calls no model: it only puts the skill files where the agent loads them.

## A reviewer on another model

The reviewer is a reviewer on a different model that can be reached from this
harness, not one product. The ways to reach one are: a subagent with a model
override, where the harness can start one; an external agent CLI; an API.
Setup proves the chosen way with one real call and records the way and the
model on the integration's Reviewer line. A recorded way that stops working
is repaired, never silently replaced: the owner is told, and the recorded
fallback is used only as agreed. Two agents on the same model are not another
model.

## What the set needs from an agent

Three capabilities, each met or plainly not:

- **Read a session's transcript on this machine.** The time records are
  measured from it.
- **Say which agent is running, not only which session.** Some harnesses run
  several agents in one session, and then the session alone does not say who
  did the work.
- **List a session's subagents, where the harness keeps them apart.**

The harness-specific code for these lives behind one adapter per harness in
the run scripts' `ledger.mjs`. `node ledger.mjs adapters`, from
the take-task skill's folder, prints what this copy of the set supports
and what each harness cannot do; name the supported harnesses only from its
output, never from a list here, so the list cannot go stale. A harness with
no adapter is told plainly ("unsupported here: what is missing"), never read
as "no time".

A worker running inside its coordinator's session records nothing of its own:
its time is the coordinator's, and a worker claim from that session is
refused.

The record format and the adapter's functions are not restated here: they
live in `time-format.mjs` and `ledger.mjs`.
