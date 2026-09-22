#!/usr/bin/env node
// The run journal: one record per feature run, kept outside the repository, so
// that what a run was forecast to cost and what it cost are both on record.
// The minutes themselves come from the ledger, which reads what the harness
// measured; this file keeps only what no machine can know by itself — the
// forecast, the stops, and the owner's verdict.
// take-task owns this file; close-out and ask-shady2k carry copies of it.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Usage, findSessions, projectName, threads } from './ledger.mjs';

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

function load(project, ref) {
  const path = ref.endsWith('.json') && existsSync(ref) ? ref : join(runsDir(project), `${ref}.json`);
  if (!existsSync(path)) throw new Usage(`no run record ${ref}`);
  return { path, run: JSON.parse(readFileSync(path, 'utf8')) };
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
// same ones once per run.
const scanned = new Map();
const sessionsOfProject = (project) => {
  if (!scanned.has(project)) scanned.set(project, findSessions(project));
  return scanned.get(project);
};

/**
 * The sessions a run was made of: the ones it recorded for itself, and every
 * second working copy that was open while it ran, because those exist only
 * because a run made them. A conversation in the checkout that the run never
 * recorded is somebody else's and is left alone.
 */
function sessionsOf(run) {
  const from = Date.parse(run.startedAt);
  const to = Date.parse(run.finishedAt || run.verdict?.at || now());
  const ids = new Set((run.sessions || []).map((s) => s.id));
  return sessionsOfProject(run.project).filter((s) =>
    ids.has(s.id) || (s.role === 'side copy' && Date.parse(s.endedAt) >= from && Date.parse(s.startedAt) <= to));
}

// A run's minutes, split by who spent them. Everything but the owner's own
// minutes is what the harness measured; his are an estimate, and his absence
// is in no forecast and belongs to no one.
function spend(run) {
  const sessions = sessionsOf(run);
  const sum = (f) => sessions.reduce((n, s) => n + f(s), 0);
  const seen = new Set(sessions.map((s) => s.id));
  const model = sum((s) => s.modelMinutes);
  const tools = sum((s) => s.toolMinutes);
  const answering = sum((s) => s.answerMinutes);
  const coordination = sum((s) => s.overheadMinutes);
  const kinds = {};
  for (const s of sessions) for (const [k, m] of Object.entries(s.kinds)) kinds[k] = (kinds[k] || 0) + m;
  return {
    found: sessions.length,
    missing: (run.sessions || []).filter((s) => !seen.has(s.id)).length,
    sideCopies: sessions.filter((s) => s.role === 'side copy').length,
    ownerMessages: sum((s) => s.ownerMessages),
    model, tools, answering, coordination,
    // What the run occupied, which is what a forecast is a forecast of.
    effortMinutes: model + tools + answering + coordination,
    // Only a session the owner was in can have been a session he left.
    awayMinutes: sum((s) => (s.ownerMessages ? s.awayMinutes : 0)),
    kinds: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, round(m)])),
    threads: threads(sessions),
    costUSD: Math.round(sum((s) => s.costUSD) * 100) / 100,
    linesAdded: sum((s) => s.linesAdded),
    linesRemoved: sum((s) => s.linesRemoved),
    output: sum((s) => s.tokens.output),
  };
}

// ---- figures ---------------------------------------------------------------

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const round = (n) => Math.round(n);

function pace(project, opts) {
  const done = all(project).filter((r) => r.finishedAt && r.result === 'pull-request' && r.estimate);
  const tasks = opts.tasks === undefined ? null : count(opts, 'tasks');
  const out = { runs: done.length };
  if (done.length < 3) return { ...out, enough: false };
  // What a run occupied, not how long its record stayed open: the nights in
  // between are the owner's, and no forecast ever meant them.
  const effort = done.map((r) => spend(r).effortMinutes);
  const elapsed = done.map((r) => minutes(r.startedAt, r.finishedAt));
  const ratio = done.map((r, i) => effort[i] / Math.max(1, r.estimate.workMinutes + r.estimate.waitMinutes));
  out.enough = true;
  out.estimateRatio = +quantile(ratio, 0.5).toFixed(2);
  out.elapsedLow = round(quantile(elapsed, 0.25));
  out.elapsedHigh = round(quantile(elapsed, 0.75));
  const perTask = done.map((r, i) => (r.estimate.tasks > 0 ? effort[i] / r.estimate.tasks : null)).filter((x) => x !== null);
  if (tasks && perTask.length >= 3) {
    out.basis = `${perTask.length} runs, per task`;
    out.low = round(quantile(perTask, 0.25) * tasks);
    out.high = round(quantile(perTask, 0.75) * tasks);
  } else {
    out.basis = `${done.length} runs, whole runs`;
    out.low = round(quantile(effort, 0.25));
    out.high = round(quantile(effort, 0.75));
  }
  return out;
}

function report(project, opts) {
  const runs = all(project);
  const judged = runs.filter((r) => r.verdict);
  const accepted = judged.filter((r) => r.verdict.accepted !== 'abandoned');
  const autonomous = accepted.filter((r) => !r.verdict.corrections && !r.verdict.rescues);
  const sum = (rs, f) => rs.reduce((n, r) => n + f(r), 0);
  const sum2 = sum;
  const stops = runs.flatMap((r) => (r.events || []).filter((e) => e.kind === 'stop'));
  const out = {
    runs: runs.length,
    finished: runs.filter((r) => r.finishedAt).length,
    judged: judged.length,
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
    const spent = runs.filter((r) => r.finishedAt).map(spend).filter((s) => s.found);
    const attention = sum2(spent, (s) => s.answering);
    const delivered = judged.filter((r) => r.verdict.accepted !== 'abandoned').length;
    out.spend = {
      runsMeasured: spent.length,
      attentionMinutes: round(attention),
      acceptedPerAttentionHour: delivered && attention ? +(delivered / (attention / 60)).toFixed(2) : null,
      medianEffortMinutes: spent.length ? round(quantile(spent.map((s) => s.effortMinutes), 0.5)) : null,
      medianAgentMinutes: spent.length ? round(quantile(spent.map((s) => s.model + s.tools), 0.5)) : null,
      medianSessions: spent.length ? round(quantile(spent.map((s) => s.found), 0.5)) : null,
      peakThreads: spent.reduce((n, s) => Math.max(n, s.threads.peak), 0),
      costUSD: Math.round(sum2(spent, (s) => s.costUSD) * 100) / 100,
      linesAdded: sum2(spent, (s) => s.linesAdded),
      sessionsNotFound: sum2(spent, (s) => s.missing),
    };
  }
  return out;
}

// One run's measured numbers, for the comment that carries them off this
// machine: the journal is local state, a tracker comment is read from anywhere.
function summary(r) {
  const stops = (r.events || []).filter((e) => e.kind === 'stop');
  const s = spend(r);
  return {
    run: r.id, feature: r.feature, startedAt: r.startedAt, finishedAt: r.finishedAt || null,
    result: r.result || 'running',
    estimatedMinutes: r.estimate.workMinutes + r.estimate.waitMinutes,
    effortMinutes: round(s.effortMinutes),
    elapsedMinutes: round(minutes(r.startedAt, r.finishedAt || now())),
    tasks: r.estimate.tasks, stages: r.estimate.stages,
    stops: { owner: stops.filter((e) => e.reason === 'owner').length, missing: stops.filter((e) => e.reason === 'missing').length },
    ci: (r.events || []).filter((e) => e.kind === 'ci').length,
    accepted: r.verdict ? r.verdict.accepted : null,
    spend: {
      sessions: s.found, sideCopies: s.sideCopies, peakThreads: s.threads.peak,
      model: round(s.model), tools: round(s.tools), coordination: round(s.coordination),
      ownerMinutes: round(s.answering), ownerMessages: s.ownerMessages, awayMinutes: round(s.awayMinutes),
      kinds: s.kinds, costUSD: s.costUSD, linesAdded: s.linesAdded, linesRemoved: s.linesRemoved,
    },
  };
}

function describeSummary(s) {
  const p = s.spend;
  const kinds = Object.entries(p.kinds).filter(([, m]) => m >= 1).map(([k, m]) => `${k} ${m}`).join(', ');
  return [
    `Run ${s.run}, ${s.result}${s.accepted ? `, accepted ${s.accepted}` : ''}, ${(s.finishedAt || s.startedAt).slice(0, 10)}`,
    `Estimated ${s.estimatedMinutes} min for ${s.tasks} task(s) in ${s.stages} stage(s); ` +
      `it took ${s.effortMinutes} min of work over ${s.elapsedMinutes} min of clock`,
    `Work: the model ${p.model}, tools ${p.tools}, the owner ${p.ownerMinutes} over ${p.ownerMessages} message(s), ` +
      `coordination ${p.coordination}; the owner away ${p.awayMinutes}`,
    p.sessions
      ? `${p.sessions} session(s), ${p.sideCopies} in working copies of their own, ${p.peakThreads} at once at the peak`
      : 'No session of this run was found on this machine: its minutes are not measured',
    `On: ${kinds || 'nothing measured'}`,
    `Stops: for the owner ${s.stops.owner}, missing information ${s.stops.missing}; CI runs ${s.ci}`,
    `Cost $${p.costUSD}, ${p.linesAdded} line(s) written and ${p.linesRemoved} removed`,
  ].join('\n');
}

// Runs that started and never came back: an unattended run cannot report its
// own death, so what it leaves is a record with no end, found by whoever looks.
function stalled(project) {
  return all(project).filter((r) => !r.finishedAt).map((r) => {
    const events = r.events || [];
    const last = events.length ? events.at(-1).at : (r.sessions || []).map((x) => x.at).pop() || r.startedAt;
    const e = events.at(-1);
    return {
      run: r.id, feature: r.feature, startedAt: r.startedAt,
      estimatedMinutes: r.estimate.workMinutes + r.estimate.waitMinutes,
      runningMinutes: round(minutes(r.startedAt, now())),
      quietMinutes: round(minutes(last, now())),
      lastEvent: e ? `${e.kind}${e.reason ? ` (${e.reason})` : ''}` : null,
      pastForecast: minutes(r.startedAt, now()) > r.estimate.workMinutes + r.estimate.waitMinutes,
    };
  });
}

function describeStalled(rows) {
  if (!rows.length) return 'No run is open.';
  const late = rows.filter((r) => r.pastForecast);
  const line = (r) => `${r.run}: ${r.runningMinutes} min against a forecast of ${r.estimatedMinutes}, ` +
    `quiet ${r.quietMinutes} min, last ${r.lastEvent || 'nothing recorded'} \u2014 ${r.feature}`;
  const out = late.length
    ? [`${late.length} run(s) past their forecast with no end recorded:`, ...late.map(line)]
    : ['No run is past its forecast.'];
  const running = rows.filter((r) => !r.pastForecast);
  if (running.length) out.push(`${running.length} run(s) still inside their forecast.`);
  return out.join('\n');
}

function describePace(p) {
  if (!p.enough) return `Too little history for a measured estimate: ${p.runs} finished run(s), 3 needed. Any estimate is a guess.`;
  return `Similar work took ${p.low}-${p.high} minutes of work (${p.basis}), ` +
    `over ${p.elapsedLow}-${p.elapsedHigh} minutes of clock. ` +
    `Runs took ${p.estimateRatio} times their estimate (median): correct a new estimate by that.`;
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
  const project = () => projectName(opts.project);
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
          tasks: count(opts, 'tasks'), stages: count(opts, 'stages'), basis: opts.basis || null,
        },
        sessions: session(opts), events: [], recoveries: [],
      };
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
      const s = session(opts);
      if (!s.length) throw new Usage('this harness does not say which session this is: pass --harness and --session');
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
      const took = minutes(r.startedAt, r.finishedAt);
      const est = r.estimate.workMinutes + r.estimate.waitMinutes;
      return print(r, `${r.id}: ${r.result} after ${round(took)} min, estimated ${est} min`);
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
        `Accepted as is ${r.acceptedAsIs}, after changes ${r.acceptedAfterChanges}, abandoned ${r.abandoned}`,
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
          `a run takes ${r.spend.medianEffortMinutes} min of work (median), ${r.spend.medianAgentMinutes} of them the agents', ` +
          `over ${r.spend.medianSessions} session(s), up to ${r.spend.peakThreads} at once; ` +
          `$${r.spend.costUSD} and ${r.spend.linesAdded} line(s) written in all`
        : 'No session of any finished run was found on this machine: its minutes are not measured');
      return print(r, lines.join('\n'));
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

const HELP = `runs.mjs start --feature <title> --work <min> --wait <min> [--tasks N] [--stages N] [--basis <text>] [--harness <h> --session <id>]
runs.mjs session <run> [--harness <h> --session <id>]
start and session record the current session by themselves where the harness names it.
runs.mjs event <run> --kind stop|decision|ci [--reason owner|missing] [--note <text>]
runs.mjs finish <run> --result pull-request|abandoned|stopped [--pr <url>]
runs.mjs verdict <run> --accepted as-is|after-changes|abandoned [--avoidable N] [--missed N] [--corrections N] [--rescues N] [--note <text>]
runs.mjs recovery <run> --grade R0|R1|R2|R3 [--from <h>] [--to <h>] [--note <text>]
runs.mjs summary <run>   one run's measured numbers, for the tracker comment that carries them
runs.mjs stalled         runs that started and recorded no end, and which passed their forecast
runs.mjs list | pace [--tasks N] | report [--no-transcripts]
Every command takes [--project <name>] (default: the checkout's main folder name) and [--json].
Records live in $SHADY2K_STATE_DIR, else $XDG_STATE_HOME/shady2k-skills, else ~/.local/state/shady2k-skills.
Exit 0 done, 2 misuse.`;

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'runs-selftest-'));
  const saved = { ...process.env };
  process.env.SHADY2K_STATE_DIR = join(home, 'state');
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  for (const [, key] of HERE) delete process.env[key];
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const cli = (...a) => run([...a, '--project', 'demo']);
  const misuse = (a) => { try { run(a); return false; } catch (e) { return e instanceof Usage; } };
  try {
    // Four finished runs, each estimated at 30 minutes. Each left one session
    // that says what it really spent, and each record stayed open three times
    // as long as the work took, because the owner came back the next day.
    const iso = (ms) => new Date(ms).toISOString();
    const day = (i) => Date.parse('2026-01-01T10:00:00Z') + i * 864e5;
    const projects = join(home, 'claude', 'projects', '-w-demo');
    mkdirSync(projects, { recursive: true });
    const transcript = (name, rows) =>
      writeFileSync(join(projects, `${name}.jsonl`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    const worked = (startMs, min) => [
      { type: 'user', timestamp: iso(startMs), cwd: '/w/demo', message: { content: 'run it' } },
      { type: 'assistant', timestamp: iso(startMs + min * 60e3), message: { content: [{ type: 'text', text: 'done' }] } },
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
      const path = join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${id}.json`);
      const r = JSON.parse(readFileSync(path, 'utf8'));
      r.startedAt = iso(day(i));
      r.finishedAt = iso(day(i) + m * 3 * 60e3);
      r.result = 'pull-request';
      save(path, r);
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

    // A fifth run, stopped rather than delivered, where the owner answered
    // once in three minutes and once after an hour and a half away. A worker
    // was started in a working copy of its own while it ran.
    const fifth = cli('start', '--feature', 'The owner run', '--work', '30', '--wait', '0', '--tasks', '1',
      '--harness', 'claude-code', '--session', 's4').split('\n')[0];
    const fifthPath = join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${fifth}.json`);
    const fifthStart = day(9);
    const at = (min) => iso(fifthStart + min * 60e3);
    transcript('s4', [
      { type: 'user', timestamp: at(0), cwd: '/w/demo', message: { content: 'start' } },
      { type: 'assistant', timestamp: at(10), message: { content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: at(14), message: { content: [{ type: 'tool_result', tool_use_id: 't' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(14), durationMs: 14 * 60e3 },
      { type: 'user', timestamp: at(17), message: { content: 'go on' } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(18), durationMs: 60e3 },
      { type: 'user', timestamp: at(108), message: { content: 'back' } },
      { type: 'system', subtype: 'turn_duration', timestamp: at(109), durationMs: 60e3 },
      {
        type: 'cost-state', startTime: fifthStart, totalAPIDuration: 11 * 60e3, totalToolDuration: 4 * 60e3,
        totalDuration: 109 * 60e3, totalCostUSD: 5, totalLinesAdded: 3, totalLinesRemoved: 0, modelUsage: {},
      },
    ]);
    mkdirSync(join(home, 'claude', 'projects', '-w-demo-work-1'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', '-w-demo-work-1', 'w1.jsonl'),
      `${worked(fifthStart + 60e3, 20).map((r) => JSON.stringify({ ...r, cwd: r.cwd ? '/w/demo-work-1' : undefined })).join('\n')}\n`);
    const fifthRecord = JSON.parse(readFileSync(fifthPath, 'utf8'));
    fifthRecord.startedAt = iso(fifthStart);
    fifthRecord.finishedAt = iso(fifthStart + 109 * 60e3);
    fifthRecord.result = 'stopped';
    save(fifthPath, fifthRecord);

    const p = JSON.parse(cli('pace', '--tasks', '2', '--json'));
    expect('pace measures from four delivered runs', p.enough && p.runs === 4);
    expect('pace reports how far the estimates were off (median 90/30 = 3x)', p.estimateRatio === 3);
    expect('pace gives a range for the size asked', p.low === 75 && p.high === 105);
    expect('the forecast is answered by the work, not by the calendar',
      p.elapsedLow === 225 && p.elapsedHigh === 315);

    const r = JSON.parse(cli('report', '--json'));
    expect('report counts verdicts', r.acceptedAsIs === 1 && r.acceptedAfterChanges === 1 && r.abandoned === 1);
    expect('only a run without corrections or rescue counts as delivered alone', r.autonomous === 1);
    expect('report separates stops for the owner from missing information', r.stops.owner === 1 && r.stops.missing === 1);
    expect('report counts what the owner judged', r.avoidableQuestions === 1 && r.missedEscalations === 1 && r.corrections === 1 && r.rescues === 1);
    expect('report counts recovery grades', r.recoveries.R3 === 1 && r.recoveries.R0 === 0);
    expect('every finished run is measured, judged or not', r.spend.runsMeasured === 5);
    expect('a session the machine does not have is counted, not guessed', r.spend.sessionsNotFound === 1);
    expect('what the runs cost is added up', r.spend.costUSD === 15 && r.spend.linesAdded === 53);

    const owner = JSON.parse(cli('summary', fifth, '--json'));
    expect('a short gap before the owner\'s message is him answering, a long one is not',
      owner.spend.ownerMinutes === 3 && owner.spend.awayMinutes === 90);
    expect('the worker\'s own working copy is counted as the run\'s',
      owner.spend.sessions === 2 && owner.spend.sideCopies === 1 && owner.spend.peakThreads === 2);
    // 109 minutes on the clock, 90 of them nobody's: 19 left in the run's own
    // session, and 20 more in the worker's, which ran inside them.
    expect('a run\'s work leaves out the hour and a half nobody spent',
      owner.effortMinutes === 39 && owner.elapsedMinutes === 109);
    expect('what the run was doing is named, the call and the minutes that led to it',
      owner.spend.kinds.test === 15);

    expect('too little history says so', !JSON.parse(run(['pace', '--project', 'empty', '--json'])).enough);

    const open = cli('start', '--feature', 'Open run', '--work', '10', '--wait', '5').split('\n')[0];
    const openPath = join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${open}.json`);
    const stale = JSON.parse(readFileSync(openPath, 'utf8'));
    stale.startedAt = new Date(Date.now() - 120 * 60e3).toISOString();
    save(openPath, stale);
    const fresh = cli('start', '--feature', 'Fresh run', '--work', '60', '--wait', '30').split('\n')[0];
    const late = JSON.parse(cli('stalled', '--json'));
    expect('a run with no end recorded is found', late.some((r) => r.run === open) && late.some((r) => r.run === fresh));
    expect('only a run past its forecast is called late', late.find((r) => r.run === open).pastForecast
      && !late.find((r) => r.run === fresh).pastForecast);
    expect('a late run says how long it has been quiet', late.find((r) => r.run === open).quietMinutes >= 119);
    expect('finished runs are not open', !late.some((r) => ids.includes(r.run)));
    const withOpen = JSON.parse(cli('report', '--no-transcripts', '--json'));
    expect('the report counts open runs and late ones', withOpen.open === 3 && withOpen.pastForecast === 1);
    cli('finish', open, '--result', 'stopped');
    expect('ending the record closes the question', !JSON.parse(cli('stalled', '--json')).some((r) => r.run === open));

    const sum = JSON.parse(cli('summary', ids[0], '--json'));
    expect('summary gives one run\'s estimate against the work it took', sum.estimatedMinutes === 30 && sum.effortMinutes === 60);
    expect('summary carries the stops, the verdict and the size', sum.stops.owner === 1 && sum.accepted === 'as-is' && sum.tasks === 2);
    expect('summary carries what the sessions cost', sum.spend.costUSD === 2 && sum.spend.linesAdded === 10);
    expect('the text says both numbers', cli('summary', ids[0]).includes('Estimated 30 min')
      && cli('summary', ids[0]).includes('60 min of work'));

    expect('misuse: unknown command', misuse(['frobnicate', '--project', 'demo']));
    expect('misuse: start without estimate', misuse(['start', '--project', 'demo', '--feature', 'x']));
    expect('misuse: stop without reason', misuse(['event', ids[0], '--project', 'demo', '--kind', 'stop']));
    expect('misuse: bad verdict', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'maybe']));
    expect('misuse: negative count', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'as-is', '--rescues', '-1']));
    expect('misuse: harness without session', misuse(['session', ids[0], '--project', 'demo', '--harness', 'codex']));
    expect('misuse: no session given or found', misuse(['session', ids[0], '--project', 'demo']));
    expect('misuse: missing run', misuse(['finish', 'nope', '--project', 'demo', '--result', 'abandoned']));
    expect('misuse: summary without a run', misuse(['summary', '--project', 'demo']));
  } finally {
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
