## Backlog integration

Written by `/setup-shady2k-skills` on <date>. What the skills of that set know
about this project, and all they know: the protocol itself ships with them.
Edit it freely; re-run the installer only to change the tracker or the gate's
strength.

- **Vision:** <path>
- **Milestone charters:** <directory>/<milestone label>.md
- **Evidence that may be cited at close:** <a commit, a test, a file or symbol | a runbook run, an alert fired in a drill, a dashboard value | …>
- **Features and stages are created as:** <the tracker's type that the adapter maps to `epic`>. The gate looks for a DONE WHEN on that type only.
- **Labels:** ideas wear `<idea label>`, findings wear `<finding label>`. The area labels, the current milestone and the finding budget are the gate config's, read from there and never copied here.

### The gate

- **Config:** <path>
- **Adapter:** <path>
- **Rules:** <path of `check.mjs`: called in place, or a verbatim copy of version <version>, never edited>
- **Strength:** <block | block-new | report>, chosen <date>
- **Run it:** `<the exact command, as the hook runs it>`, from <the directory it runs in>
- **Every violation as JSON:** `<the same with --json>`
- **Hooks in a fresh clone:** `<the command that installs them>`
- **Ages from before a bulk edit:** add `--ages-from <snapshot>` to the command
  above. Snapshots so far: <date of the bulk edit, path of the adapter output
  saved before it>.

### Tracker operations

What the skills ask of this project's tracker. **How the tracker is driven is
said once**: where this document, or the tracker's own skill, already says how,
the row names that place and adds only what the protocol needs on top. A row
carries a command only where nothing else does. Where the tracker cannot do
one, say so and say what stands in.

| the skills ask for | here                                                    |
| -------- | ------------------------------------------------------- |
| create   | <title, type, labels, parent, body>                     |
| link     | <blocking edge; parent; how provenance is kept apart>   |
| claim    | <hold an issue: status and holder in one step. What happens when two claim at once: the tracker refuses the second, or last write wins and the claimer re-reads after claiming> |
| release  | <give it back>                                          |
| close    | <with a reason>                                         |
| comment  | <add a note to an issue>                                |
| edit     | <retitle, rewrite the body, move to another parent>     |
| unlink   | <remove a blocking edge>                                |
| defer    | <with a review date, or where the date is recorded>     |
| undefer  | <bring a deferred issue back>                           |
| milestone | <put an issue in a milestone: a label, or the native field> |
| ready    | <ready leaves only; how features and stages are left out> |
| holds    | <every active issue with who holds it>                  |
| children | <every child of an issue in every status, not the ready ones only; with a rollup by status if there is one> |
| label    | <add, remove>                                           |
| search   | <by phrase; and the listing of one area>                |
| show     | <one issue whole, with its comments>                    |
| publish  | <how a backlog write reaches everybody else; after the gate is clean> |
