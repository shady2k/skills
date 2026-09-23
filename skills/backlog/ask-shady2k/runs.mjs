#!/usr/bin/env node
// The run journal: one record per feature run, kept outside the repository, so
// that what a run was forecast to cost and what it cost are both on record.
// The minutes themselves come from the ledger, which reads what the harness
// measured; this file keeps only what no machine can know by itself — the
// forecast, the stops, the sessions and working copies that were the run's,
// and the owner's verdict.
// take-task owns this file; close-out and ask-shady2k carry copies of it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Usage, collect, localStamp, measure, minus, parseWhen, projectName, recordedShapes, span, threads, union } from './ledger.mjs';

const STOP_REASONS = ['owner', 'missing'];
const KINDS = ['stop', 'decision', 'ci'];
const RESULTS = ['pull-request', 'abandoned', 'stopped'];
const ACCEPTED = ['as-is', 'after-changes', 'abandoned'];
const GRADES = ['R0', 'R1', 'R2', 'R3'];

const stateDir = () =>
  process.env.SHADY2K_STATE_DIR ||
  join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'shady2k-skills');

const runsDir = (project) => join(stateDir(), 'runs', project);
const now = () => new Date().toISOString();
const minutes = (a, b) => (Date.parse(b) - Date.parse(a)) / 60e3;
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'run';
const under = (path, root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

function load(project, ref) {
  const path = ref.endsWith('.json') && existsSync(ref) ? ref : join(runsDir(project), `${ref}.json`);
  if (!existsSync(path)) throw new Usage(`no run record ${ref}`);
  const run = JSON.parse(readFileSync(path, 'utf8'));
  // A record given by its path is still this project's, or its sessions would
  // be looked for in another repository under this one's name.
  if (run.project !== project) throw new Usage(`${ref} is a run of ${run.project}, not of ${project}`);
  return { path, run };
}

const save = (path, run) => writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`);

function all(project) {
  const dir = runsDir(project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function count(opts, key) {
  if (opts[key] === undefined) return 0;
  const n = Number(opts[key]);
  if (!Number.isInteger(n) || n < 0) throw new Usage(`--${key} needs a whole number`);
  return n;
}

function oneOf(opts, key, allowed) {
  if (!allowed.includes(opts[key])) throw new Usage(`--${key} is one of ${allowed.join(', ')}`);
  return opts[key];
}

function positive(opts, key) {
  const n = Number(opts[key]);
  if (opts[key] === undefined || !Number.isFinite(n) || n < 0) throw new Usage(`--${key} needs minutes`);
  return n;
}

// The session running this command, where the harness says which it is.
const HERE = [['claude-code', 'CLAUDE_CODE_SESSION_ID'], ['codex', 'CODEX_THREAD_ID'], ['codex', 'CODEX_SESSION_ID']];

function session(opts) {
  if (!opts.harness !== !opts.session) throw new Usage('--harness and --session go together');
  if (opts.session) return [{ harness: opts.harness, id: opts.session, at: now() }];
  const [harness, key] = HERE.find(([, k]) => process.env[k]) || [];
  return harness ? [{ harness, id: process.env[key], at: now() }] : [];
}

// ---- what the run actually spent -------------------------------------------

// Reading every session of a project is not cheap, and a report asks for the
// same ones once per run. Only sessions from a day before the earliest run
// on record can be any run's.
const scanned = new Map();
let repoGiven;
const sessionsOfProject = (project) => {
  if (!scanned.has(project)) {
    const starts = all(project).map((r) => Date.parse(r.startedAt)).filter(Number.isFinite);
    const since = starts.length ? Math.min(...starts) - 864e5 : undefined;
    scanned.set(project, collect(project, { repo: repoGiven, since }));
  }
  return scanned.get(project);
};

const windowOf = (run) => ({ start: Date.parse(run.startedAt), end: Date.parse(run.finishedAt || now()) });

// A session is a run's when the run recorded it, when it ran in a working
// copy the run recorded, or when a session that is the run's started it.
function boundTo(run, raw, byId, depth = 0) {
  if ((run.sessions || []).some((s) => s.id === raw.id)) return true;
  if (raw.cwd && (run.copies || []).some((c) => under(resolve(raw.cwd), resolve(c)))) return true;
  const parent = raw.parent && byId.get(raw.parent);
  return !!parent && depth < 5 && boundTo(run, parent, byId, depth + 1);
}
const rootOf = (raw, byId) => { let r = raw; for (let i = 0; i < 5 && r.parent && byId.get(r.parent); i++) r = byId.get(r.parent); return r; };

/**
 * What of each session a run is charged, inside the run's own window only,
 * decided the same way for every run so that no minute is charged twice. The
 * runs that may claim a session are those that recorded it (the session, a
 * working copy it ran in, or the session that started it); where none did
 * and it ran in a working copy of its own, every run, since such a copy
 * exists only because some run made it. A conversation in the checkout that
 * no run recorded is somebody else's and is left alone. A run is charged the
 * stretch of a session when it alone of those runs was open; a stretch two of
 * them were open for is contested, charged to none and reported.
 */
function charges(run) {
  const raws = sessionsOfProject(run.project);
  const byId = new Map(raws.map((r) => [r.id, r]));
  const runs = all(run.project);
  const win = windowOf(run);
  const out = { charged: [], shared: [], contested: [] };
  for (const raw of raws) {
    if (raw.last < win.start || raw.first > win.end) continue;
    const binding = runs.filter((r) => boundTo(r, raw, byId));
    let claimants;
    if (binding.length) {
      if (!binding.some((r) => r.id === run.id)) continue;
      claimants = binding;
    } else if (rootOf(raw, byId).role === 'side copy') claimants = runs;
    else continue;
    const others = union(claimants.filter((r) => r.id !== run.id).map(windowOf)
      .filter((w) => w.end > win.start && w.start < win.end));
    const own = minus([win], others);
    const both = minus([win], own);
    const mine = own.length ? measure(raw, { windows: own }) : null;
    if (mine && mine.wallMinutes > 0) out.charged.push(mine);
    const theirs = both.length ? measure(raw, { windows: both }) : null;
    if (theirs && theirs.wallMinutes > 0) {
      out.shared.push(theirs);
      for (const w of both) {
        const start = Math.max(w.start, raw.first);
        const end = Math.min(w.end, raw.last);
        if (end > start) out.contested.push({ id: raw.id, start, end });
      }
    }
  }
  return out;
}

// Two runs open at once each see the stretch they share; counted over runs,
// it is counted once.
const contestedMinutes = (stretches) => {
  const byId = new Map();
  for (const x of stretches) byId.set(x.id, [...(byId.get(x.id) || []), x]);
  return [...byId.values()].reduce((n, list) => n + span(union(list)), 0) / 60e3;
};

// A run's minutes, split by who spent them. Everything but the owner's own
// minutes is what the harness measured or its stamps show; his are an
// estimate, and his absence is in no forecast and belongs to no one.
function spend(run) {
  const { charged: sessions, shared, contested } = charges(run);
  const sum = (f) => sessions.reduce((n, s) => n + f(s), 0);
  const seen = new Set(sessions.map((s) => s.id));
  const model = sum((s) => s.modelMinutes);
  const tools = sum((s) => s.toolMinutes);
  const kinds = {};
  for (const s of sessions) for (const [k, m] of Object.entries(s.kinds)) kinds[k] = (kinds[k] || 0) + m;
  const figure = (f) => {
    let total = 0;
    let missing = 0;
    for (const s of sessions) { const v = f(s); if (v === null || v === undefined) { if (s.costIn !== 'parent') missing++; } else total += v; }
    return { total, missing };
  };
  const cost = figure((s) => s.costUSD);
  const added = figure((s) => s.linesAdded);
  const removed = figure((s) => s.linesRemoved);
  return {
    found: new Set(sessions.map((s) => s.id)).size,
    missing: (run.sessions || []).filter((s) => !seen.has(s.id)).length,
    sideCopies: sessions.filter((s) => s.role === 'side copy').length,
    subagents: sessions.filter((s) => s.role === 'subagent').length,
    ownerMessages: sum((s) => s.ownerMessages),
    model, tools,
    agentMinutes: model + tools,
    answering: sum((s) => s.answerMinutes),
    coordination: sum((s) => s.coordinationMinutes),
    awayMinutes: sum((s) => s.awayMinutes),
    // What a forecast is a forecast of: the stretches of the run's clock when
    // an agent was working or waiting inside its turn, or the owner was
    // answering. Laid over each other, so parallel workers count once.
    occupiedMinutes: span(union(sessions.flatMap((s) => s.occupied))) / 60e3,
    // Working copies open while this run and another were both running,
    // charged to neither.
    unattributedMinutes: shared.reduce((n, s) => n + s.wallMinutes, 0),
    unattributedSessions: shared.length,
    contested,
    kinds: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, round(m)])),
    threads: threads(sessions),
    costUSD: Math.round(cost.total * 100) / 100, costUnknown: cost.missing,
    linesAdded: added.total, linesRemoved: removed.total, linesUnknown: Math.max(added.missing, removed.missing),
    output: sessions.reduce((n, s) => n + (s.tokens?.output || 0), 0),
  };
}

// ---- figures ---------------------------------------------------------------

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const round = (n) => Math.round(n);

// A forecast is of the run's occupied minutes: the agents' work, the waits
// inside their turns (checks, reviews, workers) and the owner's answers. The
// owner's absence is not in it; the clock that holds it is reported beside.
function pace(project, opts) {
  const done = all(project).filter((r) => r.finishedAt && r.result === 'pull-request' && r.estimate);
  const tasks = opts.tasks === undefined ? null : count(opts, 'tasks');
  const out = { runs: done.length };
  if (done.length < 3) return { ...out, enough: false };
  const occupied = done.map((r) => spend(r).occupiedMinutes);
  const elapsed = done.map((r) => minutes(r.startedAt, r.finishedAt));
  const ratio = done.map((r, i) => occupied[i] / Math.max(1, r.estimate.workMinutes + r.estimate.waitMinutes));
  out.enough = true;
  out.estimateRatio = +quantile(ratio, 0.5).toFixed(2);
  out.elapsedLow = round(quantile(elapsed, 0.25));
  out.elapsedHigh = round(quantile(elapsed, 0.75));
  const perTask = done.map((r, i) => (r.estimate.tasks > 0 ? occupied[i] / r.estimate.tasks : null)).filter((x) => x !== null);
  if (tasks && perTask.length >= 3) {
    out.basis = `${perTask.length} runs, per task`;
    out.low = round(quantile(perTask, 0.25) * tasks);
    out.high = round(quantile(perTask, 0.75) * tasks);
  } else {
    out.basis = `${done.length} runs, whole runs`;
    out.low = round(quantile(occupied, 0.25));
    out.high = round(quantile(occupied, 0.75));
  }
  return out;
}

function report(project, opts) {
  const runs = all(project);
  const judged = runs.filter((r) => r.verdict);
  const accepted = judged.filter((r) => r.verdict.accepted !== 'abandoned');
  const autonomous = accepted.filter((r) => !r.verdict.corrections && !r.verdict.rescues);
  const sum = (rs, f) => rs.reduce((n, r) => n + f(r), 0);
  const stops = runs.flatMap((r) => (r.events || []).filter((e) => e.kind === 'stop'));
  const out = {
    runs: runs.length,
    finished: runs.filter((r) => r.finishedAt).length,
    judged: judged.length,
    // A run the owner never judged leaves acceptance unmeasured: nothing but
    // him can say whether the result was taken, so the gap is reported rather
    // than filled in.
    unjudged: runs.filter((r) => r.finishedAt && !r.verdict).length,
    acceptedAsIs: judged.filter((r) => r.verdict.accepted === 'as-is').length,
    acceptedAfterChanges: judged.filter((r) => r.verdict.accepted === 'after-changes').length,
    abandoned: judged.filter((r) => r.verdict.accepted === 'abandoned').length,
    autonomous: autonomous.length,
    stops: { owner: stops.filter((e) => e.reason === 'owner').length, missing: stops.filter((e) => e.reason === 'missing').length },
    avoidableQuestions: sum(judged, (r) => r.verdict.avoidableQuestions),
    missedEscalations: sum(judged, (r) => r.verdict.missedEscalations),
    corrections: sum(judged, (r) => r.verdict.corrections),
    rescues: sum(judged, (r) => r.verdict.rescues),
    recoveries: Object.fromEntries(GRADES.map((g) => [g, sum(runs, (r) => (r.recoveries || []).filter((x) => x.grade === g).length)])),
    pace: pace(project, {}),
    open: runs.filter((r) => !r.finishedAt).length,
    pastForecast: stalled(project).filter((r) => r.pastForecast).length,
  };
  if (!opts['no-transcripts']) {
    const measured = runs.filter((r) => r.finishedAt).map(spend);
    const spent = measured.filter((s) => s.found);
    const attention = sum(spent, (s) => s.answering);
    const delivered = judged.filter((r) => r.verdict.accepted !== 'abandoned').length;
    out.spend = {
      runsMeasured: spent.length,
      attentionMinutes: round(attention),
      acceptedPerAttentionHour: delivered && attention ? +(delivered / (attention / 60)).toFixed(2) : null,
      medianOccupiedMinutes: spent.length ? round(quantile(spent.map((s) => s.occupiedMinutes), 0.5)) : null,
      medianAgentMinutes: spent.length ? round(quantile(spent.map((s) => s.agentMinutes), 0.5)) : null,
      medianSessions: spent.length ? round(quantile(spent.map((s) => s.found), 0.5)) : null,
      peakThreads: spent.reduce((n, s) => Math.max(n, s.threads.peak), 0),
      costUSD: Math.round(sum(spent, (s) => s.costUSD) * 100) / 100,
      costUnknown: sum(spent, (s) => s.costUnknown),
      linesAdded: sum(spent, (s) => s.linesAdded),
      unattributedMinutes: round(contestedMinutes(measured.flatMap((s) => s.contested))),
      sessionsNotFound: sum(spent, (s) => s.missing),
    };
  }
  return out;
}

// How a run's time is said, the same everywhere: what it occupied against the
// forecast, and the clock beside it.
const tookLine = (s) => `Estimated ${s.estimatedMinutes} min; it occupied ${s.occupiedMinutes} min ` +
  `(the agents working, waiting inside their turns, the owner answering) over ${s.elapsedMinutes} min of clock`;

// One run's measured numbers, for the comment that carries them off this
// machine: the journal is local state, a tracker comment is read from anywhere.
function summary(r) {
  const stops = (r.events || []).filter((e) => e.kind === 'stop');
  const s = spend(r);
  return {
    run: r.id, feature: r.feature, startedAt: r.startedAt, finishedAt: r.finishedAt || null,
    result: r.result || 'running',
    estimatedMinutes: r.estimate.workMinutes + r.estimate.waitMinutes,
    occupiedMinutes: round(s.occupiedMinutes),
    elapsedMinutes: round(minutes(r.startedAt, r.finishedAt || now())),
    tasks: r.estimate.tasks, stages: r.estimate.stages,
    stops: { owner: stops.filter((e) => e.reason === 'owner').length, missing: stops.filter((e) => e.reason === 'missing').length },
    ci: (r.events || []).filter((e) => e.kind === 'ci').length,
    accepted: r.verdict ? r.verdict.accepted : null,
    spend: {
      sessions: s.found, sideCopies: s.sideCopies, subagents: s.subagents, peakThreads: s.threads.peak,
      model: round(s.model), tools: round(s.tools), agentMinutes: round(s.agentMinutes), coordination: round(s.coordination),
      ownerMinutes: round(s.answering), ownerMessages: s.ownerMessages, awayMinutes: round(s.awayMinutes),
      unattributedMinutes: round(s.unattributedMinutes), unattributedSessions: s.unattributedSessions,
      kinds: s.kinds, costUSD: s.costUSD, costUnknown: s.costUnknown,
      linesAdded: s.linesAdded, linesRemoved: s.linesRemoved, linesUnknown: s.linesUnknown,
    },
  };
}

function describeSummary(s) {
  const p = s.spend;
  const kinds = Object.entries(p.kinds).filter(([, m]) => m >= 1).map(([k, m]) => `${k} ${m}`).join(', ');
  const lines = [
    `Run ${s.run}, ${s.result}${s.accepted ? `, accepted ${s.accepted}` : ''}, ${localStamp(Date.parse(s.finishedAt || s.startedAt), { time: false })}`,
    `${tookLine(s)}; ${s.tasks} task(s) in ${s.stages} stage(s)`,
    `The agents' own minutes: the model ${p.model}, tools ${p.tools}, summed over sessions; waiting inside their turns ${p.coordination}; ` +
      `the owner ${p.ownerMinutes} over ${p.ownerMessages} message(s), away ${p.awayMinutes}`,
    p.sessions
      ? `${p.sessions} session(s), ${p.sideCopies} in working copies of their own and ${p.subagents} subagent(s), ${p.peakThreads} working at once at the peak`
      : 'No session of this run was found on this machine: its minutes are not measured',
    `On: ${kinds || 'nothing measured'}`,
    `Stops: for the owner ${s.stops.owner}, missing information ${s.stops.missing}; CI runs ${s.ci}`,
    `Cost $${p.costUSD}${p.costUnknown ? ` (${p.costUnknown} session(s) with no cost of their own in the run, not in it)` : ''}, ` +
      `${p.linesAdded} line(s) written and ${p.linesRemoved} removed${p.linesUnknown ? ` (${p.linesUnknown} session(s) without a count)` : ''}`,
  ];
  if (p.unattributedMinutes) lines.push(`${p.unattributedMinutes} min in ${p.unattributedSessions} working cop(ies) overlap another run and are counted in neither`);
  return lines.join('\n');
}

// Runs that started and never came back: an unattended run cannot report its
// own death, so what it leaves is a record with no end, found by whoever looks.
// This one is by the clock on purpose: the promise was a time on the clock,
// the forecast plus the owner's announced absence, recorded at the start.
function stalled(project) {
  return all(project).filter((r) => !r.finishedAt).map((r) => {
    const events = r.events || [];
    const last = events.length ? events.at(-1).at : (r.sessions || []).map((x) => x.at).pop() || r.startedAt;
    const e = events.at(-1);
    const estimated = r.estimate.workMinutes + r.estimate.waitMinutes;
    // A record from before the promise was kept has only its forecast.
    const due = r.estimate.dueAt ? Date.parse(r.estimate.dueAt) : Date.parse(r.startedAt) + estimated * 60e3;
    return {
      run: r.id, feature: r.feature, startedAt: r.startedAt,
      estimatedMinutes: estimated, dueAt: new Date(due).toISOString(),
      runningMinutes: round(minutes(r.startedAt, now())),
      quietMinutes: round(minutes(last, now())),
      lastEvent: e ? `${e.kind}${e.reason ? ` (${e.reason})` : ''}` : null,
      pastForecast: Date.now() > due,
    };
  });
}

function describeStalled(rows) {
  if (!rows.length) return 'No run is open.';
  const late = rows.filter((r) => r.pastForecast);
  const line = (r) => `${r.run}: ${r.runningMinutes} min on the clock, promised by ${localStamp(Date.parse(r.dueAt))} ` +
    `(forecast ${r.estimatedMinutes} min occupied), ` +
    `quiet ${r.quietMinutes} min, last ${r.lastEvent || 'nothing recorded'} — ${r.feature}`;
  const out = late.length
    ? [`${late.length} run(s) past their forecast with no end recorded:`, ...late.map(line)]
    : ['No run is past its forecast.'];
  const running = rows.filter((r) => !r.pastForecast);
  if (running.length) out.push(`${running.length} run(s) still inside their forecast.`);
  return out.join('\n');
}

function describePace(p) {
  if (!p.enough) return `Too little history for a measured estimate: ${p.runs} finished run(s), 3 needed. Any estimate is a guess.`;
  return `Similar runs occupied ${p.low}-${p.high} minutes (${p.basis}), ` +
    `over ${p.elapsedLow}-${p.elapsedHigh} minutes of clock. ` +
    `Runs occupied ${p.estimateRatio} times their estimate (median): correct a new estimate by that.`;
}

// ---- commands ----------------------------------------------------------------

function run(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2);
    if (['json', 'no-transcripts'].includes(key)) { opts[key] = true; continue; }
    if (i + 1 >= rest.length) throw new Usage(`${a} needs a value`);
    opts[key] = rest[++i];
  }
  const project = () => projectName(opts.project, opts.repo);
  repoGiven = opts.repo;
  const ref = () => {
    if (positional.length !== 1) throw new Usage(`${command} needs one run: its id or path`);
    return load(project(), positional[0]);
  };
  const print = (value, text) => (opts.json ? `${JSON.stringify(value, null, 2)}` : text);

  switch (command) {
    case 'start': {
      if (!opts.feature) throw new Usage('start needs --feature "<title>"');
      const record = {
        version: 1, project: project(), feature: opts.feature, startedAt: now(),
        estimate: {
          workMinutes: positive(opts, 'work'), waitMinutes: positive(opts, 'wait'),
          awayMinutes: opts.away === undefined ? 0 : positive(opts, 'away'),
          tasks: count(opts, 'tasks'), stages: count(opts, 'stages'), basis: opts.basis || null,
        },
        sessions: session(opts), copies: [], events: [], recoveries: [],
      };
      // The time the result was promised for: the forecast of occupied
      // minutes, plus the absence the owner announced, from now; or the time
      // the preflight named.
      const e = record.estimate;
      const due = opts.due === undefined ? Date.parse(record.startedAt) + (e.workMinutes + e.waitMinutes + e.awayMinutes) * 60e3 : parseWhen(opts.due);
      if (!Number.isFinite(due)) throw new Usage('--due needs a time');
      e.dueAt = new Date(due).toISOString();
      for (const x of all(record.project).filter((y) => !y.finishedAt))
        if (record.sessions.length && (x.sessions || []).some((y) => y.id === record.sessions[0].id))
          throw new Usage(`session ${record.sessions[0].id} is already recorded by the open run ${x.id}`);
      const dir = runsDir(record.project);
      mkdirSync(dir, { recursive: true });
      const base = `${record.startedAt.slice(0, 10)}-${slug(opts.feature)}`;
      let id = base;
      for (let n = 2; existsSync(join(dir, `${id}.json`)); n++) id = `${base}-${n}`;
      record.id = id;
      save(join(dir, `${id}.json`), record);
      return print(record, `${id}\n${join(dir, `${id}.json`)}`);
    }
    case 'session': {
      const { path, run: r } = ref();
      r.copies ||= [];
      // A session or working copy belongs to one run: one that another run
      // whose window overlaps this one's already recorded is refused, not
      // charged twice; finishing that run first does not free it.
      // A run still open reaches forward without end, and windows that touch
      // overlap: two runs started in the same instant share it.
      const reach = (x) => ({ start: Date.parse(x.startedAt), end: x.finishedAt ? Date.parse(x.finishedAt) : Infinity });
      const mine = reach(r);
      const open = all(r.project).filter((x) => {
        if (x.id === r.id) return false;
        const w = reach(x);
        return w.start <= mine.end && mine.start <= w.end;
      });
      if (opts.copy) {
        const copy = resolve(opts.copy);
        const holder = open.find((x) => (x.copies || []).some((c) => under(copy, c) || under(c, copy)));
        if (holder) throw new Usage(`${copy} is already recorded by the overlapping run ${holder.id}`);
        if (!r.copies.includes(copy)) r.copies.push(copy);
        if (!opts.session) { save(path, r); return print(r, `${r.id}: ${r.copies.length} working cop(ies)`); }
      }
      const s = session(opts);
      if (!s.length) throw new Usage('this harness does not say which session this is: pass --harness and --session');
      const holder = open.find((x) => (x.sessions || []).some((y) => y.id === s[0].id));
      if (holder) throw new Usage(`session ${s[0].id} is already recorded by the overlapping run ${holder.id}`);
      if (!r.sessions.some((x) => x.id === s[0].id)) r.sessions.push(...s);
      save(path, r);
      return print(r, `${r.id}: ${r.sessions.length} session(s)`);
    }
    case 'event': {
      const { path, run: r } = ref();
      const e = { at: now(), kind: oneOf(opts, 'kind', KINDS), note: opts.note || null };
      if (e.kind === 'stop') e.reason = oneOf(opts, 'reason', STOP_REASONS);
      r.events.push(e);
      save(path, r);
      return print(r, `${r.id}: ${e.kind} recorded`);
    }
    case 'finish': {
      const { path, run: r } = ref();
      r.result = oneOf(opts, 'result', RESULTS);
      r.finishedAt = now();
      if (opts.pr) r.pr = opts.pr;
      save(path, r);
      const s = summary(r);
      return print(r, `${r.id}: ${r.result}. ${s.spend.sessions ? tookLine(s)
        : `Estimated ${s.estimatedMinutes} min; no session of this run was found on this machine, over ${s.elapsedMinutes} min of clock`}`);
    }
    case 'verdict': {
      const { path, run: r } = ref();
      r.verdict = {
        at: now(), accepted: oneOf(opts, 'accepted', ACCEPTED),
        avoidableQuestions: count(opts, 'avoidable'), missedEscalations: count(opts, 'missed'),
        corrections: count(opts, 'corrections'), rescues: count(opts, 'rescues'), note: opts.note || null,
      };
      save(path, r);
      return print(r, `${r.id}: verdict ${r.verdict.accepted}`);
    }
    case 'recovery': {
      const { path, run: r } = ref();
      const x = { at: now(), grade: oneOf(opts, 'grade', GRADES), from: opts.from || null, to: opts.to || null, note: opts.note || null };
      r.recoveries.push(x);
      save(path, r);
      return print(r, `${r.id}: recovery ${x.grade}`);
    }
    case 'list': {
      const runs = all(project());
      return print(runs, runs.map((r) =>
        `${r.id}  ${r.result || 'running'}${r.verdict ? `, ${r.verdict.accepted}` : ''}  ${r.feature}`).join('\n') || 'no runs');
    }
    case 'stalled': {
      const rows = stalled(project());
      return print(rows, describeStalled(rows));
    }
    case 'summary': {
      const { run: r } = ref();
      const out = summary(r);
      return print(out, describeSummary(out));
    }
    case 'pace': {
      const p = pace(project(), opts);
      return print(p, describePace(p));
    }
    case 'report': {
      const r = report(project(), opts);
      const lines = [
        `Runs ${r.runs}, finished ${r.finished}, judged by the owner ${r.judged}`,
        `Accepted as is ${r.acceptedAsIs}, after changes ${r.acceptedAfterChanges}, abandoned ${r.abandoned}` +
          (r.unjudged ? `; ${r.unjudged} finished run(s) the owner never judged, so acceptance is unmeasured` : ''),
        `Delivered without corrections or rescue ${r.autonomous} of ${r.judged - r.abandoned} accepted`,
        `Stops: for the owner ${r.stops.owner}, missing information ${r.stops.missing}`,
        `Avoidable questions ${r.avoidableQuestions}, missed escalations ${r.missedEscalations}, corrections ${r.corrections}, rescues ${r.rescues}`,
        `Recoveries ${GRADES.map((g) => `${g} ${r.recoveries[g]}`).join(', ')}`,
        `Open runs ${r.open}, of them past their forecast with no end recorded ${r.pastForecast}`,
        describePace(r.pace),
      ];
      if (r.spend) lines.push(r.spend.runsMeasured
        ? `Measured over ${r.spend.runsMeasured} finished run(s): the owner ${r.spend.attentionMinutes} min` +
          `${r.spend.acceptedPerAttentionHour ? `, ${r.spend.acceptedPerAttentionHour} feature(s) accepted per hour of it` : ''}; ` +
          `a run occupies ${r.spend.medianOccupiedMinutes} min (median), the agents' own minutes ${r.spend.medianAgentMinutes} of them summed, ` +
          `over ${r.spend.medianSessions} session(s), up to ${r.spend.peakThreads} working at once; ` +
          `$${r.spend.costUSD}${r.spend.costUnknown ? ` (${r.spend.costUnknown} session(s) without a cost)` : ''} and ${r.spend.linesAdded} line(s) written in all` +
          `${r.spend.unattributedMinutes ? `; ${r.spend.unattributedMinutes} min of working copies shared by concurrent runs, counted in none` : ''}`
        : 'No session of any finished run was found on this machine: its minutes are not measured');
      return print(r, lines.join('\n'));
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

const HELP = `runs.mjs start --feature <title> --work <min> --wait <min> [--away <min> | --due <time>] [--tasks N] [--stages N] [--basis <text>] [--harness <h> --session <id>]
--work and --wait forecast the minutes the run occupies; --away is the owner's announced absence, which the
promised time adds (--due names that time instead; a time without an offset is local).
runs.mjs session <run> [--harness <h> --session <id>] [--copy <path>]
start and session record the current session by themselves where the harness names it;
--copy records a working copy the run's workers use: every session in it while the run is open is the run's.
runs.mjs event <run> --kind stop|decision|ci [--reason owner|missing] [--note <text>]
runs.mjs finish <run> --result pull-request|abandoned|stopped [--pr <url>]
runs.mjs verdict <run> --accepted as-is|after-changes|abandoned [--avoidable N] [--missed N] [--corrections N] [--rescues N] [--note <text>]
runs.mjs recovery <run> --grade R0|R1|R2|R3 [--from <h>] [--to <h>] [--note <text>]
runs.mjs summary <run>   one run's measured numbers, for the tracker comment that carries them
runs.mjs stalled         runs that started and recorded no end, and which passed their forecast
runs.mjs list | pace [--tasks N] | report [--no-transcripts]
A run's minutes count only inside its own start and end. A working copy no run recorded is charged
to the one run open while it ran; where two runs were open, that stretch is counted in neither.
Every command takes [--project <name>] (default: the checkout's main folder name), [--repo <path>] (a checkout
of it, when not run from one) and [--json].
Records live in $SHADY2K_STATE_DIR, else $XDG_STATE_HOME/shady2k-skills, else ~/.local/state/shady2k-skills.
Exit 0 done, 2 misuse.`;

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'runs-selftest-'));
  const saved = { ...process.env };
  const savedCwd = process.cwd();
  process.env.SHADY2K_STATE_DIR = join(home, 'state');
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  for (const [, key] of HERE) delete process.env[key];
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const cli = (...a) => { scanned.clear(); return run([...a, '--project', 'demo']); };
  const misuse = (a) => { try { run(a); return false; } catch (e) { return e instanceof Usage; } };
  const sh = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  try {
    const demo = join(home, 'w', 'demo');
    mkdirSync(demo, { recursive: true });
    sh(['init', '-q', '-b', 'main'], demo);
    sh(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], demo);
    const copy = join(home, 'w', 'wt-7k9e');
    sh(['worktree', 'add', '-q', '-b', 'work', copy], demo);
    process.chdir(demo);
    const dirOf = (cwd) => join(home, 'claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
    const transcript = (name, rows, cwd = demo) => {
      mkdirSync(dirOf(cwd), { recursive: true });
      writeFileSync(join(dirOf(cwd), `${name}.jsonl`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    };
    const record = (id) => join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${id}.json`);
    const edit = (id, f) => { const r = JSON.parse(readFileSync(record(id), 'utf8')); f(r); save(record(id), r); };

    // Four finished runs, each estimated at 30 minutes. Each left one session
    // that says what it really spent, and each record stayed open three times
    // as long as the work took, because the owner came back the next day.
    const iso = (ms) => new Date(ms).toISOString();
    const day = (i) => Date.parse('2026-01-01T10:00:00Z') + i * 864e5;
    const worked = (startMs, min, cwd = demo) => [
      { type: 'user', timestamp: iso(startMs), cwd, origin: { kind: 'human' }, message: { content: 'run it' } },
      { type: 'assistant', timestamp: iso(startMs + min * 60e3), message: { id: `m${startMs}`, content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: iso(startMs + min * 60e3), durationMs: min * 60e3 },
      {
        type: 'cost-state', startTime: startMs, totalAPIDuration: min * 60e3, totalToolDuration: 0,
        totalDuration: min * 60e3, totalCostUSD: 2, totalLinesAdded: 10, totalLinesRemoved: 1, modelUsage: {},
      },
    ];

    const took = [60, 80, 100, 120];
    const ids = took.map((m, i) => {
      const id = cli('start', '--feature', `Feature ${i}`, '--work', '20', '--wait', '10', '--tasks', '2',
        '--harness', 'claude-code', '--session', `s${i}`).split('\n')[0];
      edit(id, (r) => { r.startedAt = iso(day(i)); r.finishedAt = iso(day(i) + m * 3 * 60e3); r.result = 'pull-request'; });
      transcript(`s${i}`, worked(day(i), m));
      return id;
    });
    expect('start names a run after its date and feature', /^\d{4}-\d{2}-\d{2}-feature-0$/.test(ids[0]));
    const again = cli('start', '--feature', 'Feature 0', '--work', '1', '--wait', '1').split('\n')[0];
    expect('a second run of the same feature on the same day gets its own record', again.endsWith('feature-0-2'));
    process.env.CLAUDE_CODE_SESSION_ID = 'here';
    cli('session', again);
    cli('session', again);
    const here = JSON.parse(cli('session', again, '--json')).sessions;
    delete process.env.CLAUDE_CODE_SESSION_ID;
    expect('the current session is found by itself and added once', here.length === 1 && here[0].id === 'here' && here[0].harness === 'claude-code');
    cli('event', ids[0], '--kind', 'stop', '--reason', 'owner', '--note', 'logout semantics');
    cli('event', ids[1], '--kind', 'stop', '--reason', 'missing');
    cli('verdict', ids[0], '--accepted', 'as-is', '--avoidable', '1');
    cli('verdict', ids[1], '--accepted', 'after-changes', '--corrections', '1', '--missed', '1');
    cli('verdict', ids[2], '--accepted', 'abandoned', '--rescues', '1');
    cli('recovery', ids[3], '--grade', 'R3', '--from', 'claude-code', '--to', 'codex');
    // A session the run recorded that this machine does not have.
    cli('session', ids[0], '--harness', 'claude-code', '--session', 'gone');
    // The record made before the fix to a run that 'again' left open would
    // overlap everything: close it far away.
    edit(again, (r) => { r.startedAt = iso(day(30)); r.finishedAt = iso(day(30) + 60e3); r.result = 'stopped'; });

    // A fifth run, stopped rather than delivered, where the owner answered
    // once in three minutes and once after an hour and a half away. A worker
    // was started in a working copy of its own while it ran.
    const fifth = cli('start', '--feature', 'The owner run', '--work', '30', '--wait', '0', '--tasks', '1',
      '--harness', 'claude-code', '--session', 's4').split('\n')[0];
    const fifthStart = day(9);
    const at = (min) => iso(fifthStart + min * 60e3);
    transcript('s4', [
      { type: 'user', timestamp: at(0), cwd: demo, origin: { kind: 'human' }, message: { content: 'start' } },
      { type: 'assistant', timestamp: at(10), message: { id: 'a1', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: at(14), message: { content: [{ type: 'tool_result', tool_use_id: 't' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(14), durationMs: 14 * 60e3 },
      { type: 'user', timestamp: at(17), origin: { kind: 'human' }, message: { content: 'go on' } },
      { type: 'assistant', timestamp: at(18), message: { id: 'a2', content: [{ type: 'text', text: 'ok' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(18), durationMs: 60e3 },
      { type: 'user', timestamp: at(108), origin: { kind: 'human' }, message: { content: 'back' } },
      { type: 'assistant', timestamp: at(109), message: { id: 'a3', content: [{ type: 'text', text: 'ok' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(109), durationMs: 60e3 },
      {
        type: 'cost-state', startTime: fifthStart, totalAPIDuration: 12 * 60e3, totalToolDuration: 4 * 60e3,
        totalDuration: 109 * 60e3, totalCostUSD: 5, totalLinesAdded: 3, totalLinesRemoved: 0, modelUsage: {},
      },
    ]);
    transcript('w1', worked(fifthStart + 60e3, 20, copy), copy);
    edit(fifth, (r) => { r.startedAt = iso(fifthStart); r.finishedAt = iso(fifthStart + 109 * 60e3); r.result = 'stopped'; });

    const p = JSON.parse(cli('pace', '--tasks', '2', '--json'));
    expect('pace measures from four delivered runs', p.enough && p.runs === 4);
    expect('pace reports how far the estimates were off (median 90/30 = 3x)', p.estimateRatio === 3);
    expect('pace gives a range for the size asked', p.low === 75 && p.high === 105);
    expect('the forecast is answered by the occupied minutes, the calendar beside it',
      p.elapsedLow === 225 && p.elapsedHigh === 315);

    const r = JSON.parse(cli('report', '--json'));
    expect('report counts verdicts', r.acceptedAsIs === 1 && r.acceptedAfterChanges === 1 && r.abandoned === 1);
    expect('only a run without corrections or rescue counts as delivered alone', r.autonomous === 1);
    expect('report separates stops for the owner from missing information', r.stops.owner === 1 && r.stops.missing === 1);
    expect('report counts what the owner judged', r.avoidableQuestions === 1 && r.missedEscalations === 1 && r.corrections === 1 && r.rescues === 1);
    expect('report counts recovery grades', r.recoveries.R3 === 1 && r.recoveries.R0 === 0);
    expect('every finished run with a session is measured, judged or not', r.spend.runsMeasured === 5);
    expect('a finished run the owner never judged is counted, not passed over', r.unjudged === 3);
    expect('a session the machine does not have is counted, not guessed', r.spend.sessionsNotFound === 1);
    expect('what the runs cost is added up', r.spend.costUSD === 15 && r.spend.linesAdded === 53);

    const owner = JSON.parse(cli('summary', fifth, '--json'));
    expect('a short gap before the owner\'s message is him answering, a long one is not',
      owner.spend.ownerMinutes === 3 && owner.spend.awayMinutes === 90);
    expect('the worker\'s own working copy is counted as the run\'s',
      owner.spend.sessions === 2 && owner.spend.sideCopies === 1 && owner.spend.peakThreads === 2);
    // 109 minutes on the clock. The run's session is busy 0-14, 17-18 and
    // 108-109 and the owner answered 14-17; the worker ran 1-21 beside it.
    // Laid over each other that is 0-21 and 108-109: 22 minutes occupied,
    // while the agents' own minutes, summed, are 16 and 20.
    expect('a run occupies its stretches once, however many agents ran in them',
      owner.occupiedMinutes === 22 && owner.elapsedMinutes === 109 && owner.spend.agentMinutes === 36);
    expect('what the run was doing is named, the call and the minutes that led to it',
      owner.spend.kinds.test === 14);

    expect('too little history says so', !JSON.parse(run(['pace', '--project', 'empty', '--json'])).enough);

    const FIX = recordedShapes(expect);
    if (FIX) {
      // Two runs open at once, and a working copy neither recorded that ran
      // across both: the stretch they share is charged to neither. The session
      // is a real worker's, stripped to its structure: 11:29:31 to 11:32:14.
      const worker = readFileSync(join(FIX, 'claude-worker.jsonl'), 'utf8').split('\n').filter(Boolean)
        .map((l) => JSON.parse(l.replaceAll('/fixture/cwd', copy)));
      transcript('shared', worker, copy);
      const a = cli('start', '--feature', 'Run A', '--work', '5', '--wait', '0').split('\n')[0];
      const b = cli('start', '--feature', 'Run B', '--work', '5', '--wait', '0').split('\n')[0];
      edit(a, (x) => { x.startedAt = '2026-09-23T11:29:00Z'; x.finishedAt = '2026-09-23T11:31:00Z'; x.result = 'stopped'; });
      edit(b, (x) => { x.startedAt = '2026-09-23T11:30:00Z'; x.finishedAt = '2026-09-23T11:40:00Z'; x.result = 'stopped'; });
      const sa = JSON.parse(cli('summary', a, '--json'));
      const sb = JSON.parse(cli('summary', b, '--json'));
      const whole = (Date.parse(worker.at(-1).timestamp) - Date.parse(worker[0].timestamp)) / 60e3;
      scanned.clear();
      const aSpend = spend(JSON.parse(readFileSync(record(a), 'utf8')));
      const bSpend = spend(JSON.parse(readFileSync(record(b), 'utf8')));
      const charged = (s) => s.model + s.tools + s.coordination + s.answering + s.awayMinutes;
      expect('recorded: a working copy two runs share is not charged to both',
        sa.spend.unattributedMinutes === 1 && sb.spend.unattributedMinutes === 1);
      expect('recorded: what each run is charged and what neither is add up to the session, once',
        Math.abs(charged(aSpend) + charged(bSpend) + aSpend.unattributedMinutes - whole) < 0.02);
      expect('recorded: a session cut by a run\'s window carries none of its cost', aSpend.costUnknown === 1 && aSpend.costUSD === 0);
      const shared = () => JSON.parse(cli('report', '--json')).spend.unattributedMinutes;
      expect('recorded: a report over two runs counts the minute they share once', shared() === 1);
      // A third run open across the end of both: the stretch 11:30 to 11:32 is
      // contested, once, whichever runs saw it.
      const e = cli('start', '--feature', 'Run E', '--work', '5', '--wait', '0').split('\n')[0];
      edit(e, (x) => { x.startedAt = '2026-09-23T11:30:30Z'; x.finishedAt = '2026-09-23T11:32:00Z'; x.result = 'stopped'; });
      expect('recorded: a report over three runs counts what they share once', shared() === 2);
      edit(e, (x) => { x.startedAt = '2026-09-22T09:00:00Z'; x.finishedAt = '2026-09-22T09:01:00Z'; });
      // Both runs recorded the same working copy, as a record written by hand
      // could: the stretch they share is contested, not charged to both.
      edit(a, (x) => { x.copies = [copy]; });
      edit(b, (x) => { x.copies = [copy]; });
      scanned.clear();
      const ca = spend(JSON.parse(readFileSync(record(a), 'utf8')));
      const cb = spend(JSON.parse(readFileSync(record(b), 'utf8')));
      expect('recorded: a working copy two runs both recorded is charged once, the shared stretch to neither',
        Math.abs(charged(ca) + charged(cb) + ca.unattributedMinutes - whole) < 0.02 && ca.unattributedMinutes === cb.unattributedMinutes && ca.unattributedMinutes > 0.9);
      edit(a, (x) => { x.copies = []; });
      edit(b, (x) => { x.copies = []; });
      // The same working copy, recorded by run B: then it is B's, inside B's window only.
      cli('session', b, '--copy', copy);
      scanned.clear();
      const bound = spend(JSON.parse(readFileSync(record(b), 'utf8')));
      const unbound = spend(JSON.parse(readFileSync(record(a), 'utf8')));
      expect('recorded: a working copy a run recorded is that run\'s alone, inside its own window',
        bound.unattributedMinutes === 0 && unbound.found === 0
        && Math.abs(charged(bound) - (Date.parse(worker.at(-1).timestamp) - Date.parse('2026-09-23T11:30:00Z')) / 60e3) < 0.02);
    }

    // Two open runs cannot both record one session or one working copy.
    const r1 = cli('start', '--feature', 'Holder', '--work', '5', '--wait', '0', '--harness', 'claude-code', '--session', 'dup').split('\n')[0];
    cli('session', r1, '--copy', join(home, 'w', 'copy-x'));
    const r2 = cli('start', '--feature', 'Taker', '--work', '5', '--wait', '0').split('\n')[0];
    expect('misuse: a session another open run recorded', misuse(['session', r2, '--project', 'demo', '--harness', 'claude-code', '--session', 'dup'])
      && misuse(['start', '--project', 'demo', '--feature', 'Third', '--work', '1', '--wait', '0', '--harness', 'claude-code', '--session', 'dup']));
    expect('misuse: a working copy another open run recorded', misuse(['session', r2, '--project', 'demo', '--copy', join(home, 'w', 'copy-x')])
      && misuse(['session', r2, '--project', 'demo', '--copy', join(home, 'w', 'copy-x', 'sub')]));
    // Finishing the holder does not free what it recorded for a run whose
    // window overlapped it.
    edit(r1, (y) => { y.finishedAt = new Date().toISOString(); y.result = 'stopped'; });
    expect('misuse: a session an overlapping run recorded, after that run finished',
      misuse(['session', r2, '--project', 'demo', '--harness', 'claude-code', '--session', 'dup'])
      && misuse(['session', r2, '--project', 'demo', '--copy', join(home, 'w', 'copy-x')]));
    // A record named by its path is still checked against the project.
    const foreign = join(home, 'foreign-run.json');
    save(foreign, { ...JSON.parse(readFileSync(record(r2), 'utf8')), project: 'other' });
    let refusal = '';
    try { run(['summary', foreign, '--project', 'demo']); } catch (e) { refusal = e instanceof Usage ? e.message : ''; }
    expect('misuse: a run record of another project given by its path', refusal.includes('is a run of other'));
    for (const x of [r1, r2]) edit(x, (y) => { y.startedAt = iso(day(60)); y.finishedAt = iso(day(60) + 60e3); y.result = 'stopped'; });

    const open = cli('start', '--feature', 'Open run', '--work', '10', '--wait', '5').split('\n')[0];
    const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
    edit(open, (x) => { x.startedAt = ago(120); x.estimate.dueAt = ago(105); });
    // The owner said he would be away eight hours: the promise is the
    // forecast plus that, and two hours in the run is not late.
    const away = cli('start', '--feature', 'Away run', '--work', '10', '--wait', '5', '--away', '480').split('\n')[0];
    const promised = JSON.parse(readFileSync(record(away), 'utf8'));
    expect('the promise is the forecast plus the announced absence',
      Date.parse(promised.estimate.dueAt) - Date.parse(promised.startedAt) === 495 * 60e3);
    edit(away, (x) => { x.startedAt = ago(120); x.estimate.dueAt = new Date(Date.now() + 375 * 60e3).toISOString(); });
    const told = JSON.parse(cli('stalled', '--json')).find((x) => x.run === away);
    expect('a run inside its promise is not late, though past its occupied forecast', !told.pastForecast && told.runningMinutes > told.estimatedMinutes);
    expect('stalled shows the forecast and the promised time', cli('stalled').includes('promised by') && cli('stalled').includes('(forecast 15 min occupied)'));
    cli('finish', away, '--result', 'stopped');
    expect('misuse: a promised time that is not one', misuse(['start', '--project', 'demo', '--feature', 'x', '--work', '1', '--wait', '1', '--due', 'soon']));
    const fresh = cli('start', '--feature', 'Fresh run', '--work', '60', '--wait', '30').split('\n')[0];
    const late = JSON.parse(cli('stalled', '--json'));
    expect('a run with no end recorded is found', late.some((x) => x.run === open) && late.some((x) => x.run === fresh));
    expect('only a run past its forecast is called late', late.find((x) => x.run === open).pastForecast
      && !late.find((x) => x.run === fresh).pastForecast);
    expect('a late run says how long it has been quiet', late.find((x) => x.run === open).quietMinutes >= 119);
    expect('finished runs are not open', !late.some((x) => ids.includes(x.run)));
    const withOpen = JSON.parse(cli('report', '--no-transcripts', '--json'));
    expect('the report counts open runs and late ones', withOpen.open === 2 && withOpen.pastForecast === 1);
    const finished = cli('finish', open, '--result', 'stopped');
    expect('finish with no session found says so, and the clock apart', finished.includes('no session of this run was found')
      && finished.includes('min of clock') && !finished.includes(' after '));
    // A run that recorded a session: finish says what summary says.
    const said = cli('start', '--feature', 'Said run', '--work', '10', '--wait', '5', '--harness', 'claude-code', '--session', 's9').split('\n')[0];
    transcript('s9', worked(day(50), 60));
    edit(said, (x) => { x.startedAt = iso(day(50)); });
    const done = cli('finish', said, '--result', 'pull-request');
    const line = done.slice(done.indexOf('. ') + 2);
    expect('finish says the occupied minutes and the clock apart, in summary\'s words',
      line.startsWith('Estimated 15 min; it occupied 60 min') && cli('summary', said).includes(line));
    edit(said, (x) => { x.startedAt = iso(day(50)); x.finishedAt = iso(day(50) + 90 * 60e3); });
    expect('ending the record closes the question', !JSON.parse(cli('stalled', '--json')).some((x) => x.run === open));

    const sum = JSON.parse(cli('summary', ids[0], '--json'));
    expect('summary gives one run\'s estimate against what it occupied', sum.estimatedMinutes === 30 && sum.occupiedMinutes === 60);
    expect('summary carries the stops, the verdict and the size', sum.stops.owner === 1 && sum.accepted === 'as-is' && sum.tasks === 2);
    expect('summary carries what the sessions cost', sum.spend.costUSD === 2 && sum.spend.linesAdded === 10);
    const text = cli('summary', ids[0]);
    expect('the text says both numbers, in finish\'s words', text.includes('Estimated 30 min; it occupied 60 min') && text.includes('180 min of clock'));

    expect('misuse: unknown command', misuse(['frobnicate', '--project', 'demo']));
    expect('misuse: start without estimate', misuse(['start', '--project', 'demo', '--feature', 'x']));
    expect('misuse: stop without reason', misuse(['event', ids[0], '--project', 'demo', '--kind', 'stop']));
    expect('misuse: bad verdict', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'maybe']));
    expect('misuse: negative count', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'as-is', '--rescues', '-1']));
    expect('misuse: harness without session', misuse(['session', ids[0], '--project', 'demo', '--harness', 'codex']));
    expect('misuse: no session given or found', misuse(['session', ids[0], '--project', 'demo']));
    expect('misuse: missing run', misuse(['finish', 'nope', '--project', 'demo', '--result', 'abandoned']));
    expect('misuse: summary without a run', misuse(['summary', '--project', 'demo']));
  } catch (e) {
    expect(`the self-test ran to its end (${e.message})`, false);
  } finally {
    process.chdir(savedCwd);
    process.env = saved;
    rmSync(home, { recursive: true, force: true });
  }
  console.log(failures.length ? `${failures.length} failed` : 'all passed');
  return failures.length ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') return selftest();
  if (!args.length || args[0] === '--help') { console.log(HELP); return args.length ? 0 : 2; }
  try {
    console.log(run(args));
    return 0;
  } catch (e) {
    if (!(e instanceof Usage)) throw e;
    console.error(`${e.message}\n\n${HELP}`);
    return 2;
  }
}

process.exitCode = main();
