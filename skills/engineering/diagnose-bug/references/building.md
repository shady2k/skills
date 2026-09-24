# Building the product

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
How the product's code is shaped: one way into each capability, parts that can
be replaced, screens assembled from shared parts, and tests that survive a
refactoring. How failures are seen and checks are run is
[checks.md](checks.md).

**The project's form is decided once.** The set knows no stack, so these rules
say the principle and the project gives it its form: its component kit, its
token file, its frame, its logging library, its test factories. Each is a
recorded project decision, taken once and followed by every change. Where the
work needs a form the project has not recorded (the first screen needs a kit
and tokens), the spec proposes it to the owner as a project-wide decision
before the work invents one for itself; a form the work does not need yet
stays a finding. Where a machine can check a rule (no literal colour or size
in a component, no bare element in a page, no import against the direction of
dependencies), the project makes it a lint rule in the same change, so it
binds instead of being remembered.

## Code

**Find before writing.** Before a new component, helper, utility, command or
module, search the project for one that already does it or nearly does, and
extend that. A parallel copy of what exists is the commonest way an agent
degrades a codebase: each copy is correct on the day it is written, and they
drift from then on.

**One surface per capability.** A capability has one way in: one screen, one
endpoint, one command, one settings file, one script. A change extends that
way in; it never adds a second beside it — a "v2" page, a parallel endpoint, a
copy of a screen for one case, a new script that does what a command already
does, a second place for the same setting, a wrapper that exposes the same
thing under another name. Two ways in double what must be kept correct, and
they part until nobody knows which one is real. Where the existing surface
truly cannot carry the change, replacing it is a decision for the owner, and
the old one is removed in the same feature, never kept "for compatibility"
without that decision. A throwaway harness for a diagnosis or a prototype is
not a surface; it is deleted when its question is answered.

**One way to do one thing.** Follow the pattern the project already uses. A new
one comes only as a recorded decision, and moving the old code onto it is its
own task, filed; two ways side by side are not left behind a change.

**Extract on the third repeat.** Two similar places are tolerable; on the third
the shared part is extracted. An abstraction written for one case guesses the
second one, and usually wrong.

**Dependencies point inward.** The product's logic knows nothing of its screen,
its database, its framework or the services it calls; they know it. Each
outside dependency (storage, queues, external APIs, the clock, randomness)
sits behind an interface the logic owns, so it can be replaced or faked
without touching the logic. An extension point is built where a second case
exists or is planned, not in advance.

**Narrow interfaces, deep modules.** A module hides a lot behind a little: few
entry points, much behaviour behind them. An interface per class is a cost
with no return.

**One source for each fact.** A constant, a setting, a type, a user-facing text
lives in one place and is referenced from there, never repeated as a literal
across the code. Settings and secrets live outside the code.

**A missing input is an error.** An empty, missing or unreadable input — a
file, a setting, a list of patterns, a response — stops the work with an error
that names it and says how to supply it; it never yields a smaller result or a
pass. A guard that cannot find what it checks against refuses. Code that fails
open passes every test that hands it its input, and is found only by the day
the input is not there. Where several independent things are wrong, all of
them are reported in one run, not only the first.

**Same input, same output.** What a person or a check compares does not depend
on the locale, the order a directory or map is read in, the clock or the
machine: it is sorted by a stated key and built from its inputs alone.

## Interface

**A screen is assembled from components.** A page holds the project's
components or its chosen library's, not bare elements styled on the spot. A
component the page needs and the kit lacks is added to the kit, not written
into the page.

**Styles go through tokens.** Colours, spacing, type, radii and shadows are
variables. A component holds no literal colour or size, so a theme, a dark mode
or a rebrand is a change of values, not of components.

**Shared frames, not inherited pages.** What pages share (the header, the
navigation, the margins) is a frame that wraps them, and a page supplies its
content to it. Pages are composed, never inherited: a change to a base page
breaks its children in ways nobody predicts.

**A component shows; logic lives elsewhere.** Data, state and the calls that
fetch them live in services or stores; a component displays what it is given.
Then each can be checked and replaced alone.

**Every screen has its states.** Loading, empty and error are part of the
component from the start, not what is added after the happy path.

## Tests

**Tests check behaviour through the interface.** A test calls what a user of
the module calls and asserts on what they see, never on which internal method
ran or in what order. Then a refactoring changes no test, and a test that had
to change says the behaviour changed; a behaviour change must change tests,
which is their job.

**A test fails when its behaviour breaks.** A test that still passes with the
behaviour it names broken guards nothing. Its expected value comes from the
requirement or an independent example, and it is checked by breaking what it
guards: a mutation run on the changed code where the project has one, by hand
on the line it is about where it has not.

**Doubles only at the boundaries.** Mocks and fakes stand in for the outside
dependencies of **Dependencies point inward**, never for the product's own
parts, which run for real. A mock of an inner part copies the implementation
into the test, and is why a refactoring breaks tests. Prefer a fake that
behaves to a mock that counts calls.

**Test data comes from factories.** One factory per kind of object builds a
valid one with sensible defaults, and a test sets only the fields it is about;
repeated setup and repeated assertions are helpers. A new required field is
then one change to a factory, not to every test that builds the object.

**A failing test shows its logs.** Tests capture the product's log at its most
detailed level and print it only for a test that failed, with the ids that join
its chain of calls; a passing test prints nothing, so a failure is not buried.
What a failure must say is [**Failures explain themselves**](checks.md); the
order checks run in is [**Cheapest check first**](checks.md).
