# How this project lands

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
The practice this project's work reaches the main line by, in that practice's
own words. A rule that depends on how a change lands cites the protocol's
[**How this project lands is recorded, and no skill assumes one way**](running.md)
and leaves the particulars here; no rule restates them, and none is the set's
own choice for every project.

How this project's work reaches the main line is below, in the words of the
practice itself, answering six questions in this order: **how work goes**,
**who merges**, **what you see and when**, **what it costs**, **what it
suits**, and **how hard it is to leave**. Another practice the set offers
later takes a section of the same six questions beside it; a project lands by
the one written here.

## One pull request per feature, and the owner merges it

**How work goes.** A branch per feature, named after the feature, alive as
long as the feature and no longer than this project lets a branch live; its
stages ride in that branch, and the feature reaches the main line once, as one
pull request, when it is whole. A feature whose run would keep its branch open
longer than that is split into features that each land separately, which is
what makes a run's size a matter of the branch bound.

**Who merges.** The owner. The run opens the pull request and stops there: it
merges nothing into the main line itself, and nobody else merges the feature
either. Their merge is the acceptance — the tracker is closed after it, a leaf
with no stage closes at that merge, and the run's report ends at it. Once the
merge is there, the agent closes the work and removes the checkouts and
branches it created.

**What you see and when.** Nothing until the merge, then the feature whole. A
demo shows the open pull request, or the merge's revision once it is there:
what is built and what is not, in one change.

**What it costs.** The owner's attention once per feature, at the merge, and
nothing of it visible meanwhile. A branch that lives as long as a feature
drifts from the main line while it waits, and the longer it lives the dearer
its merge is; the pull request's checks run again after every push to it.

**What it suits.** A person who reads each change before it lands; versioned or
infrequent releases; a first project, with nothing yet worth landing often.

**How hard it is to leave.** The cheapest of the practices: nothing but the
finished features' commit groups on the main line, and nothing a run wrote
under it is made false by another practice taking its place.
