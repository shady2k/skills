---
name: ask-shady2k
description: Ask what to do next. Reads the backlog's state and answers with one command, not a map of routes.
disable-model-invocation: true
---

# Ask shady2k

**Read the state first**, then answer with the one thing to do now.

## 1. Read the state

Read `docs/agents/backlog.md`. If it is missing, the answer is
`/setup-shady2k-skills` and you are done.

Then collect, using that file's gate command and tracker verbs:

- **The gate's report**, as JSON: `newErrors`, which checks fired, and each
  violation's own `fix` line.
- **The current milestone**: the config's `currentMilestone`, whether its
  charter file exists, its outcomes (the feature issues wearing its label) and
  which are done, its finding budget and how many findings it has taken.
- **Holds**: every active issue, who holds it, and when its tree last moved.
- **Ready leaves** inside the current milestone, and how many live issues there
  are in all.

## 2. Answer with the first rung that holds

Walk the ladder top to bottom and stop at the first rung whose condition is
true. Give that one answer. A second line is allowed only when the first
cannot be done without it.

| #  | condition                                                                            | answer                                                                   |
| -- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1  | the gate cannot run                                                                  | `/setup-shady2k-skills`                                                  |
| 2  | no current milestone, and there are live issues                                      | `/groom-backlog`: it declares the slice and defers the rest              |
| 3  | no current milestone and nothing live; or the milestone has no charter file; or no feature wears its label | `/to-milestone`                                    |
| 4  | issues are held and nothing in their trees moved within the hold limit               | release them, by name: the tracker's release verb                        |
| 5  | the gate reports new errors, 7 or fewer                                              | fix these, by name, each with the gate's own `fix` line                  |
| 6  | the gate reports more than 7 errors, or there are more than 30 ready leaves          | `/groom-backlog`                                                         |
| 7  | every outcome of the current milestone is done, and there is at least one            | `/to-milestone`                                                          |
| 8  | no ready leaf, and an outcome has no stages or its next open stage has no tasks      | `/to-stages` for that outcome, by name                                   |
| 9  | no ready leaf, and every open leaf is held by somebody else or blocked               | say so; an empty queue is an answer, never widen the query               |
| 10 | otherwise                                                                            | take the first ready leaf, by name: the tracker's claim verb             |

Say the count beside the limit whenever rung 5 or 6 decides ("9 errors, limit
7"). A finding beyond the budget needs no rung of its own: the gate reports it as a
new error, and its `fix` line is the decision to take to the owner.

Two answers come from what the person just said rather than from the state,
and they win over rungs 7 to 10: something **arrived** (an idea, a bug, a
request) means `/to-backlog`; something was **finished** means `/close-out`.

## 3. Say it like this

Up to three lines of state, each a fact with its number, then the answer:

```
> the milestone "Replace the old session manager" was declared 12 days ago; its finding budget is spent (7 of 5)
> you hold 3 issues whose trees have not moved in over two days
> the gate reports 2 new errors
>
> first:  release "Tabs remember their order" (PRJ-212) and two more
> then:   /groom-backlog, to decide what leaves the slice
```

Issues are always "Title" (id). Never answer with a list of skills.

## The routes, for when the person asks what exists

- `/setup-shady2k-skills` installs the gate and writes `docs/agents/backlog.md`. Once per project.
- `/to-milestone` charters a milestone: outcomes in, what is out, the finding budget.
- `/to-stages` breaks one outcome of the current milestone into stages and tasks.
- `/to-backlog` files what arrives into its lane: work, a finding, an idea. The agent reaches for it unprompted.
- `/close-out` closes finished work with evidence and releases what was not finished. The agent reaches for it unprompted.
- `/groom-backlog` digs out a backlog that has stopped being a queue.
