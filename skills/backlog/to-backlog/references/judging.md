# Judging in batches

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
When the agent may hand a batch of judgements to Jev, a fast decision model
that picks among answers it is given, and how its answers are used.

**A project's text goes to Jev only with that project's consent.** Setup asks
each project whether it may be used, and records the answer in the gate
config; a key on the machine permits nothing by itself. Where the key is, is
the machine's, kept outside the project, since a committed place to read it
from could be edited to run anything on whoever reads it.
Before the first use in a session, [`jev.mjs`](../jev.mjs) `status` says whether
it is available here, with one call that carries no project text. Where it is not, the agent reads the material itself, as
it always did, and says nothing about it: an unavailable helper is not news.
Text reaches Jev only through `jev.mjs`, never through a request of the
agent's own, because that is where it is masked.

**The agent decides where Jev helps, from what it is good at.** A step need
not name it; any step may use it when the work has this shape:

- **Many judgements of one kind**, each a pick from answers known in advance:
  which of these search hits are real call sites, which failed tests share one
  cause, which open items duplicate a new one, which files a change touches,
  which of the owner's past sessions answered this question already.
- **Long material to sort or attribute**, which it would cost the agent much
  of its context to read: logs, transcripts, long diffs, many item bodies.
  Measured on this set's own history: which of 81 items each of 26 sessions
  worked on, 25 right, the right one among its first three every time, at 0.6
  seconds and a cent for all of them, where reading them would have taken more
  context than an agent has.

And it is the wrong tool for:

- **One judgement in the flow of work.** Framing the question costs more than
  answering it, and the agent already holds the context; Jev is also weaker
  than the agent on any single hard call.
- **Short, literal items that a rule already decides.** Over 312 short spans
  Jev alone was worse than the regex already there: it reads literally, so a
  command that contains a file name looked like a path to it.
- **Counting, arithmetic, dates, and open-ended answers.** It picks; it does
  not compute or write.

**Its answer is taken only where it is sure.** `jev.mjs` marks an answer
settled only at the ends of its confidence, where it was measured right (below
0.05: 125 of 125; above 0.95: 50 of 51); in the middle it was right 0 times of
7. A settled answer is used as it is; every other item goes back to the agent,
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
already knows, and says how many it got right, settled and unsettled apart.
The cases come from the project's own history, where the answer is recorded
and not guessed: the item a commit names, a duplicate closed as one, an
attribution the owner corrected. Each kind of judgement is measured on its
own and never pooled with another. Individual answers are not kept; the
replay is the measure. Say what the numbers mean for the owner's work, and
that they hold only as far as that history resembles the work now.
