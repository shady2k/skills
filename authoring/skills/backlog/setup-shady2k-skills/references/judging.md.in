# Judging in batches

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
When the agent may hand a batch of judgements to Jev, a fast decision model
that answers questions from answers it is given, and how its answers are used.

**A project's text goes to Jev only with that project's consent.** Setup asks
each project whether it may be used, and records the answer in the gate
config; a key on the machine permits nothing by itself. Where the key is, is
the machine's, kept outside the project, since a committed place to read it
from could be edited to run anything on whoever reads it.

**Jev is a tool the agent sees, not a rule it must recall.** Where the set is
installed, the agent's tool list carries `jev`, a tool the set ships: it is
handed the questions and what to read (a file of search or run output cut by
line, by blank line or by a pattern, or taken whole; several files; or a short
list), and returns what Jev settled and what is left to read. A harness that
defers tools lists it by name only, with its server's note on when to use it;
that is the tool, and the agent loads it by the harness's own way of loading
a deferred tool. Where a harness lists no such tool, not even by name,
[`jev.mjs`](../jev.mjs) by its path (in Claude Code also the `jev` command the
set puts on the path) does the same from a shell; before its first use in a session, its `status`
says whether Jev is available here, with one call that carries no project
text. All three find the project's config themselves and are one module, so
text reaches Jev only through it, never through a request of the agent's own,
because that is where it is masked. Where Jev is unavailable, the tool or
`status` says so once, and the agent reads the material itself, as it always
did, and says nothing about it: an unavailable helper is not news.

**The agent decides where Jev helps, from what it is good at.** A step need
not name it; any step may use it when the work has this shape, and the agent
looks for that shape itself whenever it is about to read a pile or a long
text. Jev reads one item at a time and answers questions of three kinds about
it, each from answers given in advance: yes or no, one of the answers, or a
place on an ordered scale; several questions in one request cost little more
than one, since it reads the item once. It says how sure it is of each
answer. It does not remember one item while reading the next, compare them,
compute or write. What it saves is the agent's
reading: an item it settles is one the agent never opens, in seconds and for a
fraction of a cent. So it pays in proportion to the reading it takes off the
agent, and most where all four of these hold:

- **The same questions of every item, with their answers known before
  looking.** They are framed once, whatever the number of items; "is this a
  real call of X: a call / a mention in a comment or a string / a different
  X" is such a question, and so is "how serious is this failure: harmless /
  annoying / blocks a release"; "what is wrong here" is not.
- **Each item takes reading for meaning, not matching.** Where a rule already
  decides (a pattern, a parser, a status field), the rule is cheaper and
  better: Jev reads literally and loses to it.
- **The items are many, or long.** About ten or more, or one text too long to
  read without spending much of the context: cut into items along its own
  seams (a log by test or by step, a transcript by session, a diff by file),
  or asked whole when the questions are about it as a whole (did this run
  fail, at which stage, is it the known flaky one).
- **A wrong answer costs only a second look.** Only its sure answers are
  used and the rest come back to the agent, so Jev decides the order and the
  amount of the agent's reading, never an outcome.

The test before reading a pile or a long text: could what the agent wants
from it be put as a few questions with short lists of answers, and would it
otherwise open every item, or read the whole text, to answer them?
Then it goes to Jev first, and the agent reads what comes back unsettled.
The pile goes by name, not by content: a search or a run writes its output to
a file and the file is what Jev is given, since a pile the agent reads in
order to hand it over is a pile already read.
Examples of that shape:

- **Sorting search hits or files:** which of these hits are real call sites,
  which files a change touches, which of the configs set this option.
- **Grouping failures and findings:** which failed tests or checks share one
  cause among the causes already suspected, which of a review's findings
  repeat one already handled, which are about code this change did not touch.
- **Matching against what is already recorded:** which open items duplicate a
  new one, which of the owner's past sessions answered this question already,
  which item each session or commit worked on.
- **Long material to attribute or filter:** a long test, build or bench log,
  transcripts, long diffs, many item bodies. Measured on this set's own
  history: which of 81 items each of 26 sessions worked on, 25 right, the
  right one among its first three every time, at 0.6 seconds and a cent for
  all of them, where reading them would have taken more context than an agent
  has.

And it is the wrong tool for:

- **One judgement in the flow of work** about what the agent has already
  read or can read at a glance. Framing the question costs more than
  answering it, and the agent already holds the context; Jev is also weaker
  than the agent on any single hard call. A long text the agent has not read
  is not this case.
- **A question about several items together**, such as which two conflict or
  what order they go in: Jev sees one at a time. Put it per item or read it.
- **Short, literal items that a rule already decides.** Over 312 short spans
  Jev alone was worse than the regex already there: it reads literally, so a
  command that contains a file name looked like a path to it.
- **Counting, arithmetic, dates, and open-ended answers.** It picks; it does
  not compute or write.

**Its answer is taken only where it is sure.** `jev.mjs` marks an answer
settled at the project's threshold or above: the probability of the answer
picked, of the yes or the no, or of the one level of a scale. How sure is
sure enough is the owner's trade-off, not the set's: a higher threshold lets
fewer wrong answers through and takes less reading off the agent. It is set
per project together with the Jev it was measured on, since a new version of
Jev makes an old measure stale; where the project set none, it is 0.9 on
jev-1.13, this set's own measure: its ends were right (below 0.05: 125 of
125; above 0.95: 50 of 51) and its middle wrong (0.5 to 0.8: 0 of 7). A new
Jev is never taken up silently; the owner changes both, best after a replay.
A settled answer is used as it is; every other item goes back to the agent,
who reads it and decides. Every choice has a way out, "none", which the module
adds, because without one Jev picks something, confidently. The answers' names
are written as plain descriptions of what each means: renaming them changed a
third of its answers in outside tests.

**Nothing hard to reverse rests on Jev's word alone.** Closing, deleting,
refusing, merging or telling the owner something is decided by the agent on
what it read, whatever Jev said; Jev narrows what the agent reads first.

**What leaves the machine is masked, and cannot be sent unmasked.** `jev.mjs`
removes secrets, turns hosts, addresses, commit hashes, item ids, the
project's own names and the people the repository knows (its commit authors
and this machine's user) into placeholders that read the same within one
request and differently in the next, and keeps code, file names, paths and
titles, which carry the signal. A file that is a credential as a whole is not
sent, and a request in which anything secret-shaped survives is not sent
either. Masking is by shape: a name nobody recorded, or a secret with no
recognisable form, still leaves. Where the agent knows an item holds
something the owner would not send out, it does not send that item.

**How well Jev does here is measured when the user asks, and only then.**
`jev.mjs replay` asks the same question of cases whose answer the project
already knows, and says how many it got right, settled and unsettled apart,
and what each of a few thresholds would settle and how much of that is right:
the numbers the owner chooses a threshold on, and rechecks it on when Jev
changes.
The cases come from the project's own history, where the answer is recorded
and not guessed: the item a commit names, a duplicate closed as one, an
attribution the owner corrected. Each kind of judgement is measured on its
own and never pooled with another. Individual answers are not kept; the
replay is the measure. Say what the numbers mean for the owner's work, and
that they hold only as far as that history resembles the work now.
